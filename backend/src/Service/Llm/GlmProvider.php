<?php

namespace App\Service\Llm;

use Psr\Log\LoggerInterface;
use Symfony\Component\DependencyInjection\Attribute\Autowire;

final class GlmProvider extends AbstractOpenAiCompatibleProvider
{
    private const STANDARD_BASE_URL = 'https://open.bigmodel.cn/api/paas/v4';
    private const CODING_BASE_URL = 'https://open.bigmodel.cn/api/coding/paas/v4';

    public function __construct(
        #[Autowire(service: 'monolog.logger.llm')]
        ?LoggerInterface $llmLogger = null,
        private readonly string $glmBaseUrl = 'https://open.bigmodel.cn/api/paas/v4',
    ) {
        parent::__construct($llmLogger);
    }

    public function getProviderId(): string
    {
        return 'glm';
    }

    protected function getBaseUrl(): string
    {
        return rtrim($this->glmBaseUrl, '/');
    }

    protected function resolveBaseUrl(LlmCompletionRequest $request): string
    {
        $endpointMode = strtolower(trim((string) ($request->providerOptions['endpointMode'] ?? '')));

        return match ($endpointMode) {
            'coding' => self::CODING_BASE_URL,
            'standard' => self::STANDARD_BASE_URL,
            default => parent::resolveBaseUrl($request),
        };
    }

    protected function normalizeProviderErrorMessage(LlmCompletionRequest $request, string $message): string
    {
        $normalized = parent::normalizeProviderErrorMessage($request, $message);
        $resolvedBaseUrl = $this->resolveBaseUrl($request);

        if (str_contains($normalized, '余额不足或无可用资源包')) {
            return sprintf(
                'GLM rejected the request because the account has no available balance or resource package for this endpoint. This app is currently using %s. BigModel documents that the standard API uses https://open.bigmodel.cn/api/paas/v4, while Coding Plan keys use https://open.bigmodel.cn/api/coding/paas/v4 and are limited to designated coding tools. If the same key works in another project, check whether that project is using the Coding Plan endpoint or a different GLM billing setup.',
                $resolvedBaseUrl,
            );
        }

        return $normalized;
    }
}
