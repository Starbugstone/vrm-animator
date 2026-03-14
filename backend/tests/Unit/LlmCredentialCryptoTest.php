<?php

namespace App\Tests\Unit;

use App\Service\LlmCredentialCrypto;
use PHPUnit\Framework\TestCase;

class LlmCredentialCryptoTest extends TestCase
{
    public function testItDetectsWhenAStoredCredentialCannotBeDecryptedWithTheCurrentKey(): void
    {
        $writer = new LlmCredentialCrypto('original-local-key');
        $reader = new LlmCredentialCrypto('different-local-key');

        $encrypted = $writer->encrypt('secret-token-value');

        $this->assertFalse($reader->canDecrypt($encrypted));
        $this->assertSame('Stored key unavailable', $reader->tryMask($encrypted));
    }
}
