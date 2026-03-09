<?php

namespace App\Tests\Api;

use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;

class AvatarTest extends WebTestCase
{
    private string $token;

    protected function setUp(): void
    {
        parent::setUp();
    }

    private function createAuthenticatedUser(string $email = 'avatar-test@example.com'): string
    {
        $client = static::createClient();

        $client->request('POST', '/api/register', [], [], [
            'CONTENT_TYPE' => 'application/json',
        ], json_encode([
            'email' => $email,
            'password' => 'password123',
            'displayName' => 'Avatar Tester',
        ]));

        $data = json_decode($client->getResponse()->getContent(), true);

        return $data['token'];
    }

    public function testCreateAvatar(): void
    {
        $client = static::createClient();
        $token = $this->createAuthenticatedUser('create-avatar@example.com');

        $client->request('POST', '/api/avatars', [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer ' . $token,
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT' => 'application/json',
        ], json_encode([
            'name' => 'My First Avatar',
            'filename' => 'avatar1.vrm',
            'isDefault' => true,
        ]));

        $this->assertResponseStatusCodeSame(201);

        $data = json_decode($client->getResponse()->getContent(), true);
        $this->assertEquals('My First Avatar', $data['name']);
        $this->assertEquals('avatar1.vrm', $data['filename']);
        $this->assertTrue($data['isDefault']);
    }

    public function testListOwnAvatars(): void
    {
        $client = static::createClient();
        $token = $this->createAuthenticatedUser('list-avatar@example.com');

        // Create an avatar
        $client->request('POST', '/api/avatars', [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer ' . $token,
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT' => 'application/json',
        ], json_encode([
            'name' => 'Listed Avatar',
            'filename' => 'listed.vrm',
        ]));

        $this->assertResponseStatusCodeSame(201);

        // List avatars
        $client->request('GET', '/api/avatars', [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer ' . $token,
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertResponseStatusCodeSame(200);

        $data = json_decode($client->getResponse()->getContent(), true);
        $this->assertNotEmpty($data);
    }

    public function testCannotAccessOtherUsersAvatar(): void
    {
        $client = static::createClient();

        // User 1 creates an avatar
        $token1 = $this->createAuthenticatedUser('user1-avatar@example.com');
        $client->request('POST', '/api/avatars', [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer ' . $token1,
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT' => 'application/json',
        ], json_encode([
            'name' => 'User1 Avatar',
            'filename' => 'user1.vrm',
        ]));

        $this->assertResponseStatusCodeSame(201);
        $avatarData = json_decode($client->getResponse()->getContent(), true);
        $avatarId = $avatarData['id'];

        // User 2 tries to access User 1's avatar
        $token2 = $this->createAuthenticatedUser('user2-avatar@example.com');
        $client->request('GET', '/api/avatars/' . $avatarId, [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer ' . $token2,
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertResponseStatusCodeSame(403);
    }

    public function testDeleteAvatar(): void
    {
        $client = static::createClient();
        $token = $this->createAuthenticatedUser('delete-avatar@example.com');

        // Create an avatar
        $client->request('POST', '/api/avatars', [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer ' . $token,
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT' => 'application/json',
        ], json_encode([
            'name' => 'Deletable Avatar',
            'filename' => 'delete-me.vrm',
        ]));

        $this->assertResponseStatusCodeSame(201);
        $avatarData = json_decode($client->getResponse()->getContent(), true);
        $avatarId = $avatarData['id'];

        // Delete the avatar
        $client->request('DELETE', '/api/avatars/' . $avatarId, [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer ' . $token,
        ]);

        $this->assertResponseStatusCodeSame(204);
    }

    public function testCreateAvatarWithoutAuth(): void
    {
        $client = static::createClient();

        $client->request('POST', '/api/avatars', [], [], [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT' => 'application/json',
        ], json_encode([
            'name' => 'Unauthorized Avatar',
            'filename' => 'unauthorized.vrm',
        ]));

        $this->assertResponseStatusCodeSame(401);
    }
}
