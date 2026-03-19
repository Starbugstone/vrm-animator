<?php

namespace App\Controller;

use App\Service\SharedAssetCatalog;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\HeaderUtils;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

class SharedAssetController extends AbstractController
{
    #[Route('/api/library/avatars', name: 'api_library_avatars', methods: ['GET'])]
    public function avatars(SharedAssetCatalog $sharedAssetCatalog): JsonResponse
    {
        return $this->json([
            'items' => $sharedAssetCatalog->listAvatars(),
        ]);
    }

    #[Route('/api/library/animations', name: 'api_library_animations', methods: ['GET'])]
    public function animations(SharedAssetCatalog $sharedAssetCatalog): JsonResponse
    {
        return $this->json([
            'items' => $sharedAssetCatalog->listAnimations(),
        ]);
    }

    #[Route('/api/library/shared-file', name: 'api_library_shared_file', methods: ['GET'])]
    public function download(Request $request, SharedAssetCatalog $sharedAssetCatalog): Response
    {
        $catalog = trim((string) $request->query->get('catalog', ''));
        $path = trim((string) $request->query->get('path', ''));

        if ($catalog === '' || $path === '') {
            return $this->json(['message' => 'catalog and path are required.'], Response::HTTP_BAD_REQUEST);
        }

        $resolved = $sharedAssetCatalog->resolveDownload($catalog, $path);
        if ($resolved === null) {
            throw $this->createNotFoundException();
        }

        $response = new BinaryFileResponse($resolved['absolutePath']);
        $response->headers->set('Content-Type', $resolved['mimeType']);
        $response->setContentDisposition(HeaderUtils::DISPOSITION_ATTACHMENT, $resolved['downloadName']);
        $response->headers->set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
        $response->headers->set('Pragma', 'no-cache');
        $response->headers->set('Expires', '0');

        return $response;
    }
}
