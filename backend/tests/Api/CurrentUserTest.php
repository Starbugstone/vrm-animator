<?php

namespace App\Tests\Api;

use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

class CurrentUserTest extends WebTestCase
{
    private function registerAndGetToken($client, string $email): string
    {
        $client->request('POST', '/api/register', [], [], [
            'CONTENT_TYPE' => 'application/json',
        ], json_encode([
            'email' => $email,
            'password' => 'password123',
            'displayName' => 'Me User',
        ]));

        $data = json_decode($client->getResponse()->getContent(), true);

        return $data['token'];
    }

    public function testCurrentUserEndpointReturnsAuthenticatedUser(): void
    {
        $client = static::createClient();
        $token = $this->registerAndGetToken($client, 'me@example.com');

        $client->request('GET', '/api/me', [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$token,
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertResponseStatusCodeSame(200);
        $data = json_decode($client->getResponse()->getContent(), true);
        $this->assertSame('me@example.com', $data['email']);
        $this->assertSame('Me User', $data['displayName']);
    }

    public function testUsersCollectionIsNotExposed(): void
    {
        $client = static::createClient();
        $token = $this->registerAndGetToken($client, 'me-other@example.com');

        $client->request('GET', '/api/users', [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$token,
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertResponseStatusCodeSame(404);
    }
}
