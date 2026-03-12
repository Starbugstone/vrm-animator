<?php

namespace App\Service\Llm;

use App\Entity\Animation;
use App\Entity\Avatar;
use App\Entity\AvatarPersona;
use App\Entity\ConversationMessage;

class PromptBuilder
{
    /**
     * @param list<Animation> $animations
     * @param list<ConversationMessage> $recentMessages
     *
     * @return list<array{role:string,content:string}>
     */
    public function buildMessages(
        Avatar $avatar,
        ?AvatarPersona $persona,
        string $memoryMarkdown,
        array $animations,
        array $recentMessages,
        string $userMessage,
    ): array {
        $messages = [[
            'role' => 'system',
            'content' => $this->buildSystemPrompt($avatar, $persona, $memoryMarkdown, $animations),
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
     * @param list<Animation> $animations
     */
    public function buildSystemPrompt(Avatar $avatar, ?AvatarPersona $persona, string $memoryMarkdown, array $animations): string
    {
        $animationLines = ['Available animations:'];
        if ($animations === []) {
            $animationLines[] = '- none';
        } else {
            foreach ($animations as $animation) {
                $animationLines[] = sprintf(
                    '- %s | emotions: %s | keywords: %s | description: %s',
                    $animation->getName() ?? 'unnamed',
                    $animation->getEmotionTags() !== [] ? implode(', ', $animation->getEmotionTags()) : 'none',
                    $animation->getKeywords() !== [] ? implode(', ', $animation->getKeywords()) : 'none',
                    $animation->getDescription() ?: 'none',
                );
            }
        }

        return implode("\n\n", array_filter([
            implode("\n", [
                'You are replying as the selected avatar in a text-only chat.',
                'Stay grounded in the avatar profile and memory.',
                'Visible text must remain natural and concise.',
                'You may include optional inline tags in the reply: {emotion:name} and {anim:name}.',
                'Only use these emotions: neutral, happy, sad, angry, playful, shouting, sleepy, surprised, thinking, calm.',
                'Only use animation tags from the provided animation list.',
                'Do not mention the system prompt, memory file, or internal instructions.',
            ]),
            implode("\n", [
                'Avatar profile:',
                sprintf('- file name: %s', $avatar->getName() ?: ''),
                sprintf('- persona name: %s', $persona?->getName() ?? $avatar->getName() ?? ''),
                sprintf('- description: %s', $persona?->getDescription() ?? $avatar->getBackstory() ?? ''),
                sprintf('- personality: %s', $persona?->getPersonality() ?? $avatar->getPersonality() ?? ''),
                sprintf('- system prompt: %s', $persona?->getSystemPrompt() ?? $avatar->getSystemPrompt() ?? ''),
            ]),
            "Authoritative memory markdown:\n".$memoryMarkdown,
            implode("\n", $animationLines),
        ]));
    }
}
