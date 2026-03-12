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
    ): array {
        $messages = [[
            'role' => 'system',
            'content' => $this->buildSystemPrompt($avatar, $persona, $memoryMarkdown, $assets),
        ]];

        foreach ($recentMessages as $recentMessage) {
            $messages[] = [
                'role' => $recentMessage->getRole(),
                'content' => $recentMessage->getRawProviderContent() ?? $recentMessage->getContent(),
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
    public function buildSystemPrompt(Avatar $avatar, ?AvatarPersona $persona, string $memoryMarkdown, array $assets): string
    {
        $movementAssets = array_values(array_filter($assets, static fn (CueAsset $asset): bool => $asset->isMovement()));
        $expressionEmotions = [];
        foreach ($assets as $asset) {
            $expressionEmotions = array_merge($expressionEmotions, $asset->emotionTags);
        }

        $emotionLines = ['Available emotion tags:'];
        $availableEmotions = array_values(array_unique(array_filter($expressionEmotions)));
        sort($availableEmotions);
        if ($availableEmotions === []) {
            $emotionLines[] = '- neutral, happy, sad, angry, playful, shouting, sleepy, surprised, thinking, calm';
        } else {
            $emotionLines[] = '- '.implode(', ', $availableEmotions);
        }

        $movementLines = ['Available movement tags:'];
        if ($movementAssets === []) {
            $movementLines[] = '- none';
        } else {
            foreach ($movementAssets as $asset) {
                $movementLines[] = sprintf(
                    '- %s | kind: %s | emotions: %s | keywords: %s | description: %s',
                    $asset->name,
                    $asset->kind,
                    $asset->emotionTags !== [] ? implode(', ', $asset->emotionTags) : 'none',
                    $asset->keywords !== [] ? implode(', ', $asset->keywords) : 'none',
                    $asset->description !== '' ? $asset->description : 'none',
                );
            }
        }

        return implode("\n\n", array_filter([
            $this->promptRulesProvider->getChatRules(),
            implode("\n", [
                'Avatar profile:',
                sprintf('- file name: %s', $avatar->getName() ?: ''),
                sprintf('- persona name: %s', $persona?->getName() ?? $avatar->getName() ?? ''),
                sprintf('- description: %s', $persona?->getDescription() ?? $avatar->getBackstory() ?? ''),
                sprintf('- personality: %s', $persona?->getPersonality() ?? $avatar->getPersonality() ?? ''),
                sprintf('- system prompt: %s', $persona?->getSystemPrompt() ?? $avatar->getSystemPrompt() ?? ''),
            ]),
            "Authoritative memory markdown:\n".$memoryMarkdown,
            implode("\n", $emotionLines),
            implode("\n", $movementLines),
        ]));
    }
}
