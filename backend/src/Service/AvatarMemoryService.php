<?php

namespace App\Service;

use App\Entity\Avatar;
use App\Entity\AvatarMemory;
use App\Entity\AvatarMemoryRevision;
use Doctrine\ORM\EntityManagerInterface;

class AvatarMemoryService
{
    public function __construct(
        private EntityManagerInterface $entityManager,
    ) {
    }

    public function getOrCreateMemory(Avatar $avatar, string $source = 'system'): AvatarMemory
    {
        /** @var AvatarMemory|null $memory */
        $memory = $this->entityManager->getRepository(AvatarMemory::class)->findOneBy(['avatar' => $avatar]);
        if ($memory !== null) {
            return $memory;
        }

        $memory = (new AvatarMemory())
            ->setAvatar($avatar)
            ->setOwner($avatar->getOwner())
            ->setMarkdownContent($this->buildDefaultMarkdown($avatar))
            ->setRevision(1)
            ->setLastUpdatedBy($source);

        $this->entityManager->persist($memory);
        $this->entityManager->flush();

        $this->createRevision($memory, $source);
        $this->entityManager->flush();

        return $memory;
    }

    public function syncAvatarIdentity(Avatar $avatar, string $source = 'system'): AvatarMemory
    {
        $memory = $this->getOrCreateMemory($avatar, $source);
        $updatedMarkdown = $this->replaceSection(
            $memory->getMarkdownContent(),
            'Avatar Identity',
            $this->buildIdentitySection($avatar),
        );

        if ($updatedMarkdown === $memory->getMarkdownContent()) {
            return $memory;
        }

        return $this->saveMemory($memory, $updatedMarkdown, $source);
    }

    public function updateMemory(Avatar $avatar, string $markdownContent, int $expectedRevision, string $source = 'user'): AvatarMemory
    {
        $memory = $this->getOrCreateMemory($avatar, $source);

        if ($memory->getRevision() !== $expectedRevision) {
            throw new \RuntimeException('Memory revision conflict.');
        }

        return $this->saveMemory($memory, trim($markdownContent), $source);
    }

    /**
     * @param list<string> $entries
     */
    public function appendRelationshipMemory(Avatar $avatar, array $entries, string $source = 'assistant'): AvatarMemory
    {
        $memory = $this->getOrCreateMemory($avatar, $source);
        $normalizedEntries = [];

        foreach ($entries as $entry) {
            $normalized = trim((string) $entry);
            $normalized = preg_replace('/\s+/', ' ', $normalized) ?? $normalized;
            if ($normalized === '') {
                continue;
            }

            $normalizedEntries[] = $normalized;
        }

        $normalizedEntries = array_values(array_unique($normalizedEntries));
        if ($normalizedEntries === []) {
            return $memory;
        }

        $updatedMarkdown = $this->appendBulletsToSection(
            $memory->getMarkdownContent(),
            'Relationship Memory',
            $normalizedEntries,
        );

        if ($updatedMarkdown === $memory->getMarkdownContent()) {
            return $memory;
        }

        return $this->saveMemory($memory, $updatedMarkdown, $source);
    }

    /**
     * @return list<AvatarMemoryRevision>
     */
    public function listRevisions(AvatarMemory $memory): array
    {
        /** @var list<AvatarMemoryRevision> $revisions */
        $revisions = $this->entityManager->getRepository(AvatarMemoryRevision::class)->findBy(
            ['avatarMemory' => $memory],
            ['revision' => 'DESC'],
        );

        return $revisions;
    }

    private function saveMemory(AvatarMemory $memory, string $markdownContent, string $source): AvatarMemory
    {
        $memory
            ->setMarkdownContent($markdownContent)
            ->setRevision($memory->getRevision() + 1)
            ->setLastUpdatedBy($source);

        $this->entityManager->persist($memory);
        $this->createRevision($memory, $source);
        $this->entityManager->flush();

        return $memory;
    }

    private function createRevision(AvatarMemory $memory, string $source): void
    {
        $revision = (new AvatarMemoryRevision())
            ->setAvatarMemory($memory)
            ->setRevision($memory->getRevision())
            ->setMarkdownSnapshot($memory->getMarkdownContent())
            ->setSource($source);

        $this->entityManager->persist($revision);
    }

    private function buildDefaultMarkdown(Avatar $avatar): string
    {
        return implode("\n", [
            '# Avatar Memory',
            '',
            '## Avatar Identity',
            $this->buildIdentitySection($avatar),
            '',
            '## Relationship Memory',
            '- important facts about the user',
            '- promises made',
            '- preferences',
            '- recurring topics',
            '',
            '## Behavioral Rules',
            '- stay in character',
            '- keep responses grounded in the avatar profile',
            '',
            '## Notes',
            '- add long-term notes here',
        ]);
    }

    private function buildIdentitySection(Avatar $avatar): string
    {
        return implode("\n", [
            sprintf('- name: %s', $avatar->getName() ?: ''),
            sprintf('- backstory: %s', $avatar->getBackstory() ?: ''),
            sprintf('- personality: %s', $avatar->getPersonality() ?: ''),
            sprintf('- system_prompt: %s', $avatar->getSystemPrompt() ?: ''),
        ]);
    }

    private function replaceSection(string $markdown, string $sectionTitle, string $replacementBody): string
    {
        $pattern = sprintf('/## %s\n.*?(?=\n## |\z)/s', preg_quote($sectionTitle, '/'));
        $replacement = sprintf("## %s\n%s", $sectionTitle, trim($replacementBody));

        if (preg_match($pattern, $markdown) !== 1) {
            return rtrim($markdown)."\n\n".$replacement;
        }

        return preg_replace($pattern, $replacement, $markdown) ?? $markdown;
    }

    /**
     * @param list<string> $entries
     */
    private function appendBulletsToSection(string $markdown, string $sectionTitle, array $entries): string
    {
        $pattern = sprintf('/(## %s\n)(.*?)(?=\n## |\z)/s', preg_quote($sectionTitle, '/'));
        if (preg_match($pattern, $markdown, $matches) !== 1) {
            $body = implode("\n", array_map(static fn (string $entry): string => '- '.$entry, $entries));

            return rtrim($markdown)."\n\n## ".$sectionTitle."\n".$body;
        }

        $prefix = $matches[1];
        $body = trim((string) ($matches[2] ?? ''));
        $existingLines = $body !== '' ? preg_split('/\R/', $body) ?: [] : [];
        $existingLookup = [];

        foreach ($existingLines as $line) {
            $normalized = strtolower(trim(preg_replace('/^- /', '', (string) $line) ?? (string) $line));
            if ($normalized !== '') {
                $existingLookup[$normalized] = true;
            }
        }

        foreach ($entries as $entry) {
            $normalizedEntry = strtolower(trim($entry));
            if ($normalizedEntry === '' || array_key_exists($normalizedEntry, $existingLookup)) {
                continue;
            }

            $existingLines[] = '- '.$entry;
            $existingLookup[$normalizedEntry] = true;
        }

        $replacement = $prefix.trim(implode("\n", $existingLines));

        return preg_replace($pattern, $replacement, $markdown) ?? $markdown;
    }
}
