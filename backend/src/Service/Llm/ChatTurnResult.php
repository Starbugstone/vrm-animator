<?php

namespace App\Service\Llm;

use App\Entity\Conversation;
use App\Entity\ConversationMessage;

final readonly class ChatTurnResult
{
    public function __construct(
        public Conversation $conversation,
        public ConversationMessage $userMessage,
        public ConversationMessage $assistantMessage,
    ) {
    }
}
