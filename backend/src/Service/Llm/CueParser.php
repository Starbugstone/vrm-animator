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
     *   speechText:string,
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
        $speechText = '';
        $animationLookup = $this->buildAnimationLookup($assets);
        $expressionAssets = array_values(array_filter($assets, static fn (CueAsset $asset): bool => $asset->isExpression()));

        $length = strlen($rawContent);
        $offset = 0;

        while ($offset < $length) {
            $tagStart = $this->findNextCueStart($rawContent, $offset);
            if ($tagStart === false) {
                $normalizedText = $this->normalizeTextSegment(substr($rawContent, $offset));
                if ($normalizedText !== '') {
                    $plainText .= $normalizedText;
                    $speechText .= $normalizedText;
                    $timeline[] = ['type' => 'text', 'value' => $normalizedText];
                }
                break;
            }

            if ($tagStart > $offset) {
                $normalizedText = $this->normalizeTextSegment(substr($rawContent, $offset, $tagStart - $offset));
                if ($normalizedText !== '') {
                    $plainText .= $normalizedText;
                    $speechText .= $normalizedText;
                    $timeline[] = ['type' => 'text', 'value' => $normalizedText];
                }
            }

            $tokenMeta = $this->extractCueLikeToken($rawContent, $tagStart);
            if ($tokenMeta === null) {
                $normalizedText = $this->normalizeTextSegment(substr($rawContent, $tagStart, 1));
                if ($normalizedText !== '') {
                    $plainText .= $normalizedText;
                    $speechText .= $normalizedText;
                    $timeline[] = ['type' => 'text', 'value' => $normalizedText];
                }
                $offset = $tagStart + 1;
                continue;
            }

            if (!$tokenMeta['complete']) {
                $normalizedText = $this->normalizeTextSegment(substr($rawContent, $tagStart));
                if ($normalizedText !== '') {
                    $plainText .= $normalizedText;
                    $speechText .= $normalizedText;
                    $timeline[] = ['type' => 'text', 'value' => $normalizedText];
                }
                break;
            }

            $token = $tokenMeta['token'];
            $parsedTokens = $this->parseCueTokenBundle($token, $animationLookup, $expressionAssets);
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

                $offset = $tokenMeta['end'] + 1;
                continue;
            }

            $parsedPerformance = $this->parsePerformanceToken($token, $animationLookup, $expressionAssets);
            if ($parsedPerformance !== null) {
                foreach ($parsedPerformance['timeline'] as $entry) {
                    if (($entry['type'] ?? '') === 'emotion') {
                        $emotionTags[] = (string) ($entry['value'] ?? '');
                    }

                    if (($entry['type'] ?? '') === 'animation') {
                        $animationTags[] = (string) ($entry['value'] ?? '');
                    }

                    $timeline[] = $entry;
                }

                if ($parsedPerformance['speechText'] !== null) {
                    $speechText .= $parsedPerformance['speechText'];
                }

                $offset = $tokenMeta['end'] + 1;
                continue;
            }

            $normalizedText = $this->normalizeTextSegment($token);
            if ($normalizedText !== '') {
                $plainText .= $normalizedText;
                $speechText .= $normalizedText;
                $timeline[] = ['type' => 'text', 'value' => $normalizedText];
            }

            $offset = $tokenMeta['end'] + 1;
        }

        $stripped = trim($plainText);
        $strippedSpeech = trim($this->normalizeTextSegment($speechText));

        return [
            'text' => $stripped,
            'speechText' => $strippedSpeech,
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

            $tokenMeta = $this->extractCueLikeToken($rawContent, $tagStart);
            if ($tokenMeta === null) {
                $text = $this->normalizeTextSegment(substr($rawContent, $tagStart, 1));
                if ($text !== '') {
                    $timeline[] = ['type' => 'text', 'value' => $text];
                }
                $offset = $tagStart + 1;
                continue;
            }

            if (!$tokenMeta['complete']) {
                $offset = $tagStart;
                break;
            }

            $token = $tokenMeta['token'];
            $parsedTokens = $this->parseCueTokenBundle($token, $animationLookup, $expressionAssets);

            if ($parsedTokens === null) {
                $parsedPerformance = $this->parsePerformanceToken($token, $animationLookup, $expressionAssets);
                if ($parsedPerformance === null) {
                    $text = $this->normalizeTextSegment($token);
                    if ($text !== '') {
                        $timeline[] = ['type' => 'text', 'value' => $text];
                    }
                } else {
                    foreach ($parsedPerformance['timeline'] as $entry) {
                        $timeline[] = $entry;
                    }
                }
            } else {
                foreach ($parsedTokens as $entry) {
                    $timeline[] = $entry;
                }
            }

            $offset = $tokenMeta['end'] + 1;
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

    /**
     * @param array<string, CueAsset> $animationLookup
     * @param list<CueAsset> $expressionAssets
     * @return array{timeline:list<array<string, mixed>>,speechText:?string}|null
     */
    private function parsePerformanceToken(string $token, array $animationLookup, array $expressionAssets): ?array
    {
        $trimmed = trim($token);
        if ($trimmed === '') {
            return null;
        }

        $isBracketToken = str_starts_with($trimmed, '[') && str_ends_with($trimmed, ']');
        $isAsteriskToken = str_starts_with($trimmed, '**') && str_ends_with($trimmed, '**')
            || str_starts_with($trimmed, '*') && str_ends_with($trimmed, '*');

        if (!$isBracketToken && !$isAsteriskToken) {
            return null;
        }

        $inner = trim($isAsteriskToken && str_starts_with($trimmed, '**')
            ? substr($trimmed, 2, -2)
            : substr($trimmed, 1, -1));

        if ($inner === '') {
            return null;
        }

        if ($isBracketToken && preg_match('/^(emotion|anim|memory|delay)\s*:/i', $inner) === 1) {
            return null;
        }

        if (!$this->looksLikeStageDirection($inner)) {
            return null;
        }

        $timeline = [];
        $resolvedAnimation = $this->resolveStageDirectionAnimation($inner, $animationLookup);
        $resolvedEmotion = $this->resolveStageDirectionEmotion($inner);

        if ($resolvedEmotion !== null) {
            $timeline[] = $this->buildCueTimelineEntry(
                'emotion',
                $resolvedEmotion,
                $this->resolveExpressionAsset($expressionAssets, $resolvedEmotion),
            );
        }

        if ($resolvedAnimation !== null) {
            $timeline[] = $this->buildCueTimelineEntry('animation', $resolvedAnimation->label, $resolvedAnimation);
        }

        return [
            'timeline' => $timeline,
            'speechText' => $isBracketToken ? '['.$this->normalizeSpeechActionLabel($inner).']' : null,
        ];
    }

    private function looksLikeStageDirection(string $value): bool
    {
        $normalized = $this->normalizeStageDirectionText($value);
        if ($normalized === '') {
            return false;
        }

        if (preg_match('/[.!?]{2,}|\n/u', $value) === 1) {
            return false;
        }

        $wordCount = preg_match_all('/[a-z0-9]+/i', $normalized);
        if (!is_int($wordCount) || $wordCount < 1 || $wordCount > 6) {
            return false;
        }

        if ($this->resolveStageDirectionEmotion($value) !== null) {
            return true;
        }

        return preg_match(
            '/\b(smile|grin|laugh|giggl|chuckl|snicker|wink|nod|wave|shrug|sigh|gasp|whisper|shout|yell|pause|blush|cry|sob|groan|yawn|ponder|think|stare|glance|look|bow|clap|point|smirk)\w*\b/i',
            $normalized,
        ) === 1;
    }

    private function resolveStageDirectionEmotion(string $value): ?string
    {
        $normalized = $this->normalizeStageDirectionText($value);
        if ($normalized === '') {
            return null;
        }

        $candidates = array_values(array_unique(array_filter(array_merge(
            [$normalized],
            preg_split('/\s+/', $normalized) ?: [],
        ))));

        foreach ($candidates as $candidate) {
            $emotion = $this->emotionVocabulary->normalize($candidate);
            if ($emotion !== null) {
                return $emotion;
            }
        }

        if (preg_match('/\b(laugh|giggl|chuckl|snicker)\w*\b/i', $normalized) === 1) {
            return 'happy';
        }

        if (preg_match('/\b(whisper|murmur)\w*\b/i', $normalized) === 1) {
            return 'calm';
        }

        if (preg_match('/\b(sigh|cry|sob)\w*\b/i', $normalized) === 1) {
            return 'sad';
        }

        return null;
    }

    /**
     * @param array<string, CueAsset> $animationLookup
     */
    private function resolveStageDirectionAnimation(string $value, array $animationLookup): ?CueAsset
    {
        $normalized = $this->normalizeStageDirectionText($value);
        if ($normalized === '') {
            return null;
        }

        foreach ($this->buildStageDirectionCandidates($normalized) as $candidate) {
            $key = $this->normalizeAnimationToken($candidate);
            if ($key === '') {
                continue;
            }

            if (array_key_exists($key, $animationLookup)) {
                return $animationLookup[$key];
            }

            foreach ($this->buildTokenVariants($key) as $variant) {
                if (array_key_exists($variant, $animationLookup)) {
                    return $animationLookup[$variant];
                }
            }
        }

        return null;
    }

    private function normalizeStageDirectionText(string $value): string
    {
        $normalized = strtolower(trim($value));
        $normalized = preg_replace('/[^a-z0-9\s\'-]+/i', ' ', $normalized) ?? $normalized;
        $normalized = preg_replace('/\s+/', ' ', $normalized) ?? $normalized;

        return trim($normalized);
    }

    /**
     * @return list<string>
     */
    private function buildStageDirectionCandidates(string $value): array
    {
        $candidates = [$value];
        $words = preg_split('/\s+/', $value) ?: [];
        $filteredWords = array_values(array_filter(
            $words,
            static fn (string $word): bool => !in_array($word, [
                'a',
                'an',
                'the',
                'and',
                'then',
                'softly',
                'gently',
                'quietly',
                'lightly',
                'slightly',
                'warmly',
                'briefly',
                'suddenly',
                'lets',
                'let',
                'out',
                'gives',
                'give',
                'with',
                'their',
                'his',
                'her',
            ], true),
        ));

        if ($filteredWords !== []) {
            $candidates[] = implode(' ', $filteredWords);
            $candidates[] = $filteredWords[0];
        }

        return array_values(array_unique(array_filter($candidates)));
    }

    /**
     * @return list<string>
     */
    private function buildTokenVariants(string $value): array
    {
        $variants = [$value];
        $length = strlen($value);

        if ($length > 4 && str_ends_with($value, 'ing')) {
            $variants[] = substr($value, 0, -3);
        }

        if ($length > 3 && str_ends_with($value, 'ed')) {
            $variants[] = substr($value, 0, -2);
        }

        if ($length > 3 && str_ends_with($value, 'es')) {
            $variants[] = substr($value, 0, -2);
        }

        if ($length > 2 && str_ends_with($value, 's')) {
            $variants[] = substr($value, 0, -1);
        }

        return array_values(array_unique(array_filter($variants)));
    }

    private function normalizeSpeechActionLabel(string $value): string
    {
        return preg_replace('/\s+/', ' ', trim($value)) ?? trim($value);
    }

    /**
     * @return array{token:string,end:int,complete:bool}|null
     */
    private function extractCueLikeToken(string $rawContent, int $start): ?array
    {
        $leading = $rawContent[$start] ?? null;
        if ($leading === null) {
            return null;
        }

        if ($leading === '{') {
            $end = strpos($rawContent, '}', $start);

            return [
                'token' => $end === false ? substr($rawContent, $start) : substr($rawContent, $start, $end - $start + 1),
                'end' => $end === false ? strlen($rawContent) - 1 : $end,
                'complete' => $end !== false,
            ];
        }

        if ($leading === '[') {
            $end = strpos($rawContent, ']', $start);

            return [
                'token' => $end === false ? substr($rawContent, $start) : substr($rawContent, $start, $end - $start + 1),
                'end' => $end === false ? strlen($rawContent) - 1 : $end,
                'complete' => $end !== false,
            ];
        }

        if ($leading !== '*') {
            return null;
        }

        $delimiter = ($rawContent[$start + 1] ?? null) === '*' ? '**' : '*';
        $searchOffset = $start + strlen($delimiter);
        $end = strpos($rawContent, $delimiter, $searchOffset);

        return [
            'token' => $end === false ? substr($rawContent, $start) : substr($rawContent, $start, $end - $start + strlen($delimiter)),
            'end' => $end === false ? strlen($rawContent) - 1 : $end + strlen($delimiter) - 1,
            'complete' => $end !== false,
        ];
    }

    private function findNextCueStart(string $rawContent, int $offset): int|false
    {
        $braceStart = strpos($rawContent, '{', $offset);
        $bracketStart = strpos($rawContent, '[', $offset);
        $asteriskStart = strpos($rawContent, '*', $offset);

        $starts = array_values(array_filter(
            [$braceStart, $bracketStart, $asteriskStart],
            static fn (int|false $value): bool => $value !== false,
        ));

        if ($starts === []) {
            return false;
        }

        return min($starts);
    }
}
