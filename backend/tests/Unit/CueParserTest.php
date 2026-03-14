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

    public function testItParsesBracketedCueBundles(): void
    {
        $animation = new CueAsset(
            'action:user:1',
            'Hand-on-hip',
            'Hand-on-hip',
            'action',
            'Hand on hip pose',
            ['hands on hips', 'hip pose'],
            ['happy'],
            'user',
            ['hands on hips', 'hip pose', 'happy'],
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
            'Putting my hands on my hips [emotion:happy | anim:Hand-on-hip | memory:User has a friend named Scott]',
            [$animation, $expression],
        );

        $this->assertSame('Putting my hands on my hips', $parsed['text']);
        $this->assertSame(['happy'], $parsed['emotionTags']);
        $this->assertSame(['Hand-on-hip'], $parsed['animationTags']);
        $this->assertSame([[
            'scope' => 'relationship',
            'value' => 'User has a friend named Scott',
        ]], $parsed['memoryEntries']);
    }

    public function testItParsesBracketedCueBundlesDuringStreaming(): void
    {
        $animation = new CueAsset(
            'action:user:1',
            'Hand-on-hip',
            'Hand-on-hip',
            'action',
            'Hand on hip pose',
            ['hands on hips', 'hip pose'],
            ['happy'],
            'user',
            ['hands on hips', 'hip pose', 'happy'],
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
        $parsed = $parser->parseStreamDelta(
            'Thinking [emotion:happy | anim:Hand-on-hip | memory:User has a friend named Scott]',
            [$animation, $expression],
            0,
        );

        $this->assertSame(strlen('Thinking [emotion:happy | anim:Hand-on-hip | memory:User has a friend named Scott]'), $parsed['cursor']);
        $this->assertSame('text', $parsed['timeline'][0]['type']);
        $this->assertSame('Thinking ', $parsed['timeline'][0]['value']);
        $this->assertSame('emotion', $parsed['timeline'][1]['type']);
        $this->assertSame('happy', $parsed['timeline'][1]['value']);
        $this->assertSame('animation', $parsed['timeline'][2]['type']);
        $this->assertSame('Hand-on-hip', $parsed['timeline'][2]['value']);
        $this->assertSame('memory', $parsed['timeline'][3]['type']);
        $this->assertSame('relationship', $parsed['timeline'][3]['scope']);
    }

    public function testItParsesScopedMemoryEntries(): void
    {
        $parser = new CueParser(new EmotionVocabulary());
        $parsed = $parser->parse(
            'Important note {memory:long-term|The user is planning a move next month}',
            [],
        );

        $this->assertSame([[
            'scope' => 'long-term',
            'value' => 'The user is planning a move next month',
        ]], $parsed['memoryEntries']);
    }
}
