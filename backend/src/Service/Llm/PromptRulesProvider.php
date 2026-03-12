<?php

namespace App\Service\Llm;

use Symfony\Component\HttpKernel\KernelInterface;

final class PromptRulesProvider
{
    private ?string $cachedRules = null;

    public function __construct(
        private KernelInterface $kernel,
    ) {
    }

    public function getChatRules(): string
    {
        if ($this->cachedRules !== null) {
            return $this->cachedRules;
        }

        $path = $this->kernel->getProjectDir().'/prompts/chat_rules.md';
        $rules = is_file($path) ? trim((string) file_get_contents($path)) : '';

        $this->cachedRules = $rules !== '' ? $rules : 'Reply as the selected avatar and only use provided cue tags.';

        return $this->cachedRules;
    }
}
