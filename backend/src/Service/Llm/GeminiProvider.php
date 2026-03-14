<?php

namespace App\Service\Llm;

final class GeminiProvider extends AbstractOpenAiCompatibleProvider
{
    public function getProviderId(): string
    {
        return 'gemini';
    }

    protected function getBaseUrl(): string
    {
        return 'https://generativelanguage.googleapis.com/v1beta/openai';
    }
}
