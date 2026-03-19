<?php

namespace App\Service\Llm;

final class EmotionVocabulary
{
    /**
     * @var list<string>
     */
    private const CANONICAL = [
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
        'smile',
        'wink',
    ];

    /**
     * @var array<string, string>
     */
    private const ALIASES = [
        'joyful' => 'happy',
        'positive' => 'happy',
        'friendly' => 'happy',
        'warm' => 'happy',
        'excited' => 'happy',
        'celebrate' => 'happy',
        'bright' => 'happy',
        'laugh' => 'happy',
        'laughing' => 'happy',
        'laughs' => 'happy',
        'giggle' => 'happy',
        'giggling' => 'happy',
        'giggles' => 'happy',
        'chuckle' => 'happy',
        'chuckling' => 'happy',
        'chuckles' => 'happy',
        'melancholy' => 'sad',
        'downcast' => 'sad',
        'sigh' => 'sad',
        'sighing' => 'sad',
        'sighs' => 'sad',
        'frustrated' => 'angry',
        'irritated' => 'angry',
        'cheeky' => 'playful',
        'teasing' => 'playful',
        'flirty' => 'playful',
        'loud' => 'shouting',
        'emphatic' => 'shouting',
        'tired' => 'sleepy',
        'yawn' => 'sleepy',
        'lowenergy' => 'sleepy',
        'startled' => 'surprised',
        'shocked' => 'surprised',
        'pondering' => 'thinking',
        'thoughtful' => 'thinking',
        'confident' => 'calm',
        'soft' => 'calm',
        'whisper' => 'calm',
        'whispering' => 'calm',
        'grin' => 'smile',
        'smiling' => 'smile',
        'smirking' => 'smile',
        'winking' => 'wink',
    ];

    /**
     * @return list<string>
     */
    public function all(): array
    {
        return self::CANONICAL;
    }

    public function normalize(?string $value): ?string
    {
        if (!is_string($value)) {
            return null;
        }

        $normalized = strtolower(trim($value));
        if ($normalized === '') {
            return null;
        }

        $normalized = preg_replace('/[^a-z0-9]+/', '', $normalized) ?? '';
        if ($normalized === '') {
            return null;
        }

        if (in_array($normalized, self::CANONICAL, true)) {
            return $normalized;
        }

        return self::ALIASES[$normalized] ?? null;
    }

    /**
     * @param list<string> $values
     *
     * @return list<string>
     */
    public function normalizeMany(array $values): array
    {
        $normalized = [];

        foreach ($values as $value) {
            $emotion = $this->normalize($value);
            if ($emotion !== null) {
                $normalized[] = $emotion;
            }
        }

        return array_values(array_unique($normalized));
    }
}
