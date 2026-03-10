<?php

namespace App\Entity;

use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;

#[ORM\Entity]
class AvatarMemoryRevision
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['avatar-memory-revision:read'])]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: AvatarMemory::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private ?AvatarMemory $avatarMemory = null;

    #[ORM\Column]
    #[Groups(['avatar-memory-revision:read'])]
    private int $revision = 1;

    #[ORM\Column(type: Types::TEXT)]
    #[Groups(['avatar-memory-revision:read'])]
    private string $markdownSnapshot = '';

    #[ORM\Column(length: 32)]
    #[Groups(['avatar-memory-revision:read'])]
    private string $source = 'system';

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    #[Groups(['avatar-memory-revision:read'])]
    private ?\DateTimeImmutable $createdAt = null;

    public function __construct()
    {
        $this->createdAt = new \DateTimeImmutable();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getAvatarMemory(): ?AvatarMemory
    {
        return $this->avatarMemory;
    }

    public function setAvatarMemory(AvatarMemory $avatarMemory): static
    {
        $this->avatarMemory = $avatarMemory;
        return $this;
    }

    public function getRevision(): int
    {
        return $this->revision;
    }

    public function setRevision(int $revision): static
    {
        $this->revision = $revision;
        return $this;
    }

    public function getMarkdownSnapshot(): string
    {
        return $this->markdownSnapshot;
    }

    public function setMarkdownSnapshot(string $markdownSnapshot): static
    {
        $this->markdownSnapshot = $markdownSnapshot;
        return $this;
    }

    public function getSource(): string
    {
        return $this->source;
    }

    public function setSource(string $source): static
    {
        $this->source = $source;
        return $this;
    }

    public function getCreatedAt(): ?\DateTimeImmutable
    {
        return $this->createdAt;
    }
}
