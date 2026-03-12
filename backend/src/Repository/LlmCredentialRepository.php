<?php

namespace App\Repository;

use App\Entity\LlmCredential;
use App\Entity\User;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<LlmCredential>
 */
class LlmCredentialRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, LlmCredential::class);
    }

    /**
     * @return list<LlmCredential>
     */
    public function findAllOwnedBy(User $owner): array
    {
        /** @var list<LlmCredential> $credentials */
        $credentials = $this->findBy(
            ['owner' => $owner],
            ['name' => 'ASC', 'createdAt' => 'ASC'],
        );

        return $credentials;
    }

    public function findOwnedCredential(User $owner, int $id): ?LlmCredential
    {
        /** @var LlmCredential|null $credential */
        $credential = $this->findOneBy([
            'id' => $id,
            'owner' => $owner,
        ]);

        return $credential;
    }

    public function findFirstActiveOwnedByProvider(User $owner, string $provider): ?LlmCredential
    {
        /** @var LlmCredential|null $credential */
        $credential = $this->findOneBy([
            'owner' => $owner,
            'provider' => $provider,
            'isActive' => true,
        ], [
            'name' => 'ASC',
            'createdAt' => 'ASC',
        ]);

        return $credential;
    }

    public function findFirstActiveOwnedBy(User $owner): ?LlmCredential
    {
        /** @var LlmCredential|null $credential */
        $credential = $this->findOneBy([
            'owner' => $owner,
            'isActive' => true,
        ], [
            'provider' => 'ASC',
            'createdAt' => 'ASC',
        ]);

        return $credential;
    }
}
