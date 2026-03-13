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
     *   timeline:list<array<string, mixed>>
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
        $expressionAssets = array_values(array_filter($assets, static fn (CueAsset $asset): bool => $asset->isExpression()));

        $parts = preg_split('/(\{(?:emotion|anim|memory):[^}]+\})/i', $rawContent, -1, PREG_SPLIT_DELIM_CAPTURE);
        foreach ($parts ?: [$rawContent] as $part) {
            if (!is_string($part) || $part === '') {
                continue;
            }

            if (preg_match('/^\{emotion:([^}]+)\}$/i', $part, $matches) === 1) {
                $normalized = $this->emotionVocabulary->normalize($matches[1] ?? null);
                if ($normalized !== null) {
                    $emotionTags[] = $normalized;
                    $timeline[] = $this->buildCueTimelineEntry(
                        'emotion',
                        $normalized,
                        $this->resolveExpressionAsset($expressionAssets, $normalized),
                    );
                }
                continue;
            }

            if (preg_match('/^\{anim:([^}]+)\}$/i', $part, $matches) === 1) {
                $normalized = $this->normalizeAnimationToken((string) ($matches[1] ?? ''));
                if ($normalized !== '' && array_key_exists($normalized, $animationLookup)) {
                    $resolved = $animationLookup[$normalized];
                    $animationTags[] = $resolved->label;
                    $timeline[] = $this->buildCueTimelineEntry('animation', $resolved->label, $resolved);
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
     * @return array<string, CueAsset>
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
                $lookup[$canonicalKey] = $asset;
            }

            foreach ($asset->keywords as $keyword) {
                $normalizedKeyword = $this->normalizeAnimationToken($keyword);
                if ($normalizedKeyword === '') {
                    continue;
                }

                if (!array_key_exists($normalizedKeyword, $lookup)) {
                    $lookup[$normalizedKeyword] = $asset;
                }
            }
        }

        return $lookup;
    }

    /**
     * @param list<CueAsset> $assets
     */
    private function resolveExpressionAsset(array $assets, string $emotion): ?CueAsset
    {
        $bestAsset = null;
        $bestScore = 0;

        foreach ($assets as $asset) {
            $score = $this->scoreExpressionAsset($asset, $emotion);
            if ($score > $bestScore) {
                $bestAsset = $asset;
                $bestScore = $score;
            }
        }

        return $bestAsset;
    }

    private function scoreExpressionAsset(CueAsset $asset, string $emotion): int
    {
        $tags = $asset->normalizedTags();
        $score = 0;

        if (in_array($emotion, $tags, true)) {
            $score += 8;
        }

        if (in_array('speech', $tags, true) || in_array('fallback', $tags, true)) {
            $score += 4;
        }

        if (in_array('face', $asset->channels, true) || in_array('eyes', $asset->channels, true) || in_array('mouth', $asset->channels, true)) {
            $score += 2;
        }

        return $score + max(0, $asset->weight);
    }

    /**
     * @return array<string, mixed>
     */
    private function buildCueTimelineEntry(string $type, string $value, ?CueAsset $asset = null): array
    {
        $entry = [
            'type' => $type,
            'value' => $value,
        ];

        if ($asset === null) {
            return $entry;
        }

        $entry['assetId'] = $asset->id;
        $entry['assetLabel'] = $asset->label;
        $entry['assetKind'] = $asset->kind;
        $entry['assetSource'] = $asset->source;

        return $entry;
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
