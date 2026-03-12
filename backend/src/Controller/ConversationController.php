<?php

namespace App\Controller;

use App\Entity\Avatar;
use App\Entity\Conversation;
use App\Entity\ConversationMessage;
use App\Entity\User;
use App\Repository\ConversationMessageRepository;
use App\Repository\ConversationRepository;
use App\Service\Llm\AvatarChatException;
use App\Service\Llm\AvatarChatService;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

class ConversationController extends AbstractController
{
    #[Route('/api/avatars/{id}/conversations', name: 'api_avatar_conversations_list', methods: ['GET'])]
    public function listAvatarConversations(
        int $id,
        EntityManagerInterface $entityManager,
        ConversationRepository $conversationRepository,
        ConversationMessageRepository $conversationMessageRepository,
    ): JsonResponse {
        $avatar = $this->findOwnedAvatar($id, $entityManager);
        $conversations = $conversationRepository->findAllOwnedByAvatar($this->getCurrentUser(), $avatar);

        return $this->json([
            'conversations' => array_map(
                fn (Conversation $conversation): array => $this->serializeConversation(
                    $conversation,
                    $conversationMessageRepository,
                ),
                $conversations,
            ),
        ]);
    }

    #[Route('/api/conversations/{id}', name: 'api_conversation_show', methods: ['GET'])]
    public function showConversation(
        int $id,
        ConversationRepository $conversationRepository,
        ConversationMessageRepository $conversationMessageRepository,
    ): JsonResponse {
        $conversation = $this->findOwnedConversation($id, $conversationRepository);

        return $this->json($this->serializeConversation($conversation, $conversationMessageRepository));
    }

    #[Route('/api/conversations/{id}/messages', name: 'api_conversation_messages', methods: ['GET'])]
    public function listConversationMessages(
        int $id,
        ConversationRepository $conversationRepository,
        ConversationMessageRepository $conversationMessageRepository,
    ): JsonResponse {
        $conversation = $this->findOwnedConversation($id, $conversationRepository);

        return $this->json([
            'messages' => array_map(
                fn (ConversationMessage $message): array => $this->serializeMessage($message),
                $conversationMessageRepository->findAllForConversation($conversation),
            ),
        ]);
    }

    #[Route('/api/avatars/{id}/chat', name: 'api_avatar_chat', methods: ['POST'])]
    public function chat(
        int $id,
        Request $request,
        EntityManagerInterface $entityManager,
        AvatarChatService $avatarChatService,
        ConversationMessageRepository $conversationMessageRepository,
    ): JsonResponse {
        $avatar = $this->findOwnedAvatar($id, $entityManager);
        $payload = json_decode($request->getContent(), true);

        if (!is_array($payload)) {
            return $this->json(['message' => 'Invalid JSON.'], Response::HTTP_BAD_REQUEST);
        }

        $conversationId = array_key_exists('conversationId', $payload) && is_int($payload['conversationId'])
            ? $payload['conversationId']
            : null;
        $personaId = array_key_exists('personaId', $payload) && is_int($payload['personaId'])
            ? $payload['personaId']
            : null;
        $credentialId = array_key_exists('credentialId', $payload) && is_int($payload['credentialId'])
            ? $payload['credentialId']
            : null;
        $provider = is_string($payload['provider'] ?? null) ? trim($payload['provider']) : null;
        $model = is_string($payload['model'] ?? null) ? trim($payload['model']) : null;
        $includeRecentMessages = is_int($payload['includeRecentMessages'] ?? null)
            ? max(1, min(50, $payload['includeRecentMessages']))
            : 12;

        try {
            $result = $avatarChatService->chat(
                $this->getCurrentUser(),
                $avatar,
                (string) ($payload['message'] ?? ''),
                $conversationId,
                $personaId,
                $credentialId,
                $provider !== '' ? $provider : null,
                $model !== '' ? $model : null,
                $includeRecentMessages,
            );
        } catch (AvatarChatException $exception) {
            return $this->json(
                ['message' => $exception->getMessage()],
                $exception->getStatusCode(),
            );
        }

        return $this->json([
            'conversation' => $this->serializeConversation($result->conversation, $conversationMessageRepository),
            'userMessage' => $this->serializeMessage($result->userMessage),
            'assistantMessage' => $this->serializeMessage($result->assistantMessage),
        ], Response::HTTP_OK);
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

    private function findOwnedConversation(int $id, ConversationRepository $conversationRepository): Conversation
    {
        $conversation = $conversationRepository->findOwnedConversation($this->getCurrentUser(), $id);
        if ($conversation === null) {
            throw $this->createNotFoundException();
        }

        return $conversation;
    }

    /**
     * @return array{
     *   id:int|null,
     *   avatarId:int|null,
     *   personaId:?int,
     *   provider:string,
     *   model:?string,
     *   title:?string,
     *   messageCount:int,
     *   createdAt:string,
     *   updatedAt:string
     * }
     */
    private function serializeConversation(
        Conversation $conversation,
        ConversationMessageRepository $conversationMessageRepository,
    ): array {
        return [
            'id' => $conversation->getId(),
            'avatarId' => $conversation->getAvatar()?->getId(),
            'personaId' => $conversation->getPersona()?->getId(),
            'provider' => $conversation->getProvider(),
            'model' => $conversation->getModel(),
            'title' => $conversation->getTitle(),
            'messageCount' => count($conversationMessageRepository->findAllForConversation($conversation)),
            'createdAt' => $conversation->getCreatedAt()?->format(DATE_ATOM) ?? '',
            'updatedAt' => $conversation->getUpdatedAt()?->format(DATE_ATOM) ?? '',
        ];
    }

    /**
     * @return array{
     *   id:int|null,
     *   role:string,
     *   content:string,
     *   rawProviderContent:?string,
     *   parsedText:?string,
     *   emotionTags:list<string>,
     *   animationTags:list<string>,
     *   createdAt:string
     * }
     */
    private function serializeMessage(ConversationMessage $message): array
    {
        return [
            'id' => $message->getId(),
            'role' => $message->getRole(),
            'content' => $message->getContent(),
            'rawProviderContent' => $message->getRawProviderContent(),
            'parsedText' => $message->getParsedText(),
            'emotionTags' => $message->getParsedEmotionTags(),
            'animationTags' => $message->getParsedAnimationTags(),
            'createdAt' => $message->getCreatedAt()?->format(DATE_ATOM) ?? '',
        ];
    }

    private function getCurrentUser(): User
    {
        /** @var User $user */
        $user = $this->getUser();

        return $user;
    }
}
