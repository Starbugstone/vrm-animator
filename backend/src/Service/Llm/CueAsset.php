<?php

namespace App\Service\Llm;

final readonly class CueAsset
{
    /**
     * @param list<string> $keywords
     * @param list<string> $emotionTags
     */
    public function __construct(
        public string $id,
        public string $name,
        public string $label,
        public string $kind,
        public string $description,
        public array $keywords,
        public array $emotionTags,
        public string $source,
    ) {
    }

    public function isMovement(): bool
    {
        return $this->kind !== 'expression';
    }

    public function isExpression(): bool
    {
        return $this->kind === 'expression';
    }
}
