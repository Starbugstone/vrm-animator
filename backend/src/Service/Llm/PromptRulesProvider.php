<?php

namespace App\Service\Llm;

use Symfony\Component\HttpKernel\KernelInterface;

final class PromptRulesProvider
{
    private ?string $cachedRules = null;
    private ?string $cachedMemoryRules = null;
    private ?string $cachedMemoryCompressionRules = null;

    public function __construct(
        private KernelInterface $kernel,
    ) {
    }

    public function getChatRules(): string
    {
        return $this->cachedRules ??= $this->loadPrompt(
            'chat_rules.md',
            'Reply as the selected avatar and only use provided cue tags.',
        );
    }

    public function getMemoryRules(): string
    {
        return $this->cachedMemoryRules ??= $this->loadPrompt(
            'memory_rules.md',
            'Use memory as durable long-term relationship context and only save facts that matter later.',
        );
    }

    public function getMemoryCompressionRules(): string
    {
        return $this->cachedMemoryCompressionRules ??= $this->loadPrompt(
            'memory_compression_rules.md',
            'Compress the avatar memory into shorter markdown while keeping durable facts.',
        );
    }

    private function loadPrompt(string $filename, string $fallback): string
    {
        $path = $this->kernel->getProjectDir().'/prompts/'.$filename;
        $rules = is_file($path) ? trim((string) file_get_contents($path)) : '';

        return $rules !== '' ? $rules : $fallback;
    }
}
