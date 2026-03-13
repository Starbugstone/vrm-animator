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
                'glm-5',
                'glm-4.7',
                'glm-4.5-air',
            ],
        ],
        'minimax' => [
            'id' => 'minimax',
            'label' => 'MiniMax',
            'requiresApiKey' => true,
            'recommendedModels' => [
                'MiniMax-M2.5',
                'MiniMax-M2.5-highspeed',
                'MiniMax-M2.1',
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

    /**
     * @return array{id:string,label:string,requiresApiKey:bool,recommendedModels:list<string>}|null
     */
    public function findProvider(string $provider): ?array
    {
        $normalized = $this->normalizeProviderId($provider);

        return self::PROVIDERS[$normalized] ?? null;
    }

    public function getLabel(string $provider): string
    {
        $metadata = $this->findProvider($provider);
        if ($metadata !== null) {
            return $metadata['label'];
        }

        return strtoupper($this->normalizeProviderId($provider));
    }

    public function isSupported(string $provider): bool
    {
        return array_key_exists($this->normalizeProviderId($provider), self::PROVIDERS);
    }

    public function assertSupported(string $provider): void
    {
        if (!$this->isSupported($provider)) {
            throw new \InvalidArgumentException('Unsupported LLM provider.');
        }
    }

    private function normalizeProviderId(string $provider): string
    {
        return strtolower(trim($provider));
    }
}
