<?php

namespace App\Service\Tts;

class ElevenLabsClient implements ElevenLabsClientInterface
{
    private const BASE_URL = 'https://api.elevenlabs.io';
    private const DEFAULT_MODEL = 'eleven_flash_v2_5';
    private static ?ElevenLabsClientInterface $testDouble = null;

    public static function setTestDouble(?ElevenLabsClientInterface $testDouble): void
    {
        self::$testDouble = $testDouble;
    }

    public function listVoices(string $secret): array
    {
        if (self::$testDouble !== null) {
            return self::$testDouble->listVoices($secret);
        }

        $context = stream_context_create([
            'http' => [
                'method' => 'GET',
                'header' => implode("\r\n", [
                    'xi-api-key: '.$secret,
                    'Accept: application/json',
                ]),
                'timeout' => 20,
                'ignore_errors' => true,
            ],
        ]);

        $body = @file_get_contents(self::BASE_URL.'/v1/voices', false, $context);
        $statusCode = $this->extractStatusCode($http_response_header ?? []);

        if (!is_string($body) || $body === '') {
            throw new \RuntimeException('ElevenLabs voice list returned an empty response.');
        }

        $decoded = json_decode($body, true);
        if (!is_array($decoded)) {
            throw new \RuntimeException('ElevenLabs voice list returned invalid JSON.');
        }

        if ($statusCode >= 400) {
            throw new \RuntimeException($this->extractErrorMessage($decoded, 'Unable to load ElevenLabs voices.'));
        }

        $voices = [];
        foreach (($decoded['voices'] ?? []) as $voice) {
            if (!is_array($voice)) {
                continue;
            }

            $id = trim((string) ($voice['voice_id'] ?? ''));
            $name = trim((string) ($voice['name'] ?? ''));
            if ($id === '' || $name === '') {
                continue;
            }

            $labels = [];
            foreach (($voice['labels'] ?? []) as $key => $value) {
                if (is_string($key) && is_string($value) && trim($value) !== '') {
                    $labels[$key] = trim($value);
                }
            }

            $voices[] = [
                'id' => $id,
                'name' => $name,
                'gender' => $this->normalizeGender($labels['gender'] ?? null),
                'labels' => $labels,
                'category' => $this->normalizeNullableString($voice['category'] ?? null),
                'description' => $this->normalizeNullableString($voice['description'] ?? null),
                'previewUrl' => $this->normalizeNullableString($voice['preview_url'] ?? null),
            ];
        }

        usort($voices, static function (array $left, array $right): int {
            return [$left['gender'] ?? '', $left['name']] <=> [$right['gender'] ?? '', $right['name']];
        });

        return $voices;
    }

    public function streamSpeech(
        string $secret,
        string $voiceId,
        string $text,
        ?string $modelId,
        callable $onChunk,
    ): void {
        if (self::$testDouble !== null) {
            self::$testDouble->streamSpeech($secret, $voiceId, $text, $modelId, $onChunk);

            return;
        }

        if (!function_exists('curl_init')) {
            throw new \RuntimeException('The cURL extension is required for ElevenLabs streaming TTS.');
        }

        $payload = [
            'text' => $text,
            'model_id' => $modelId ?: self::DEFAULT_MODEL,
        ];

        $ch = curl_init(self::BASE_URL.'/v1/text-to-speech/'.rawurlencode($voiceId).'/stream');
        if ($ch === false) {
            throw new \RuntimeException('Unable to initialize the ElevenLabs stream.');
        }

        $rawResponse = '';
        $statusCode = 0;

        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => [
                'xi-api-key: '.$secret,
                'Accept: audio/mpeg',
                'Content-Type: application/json',
            ],
            CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_SLASHES),
            CURLOPT_CONNECTTIMEOUT => 15,
            CURLOPT_TIMEOUT => 0,
            CURLOPT_LOW_SPEED_LIMIT => 1,
            CURLOPT_LOW_SPEED_TIME => 40,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_NOSIGNAL => true,
            CURLOPT_RETURNTRANSFER => false,
            CURLOPT_HEADER => false,
            CURLOPT_WRITEFUNCTION => static function ($curl, string $chunk) use (&$rawResponse, &$statusCode, $onChunk): int {
                $statusCode = curl_getinfo($curl, CURLINFO_RESPONSE_CODE) ?: $statusCode;

                if ($statusCode >= 400) {
                    $rawResponse .= $chunk;

                    return strlen($chunk);
                }

                $onChunk($chunk);

                return strlen($chunk);
            },
        ]);

        $executed = curl_exec($ch);
        $curlErrno = curl_errno($ch);
        $curlError = curl_error($ch);
        $statusCode = curl_getinfo($ch, CURLINFO_RESPONSE_CODE) ?: $statusCode;
        curl_close($ch);

        if ($executed === false) {
            $message = $curlError !== '' ? $curlError : 'Unable to stream ElevenLabs audio.';
            throw new \RuntimeException($message);
        }

        if ($statusCode >= 400) {
            $decoded = json_decode($rawResponse, true);
            throw new \RuntimeException($this->extractErrorMessage($decoded, 'ElevenLabs audio stream failed.'));
        }
    }

    /**
     * @param list<string> $headers
     */
    private function extractStatusCode(array $headers): int
    {
        foreach ($headers as $header) {
            if (preg_match('#HTTP/\S+\s+(\d{3})#', $header, $matches) === 1) {
                return (int) $matches[1];
            }
        }

        return 0;
    }

    /**
     * @param array<string, mixed>|null $decoded
     */
    private function extractErrorMessage(?array $decoded, string $fallback): string
    {
        $message = $decoded['detail']['message'] ?? $decoded['detail'] ?? $decoded['message'] ?? null;

        return is_string($message) && trim($message) !== '' ? trim($message) : $fallback;
    }

    private function normalizeNullableString(mixed $value): ?string
    {
        if (!is_string($value)) {
            return null;
        }

        $trimmed = trim($value);

        return $trimmed !== '' ? $trimmed : null;
    }

    private function normalizeGender(mixed $value): ?string
    {
        if (!is_string($value)) {
            return null;
        }

        $normalized = strtolower(trim($value));

        return in_array($normalized, ['female', 'male'], true) ? $normalized : null;
    }
}
