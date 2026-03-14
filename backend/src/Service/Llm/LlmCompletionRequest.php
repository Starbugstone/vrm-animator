<?php

namespace App\Service\Llm;

final readonly class LlmCompletionRequest
{
    /**
     * @param list<array{role:string,content:string}> $messages
     */
    public function __construct(
        public string $provider,
        public string $model,
        public array $messages,
        public int $maxOutputTokens = 1200,
        public array $providerOptions = [],
    ) {
    }
}
