<?php

namespace App\Repository;

use App\Entity\TtsCredential;
use App\Entity\User;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<TtsCredential>
 */
class TtsCredentialRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, TtsCredential::class);
    }

    /**
     * @return list<TtsCredential>
     */
    public function findAllOwnedBy(User $owner): array
    {
        /** @var list<TtsCredential> $credentials */
        $credentials = $this->findBy(
            ['owner' => $owner],
            ['name' => 'ASC', 'createdAt' => 'ASC'],
        );

        return $credentials;
    }

    public function findOwnedCredential(User $owner, int $id): ?TtsCredential
    {
        /** @var TtsCredential|null $credential */
        $credential = $this->createQueryBuilder('credential')
            ->andWhere('credential.id = :id')
            ->andWhere('IDENTITY(credential.owner) = :ownerId')
            ->setParameter('id', $id)
            ->setParameter('ownerId', $owner->getId())
            ->getQuery()
            ->getOneOrNullResult();

        return $credential;
    }
}
