<?php

namespace App\Service\Llm;

use App\Entity\AvatarPersona;
use App\Entity\LlmCredential;

final readonly class ResolvedAvatarLlmConfig
{
    public function __construct(
        public ?AvatarPersona $persona,
        public ?LlmCredential $credential,
        public ?string $provider,
        public ?string $model,
        public ?ChatModelPolicy $modelPolicy,
        public ?string $unavailableReason = null,
        public bool $usesFallbackPolicy = false,
    ) {
    }

    public function isAvailable(): bool
    {
        return $this->credential !== null
            && $this->provider !== null
            && $this->provider !== ''
            && $this->model !== null
            && $this->model !== '';
    }
}
