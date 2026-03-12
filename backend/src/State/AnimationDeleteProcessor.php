<?php

namespace App\State;

use ApiPlatform\Metadata\Operation;
use ApiPlatform\State\ProcessorInterface;
use App\Entity\Animation;
use App\Service\UploadedAssetStorage;

class AnimationDeleteProcessor implements ProcessorInterface
{
    public function __construct(
        private ProcessorInterface $removeProcessor,
        private UploadedAssetStorage $uploadedAssetStorage,
    ) {
    }

    public function process(mixed $data, Operation $operation, array $uriVariables = [], array $context = []): mixed
    {
        if ($data instanceof Animation) {
            $this->uploadedAssetStorage->deleteStoredFile('animation', $data->getStoredFilename(), $data->getOwner()?->getId());
        }

        return $this->removeProcessor->process($data, $operation, $uriVariables, $context);
    }
}
