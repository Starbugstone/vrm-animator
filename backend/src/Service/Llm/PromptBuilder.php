<?php

namespace App\Service\Llm;

use App\Entity\Avatar;
use App\Entity\AvatarPersona;
use App\Entity\ConversationMessage;

class PromptBuilder
{
    public function __construct(
        private PromptRulesProvider $promptRulesProvider,
    ) {
    }

    /**
     * @param list<CueAsset> $assets
     * @param list<ConversationMessage> $recentMessages
     *
     * @return list<array{role:string,content:string}>
     */
    public function buildMessages(
        Avatar $avatar,
        ?AvatarPersona $persona,
        string $memoryMarkdown,
        array $assets,
        array $recentMessages,
        string $userMessage,
        ChatModelPolicy $modelPolicy,
    ): array {
        $messages = [[
            'role' => 'system',
            'content' => $this->buildSystemPrompt($avatar, $persona, $memoryMarkdown, $assets, $modelPolicy),
        ]];

        foreach ($recentMessages as $recentMessage) {
            $messages[] = [
                'role' => $recentMessage->getRole(),
                'content' => $this->compactHistoryMessage($recentMessage, $modelPolicy),
            ];
        }

        $messages[] = [
            'role' => 'user',
            'content' => trim($userMessage),
        ];

        return $messages;
    }

    /**
     * @param list<CueAsset> $assets
     */
    public function buildSystemPrompt(
        Avatar $avatar,
        ?AvatarPersona $persona,
        string $memoryMarkdown,
        array $assets,
        ChatModelPolicy $modelPolicy,
    ): string
    {
        $movementAssets = array_values(array_filter($assets, static fn (CueAsset $asset): bool => $asset->isConversationMovement()));
        usort($movementAssets, static function (CueAsset $left, CueAsset $right): int {
            $sourcePriority = $left->source === $right->source ? 0 : ($left->source === 'user' ? -1 : 1);
            if ($sourcePriority !== 0) {
                return $sourcePriority;
            }

            if ($left->weight !== $right->weight) {
                return $right->weight <=> $left->weight;
            }

            return [$left->kind, $left->label] <=> [$right->kind, $right->label];
        });
        $movementAssets = array_slice($movementAssets, 0, $modelPolicy->maxPromptMovementAssets);
        $expressionEmotions = [];
        foreach ($assets as $asset) {
            $expressionEmotions = array_merge($expressionEmotions, $asset->emotionTags);
        }

        $emotionLines = ['Available emotion tags:'];
        $availableEmotions = array_values(array_unique(array_filter($expressionEmotions)));
        sort($availableEmotions);
        if ($availableEmotions === []) {
            $emotionLines[] = '- neutral, happy, sad, angry, playful, shouting, sleepy, surprised, thinking, calm, smile, wink';
        } else {
            $emotionLines[] = '- '.implode(', ', $availableEmotions);
        }

        $movementLines = ['Available movement tags:'];
        if ($movementAssets === []) {
            $movementLines[] = '- none';
        } else {
            foreach ($movementAssets as $asset) {
                $tagLine = array_values(array_unique(array_filter(array_merge($asset->keywords, $asset->emotionTags, $asset->tags))));
                $movementLines[] = sprintf(
                    '- %s | kind: %s | tags: %s',
                    $asset->name,
                    $asset->kind,
                    $tagLine !== [] ? implode(', ', array_slice($tagLine, 0, 8)) : 'none',
                );
            }
        }

        return implode("\n\n", array_filter([
            $this->promptRulesProvider->getChatRules(),
            implode("\n", [
                'Avatar profile:',
                sprintf('- file name: %s', $this->compactText($avatar->getName() ?: '', 120)),
                sprintf('- persona name: %s', $this->compactText($persona?->getName() ?? $avatar->getName() ?? '', 120)),
                sprintf('- description: %s', $this->compactText($persona?->getDescription() ?? $avatar->getBackstory() ?? '', $modelPolicy->maxProfileFieldCharacters)),
                sprintf('- personality: %s', $this->compactText($persona?->getPersonality() ?? $avatar->getPersonality() ?? '', $modelPolicy->maxProfileFieldCharacters)),
                sprintf('- system prompt: %s', $this->compactText($persona?->getSystemPrompt() ?? $avatar->getSystemPrompt() ?? '', $modelPolicy->maxProfileFieldCharacters)),
            ]),
            "Authoritative memory markdown:\n".$this->compactMemoryMarkdown($memoryMarkdown, $modelPolicy),
            implode("\n", $emotionLines),
            implode("\n", $movementLines),
        ]));
    }

    private function compactHistoryMessage(ConversationMessage $message, ChatModelPolicy $modelPolicy): string
    {
        $base = $message->getParsedText()
            ?? $message->getContent()
            ?? '';

        $base = $this->compactText($base, $modelPolicy->maxHistoryMessageCharacters);

        $tags = [];
        if ($message->getParsedEmotionTags() !== []) {
            $tags[] = 'emotion='.implode(',', array_slice($message->getParsedEmotionTags(), 0, 3));
        }
        if ($message->getParsedAnimationTags() !== []) {
            $tags[] = 'animation='.implode(',', array_slice($message->getParsedAnimationTags(), 0, 2));
        }

        if ($tags === []) {
            return $base;
        }

        return trim($base."\n[".implode(' | ', $tags).']');
    }

    private function compactMemoryMarkdown(string $memoryMarkdown, ChatModelPolicy $modelPolicy): string
    {
        $lines = preg_split('/\R/', $memoryMarkdown) ?: [];
        $kept = [];

        foreach ($lines as $line) {
            $normalized = trim((string) $line);
            if ($normalized === '') {
                continue;
            }

            if (preg_match('/^- (important facts about the user|promises made|preferences|recurring topics|add long-term notes here)$/i', $normalized) === 1) {
                continue;
            }

            $kept[] = $this->compactText($normalized, 180);
        }

        $memory = implode("\n", $kept);

        return $this->compactText($memory, $modelPolicy->maxMemoryCharacters);
    }

    private function compactText(string $text, int $maxLength): string
    {
        $normalized = trim(preg_replace('/\s+/', ' ', $text) ?? $text);
        if ($normalized === '') {
            return '';
        }

        if (mb_strlen($normalized) <= $maxLength) {
            return $normalized;
        }

        return rtrim(mb_substr($normalized, 0, max(1, $maxLength - 1))).'…';
    }
}
