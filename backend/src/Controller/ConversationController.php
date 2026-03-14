<?php

namespace App\Controller;

use App\Entity\Avatar;
use App\Entity\Conversation;
use App\Entity\ConversationMessage;
use App\Entity\User;
use App\Repository\ConversationMessageRepository;
use App\Repository\ConversationRepository;
use App\Service\LlmProviderCatalog;
use App\Service\Llm\AvatarChatException;
use App\Service\Llm\AvatarChatService;
use App\Service\Llm\ChatTurnResult;
use App\Service\Llm\LlmCompletionRequest;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Symfony\Component\Routing\Attribute\Route;

class ConversationController extends AbstractController
{
    public function __construct(
        private readonly LlmProviderCatalog $llmProviderCatalog,
    ) {
    }

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
    ): Response {
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
        $stream = is_bool($payload['stream'] ?? null) ? $payload['stream'] : false;
        $includeRecentMessages = is_int($payload['includeRecentMessages'] ?? null)
            ? max(1, min(20, $payload['includeRecentMessages']))
            : 6;

        try {
            if ($stream) {
                return $this->streamLiveChatResult(
                    $avatarChatService,
                    $avatar,
                    $conversationMessageRepository,
                    (string) ($payload['message'] ?? ''),
                    $conversationId,
                    $personaId,
                    $credentialId,
                    $provider !== '' ? $provider : null,
                    $model !== '' ? $model : null,
                    $includeRecentMessages,
                );
            }

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
            return $this->json(['message' => $exception->getMessage()], $exception->getStatusCode());
        }

        return $this->json([
            'conversation' => $this->serializeConversation($result->conversation, $conversationMessageRepository),
            'userMessage' => $this->serializeMessage($result->userMessage),
            'assistantMessage' => $this->serializeMessage($result->assistantMessage),
            'assistantTimeline' => $result->assistantTimeline,
            'assistantMemoryEntries' => $result->assistantMemoryEntries,
        ], Response::HTTP_OK);
    }

    private function streamLiveChatResult(
        AvatarChatService $avatarChatService,
        Avatar $avatar,
        ConversationMessageRepository $conversationMessageRepository,
        string $message,
        ?int $conversationId,
        ?int $personaId,
        ?int $credentialId,
        ?string $provider,
        ?string $model,
        int $includeRecentMessages,
    ): StreamedResponse {
        $response = new StreamedResponse(function () use (
            $avatarChatService,
            $avatar,
            $conversationMessageRepository,
            $message,
            $conversationId,
            $personaId,
            $credentialId,
            $provider,
            $model,
            $includeRecentMessages,
        ): void {
            $streamStartedAt = microtime(true);
            $firstDeltaEmittedAt = null;

            $this->primeSseStream();
            $this->emitSseEvent('status', [
                'phase' => 'prepare',
                'message' => 'Preparing avatar context...',
                'elapsedMs' => 0,
            ]);

            try {
                $preparedTurn = $avatarChatService->prepareChat(
                    $this->getCurrentUser(),
                    $avatar,
                    $message,
                    $conversationId,
                    $personaId,
                    $credentialId,
                    $provider,
                    $model,
                    $includeRecentMessages,
                );
            } catch (AvatarChatException $exception) {
                $this->emitSseEvent('error', ['message' => $exception->getMessage()]);
                return;
            }

            $this->emitSseEvent('status', [
                'phase' => 'provider',
                'provider' => $preparedTurn->provider,
                'model' => $preparedTurn->model,
                'credentialName' => $preparedTurn->credential->getName(),
                'message' => sprintf(
                    'Contacting %s%s...',
                    $this->formatProviderLabel($preparedTurn->provider),
                    $preparedTurn->model !== '' ? sprintf(' (%s)', $preparedTurn->model) : '',
                ),
                'elapsedMs' => (int) round((microtime(true) - $streamStartedAt) * 1000),
            ]);

            $this->emitSseEvent('conversation', [
                'conversation' => $preparedTurn->conversation !== null
                    ? $this->serializeConversation($preparedTurn->conversation, $conversationMessageRepository)
                    : [
                        'id' => null,
                        'avatarId' => $avatar->getId(),
                        'personaId' => $preparedTurn->persona?->getId(),
                        'provider' => $preparedTurn->provider,
                        'model' => $preparedTurn->model,
                        'title' => null,
                        'messageCount' => $preparedTurn->conversation !== null
                            ? count($conversationMessageRepository->findAllForConversation($preparedTurn->conversation))
                            : 0,
                        'createdAt' => '',
                        'updatedAt' => '',
                    ],
                'userMessage' => [
                    'id' => null,
                    'role' => 'user',
                    'content' => $preparedTurn->message,
                    'rawProviderContent' => null,
                    'parsedText' => $preparedTurn->message,
                    'emotionTags' => [],
                    'animationTags' => [],
                    'createdAt' => '',
                ],
            ]);

            $rawContent = '';
            $streamCursor = 0;

            try {
                $completion = $avatarChatService
                    ->getProviderResolver()
                    ->resolve($preparedTurn->provider)
                    ->streamComplete(
                        new LlmCompletionRequest(
                            $preparedTurn->provider,
                            $preparedTurn->model,
                            $preparedTurn->providerMessages,
                            $preparedTurn->modelPolicy->maxOutputTokens,
                            $preparedTurn->credential->getProviderOptions(),
                        ),
                        $avatarChatService->decryptCredentialSecret($preparedTurn->credential),
                        function ($delta) use ($avatarChatService, $preparedTurn, &$rawContent, &$streamCursor, &$firstDeltaEmittedAt, $streamStartedAt): void {
                            $rawContent .= $delta->content;
                            if ($firstDeltaEmittedAt === null && trim($delta->content) !== '') {
                                $firstDeltaEmittedAt = microtime(true);
                                $this->emitSseEvent('status', [
                                    'phase' => 'stream',
                                    'message' => 'Reply started.',
                                    'elapsedMs' => (int) round(($firstDeltaEmittedAt - $streamStartedAt) * 1000),
                                ]);
                            }
                            $parsed = $avatarChatService->parseStreamingTimeline($preparedTurn->assets, $rawContent, $streamCursor);
                            $streamCursor = $parsed['cursor'];

                            foreach ($parsed['timeline'] as $event) {
                                $this->emitTimelineEvent($event);
                            }
                        },
                    );
            } catch (\Throwable $exception) {
                if (trim($rawContent) === '') {
                    try {
                        $fallbackCompletion = $avatarChatService
                            ->getProviderResolver()
                            ->resolve($preparedTurn->provider)
                            ->complete(
                                new LlmCompletionRequest(
                                    $preparedTurn->provider,
                                    $preparedTurn->model,
                                    $preparedTurn->providerMessages,
                                    $preparedTurn->modelPolicy->maxOutputTokens,
                                    $preparedTurn->credential->getProviderOptions(),
                                ),
                                $avatarChatService->decryptCredentialSecret($preparedTurn->credential),
                            );

                        $fallbackTimeline = $avatarChatService->parseCompletionTimeline($preparedTurn->assets, $fallbackCompletion->content);
                        foreach ($fallbackTimeline as $event) {
                            $this->emitTimelineEvent($event);
                        }

                        $result = $avatarChatService->finalizeChat($preparedTurn, $fallbackCompletion);
                        $this->emitSseEvent('message.complete', [
                            'conversation' => $this->serializeConversation($result->conversation, $conversationMessageRepository),
                            'userMessage' => $this->serializeMessage($result->userMessage),
                            'assistantMessage' => $this->serializeMessage($result->assistantMessage),
                            'assistantTimeline' => $result->assistantTimeline,
                            'assistantMemoryEntries' => $result->assistantMemoryEntries,
                            'timing' => [
                                'totalMs' => (int) round((microtime(true) - $streamStartedAt) * 1000),
                                'firstDeltaMs' => $firstDeltaEmittedAt !== null
                                    ? (int) round(($firstDeltaEmittedAt - $streamStartedAt) * 1000)
                                    : null,
                                'fallbackUsed' => true,
                            ],
                        ]);

                        return;
                    } catch (\Throwable $fallbackException) {
                        $this->emitSseEvent('error', ['message' => $fallbackException->getMessage()]);
                        return;
                    }
                }

                $this->emitSseEvent('error', ['message' => $exception->getMessage()]);
                return;
            }

            $remaining = $avatarChatService->parseStreamingTimeline($preparedTurn->assets, $rawContent, $streamCursor);
            foreach ($remaining['timeline'] as $event) {
                $this->emitTimelineEvent($event);
            }

            $result = $avatarChatService->finalizeChat($preparedTurn, $completion);

            $this->emitSseEvent('message.complete', [
                'conversation' => $this->serializeConversation($result->conversation, $conversationMessageRepository),
                'userMessage' => $this->serializeMessage($result->userMessage),
                'assistantMessage' => $this->serializeMessage($result->assistantMessage),
                'assistantTimeline' => $result->assistantTimeline,
                'assistantMemoryEntries' => $result->assistantMemoryEntries,
                'timing' => [
                    'totalMs' => (int) round((microtime(true) - $streamStartedAt) * 1000),
                    'firstDeltaMs' => $firstDeltaEmittedAt !== null
                        ? (int) round(($firstDeltaEmittedAt - $streamStartedAt) * 1000)
                        : null,
                    'fallbackUsed' => false,
                ],
            ]);
        });

        $response->headers->set('Content-Type', 'text/event-stream');
        $response->headers->set('Cache-Control', 'no-cache');
        $response->headers->set('X-Accel-Buffering', 'no');

        return $response;
    }

    private function primeSseStream(): void
    {
        while (ob_get_level() > 0) {
            ob_end_flush();
        }

        echo ':' . str_repeat(' ', 2048) . "\n\n";

        flush();
    }

    /**
     * @param array<string, mixed> $event
     */
    private function emitTimelineEvent(array $event): void
    {
        if (($event['type'] ?? '') === 'text') {
            foreach ($this->chunkTextForStreaming((string) ($event['value'] ?? '')) as $chunk) {
                $this->emitSseEvent('text.delta', ['delta' => $chunk]);
            }

            return;
        }

        if (($event['type'] ?? '') === 'memory') {
            $this->emitSseEvent('memory', ['entry' => (string) ($event['value'] ?? '')]);
            return;
        }

        $this->emitSseEvent('cue', [
            'cueType' => (string) ($event['type'] ?? ''),
            'value' => (string) ($event['value'] ?? ''),
            'assetId' => isset($event['assetId']) ? (string) $event['assetId'] : null,
            'assetLabel' => isset($event['assetLabel']) ? (string) $event['assetLabel'] : null,
            'assetKind' => isset($event['assetKind']) ? (string) $event['assetKind'] : null,
            'assetSource' => isset($event['assetSource']) ? (string) $event['assetSource'] : null,
        ]);
    }

    private function streamError(string $message, int $statusCode): StreamedResponse
    {
        $response = new StreamedResponse(function () use ($message): void {
            $this->emitSseEvent('error', ['message' => $message]);
        }, $statusCode);

        $response->headers->set('Content-Type', 'text/event-stream');
        $response->headers->set('Cache-Control', 'no-cache');

        return $response;
    }

    private function formatProviderLabel(string $provider): string
    {
        return $this->llmProviderCatalog->getLabel($provider);
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

    /**
     * @return list<string>
     */
    private function chunkTextForStreaming(string $text): array
    {
        $matchResult = preg_match_all('/\S+\s*|\s+/u', $text, $matches);
        $parts = $matchResult !== false ? $matches[0] : [$text];
        $chunks = array_values(array_filter(array_map('strval', $parts), static fn (string $value): bool => $value !== ''));

        return $chunks !== [] ? $chunks : [$text];
    }

    /**
     * @param array<string, mixed> $payload
     */
    private function emitSseEvent(string $event, array $payload): void
    {
        echo 'event: '.$event."\n";
        echo 'data: '.json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)."\n\n";

        if (function_exists('ob_flush')) {
            @ob_flush();
        }

        flush();
    }

    private function getCurrentUser(): User
    {
        /** @var User $user */
        $user = $this->getUser();

        return $user;
    }
}
