<?php

namespace App\Controller;

use App\Entity\Animation;
use App\Entity\Avatar;
use App\Entity\User;
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

class AnimationAssetController extends AbstractController
{
    private const MAX_ANIMATION_SIZE_BYTES = 50 * 1024 * 1024;
    private const ALLOWED_KINDS = ['action', 'idle', 'thinking', 'expression'];

    #[Route('/api/animations/upload', name: 'api_animation_upload', methods: ['POST'])]
    public function upload(
        Request $request,
        EntityManagerInterface $entityManager,
        UploadedAssetStorage $uploadedAssetStorage,
    ): JsonResponse {
        /** @var User $user */
        $user = $this->getUser();
        $file = $request->files->get('file');

        if (!$file instanceof UploadedFile) {
            return $this->json(['message' => 'Animation file is required.'], Response::HTTP_BAD_REQUEST);
        }

        if ($file->getSize() > self::MAX_ANIMATION_SIZE_BYTES) {
            return $this->json(['message' => 'Animation file is too large.'], Response::HTTP_BAD_REQUEST);
        }

        try {
            $storedAsset = $uploadedAssetStorage->storeUploadedFile('animation', $file, ['vrma'], $user->getId());
        } catch (\InvalidArgumentException $exception) {
            return $this->json(['message' => $exception->getMessage()], Response::HTTP_BAD_REQUEST);
        }

        $kind = strtolower(trim((string) $request->request->get('kind', 'action')));
        if (!in_array($kind, self::ALLOWED_KINDS, true)) {
            return $this->json(['message' => 'Invalid animation kind.'], Response::HTTP_BAD_REQUEST);
        }

        $avatar = null;
        $avatarId = $request->request->get('avatarId');
        if (is_scalar($avatarId) && $avatarId !== '') {
            /** @var Avatar|null $avatar */
            $avatar = $entityManager->getRepository(Avatar::class)->find((int) $avatarId);
            if ($avatar === null || $avatar->getOwner()?->getId() !== $user->getId()) {
                return $this->json(['message' => 'Avatar not found.'], Response::HTTP_NOT_FOUND);
            }
        }

        $keywords = array_values(array_filter(array_map(
            static fn (mixed $value): string => trim((string) $value),
            $request->request->all('keywords'),
        )));
        $emotionTags = array_values(array_filter(array_map(
            static fn (mixed $value): string => trim((string) $value),
            $request->request->all('emotionTags'),
        )));

        $name = trim((string) $request->request->get('name', pathinfo($storedAsset->originalFilename, PATHINFO_FILENAME)));

        $animation = (new Animation())
            ->setOwner($user)
            ->setAvatar($avatar)
            ->setName($name !== '' ? $name : 'Uploaded Animation')
            ->setFilename($storedAsset->originalFilename)
            ->setStoredFilename($storedAsset->storedFilename)
            ->setMimeType($storedAsset->mimeType)
            ->setSizeBytes($storedAsset->sizeBytes)
            ->setDescription($this->normalizeNullableString($request->request->get('description')))
            ->setKeywords($keywords)
            ->setEmotionTags($emotionTags)
            ->setKind($kind)
            ->setIsDefault(false);

        $entityManager->persist($animation);
        $entityManager->flush();

        return $this->json($animation, Response::HTTP_CREATED, [], ['groups' => ['animation:read']]);
    }

    #[Route('/api/animations/{id}/file', name: 'api_animation_file_download', methods: ['GET'])]
    public function download(int $id, EntityManagerInterface $entityManager, UploadedAssetStorage $uploadedAssetStorage): Response
    {
        /** @var User $user */
        $user = $this->getUser();
        /** @var Animation|null $animation */
        $animation = $entityManager->getRepository(Animation::class)->find($id);

        if ($animation === null || $animation->getOwner()?->getId() !== $user->getId()) {
            throw $this->createNotFoundException();
        }

        if ($animation->getStoredFilename() === null) {
            return $this->json(['message' => 'Animation file is not stored by the backend.'], Response::HTTP_NOT_FOUND);
        }

        $absolutePath = $uploadedAssetStorage->getAbsolutePath('animation', $animation->getStoredFilename(), $user->getId());
        if (!is_file($absolutePath)) {
            return $this->json(['message' => 'Animation file is missing.'], Response::HTTP_NOT_FOUND);
        }

        $response = new BinaryFileResponse($absolutePath);
        $response->headers->set('Content-Type', $animation->getMimeType() ?: 'application/octet-stream');
        $response->setContentDisposition(
            HeaderUtils::DISPOSITION_ATTACHMENT,
            $animation->getFilename() ?: 'animation.bin',
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
