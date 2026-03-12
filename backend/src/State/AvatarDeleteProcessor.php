<?php

namespace App\State;

use ApiPlatform\Metadata\Operation;
use ApiPlatform\State\ProcessorInterface;
use App\Entity\Avatar;
use App\Service\UploadedAssetStorage;

class AvatarDeleteProcessor implements ProcessorInterface
{
    public function __construct(
        private ProcessorInterface $removeProcessor,
        private UploadedAssetStorage $uploadedAssetStorage,
    ) {
    }

    public function process(mixed $data, Operation $operation, array $uriVariables = [], array $context = []): mixed
    {
        if ($data instanceof Avatar) {
            $this->uploadedAssetStorage->deleteStoredFile('avatar', $data->getStoredFilename(), $data->getOwner()?->getId());
        }

        return $this->removeProcessor->process($data, $operation, $uriVariables, $context);
    }
}
