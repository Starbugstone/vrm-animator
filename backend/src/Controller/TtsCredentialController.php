<?php

namespace App\Controller;

use App\Entity\TtsCredential;
use App\Entity\User;
use App\Repository\TtsCredentialRepository;
use App\Service\LlmCredentialCrypto;
use App\Service\Tts\ElevenLabsClientInterface;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

class TtsCredentialController extends AbstractController
{
    private const DEFAULT_MODEL = 'eleven_flash_v2_5';

    #[Route('/api/tts/providers', name: 'api_tts_providers', methods: ['GET'])]
    public function providers(): JsonResponse
    {
        return $this->json([
            'providers' => [
                [
                    'id' => 'elevenlabs',
                    'label' => 'ElevenLabs',
                    'defaultModel' => self::DEFAULT_MODEL,
                    'models' => [
                        ['id' => 'eleven_flash_v2_5', 'label' => 'Flash v2.5', 'hint' => 'Lowest-latency streaming default.'],
                        ['id' => 'eleven_turbo_v2_5', 'label' => 'Turbo v2.5', 'hint' => 'Balanced speed and quality.'],
                        ['id' => 'eleven_multilingual_v2', 'label' => 'Multilingual v2', 'hint' => 'Best fallback when language coverage matters most.'],
                    ],
                ],
            ],
        ]);
    }

    #[Route('/api/tts/credentials', name: 'api_tts_credentials_list', methods: ['GET'])]
    public function list(
        TtsCredentialRepository $credentialRepository,
        LlmCredentialCrypto $credentialCrypto,
    ): JsonResponse {
        return $this->json([
            'credentials' => array_map(
                fn (TtsCredential $credential): array => $this->serializeCredential($credential, $credentialCrypto),
                $credentialRepository->findAllOwnedBy($this->getCurrentUser()),
            ),
        ]);
    }

    #[Route('/api/tts/credentials', name: 'api_tts_credentials_create', methods: ['POST'])]
    public function create(
        Request $request,
        EntityManagerInterface $entityManager,
        LlmCredentialCrypto $credentialCrypto,
    ): JsonResponse {
        $payload = json_decode($request->getContent(), true);
        if (!is_array($payload)) {
            return $this->json(['message' => 'Invalid JSON.'], Response::HTTP_BAD_REQUEST);
        }

        $name = trim((string) ($payload['name'] ?? ''));
        $secret = trim((string) ($payload['secret'] ?? ''));
        $defaultModel = $this->normalizeNullableString($payload['defaultModel'] ?? null) ?: self::DEFAULT_MODEL;
        $isActive = array_key_exists('isActive', $payload) ? filter_var($payload['isActive'], FILTER_VALIDATE_BOOL, FILTER_NULL_ON_FAILURE) : true;

        if ($name === '' || $secret === '' || !is_bool($isActive)) {
            return $this->json(
                ['message' => 'name, secret, and a valid isActive value are required.'],
                Response::HTTP_BAD_REQUEST,
            );
        }

        $credential = (new TtsCredential())
            ->setOwner($this->getCurrentUser())
            ->setName($name)
            ->setEncryptedSecret($credentialCrypto->encrypt($secret))
            ->setDefaultModel($defaultModel)
            ->setIsActive($isActive);

        $entityManager->persist($credential);
        $entityManager->flush();

        return $this->json(
            $this->serializeCredential($credential, $credentialCrypto),
            Response::HTTP_CREATED,
        );
    }

    #[Route('/api/tts/credentials/{id}', name: 'api_tts_credentials_update', methods: ['PATCH'])]
    public function update(
        int $id,
        Request $request,
        TtsCredentialRepository $credentialRepository,
        EntityManagerInterface $entityManager,
        LlmCredentialCrypto $credentialCrypto,
    ): JsonResponse {
        $credential = $credentialRepository->findOwnedCredential($this->getCurrentUser(), $id);
        if ($credential === null) {
            throw $this->createNotFoundException();
        }

        $payload = json_decode($request->getContent(), true);
        if (!is_array($payload)) {
            return $this->json(['message' => 'Invalid JSON.'], Response::HTTP_BAD_REQUEST);
        }

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

        if (array_key_exists('defaultModel', $payload)) {
            $credential->setDefaultModel($this->normalizeNullableString($payload['defaultModel']) ?: self::DEFAULT_MODEL);
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

    #[Route('/api/tts/credentials/{id}', name: 'api_tts_credentials_delete', methods: ['DELETE'])]
    public function delete(
        int $id,
        TtsCredentialRepository $credentialRepository,
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

    #[Route('/api/tts/credentials/{id}/voices', name: 'api_tts_credential_voices', methods: ['GET'])]
    public function voices(
        int $id,
        TtsCredentialRepository $credentialRepository,
        LlmCredentialCrypto $credentialCrypto,
        ElevenLabsClientInterface $elevenLabsClient,
    ): JsonResponse {
        $credential = $credentialRepository->findOwnedCredential($this->getCurrentUser(), $id);
        if ($credential === null) {
            throw $this->createNotFoundException();
        }

        try {
            $voices = $elevenLabsClient->listVoices($credentialCrypto->decrypt($credential->getEncryptedSecret()));
        } catch (\RuntimeException $exception) {
            return $this->json(['message' => $exception->getMessage()], Response::HTTP_BAD_GATEWAY);
        }

        return $this->json([
            'voices' => $voices,
        ]);
    }

    /**
     * @return array{
     *   id:int|null,
     *   provider:string,
     *   name:string,
     *   maskedSecret:string,
     *   hasSecret:bool,
     *   secretReadable:bool,
     *   secretWarning:?string,
     *   defaultModel:?string,
     *   isActive:bool,
     *   createdAt:string,
     *   updatedAt:string
     * }
     */
    private function serializeCredential(TtsCredential $credential, LlmCredentialCrypto $credentialCrypto): array
    {
        $hasSecret = $credential->getEncryptedSecret() !== '';
        $secretReadable = $hasSecret ? $credentialCrypto->canDecrypt($credential->getEncryptedSecret()) : false;

        return [
            'id' => $credential->getId(),
            'provider' => 'elevenlabs',
            'name' => $credential->getName(),
            'maskedSecret' => $hasSecret ? $credentialCrypto->tryMask($credential->getEncryptedSecret()) : '',
            'hasSecret' => $hasSecret,
            'secretReadable' => $secretReadable,
            'secretWarning' => $hasSecret && !$secretReadable
                ? 'This saved API key was encrypted with a different backend encryption key and must be entered again before it can be used.'
                : null,
            'defaultModel' => $credential->getDefaultModel(),
            'isActive' => $credential->isActive(),
            'createdAt' => $credential->getCreatedAt()?->format(DATE_ATOM) ?? '',
            'updatedAt' => $credential->getUpdatedAt()?->format(DATE_ATOM) ?? '',
        ];
    }

    private function normalizeNullableString(mixed $value): ?string
    {
        if (!is_string($value)) {
            return null;
        }

        $trimmed = trim($value);

        return $trimmed !== '' ? $trimmed : null;
    }

    private function getCurrentUser(): User
    {
        /** @var User $user */
        $user = $this->getUser();

        return $user;
    }
}
