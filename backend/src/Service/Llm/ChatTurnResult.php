<?php

namespace App\Service\Llm;

use App\Entity\Conversation;
use App\Entity\ConversationMessage;

final readonly class ChatTurnResult
{
    /**
     * @param list<array<string, string>> $assistantTimeline
     * @param list<string> $assistantMemoryEntries
     */
    public function __construct(
        public Conversation $conversation,
        public ConversationMessage $userMessage,
        public ConversationMessage $assistantMessage,
        public array $assistantTimeline = [],
        public array $assistantMemoryEntries = [],
    ) {
    }
}
