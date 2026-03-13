<?php

namespace App\Tests\Unit;

use App\Service\LlmProviderCatalog;
use PHPUnit\Framework\TestCase;

class LlmProviderCatalogTest extends TestCase
{
    public function testItReturnsLabelsAndMetadataForSupportedProviders(): void
    {
        $catalog = new LlmProviderCatalog();

        $this->assertSame('GLM', $catalog->getLabel('glm'));
        $this->assertSame('MiniMax', $catalog->getLabel(' MINIMAX '));
        $this->assertSame('OpenRouter', $catalog->findProvider('openrouter')['label'] ?? null);
        $this->assertTrue($catalog->isSupported('OpenRouter'));
        $this->assertFalse($catalog->isSupported('unknown-provider'));
    }
}
