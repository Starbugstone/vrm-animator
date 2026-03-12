<?php

namespace App\Repository;

use App\Entity\Avatar;
use App\Entity\Conversation;
use App\Entity\User;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<Conversation>
 */
class ConversationRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Conversation::class);
    }

    /**
     * @return list<Conversation>
     */
    public function findAllOwnedByAvatar(User $owner, Avatar $avatar): array
    {
        /** @var list<Conversation> $conversations */
        $conversations = $this->findBy(
            ['owner' => $owner, 'avatar' => $avatar],
            ['updatedAt' => 'DESC', 'id' => 'DESC'],
        );

        return $conversations;
    }

    public function findOwnedConversation(User $owner, int $id): ?Conversation
    {
        /** @var Conversation|null $conversation */
        $conversation = $this->findOneBy([
            'id' => $id,
            'owner' => $owner,
        ]);

        return $conversation;
    }
}
