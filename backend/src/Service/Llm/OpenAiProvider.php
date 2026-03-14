<?php

namespace App\Service\Llm;

final class OpenAiProvider extends AbstractOpenAiCompatibleProvider
{
    public function getProviderId(): string
    {
        return 'openai';
    }

    protected function getBaseUrl(): string
    {
        return 'https://api.openai.com/v1';
    }
}
