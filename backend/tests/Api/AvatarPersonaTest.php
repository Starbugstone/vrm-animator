<?php

namespace App\Tests\Api;

use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

class AvatarPersonaTest extends WebTestCase
{
    private function registerUser($client, string $email): string
    {
        $client->request('POST', '/api/register', [], [], [
            'CONTENT_TYPE' => 'application/json',
        ], json_encode([
            'email' => $email,
            'password' => 'password123',
            'displayName' => 'Persona User',
        ]));

        $data = json_decode($client->getResponse()->getContent(), true);

        return $data['token'];
    }

    public function testPersonasCanBeCreatedUpdatedAndReassignedAsPrimary(): void
    {
        $client = static::createClient();
        $token = $this->registerUser($client, 'persona-owner@example.com');

        $client->request('POST', '/api/avatars', [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$token,
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT' => 'application/json',
        ], json_encode([
            'name' => 'Persona Avatar',
            'filename' => 'persona-avatar.vrm',
        ]));

        $this->assertResponseStatusCodeSame(201);
        $avatar = json_decode($client->getResponse()->getContent(), true);

        $client->request('POST', '/api/llm/credentials', [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$token,
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT' => 'application/json',
        ], json_encode([
            'name' => 'GLM Main',
            'provider' => 'glm',
            'secret' => 'glm-secret-token',
            'defaultModel' => 'glm-4.7',
            'isActive' => true,
        ]));
        $this->assertResponseStatusCodeSame(201);
        $glm = json_decode($client->getResponse()->getContent(), true);

        $client->request('POST', '/api/llm/credentials', [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$token,
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT' => 'application/json',
        ], json_encode([
            'name' => 'MiniMax Main',
            'provider' => 'minimax',
            'secret' => 'minimax-secret-token',
            'defaultModel' => 'MiniMax-M2.5',
            'isActive' => true,
        ]));
        $this->assertResponseStatusCodeSame(201);
        $minimax = json_decode($client->getResponse()->getContent(), true);

        $client->request('POST', '/api/avatars/'.$avatar['id'].'/personas', [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$token,
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT' => 'application/json',
        ], json_encode([
            'name' => 'Guide',
            'personality' => 'Calm and thoughtful.',
            'llmCredentialId' => $glm['id'],
            'isPrimary' => true,
        ]));

        $this->assertResponseStatusCodeSame(201);
        $guide = json_decode($client->getResponse()->getContent(), true);
        $this->assertTrue($guide['isPrimary']);
        $this->assertSame($glm['id'], $guide['llmCredentialId']);
        $this->assertSame('glm', $guide['llmProvider']);

        $client->request('POST', '/api/avatars/'.$avatar['id'].'/personas', [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$token,
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT' => 'application/json',
        ], json_encode([
            'name' => 'Performer',
            'description' => 'More energetic persona.',
            'personality' => 'Playful and expressive.',
            'llmCredentialId' => $minimax['id'],
            'isPrimary' => true,
        ]));

        $this->assertResponseStatusCodeSame(201);
        $performer = json_decode($client->getResponse()->getContent(), true);
        $this->assertTrue($performer['isPrimary']);
        $this->assertSame($minimax['id'], $performer['llmCredentialId']);
        $this->assertSame('minimax', $performer['llmProvider']);

        $client->request('GET', '/api/avatars/'.$avatar['id'].'/personas', [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$token,
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertResponseStatusCodeSame(200);
        $listed = json_decode($client->getResponse()->getContent(), true);
        $personas = $listed['personas'];
        $this->assertCount(2, $personas);

        $guidePersona = current(array_filter($personas, static fn (array $persona): bool => $persona['id'] === $guide['id']));
        $performerPersona = current(array_filter($personas, static fn (array $persona): bool => $persona['id'] === $performer['id']));

        $this->assertFalse($guidePersona['isPrimary']);
        $this->assertTrue($performerPersona['isPrimary']);

        $client->request('PATCH', '/api/avatar-personas/'.$guide['id'], [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$token,
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT' => 'application/json',
        ], json_encode([
            'llmCredentialId' => null,
            'isPrimary' => true,
        ]));

        $this->assertResponseStatusCodeSame(200);
        $updatedGuide = json_decode($client->getResponse()->getContent(), true);
        $this->assertTrue($updatedGuide['isPrimary']);
        $this->assertNull($updatedGuide['llmCredentialId']);
        $this->assertNull($updatedGuide['llmProvider']);
    }

    public function testPersonaEndpointsArePrivateToOwner(): void
    {
        $client = static::createClient();
        $ownerToken = $this->registerUser($client, 'persona-private-owner@example.com');

        $client->request('POST', '/api/avatars', [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$ownerToken,
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT' => 'application/json',
        ], json_encode([
            'name' => 'Private Persona Avatar',
            'filename' => 'private-persona-avatar.vrm',
        ]));

        $this->assertResponseStatusCodeSame(201);
        $avatar = json_decode($client->getResponse()->getContent(), true);

        $client->request('POST', '/api/avatars/'.$avatar['id'].'/personas', [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$ownerToken,
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT' => 'application/json',
        ], json_encode([
            'name' => 'Private Persona',
        ]));

        $this->assertResponseStatusCodeSame(201);
        $persona = json_decode($client->getResponse()->getContent(), true);

        $otherToken = $this->registerUser($client, 'persona-private-other@example.com');

        $client->request('PATCH', '/api/avatar-personas/'.$persona['id'], [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$otherToken,
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT' => 'application/json',
        ], json_encode([
            'name' => 'Intruder',
        ]));

        $this->assertResponseStatusCodeSame(404);

        $client->request('DELETE', '/api/avatar-personas/'.$persona['id'], [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$otherToken,
        ]);

        $this->assertResponseStatusCodeSame(404);
    }
}
