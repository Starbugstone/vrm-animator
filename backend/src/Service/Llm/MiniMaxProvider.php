<?php

namespace App\Service\Llm;

final class MiniMaxProvider extends AbstractOpenAiCompatibleProvider
{
    public function getProviderId(): string
    {
        return 'minimax';
    }

    protected function getBaseUrl(): string
    {
        return 'https://api.minimax.io/v1';
    }
}
