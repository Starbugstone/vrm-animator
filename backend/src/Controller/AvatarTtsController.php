<?php

namespace App\Controller;

use App\Entity\Avatar;
use App\Entity\TtsCredential;
use App\Entity\User;
use App\Repository\AvatarRepository;
use App\Repository\TtsCredentialRepository;
use App\Service\LlmCredentialCrypto;
use App\Service\Tts\ElevenLabsClientInterface;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Symfony\Component\Routing\Attribute\Route;

class AvatarTtsController extends AbstractController
{
    public function __construct(
        private readonly TtsCredentialRepository $credentialRepository,
    ) {
    }

    #[Route('/api/avatars/{id}/tts', name: 'api_avatar_tts_show', methods: ['GET'])]
    public function show(int $id, AvatarRepository $avatarRepository): JsonResponse
    {
        $avatar = $this->findOwnedAvatar($avatarRepository, $id);

        return $this->json($this->serializeAvatarTts($avatar));
    }

    #[Route('/api/avatars/{id}/tts', name: 'api_avatar_tts_update', methods: ['PATCH'])]
    public function update(
        int $id,
        Request $request,
        AvatarRepository $avatarRepository,
        ElevenLabsClientInterface $elevenLabsClient,
        LlmCredentialCrypto $credentialCrypto,
        EntityManagerInterface $entityManager,
    ): JsonResponse {
        $avatar = $this->findOwnedAvatar($avatarRepository, $id);
        $payload = json_decode($request->getContent(), true);

        if (!is_array($payload)) {
            return $this->json(['message' => 'Invalid JSON.'], Response::HTTP_BAD_REQUEST);
        }

        if (array_key_exists('presentationGender', $payload)) {
            try {
                $avatar->setPresentationGender($this->normalizeGender($payload['presentationGender']));
            } catch (\InvalidArgumentException $exception) {
                return $this->json(['message' => $exception->getMessage()], Response::HTTP_BAD_REQUEST);
            }
        }

        if (array_key_exists('speechVoiceGender', $payload)) {
            try {
                $avatar->setSpeechVoiceGender($this->normalizeGender($payload['speechVoiceGender']));
            } catch (\InvalidArgumentException $exception) {
                return $this->json(['message' => $exception->getMessage()], Response::HTTP_BAD_REQUEST);
            }
        }

        if (array_key_exists('speechLanguage', $payload)) {
            try {
                $avatar->setSpeechLanguage($this->normalizeLanguage($payload['speechLanguage']));
            } catch (\InvalidArgumentException $exception) {
                return $this->json(['message' => $exception->getMessage()], Response::HTTP_BAD_REQUEST);
            }
        }

        if (array_key_exists('speechMode', $payload)) {
            try {
                $avatar->setSpeechMode($this->normalizeSpeechMode($payload['speechMode']));
            } catch (\InvalidArgumentException $exception) {
                return $this->json(['message' => $exception->getMessage()], Response::HTTP_BAD_REQUEST);
            }
        }

        if (array_key_exists('ttsCredentialId', $payload) || array_key_exists('ttsVoiceId', $payload)) {
            try {
                $credential = $this->resolveOwnedCredential($this->credentialRepository, $payload['ttsCredentialId'] ?? $avatar->getTtsCredentialId());
            } catch (\InvalidArgumentException $exception) {
                return $this->json(['message' => $exception->getMessage()], Response::HTTP_BAD_REQUEST);
            }

            $voiceId = $this->normalizeNullableString($payload['ttsVoiceId'] ?? null);
            if ($credential === null || $voiceId === null) {
                $avatar
                    ->setTtsCredential($credential)
                    ->setTtsVoiceId(null)
                    ->setTtsVoiceName(null)
                    ->setTtsVoiceGenderTag(null);
            } else {
                try {
                    $voices = $elevenLabsClient->listVoices($credentialCrypto->decrypt($credential->getEncryptedSecret()));
                } catch (\RuntimeException $exception) {
                    return $this->json(['message' => $exception->getMessage()], Response::HTTP_BAD_GATEWAY);
                }

                $matchedVoice = $this->findVoiceById($voices, $voiceId);

                if (!is_array($matchedVoice)) {
                    return $this->json(['message' => 'Selected ElevenLabs voice was not found for this connection.'], Response::HTTP_BAD_REQUEST);
                }

                $avatar
                    ->setTtsCredential($credential)
                    ->setTtsVoiceId($voiceId)
                    ->setTtsVoiceName((string) ($matchedVoice['name'] ?? $voiceId))
                    ->setTtsVoiceGenderTag($this->normalizeGender($matchedVoice['gender'] ?? null));
            }
        }

        $entityManager->flush();

        return $this->json($this->serializeAvatarTts($avatar));
    }

