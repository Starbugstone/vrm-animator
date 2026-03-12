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
        $lastUserMessage = '';
        foreach (array_reverse($request->messages) as $message) {
            if (($message['role'] ?? null) !== 'user') {
                continue;
            }

            $content = $message['content'] ?? null;
            if (is_string($content)) {
                $lastUserMessage = trim($content);
                break;
            }
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
}
