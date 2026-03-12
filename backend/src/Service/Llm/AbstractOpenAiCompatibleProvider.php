<?php

namespace App\Service\Llm;

abstract class AbstractOpenAiCompatibleProvider implements LlmProviderInterface
{
    abstract protected function getBaseUrl(): string;

    /**
     * @return array<string, string>
     */
    protected function getAdditionalHeaders(): array
    {
        return [];
    }

    public function complete(LlmCompletionRequest $request, string $secret): LlmCompletionResponse
    {
        $response = $this->requestJson(
            rtrim($this->getBaseUrl(), '/').'/chat/completions',
            [
                'Authorization' => 'Bearer '.$secret,
                'Content-Type' => 'application/json',
                'Accept' => 'application/json',
                ...$this->getAdditionalHeaders(),
            ],
            [
                'model' => $request->model,
                'messages' => $request->messages,
                'stream' => false,
            ],
        );

        $content = $response['choices'][0]['message']['content'] ?? null;
        if (!is_string($content) || trim($content) === '') {
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
     * @param array<string, string> $headers
     * @param array<string, mixed> $payload
     *
     * @return array<string, mixed>
     */
    private function requestJson(string $url, array $headers, array $payload): array
    {
        $headerLines = [];
        foreach ($headers as $name => $value) {
            $headerLines[] = sprintf('%s: %s', $name, $value);
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

            throw new \RuntimeException($message);
        }

        return $decoded;
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
}
