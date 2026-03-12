<?php

namespace App\Service\Llm;

use App\Entity\Animation;

class CueParser
{
    /**
     * @var list<string>
     */
    private const ALLOWED_EMOTIONS = [
        'neutral',
        'happy',
        'sad',
        'angry',
        'playful',
        'shouting',
        'sleepy',
        'surprised',
        'thinking',
        'calm',
    ];

    /**
     * @param list<Animation> $animations
     *
     * @return array{text:string,emotionTags:list<string>,animationTags:list<string>}
     */
    public function parse(string $rawContent, array $animations): array
    {
        preg_match_all('/\{emotion:([^}]+)\}/i', $rawContent, $emotionMatches);
        preg_match_all('/\{anim:([^}]+)\}/i', $rawContent, $animationMatches);

        $emotionTags = [];
        foreach ($emotionMatches[1] ?? [] as $emotion) {
            $normalized = strtolower(trim((string) $emotion));
            if (in_array($normalized, self::ALLOWED_EMOTIONS, true)) {
                $emotionTags[] = $normalized;
            }
        }

        $animationLookup = $this->buildAnimationLookup($animations);
        $animationTags = [];
        foreach ($animationMatches[1] ?? [] as $animation) {
            $normalized = $this->normalizeAnimationToken((string) $animation);
            if ($normalized !== '' && array_key_exists($normalized, $animationLookup)) {
                $animationTags[] = $animationLookup[$normalized];
            }
        }

        $stripped = preg_replace('/\{(?:emotion|anim):[^}]+\}/i', '', $rawContent) ?? $rawContent;
        $stripped = preg_replace('/[ \t]{2,}/', ' ', $stripped) ?? $stripped;
        $stripped = preg_replace("/\n{3,}/", "\n\n", $stripped) ?? $stripped;

        return [
            'text' => trim($stripped),
            'emotionTags' => array_values(array_unique($emotionTags)),
            'animationTags' => array_values(array_unique($animationTags)),
        ];
    }

    /**
     * @param list<Animation> $animations
     *
     * @return array<string, string>
     */
    private function buildAnimationLookup(array $animations): array
    {
        $lookup = [];

        foreach ($animations as $animation) {
            $name = $animation->getName();
            if (!is_string($name) || trim($name) === '') {
                continue;
            }

            $canonicalName = trim($name);
            $lookup[$this->normalizeAnimationToken($canonicalName)] = $canonicalName;

            foreach ($animation->getKeywords() as $keyword) {
                $normalizedKeyword = $this->normalizeAnimationToken($keyword);
                if ($normalizedKeyword === '') {
                    continue;
                }

                $lookup[$normalizedKeyword] = $canonicalName;
            }
        }

        return $lookup;
    }

    private function normalizeAnimationToken(string $value): string
    {
        $lower = strtolower(trim($value));

        return preg_replace('/[^a-z0-9]+/', '', $lower) ?? '';
    }
}
