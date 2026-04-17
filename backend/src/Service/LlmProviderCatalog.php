<?php

namespace App\Service;

class LlmProviderCatalog
{
    /**
     * @var array<string, array{id:string,label:string,requiresApiKey:bool,recommendedModels:list<string>}>
     */
    private const PROVIDERS = [
        'deepseek' => [
            'id' => 'deepseek',
            'label' => 'DeepSeek',
            'requiresApiKey' => true,
            'recommendedModels' => [
                'deepseek-chat',
                'deepseek-reasoner',
            ],
        ],
        'glm' => [
            'id' => 'glm',
            'label' => 'GLM',
            'requiresApiKey' => true,
            'recommendedModels' => [
                'glm-5.1',
                'glm-5',
                'glm-4.7',
                'glm-4.5-air',
            ],
        ],
        'gemini' => [
            'id' => 'gemini',
            'label' => 'Gemini',
            'requiresApiKey' => true,
            'recommendedModels' => [
                'gemini-2.5-pro',
                'gemini-2.5-flash',
                'gemini-2.5-flash-lite',
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
        'openai' => [
            'id' => 'openai',
            'label' => 'OpenAI',
            'requiresApiKey' => true,
            'recommendedModels' => [
                'gpt-5.2',
                'gpt-5-mini',
                'gpt-5-nano',
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
