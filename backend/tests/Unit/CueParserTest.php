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
            'action:user:1',
            'Greeting',
            'Greeting',
            'action',
            'Warm greeting',
            ['hello', 'wave'],
            ['happy'],
            'user',
            ['hello', 'wave', 'happy'],
        );
        $expression = new CueAsset(
            'expression:shared:1',
            'Happy Talk',
            'Happy Talk',
            'expression',
            'Happy speaking overlay',
            ['speech'],
            ['happy'],
            'shared',
            ['speech', 'happy'],
            ['mouth', 'eyes', 'face'],
            3,
        );

        $parser = new CueParser(new EmotionVocabulary());
        $parsed = $parser->parse(
            'Hello there {emotion:happy} {anim:hello} {emotion:furious} {anim:unknown}',
            [$animation, $expression],
        );

        $this->assertSame('Hello there', $parsed['text']);
        $this->assertSame(['happy'], $parsed['emotionTags']);
        $this->assertSame(['Greeting'], $parsed['animationTags']);

        $cueEvents = array_values(array_filter(
            $parsed['timeline'],
            static fn (array $entry): bool => in_array($entry['type'] ?? '', ['emotion', 'animation'], true),
        ));

        $this->assertSame('expression:shared:1', $cueEvents[0]['assetId'] ?? null);
        $this->assertSame('action:user:1', $cueEvents[1]['assetId'] ?? null);
    }
}
