<?php

namespace App\Controller;

use App\Entity\User;
use App\Service\AuthResponseFactory;
use App\Service\GoogleIdentityVerifier;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;
use Symfony\Component\Routing\Attribute\Route;

class GoogleAuthController extends AbstractController
{
    #[Route('/api/auth/google', name: 'api_auth_google', methods: ['POST'])]
    public function authenticate(
        Request $request,
        EntityManagerInterface $entityManager,
        GoogleIdentityVerifier $googleIdentityVerifier,
        AuthResponseFactory $authResponseFactory,
        UserPasswordHasherInterface $passwordHasher,
    ): JsonResponse {
        $payload = json_decode($request->getContent(), true);
        $idToken = is_array($payload) ? trim((string) ($payload['idToken'] ?? '')) : '';

        if ($idToken === '') {
            return $this->json(['message' => 'Google idToken is required.'], Response::HTTP_BAD_REQUEST);
        }

        try {
            $identity = $googleIdentityVerifier->verifyIdToken($idToken);
        } catch (\RuntimeException $exception) {
            return $this->json(['message' => $exception->getMessage()], Response::HTTP_BAD_REQUEST);
        }

        if (!$identity->emailVerified) {
            return $this->json(['message' => 'Google account email is not verified.'], Response::HTTP_FORBIDDEN);
        }

        /** @var User|null $user */
        $user = $entityManager->getRepository(User::class)->findOneBy(['googleSubject' => $identity->subject]);

        if ($user === null) {
            /** @var User|null $existingUser */
            $existingUser = $entityManager->getRepository(User::class)->findOneBy(['email' => $identity->email]);
            $user = $existingUser ?? new User();

            $user->setEmail($identity->email);
            if ($user->getDisplayName() === null && $identity->displayName !== null && $identity->displayName !== '') {
                $user->setDisplayName($identity->displayName);
            }
            $user->setGoogleSubject($identity->subject);
            $user->setGoogleLinkedAt(new \DateTimeImmutable());

            if ($user->getPassword() === null) {
                $user->setPassword($passwordHasher->hashPassword($user, bin2hex(random_bytes(32))));
            }

            $entityManager->persist($user);
            $entityManager->flush();
        } elseif ($user->getGoogleLinkedAt() === null) {
            $user->setGoogleLinkedAt(new \DateTimeImmutable());
            $entityManager->flush();
        }

        return $this->json([
            'message' => 'Google sign-in successful.',
            ...$authResponseFactory->createResponseData($user),
        ]);
    }
}
