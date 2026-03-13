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

    /**
     * MiniMax can expose thinking content inline unless it is split into a dedicated reasoning field.
     *
     * @return array<string, mixed>
     */
    protected function getAdditionalPayload(LlmCompletionRequest $request, bool $stream): array
    {
        return [
            'reasoning_split' => true,
        ];
    }

    protected function normalizeProviderErrorMessage(LlmCompletionRequest $request, string $message): string
    {
        $normalized = parent::normalizeProviderErrorMessage($request, $message);

        if (
            str_contains($normalized, '令牌已过期或验证不正确')
            || str_contains(strtolower($normalized), 'token is expired or invalid')
        ) {
            return 'MiniMax rejected the API key: the token is expired or invalid. Check that this AI connection uses a real MiniMax API key, and if you switched this credential from another provider, save it again with a fresh MiniMax key.';
        }

        return $normalized;
    }
}
