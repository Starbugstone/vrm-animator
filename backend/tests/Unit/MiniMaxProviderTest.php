<?php

namespace App\Tests\Unit;

use App\Service\Llm\LlmCompletionRequest;
use App\Service\Llm\MiniMaxProvider;
use PHPUnit\Framework\TestCase;

class MiniMaxProviderTest extends TestCase
{
    public function testItTranslatesKnownInvalidTokenErrors(): void
    {
        $provider = new MiniMaxProvider();
        $request = new LlmCompletionRequest('minimax', 'MiniMax-M2.5', []);

        $method = new \ReflectionMethod($provider, 'normalizeProviderErrorMessage');
        $method->setAccessible(true);
        $message = $method->invoke($provider, $request, '令牌已过期或验证不正确');

        $this->assertStringContainsString('MiniMax rejected the API key', $message);
        $this->assertStringContainsString('expired or invalid', $message);
    }
}
