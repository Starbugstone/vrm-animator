<?php

namespace App\Service\Tts;

class ElevenLabsClient implements ElevenLabsClientInterface
{
    private const BASE_URL = 'https://api.elevenlabs.io';
    private const DEFAULT_MODEL = 'eleven_flash_v2_5';
    private const VOICE_PAGE_SIZE = 100;
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

        try {
            $voices = $this->listVoicesFromSearchEndpoint($secret);
        } catch (\RuntimeException $exception) {
            if (!$this->shouldFallbackToLegacyCatalog($exception)) {
                throw $exception;
            }

            $voices = $this->listVoicesFromLegacyEndpoint($secret);
        }

        usort($voices, static function (array $left, array $right): int {
            return [
                $left['gender'] ?? '',
                $left['language'] ?? '',
                $left['locale'] ?? '',
                $left['name'],
            ] <=> [
                $right['gender'] ?? '',
                $right['language'] ?? '',
                $right['locale'] ?? '',
                $right['name'],
            ];
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
     * @return list<array<string, mixed>>
     */
    protected function listVoicesFromSearchEndpoint(string $secret): array
    {
        $voices = [];
        $nextPageToken = null;

        do {
            $query = [
                'page_size' => self::VOICE_PAGE_SIZE,
                'include_total_count' => 'true',
            ];

            if ($nextPageToken !== null) {
                $query['next_page_token'] = $nextPageToken;
            }

            $decoded = $this->fetchJson(
                '/v2/voices?'.http_build_query($query, '', '&', PHP_QUERY_RFC3986),
                $secret,
                'Unable to load ElevenLabs voices.',
            );

            foreach (($decoded['voices'] ?? []) as $voice) {
                $normalized = $this->normalizeVoice($voice);
                if ($normalized !== null) {
                    $voices[$normalized['id']] = $normalized;
                }
            }

            $hasMore = filter_var($decoded['has_more'] ?? false, FILTER_VALIDATE_BOOL);
            $nextPageToken = $hasMore ? $this->normalizeNullableString($decoded['next_page_token'] ?? null) : null;
        } while ($nextPageToken !== null);

        return array_values($voices);
    }

    /**
     * @return list<array<string, mixed>>
     */
    protected function listVoicesFromLegacyEndpoint(string $secret): array
    {
        $decoded = $this->fetchJson('/v1/voices', $secret, 'Unable to load ElevenLabs voices.');
        $voices = [];

        foreach (($decoded['voices'] ?? []) as $voice) {
            $normalized = $this->normalizeVoice($voice);
            if ($normalized !== null) {
                $voices[] = $normalized;
            }
        }

        return $voices;
    }

    /**
     * @return array<string, mixed>
     */
    protected function fetchJson(string $path, string $secret, string $fallbackMessage): array
    {
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

        $body = @file_get_contents(self::BASE_URL.$path, false, $context);
        $statusCode = $this->extractStatusCode($http_response_header ?? []);

        if (!is_string($body) || $body === '') {
            throw new \RuntimeException('ElevenLabs voice list returned an empty response.');
        }

        $decoded = json_decode($body, true);
        if (!is_array($decoded)) {
            throw new \RuntimeException('ElevenLabs voice list returned invalid JSON.');
        }

        if ($statusCode >= 400) {
            throw new \RuntimeException($this->extractErrorMessage($decoded, $fallbackMessage), $statusCode);
        }

        return $decoded;
    }

    /**
     * @param mixed $voice
     *
     * @return array<string, mixed>|null
     */
    protected function normalizeVoice(mixed $voice): ?array
    {
        if (!is_array($voice)) {
            return null;
        }

        $id = trim((string) ($voice['voice_id'] ?? ''));
        $name = trim((string) ($voice['name'] ?? ''));
        if ($id === '' || $name === '') {
            return null;
        }

        $labels = $this->normalizeLabels($voice['labels'] ?? null);
        $sharingLabels = $this->normalizeLabels(($voice['sharing']['labels'] ?? null));
        $mergedLabels = array_replace($sharingLabels, $labels);
        $verifiedLanguages = $this->normalizeVerifiedLanguages($voice['verified_languages'] ?? null);
        $language = $this->normalizeNullableString($voice['language'] ?? null)
            ?? $this->normalizeNullableString($mergedLabels['language'] ?? null)
            ?? ($verifiedLanguages[0]['language'] ?? null);
        $locale = $this->normalizeNullableString($voice['locale'] ?? null)
            ?? $this->normalizeNullableString($mergedLabels['locale'] ?? null)
            ?? ($verifiedLanguages[0]['locale'] ?? null);
        $description = $this->normalizeNullableString($voice['description'] ?? null)
            ?? $this->normalizeNullableString($voice['sharing']['description'] ?? null);

        return [
            'id' => $id,
            'name' => $name,
            'gender' => $this->normalizeGender($mergedLabels['gender'] ?? null),
            'labels' => $mergedLabels,
            'category' => $this->normalizeNullableString($voice['category'] ?? null),
            'description' => $description,
            'previewUrl' => $this->normalizeNullableString($voice['preview_url'] ?? null),
            'language' => $language,
            'locale' => $locale,
            'verifiedLanguages' => $verifiedLanguages,
        ];
    }

    /**
     * @param mixed $value
     *
     * @return array<string, string>
     */
    protected function normalizeLabels(mixed $value): array
    {
        if (!is_array($value)) {
            return [];
        }

        $labels = [];
        foreach ($value as $key => $labelValue) {
            if (!is_string($key)) {
                continue;
            }

            $normalized = $this->normalizeNullableString($labelValue);
            if ($normalized !== null) {
                $labels[$key] = $normalized;
            }
        }

        return $labels;
    }

    /**
     * @param mixed $value
     *
     * @return list<array{language:?string,locale:?string,accent:?string,modelId:?string,previewUrl:?string}>
     */
    protected function normalizeVerifiedLanguages(mixed $value): array
    {
        if (!is_array($value)) {
            return [];
        }

        $verifiedLanguages = [];

        foreach ($value as $entry) {
            if (!is_array($entry)) {
                continue;
            }

            $verifiedLanguages[] = [
                'language' => $this->normalizeNullableString($entry['language'] ?? null),
                'locale' => $this->normalizeNullableString($entry['locale'] ?? null),
                'accent' => $this->normalizeNullableString($entry['accent'] ?? null),
                'modelId' => $this->normalizeNullableString($entry['model_id'] ?? null),
                'previewUrl' => $this->normalizeNullableString($entry['preview_url'] ?? null),
            ];
        }

        return $verifiedLanguages;
    }

    protected function shouldFallbackToLegacyCatalog(\RuntimeException $exception): bool
    {
        return in_array($exception->getCode(), [404, 405, 422], true);
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

    protected function normalizeNullableString(mixed $value): ?string
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
