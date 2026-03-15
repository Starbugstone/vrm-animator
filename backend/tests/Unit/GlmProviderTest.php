<?php

namespace App\Tests\Unit;

use App\Service\Llm\GlmProvider;
use App\Service\Llm\LlmCompletionRequest;
use PHPUnit\Framework\TestCase;

class GlmProviderTest extends TestCase
{
    public function testItUsesTheInjectedBaseUrl(): void
    {
        $provider = new GlmProvider(glmBaseUrl: 'https://open.bigmodel.cn/api/coding/paas/v4/');

        $method = new \ReflectionMethod($provider, 'getBaseUrl');
        $method->setAccessible(true);

        $this->assertSame('https://open.bigmodel.cn/api/coding/paas/v4', $method->invoke($provider));
    }

    public function testItUsesTheCodingEndpointWhenRequestedPerCredential(): void
    {
        $provider = new GlmProvider();
        $request = new LlmCompletionRequest('glm', 'glm-4.7', [], 1200, ['endpointMode' => 'coding']);

        $method = new \ReflectionMethod($provider, 'resolveBaseUrl');
        $method->setAccessible(true);

        $this->assertSame('https://open.bigmodel.cn/api/coding/paas/v4', $method->invoke($provider, $request));
    }

    public function testItTranslatesResourcePackageErrorsWithEndpointGuidance(): void
    {
        $provider = new GlmProvider();
        $request = new LlmCompletionRequest('glm', 'glm-4.7', []);

        $method = new \ReflectionMethod($provider, 'normalizeProviderErrorMessage');
        $method->setAccessible(true);
        $message = $method->invoke($provider, $request, '余额不足或无可用资源包,请充值。');

        $this->assertStringContainsString('no available balance or resource package', $message);
        $this->assertStringContainsString('https://open.bigmodel.cn/api/paas/v4', $message);
        $this->assertStringContainsString('https://open.bigmodel.cn/api/coding/paas/v4', $message);
    }

    public function testItFallsBackToOutputTextWhenMessageContentIsEmpty(): void
    {
        $provider = new GlmProvider();

        $method = new \ReflectionMethod($provider, 'extractCompletionContent');
        $method->setAccessible(true);

        $content = $method->invoke($provider, [
            'choices' => [[
                'message' => [
                    'content' => '',
                    'reasoning_content' => 'Reasoning only.',
                ],
            ]],
            'output_text' => 'Visible answer from output_text.',
        ]);

        $this->assertSame('Visible answer from output_text.', $content);
    }

    public function testItExposesReasoningContentForDiagnostics(): void
    {
        $provider = new GlmProvider();

        $method = new \ReflectionMethod($provider, 'extractReasoningContent');
        $method->setAccessible(true);

        $reasoning = $method->invoke($provider, [
            'choices' => [[
                'message' => [
                    'reasoning_content' => [
                        ['text' => 'Step one. '],
                        ['text' => 'Step two.'],
                    ],
                ],
            ]],
        ]);

        $this->assertSame('Step one. Step two.', $reasoning);
    }
}
