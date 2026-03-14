<?php

namespace App\Controller;

use App\Entity\LlmCredential;
use App\Entity\User;
use App\Repository\LlmCredentialRepository;
use App\Service\LlmCredentialCrypto;
use App\Service\LlmProviderCatalog;
use App\Service\Llm\OpenRouterModelCatalog;
use App\Service\Llm\StaticProviderModelCatalog;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

class LlmCredentialController extends AbstractController
{
    #[Route('/api/llm/providers', name: 'api_llm_providers', methods: ['GET'])]
    public function providers(LlmProviderCatalog $providerCatalog): JsonResponse
    {
        return $this->json([
            'providers' => $providerCatalog->listProviders(),
        ]);
    }

    #[Route('/api/llm/providers/openrouter/models', name: 'api_llm_openrouter_models', methods: ['GET'])]
    public function openRouterModels(Request $request, OpenRouterModelCatalog $openRouterModelCatalog): JsonResponse
    {
        return $this->buildOpenRouterModelResponse($request, $openRouterModelCatalog);
    }

    #[Route('/api/llm/providers/{provider}/models', name: 'api_llm_provider_models', methods: ['GET'])]
    public function providerModels(
        string $provider,
        Request $request,
        LlmProviderCatalog $providerCatalog,
        OpenRouterModelCatalog $openRouterModelCatalog,
        StaticProviderModelCatalog $staticProviderModelCatalog,
    ): JsonResponse {
        $provider = strtolower(trim($provider));

        try {
            $providerCatalog->assertSupported($provider);
        } catch (\InvalidArgumentException $exception) {
            return $this->json(['message' => $exception->getMessage()], Response::HTTP_BAD_REQUEST);
        }

        if ($provider === 'openrouter') {
            return $this->buildOpenRouterModelResponse($request, $openRouterModelCatalog);
        }

        return $this->json([
            'models' => $staticProviderModelCatalog->listModels(
                $provider,
                is_string($request->query->get('search')) ? $request->query->get('search') : null,
            ),
        ]);
    }

    private function buildOpenRouterModelResponse(Request $request, OpenRouterModelCatalog $openRouterModelCatalog): JsonResponse
    {
        $billing = strtolower(trim((string) $request->query->get('billing', 'free')));
        if (!in_array($billing, ['all', 'free', 'paid'], true)) {
            return $this->json(['message' => 'billing must be one of all, free, or paid.'], Response::HTTP_BAD_REQUEST);
        }

        try {
            $models = $openRouterModelCatalog->listModels(
                is_string($request->query->get('search')) ? $request->query->get('search') : null,
                $billing,
            );
        } catch (\RuntimeException $exception) {
            return $this->json(['message' => $exception->getMessage()], Response::HTTP_BAD_GATEWAY);
        }

        return $this->json([
            'models' => $models,
        ]);
    }

    #[Route('/api/llm/credentials', name: 'api_llm_credentials_list', methods: ['GET'])]
    public function list(
        LlmCredentialRepository $credentialRepository,
        LlmCredentialCrypto $credentialCrypto,
    ): JsonResponse {
        return $this->json([
            'credentials' => array_map(
                fn (LlmCredential $credential): array => $this->serializeCredential($credential, $credentialCrypto),
                $credentialRepository->findAllOwnedBy($this->getCurrentUser()),
            ),
        ]);
    }

