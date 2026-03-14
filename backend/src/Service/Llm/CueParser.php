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
     *   memoryEntries:list<array{scope:string,value:string}>,
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

        $parts = preg_split('/(\{(?:emotion|anim|memory):[^}]+\}|\[[^\]]*(?:emotion|anim|memory|delay)\s*:[^\]]+\])/i', $rawContent, -1, PREG_SPLIT_DELIM_CAPTURE);
        foreach ($parts ?: [$rawContent] as $part) {
            if (!is_string($part) || $part === '') {
                continue;
            }

            $parsedTokens = $this->parseCueTokenBundle($part, $animationLookup, $expressionAssets);
            if ($parsedTokens !== null) {
                foreach ($parsedTokens as $entry) {
                    if (($entry['type'] ?? '') === 'emotion') {
                        $emotionTags[] = (string) ($entry['value'] ?? '');
                    }

                    if (($entry['type'] ?? '') === 'animation') {
                        $animationTags[] = (string) ($entry['value'] ?? '');
                    }

                    if (($entry['type'] ?? '') === 'memory') {
                        $memoryKey = sprintf(
                            '%s|%s',
                            (string) ($entry['scope'] ?? 'relationship'),
                            (string) ($entry['value'] ?? ''),
                        );
                        $memoryEntries[$memoryKey] = [
                            'scope' => (string) ($entry['scope'] ?? 'relationship'),
                            'value' => (string) ($entry['value'] ?? ''),
                        ];
                    }

                    $timeline[] = $entry;
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
            'memoryEntries' => array_values($memoryEntries),
            'timeline' => $timeline,
        ];
    }

    /**
     * @param list<CueAsset> $assets
     * @return array{timeline:list<array<string, mixed>>,cursor:int}
     */
    public function parseStreamDelta(string $rawContent, array $assets, int $cursor): array
    {
        $timeline = [];
        $animationLookup = $this->buildAnimationLookup($assets);
        $expressionAssets = array_values(array_filter($assets, static fn (CueAsset $asset): bool => $asset->isExpression()));
        $length = strlen($rawContent);
        $offset = max(0, min($cursor, $length));

        while ($offset < $length) {
            $tagStart = $this->findNextCueStart($rawContent, $offset);
            if ($tagStart === false) {
                $text = $this->normalizeTextSegment(substr($rawContent, $offset));
                if ($text !== '') {
                    $timeline[] = ['type' => 'text', 'value' => $text];
                }
                $offset = $length;
                break;
            }

            if ($tagStart > $offset) {
                $text = $this->normalizeTextSegment(substr($rawContent, $offset, $tagStart - $offset));
                if ($text !== '') {
                    $timeline[] = ['type' => 'text', 'value' => $text];
                }
            }

            $tagEnd = strpos($rawContent, $rawContent[$tagStart] === '[' ? ']' : '}', $tagStart);
            if ($tagEnd === false) {
                $offset = $tagStart;
                break;
            }

            $token = substr($rawContent, $tagStart, $tagEnd - $tagStart + 1);
            $parsedTokens = $this->parseCueTokenBundle($token, $animationLookup, $expressionAssets);

            if ($parsedTokens === null) {
                $text = $this->normalizeTextSegment($token);
                if ($text !== '') {
                    $timeline[] = ['type' => 'text', 'value' => $text];
                }
            } else {
                foreach ($parsedTokens as $entry) {
                    $timeline[] = $entry;
                }
            }

            $offset = $tagEnd + 1;
        }

        return [
            'timeline' => $timeline,
            'cursor' => $offset,
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
    private function buildCueTimelineEntry(string $type, string $value, ?CueAsset $asset = null, array $extra = []): array
    {
        $entry = [
            'type' => $type,
            'value' => $value,
        ];

        foreach ($extra as $key => $extraValue) {
            $entry[$key] = $extraValue;
        }

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

    private function normalizeDelayMs(string $value): ?int
    {
        $normalized = strtolower(trim($value));
        if ($normalized === '') {
            return null;
        }

        if (preg_match('/^(\d+(?:\.\d+)?)\s*ms$/', $normalized, $matches) === 1) {
            $delayMs = (int) round((float) ($matches[1] ?? 0));

            return max(0, min(12000, $delayMs));
        }

        if (preg_match('/^(\d+(?:\.\d+)?)\s*s?$/', $normalized, $matches) === 1) {
            $delayMs = (int) round(((float) ($matches[1] ?? 0)) * 1000);

            return max(0, min(12000, $delayMs));
        }

        return null;
    }

    /**
     * @return array{scope:string,value:string}|null
     */
    private function normalizeMemoryEntry(string $value): ?array
    {
        $normalized = trim($value);
        $normalized = preg_replace('/\s+/', ' ', $normalized) ?? $normalized;

        if ($normalized === '') {
            return null;
        }

        $scope = 'relationship';
        if (preg_match('/^(relationship|long(?:-| )?term)\s*[:|]\s*(.+)$/i', $normalized, $matches) === 1) {
            $scope = strtolower((string) ($matches[1] ?? 'relationship'));
            $scope = str_starts_with($scope, 'long') ? 'long-term' : 'relationship';
            $normalized = trim((string) ($matches[2] ?? ''));
        }

        if ($normalized === '') {
            return null;
        }

        return [
            'scope' => $scope,
            'value' => substr($normalized, 0, 220),
        ];
    }

    private function normalizeTextSegment(string $value): string
    {
        $normalized = preg_replace('/[ \t]{2,}/', ' ', $value) ?? $value;
        $normalized = preg_replace("/\n{3,}/", "\n\n", $normalized) ?? $normalized;

        return $normalized;
    }

    /**
     * @param array<string, CueAsset> $animationLookup
     * @param list<CueAsset> $expressionAssets
     * @return list<array<string, mixed>>|null
     */
    private function parseCueTokenBundle(string $token, array $animationLookup, array $expressionAssets): ?array
    {
        $trimmed = trim($token);
        $isBraceToken = str_starts_with($trimmed, '{') && str_ends_with($trimmed, '}');
        $isBracketToken = str_starts_with($trimmed, '[') && str_ends_with($trimmed, ']');

        if (!$isBraceToken && !$isBracketToken) {
            return null;
        }

        $inner = trim(substr($trimmed, 1, -1));
        if ($inner === '') {
            return null;
        }

        $segments = $isBracketToken
            ? (preg_split('/\s*(?:\||;)\s*/', $inner) ?: [])
            : [$inner];
        $timeline = [];
        $matchedCue = false;
        $bundleDelayMs = null;
        $rawSegments = [];

        foreach ($segments as $segment) {
            $segment = trim((string) $segment);
            if ($segment === '') {
                continue;
            }

            if (preg_match('/^(emotion|anim|memory|delay)\s*:\s*(.+)$/i', $segment, $matches) !== 1) {
                if ($isBracketToken) {
                    return null;
                }

                continue;
            }

            $matchedCue = true;
            $type = strtolower((string) ($matches[1] ?? ''));
            $value = trim((string) ($matches[2] ?? ''));

            $rawSegments[] = [
                'type' => $type,
                'value' => $value,
            ];
        }

        if (!$matchedCue) {
            return null;
        }

        foreach ($rawSegments as $segment) {
            if (($segment['type'] ?? '') !== 'delay') {
                continue;
            }

            $bundleDelayMs = $this->normalizeDelayMs((string) ($segment['value'] ?? ''));
        }

        foreach ($rawSegments as $segment) {
            $type = (string) ($segment['type'] ?? '');
            $value = (string) ($segment['value'] ?? '');

            if ($type === 'delay') {
                continue;
            }

            if ($type === 'emotion') {
                $normalizedEmotion = $this->emotionVocabulary->normalize($value);
                if ($normalizedEmotion !== null) {
                    $timeline[] = $this->buildCueTimelineEntry(
                        'emotion',
                        $normalizedEmotion,
                        $this->resolveExpressionAsset($expressionAssets, $normalizedEmotion),
                    );
                }

                continue;
            }

            if ($type === 'anim') {
                $normalizedAnimation = $this->normalizeAnimationToken($value);
                if ($normalizedAnimation !== '' && array_key_exists($normalizedAnimation, $animationLookup)) {
                    $resolved = $animationLookup[$normalizedAnimation];
                    $extra = [];
                    if ($bundleDelayMs !== null) {
                        $extra['delayMs'] = $bundleDelayMs;
                    }

                    $timeline[] = $this->buildCueTimelineEntry('animation', $resolved->label, $resolved, $extra);
                }

                continue;
            }

            $entry = $this->normalizeMemoryEntry($value);
            if ($entry !== null) {
                $timeline[] = [
                    'type' => 'memory',
                    'scope' => $entry['scope'],
                    'value' => $entry['value'],
                ];
            }
        }

        return $timeline;
    }

    private function findNextCueStart(string $rawContent, int $offset): int|false
    {
        $braceStart = strpos($rawContent, '{', $offset);
        $bracketStart = strpos($rawContent, '[', $offset);

        if ($braceStart === false) {
            return $bracketStart;
        }

        if ($bracketStart === false) {
            return $braceStart;
        }

        return min($braceStart, $bracketStart);
    }
}
