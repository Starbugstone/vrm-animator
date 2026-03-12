<?php

namespace App\Service\Llm;

final class GlmProvider extends AbstractOpenAiCompatibleProvider
{
    public function getProviderId(): string
    {
        return 'glm';
    }

    protected function getBaseUrl(): string
    {
        return 'https://open.bigmodel.cn/api/paas/v4';
    }
}
