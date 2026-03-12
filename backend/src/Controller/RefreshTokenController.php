<?php

namespace App\Controller;

use App\Service\AuthResponseFactory;
use App\Service\RefreshTokenManager;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

class RefreshTokenController extends AbstractController
{
    #[Route('/api/token/refresh', name: 'api_token_refresh', methods: ['POST'])]
    public function refresh(
        Request $request,
        RefreshTokenManager $refreshTokenManager,
        AuthResponseFactory $authResponseFactory,
    ): JsonResponse {
        $payload = json_decode($request->getContent(), true);
        $refreshToken = is_array($payload) ? trim((string) ($payload['refreshToken'] ?? '')) : '';

        if ($refreshToken === '') {
            return $this->json(['message' => 'Refresh token is required.'], Response::HTTP_BAD_REQUEST);
        }

        $issuedRefreshToken = $refreshTokenManager->rotate($refreshToken);
        if ($issuedRefreshToken === null) {
            return $this->json(['message' => 'Refresh token is invalid or expired.'], Response::HTTP_UNAUTHORIZED);
        }

        return $this->json($authResponseFactory->createResponseData(
            $issuedRefreshToken->user,
            $issuedRefreshToken,
        ));
    }
}
