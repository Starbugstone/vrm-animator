<?php

namespace App\Service\Llm;

final readonly class LlmStreamDelta
{
    public function __construct(
        public string $content,
        public ?string $rawChunk = null,
    ) {
    }
}