    #[Route('/api/avatars/{id}/tts/stream', name: 'api_avatar_tts_stream', methods: ['POST'])]
    public function streamAudio(
        int $id,
        Request $request,
        AvatarRepository $avatarRepository,
        LlmCredentialCrypto $credentialCrypto,
        ElevenLabsClientInterface $elevenLabsClient,
    ): Response {
        $avatar = $this->findOwnedAvatar($avatarRepository, $id);
        $payload = json_decode($request->getContent(), true);

        if (!is_array($payload)) {
            return $this->json(['message' => 'Invalid JSON.'], Response::HTTP_BAD_REQUEST);
        }

        $text = trim((string) ($payload['text'] ?? ''));
        if ($text === '') {
            return $this->json(['message' => 'text is required.'], Response::HTTP_BAD_REQUEST);
        }

        $usesPreviewOverride = array_key_exists('ttsCredentialId', $payload) || array_key_exists('ttsVoiceId', $payload);

        if ($usesPreviewOverride) {
            try {
                $credential = $this->resolveOwnedCredential($this->credentialRepository, $payload['ttsCredentialId'] ?? $avatar->getTtsCredentialId());
            } catch (\InvalidArgumentException $exception) {
                return $this->json(['message' => $exception->getMessage()], Response::HTTP_BAD_REQUEST);
            }

            $voiceId = $this->normalizeNullableString($payload['ttsVoiceId'] ?? $avatar->getTtsVoiceId());
        } else {
            $credential = $avatar->getTtsCredential();
            $voiceId = $avatar->getTtsVoiceId();
        }

        if ($credential === null || $voiceId === null) {
            return $this->json(['message' => 'This avatar does not have ElevenLabs TTS configured.'], Response::HTTP_CONFLICT);
        }

        try {
            $secret = $credentialCrypto->decrypt($credential->getEncryptedSecret());
        } catch (\RuntimeException $exception) {
            return $this->json(['message' => $exception->getMessage()], Response::HTTP_CONFLICT);
        }

        if ($usesPreviewOverride) {
            try {
                $voices = $elevenLabsClient->listVoices($secret);
            } catch (\RuntimeException $exception) {
                return $this->json(['message' => $exception->getMessage()], Response::HTTP_BAD_GATEWAY);
            }

            if ($this->findVoiceById($voices, $voiceId) === null) {
                return $this->json(['message' => 'Selected ElevenLabs voice was not found for this connection.'], Response::HTTP_BAD_REQUEST);
            }
        }

        $response = new StreamedResponse(function () use ($elevenLabsClient, $secret, $voiceId, $credential, $text): void {
            $elevenLabsClient->streamSpeech(
                $secret,
                $voiceId,
                $text,
                $credential->getDefaultModel(),
                static function (string $chunk): void {
                    echo $chunk;
                    if (function_exists('flush')) {
                        flush();
                    }
                },
            );
        });

        $response->headers->set('Content-Type', 'audio/mpeg');
        $response->headers->set('Cache-Control', 'no-store, no-cache, must-revalidate');
        $response->headers->set('X-Accel-Buffering', 'no');

        return $response;
    }

    /**
     * @param array<int, array<string, mixed>> $voices
     *
     * @return array<string, mixed>|null
     */
    private function findVoiceById(array $voices, string $voiceId): ?array
    {
        foreach ($voices as $voice) {
            if (($voice['id'] ?? null) === $voiceId) {
                return $voice;
            }
        }

        return null;
    }

    private function findOwnedAvatar(AvatarRepository $avatarRepository, int $id): Avatar
    {
        $avatar = $avatarRepository->find($id);
        if ($avatar === null || $avatar->getOwner()?->getId() !== $this->getCurrentUser()->getId()) {
            throw $this->createNotFoundException();
        }

        return $avatar;
    }

    private function resolveOwnedCredential(TtsCredentialRepository $credentialRepository, mixed $credentialId): ?TtsCredential
    {
        if ($credentialId === null || $credentialId === '') {
            return null;
        }

        if (!is_int($credentialId)) {
            throw new \InvalidArgumentException('ttsCredentialId must be an integer or null.');
        }

        $credential = $credentialRepository->findOwnedCredential($this->getCurrentUser(), $credentialId);
        if ($credential === null) {
            throw new \InvalidArgumentException('TTS credential not found.');
        }

        return $credential;
    }

    private function normalizeNullableString(mixed $value): ?string
    {
        if (!is_string($value)) {
            return null;
        }

        $trimmed = trim($value);

        return $trimmed !== '' ? $trimmed : null;
    }

    private function normalizeGender(mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        if (!is_string($value)) {
            throw new \InvalidArgumentException('gender must be a string or null.');
        }

        $normalized = strtolower(trim($value));
        if (!in_array($normalized, ['female', 'male'], true)) {
            throw new \InvalidArgumentException('gender must be male, female, or null.');
        }

        return $normalized;
    }

    private function normalizeSpeechMode(mixed $value): string
    {
        if (!is_string($value)) {
            throw new \InvalidArgumentException('speechMode must be a string.');
        }

        $normalized = strtolower(trim($value));
        if (!in_array($normalized, ['auto', 'none'], true)) {
            throw new \InvalidArgumentException('speechMode must be auto or none.');
        }

        return $normalized;
    }

    private function normalizeLanguage(mixed $value): string
    {
        if (!is_string($value)) {
            throw new \InvalidArgumentException('speechLanguage must be a string.');
        }

        $normalized = trim($value);
        if ($normalized === '') {
            throw new \InvalidArgumentException('speechLanguage cannot be empty.');
        }

        return $normalized;
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeAvatarTts(Avatar $avatar): array
    {
        return [
            'avatarId' => $avatar->getId(),
            'presentationGender' => $avatar->getPresentationGender(),
            'speechVoiceGender' => $avatar->getSpeechVoiceGender(),
            'speechLanguage' => $avatar->getSpeechLanguage(),
            'speechMode' => $avatar->getSpeechMode(),
            'ttsProvider' => $avatar->getTtsProvider(),
            'ttsCredentialId' => $avatar->getTtsCredentialId(),
            'ttsVoiceId' => $avatar->getTtsVoiceId(),
            'ttsVoiceName' => $avatar->getTtsVoiceName(),
            'ttsVoiceGenderTag' => $avatar->getTtsVoiceGenderTag(),
            'usesBrowserFallback' => $avatar->getSpeechMode() !== 'none'
                && ($avatar->getTtsCredentialId() === null || $avatar->getTtsVoiceId() === null),
        ];
    }

    private function getCurrentUser(): User
    {
        /** @var User $user */
        $user = $this->getUser();

        return $user;
    }
}
