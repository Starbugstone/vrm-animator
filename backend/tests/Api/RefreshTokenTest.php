<?php

namespace App\Tests\Api;

use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

class RefreshTokenTest extends WebTestCase
{
    public function testRefreshTokenReturnsNewTokenPairAndRotatesPreviousRefreshToken(): void
    {
        $client = static::createClient();
        $email = sprintf('refresh-%s@example.com', bin2hex(random_bytes(6)));

        $client->request('POST', '/api/register', [], [], [
            'CONTENT_TYPE' => 'application/json',
        ], json_encode([
            'email' => $email,
            'password' => 'password123',
            'displayName' => 'Refresh User',
        ]));

        $this->assertResponseStatusCodeSame(201);

        $registerData = json_decode($client->getResponse()->getContent(), true);
        $this->assertArrayHasKey('refreshToken', $registerData);

        $client->request('POST', '/api/token/refresh', [], [], [
            'CONTENT_TYPE' => 'application/json',
        ], json_encode([
            'refreshToken' => $registerData['refreshToken'],
        ]));

        $this->assertResponseStatusCodeSame(200);

        $refreshData = json_decode($client->getResponse()->getContent(), true);
        $this->assertArrayHasKey('token', $refreshData);
        $this->assertArrayHasKey('refreshToken', $refreshData);
        $this->assertArrayHasKey('user', $refreshData);
        $this->assertNotSame($registerData['refreshToken'], $refreshData['refreshToken']);
        $this->assertSame($email, $refreshData['user']['email']);

        $client->request('POST', '/api/token/refresh', [], [], [
            'CONTENT_TYPE' => 'application/json',
        ], json_encode([
            'refreshToken' => $registerData['refreshToken'],
        ]));

        $this->assertResponseStatusCodeSame(401);
    }

    public function testRefreshTokenRequiresPayload(): void
    {
        $client = static::createClient();

        $client->request('POST', '/api/token/refresh', [], [], [
            'CONTENT_TYPE' => 'application/json',
        ], json_encode([]));

        $this->assertResponseStatusCodeSame(400);
    }
}
