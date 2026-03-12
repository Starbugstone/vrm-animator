<?php

namespace App\Entity;

use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Delete;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\GetCollection;
use ApiPlatform\Metadata\Patch;
use App\Repository\AnimationRepository;
use App\State\AnimationDeleteProcessor;
use App\State\AnimationOwnedItemProvider;
use App\State\AnimationOwnedProvider;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;
use Symfony\Component\Validator\Constraints as Assert;

#[ORM\Entity(repositoryClass: AnimationRepository::class)]
#[ORM\HasLifecycleCallbacks]
#[ApiResource(
    operations: [
        new GetCollection(
            normalizationContext: ['groups' => ['animation:read']],
            provider: AnimationOwnedProvider::class,
        ),
        new Get(
            normalizationContext: ['groups' => ['animation:read']],
            provider: AnimationOwnedItemProvider::class,
        ),
        new Patch(
            normalizationContext: ['groups' => ['animation:read']],
            denormalizationContext: ['groups' => ['animation:write']],
            provider: AnimationOwnedItemProvider::class,
        ),
        new Delete(
            provider: AnimationOwnedItemProvider::class,
            processor: AnimationDeleteProcessor::class,
        ),
    ],
    normalizationContext: ['groups' => ['animation:read']],
    denormalizationContext: ['groups' => ['animation:write']],
)]
class Animation
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['animation:read'])]
    private ?int $id = null;

    #[ORM\Column(length: 255)]
    #[Assert\NotBlank]
    #[Groups(['animation:read', 'animation:write'])]
    private ?string $name = null;

    #[ORM\Column(length: 255)]
    #[Assert\NotBlank]
    #[Groups(['animation:read', 'animation:write'])]
    private ?string $filename = null;

    #[ORM\Column(length: 255, nullable: true)]
    #[Groups(['animation:read'])]
    private ?string $storedFilename = null;

    #[ORM\Column(length: 255, nullable: true)]
    #[Groups(['animation:read'])]
    private ?string $mimeType = null;

    #[ORM\Column(nullable: true)]
    #[Groups(['animation:read'])]
    private ?int $sizeBytes = null;

    #[ORM\Column(type: Types::TEXT, nullable: true)]
    #[Groups(['animation:read', 'animation:write'])]
    private ?string $description = null;

    /** @var list<string> */
    #[ORM\Column(type: Types::JSON)]
    #[Groups(['animation:read', 'animation:write'])]
    private array $keywords = [];

    /** @var list<string> */
    #[ORM\Column(type: Types::JSON)]
    #[Groups(['animation:read', 'animation:write'])]
    private array $emotionTags = [];

    #[ORM\Column(length: 32)]
    #[Groups(['animation:read', 'animation:write'])]
    private string $kind = 'action';

    #[ORM\Column(type: Types::BOOLEAN)]
    #[Groups(['animation:read', 'animation:write'])]
    private bool $isDefault = false;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    #[Groups(['animation:read'])]
    private ?\DateTimeImmutable $createdAt = null;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    #[Groups(['animation:read'])]
    private ?\DateTimeImmutable $updatedAt = null;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private ?User $owner = null;

    #[ORM\ManyToOne(targetEntity: Avatar::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    #[Groups(['animation:read', 'animation:write'])]
    private ?Avatar $avatar = null;

    public function __construct()
    {
        $this->createdAt = new \DateTimeImmutable();
        $this->updatedAt = new \DateTimeImmutable();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getName(): ?string
    {
        return $this->name;
    }

    public function setName(string $name): static
    {
        $this->name = $name;
        return $this;
    }

    public function getFilename(): ?string
    {
        return $this->filename;
    }

    public function setFilename(string $filename): static
    {
        $this->filename = $filename;
        return $this;
    }

    public function getStoredFilename(): ?string
    {
        return $this->storedFilename;
    }

    public function setStoredFilename(?string $storedFilename): static
    {
        $this->storedFilename = $storedFilename;
        return $this;
    }

    public function getMimeType(): ?string
    {
        return $this->mimeType;
    }

    public function setMimeType(?string $mimeType): static
    {
        $this->mimeType = $mimeType;
        return $this;
    }

    public function getSizeBytes(): ?int
    {
        return $this->sizeBytes;
    }

    public function setSizeBytes(?int $sizeBytes): static
    {
        $this->sizeBytes = $sizeBytes;
        return $this;
    }

    public function getDescription(): ?string
    {
        return $this->description;
    }

    public function setDescription(?string $description): static
    {
        $this->description = $description;
        return $this;
    }

    /** @return list<string> */
    public function getKeywords(): array
    {
        return $this->keywords;
    }

    /** @param list<string> $keywords */
    public function setKeywords(array $keywords): static
    {
        $this->keywords = array_values(array_unique(array_filter(array_map('strval', $keywords))));
        return $this;
    }

    /** @return list<string> */
    public function getEmotionTags(): array
    {
        return $this->emotionTags;
    }

    /** @param list<string> $emotionTags */
    public function setEmotionTags(array $emotionTags): static
    {
        $normalized = array_map(
            static fn (mixed $value): string => strtolower(trim((string) $value)),
            $emotionTags,
        );
        $this->emotionTags = array_values(array_unique(array_filter($normalized)));

        return $this;
    }

    public function getKind(): string
    {
        return $this->kind;
    }

    public function setKind(string $kind): static
    {
        $this->kind = $kind;
        return $this;
    }

    public function isDefault(): bool
    {
        return $this->isDefault;
    }

    public function getIsDefault(): bool
    {
        return $this->isDefault;
    }

    public function setIsDefault(bool $isDefault): static
    {
        $this->isDefault = $isDefault;
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

    public function getOwner(): ?User
    {
        return $this->owner;
    }

    public function setOwner(?User $owner): static
    {
        $this->owner = $owner;
        return $this;
    }

    public function getAvatar(): ?Avatar
    {
        return $this->avatar;
    }

    public function setAvatar(?Avatar $avatar): static
    {
        $this->avatar = $avatar;
        return $this;
    }
}
