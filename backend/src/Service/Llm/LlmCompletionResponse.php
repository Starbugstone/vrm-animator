<?php

namespace App\Service\Llm;

final readonly class LlmCompletionResponse
{
    public function __construct(
        public string $content,
        public string $rawResponse,
        public ?string $providerMessageId = null,
    ) {
    }
}
