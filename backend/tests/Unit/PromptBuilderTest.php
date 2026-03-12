<?php

namespace App\Tests\Unit;

use App\Entity\Animation;
use App\Entity\Avatar;
use App\Entity\Conversation;
use App\Entity\ConversationMessage;
use App\Service\Llm\PromptBuilder;
use PHPUnit\Framework\TestCase;

class PromptBuilderTest extends TestCase
{
    public function testItBuildsPromptWithProfileMemoryAnimationsAndHistory(): void
    {
        $avatar = (new Avatar())
            ->setName('Guide')
            ->setFilename('guide.vrm')
            ->setBackstory('Raised in the clouds.')
            ->setPersonality('Patient and curious.')
            ->setSystemPrompt('Keep the tone steady.');

        $animation = (new Animation())
            ->setName('Greeting')
            ->setFilename('greeting.vrma')
            ->setDescription('Warm greeting')
            ->setKeywords(['hello']);

        $conversation = new Conversation();
        $historyMessage = (new ConversationMessage())
            ->setConversation($conversation)
            ->setRole('assistant')
            ->setContent('Previous visible reply')
            ->setRawProviderContent('Previous visible reply {emotion:calm}');

        $builder = new PromptBuilder();
        $messages = $builder->buildMessages(
            $avatar,
            null,
            "# Avatar Memory\n\n- remembers teal",
            [$animation],
            [$historyMessage],
            'Current user question',
        );

        $this->assertCount(3, $messages);
        $this->assertSame('system', $messages[0]['role']);
        $this->assertStringContainsString('Guide', $messages[0]['content']);
        $this->assertStringContainsString('remembers teal', $messages[0]['content']);
        $this->assertStringContainsString('Greeting', $messages[0]['content']);
        $this->assertSame('assistant', $messages[1]['role']);
        $this->assertStringContainsString('{emotion:calm}', $messages[1]['content']);
        $this->assertSame('user', $messages[2]['role']);
        $this->assertSame('Current user question', $messages[2]['content']);
    }
}
