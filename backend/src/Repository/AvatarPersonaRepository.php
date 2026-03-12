<?php

namespace App\Repository;

use App\Entity\Avatar;
use App\Entity\AvatarPersona;
use App\Entity\User;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<AvatarPersona>
 */
class AvatarPersonaRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, AvatarPersona::class);
    }

    /**
     * @return list<AvatarPersona>
     */
    public function findAllOwnedByAvatar(User $owner, Avatar $avatar): array
    {
        /** @var list<AvatarPersona> $personas */
        $personas = $this->findBy(
            ['owner' => $owner, 'avatar' => $avatar],
            ['isPrimary' => 'DESC', 'updatedAt' => 'DESC', 'id' => 'DESC'],
        );

        return $personas;
    }

    public function findOwnedPersona(User $owner, int $id): ?AvatarPersona
    {
        /** @var AvatarPersona|null $persona */
        $persona = $this->findOneBy([
            'owner' => $owner,
            'id' => $id,
        ]);

        return $persona;
    }

    public function findPrimaryForAvatar(User $owner, Avatar $avatar): ?AvatarPersona
    {
        /** @var AvatarPersona|null $persona */
        $persona = $this->findOneBy([
            'owner' => $owner,
            'avatar' => $avatar,
            'isPrimary' => true,
        ], [
            'updatedAt' => 'DESC',
        ]);

        return $persona;
    }
}
