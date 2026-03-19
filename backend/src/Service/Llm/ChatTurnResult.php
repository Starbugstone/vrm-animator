<?php

namespace App\Service\Llm;

use App\Entity\Conversation;
use App\Entity\ConversationMessage;

final readonly class ChatTurnResult
{
    /**
     * @param list<array<string, mixed>> $assistantTimeline
     * @param list<array{scope:string,value:string}> $assistantMemoryEntries
     * @param list<array{role:string,content:string}> $llmRequestMessages
     */
    public function __construct(
        public Conversation $conversation,
        public ConversationMessage $userMessage,
        public ConversationMessage $assistantMessage,
        public array $assistantTimeline = [],
        public array $assistantMemoryEntries = [],
        public string $assistantSpeechText = '',
        public array $llmRequestMessages = [],
        public string $assistantRawCompletion = '',
    ) {
    }
}
