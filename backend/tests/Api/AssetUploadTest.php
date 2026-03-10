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
}
