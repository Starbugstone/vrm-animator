<?php

namespace App\Service\Llm;

final class LlmProviderResolver
{
    /**
     * @var array<string, LlmProviderInterface>
     */
    private array $providers = [];

    /**
     * @param iterable<LlmProviderInterface> $providers
     */
    public function __construct(
        iterable $providers,
        private TestEchoProvider $testEchoProvider,
        private bool $llmTestMode = false,
    ) {
        foreach ($providers as $provider) {
            $this->providers[$provider->getProviderId()] = $provider;
        }
    }

    public function resolve(string $provider): LlmProviderInterface
    {
        if ($this->llmTestMode) {
            return $this->testEchoProvider;
        }

        if (!array_key_exists($provider, $this->providers)) {
            throw new \InvalidArgumentException('Unsupported LLM provider.');
        }

        return $this->providers[$provider];
    }
}
