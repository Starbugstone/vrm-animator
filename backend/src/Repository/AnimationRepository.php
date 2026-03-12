<?php

namespace App\Repository;

use App\Entity\Animation;
use App\Entity\Avatar;
use App\Entity\User;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<Animation>
 */
class AnimationRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Animation::class);
    }

    /**
     * @return list<Animation>
     */
    public function findAvailableForAvatar(User $owner, Avatar $avatar): array
    {
        $animations = $this->createQueryBuilder('animation')
            ->andWhere('animation.owner = :owner')
            ->andWhere('animation.avatar IS NULL OR animation.avatar = :avatar')
            ->setParameter('owner', $owner)
            ->setParameter('avatar', $avatar)
            ->orderBy('animation.name', 'ASC')
            ->getQuery()
            ->getResult();

        /** @var list<Animation> $animations */
        return $animations;
    }
}
