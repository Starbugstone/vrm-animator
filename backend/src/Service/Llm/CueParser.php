<?php

namespace App\Service\Llm;

class CueParser
{
    public function __construct(
        private EmotionVocabulary $emotionVocabulary,
    ) {
    }

    /**
     * @param list<CueAsset> $assets
     *
     * @return array{
     *   text:string,
     *   emotionTags:list<string>,
     *   animationTags:list<string>,
     *   memoryEntries:list<string>,
     *   timeline:list<array<string, string>>
     * }
     */
    public function parse(string $rawContent, array $assets): array
    {
        $emotionTags = [];
        $animationTags = [];
        $memoryEntries = [];
        $timeline = [];
        $plainText = '';
        $animationLookup = $this->buildAnimationLookup($assets);

        $parts = preg_split('/(\{(?:emotion|anim|memory):[^}]+\})/i', $rawContent, -1, PREG_SPLIT_DELIM_CAPTURE);
        foreach ($parts ?: [$rawContent] as $part) {
            if (!is_string($part) || $part === '') {
                continue;
            }

            if (preg_match('/^\{emotion:([^}]+)\}$/i', $part, $matches) === 1) {
                $normalized = $this->emotionVocabulary->normalize($matches[1] ?? null);
                if ($normalized !== null) {
                    $emotionTags[] = $normalized;
                    $timeline[] = ['type' => 'emotion', 'value' => $normalized];
                }
                continue;
            }

            if (preg_match('/^\{anim:([^}]+)\}$/i', $part, $matches) === 1) {
                $normalized = $this->normalizeAnimationToken((string) ($matches[1] ?? ''));
                if ($normalized !== '' && array_key_exists($normalized, $animationLookup)) {
                    $resolved = $animationLookup[$normalized];
                    $animationTags[] = $resolved;
                    $timeline[] = ['type' => 'animation', 'value' => $resolved];
                }
                continue;
            }

            if (preg_match('/^\{memory:([^}]+)\}$/i', $part, $matches) === 1) {
                $entry = $this->normalizeMemoryEntry((string) ($matches[1] ?? ''));
                if ($entry !== null) {
                    $memoryEntries[] = $entry;
                    $timeline[] = ['type' => 'memory', 'value' => $entry];
                }
                continue;
            }

            $normalizedText = $this->normalizeTextSegment($part);
            if ($normalizedText !== '') {
                $plainText .= $normalizedText;
                $timeline[] = ['type' => 'text', 'value' => $normalizedText];
            }
        }

        $stripped = trim($plainText);

        return [
            'text' => $stripped,
            'emotionTags' => array_values(array_unique($emotionTags)),
            'animationTags' => array_values(array_unique($animationTags)),
            'memoryEntries' => array_values(array_unique($memoryEntries)),
            'timeline' => $timeline,
        ];
    }

    /**
     * @param list<CueAsset> $assets
     *
     * @return array<string, string>
     */
    private function buildAnimationLookup(array $assets): array
    {
        $lookup = [];

        foreach ($assets as $asset) {
            if (!$asset->isMovement()) {
                continue;
            }

            $canonicalName = trim($asset->name);
            $canonicalKey = $this->normalizeAnimationToken($canonicalName);
            if ($canonicalKey !== '' && !array_key_exists($canonicalKey, $lookup)) {
                $lookup[$canonicalKey] = $canonicalName;
            }

            foreach ($asset->keywords as $keyword) {
                $normalizedKeyword = $this->normalizeAnimationToken($keyword);
                if ($normalizedKeyword === '') {
                    continue;
                }

                if (!array_key_exists($normalizedKeyword, $lookup)) {
                    $lookup[$normalizedKeyword] = $canonicalName;
                }
            }
        }

        return $lookup;
    }

    private function normalizeAnimationToken(string $value): string
    {
        $lower = strtolower(trim($value));

        return preg_replace('/[^a-z0-9]+/', '', $lower) ?? '';
    }

    private function normalizeMemoryEntry(string $value): ?string
    {
        $normalized = trim($value);
        $normalized = preg_replace('/\s+/', ' ', $normalized) ?? $normalized;

        if ($normalized === '') {
            return null;
        }

        return substr($normalized, 0, 220);
    }

    private function normalizeTextSegment(string $value): string
    {
        $normalized = preg_replace('/[ \t]{2,}/', ' ', $value) ?? $value;
        $normalized = preg_replace("/\n{3,}/", "\n\n", $normalized) ?? $normalized;

        return $normalized;
    }
}
