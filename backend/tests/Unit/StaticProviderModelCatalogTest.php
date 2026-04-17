<?php

namespace App\Tests\Unit;

use App\Service\Llm\StaticProviderModelCatalog;
use PHPUnit\Framework\TestCase;
use Symfony\Component\HttpKernel\KernelInterface;

class StaticProviderModelCatalogTest extends TestCase
{
    public function testItLoadsConfiguredProviderModelCatalogs(): void
    {
        $kernel = $this->createMock(KernelInterface::class);
        $kernel->method('getProjectDir')->willReturn(dirname(__DIR__, 2));

        $catalog = new StaticProviderModelCatalog($kernel);

        $deepSeekModels = $catalog->listModels('deepseek');
        $glmModels = $catalog->listModels('glm');
        $geminiModels = $catalog->listModels('gemini');
        $minimaxModels = $catalog->listModels('minimax');
        $openAiModels = $catalog->listModels('openai');

        $this->assertNotEmpty($deepSeekModels);
        $this->assertNotEmpty($glmModels);
        $this->assertNotEmpty($geminiModels);
        $this->assertNotEmpty($minimaxModels);
        $this->assertNotEmpty($openAiModels);
        $this->assertSame('deepseek-chat', $catalog->findModel('deepseek', 'deepseek-chat')['id'] ?? null);
        $this->assertSame('glm-5.1', $catalog->findModel('glm', 'glm-5.1')['id'] ?? null);
        $this->assertSame('glm-5', $catalog->findModel('glm', 'glm-5')['id'] ?? null);
        $this->assertSame('gemini-2.5-pro', $catalog->findModel('gemini', 'gemini-2.5-pro')['id'] ?? null);
        $this->assertSame('MiniMax-M2.7', $catalog->findModel('minimax', 'MiniMax-M2.7')['id'] ?? null);
        $this->assertSame('MiniMax-M2.7-highspeed', $catalog->findModel('minimax', 'MiniMax-M2.7-highspeed')['id'] ?? null);
        $this->assertSame('gpt-5.2', $catalog->findModel('openai', 'gpt-5.2')['id'] ?? null);
        $this->assertNull($catalog->findModel('unknown', 'whatever'));
    }
}
