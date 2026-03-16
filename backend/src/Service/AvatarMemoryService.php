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

        return $this->saveMemory($memory, $markdownContent, $source);
    }

    public function resetMemory(Avatar $avatar, string $source = 'user'): AvatarMemory
    {
        $memory = $this->getOrCreateMemory($avatar, $source);
        $defaultMarkdown = $this->buildDefaultMarkdown($avatar);

        if ($memory->getMarkdownContent() === $defaultMarkdown) {
            return $memory;
        }

        return $this->saveMemory($memory, $defaultMarkdown, $source);
    }

    /**
     * @param list<array{scope:string,value:string}> $entries
     */
    public function appendMemoryEntries(Avatar $avatar, array $entries, string $source = 'assistant'): AvatarMemory
    {
        $memory = $this->getOrCreateMemory($avatar, $source);
        $groupedEntries = [
            'relationship' => [],
            'long-term' => [],
        ];

        foreach ($entries as $entry) {
            $scope = strtolower(trim((string) ($entry['scope'] ?? 'relationship')));
            $scope = $scope === 'long-term' ? 'long-term' : 'relationship';
            $normalized = trim((string) ($entry['value'] ?? ''));
            $normalized = preg_replace('/\s+/', ' ', $normalized) ?? $normalized;
            if ($normalized === '') {
                continue;
            }

            $groupedEntries[$scope][] = $normalized;
        }

        $groupedEntries = [
            'relationship' => array_values(array_unique($groupedEntries['relationship'])),
            'long-term' => array_values(array_unique($groupedEntries['long-term'])),
        ];
        if ($groupedEntries['relationship'] === [] && $groupedEntries['long-term'] === []) {
            return $memory;
        }

        $updatedMarkdown = $memory->getMarkdownContent();
        if ($groupedEntries['relationship'] !== []) {
            $updatedMarkdown = $this->appendBulletsToSection(
                $updatedMarkdown,
                'Relationship Memory',
                $groupedEntries['relationship'],
            );
        }
        if ($groupedEntries['long-term'] !== []) {
            $updatedMarkdown = $this->appendBulletsToSection(
                $updatedMarkdown,
                'Long-Term Memory',
                $groupedEntries['long-term'],
            );
        }

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
        $avatar = $memory->getAvatar();
        if ($avatar === null) {
            throw new \RuntimeException('Avatar memory is not linked to an avatar.');
        }

        $normalizedMarkdown = $this->normalizeMemoryMarkdown($avatar, $markdownContent);
        if ($normalizedMarkdown === $memory->getMarkdownContent()) {
            return $memory;
        }

        $memory
            ->setMarkdownContent($normalizedMarkdown)
            ->setRevision($memory->getRevision() + 1)
            ->setLastUpdatedBy($source);

        $this->entityManager->persist($memory);
        $this->createRevision($memory, $source);
        $this->entityManager->flush();

        return $memory;
    }

    public function normalizeMemoryMarkdown(Avatar $avatar, string $markdownContent): string
    {
        $normalized = trim(str_replace("\r\n", "\n", $markdownContent));
        if ($normalized === '') {
            return $this->buildDefaultMarkdown($avatar);
        }

        if (!str_starts_with($normalized, '# Avatar Memory')) {
            $normalized = "# Avatar Memory\n\n".$normalized;
        }

        $normalized = $this->replaceSection(
            $normalized,
            'Avatar Identity',
            $this->buildIdentitySection($avatar),
        );

        $normalized = $this->ensureSectionExists(
            $normalized,
            'Relationship Memory',
            "- important facts about the user\n- promises made\n- preferences\n- recurring topics",
        );
        $normalized = $this->ensureSectionExists(
            $normalized,
            'Long-Term Memory',
            "- durable facts that should stay true across future chats\n- ongoing goals or situations that may come back later",
        );
        $normalized = $this->ensureSectionExists(
            $normalized,
            'Behavioral Rules',
            "- stay in character\n- keep responses grounded in the avatar profile",
        );
        $normalized = $this->ensureSectionExists(
            $normalized,
            'Notes',
            '- add long-term notes here',
        );

        return trim($normalized);
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
            '## Long-Term Memory',
            '- durable facts that should stay true across future chats',
            '- ongoing goals or situations that may come back later',
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
            sprintf('- presentation_gender: %s', $avatar->getPresentationGender() ?: ''),
            sprintf('- speech_voice_gender: %s', $avatar->getSpeechVoiceGender() ?: ''),
            sprintf('- speech_language: %s', $avatar->getSpeechLanguage()),
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

    private function ensureSectionExists(string $markdown, string $sectionTitle, string $defaultBody): string
    {
        $pattern = sprintf('/## %s\n.*?(?=\n## |\z)/s', preg_quote($sectionTitle, '/'));
        if (preg_match($pattern, $markdown) === 1) {
            return $markdown;
        }

        return rtrim($markdown)."\n\n## ".$sectionTitle."\n".trim($defaultBody);
    }
}
