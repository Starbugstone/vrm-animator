<?php

namespace App\Service\Llm;

final class DeepSeekProvider extends AbstractOpenAiCompatibleProvider
{
    public function getProviderId(): string
    {
        return 'deepseek';
    }

    protected function getBaseUrl(): string
    {
        return 'https://api.deepseek.com/v1';
    }
}
