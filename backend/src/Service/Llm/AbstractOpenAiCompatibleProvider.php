<?php

namespace App\Service\Llm;

use Psr\Log\LoggerInterface;
use Symfony\Component\DependencyInjection\Attribute\Autowire;

abstract class AbstractOpenAiCompatibleProvider implements LlmProviderInterface
{
    public function __construct(
        #[Autowire(service: 'monolog.logger.llm')]
        private readonly ?LoggerInterface $llmLogger = null,
    ) {
    }

    abstract protected function getBaseUrl(): string;

    protected function resolveBaseUrl(LlmCompletionRequest $request): string
    {
        return rtrim($this->getBaseUrl(), '/');
    }

    /**
     * @return array<string, string>
     */
    protected function getAdditionalHeaders(): array
    {
        return [];
    }

    /**
     * @return array<string, mixed>
     */
    protected function getAdditionalPayload(LlmCompletionRequest $request, bool $stream): array
    {
        return [];
    }

    public function complete(LlmCompletionRequest $request, string $secret): LlmCompletionResponse
    {
        $response = $this->requestJson($request, $secret, false);

        $content = $this->extractCompletionContent($response);
        if (trim($content) === '') {
            $this->logEmptyCompletion($request, $response, false);
            throw new \RuntimeException('LLM provider returned an empty completion.');
        }

        $providerMessageId = $response['id'] ?? null;

        return new LlmCompletionResponse(
            trim($content),
            json_encode($response, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) ?: trim($content),
            is_string($providerMessageId) ? $providerMessageId : null,
        );
    }

