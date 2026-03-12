<?php

namespace App\Service\Llm;

final class OpenRouterProvider extends AbstractOpenAiCompatibleProvider
{
    public function getProviderId(): string
    {
        return 'openrouter';
    }

    protected function getBaseUrl(): string
    {
        return 'https://openrouter.ai/api/v1';
    }
}
