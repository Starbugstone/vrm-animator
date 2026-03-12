<?php

namespace App\Service\Llm;

interface LlmProviderInterface
{
    public function getProviderId(): string;

    public function complete(LlmCompletionRequest $request, string $secret): LlmCompletionResponse;
}
