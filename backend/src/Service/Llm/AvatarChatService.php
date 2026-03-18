<?php

namespace App\Service\Llm;

use App\Entity\Avatar;
use App\Entity\AvatarPersona;
use App\Entity\Conversation;
use App\Entity\ConversationMessage;
use App\Entity\LlmCredential;
use App\Entity\User;
use App\Repository\AvatarPersonaRepository;
use App\Repository\ConversationMessageRepository;
use App\Repository\ConversationRepository;
use App\Repository\LlmCredentialRepository;
use App\Service\AvatarMemoryService;
use App\Service\LlmCredentialCrypto;
use App\Service\LlmProviderCatalog;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\Response;

class AvatarChatService
{
    public function __construct(
        private EntityManagerInterface $entityManager,
        private ConversationRepository $conversationRepository,
        private ConversationMessageRepository $conversationMessageRepository,
        private AvatarPersonaRepository $avatarPersonaRepository,
        private LlmCredentialRepository $credentialRepository,
        private LlmCredentialCrypto $credentialCrypto,
        private LlmProviderCatalog $providerCatalog,
        private LlmProviderResolver $providerResolver,
        private AvatarMemoryService $avatarMemoryService,
        private CueAssetCatalog $cueAssetCatalog,
        private ChatModelPolicyResolver $chatModelPolicyResolver,
        private PromptBuilder $promptBuilder,
        private CueParser $cueParser,
    ) {
    }

    public function chat(
        User $user,
        Avatar $avatar,
        string $message,
        ?int $conversationId,
        ?int $personaId,
        ?int $credentialId,
        ?string $requestedProvider,
        ?string $requestedModel,
        int $includeRecentMessages,
    ): ChatTurnResult {
        $preparedTurn = $this->prepareChat(
            $user,
            $avatar,
            $message,
            $conversationId,
            $personaId,
            $credentialId,
            $requestedProvider,
            $requestedModel,
            $includeRecentMessages,
        );

        try {
            $completion = $this->providerResolver
                ->resolve($preparedTurn->provider)
                ->complete(
                    new LlmCompletionRequest(
                        $preparedTurn->provider,
                        $preparedTurn->model,
                        $preparedTurn->providerMessages,
                        $preparedTurn->modelPolicy->maxOutputTokens,
                        $preparedTurn->credential->getProviderOptions(),
                    ),
                    $this->decryptCredentialSecret($preparedTurn->credential),
                );
        } catch (AvatarChatException $exception) {
            throw $exception;
        } catch (\Throwable $exception) {
            throw new AvatarChatException(
                'LLM provider request failed.',
                Response::HTTP_BAD_GATEWAY,
                $exception,
            );
        }

        return $this->finalizeChat($preparedTurn, $completion);
    }

    public function prepareChat(
        User $user,
        Avatar $avatar,
        string $message,
        ?int $conversationId,
        ?int $personaId,
        ?int $credentialId,
        ?string $requestedProvider,
        ?string $requestedModel,
        int $includeRecentMessages,
    ): PreparedChatTurn {
        $trimmedMessage = trim($message);
        if ($trimmedMessage === '') {
            throw new AvatarChatException('message is required.', Response::HTTP_BAD_REQUEST);
        }

        $conversation = $this->resolveConversation($user, $avatar, $conversationId);
        $persona = $this->resolvePersona($user, $avatar, $personaId, $conversation);
        $credential = $this->resolveCredential($user, $persona, $credentialId, $requestedProvider, $conversation);
        $provider = $requestedProvider ?? $credential->getProvider();
        $model = $this->resolveModel($credential, $provider, $requestedModel, $conversation);
        $modelPolicy = $this->chatModelPolicyResolver->resolve($provider, $model);

        $memory = $this->avatarMemoryService->getOrCreateMemory($avatar);
        $assets = $this->cueAssetCatalog->listForAvatar($user, $avatar);
        $recentMessages = $conversation !== null
            ? $this->conversationMessageRepository->findRecentForConversation(
                $conversation,
                min($includeRecentMessages, $modelPolicy->maxRecentMessages),
            )
            : [];

        $providerMessages = $this->promptBuilder->buildMessages(
            $avatar,
            $persona,
            $memory->getMarkdownContent(),
            $assets,
            $recentMessages,
            $trimmedMessage,
            $modelPolicy,
        );

        return new PreparedChatTurn(
            $user,
            $avatar,
            $trimmedMessage,
            $conversation,
            $persona,
            $credential,
            $provider,
            $model,
            $modelPolicy,
            $assets,
            $providerMessages,
        );
    }

