<?php

namespace App\Service;

use App\Entity\User;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;

class AuthResponseFactory
{
    public function __construct(
        private readonly JWTTokenManagerInterface $jwtTokenManager,
        private readonly RefreshTokenManager $refreshTokenManager,
    ) {
    }

    /**
     * @return array{
     *     token:string,
     *     refreshToken:string,
     *     refreshTokenExpiresAt:string,
     *     user:array{id:int|null,email:string|null,displayName:string|null}
     * }
     */
    public function createResponseData(User $user, ?IssuedRefreshToken $issuedRefreshToken = null): array
    {
        $issuedRefreshToken ??= $this->refreshTokenManager->issue($user);

        return [
            'token' => $this->jwtTokenManager->create($user),
            'refreshToken' => $issuedRefreshToken->token,
            'refreshTokenExpiresAt' => $issuedRefreshToken->expiresAt->format(DATE_ATOM),
            'user' => [
                'id' => $user->getId(),
                'email' => $user->getEmail(),
                'displayName' => $user->getDisplayName(),
            ],
        ];
    }
}
