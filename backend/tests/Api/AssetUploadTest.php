<?php

namespace App\Tests\Api;

use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\HttpFoundation\File\UploadedFile;

class AssetUploadTest extends WebTestCase
{
    private function registerUser($client, string $email): string
    {
        $client->request('POST', '/api/register', [], [], [
            'CONTENT_TYPE' => 'application/json',
        ], json_encode([
            'email' => $email,
            'password' => 'password123',
            'displayName' => 'Upload User',
        ]));

        $data = json_decode($client->getResponse()->getContent(), true);

        return $data['token'];
    }

    public function testAvatarUploadCreatesPersistedAvatar(): void
    {
        $client = static::createClient();
        $token = $this->registerUser($client, 'avatar-upload@example.com');

        $tmpPath = tempnam(sys_get_temp_dir(), 'vrm-test');
        file_put_contents($tmpPath, 'dummy vrm content');
        $file = new UploadedFile($tmpPath, 'test-avatar.vrm', 'application/octet-stream', null, true);

        $client->request('POST', '/api/avatars/upload', [
            'name' => 'Uploaded Avatar',
        ], [
            'file' => $file,
        ], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$token,
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertResponseStatusCodeSame(201);
        $data = json_decode($client->getResponse()->getContent(), true);
        $this->assertSame('Uploaded Avatar', $data['name']);
        $this->assertSame('test-avatar.vrm', $data['filename']);
        $this->assertNotEmpty($data['storedFilename']);
    }

    public function testAnimationUploadCreatesPersistedAnimation(): void
    {
        $client = static::createClient();
        $token = $this->registerUser($client, 'animation-upload@example.com');

        $tmpPath = tempnam(sys_get_temp_dir(), 'vrma-test');
        file_put_contents($tmpPath, 'dummy vrma content');
        $file = new UploadedFile($tmpPath, 'wave.vrma', 'application/octet-stream', null, true);

        $client->request('POST', '/api/animations/upload', [
            'name' => 'Wave',
            'kind' => 'action',
        ], [
            'file' => $file,
        ], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$token,
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertResponseStatusCodeSame(201);
        $data = json_decode($client->getResponse()->getContent(), true);
        $this->assertSame('Wave', $data['name']);
        $this->assertSame('action', $data['kind']);
        $this->assertSame('wave.vrma', $data['filename']);
    }

    public function testAnimationUploadCanPersistMetadataAndAvatarBinding(): void
    {
        $client = static::createClient();
        $token = $this->registerUser($client, 'animation-upload-metadata@example.com');

        $client->request('POST', '/api/avatars', [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$token,
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT' => 'application/json',
        ], json_encode([
            'name' => 'Metadata Avatar',
            'filename' => 'metadata-avatar.vrm',
        ]));

        $this->assertResponseStatusCodeSame(201);
        $avatar = json_decode($client->getResponse()->getContent(), true);

        $tmpPath = tempnam(sys_get_temp_dir(), 'vrma-meta');
        file_put_contents($tmpPath, 'dummy vrma content');
        $file = new UploadedFile($tmpPath, 'hips.vrma', 'application/octet-stream', null, true);

        $client->request('POST', '/api/animations/upload', [
            'name' => 'Hands on hips',
            'kind' => 'action',
            'avatarId' => (string) $avatar['id'],
            'description' => 'A confident hand-on-hip stance.',
            'keywords' => ['confidence', 'stance'],
            'emotionTags' => ['happy', 'playful'],
        ], [
            'file' => $file,
        ], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$token,
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertResponseStatusCodeSame(201);
        $data = json_decode($client->getResponse()->getContent(), true);
        $this->assertSame('Hands on hips', $data['name']);
        $this->assertStringContainsString('/api/avatars/'.$avatar['id'], (string) ($data['avatar'] ?? ''));
        $this->assertSame('A confident hand-on-hip stance.', $data['description']);
        $this->assertSame(['confidence', 'stance'], $data['keywords']);
        $this->assertSame(['happy', 'playful'], $data['emotionTags']);
    }
}
