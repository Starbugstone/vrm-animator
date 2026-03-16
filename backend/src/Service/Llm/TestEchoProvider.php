<?php

namespace App\Service\Llm;

final class TestEchoProvider implements LlmProviderInterface
{
    public function getProviderId(): string
    {
        return 'test-echo';
    }

    public function complete(LlmCompletionRequest $request, string $secret): LlmCompletionResponse
    {
        return $this->buildEchoResponse($request);
    }

    public function streamComplete(LlmCompletionRequest $request, string $secret, callable $onDelta): LlmCompletionResponse
    {
        $response = $this->buildEchoResponse($request);

        foreach (str_split($response->content, 18) as $chunk) {
            if ($chunk === '') {
                continue;
            }

            $onDelta(new LlmStreamDelta($chunk, $chunk));
        }

        return $response;
    }

    private function buildEchoResponse(LlmCompletionRequest $request): LlmCompletionResponse
    {
        $systemMessage = '';
        $lastUserMessage = '';
        foreach ($request->messages as $message) {
            $role = $message['role'] ?? null;
            $content = $message['content'] ?? null;
            if (!is_string($content)) {
                continue;
            }

            if ($role === 'system' && $systemMessage === '') {
                $systemMessage = trim($content);
            }
        }

        foreach (array_reverse($request->messages) as $message) {
            if (($message['role'] ?? null) === 'user' && is_string($message['content'] ?? null)) {
                $lastUserMessage = trim($message['content']);
                break;
            }
        }

        if (str_contains(strtolower($systemMessage), 'compress the avatar memory')) {
            $text = $this->buildCompressedMemoryResponse($lastUserMessage);

            return new LlmCompletionResponse(
                $text,
                json_encode(['content' => $text], JSON_PRETTY_PRINT) ?: $text,
                'test-echo-memory-compression',
            );
        }

        $memoryTag = '';
        if (preg_match('/remember\s+that\s+(.+)$/i', $lastUserMessage, $matches) === 1) {
          $memoryTag = ' {memory:'.$matches[1].'}';
        }

        $text = sprintf(
            'Echo: %s {emotion:happy} {anim:greeting}%s',
            $lastUserMessage !== '' ? $lastUserMessage : 'Hello',
            $memoryTag,
        );

        return new LlmCompletionResponse(
            $text,
            json_encode(['content' => $text], JSON_PRETTY_PRINT) ?: $text,
            'test-echo-message',
        );
    }

    private function buildCompressedMemoryResponse(string $request): string
    {
        $isStrictRetry = str_contains($request, 'Retry instruction:');
        $memoryMarkdown = $request;
        if (preg_match("/Current memory markdown:\n(.+)$/s", $request, $matches) === 1) {
            $memoryMarkdown = trim((string) ($matches[1] ?? ''));
        }

        if (str_contains($memoryMarkdown, 'force strict retry marker') && !$isStrictRetry) {
            return implode("\n", [
                '# Avatar Memory',
                '',
                '## Relationship Memory',
                '- force strict retry marker',
                '- Stone loves structured notes.',
                '- Stone asked for more compact memory.',
                '- This intentionally verbose draft repeats the same idea in a longer way so the strict retry path has to do a better second pass.',
                '- This intentionally verbose draft repeats the same idea in a longer way so the strict retry path has to do a better second pass.',
                '- This intentionally verbose draft repeats the same idea in a longer way so the strict retry path has to do a better second pass.',
                '- This intentionally verbose draft repeats the same idea in a longer way so the strict retry path has to do a better second pass.',
                '- This intentionally verbose draft repeats the same idea in a longer way so the strict retry path has to do a better second pass.',
                '- This intentionally verbose draft repeats the same idea in a longer way so the strict retry path has to do a better second pass.',
                '- This intentionally verbose draft repeats the same idea in a longer way so the strict retry path has to do a better second pass.',
                '- This intentionally verbose draft repeats the same idea in a longer way so the strict retry path has to do a better second pass.',
                '- This intentionally verbose draft repeats the same idea in a longer way so the strict retry path has to do a better second pass.',
                '- This intentionally verbose draft repeats the same idea in a longer way so the strict retry path has to do a better second pass.',
            ]);
        }

        if (str_contains($memoryMarkdown, 'force strict retry marker') && $isStrictRetry) {
            return implode("\n", [
                '# Avatar Memory',
                '',
                '## Relationship Memory',
                '- Stone loves structured notes.',
                '- Stone asked for more compact memory.',
            ]);
        }

        if (preg_match('/## Relationship Memory\n(.*?)(?=\n## |\z)/s', $memoryMarkdown, $matches) === 1) {
            $memoryMarkdown = trim((string) ($matches[1] ?? ''));
        }

        $lines = preg_split('/\R/', $memoryMarkdown) ?: [];
        $durableBullets = [];
        foreach ($lines as $line) {
            $normalized = trim((string) $line);
            if (!str_starts_with($normalized, '- ')) {
                continue;
            }

            if (preg_match('/^- (important facts about the user|promises made|preferences|recurring topics|add long-term notes here)$/i', $normalized) === 1) {
                continue;
            }

            $durableBullets[] = $normalized;
            if (count($durableBullets) >= 4) {
                break;
            }
        }

        if ($durableBullets === []) {
            $durableBullets[] = '- keep the strongest long-term user facts here';
        }

        return implode("\n", [
            '# Avatar Memory',
            '',
            '## Avatar Identity',
            '- name: compressed by test provider',
            '- backstory: preserved externally',
            '- personality: preserved externally',
            '- speech_voice_gender: preserved externally',
            '- speech_language: preserved externally',
            '',
            '## Relationship Memory',
            ...$durableBullets,
            '',
            '## Long-Term Memory',
            '- condensed long-term memory for test coverage',
            '',
            '## Behavioral Rules',
            '- stay in character',
            '- keep responses grounded in the avatar profile',
            '',
            '## Notes',
            '- condensed for test coverage',
        ]);
    }
}
