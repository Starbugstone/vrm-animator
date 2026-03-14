<?php

namespace App\Service\Llm;

final readonly class ChatModelPolicy
{
    public function __construct(
        public int $contextLength,
        public int $maxOutputTokens,
        public int $maxRecentMessages,
        public int $maxPromptMovementAssets,
        public int $maxMemoryCharacters,
        public int $maxProfileFieldCharacters,
        public int $maxHistoryMessageCharacters,
    ) {
    }
}
