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
                    'If the first rewrite is unchanged or not actually tighter, compression asks the same model for one stricter retry before keeping the current memory.',
                    'GLM compression keeps reasoning enabled on the first attempt, then retries once with thinking disabled only if the provider returns no visible final markdown.',
                    'The avatar identity section is rewritten from the saved avatar profile so the LLM cannot drift core identity fields.',
                    'Missing core sections are restored automatically before the compressed memory is saved.',
                    'The final markdown is stored as a normal memory revision, so compression stays auditable and reversible.',
                ],
            ],
        ];
    }

    /**
     * @return array{
     *   memory:AvatarMemory,
     *   request:array<string,mixed>,
     *   replyPreview:string,
     *   changed:bool,
     *   retryUsed:bool,
     *   retryMode:?string,
     *   keptExisting:bool,
     *   summary:string,
     *   before:array{chars:int,compactedTokens:int},
     *   after:array{chars:int,compactedTokens:int}
     * }
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
            $attempt = $this->completeCompressionRequest($resolved, $avatar, $memory, $request);
        } catch (AvatarChatException $exception) {
            throw $exception;
        } catch (\Throwable $exception) {
            throw new AvatarChatException(
                'The configured AI connection could not compress this memory right now.',
                Response::HTTP_BAD_GATEWAY,
                $exception,
            );
        }

        $policy = $resolved->modelPolicy ?? $this->avatarLlmConfigurationResolver->fallbackPolicy();
        $currentMarkdown = $memory->getMarkdownContent();
        $evaluation = $this->evaluateCompressionCandidate($avatar, $policy, $currentMarkdown, $attempt['completion']->content);
        $retryMode = $attempt['retryMode'];

        if ($evaluation['shouldKeepExisting']) {
            $strictRequest = $this->buildCompressionRequest(
                $resolved,
                $avatar,
                $memory,
                false,
                'The previous rewrite was not compact enough. Try again and make it materially shorter while preserving all required sections and durable facts. Remove repetition aggressively and prefer dense bullets.',
            );

            try {
                $strictAttempt = $this->completeCompressionRequest($resolved, $avatar, $memory, $strictRequest);
                $retryMode = 'strict-rewrite-retry';
                $strictEvaluation = $this->evaluateCompressionCandidate($avatar, $policy, $currentMarkdown, $strictAttempt['completion']->content);

                if (!$strictEvaluation['shouldKeepExisting']) {
                    $attempt = $strictAttempt;
                    $evaluation = $strictEvaluation;
                } elseif (
                    $strictEvaluation['after']['compactedTokens'] < $evaluation['after']['compactedTokens']
                    || $strictEvaluation['after']['chars'] < $evaluation['after']['chars']
                ) {
                    $attempt = $strictAttempt;
                    $evaluation = $strictEvaluation;
                }
            } catch (\Throwable) {
                // Keep the best previous attempt if the stricter retry also fails.
            }
        }

        $shouldKeepExisting = $evaluation['shouldKeepExisting'];

        $updatedMemory = $shouldKeepExisting
            ? $memory
            : $this->avatarMemoryService->updateMemory($avatar, $evaluation['compressedMarkdown'], $expectedRevision, 'llm-compress');

        $summary = !$evaluation['changed']
            ? 'The model returned the same normalized memory, so the current version was kept.'
            : ($shouldKeepExisting
                ? 'The model returned a rewrite, but even after a stricter retry it was not more compact than the current memory, so the current version was kept.'
                : sprintf(
                    'Memory compression saved a tighter version: compacted memory dropped from ~%d to ~%d tokens.',
                    $evaluation['before']['compactedTokens'],
                    $evaluation['after']['compactedTokens'],
                ));

        return [
            'memory' => $updatedMemory,
            'request' => $this->serializeRequest($attempt['request']),
            'replyPreview' => $this->limitText($attempt['completion']->content, 1200),
            'changed' => !$shouldKeepExisting,
            'retryUsed' => $retryMode !== null,
            'retryMode' => $retryMode,
            'keptExisting' => $shouldKeepExisting,
            'summary' => $summary,
            'before' => $evaluation['before'],
            'after' => $evaluation['after'],
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

    private function buildCompressionRequest(
        ResolvedAvatarLlmConfig $resolved,
        Avatar $avatar,
        AvatarMemory $memory,
        bool $disableThinking = false,
        ?string $retryInstruction = null,
    ): LlmCompletionRequest
    {
        $policy = $resolved->modelPolicy ?? $this->avatarLlmConfigurationResolver->fallbackPolicy();
        $providerOptions = $resolved->credential?->getProviderOptions() ?? [];

        if ($disableThinking && ($resolved->provider ?? '') === 'glm') {
            $providerOptions['thinking'] = ['type' => 'disabled'];
        }

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
                    $retryInstruction !== null && trim($retryInstruction) !== ''
                        ? 'Retry instruction: '.trim($retryInstruction)
                        : null,
                    "Current memory markdown:\n".$memory->getMarkdownContent(),
                ]),
            ],
        ];

        return new LlmCompletionRequest(
            $resolved->provider ?? '',
            $resolved->model ?? '',
            $messages,
            max(700, min(1600, (int) floor($policy->maxOutputTokens * 0.9))),
            $providerOptions,
        );
    }

    /**
     * @return array{
     *   completion:\App\Service\Llm\LlmCompletionResponse,
     *   request:LlmCompletionRequest,
     *   retryMode:?string
     * }
     */
    private function completeCompressionRequest(
        ResolvedAvatarLlmConfig $resolved,
        Avatar $avatar,
        AvatarMemory $memory,
        LlmCompletionRequest $request,
    ): array {
        $provider = $this->providerResolver->resolve($resolved->provider);
        $secret = $this->decryptCredentialSecret($resolved->credential->getEncryptedSecret(), $resolved->provider);

        try {
            return [
                'completion' => $provider->complete($request, $secret),
                'request' => $request,
                'retryMode' => null,
            ];
        } catch (\RuntimeException $exception) {
            $message = strtolower(trim($exception->getMessage()));
            $canRetryWithoutThinking = ($resolved->provider ?? '') === 'glm'
                && str_contains($message, 'empty completion');

            if (!$canRetryWithoutThinking) {
                throw $exception;
            }

            $retryRequest = $this->buildCompressionRequest($resolved, $avatar, $memory, true);
            $retryCompletion = $provider->complete($retryRequest, $secret);

            return [
                'completion' => $retryCompletion,
                'request' => $retryRequest,
                'retryMode' => 'thinking-disabled-fallback',
            ];
        }
    }

    /**
     * @return array{
     *   compressedMarkdown:string,
     *   changed:bool,
     *   shouldKeepExisting:bool,
     *   before:array{chars:int,compactedTokens:int},
     *   after:array{chars:int,compactedTokens:int}
     * }
     */
    private function evaluateCompressionCandidate(
        Avatar $avatar,
        \App\Service\Llm\ChatModelPolicy $policy,
        string $currentMarkdown,
        string $candidateReply,
    ): array {
        $compressedMarkdown = $this->normalizeCompressionReply($avatar, $candidateReply);
        $beforeCompacted = $this->promptBuilder->buildCompactedMemoryMarkdown($currentMarkdown, $policy);
        $afterCompacted = $this->promptBuilder->buildCompactedMemoryMarkdown($compressedMarkdown, $policy);
        $beforeChars = mb_strlen($currentMarkdown);
        $afterChars = mb_strlen($compressedMarkdown);
        $beforeTokens = $this->tokenEstimator->estimateText($beforeCompacted);
        $afterTokens = $this->tokenEstimator->estimateText($afterCompacted);
        $changed = $compressedMarkdown !== $currentMarkdown;
        $improvesCompaction = $afterTokens < $beforeTokens;
        $improvesLength = $afterChars < $beforeChars;

        return [
            'compressedMarkdown' => $compressedMarkdown,
            'changed' => $changed,
            'shouldKeepExisting' => !$changed || (!$improvesCompaction && !$improvesLength),
            'before' => [
                'chars' => $beforeChars,
                'compactedTokens' => $beforeTokens,
            ],
            'after' => [
                'chars' => $afterChars,
                'compactedTokens' => $afterTokens,
            ],
        ];
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
