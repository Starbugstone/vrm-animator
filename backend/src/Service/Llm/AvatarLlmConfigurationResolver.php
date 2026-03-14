<?php

namespace App\Service\Llm;

use App\Entity\Avatar;
use App\Entity\User;
use App\Repository\AvatarPersonaRepository;
use App\Service\LlmProviderCatalog;

final class AvatarLlmConfigurationResolver
{
    public function __construct(
        private AvatarPersonaRepository $avatarPersonaRepository,
        private LlmProviderCatalog $providerCatalog,
        private ChatModelPolicyResolver $chatModelPolicyResolver,
    ) {
    }

    public function resolve(User $user, Avatar $avatar): ResolvedAvatarLlmConfig
    {
        $personas = $this->avatarPersonaRepository->findAllOwnedByAvatar($user, $avatar);
        $persona = $personas[0] ?? null;
        if ($persona === null) {
            return new ResolvedAvatarLlmConfig(
                null,
                null,
                null,
                null,
                $this->fallbackPolicy(),
                'Set a primary persona and AI connection for this avatar first.',
                true,
            );
        }

        $credential = $persona->getLlmCredential();
        if ($credential === null) {
            return new ResolvedAvatarLlmConfig(
                $persona,
                null,
                null,
                null,
                $this->fallbackPolicy(),
                'This avatar does not have an AI connection yet.',
                true,
            );
        }

        if (!$credential->isActive()) {
            return new ResolvedAvatarLlmConfig(
                $persona,
                $credential,
                $credential->getProvider(),
                null,
                $this->fallbackPolicy(),
                'The configured AI connection is inactive.',
                true,
            );
        }

        $provider = strtolower(trim($credential->getProvider()));
        if ($provider === '' || !$this->providerCatalog->isSupported($provider)) {
            return new ResolvedAvatarLlmConfig(
                $persona,
                $credential,
                $provider !== '' ? $provider : null,
                null,
                $this->fallbackPolicy(),
                'The configured AI provider is not supported by this backend.',
                true,
            );
        }

        $model = $this->resolveModel($provider, $credential->getDefaultModel());
        if ($model === null) {
            return new ResolvedAvatarLlmConfig(
                $persona,
                $credential,
                $provider,
                null,
                $this->fallbackPolicy(),
                'Choose a default model for this avatar before compressing memory.',
                true,
            );
        }

        try {
            $policy = $this->chatModelPolicyResolver->resolve($provider, $model);

            return new ResolvedAvatarLlmConfig($persona, $credential, $provider, $model, $policy);
        } catch (\Throwable) {
            return new ResolvedAvatarLlmConfig(
                $persona,
                $credential,
                $provider,
                $model,
                $this->fallbackPolicy(),
                null,
                true,
            );
        }
    }

    public function fallbackPolicy(): ChatModelPolicy
    {
        return new ChatModelPolicy(131072, 1100, 5, 5, 1400, 260, 650);
    }

    private function resolveModel(string $provider, ?string $defaultModel): ?string
    {
        $normalized = is_string($defaultModel) ? trim($defaultModel) : '';
        if ($normalized !== '') {
            return $normalized;
        }

        $metadata = $this->providerCatalog->findProvider($provider);
        $recommended = $metadata['recommendedModels'][0] ?? null;

        return is_string($recommended) && trim($recommended) !== '' ? trim($recommended) : null;
    }
}
