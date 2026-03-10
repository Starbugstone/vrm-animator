<?php

namespace App\Controller;

use App\Entity\Avatar;
use App\Entity\User;
use App\Service\AvatarMemoryService;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

class AvatarMemoryController extends AbstractController
{
    #[Route('/api/avatars/{id}/memory', name: 'api_avatar_memory_show', methods: ['GET'])]
    public function show(int $id, EntityManagerInterface $entityManager, AvatarMemoryService $avatarMemoryService): JsonResponse
    {
        $avatar = $this->findOwnedAvatar($id, $entityManager);
        $memory = $avatarMemoryService->getOrCreateMemory($avatar);

        return $this->json($memory, Response::HTTP_OK, [], ['groups' => ['avatar-memory:read']]);
    }

    #[Route('/api/avatars/{id}/memory', name: 'api_avatar_memory_update', methods: ['PATCH'])]
    public function update(
        int $id,
        Request $request,
        EntityManagerInterface $entityManager,
        AvatarMemoryService $avatarMemoryService,
    ): JsonResponse {
        $avatar = $this->findOwnedAvatar($id, $entityManager);
        $payload = json_decode($request->getContent(), true);

        if (!is_array($payload)) {
            return $this->json(['message' => 'Invalid JSON.'], Response::HTTP_BAD_REQUEST);
        }

        $markdownContent = $payload['markdownContent'] ?? null;
        $revision = $payload['revision'] ?? null;

        if (!is_string($markdownContent) || !is_int($revision)) {
            return $this->json(
                ['message' => 'markdownContent and revision are required.'],
                Response::HTTP_BAD_REQUEST,
            );
        }

        try {
            $memory = $avatarMemoryService->updateMemory($avatar, $markdownContent, $revision, 'user');
        } catch (\RuntimeException $exception) {
            return $this->json(['message' => $exception->getMessage()], Response::HTTP_CONFLICT);
        }

        return $this->json($memory, Response::HTTP_OK, [], ['groups' => ['avatar-memory:read']]);
    }

    #[Route('/api/avatars/{id}/memory/revisions', name: 'api_avatar_memory_revisions', methods: ['GET'])]
    public function revisions(int $id, EntityManagerInterface $entityManager, AvatarMemoryService $avatarMemoryService): JsonResponse
    {
        $avatar = $this->findOwnedAvatar($id, $entityManager);
        $memory = $avatarMemoryService->getOrCreateMemory($avatar);

        return $this->json(
            $avatarMemoryService->listRevisions($memory),
            Response::HTTP_OK,
            [],
            ['groups' => ['avatar-memory-revision:read']],
        );
    }

    private function findOwnedAvatar(int $id, EntityManagerInterface $entityManager): Avatar
    {
        /** @var User $user */
        $user = $this->getUser();
        /** @var Avatar|null $avatar */
        $avatar = $entityManager->getRepository(Avatar::class)->find($id);

        if ($avatar === null || $avatar->getOwner()?->getId() !== $user->getId()) {
            throw $this->createNotFoundException();
        }

        return $avatar;
    }
}
