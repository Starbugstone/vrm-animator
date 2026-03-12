<?php

namespace App\Tests\Unit;

use App\Entity\Animation;
use App\Service\Llm\CueParser;
use PHPUnit\Framework\TestCase;

class CueParserTest extends TestCase
{
    public function testItStripsTagsAndKeepsOnlySupportedCues(): void
    {
        $animation = (new Animation())
            ->setName('Greeting')
            ->setFilename('greeting.vrma')
            ->setKeywords(['hello', 'wave']);

        $parser = new CueParser();
        $parsed = $parser->parse(
            'Hello there {emotion:happy} {anim:hello} {emotion:furious} {anim:unknown}',
            [$animation],
        );

        $this->assertSame('Hello there', $parsed['text']);
        $this->assertSame(['happy'], $parsed['emotionTags']);
        $this->assertSame(['Greeting'], $parsed['animationTags']);
    }
}