    public function finalizeChat(PreparedChatTurn $preparedTurn, LlmCompletionResponse $completion): ChatTurnResult
    {
        $conversation = $preparedTurn->conversation;
        $parsedAssistant = $this->cueParser->parse($completion->content, $preparedTurn->assets);
        $conversation ??= (new Conversation())
            ->setOwner($preparedTurn->user)
            ->setAvatar($preparedTurn->avatar)
            ->setTitle($this->buildConversationTitle($preparedTurn->message));

        $conversation
            ->setPersona($preparedTurn->persona)
            ->setProvider($preparedTurn->provider)
            ->setModel($preparedTurn->model)
            ->touch();

        $userMessage = (new ConversationMessage())
            ->setConversation($conversation)
            ->setRole('user')
            ->setContent($preparedTurn->message)
            ->setParsedText($preparedTurn->message)
            ->setParsedEmotionTags([])
            ->setParsedAnimationTags([]);

        $assistantText = $parsedAssistant['text'] !== '' || $parsedAssistant['timeline'] !== []
            ? $parsedAssistant['text']
            : trim($completion->content);
        $assistantSpeechText = $parsedAssistant['speechText'] !== ''
            ? $parsedAssistant['speechText']
            : $assistantText;
        $assistantMessage = (new ConversationMessage())
            ->setConversation($conversation)
            ->setRole('assistant')
            ->setContent($assistantText)
            ->setRawProviderContent($completion->rawResponse)
            ->setParsedText($parsedAssistant['text'])
            ->setParsedEmotionTags($parsedAssistant['emotionTags'])
            ->setParsedAnimationTags($parsedAssistant['animationTags']);

        $this->entityManager->persist($conversation);
        $this->entityManager->persist($userMessage);
        $this->entityManager->persist($assistantMessage);
        $this->entityManager->flush();

        if ($parsedAssistant['memoryEntries'] !== []) {
            $this->avatarMemoryService->appendMemoryEntries($preparedTurn->avatar, $parsedAssistant['memoryEntries'], 'assistant');
        }

        return new ChatTurnResult(
            $conversation,
            $userMessage,
            $assistantMessage,
            $parsedAssistant['timeline'],
            $parsedAssistant['memoryEntries'],
            $assistantSpeechText,
        );
    }

    public function getProviderResolver(): LlmProviderResolver
    {
        return $this->providerResolver;
    }

    public function decryptCredentialSecret(LlmCredential $credential): string
    {
        try {
            return $this->credentialCrypto->decrypt($credential->getEncryptedSecret());
        } catch (\RuntimeException $exception) {
            throw new AvatarChatException(
                sprintf(
                    'The saved %s API key can no longer be decrypted by this backend. Restore the original LLM_CREDENTIAL_ENCRYPTION_KEY in backend/.env.local or paste the API key again and save this AI connection.',
                    $this->providerCatalog->getLabel($credential->getProvider()),
                ),
                Response::HTTP_BAD_REQUEST,
                $exception,
            );
        }
    }

    /**
     * @param list<CueAsset> $assets
     * @return array{timeline:list<array<string, mixed>>,cursor:int}
     */
    public function parseStreamingTimeline(array $assets, string $rawContent, int $cursor): array
    {
        return $this->cueParser->parseStreamDelta($rawContent, $assets, $cursor);
    }

    /**
     * @param list<CueAsset> $assets
     * @return list<array<string, mixed>>
     */
    public function parseCompletionTimeline(array $assets, string $rawContent): array
    {
        $parsed = $this->cueParser->parse($rawContent, $assets);

        return $parsed['timeline'];
    }

    private function resolveConversation(User $user, Avatar $avatar, ?int $conversationId): ?Conversation
    {
        if ($conversationId === null) {
            return null;
        }

        $conversation = $this->conversationRepository->findOwnedConversation($user, $conversationId);
        if ($conversation === null || $conversation->getAvatar()?->getId() !== $avatar->getId()) {
            throw new AvatarChatException('Conversation not found.', Response::HTTP_NOT_FOUND);
        }

        return $conversation;
    }

