<?php

namespace App\Tests\Unit;

use App\Entity\Avatar;
use App\Entity\Conversation;
use App\Entity\ConversationMessage;
use App\Service\Llm\ChatModelPolicy;
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
            'action:user:1',
            'Greeting',
            'Greeting',
            'action',
            'Warm greeting',
            ['hello'],
            ['happy'],
            'user',
            ['hello', 'happy'],
        );

        $conversation = new Conversation();
        $historyMessage = (new ConversationMessage())
            ->setConversation($conversation)
            ->setRole('assistant')
            ->setContent('Previous visible reply')
            ->setRawProviderContent("{\"content\":\"Raw provider blob that should not be reused\"}")
            ->setParsedText('Previous visible reply')
            ->setParsedEmotionTags(['calm']);

        $kernel = $this->createMock(KernelInterface::class);
        $kernel->method('getProjectDir')->willReturn(dirname(__DIR__, 2));

        $builder = new PromptBuilder(new PromptRulesProvider($kernel));
        $messages = $builder->buildMessages(
            $avatar,
            null,
            "# Avatar Memory\n\n- remembers teal",
            [$animation],
            [$historyMessage],
            'Current user question',
            $this->defaultPolicy(),
        );

        $this->assertCount(3, $messages);
        $this->assertSame('system', $messages[0]['role']);
        $this->assertStringContainsString('Guide', $messages[0]['content']);
        $this->assertStringContainsString('remembers teal', $messages[0]['content']);
        $this->assertStringContainsString('Greeting', $messages[0]['content']);
        $this->assertStringContainsString('When the reply has any noticeable emotion or tone shift', $messages[0]['content']);
        $this->assertStringContainsString('{anim:name}', $messages[0]['content']);
        $this->assertSame('assistant', $messages[1]['role']);
        $this->assertStringContainsString('Previous visible reply', $messages[1]['content']);
        $this->assertStringContainsString('[emotion=calm]', $messages[1]['content']);
        $this->assertStringNotContainsString('Raw provider blob', $messages[1]['content']);
        $this->assertSame('user', $messages[2]['role']);
        $this->assertSame('Current user question', $messages[2]['content']);
    }

    public function testItCompactsMemoryProfileAndHistoryToPolicyBudgets(): void
    {
        $avatar = (new Avatar())
            ->setName(str_repeat('Guide ', 40))
            ->setFilename('guide.vrm')
            ->setBackstory(str_repeat('Cloud-born and observant. ', 40))
            ->setPersonality(str_repeat('Patient and curious. ', 40))
            ->setSystemPrompt(str_repeat('Keep the tone steady. ', 40));

        $conversation = new Conversation();
        $historyMessage = (new ConversationMessage())
            ->setConversation($conversation)
            ->setRole('assistant')
            ->setParsedText(str_repeat('Previous answer ', 80))
            ->setParsedEmotionTags(['calm', 'happy'])
            ->setParsedAnimationTags(['Greeting']);

        $kernel = $this->createMock(KernelInterface::class);
        $kernel->method('getProjectDir')->willReturn(dirname(__DIR__, 2));

        $builder = new PromptBuilder(new PromptRulesProvider($kernel));
        $policy = new ChatModelPolicy(65536, 800, 4, 2, 120, 80, 90);
        $messages = $builder->buildMessages(
            $avatar,
            null,
            "- important facts about the user\n- likes jasmine tea\n- recurring topics\n- ".str_repeat('memory ', 40),
            [],
            [$historyMessage],
            'Current user question',
            $policy,
        );

        $this->assertStringContainsString('likes jasmine tea', $messages[0]['content']);
        $this->assertStringNotContainsString('important facts about the user', $messages[0]['content']);
        $this->assertStringContainsString('…', $messages[0]['content']);
        $this->assertStringContainsString('[emotion=calm,happy | animation=Greeting]', $messages[1]['content']);
        $this->assertStringContainsString('…', $messages[1]['content']);
    }

    private function defaultPolicy(): ChatModelPolicy
    {
        return new ChatModelPolicy(131072, 1100, 5, 5, 1400, 260, 650);
    }
}
