<?php

namespace App\Service;

use Google\Client;

class GoogleIdentityVerifier
{
    public function verifyIdToken(string $idToken): GoogleIdentity
    {
        $clientId = (string) ($_ENV['GOOGLE_CLIENT_ID'] ?? $_SERVER['GOOGLE_CLIENT_ID'] ?? '');
        if ($clientId === '') {
            throw new \RuntimeException('Google sign-in is not configured.');
        }

        $client = new Client(['client_id' => $clientId]);
        $payload = $client->verifyIdToken($idToken);

        if (!is_array($payload)) {
            throw new \RuntimeException('Google token verification failed.');
        }

        $email = (string) ($payload['email'] ?? '');
        $subject = (string) ($payload['sub'] ?? '');
        if ($email === '' || $subject === '') {
            throw new \RuntimeException('Google token is missing required claims.');
        }

        return new GoogleIdentity(
            $subject,
            $email,
            (bool) ($payload['email_verified'] ?? false),
            isset($payload['name']) ? trim((string) $payload['name']) : null,
        );
    }
}