    /**
     * @param callable(LlmStreamDelta):void $onDelta
     */
    public function streamComplete(LlmCompletionRequest $request, string $secret, callable $onDelta): LlmCompletionResponse
    {
        if (!function_exists('curl_init')) {
            throw new \RuntimeException('The cURL extension is required for upstream streaming.');
        }

        $url = $this->resolveBaseUrl($request).'/chat/completions';
        $payload = [
            'model' => $request->model,
            'messages' => $request->messages,
            'stream' => true,
            'max_tokens' => max(128, $request->maxOutputTokens),
            ...$this->getAdditionalPayload($request, true),
        ];
        $headers = $this->buildHeaders($secret, true);

        $ch = curl_init($url);
        if ($ch === false) {
            throw new \RuntimeException('Unable to initialize the LLM provider stream.');
        }

        $statusCode = 0;
        $buffer = '';
        $rawResponse = '';
        $content = '';
        $providerMessageId = null;

        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_SLASHES),
            CURLOPT_CONNECTTIMEOUT => 15,
            CURLOPT_TIMEOUT => 0,
            CURLOPT_LOW_SPEED_LIMIT => 1,
            CURLOPT_LOW_SPEED_TIME => 40,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_NOSIGNAL => true,
            CURLOPT_RETURNTRANSFER => false,
            CURLOPT_HEADER => false,
            CURLOPT_WRITEFUNCTION => function ($curl, string $chunk) use (&$buffer, &$rawResponse, &$content, &$providerMessageId, &$statusCode, $onDelta): int {
                $rawResponse .= $chunk;
                $buffer .= $chunk;
                $statusCode = curl_getinfo($curl, CURLINFO_RESPONSE_CODE) ?: $statusCode;

                while (($parsedBlock = $this->extractNextSseBlock($buffer)) !== null) {
                    $block = $parsedBlock['block'];
                    $buffer = $parsedBlock['remaining'];
                    $parsed = $this->parseSseBlock($block);

                    if ($parsed === null) {
                        continue;
                    }

                    if (($parsed['id'] ?? null) !== null && $providerMessageId === null) {
                        $providerMessageId = (string) $parsed['id'];
                    }

                    $delta = $this->extractStreamContentDelta($parsed);
                    if ($delta !== '') {
                        $normalizedDelta = $this->normalizeStreamDelta($content, $delta);
                        if ($normalizedDelta !== '') {
                            $content .= $normalizedDelta;
                            $onDelta(new LlmStreamDelta($normalizedDelta, json_encode($parsed, JSON_UNESCAPED_SLASHES) ?: $normalizedDelta));
                        }
                    }
                }

                return strlen($chunk);
            },
        ]);

        $executed = curl_exec($ch);
        $curlErrno = curl_errno($ch);
        $curlError = curl_error($ch);
        $statusCode = curl_getinfo($ch, CURLINFO_RESPONSE_CODE) ?: $statusCode;
        curl_close($ch);

        if ($executed === false && $curlError !== '') {
            throw new \RuntimeException($this->normalizeCurlStreamError($curlErrno, $curlError, $rawResponse, $content));
        }

        if ($buffer !== '') {
            $parsed = $this->parseSseBlock($buffer);
            if ($parsed !== null) {
                if (($parsed['id'] ?? null) !== null && $providerMessageId === null) {
                    $providerMessageId = (string) $parsed['id'];
                }

                $delta = $this->extractStreamContentDelta($parsed);
                if ($delta !== '') {
                    $normalizedDelta = $this->normalizeStreamDelta($content, $delta);
                    if ($normalizedDelta !== '') {
                        $content .= $normalizedDelta;
                        $onDelta(new LlmStreamDelta($normalizedDelta, json_encode($parsed, JSON_UNESCAPED_SLASHES) ?: $normalizedDelta));
                    }
                }
            }
        }

        if ($statusCode >= 400) {
            $decoded = json_decode($rawResponse, true);
            $message = is_array($decoded)
                ? ($decoded['error']['message'] ?? $decoded['message'] ?? 'LLM provider request failed.')
                : 'LLM provider request failed.';

            throw new \RuntimeException($this->normalizeProviderErrorMessage(
                $request,
                is_string($message) && trim($message) !== '' ? $message : 'LLM provider request failed.',
            ));
        }

        if (trim($content) === '') {
            $decoded = json_decode($rawResponse, true);
            if (is_array($decoded)) {
                $this->logEmptyCompletion($request, $decoded, true, $rawResponse);
            } else {
                $this->logRawStreamFailure($request, $rawResponse);
            }

            throw new \RuntimeException('LLM provider returned an empty streamed completion.');
        }

        return new LlmCompletionResponse(
            trim($content),
            $rawResponse !== '' ? $rawResponse : $content,
            $providerMessageId,
        );
    }

    /**
     * @return array<string, mixed>
     */
    private function requestJson(LlmCompletionRequest $request, string $secret, bool $stream): array
    {
        $url = $this->resolveBaseUrl($request).'/chat/completions';
        $headers = $this->buildHeaders($secret, false);
        $payload = [
            'model' => $request->model,
            'messages' => $request->messages,
            'stream' => $stream,
            'max_tokens' => max(128, $request->maxOutputTokens),
            ...$this->getAdditionalPayload($request, $stream),
        ];

        $headerLines = [];
        foreach ($headers as $value) {
            $headerLines[] = $value;
        }

        $context = stream_context_create([
            'http' => [
                'method' => 'POST',
                'header' => implode("\r\n", $headerLines),
                'content' => json_encode($payload, JSON_UNESCAPED_SLASHES),
                'timeout' => 30,
                'ignore_errors' => true,
            ],
        ]);

        $body = @file_get_contents($url, false, $context);
        $statusCode = $this->extractStatusCode($http_response_header ?? []);

        if (!is_string($body) || $body === '') {
            throw new \RuntimeException('LLM provider request failed with an empty response.');
        }

        $decoded = json_decode($body, true);
        if (!is_array($decoded)) {
            throw new \RuntimeException('LLM provider returned invalid JSON.');
        }

        if ($statusCode >= 400) {
            $message = $decoded['error']['message'] ?? $decoded['message'] ?? 'LLM provider request failed.';
            if (!is_string($message) || trim($message) === '') {
                $message = 'LLM provider request failed.';
            }

            throw new \RuntimeException($this->normalizeProviderErrorMessage($request, $message));
        }

        return $decoded;
    }

    /**
     * @return list<string>
     */
    private function buildHeaders(string $secret, bool $stream): array
    {
        $headers = [
            'Authorization' => 'Bearer '.$secret,
            'Content-Type' => 'application/json',
            'Accept' => $stream ? 'text/event-stream' : 'application/json',
            ...$this->getAdditionalHeaders(),
        ];

        return array_map(
            static fn (string $name, string $value): string => sprintf('%s: %s', $name, $value),
            array_keys($headers),
            array_values($headers),
        );
    }

    /**
     * @return array{block:string,remaining:string}|null
     */
    private function extractNextSseBlock(string $buffer): ?array
    {
        if (preg_match("/\r?\n\r?\n/", $buffer, $matches, PREG_OFFSET_CAPTURE) !== 1) {
            return null;
        }

        $separator = $matches[0][0];
        $offset = $matches[0][1];

        return [
            'block' => substr($buffer, 0, $offset),
            'remaining' => substr($buffer, $offset + strlen($separator)),
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    private function parseSseBlock(string $block): ?array
    {
        $lines = preg_split("/\r?\n/", trim($block));
        if (!is_array($lines) || $lines === []) {
            return null;
        }

        $dataLines = [];
        foreach ($lines as $line) {
            if (!is_string($line) || $line === '') {
                continue;
            }

            if (str_starts_with($line, 'data:')) {
                $dataLines[] = trim(substr($line, 5));
            }
        }

        if ($dataLines === []) {
            return null;
        }

        $payload = implode("\n", $dataLines);
        if ($payload === '[DONE]') {
            return null;
        }

        $decoded = json_decode($payload, true);

        return is_array($decoded) ? $decoded : null;
    }

    /**
     * @param array<string, mixed> $payload
     */
    private function extractStreamContentDelta(array $payload): string
    {
        $delta = $payload['choices'][0]['delta']['content'] ?? null;
        $text = $this->extractVisibleText($delta);
        if ($text !== '') {
            return $text;
        }

        $messageContent = $this->extractVisibleText($payload['choices'][0]['message']['content'] ?? null);
        if ($messageContent !== '') {
            return $messageContent;
        }

        $outputText = $this->extractVisibleText($payload['output_text'] ?? null);
        if ($outputText !== '') {
            return $outputText;
        }

        $choiceText = $this->extractVisibleText($payload['choices'][0]['text'] ?? null);
        if ($choiceText !== '') {
            return $choiceText;
        }

        return '';
    }

    /**
     * @param array<string, mixed> $payload
     */
    protected function extractCompletionContent(array $payload): string
    {
        $messageContent = $this->extractVisibleText($payload['choices'][0]['message']['content'] ?? null);
        if ($messageContent !== '') {
            return $messageContent;
        }

        $outputText = $this->extractVisibleText($payload['output_text'] ?? null);
        if ($outputText !== '') {
            return $outputText;
        }

        $choiceText = $this->extractVisibleText($payload['choices'][0]['text'] ?? null);
        if ($choiceText !== '') {
            return $choiceText;
        }

        return '';
    }

    /**
     * @param array<string, mixed> $payload
     */
    protected function extractReasoningContent(array $payload): string
    {
        $messageReasoning = $this->extractVisibleText($payload['choices'][0]['message']['reasoning_content'] ?? null);
        if ($messageReasoning !== '') {
            return $messageReasoning;
        }

        $deltaReasoning = $this->extractVisibleText($payload['choices'][0]['delta']['reasoning_content'] ?? null);
        if ($deltaReasoning !== '') {
            return $deltaReasoning;
        }

        $topLevelReasoning = $this->extractVisibleText($payload['reasoning_content'] ?? null);
        if ($topLevelReasoning !== '') {
            return $topLevelReasoning;
        }

        return '';
    }

    private function extractVisibleText(mixed $value): string
    {
        if (is_string($value)) {
            return $value;
        }

        if (!is_array($value)) {
            return '';
        }

        $parts = [];
        foreach ($value as $entry) {
            if (is_string($entry)) {
                $parts[] = $entry;
                continue;
            }

            if (!is_array($entry)) {
                continue;
            }

            if (is_string($entry['text'] ?? null)) {
                $parts[] = $entry['text'];
                continue;
            }

            if (($entry['type'] ?? null) === 'text' && is_string($entry['content'] ?? null)) {
                $parts[] = $entry['content'];
            }
        }

        return implode('', $parts);
    }

    private function normalizeCurlStreamError(int $errno, string $curlError, string $rawResponse, string $content): string
    {
        if ($errno === 28) {
            if (trim($content) !== '') {
                return 'LLM provider stream stalled before completion. A partial reply arrived, but the provider never finished the turn.';
            }

            if (trim($rawResponse) !== '') {
                return 'LLM provider stream timed out before yielding usable assistant text.';
            }

            return 'LLM provider stream timed out before sending a reply.';
        }

        return $curlError !== '' ? $curlError : 'LLM provider stream failed.';
    }

    private function normalizeStreamDelta(string $currentContent, string $nextValue): string
    {
        if ($nextValue === '') {
            return '';
        }

        if ($currentContent !== '' && str_starts_with($nextValue, $currentContent)) {
            return substr($nextValue, strlen($currentContent)) ?: '';
        }

        return $nextValue;
    }

    protected function normalizeProviderErrorMessage(LlmCompletionRequest $request, string $message): string
    {
        $normalized = trim($message);

        return $normalized !== '' ? $normalized : 'LLM provider request failed.';
    }

    /**
     * @param list<string> $responseHeaders
     */
    private function extractStatusCode(array $responseHeaders): int
    {
        foreach ($responseHeaders as $header) {
            if (!is_string($header) || !preg_match('/^HTTP\/\S+\s+(\d{3})/', $header, $matches)) {
                continue;
            }

            return (int) $matches[1];
        }

        return 0;
    }

    /**
     * @param array<string, mixed> $payload
     */
    private function logEmptyCompletion(LlmCompletionRequest $request, array $payload, bool $stream, ?string $rawResponse = null): void
    {
        if ($this->llmLogger === null) {
            return;
        }

        $choice = is_array($payload['choices'][0] ?? null) ? $payload['choices'][0] : [];
        $message = is_array($choice['message'] ?? null) ? $choice['message'] : [];
        $delta = is_array($choice['delta'] ?? null) ? $choice['delta'] : [];
        $reasoning = $this->extractReasoningContent($payload);

        $this->llmLogger->warning('LLM provider returned no visible assistant content.', [
            'provider' => $request->provider,
            'model' => $request->model,
            'stream' => $stream,
            'endpoint' => $this->resolveBaseUrl($request).'/chat/completions',
            'finish_reason' => is_string($choice['finish_reason'] ?? null) ? $choice['finish_reason'] : null,
            'top_level_keys' => array_keys($payload),
            'message_keys' => array_keys($message),
            'delta_keys' => array_keys($delta),
            'message_content_type' => $this->describeValueType($message['content'] ?? null),
            'message_reasoning_type' => $this->describeValueType($message['reasoning_content'] ?? null),
            'output_text_type' => $this->describeValueType($payload['output_text'] ?? null),
            'reasoning_excerpt' => $this->truncateForLog($reasoning, 600),
            'response_excerpt' => $this->truncateForLog(
                json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?: '',
                4000,
            ),
            'raw_response_excerpt' => $this->truncateForLog($rawResponse ?? '', 4000),
        ]);
    }

    private function logRawStreamFailure(LlmCompletionRequest $request, string $rawResponse): void
    {
        if ($this->llmLogger === null) {
            return;
        }

        $this->llmLogger->warning('LLM provider stream ended without a parseable completion payload.', [
            'provider' => $request->provider,
            'model' => $request->model,
            'endpoint' => $this->resolveBaseUrl($request).'/chat/completions',
            'raw_response_excerpt' => $this->truncateForLog($rawResponse, 4000),
        ]);
    }

    private function describeValueType(mixed $value): string
    {
        return match (true) {
            $value === null => 'null',
            is_string($value) => 'string',
            is_array($value) && array_is_list($value) => 'list',
            is_array($value) => 'map',
            is_bool($value) => 'bool',
            is_int($value), is_float($value) => 'number',
            default => get_debug_type($value),
        };
    }

    private function truncateForLog(string $value, int $limit): string
    {
        $normalized = trim($value);
        if ($normalized === '') {
            return '';
        }

        if (mb_strlen($normalized) <= $limit) {
            return $normalized;
        }

        return rtrim(mb_substr($normalized, 0, max(1, $limit - 1))).'…';
    }
}
