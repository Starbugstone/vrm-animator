<?php

namespace App\Controller;

use App\Entity\Avatar;
use App\Entity\AvatarPersona;
use App\Entity\LlmCredential;
use App\Entity\User;
use App\Repository\AvatarPersonaRepository;
use App\Repository\LlmCredentialRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

class AvatarPersonaController extends AbstractController
{
    #[Route('/api/avatars/{id}/personas', name: 'api_avatar_personas_list', methods: ['GET'])]
    public function list(int $id, EntityManagerInterface $entityManager, AvatarPersonaRepository $avatarPersonaRepository): JsonResponse
    {
        $avatar = $this->findOwnedAvatar($id, $entityManager);

        return $this->json([
            'personas' => array_map(
                fn (AvatarPersona $persona): array => $this->serializePersona($persona),
                $avatarPersonaRepository->findAllOwnedByAvatar($this->getCurrentUser(), $avatar),
            ),
        ]);
    }

    #[Route('/api/avatars/{id}/personas', name: 'api_avatar_personas_create', methods: ['POST'])]
    public function create(
        int $id,
        Request $request,
        EntityManagerInterface $entityManager,
        LlmCredentialRepository $llmCredentialRepository,
        AvatarPersonaRepository $avatarPersonaRepository,
    ): JsonResponse {
        $avatar = $this->findOwnedAvatar($id, $entityManager);
        $payload = json_decode($request->getContent(), true);

        if (!is_array($payload)) {
            return $this->json(['message' => 'Invalid JSON.'], Response::HTTP_BAD_REQUEST);
        }

        $name = trim((string) ($payload['name'] ?? ''));
        if ($name === '') {
            return $this->json(['message' => 'name is required.'], Response::HTTP_BAD_REQUEST);
        }

        $persona = (new AvatarPersona())
            ->setOwner($this->getCurrentUser())
            ->setAvatar($avatar)
            ->setName($name)
            ->setDescription($this->normalizeNullableString($payload['description'] ?? null))
            ->setPersonality($this->normalizeNullableString($payload['personality'] ?? null))
            ->setIsPrimary((bool) ($payload['isPrimary'] ?? false));

        try {
            $credential = $this->resolveOwnedCredential($llmCredentialRepository, $payload['llmCredentialId'] ?? null);
        } catch (\InvalidArgumentException $exception) {
            return $this->json(['message' => $exception->getMessage()], Response::HTTP_BAD_REQUEST);
        }
        $persona->setLlmCredential($credential);

        if ($persona->isPrimary()) {
            $this->clearPrimaryPersona($avatarPersonaRepository, $avatar);
        }

        $entityManager->persist($persona);
        $entityManager->flush();

        return $this->json($this->serializePersona($persona), Response::HTTP_CREATED);
    }

    #[Route('/api/avatar-personas/{id}', name: 'api_avatar_personas_update', methods: ['PATCH'])]
    public function update(
        int $id,
        Request $request,
        AvatarPersonaRepository $avatarPersonaRepository,
        LlmCredentialRepository $llmCredentialRepository,
        EntityManagerInterface $entityManager,
    ): JsonResponse {
        $persona = $avatarPersonaRepository->findOwnedPersona($this->getCurrentUser(), $id);
        if ($persona === null) {
            throw $this->createNotFoundException();
        }

        $payload = json_decode($request->getContent(), true);
        if (!is_array($payload)) {
            return $this->json(['message' => 'Invalid JSON.'], Response::HTTP_BAD_REQUEST);
        }

        if (array_key_exists('name', $payload)) {
            $name = trim((string) $payload['name']);
            if ($name === '') {
                return $this->json(['message' => 'name cannot be empty.'], Response::HTTP_BAD_REQUEST);
            }
            $persona->setName($name);
        }

        if (array_key_exists('description', $payload)) {
            $persona->setDescription($this->normalizeNullableString($payload['description']));
        }
        if (array_key_exists('personality', $payload)) {
            $persona->setPersonality($this->normalizeNullableString($payload['personality']));
        }
        if (array_key_exists('llmCredentialId', $payload)) {
            try {
                $persona->setLlmCredential($this->resolveOwnedCredential($llmCredentialRepository, $payload['llmCredentialId']));
            } catch (\InvalidArgumentException $exception) {
                return $this->json(['message' => $exception->getMessage()], Response::HTTP_BAD_REQUEST);
            }
        }
        if (array_key_exists('isPrimary', $payload)) {
            $isPrimary = filter_var($payload['isPrimary'], FILTER_VALIDATE_BOOL, FILTER_NULL_ON_FAILURE);
            if (!is_bool($isPrimary)) {
                return $this->json(['message' => 'isPrimary must be a boolean.'], Response::HTTP_BAD_REQUEST);
            }
            if ($isPrimary) {
                $this->clearPrimaryPersona($avatarPersonaRepository, $persona->getAvatar());
            }
            $persona->setIsPrimary($isPrimary);
        }

        $entityManager->flush();

        return $this->json($this->serializePersona($persona));
    }

