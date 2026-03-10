<?php

namespace App\Controller;

use App\Entity\Avatar;
use App\Entity\User;
use App\Service\AvatarMemoryService;
use App\Service\UploadedAssetStorage;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\File\UploadedFile;
use Symfony\Component\HttpFoundation\HeaderUtils;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

class AvatarAssetController extends AbstractController
{
    private const MAX_AVATAR_SIZE_BYTES = 100 * 1024 * 1024;

    #[Route('/api/avatars/upload', name: 'api_avatar_upload', methods: ['POST'])]
    public function upload(
        Request $request,
        EntityManagerInterface $entityManager,
        UploadedAssetStorage $uploadedAssetStorage,
        AvatarMemoryService $avatarMemoryService,
    ): JsonResponse {
        /** @var User $user */
        $user = $this->getUser();
        $file = $request->files->get('file');

        if (!$file instanceof UploadedFile) {
            return $this->json(['message' => 'Avatar file is required.'], Response::HTTP_BAD_REQUEST);
        }

        if ($file->getSize() > self::MAX_AVATAR_SIZE_BYTES) {
            return $this->json(['message' => 'Avatar file is too large.'], Response::HTTP_BAD_REQUEST);
        }

        try {
            $storedAsset = $uploadedAssetStorage->storeUploadedFile('avatar', $file, ['vrm', 'glb']);
        } catch (\InvalidArgumentException $exception) {
            return $this->json(['message' => $exception->getMessage()], Response::HTTP_BAD_REQUEST);
        }

        $name = trim((string) $request->request->get('name', pathinfo($storedAsset->originalFilename, PATHINFO_FILENAME)));

        $avatar = (new Avatar())
            ->setOwner($user)
            ->setName($name !== '' ? $name : 'Uploaded Avatar')
            ->setBackstory($this->normalizeNullableString($request->request->get('backstory')))
            ->setPersonality($this->normalizeNullableString($request->request->get('personality')))
            ->setSystemPrompt($this->normalizeNullableString($request->request->get('systemPrompt')))
            ->setFilename($storedAsset->originalFilename)
            ->setStoredFilename($storedAsset->storedFilename)
            ->setMimeType($storedAsset->mimeType)
            ->setSizeBytes($storedAsset->sizeBytes)
            ->setIsDefault(false);

        $entityManager->persist($avatar);
        $entityManager->flush();

        $avatarMemoryService->syncAvatarIdentity($avatar, 'system');

        return $this->json($avatar, Response::HTTP_CREATED, [], ['groups' => ['avatar:read']]);
    }

    #[Route('/api/avatars/{id}/file', name: 'api_avatar_file_download', methods: ['GET'])]
    public function download(int $id, EntityManagerInterface $entityManager, UploadedAssetStorage $uploadedAssetStorage): Response
    {
        /** @var User $user */
        $user = $this->getUser();
        /** @var Avatar|null $avatar */
        $avatar = $entityManager->getRepository(Avatar::class)->find($id);

        if ($avatar === null || $avatar->getOwner()?->getId() !== $user->getId()) {
            throw $this->createNotFoundException();
        }

        if ($avatar->getStoredFilename() === null) {
            return $this->json(['message' => 'Avatar file is not stored by the backend.'], Response::HTTP_NOT_FOUND);
        }

        $absolutePath = $uploadedAssetStorage->getAbsolutePath('avatar', $avatar->getStoredFilename());
        if (!is_file($absolutePath)) {
            return $this->json(['message' => 'Avatar file is missing.'], Response::HTTP_NOT_FOUND);
        }

        $response = new BinaryFileResponse($absolutePath);
        $response->headers->set('Content-Type', $avatar->getMimeType() ?: 'application/octet-stream');
        $response->setContentDisposition(
            HeaderUtils::DISPOSITION_ATTACHMENT,
            $avatar->getFilename() ?: 'avatar.bin',
        );

        return $response;
    }

    private function normalizeNullableString(mixed $value): ?string
    {
        if (!is_string($value)) {
            return null;
        }

        $trimmed = trim($value);
        return $trimmed !== '' ? $trimmed : null;
    }
}
