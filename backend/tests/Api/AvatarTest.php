<?php

namespace App\Tests\Api;

use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;

class AvatarTest extends WebTestCase
{
    private string $token;

    protected function setUp(): void
    {
        parent::setUp();
    }

    private function createAuthenticatedUser(KernelBrowser $client, string $email = 'avatar-test@example.com'): string
    {

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
        $token = $this->createAuthenticatedUser($client, 'create-avatar@example.com');

        $client->request('POST', '/api/avatars', [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer ' . $token,
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT' => 'application/json',
        ], json_encode([
            'name' => 'My First Avatar',
            'filename' => 'avatar1.vrm',
            'isDefault' => true,
            'defaultFacingYaw' => 45,
        ]));

        $this->assertResponseStatusCodeSame(201);

        $data = json_decode($client->getResponse()->getContent(), true);
        $this->assertEquals('My First Avatar', $data['name']);
        $this->assertEquals('avatar1.vrm', $data['filename']);
        $this->assertTrue($data['isDefault']);
        $this->assertSame(45.0, $data['defaultFacingYaw']);
    }

    public function testAvatarSpeechPreferencesCanBeSaved(): void
    {
        $client = static::createClient();
        $token = $this->createAuthenticatedUser($client, 'avatar-speech@example.com');

        $client->request('POST', '/api/avatars', [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$token,
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT' => 'application/json',
        ], json_encode([
            'name' => 'Speech Avatar',
            'filename' => 'speech-avatar.vrm',
            'presentationGender' => 'female',
            'speechVoiceGender' => 'female',
            'speechLanguage' => 'en-US',
        ]));

        $this->assertResponseStatusCodeSame(201);

        $data = json_decode($client->getResponse()->getContent(), true);
        $this->assertSame('female', $data['presentationGender']);
        $this->assertSame('female', $data['speechVoiceGender']);
        $this->assertSame('en-US', $data['speechLanguage']);

        $client->request('PATCH', '/api/avatars/'.$data['id'], [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$token,
            'CONTENT_TYPE' => 'application/merge-patch+json',
            'HTTP_ACCEPT' => 'application/json',
        ], json_encode([
            'presentationGender' => 'male',
            'speechVoiceGender' => 'male',
            'speechLanguage' => 'fr-FR',
        ]));

        $this->assertResponseStatusCodeSame(200);

        $updated = json_decode($client->getResponse()->getContent(), true);
        $this->assertSame('male', $updated['presentationGender']);
        $this->assertSame('male', $updated['speechVoiceGender']);
        $this->assertSame('fr-FR', $updated['speechLanguage']);
    }

    public function testAvatarDefaultFacingYawCanBeSaved(): void
    {
        $client = static::createClient();
        $token = $this->createAuthenticatedUser($client, 'avatar-facing@example.com');

        $client->request('POST', '/api/avatars', [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$token,
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT' => 'application/json',
        ], json_encode([
            'name' => 'Facing Avatar',
            'filename' => 'facing-avatar.vrm',
        ]));

        $this->assertResponseStatusCodeSame(201);

        $data = json_decode($client->getResponse()->getContent(), true);
        $this->assertSame(0.0, $data['defaultFacingYaw']);

        $client->request('PATCH', '/api/avatars/'.$data['id'], [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$token,
            'CONTENT_TYPE' => 'application/merge-patch+json',
            'HTTP_ACCEPT' => 'application/json',
        ], json_encode([
            'defaultFacingYaw' => 540,
        ]));

        $this->assertResponseStatusCodeSame(200);

        $updated = json_decode($client->getResponse()->getContent(), true);
        $this->assertSame(180.0, $updated['defaultFacingYaw']);
    }

    public function testListOwnAvatars(): void
    {
        $client = static::createClient();
        $token = $this->createAuthenticatedUser($client, 'list-avatar@example.com');

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
        $token1 = $this->createAuthenticatedUser($client, 'user1-avatar@example.com');
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
        $token2 = $this->createAuthenticatedUser($client, 'user2-avatar@example.com');
        $client->request('GET', '/api/avatars/' . $avatarId, [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer ' . $token2,
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertResponseStatusCodeSame(404);
    }

    public function testDeleteAvatar(): void
    {
        $client = static::createClient();
        $token = $this->createAuthenticatedUser($client, 'delete-avatar@example.com');

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
