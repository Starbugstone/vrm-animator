<?php

namespace App\Tests\Api;

use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

class AvatarMemoryTest extends WebTestCase
{
    private function registerUser($client, string $email): string
    {
        $client->request('POST', '/api/register', [], [], [
            'CONTENT_TYPE' => 'application/json',
        ], json_encode([
            'email' => $email,
            'password' => 'password123',
            'displayName' => 'Memory User',
        ]));

        $data = json_decode($client->getResponse()->getContent(), true);

        return $data['token'];
    }

    public function testAvatarMemoryCanBeFetchedAndUpdated(): void
    {
        $client = static::createClient();
        $token = $this->registerUser($client, 'memory-owner@example.com');

        $client->request('POST', '/api/avatars', [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$token,
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT' => 'application/json',
        ], json_encode([
            'name' => 'Memory Avatar',
            'filename' => 'memory-avatar.vrm',
            'backstory' => 'Raised in the clouds.',
            'personality' => 'Patient and curious.',
        ]));

        $avatar = json_decode($client->getResponse()->getContent(), true);

        $client->request('GET', '/api/avatars/'.$avatar['id'].'/memory', [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$token,
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertResponseStatusCodeSame(200);
        $memory = json_decode($client->getResponse()->getContent(), true);
        $this->assertStringContainsString('Memory Avatar', $memory['markdownContent']);

        $client->request('PATCH', '/api/avatars/'.$avatar['id'].'/memory', [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$token,
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT' => 'application/json',
        ], json_encode([
            'markdownContent' => $memory['markdownContent']."\n- The user loves teal.\n",
            'revision' => $memory['revision'],
        ]));

        $this->assertResponseStatusCodeSame(200);
        $updated = json_decode($client->getResponse()->getContent(), true);
        $this->assertGreaterThan($memory['revision'], $updated['revision']);
    }

    public function testAvatarMemoryIsPrivateToOwner(): void
    {
        $client = static::createClient();
        $ownerToken = $this->registerUser($client, 'memory-owner-2@example.com');

        $client->request('POST', '/api/avatars', [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$ownerToken,
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT' => 'application/json',
        ], json_encode([
            'name' => 'Private Memory Avatar',
            'filename' => 'private-memory.vrm',
        ]));

        $avatar = json_decode($client->getResponse()->getContent(), true);

        $otherToken = $this->registerUser($client, 'memory-other@example.com');
        $client->request('GET', '/api/avatars/'.$avatar['id'].'/memory', [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$otherToken,
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertResponseStatusCodeSame(404);
    }

    public function testAvatarMemoryRejectsStaleRevisionAndCanBeReset(): void
    {
        $client = static::createClient();
        $token = $this->registerUser($client, 'memory-reset@example.com');

        $client->request('POST', '/api/avatars', [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$token,
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT' => 'application/json',
        ], json_encode([
            'name' => 'Reset Avatar',
            'filename' => 'reset-avatar.vrm',
        ]));

        $this->assertResponseStatusCodeSame(201);
        $avatar = json_decode($client->getResponse()->getContent(), true);

        $client->request('GET', '/api/avatars/'.$avatar['id'].'/memory', [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$token,
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertResponseStatusCodeSame(200);
        $memory = json_decode($client->getResponse()->getContent(), true);

        $client->request('PATCH', '/api/avatars/'.$avatar['id'].'/memory', [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$token,
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT' => 'application/json',
        ], json_encode([
            'markdownContent' => $memory['markdownContent']."\n- Updated once.\n",
            'revision' => $memory['revision'],
        ]));

        $this->assertResponseStatusCodeSame(200);
        $updated = json_decode($client->getResponse()->getContent(), true);

        $client->request('PATCH', '/api/avatars/'.$avatar['id'].'/memory', [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$token,
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT' => 'application/json',
        ], json_encode([
            'markdownContent' => $memory['markdownContent']."\n- Stale update.\n",
            'revision' => $memory['revision'],
        ]));

        $this->assertResponseStatusCodeSame(409);
        $error = json_decode($client->getResponse()->getContent(), true);
        $this->assertStringContainsString('revision', strtolower($error['message'] ?? ''));

        $client->request('POST', '/api/avatars/'.$avatar['id'].'/memory/reset', [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$token,
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertResponseStatusCodeSame(200);
        $reset = json_decode($client->getResponse()->getContent(), true);
        $this->assertGreaterThan($updated['revision'], $reset['revision']);
        $this->assertStringContainsString('Reset Avatar', $reset['markdownContent']);
    }
}
