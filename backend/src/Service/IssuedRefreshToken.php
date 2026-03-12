<?php

namespace App\Service;

use App\Entity\User;

final class IssuedRefreshToken
{
    public function __construct(
        public readonly string $token,
        public readonly \DateTimeImmutable $expiresAt,
        public readonly User $user,
    ) {
    }
}