    private function resolvePersona(User $user, Avatar $avatar, ?int $personaId, ?Conversation $conversation): ?AvatarPersona
    {
        if ($personaId !== null) {
            $persona = $this->avatarPersonaRepository->findOwnedPersona($user, $personaId);
            if ($persona === null || $persona->getAvatar()?->getId() !== $avatar->getId()) {
                throw new AvatarChatException('Avatar persona not found.', Response::HTTP_NOT_FOUND);
            }

            return $persona;
        }

        if ($conversation?->getPersona() !== null) {
            return $conversation->getPersona();
        }

        return $this->avatarPersonaRepository->findPrimaryForAvatar($user, $avatar);
    }

    private function resolveCredential(
        User $user,
        ?AvatarPersona $persona,
        ?int $credentialId,
        ?string $requestedProvider,
        ?Conversation $conversation,
    ): LlmCredential
    {
        if ($credentialId !== null) {
            $credential = $this->credentialRepository->findOwnedCredential($user, $credentialId);
            if ($credential === null || !$credential->isActive()) {
                throw new AvatarChatException(
                    'The selected credential is missing or inactive.',
                    Response::HTTP_BAD_REQUEST,
                );
            }

            return $credential;
        }

        if ($persona !== null && $requestedProvider === null) {
            $credential = $persona->getLlmCredential();
            if ($credential === null) {
                throw new AvatarChatException(
                    'The selected persona does not have an LLM configured.',
                    Response::HTTP_BAD_REQUEST,
                );
            }

            if ($credential->isActive()) {
                return $credential;
            }
        }

        $provider = $requestedProvider ?? $conversation?->getProvider();
        if ($provider !== null) {
            $provider = strtolower(trim($provider));
            try {
                $this->providerCatalog->assertSupported($provider);
            } catch (\InvalidArgumentException $exception) {
                throw new AvatarChatException($exception->getMessage(), Response::HTTP_BAD_REQUEST, $exception);
            }

            $credential = $this->credentialRepository->findFirstActiveOwnedByProvider($user, $provider);
            if ($credential === null) {
                throw new AvatarChatException(
                    'No active credential is configured for the requested provider.',
                    Response::HTTP_BAD_REQUEST,
                );
            }

            return $credential;
        }

        $credential = $this->credentialRepository->findFirstActiveOwnedBy($user);
        if ($credential === null) {
            throw new AvatarChatException(
                'Configure at least one active LLM credential before chatting.',
                Response::HTTP_BAD_REQUEST,
            );
        }

        return $credential;
    }

    private function resolveModel(
        LlmCredential $credential,
        string $provider,
        ?string $requestedModel,
        ?Conversation $conversation,
    ): string {
        $normalizedRequestedModel = $this->normalizeNullableString($requestedModel);
        if ($normalizedRequestedModel !== null) {
            return $normalizedRequestedModel;
        }

        $conversationModel = $this->normalizeNullableString(
            $conversation !== null && $conversation->getProvider() === $provider
                ? $conversation->getModel()
                : null,
        );
        if ($conversationModel !== null) {
            return $conversationModel;
        }

        $credentialModel = $this->normalizeNullableString($credential->getDefaultModel());
        if ($credentialModel !== null) {
            return $credentialModel;
        }

        $providers = $this->providerCatalog->listProviders();
        foreach ($providers as $providerMetadata) {
            if (($providerMetadata['id'] ?? null) !== $provider) {
                continue;
            }

            $recommended = $providerMetadata['recommendedModels'][0] ?? null;
            if (is_string($recommended) && trim($recommended) !== '') {
                return trim($recommended);
            }
        }

        throw new AvatarChatException(
            'No model is configured for the selected provider.',
            Response::HTTP_BAD_REQUEST,
        );
    }

    private function buildConversationTitle(string $message): string
    {
        $title = substr($message, 0, 80);

        return $title !== '' ? $title : 'New conversation';
    }

    private function normalizeNullableString(?string $value): ?string
    {
        if (!is_string($value)) {
            return null;
        }

        $trimmed = trim($value);

        return $trimmed !== '' ? $trimmed : null;
    }
}
