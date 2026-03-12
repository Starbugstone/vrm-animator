<?php

namespace App\Entity;

use App\Repository\LlmCredentialRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: LlmCredentialRepository::class)]
#[ORM\Table(name: 'llm_credential')]
#[ORM\HasLifecycleCallbacks]
class LlmCredential
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private ?User $owner = null;

    #[ORM\Column(length: 255)]
    private string $name = '';

    #[ORM\Column(length: 32)]
    private string $provider = '';

    #[ORM\Column(type: Types::TEXT)]
    private string $encryptedSecret = '';

    #[ORM\Column(length: 255, nullable: true)]
    private ?string $defaultModel = null;

    #[ORM\Column(type: Types::BOOLEAN)]
    private bool $isActive = true;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private ?\DateTimeImmutable $createdAt = null;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
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

    public function getOwner(): ?User
    {
        return $this->owner;
    }

    public function setOwner(User $owner): static
    {
        $this->owner = $owner;
        return $this;
    }

    public function getProvider(): string
    {
        return $this->provider;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(string $name): static
    {
        $this->name = $name;
        return $this;
    }

    public function setProvider(string $provider): static
    {
        $this->provider = $provider;
        return $this;
    }

    public function getEncryptedSecret(): string
    {
        return $this->encryptedSecret;
    }

    public function setEncryptedSecret(string $encryptedSecret): static
    {
        $this->encryptedSecret = $encryptedSecret;
        return $this;
    }

    public function getDefaultModel(): ?string
    {
        return $this->defaultModel;
    }

    public function setDefaultModel(?string $defaultModel): static
    {
        $this->defaultModel = $defaultModel;
        return $this;
    }

    public function isActive(): bool
    {
        return $this->isActive;
    }

    public function setIsActive(bool $isActive): static
    {
        $this->isActive = $isActive;
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
