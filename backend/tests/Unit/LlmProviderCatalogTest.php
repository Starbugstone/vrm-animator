<?php

namespace App\Tests\Unit;

use App\Service\LlmProviderCatalog;
use PHPUnit\Framework\TestCase;

class LlmProviderCatalogTest extends TestCase
{
    public function testItReturnsLabelsAndMetadataForSupportedProviders(): void
    {
        $catalog = new LlmProviderCatalog();

        $this->assertSame('DeepSeek', $catalog->getLabel('deepseek'));
        $this->assertSame('GLM', $catalog->getLabel('glm'));
        $this->assertSame('Gemini', $catalog->getLabel(' gemini '));
        $this->assertSame('MiniMax', $catalog->getLabel(' MINIMAX '));
        $this->assertSame('OpenAI', $catalog->getLabel('openai'));
        $this->assertSame('OpenRouter', $catalog->findProvider('openrouter')['label'] ?? null);
        $this->assertTrue($catalog->isSupported('OpenRouter'));
        $this->assertTrue($catalog->isSupported('DeepSeek'));
        $this->assertFalse($catalog->isSupported('unknown-provider'));
    }
}
