<?php

namespace App\Tests\Api;

use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

class AuthenticationTest extends WebTestCase
{
    public function testRegisterUser(): void
    {
        $client = static::createClient();

        $client->request('POST', '/api/register', [], [], [
            'CONTENT_TYPE' => 'application/json',
        ], json_encode([
            'email' => 'test@example.com',
            'password' => 'password123',
            'displayName' => 'Test User',
        ]));

        $this->assertResponseStatusCodeSame(201);

        $data = json_decode($client->getResponse()->getContent(), true);
        $this->assertArrayHasKey('token', $data);
        $this->assertArrayHasKey('refreshToken', $data);
        $this->assertArrayHasKey('user', $data);
        $this->assertEquals('test@example.com', $data['user']['email']);
        $this->assertEquals('Test User', $data['user']['displayName']);
    }

    public function testRegisterDuplicateEmail(): void
    {
        $client = static::createClient();

        // Register first user
        $client->request('POST', '/api/register', [], [], [
            'CONTENT_TYPE' => 'application/json',
        ], json_encode([
            'email' => 'duplicate@example.com',
            'password' => 'password123',
        ]));

        $this->assertResponseStatusCodeSame(201);

        // Try to register with the same email
        $client->request('POST', '/api/register', [], [], [
            'CONTENT_TYPE' => 'application/json',
        ], json_encode([
            'email' => 'duplicate@example.com',
            'password' => 'password456',
        ]));

        $this->assertResponseStatusCodeSame(422);
    }

    public function testRegisterWithShortPassword(): void
    {
        $client = static::createClient();

        $client->request('POST', '/api/register', [], [], [
            'CONTENT_TYPE' => 'application/json',
        ], json_encode([
            'email' => 'shortpass@example.com',
            'password' => '123',
        ]));

        $this->assertResponseStatusCodeSame(400);
    }

    public function testLoginWithValidCredentials(): void
    {
        $client = static::createClient();

        // Register a user first
        $client->request('POST', '/api/register', [], [], [
            'CONTENT_TYPE' => 'application/json',
        ], json_encode([
            'email' => 'login@example.com',
            'password' => 'password123',
        ]));

        $this->assertResponseStatusCodeSame(201);

        // Now login
        $client->request('POST', '/api/login_check', [], [], [
            'CONTENT_TYPE' => 'application/json',
        ], json_encode([
            'username' => 'login@example.com',
            'password' => 'password123',
        ]));

        $this->assertResponseStatusCodeSame(200);

        $data = json_decode($client->getResponse()->getContent(), true);
        $this->assertArrayHasKey('token', $data);
        $this->assertArrayHasKey('refreshToken', $data);
        $this->assertArrayHasKey('user', $data);
    }

    public function testLoginWithInvalidCredentials(): void
    {
        $client = static::createClient();

        $client->request('POST', '/api/login_check', [], [], [
            'CONTENT_TYPE' => 'application/json',
        ], json_encode([
            'username' => 'nonexistent@example.com',
            'password' => 'wrongpassword',
        ]));

        $this->assertResponseStatusCodeSame(401);
    }

    public function testProtectedRouteWithoutToken(): void
    {
        $client = static::createClient();

        $client->request('GET', '/api/avatars');

        $this->assertResponseStatusCodeSame(401);
    }

    public function testProtectedRouteWithToken(): void
    {
        $client = static::createClient();

        // Register and get token
        $client->request('POST', '/api/register', [], [], [
            'CONTENT_TYPE' => 'application/json',
        ], json_encode([
            'email' => 'tokentest@example.com',
            'password' => 'password123',
        ]));

        $data = json_decode($client->getResponse()->getContent(), true);
        $token = $data['token'];

        // Access protected route with token
        $client->request('GET', '/api/avatars', [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer ' . $token,
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertResponseStatusCodeSame(200);
    }
}
