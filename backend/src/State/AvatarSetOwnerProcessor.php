<?php

namespace App\State;

use ApiPlatform\Metadata\Operation;
use ApiPlatform\State\ProcessorInterface;
use App\Entity\Avatar;
use Symfony\Bundle\SecurityBundle\Security;

/**
 * Automatically sets the owner of an Avatar to the authenticated user on creation.
 */
class AvatarSetOwnerProcessor implements ProcessorInterface
{
    public function __construct(
        private ProcessorInterface $persistProcessor,
        private Security $security,
    ) {
    }

    public function process(mixed $data, Operation $operation, array $uriVariables = [], array $context = []): mixed
    {
        if ($data instanceof Avatar && $data->getOwner() === null) {
            /** @var \App\Entity\User $user */
            $user = $this->security->getUser();
            $data->setOwner($user);
        }

        return $this->persistProcessor->process($data, $operation, $uriVariables, $context);
    }
}