    #[Route('/api/llm/credentials', name: 'api_llm_credentials_create', methods: ['POST'])]
    public function create(
        Request $request,
        EntityManagerInterface $entityManager,
        LlmProviderCatalog $providerCatalog,
        LlmCredentialCrypto $credentialCrypto,
    ): JsonResponse {
        $payload = json_decode($request->getContent(), true);
        if (!is_array($payload)) {
            return $this->json(['message' => 'Invalid JSON.'], Response::HTTP_BAD_REQUEST);
        }

        $provider = strtolower(trim((string) ($payload['provider'] ?? '')));
        $name = trim((string) ($payload['name'] ?? ''));
        $secret = trim((string) ($payload['secret'] ?? ''));
        $defaultModel = $this->normalizeNullableString($payload['defaultModel'] ?? null);
        $providerOptions = $this->normalizeProviderOptions($provider, $payload['providerOptions'] ?? null);
        $isActive = array_key_exists('isActive', $payload) ? filter_var($payload['isActive'], FILTER_VALIDATE_BOOL, FILTER_NULL_ON_FAILURE) : true;

        if ($provider === '' || $name === '' || $secret === '' || !is_bool($isActive)) {
            return $this->json(
                ['message' => 'name, provider, secret, and a valid isActive value are required.'],
                Response::HTTP_BAD_REQUEST,
            );
        }

        try {
            $providerCatalog->assertSupported($provider);
        } catch (\InvalidArgumentException $exception) {
            return $this->json(['message' => $exception->getMessage()], Response::HTTP_BAD_REQUEST);
        }

        $credential = (new LlmCredential())
            ->setOwner($this->getCurrentUser())
            ->setName($name)
            ->setProvider($provider)
            ->setEncryptedSecret($credentialCrypto->encrypt($secret))
            ->setDefaultModel($defaultModel)
            ->setProviderOptions($providerOptions)
            ->setIsActive($isActive);

        $entityManager->persist($credential);
        $entityManager->flush();

        return $this->json(
            $this->serializeCredential($credential, $credentialCrypto),
            Response::HTTP_CREATED,
        );
    }

    #[Route('/api/llm/credentials/{id}', name: 'api_llm_credentials_update', methods: ['PATCH'])]
    public function update(
        int $id,
        Request $request,
        LlmCredentialRepository $credentialRepository,
        EntityManagerInterface $entityManager,
        LlmCredentialCrypto $credentialCrypto,
        LlmProviderCatalog $providerCatalog,
    ): JsonResponse {
        $credential = $credentialRepository->findOwnedCredential($this->getCurrentUser(), $id);
        if ($credential === null) {
            throw $this->createNotFoundException();
        }

        $payload = json_decode($request->getContent(), true);
        if (!is_array($payload)) {
            return $this->json(['message' => 'Invalid JSON.'], Response::HTTP_BAD_REQUEST);
        }

        $currentProvider = $credential->getProvider();
        $nextProvider = $currentProvider;

        if (array_key_exists('secret', $payload)) {
            $secret = trim((string) $payload['secret']);
            if ($secret === '') {
                return $this->json(['message' => 'secret cannot be empty.'], Response::HTTP_BAD_REQUEST);
            }

            $credential->setEncryptedSecret($credentialCrypto->encrypt($secret));
        }

        if (array_key_exists('name', $payload)) {
            $name = trim((string) $payload['name']);
            if ($name === '') {
                return $this->json(['message' => 'name cannot be empty.'], Response::HTTP_BAD_REQUEST);
            }

            $credential->setName($name);
        }

        if (array_key_exists('provider', $payload)) {
            $provider = strtolower(trim((string) $payload['provider']));
            if ($provider === '') {
                return $this->json(['message' => 'provider cannot be empty.'], Response::HTTP_BAD_REQUEST);
            }

            try {
                $providerCatalog->assertSupported($provider);
            } catch (\InvalidArgumentException $exception) {
                return $this->json(['message' => $exception->getMessage()], Response::HTTP_BAD_REQUEST);
            }

            $nextProvider = $provider;
        }

        if ($nextProvider !== $currentProvider && !array_key_exists('secret', $payload)) {
            return $this->json(
                ['message' => 'A new API key is required when changing provider.'],
                Response::HTTP_BAD_REQUEST,
            );
        }

        if ($nextProvider !== $currentProvider) {
            $credential->setProvider($nextProvider);
        }

        if (array_key_exists('provider', $payload) || array_key_exists('providerOptions', $payload)) {
            $credential->setProviderOptions(
                $this->normalizeProviderOptions($nextProvider, $payload['providerOptions'] ?? $credential->getProviderOptions()),
            );
        }

        if (array_key_exists('defaultModel', $payload)) {
            $credential->setDefaultModel($this->normalizeNullableString($payload['defaultModel']));
        }

        if (array_key_exists('isActive', $payload)) {
            $isActive = filter_var($payload['isActive'], FILTER_VALIDATE_BOOL, FILTER_NULL_ON_FAILURE);
            if (!is_bool($isActive)) {
                return $this->json(['message' => 'isActive must be a boolean.'], Response::HTTP_BAD_REQUEST);
            }

            $credential->setIsActive($isActive);
        }

        $entityManager->flush();

        return $this->json($this->serializeCredential($credential, $credentialCrypto));
    }

