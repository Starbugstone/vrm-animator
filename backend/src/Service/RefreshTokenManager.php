<?php

namespace App\Service;

use App\Entity\RefreshToken;
use App\Entity\User;
use App\Repository\RefreshTokenRepository;
use Doctrine\ORM\EntityManagerInterface;

class RefreshTokenManager
{
    public function __construct(
        private readonly EntityManagerInterface $entityManager,
        private readonly RefreshTokenRepository $refreshTokenRepository,
        private readonly int $refreshTokenTtl,
    ) {
    }

    public function issue(User $user): IssuedRefreshToken
    {
        $plainToken = $this->generateToken();
        $expiresAt = (new \DateTimeImmutable())->modify(sprintf('+%d seconds', $this->refreshTokenTtl));

        $refreshToken = (new RefreshToken())
            ->setUser($user)
            ->setTokenHash($this->hashToken($plainToken))
            ->setExpiresAt($expiresAt);

        $this->entityManager->persist($refreshToken);
        $this->entityManager->flush();

        return new IssuedRefreshToken($plainToken, $expiresAt, $user);
    }

    public function rotate(string $plainToken): ?IssuedRefreshToken
    {
        $refreshToken = $this->refreshTokenRepository->findOneByTokenHash($this->hashToken($plainToken));
        if ($refreshToken === null || !$refreshToken->isActive()) {
            return null;
        }

        $user = $refreshToken->getUser();
        if (!$user instanceof User) {
            return null;
        }

        $refreshToken->setRotatedAt(new \DateTimeImmutable());

        $nextPlainToken = $this->generateToken();
        $nextExpiresAt = (new \DateTimeImmutable())->modify(sprintf('+%d seconds', $this->refreshTokenTtl));

        $nextRefreshToken = (new RefreshToken())
            ->setUser($user)
            ->setTokenHash($this->hashToken($nextPlainToken))
            ->setExpiresAt($nextExpiresAt);

        $this->entityManager->persist($nextRefreshToken);
        $this->entityManager->flush();

        return new IssuedRefreshToken($nextPlainToken, $nextExpiresAt, $user);
    }

    private function generateToken(): string
    {
        return rtrim(strtr(base64_encode(random_bytes(48)), '+/', '-_'), '=');
    }

    private function hashToken(string $plainToken): string
    {
        return hash('sha256', $plainToken);
    }
}
