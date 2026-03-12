<?php

namespace App\Tests\Unit;

use App\Service\Llm\CueAsset;
use App\Service\Llm\CueParser;
use App\Service\Llm\EmotionVocabulary;
use PHPUnit\Framework\TestCase;

class CueParserTest extends TestCase
{
    public function testItStripsTagsAndKeepsOnlySupportedCues(): void
    {
        $animation = new CueAsset(
            'user:1',
            'Greeting',
            'Greeting',
            'action',
            'Warm greeting',
            ['hello', 'wave'],
            ['happy'],
            'user',
        );

        $parser = new CueParser(new EmotionVocabulary());
        $parsed = $parser->parse(
            'Hello there {emotion:happy} {anim:hello} {emotion:furious} {anim:unknown}',
            [$animation],
        );

        $this->assertSame('Hello there', $parsed['text']);
        $this->assertSame(['happy'], $parsed['emotionTags']);
        $this->assertSame(['Greeting'], $parsed['animationTags']);
    }
}
