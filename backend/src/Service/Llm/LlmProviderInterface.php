<?php

namespace App\Service\Llm;

interface LlmProviderInterface
{
    public function getProviderId(): string;

    public function complete(LlmCompletionRequest $request, string $secret): LlmCompletionResponse;

    /**
     * @param callable(LlmStreamDelta):void $onDelta
     */
    public function streamComplete(LlmCompletionRequest $request, string $secret, callable $onDelta): LlmCompletionResponse;
}
