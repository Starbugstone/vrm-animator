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
}
