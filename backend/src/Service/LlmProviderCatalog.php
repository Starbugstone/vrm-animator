<?php

namespace App\Service;

class LlmProviderCatalog
{
    /**
     * @var array<string, array{id:string,label:string,requiresApiKey:bool,recommendedModels:list<string>}>
     */
    private const PROVIDERS = [
        'glm' => [
            'id' => 'glm',
            'label' => 'GLM',
            'requiresApiKey' => true,
            'recommendedModels' => [
                'glm-4.5',
                'glm-4.5-air',
            ],
        ],
        'minimax' => [
            'id' => 'minimax',
            'label' => 'MiniMax',
            'requiresApiKey' => true,
            'recommendedModels' => [
                'MiniMax-M1',
                'MiniMax-Text-01',
            ],
        ],
        'openrouter' => [
            'id' => 'openrouter',
            'label' => 'OpenRouter',
            'requiresApiKey' => true,
            'recommendedModels' => [
                'openai/gpt-4.1-mini',
                'anthropic/claude-3.7-sonnet',
            ],
        ],
    ];

    /**
     * @return list<array{id:string,label:string,requiresApiKey:bool,recommendedModels:list<string>}>
     */
    public function listProviders(): array
    {
        $providers = array_values(self::PROVIDERS);
        usort(
            $providers,
            static fn (array $left, array $right): int => $left['label'] <=> $right['label'],
        );

        return $providers;
    }

    public function isSupported(string $provider): bool
    {
        return array_key_exists($provider, self::PROVIDERS);
    }

    public function assertSupported(string $provider): void
    {
        if (!$this->isSupported($provider)) {
            throw new \InvalidArgumentException('Unsupported LLM provider.');
        }
    }
}
