<?php

namespace App\State;

use ApiPlatform\Metadata\Operation;
use ApiPlatform\State\ProviderInterface;
use App\Repository\AnimationRepository;
use Symfony\Bundle\SecurityBundle\Security;

class AnimationOwnedItemProvider implements ProviderInterface
{
    public function __construct(
        private AnimationRepository $animationRepository,
        private Security $security,
    ) {
    }

    public function provide(Operation $operation, array $uriVariables = [], array $context = []): object|array|null
    {
        /** @var \App\Entity\User $user */
        $user = $this->security->getUser();

        return $this->animationRepository->findOneBy([
            'id' => $uriVariables['id'] ?? null,
            'owner' => $user,
        ]);
    }
}
