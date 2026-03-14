<?php

namespace App\Service\Llm;

final readonly class CueAsset
{
    /**
     * @param list<string> $keywords
     * @param list<string> $emotionTags
     * @param list<string> $tags
     * @param list<string> $channels
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
        public array $tags = [],
        public array $channels = [],
        public int $weight = 0,
    ) {
    }

    public function isMovement(): bool
    {
        return $this->kind !== 'expression';
    }

    public function isThinking(): bool
    {
        return $this->kind === 'thinking';
    }

    public function isConversationMovement(): bool
    {
        return $this->isMovement() && !$this->isThinking();
    }

    public function isExpression(): bool
    {
        return $this->kind === 'expression';
    }

    /**
     * @return list<string>
     */
    public function normalizedTags(): array
    {
        $tags = array_merge($this->emotionTags, $this->keywords, $this->tags);
        $normalized = array_map(
            static fn (mixed $value): string => strtolower(trim((string) $value)),
            $tags,
        );

        return array_values(array_unique(array_filter($normalized)));
    }
}