    #[Route('/api/avatar-personas/{id}', name: 'api_avatar_personas_delete', methods: ['DELETE'])]
    public function delete(int $id, AvatarPersonaRepository $avatarPersonaRepository, EntityManagerInterface $entityManager): Response
    {
        $persona = $avatarPersonaRepository->findOwnedPersona($this->getCurrentUser(), $id);
        if ($persona === null) {
            throw $this->createNotFoundException();
        }

        $entityManager->remove($persona);
        $entityManager->flush();

        return new Response(null, Response::HTTP_NO_CONTENT);
    }

    private function clearPrimaryPersona(AvatarPersonaRepository $avatarPersonaRepository, ?Avatar $avatar): void
    {
        if ($avatar === null) {
            return;
        }

        foreach ($avatarPersonaRepository->findAllOwnedByAvatar($this->getCurrentUser(), $avatar) as $existingPersona) {
            $existingPersona->setIsPrimary(false);
        }
    }

    private function resolveOwnedCredential(LlmCredentialRepository $llmCredentialRepository, mixed $credentialId): ?LlmCredential
    {
        if ($credentialId === null || $credentialId === '') {
            return null;
        }

        if (!is_int($credentialId)) {
            throw new \InvalidArgumentException('llmCredentialId must be an integer or null.');
        }

        $credential = $llmCredentialRepository->findOwnedCredential($this->getCurrentUser(), $credentialId);
        if ($credential === null) {
            throw new \InvalidArgumentException('LLM credential not found.');
        }

        return $credential;
    }

    private function findOwnedAvatar(int $id, EntityManagerInterface $entityManager): Avatar
    {
        /** @var Avatar|null $avatar */
        $avatar = $entityManager->getRepository(Avatar::class)->find($id);
        if ($avatar === null || $avatar->getOwner()?->getId() !== $this->getCurrentUser()->getId()) {
            throw $this->createNotFoundException();
        }

        return $avatar;
    }

    /**
     * @return array{
     *   id:int|null,
     *   avatarId:int|null,
     *   name:string,
     *   description:?string,
     *   personality:?string,
     *   llmCredentialId:?int,
     *   llmProvider:?string,
     *   isPrimary:bool,
     *   createdAt:string,
     *   updatedAt:string
     * }
     */
    private function serializePersona(AvatarPersona $persona): array
    {
        return [
            'id' => $persona->getId(),
            'avatarId' => $persona->getAvatar()?->getId(),
            'name' => $persona->getName(),
            'description' => $persona->getDescription(),
            'personality' => $persona->getPersonality(),
            'llmCredentialId' => $persona->getLlmCredential()?->getId(),
            'llmProvider' => $persona->getLlmCredential()?->getProvider(),
            'isPrimary' => $persona->isPrimary(),
            'createdAt' => $persona->getCreatedAt()?->format(DATE_ATOM) ?? '',
            'updatedAt' => $persona->getUpdatedAt()?->format(DATE_ATOM) ?? '',
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
