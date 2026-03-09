<?php

namespace App\Entity;

use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Delete;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\GetCollection;
use ApiPlatform\Metadata\Patch;
use ApiPlatform\Metadata\Post;
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
            security: "object.getOwner() == user",
        ),
        new Post(
            normalizationContext: ['groups' => ['avatar:read']],
            denormalizationContext: ['groups' => ['avatar:write']],
            processor: AvatarSetOwnerProcessor::class,
        ),
        new Patch(
            normalizationContext: ['groups' => ['avatar:read']],
            denormalizationContext: ['groups' => ['avatar:write']],
            security: "object.getOwner() == user",
        ),
        new Delete(
            security: "object.getOwner() == user",
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

    #[ORM\Column(length: 255)]
    #[Groups(['avatar:read', 'avatar:write', 'user:read'])]
    private ?string $filename = null;

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

    public function getFilename(): ?string
    {
        return $this->filename;
    }

    public function setFilename(string $filename): static
    {
        $this->filename = $filename;
        return $this;
    }

    public function isDefault(): bool
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
