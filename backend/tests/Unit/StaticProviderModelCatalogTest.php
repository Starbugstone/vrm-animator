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

        $glmModels = $catalog->listModels('glm');
        $minimaxModels = $catalog->listModels('minimax');

        $this->assertNotEmpty($glmModels);
        $this->assertNotEmpty($minimaxModels);
        $this->assertSame('glm-5', $catalog->findModel('glm', 'glm-5')['id'] ?? null);
        $this->assertSame('MiniMax-M2.5', $catalog->findModel('minimax', 'MiniMax-M2.5')['id'] ?? null);
        $this->assertNull($catalog->findModel('unknown', 'whatever'));
    }
}