    #[Route('/api/llm/credentials/{id}', name: 'api_llm_credentials_delete', methods: ['DELETE'])]
    public function delete(
        int $id,
        LlmCredentialRepository $credentialRepository,
        EntityManagerInterface $entityManager,
    ): Response {
        $credential = $credentialRepository->findOwnedCredential($this->getCurrentUser(), $id);
        if ($credential === null) {
            throw $this->createNotFoundException();
        }

        $entityManager->remove($credential);
        $entityManager->flush();

        return new Response(null, Response::HTTP_NO_CONTENT);
    }

    /**
     * @return array{
     *   id:int|null,
     *   name:string,
     *   provider:string,
     *   maskedSecret:string,
     *   hasSecret:bool,
     *   secretReadable:bool,
     *   secretWarning:?string,
     *   defaultModel:?string,
     *   providerOptions:array<string, mixed>,
     *   isActive:bool,
     *   createdAt:string,
     *   updatedAt:string
     * }
     */
    private function serializeCredential(LlmCredential $credential, LlmCredentialCrypto $credentialCrypto): array
    {
        $hasSecret = $credential->getEncryptedSecret() !== '';
        $secretReadable = $hasSecret ? $credentialCrypto->canDecrypt($credential->getEncryptedSecret()) : false;

        return [
            'id' => $credential->getId(),
            'name' => $credential->getName(),
            'provider' => $credential->getProvider(),
            'maskedSecret' => $hasSecret
                ? $credentialCrypto->tryMask($credential->getEncryptedSecret())
                : '',
            'hasSecret' => $hasSecret,
            'secretReadable' => $secretReadable,
            'secretWarning' => $hasSecret && !$secretReadable
                ? 'This saved API key was encrypted with a different backend encryption key and must be entered again before it can be used.'
                : null,
            'defaultModel' => $credential->getDefaultModel(),
            'providerOptions' => $credential->getProviderOptions(),
            'isActive' => $credential->isActive(),
            'createdAt' => $credential->getCreatedAt()?->format(DATE_ATOM) ?? '',
            'updatedAt' => $credential->getUpdatedAt()?->format(DATE_ATOM) ?? '',
        ];
    }

    private function getCurrentUser(): User
    {
        /** @var User $user */
        $user = $this->getUser();

        return $user;
    }

    private function normalizeNullableString(mixed $value): ?string
    {
        if (!is_string($value)) {
            return null;
        }

        $trimmed = trim($value);

        return $trimmed !== '' ? $trimmed : null;
    }

    /**
     * @return array<string, mixed>
     */
    private function normalizeProviderOptions(string $provider, mixed $value): array
    {
        if ($provider !== 'glm') {
            return [];
        }

        $options = is_array($value) ? $value : [];
        $endpointMode = strtolower(trim((string) ($options['endpointMode'] ?? 'standard')));
        if (!in_array($endpointMode, ['standard', 'coding'], true)) {
            $endpointMode = 'standard';
        }

        return [
            'endpointMode' => $endpointMode,
        ];
    }
}
