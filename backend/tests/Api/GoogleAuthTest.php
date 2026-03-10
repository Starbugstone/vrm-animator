<?php

namespace App\Tests\Api;

use App\Service\GoogleIdentity;
use App\Service\GoogleIdentityVerifier;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

class GoogleAuthTest extends WebTestCase
{
    public function testGoogleLoginCreatesJwtUser(): void
    {
        $client = static::createClient();

        static::getContainer()->set(GoogleIdentityVerifier::class, new class extends GoogleIdentityVerifier {
            public function verifyIdToken(string $idToken): GoogleIdentity
            {
                return new GoogleIdentity(
                    'google-subject-123',
                    'google-user@example.com',
                    true,
                    'Google User',
                );
            }
        });

        $client->request('POST', '/api/auth/google', [], [], [
            'CONTENT_TYPE' => 'application/json',
        ], json_encode([
            'idToken' => 'test-google-id-token',
        ]));

        $this->assertResponseStatusCodeSame(200);

        $data = json_decode($client->getResponse()->getContent(), true);
        $this->assertArrayHasKey('token', $data);
        $this->assertSame('google-user@example.com', $data['user']['email']);
        $this->assertSame('Google User', $data['user']['displayName']);
    }
}
