<?php

namespace App\Service\Llm;

final class ChatModelPolicyResolver
{
    public function __construct(
        private OpenRouterModelCatalog $openRouterModelCatalog,
        private StaticProviderModelCatalog $staticProviderModelCatalog,
    ) {
    }

    public function resolve(string $provider, string $model): ChatModelPolicy
    {
        $metadata = $provider === 'openrouter'
            ? $this->openRouterModelCatalog->findModel($model)
            : $this->staticProviderModelCatalog->findModel($provider, $model);

        $contextLength = max(32768, (int) ($metadata['contextLength'] ?? 131072));
        $group = strtolower(trim((string) ($metadata['group'] ?? '')));
        $isFast = $group === 'fast'
            || str_contains(strtolower($model), 'flash')
            || str_contains(strtolower($model), 'highspeed');

        if ($contextLength <= 65536) {
            $policy = new ChatModelPolicy($contextLength, 800, 4, 4, 900, 220, 450);
        } elseif ($contextLength <= 131072) {
            $policy = new ChatModelPolicy($contextLength, 1100, 5, 5, 1400, 260, 650);
        } elseif ($contextLength <= 220000) {
            $policy = new ChatModelPolicy($contextLength, 1400, 6, 6, 1800, 300, 800);
        } else {
            $policy = new ChatModelPolicy($contextLength, 1800, 8, 8, 2400, 340, 950);
        }

        if (!$isFast) {
            return $policy;
        }

        return new ChatModelPolicy(
            $policy->contextLength,
            max(700, (int) floor($policy->maxOutputTokens * 0.75)),
            max(4, $policy->maxRecentMessages - 1),
            max(4, $policy->maxPromptMovementAssets - 1),
            max(900, (int) floor($policy->maxMemoryCharacters * 0.75)),
            max(200, (int) floor($policy->maxProfileFieldCharacters * 0.85)),
            max(450, (int) floor($policy->maxHistoryMessageCharacters * 0.8)),
        );
    }
}
