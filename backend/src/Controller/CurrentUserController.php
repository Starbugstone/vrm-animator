<?php

namespace App\Controller;

use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

class CurrentUserController extends AbstractController
{
    #[Route('/api/me', name: 'api_me_show', methods: ['GET'])]
    public function show(): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();

        return $this->json($this->serializeUser($user));
    }

    #[Route('/api/me', name: 'api_me_update', methods: ['PATCH'])]
    public function update(Request $request, EntityManagerInterface $entityManager): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();
        $payload = json_decode($request->getContent(), true);

        if (!is_array($payload)) {
            return $this->json(['message' => 'Invalid JSON.'], Response::HTTP_BAD_REQUEST);
        }

        if (array_key_exists('displayName', $payload)) {
            $displayName = is_string($payload['displayName']) ? trim($payload['displayName']) : '';
            $user->setDisplayName($displayName !== '' ? $displayName : null);
        }

        $entityManager->flush();

        return $this->json($this->serializeUser($user));
    }

    /**
     * @return array{id:int|null,email:string|null,displayName:string|null}
     */
    private function serializeUser(User $user): array
    {
        return [
            'id' => $user->getId(),
            'email' => $user->getEmail(),
            'displayName' => $user->getDisplayName(),
        ];
    }
}
