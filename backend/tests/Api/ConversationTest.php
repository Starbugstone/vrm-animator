<?php

namespace App\Tests\Api;

use App\Entity\Animation;
use App\Entity\Avatar;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

class ConversationTest extends WebTestCase
{
    private function registerUser($client, string $email): string
    {
        $client->request('POST', '/api/register', [], [], [
            'CONTENT_TYPE' => 'application/json',
        ], json_encode([
            'email' => $email,
            'password' => 'password123',
            'displayName' => 'Conversation User',
        ]));

        $data = json_decode($client->getResponse()->getContent(), true);

        return $data['token'];
    }

    public function testChatCreatesConversationAndPersistsParsedMessages(): void
    {
        $client = static::createClient();
        $token = $this->registerUser($client, 'conversation-owner@example.com');

        $client->request('POST', '/api/avatars', [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$token,
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT' => 'application/json',
        ], json_encode([
            'name' => 'Guide Avatar',
            'filename' => 'guide-avatar.vrm',
            'backstory' => 'A calm guide.',
            'personality' => 'Clear and direct.',
        ]));

        $this->assertResponseStatusCodeSame(201);
        $avatarData = json_decode($client->getResponse()->getContent(), true);

        /** @var EntityManagerInterface $entityManager */
        $entityManager = static::getContainer()->get(EntityManagerInterface::class);
        /** @var User $owner */
        $owner = $entityManager->getRepository(User::class)->findOneBy(['email' => 'conversation-owner@example.com']);
        /** @var Avatar $avatar */
        $avatar = $entityManager->getRepository(Avatar::class)->find($avatarData['id']);

        $animation = (new Animation())
            ->setOwner($owner)
            ->setAvatar($avatar)
            ->setName('Greeting')
            ->setFilename('greeting.vrma')
            ->setDescription('Greeting animation')
            ->setKeywords(['greeting', 'hello'])
            ->setKind('action');

        $entityManager->persist($animation);
        $entityManager->flush();

        $client->request('POST', '/api/llm/credentials', [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$token,
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT' => 'application/json',
        ], json_encode([
            'name' => 'OpenRouter Main',
            'provider' => 'openrouter',
            'secret' => 'test-secret-token',
            'defaultModel' => 'openai/gpt-4.1-mini',
            'isActive' => true,
        ]));

        $this->assertResponseStatusCodeSame(201);

        $client->request('POST', '/api/avatars/'.$avatarData['id'].'/chat', [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$token,
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT' => 'application/json',
        ], json_encode([
            'message' => 'Say hello to me',
            'includeRecentMessages' => 12,
        ]));

        $this->assertResponseStatusCodeSame(200);
        $chatData = json_decode($client->getResponse()->getContent(), true);

        $this->assertSame('openrouter', $chatData['conversation']['provider']);
        $this->assertSame(2, $chatData['conversation']['messageCount']);
        $this->assertSame('user', $chatData['userMessage']['role']);
        $this->assertSame('assistant', $chatData['assistantMessage']['role']);
        $this->assertStringContainsString('Echo:', $chatData['assistantMessage']['content']);
        $this->assertStringNotContainsString('{emotion:', $chatData['assistantMessage']['content']);
        $this->assertSame(['happy'], $chatData['assistantMessage']['emotionTags']);
        $this->assertSame(['Greeting'], $chatData['assistantMessage']['animationTags']);
        $this->assertStringContainsString('{emotion:happy}', $chatData['assistantMessage']['rawProviderContent']);

        $conversationId = $chatData['conversation']['id'];

        $client->request('GET', '/api/avatars/'.$avatarData['id'].'/conversations', [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$token,
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertResponseStatusCodeSame(200);
        $listedConversations = json_decode($client->getResponse()->getContent(), true);
        $this->assertCount(1, $listedConversations['conversations']);
        $this->assertSame($conversationId, $listedConversations['conversations'][0]['id']);

        $client->request('GET', '/api/conversations/'.$conversationId.'/messages', [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$token,
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertResponseStatusCodeSame(200);
        $messageList = json_decode($client->getResponse()->getContent(), true);
        $this->assertCount(2, $messageList['messages']);
        $this->assertSame('Say hello to me', $messageList['messages'][0]['content']);
        $this->assertSame(['Greeting'], $messageList['messages'][1]['animationTags']);
    }

    public function testConversationEndpointsArePrivateToOwner(): void
    {
        $client = static::createClient();
        $ownerToken = $this->registerUser($client, 'conversation-private-owner@example.com');

        $client->request('POST', '/api/avatars', [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$ownerToken,
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT' => 'application/json',
        ], json_encode([
            'name' => 'Private Avatar',
            'filename' => 'private-avatar.vrm',
        ]));

        $avatarData = json_decode($client->getResponse()->getContent(), true);

        $client->request('POST', '/api/llm/credentials', [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$ownerToken,
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT' => 'application/json',
        ], json_encode([
            'name' => 'GLM Main',
            'provider' => 'glm',
            'secret' => 'glm-secret-token',
            'defaultModel' => 'glm-4.5',
            'isActive' => true,
        ]));

        $this->assertResponseStatusCodeSame(201);

        $client->request('POST', '/api/avatars/'.$avatarData['id'].'/chat', [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$ownerToken,
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT' => 'application/json',
        ], json_encode([
            'message' => 'Keep this private',
        ]));

        $this->assertResponseStatusCodeSame(200);
        $conversationId = json_decode($client->getResponse()->getContent(), true)['conversation']['id'];

        $otherToken = $this->registerUser($client, 'conversation-private-other@example.com');

        $client->request('GET', '/api/conversations/'.$conversationId, [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$otherToken,
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertResponseStatusCodeSame(404);

        $client->request('GET', '/api/conversations/'.$conversationId.'/messages', [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$otherToken,
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertResponseStatusCodeSame(404);

        $client->request('GET', '/api/avatars/'.$avatarData['id'].'/conversations', [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$otherToken,
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertResponseStatusCodeSame(404);
    }
}
