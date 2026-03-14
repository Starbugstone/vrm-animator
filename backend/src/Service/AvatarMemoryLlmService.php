<?php

namespace App\Service;

use App\Entity\Avatar;
use App\Entity\AvatarMemory;
use App\Entity\User;
use App\Service\Llm\AvatarChatException;
use App\Service\Llm\AvatarLlmConfigurationResolver;
use App\Service\Llm\LlmCompletionRequest;
use App\Service\Llm\PromptBuilder;
use App\Service\Llm\PromptRulesProvider;
use App\Service\Llm\ResolvedAvatarLlmConfig;
use App\Service\Llm\TokenEstimator;
use App\Service\Llm\CueAssetCatalog;
use Symfony\Component\HttpFoundation\Response;

class AvatarMemoryLlmService
{
    public function __construct(
        private AvatarMemoryService $avatarMemoryService,
        private AvatarLlmConfigurationResolver $avatarLlmConfigurationResolver,
        private PromptBuilder $promptBuilder,
        private PromptRulesProvider $promptRulesProvider,
        private TokenEstimator $tokenEstimator,
        private LlmCredentialCrypto $credentialCrypto,
        private LlmProviderCatalog $providerCatalog,
        private \App\Service\Llm\LlmProviderResolver $providerResolver,
        private CueAssetCatalog $cueAssetCatalog,
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function buildDiagnostics(User $user, Avatar $avatar, AvatarMemory $memory): array
    {
        $resolved = $this->avatarLlmConfigurationResolver->resolve($user, $avatar);
        $policy = $resolved->modelPolicy ?? $this->avatarLlmConfigurationResolver->fallbackPolicy();

        $rawMarkdown = $memory->getMarkdownContent();
        $memoryDirective = $this->promptBuilder->buildMemoryDirective();
        $compactedMarkdown = $this->promptBuilder->buildCompactedMemoryMarkdown($rawMarkdown, $policy);
        $chatMemorySection = $this->promptBuilder->buildMemoryContextSection($rawMarkdown, $policy);
        $memoryBudgetTokens = $this->tokenEstimator->estimateCharacters($policy->maxMemoryCharacters);
        $assets = $this->cueAssetCatalog->listForAvatar($user, $avatar);
        $systemPrompt = $this->promptBuilder->buildSystemPrompt(
            $avatar,
            $resolved->persona,
            $rawMarkdown,
            $assets,
            $policy,
        );
        $systemPromptEstimatedTokens = $this->tokenEstimator->estimateText($systemPrompt);
        $estimatedHistoryBudgetTokens = $policy->maxRecentMessages * $this->tokenEstimator->estimateCharacters($policy->maxHistoryMessageCharacters);
        $estimatedPromptTokens = $systemPromptEstimatedTokens + $estimatedHistoryBudgetTokens;
        $estimatedPromptBudgetTokens = max(0, $policy->contextLength - $policy->maxOutputTokens);
        $chatSectionEstimatedTokens = $this->tokenEstimator->estimateText($chatMemorySection);
        $budgetUtilization = $memoryBudgetTokens > 0
            ? min(1, $this->tokenEstimator->estimateText($compactedMarkdown) / $memoryBudgetTokens)
            : 0.0;
        $estimatedPromptShare = $estimatedPromptTokens > 0
            ? min(1, $chatSectionEstimatedTokens / $estimatedPromptTokens)
            : 0.0;
        $warningThreshold = 0.7;

        return [
            'memoryStats' => [
                'estimator' => 'approx_chars_div_4',
                'rawCharacters' => mb_strlen($rawMarkdown),
                'rawEstimatedTokens' => $this->tokenEstimator->estimateText($rawMarkdown),
                'directiveCharacters' => mb_strlen($memoryDirective),
                'directiveEstimatedTokens' => $this->tokenEstimator->estimateText($memoryDirective),
                'compactedCharacters' => mb_strlen($compactedMarkdown),
                'compactedEstimatedTokens' => $this->tokenEstimator->estimateText($compactedMarkdown),
                'chatSectionCharacters' => mb_strlen($chatMemorySection),
                'chatSectionEstimatedTokens' => $chatSectionEstimatedTokens,
                'budgetCharacters' => $policy->maxMemoryCharacters,
                'budgetEstimatedTokens' => $memoryBudgetTokens,
                'budgetUtilization' => $budgetUtilization,
                'estimatedSystemPromptTokens' => $systemPromptEstimatedTokens,
                'estimatedHistoryBudgetTokens' => $estimatedHistoryBudgetTokens,
                'estimatedPromptTokens' => $estimatedPromptTokens,
                'estimatedPromptBudgetTokens' => $estimatedPromptBudgetTokens,
                'estimatedPromptShare' => $estimatedPromptShare,
            ],
            'warning' => [
                'threshold' => $warningThreshold,
                'shouldWarn' => $budgetUtilization >= $warningThreshold || $estimatedPromptShare >= $warningThreshold,
                'headline' => 'Memory is getting heavy for this model.',
                'message' => 'The current memory is using a large share of the selected model allowance. Compression or cleanup may help keep room for rules and chat history.',
            ],
            'llmConfiguration' => [
                'available' => $resolved->isAvailable(),
                'provider' => $resolved->provider,
                'providerLabel' => $resolved->provider !== null ? $this->providerCatalog->getLabel($resolved->provider) : null,
                'model' => $resolved->model,
                'credentialId' => $resolved->credential?->getId(),
                'credentialName' => $resolved->credential?->getName(),
                'providerOptions' => $resolved->credential?->getProviderOptions() ?? [],
                'policySource' => $resolved->usesFallbackPolicy ? 'fallback' : 'configured',
                'unavailableReason' => $resolved->unavailableReason,
            ],
            'chatMemoryContext' => [
                'directive' => $memoryDirective,
                'compactedMarkdown' => $compactedMarkdown,
                'systemSection' => implode("\n\n", [$memoryDirective, $chatMemorySection]),
                'replyHandling' => [
                    'The compacted markdown is injected into the system prompt before each chat turn.',
                    'Placeholder bullets are dropped before injection so empty scaffolding does not consume prompt budget.',
                    'Assistant replies are parsed for inline {memory:relationship|fact} and {memory:long-term|fact} tags after the provider returns text.',
                    'If a scope is omitted, the memory entry defaults to Relationship Memory.',
                    'Each parsed fact is normalized, deduplicated, routed to the matching memory section, and saved as a new memory revision.',
                ],
            ],
            'compression' => [
                'available' => $resolved->isAvailable(),
                'requestPreview' => $resolved->isAvailable()
                    ? $this->serializeCompressionRequest($resolved, $avatar, $memory)
                    : null,
                'responseHandling' => [
                    'The compression reply is trimmed and markdown code fences are unwrapped if present.',
                    'The avatar identity section is rewritten from the saved avatar profile so the LLM cannot drift core identity fields.',
                    'Missing core sections are restored automatically before the compressed memory is saved.',
                    'The final markdown is stored as a normal memory revision, so compression stays auditable and reversible.',
                ],
            ],
        ];
    }

    /**
     * @return array{memory:AvatarMemory,request:array<string,mixed>,replyPreview:string}
     */
    public function compressMemory(User $user, Avatar $avatar, AvatarMemory $memory, int $expectedRevision): array
    {
        $resolved = $this->avatarLlmConfigurationResolver->resolve($user, $avatar);
        if (!$resolved->isAvailable() || $resolved->credential === null || $resolved->provider === null || $resolved->model === null) {
            throw new AvatarChatException(
                $resolved->unavailableReason ?? 'Configure an active AI connection for this avatar before compressing memory.',
                Response::HTTP_BAD_REQUEST,
            );
        }

        $request = $this->buildCompressionRequest($resolved, $avatar, $memory);

        try {
            $completion = $this->providerResolver
                ->resolve($resolved->provider)
                ->complete(
                    $request,
                    $this->decryptCredentialSecret($resolved->credential->getEncryptedSecret(), $resolved->provider),
                );
        } catch (AvatarChatException $exception) {
            throw $exception;
        } catch (\Throwable $exception) {
            throw new AvatarChatException(
                'The configured AI connection could not compress this memory right now.',
                Response::HTTP_BAD_GATEWAY,
                $exception,
            );
        }

        $compressedMarkdown = $this->normalizeCompressionReply($avatar, $completion->content);
        $updatedMemory = $this->avatarMemoryService->updateMemory($avatar, $compressedMarkdown, $expectedRevision, 'llm-compress');

        return [
            'memory' => $updatedMemory,
            'request' => $this->serializeRequest($request),
            'replyPreview' => $this->limitText($completion->content, 1200),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeCompressionRequest(ResolvedAvatarLlmConfig $resolved, Avatar $avatar, AvatarMemory $memory): array
    {
        $request = $this->buildCompressionRequest($resolved, $avatar, $memory);

        return $this->serializeRequest($request);
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeRequest(LlmCompletionRequest $request): array
    {
        return [
            'provider' => $request->provider,
            'model' => $request->model,
            'maxOutputTokens' => $request->maxOutputTokens,
            'providerOptions' => $request->providerOptions,
            'messages' => $request->messages,
        ];
    }

    private function buildCompressionRequest(ResolvedAvatarLlmConfig $resolved, Avatar $avatar, AvatarMemory $memory): LlmCompletionRequest
    {
        $policy = $resolved->modelPolicy ?? $this->avatarLlmConfigurationResolver->fallbackPolicy();
        $messages = [
            [
                'role' => 'system',
                'content' => $this->promptRulesProvider->getMemoryCompressionRules(),
            ],
            [
                'role' => 'user',
                'content' => implode("\n\n", [
                    'Compress avatar memory for future chat turns.',
                    implode("\n", [
                        'Avatar profile:',
                        sprintf('- name: %s', trim($avatar->getName() ?: '')),
                        sprintf('- backstory: %s', trim($avatar->getBackstory() ?: '')),
                        sprintf('- personality: %s', trim($avatar->getPersonality() ?: '')),
                    ]),
                    sprintf(
                        'Target memory budget: keep the rewritten memory within about %d characters of compacted chat context.',
                        $policy->maxMemoryCharacters,
                    ),
                    "Current memory markdown:\n".$memory->getMarkdownContent(),
                ]),
            ],
        ];

        return new LlmCompletionRequest(
            $resolved->provider ?? '',
            $resolved->model ?? '',
            $messages,
            max(400, min(900, (int) floor($policy->maxOutputTokens * 0.65))),
            $resolved->credential?->getProviderOptions() ?? [],
        );
    }

    private function decryptCredentialSecret(string $encryptedSecret, string $provider): string
    {
        try {
            return $this->credentialCrypto->decrypt($encryptedSecret);
        } catch (\RuntimeException $exception) {
            throw new AvatarChatException(
                sprintf(
                    'The saved %s API key can no longer be decrypted by this backend. Restore the original LLM_CREDENTIAL_ENCRYPTION_KEY in backend/.env.local or paste the API key again and save this AI connection.',
                    $this->providerCatalog->getLabel($provider),
                ),
                Response::HTTP_BAD_REQUEST,
                $exception,
            );
        }
    }

    private function normalizeCompressionReply(Avatar $avatar, string $reply): string
    {
        $normalized = trim($reply);
        if (preg_match('/```(?:markdown)?\s*(.*?)```/is', $normalized, $matches) === 1) {
            $normalized = trim((string) ($matches[1] ?? ''));
        }

        if ($normalized === '') {
            throw new AvatarChatException(
                'The configured AI connection returned an empty memory compression.',
                Response::HTTP_BAD_GATEWAY,
            );
        }

        return $this->avatarMemoryService->normalizeMemoryMarkdown($avatar, $normalized);
    }

    private function limitText(string $text, int $maxLength): string
    {
        $normalized = trim($text);
        if (mb_strlen($normalized) <= $maxLength) {
            return $normalized;
        }

        return rtrim(mb_substr($normalized, 0, max(1, $maxLength - 1))).'…';
    }
}
