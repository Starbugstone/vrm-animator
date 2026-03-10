<?php

namespace App\State;

use ApiPlatform\Metadata\Operation;
use ApiPlatform\State\ProviderInterface;
use App\Repository\AvatarRepository;
use Symfony\Bundle\SecurityBundle\Security;

class AvatarOwnedItemProvider implements ProviderInterface
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

        return $this->avatarRepository->findOneBy([
            'id' => $uriVariables['id'] ?? null,
            'owner' => $user,
        ]);
    }
}
