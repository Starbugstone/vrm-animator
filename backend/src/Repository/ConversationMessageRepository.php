<?php

namespace App\Repository;

use App\Entity\Conversation;
use App\Entity\ConversationMessage;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<ConversationMessage>
 */
class ConversationMessageRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, ConversationMessage::class);
    }

    /**
     * @return list<ConversationMessage>
     */
    public function findAllForConversation(Conversation $conversation): array
    {
        /** @var list<ConversationMessage> $messages */
        $messages = $this->findBy(
            ['conversation' => $conversation],
            ['id' => 'ASC'],
        );

        return $messages;
    }

    /**
     * @return list<ConversationMessage>
     */
    public function findRecentForConversation(Conversation $conversation, int $limit): array
    {
        $safeLimit = max(1, $limit);
        $messages = $this->createQueryBuilder('message')
            ->andWhere('message.conversation = :conversation')
            ->setParameter('conversation', $conversation)
            ->orderBy('message.id', 'DESC')
            ->setMaxResults($safeLimit)
            ->getQuery()
            ->getResult();

        /** @var list<ConversationMessage> $messages */
        $messages = array_values(array_reverse($messages));

        return $messages;
    }
}
