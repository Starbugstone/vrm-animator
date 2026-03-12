<?php

namespace App\Service;

class LlmCredentialCrypto
{
    public function __construct(
        private string $llmCredentialEncryptionKey,
    ) {
    }

    public function encrypt(string $plaintext): string
    {
        $this->assertSodiumAvailable();

        $nonce = random_bytes(SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);
        $ciphertext = sodium_crypto_secretbox($plaintext, $nonce, $this->deriveKey());

        return 'v1:'.base64_encode($nonce.$ciphertext);
    }

    public function decrypt(string $encryptedPayload): string
    {
        $this->assertSodiumAvailable();

        if (!str_starts_with($encryptedPayload, 'v1:')) {
            throw new \RuntimeException('Unsupported encrypted credential payload.');
        }

        $decoded = base64_decode(substr($encryptedPayload, 3), true);
        if (!is_string($decoded) || strlen($decoded) <= SODIUM_CRYPTO_SECRETBOX_NONCEBYTES) {
            throw new \RuntimeException('Invalid encrypted credential payload.');
        }

        $nonce = substr($decoded, 0, SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);
        $ciphertext = substr($decoded, SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);
        $plaintext = sodium_crypto_secretbox_open($ciphertext, $nonce, $this->deriveKey());

        if (!is_string($plaintext)) {
            throw new \RuntimeException('Unable to decrypt credential payload.');
        }

        return $plaintext;
    }

    public function mask(string $encryptedPayload): string
    {
        $plaintext = $this->decrypt($encryptedPayload);
        $visibleSuffix = strlen($plaintext) > 4 ? substr($plaintext, -4) : $plaintext;

        return sprintf('****%s', $visibleSuffix);
    }

    private function deriveKey(): string
    {
        $rawKey = trim($this->llmCredentialEncryptionKey);
        if ($rawKey === '') {
            throw new \RuntimeException('LLM credential encryption key is not configured.');
        }

        return hash('sha256', $rawKey, true);
    }

    private function assertSodiumAvailable(): void
    {
        if (!function_exists('sodium_crypto_secretbox')) {
            throw new \RuntimeException('The sodium extension is required for credential encryption.');
        }
    }
}
