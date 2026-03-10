<?php

namespace App\Service;

final class GoogleIdentity
{
    public function __construct(
        public readonly string $subject,
        public readonly string $email,
        public readonly bool $emailVerified,
        public readonly ?string $displayName,
    ) {
    }
}
