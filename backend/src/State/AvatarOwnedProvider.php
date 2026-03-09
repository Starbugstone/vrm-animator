<?php

namespace App\State;

use ApiPlatform\Metadata\Operation;
use ApiPlatform\State\ProviderInterface;
use App\Entity\Avatar;
use App\Repository\AvatarRepository;
use Symfony\Bundle\SecurityBundle\Security;

/**
 * Filters avatar collections to only return avatars owned by the authenticated user.
 */
class AvatarOwnedProvider implements ProviderInterface
{
    public function __construct(
        private AvatarRepository $avatarRepository,
        private Security $security,
    ) {
    }

    public function provide(Operation $operation, array $uriVariables = [], array $context = []): object|array|null
    {
        /** @var \App\Entity\User $user */
        $user = $this->security->getUser();

        return $this->avatarRepository->findBy(['owner' => $user]);
    }
}
