<?php

namespace App\Tests\Unit;

use App\Entity\Avatar;
use App\Entity\Conversation;
use App\Entity\ConversationMessage;
use App\Service\Llm\CueAsset;
use App\Service\Llm\PromptBuilder;
use App\Service\Llm\PromptRulesProvider;
use PHPUnit\Framework\TestCase;
use Symfony\Component\HttpKernel\KernelInterface;

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

        $animation = new CueAsset(
            'user:1',
            'Greeting',
            'Greeting',
            'action',
            'Warm greeting',
            ['hello'],
            ['happy'],
            'user',
        );

        $conversation = new Conversation();
        $historyMessage = (new ConversationMessage())
            ->setConversation($conversation)
            ->setRole('assistant')
            ->setContent('Previous visible reply')
            ->setRawProviderContent('Previous visible reply {emotion:calm}');

        $kernel = $this->createMock(KernelInterface::class);
        $kernel->method('getProjectDir')->willReturn('/var/www/html');

        $builder = new PromptBuilder(new PromptRulesProvider($kernel));
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
