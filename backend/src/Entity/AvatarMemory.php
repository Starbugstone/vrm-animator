<?php

namespace App\Entity;

use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;

#[ORM\Entity]
#[ORM\HasLifecycleCallbacks]
class AvatarMemory
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['avatar-memory:read'])]
    private ?int $id = null;

    #[ORM\OneToOne(targetEntity: Avatar::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE', unique: true)]
    private ?Avatar $avatar = null;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private ?User $owner = null;

    #[ORM\Column(type: Types::TEXT)]
    #[Groups(['avatar-memory:read'])]
    private string $markdownContent = '';

    #[ORM\Column]
    #[Groups(['avatar-memory:read'])]
    private int $revision = 1;

    #[ORM\Column(length: 32)]
    #[Groups(['avatar-memory:read'])]
    private string $lastUpdatedBy = 'system';

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    #[Groups(['avatar-memory:read'])]
    private ?\DateTimeImmutable $createdAt = null;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    #[Groups(['avatar-memory:read'])]
    private ?\DateTimeImmutable $updatedAt = null;

    public function __construct()
    {
        $this->createdAt = new \DateTimeImmutable();
        $this->updatedAt = new \DateTimeImmutable();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getAvatar(): ?Avatar
    {
        return $this->avatar;
    }

    public function setAvatar(Avatar $avatar): static
    {
        $this->avatar = $avatar;
        return $this;
    }

    public function getOwner(): ?User
    {
        return $this->owner;
    }

    public function setOwner(User $owner): static
    {
        $this->owner = $owner;
        return $this;
    }

    public function getMarkdownContent(): string
    {
        return $this->markdownContent;
    }

    public function setMarkdownContent(string $markdownContent): static
    {
        $this->markdownContent = $markdownContent;
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

    public function getLastUpdatedBy(): string
    {
        return $this->lastUpdatedBy;
    }

    public function setLastUpdatedBy(string $lastUpdatedBy): static
    {
        $this->lastUpdatedBy = $lastUpdatedBy;
        return $this;
    }

    public function getCreatedAt(): ?\DateTimeImmutable
    {
        return $this->createdAt;
    }

    public function getUpdatedAt(): ?\DateTimeImmutable
    {
        return $this->updatedAt;
    }

    #[ORM\PreUpdate]
    public function setUpdatedAtValue(): void
    {
        $this->updatedAt = new \DateTimeImmutable();
    }
}
