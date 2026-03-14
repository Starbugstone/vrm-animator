<?php

namespace App\Entity;

use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Delete;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\GetCollection;
use ApiPlatform\Metadata\Patch;
use ApiPlatform\Metadata\Post;
use App\State\AvatarDeleteProcessor;
use App\State\AvatarOwnedItemProvider;
use App\State\AvatarOwnedProvider;
use App\State\AvatarSetOwnerProcessor;
use App\Repository\AvatarRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Attribute\Groups;
use Symfony\Component\Validator\Constraints as Assert;

#[ORM\Entity(repositoryClass: AvatarRepository::class)]
#[ORM\HasLifecycleCallbacks]
#[ApiResource(
    operations: [
        new GetCollection(
            normalizationContext: ['groups' => ['avatar:read']],
            provider: AvatarOwnedProvider::class,
        ),
        new Get(
            normalizationContext: ['groups' => ['avatar:read']],
            provider: AvatarOwnedItemProvider::class,
        ),
        new Post(
            normalizationContext: ['groups' => ['avatar:read']],
            denormalizationContext: ['groups' => ['avatar:write']],
            processor: AvatarSetOwnerProcessor::class,
        ),
        new Patch(
            normalizationContext: ['groups' => ['avatar:read']],
            denormalizationContext: ['groups' => ['avatar:write']],
            provider: AvatarOwnedItemProvider::class,
            processor: AvatarSetOwnerProcessor::class,
        ),
        new Delete(
            provider: AvatarOwnedItemProvider::class,
            processor: AvatarDeleteProcessor::class,
        ),
    ],
    normalizationContext: ['groups' => ['avatar:read']],
    denormalizationContext: ['groups' => ['avatar:write']],
)]
class Avatar
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['avatar:read', 'user:read'])]
    private ?int $id = null;

    #[ORM\Column(length: 255)]
    #[Assert\NotBlank]
    #[Groups(['avatar:read', 'avatar:write', 'user:read'])]
    private ?string $name = null;

    #[ORM\Column(type: Types::TEXT, nullable: true)]
    #[Groups(['avatar:read', 'avatar:write'])]
    private ?string $backstory = null;

    #[ORM\Column(type: Types::TEXT, nullable: true)]
    #[Groups(['avatar:read', 'avatar:write'])]
    private ?string $personality = null;

    #[ORM\Column(type: Types::TEXT, nullable: true)]
    private ?string $systemPrompt = null;

    #[ORM\Column(length: 16, nullable: true)]
    #[Groups(['avatar:read', 'avatar:write'])]
    private ?string $speechVoiceGender = null;

    #[ORM\Column(length: 16, nullable: true)]
    #[Groups(['avatar:read', 'avatar:write'])]
    private ?string $presentationGender = null;

    #[ORM\Column(length: 16)]
    #[Groups(['avatar:read', 'avatar:write'])]
    private string $speechLanguage = 'auto';

    #[ORM\ManyToOne(targetEntity: TtsCredential::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?TtsCredential $ttsCredential = null;

    #[ORM\Column(length: 128, nullable: true)]
    #[Groups(['avatar:read'])]
    private ?string $ttsVoiceId = null;

    #[ORM\Column(length: 255, nullable: true)]
    #[Groups(['avatar:read'])]
    private ?string $ttsVoiceName = null;

    #[ORM\Column(length: 16, nullable: true)]
    #[Groups(['avatar:read'])]
    private ?string $ttsVoiceGenderTag = null;

    #[ORM\Column(length: 255)]
    #[Groups(['avatar:read', 'avatar:write', 'user:read'])]
    private ?string $filename = null;

    #[ORM\Column(length: 255, nullable: true)]
    #[Groups(['avatar:read'])]
    private ?string $storedFilename = null;

    #[ORM\Column(length: 255, nullable: true)]
    #[Groups(['avatar:read'])]
    private ?string $mimeType = null;

    #[ORM\Column(nullable: true)]
    #[Groups(['avatar:read'])]
    private ?int $sizeBytes = null;

    #[ORM\Column(type: Types::BOOLEAN)]
    #[Groups(['avatar:read', 'avatar:write', 'user:read'])]
    private bool $isDefault = false;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    #[Groups(['avatar:read'])]
    private ?\DateTimeImmutable $createdAt = null;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    #[Groups(['avatar:read'])]
    private ?\DateTimeImmutable $updatedAt = null;

    #[ORM\ManyToOne(targetEntity: User::class, inversedBy: 'avatars')]
    #[ORM\JoinColumn(nullable: false)]
    #[Groups(['avatar:read'])]
    private ?User $owner = null;

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

    public function getBackstory(): ?string
    {
        return $this->backstory;
    }

    public function setBackstory(?string $backstory): static
    {
        $this->backstory = $backstory;
        return $this;
    }

    public function getPersonality(): ?string
    {
        return $this->personality;
    }

    public function setPersonality(?string $personality): static
    {
        $this->personality = $personality;
        return $this;
    }

    public function getSystemPrompt(): ?string
    {
        return $this->systemPrompt;
    }

    public function setSystemPrompt(?string $systemPrompt): static
    {
        $this->systemPrompt = $systemPrompt;
        return $this;
    }

    public function getFilename(): ?string
    {
        return $this->filename;
    }

    public function getSpeechVoiceGender(): ?string
    {
        return $this->speechVoiceGender;
    }

    public function setSpeechVoiceGender(?string $speechVoiceGender): static
    {
        $this->speechVoiceGender = $speechVoiceGender;

        return $this;
    }

    public function getPresentationGender(): ?string
    {
        return $this->presentationGender;
    }

    public function setPresentationGender(?string $presentationGender): static
    {
        $this->presentationGender = $presentationGender;

        return $this;
    }

    public function getSpeechLanguage(): string
    {
        return $this->speechLanguage;
    }

    public function setSpeechLanguage(string $speechLanguage): static
    {
        $this->speechLanguage = $speechLanguage;

        return $this;
    }

    public function getTtsCredential(): ?TtsCredential
    {
        return $this->ttsCredential;
    }

    public function setTtsCredential(?TtsCredential $ttsCredential): static
    {
        $this->ttsCredential = $ttsCredential;

        return $this;
    }

    #[Groups(['avatar:read'])]
    public function getTtsCredentialId(): ?int
    {
        return $this->ttsCredential?->getId();
    }

    #[Groups(['avatar:read'])]
    public function getTtsProvider(): ?string
    {
        return $this->ttsCredential !== null ? 'elevenlabs' : null;
    }

    public function getTtsVoiceId(): ?string
    {
        return $this->ttsVoiceId;
    }

    public function setTtsVoiceId(?string $ttsVoiceId): static
    {
        $this->ttsVoiceId = $ttsVoiceId;

        return $this;
    }

    public function getTtsVoiceName(): ?string
    {
        return $this->ttsVoiceName;
    }

    public function setTtsVoiceName(?string $ttsVoiceName): static
    {
        $this->ttsVoiceName = $ttsVoiceName;

        return $this;
    }

    public function getTtsVoiceGenderTag(): ?string
    {
        return $this->ttsVoiceGenderTag;
    }

    public function setTtsVoiceGenderTag(?string $ttsVoiceGenderTag): static
    {
        $this->ttsVoiceGenderTag = $ttsVoiceGenderTag;

        return $this;
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
}
