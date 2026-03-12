<?php

namespace App\Entity;

use App\Repository\ConversationMessageRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: ConversationMessageRepository::class)]
#[ORM\Table(name: 'conversation_message')]
class ConversationMessage
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: Conversation::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private ?Conversation $conversation = null;

    #[ORM\Column(length: 16)]
    private string $role = '';

    #[ORM\Column(type: Types::TEXT)]
    private string $content = '';

    #[ORM\Column(type: Types::TEXT, nullable: true)]
    private ?string $rawProviderContent = null;

    #[ORM\Column(type: Types::TEXT, nullable: true)]
    private ?string $parsedText = null;

    /** @var list<string> */
    #[ORM\Column(type: Types::JSON)]
    private array $parsedEmotionTags = [];

    /** @var list<string> */
    #[ORM\Column(type: Types::JSON)]
    private array $parsedAnimationTags = [];

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private ?\DateTimeImmutable $createdAt = null;

    public function __construct()
    {
        $this->createdAt = new \DateTimeImmutable();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getConversation(): ?Conversation
    {
        return $this->conversation;
    }

    public function setConversation(Conversation $conversation): static
    {
        $this->conversation = $conversation;

        return $this;
    }

    public function getRole(): string
    {
        return $this->role;
    }

    public function setRole(string $role): static
    {
        $this->role = $role;

        return $this;
    }

    public function getContent(): string
    {
        return $this->content;
    }

    public function setContent(string $content): static
    {
        $this->content = $content;

        return $this;
    }

    public function getRawProviderContent(): ?string
    {
        return $this->rawProviderContent;
    }

    public function setRawProviderContent(?string $rawProviderContent): static
    {
        $this->rawProviderContent = $rawProviderContent;

        return $this;
    }

    public function getParsedText(): ?string
    {
        return $this->parsedText;
    }

    public function setParsedText(?string $parsedText): static
    {
        $this->parsedText = $parsedText;

        return $this;
    }

    /**
     * @return list<string>
     */
    public function getParsedEmotionTags(): array
    {
        return $this->parsedEmotionTags;
    }

    /**
     * @param list<string> $parsedEmotionTags
     */
    public function setParsedEmotionTags(array $parsedEmotionTags): static
    {
        $this->parsedEmotionTags = array_values(array_unique(array_map('strval', $parsedEmotionTags)));

        return $this;
    }

    /**
     * @return list<string>
     */
    public function getParsedAnimationTags(): array
    {
        return $this->parsedAnimationTags;
    }

    /**
     * @param list<string> $parsedAnimationTags
     */
    public function setParsedAnimationTags(array $parsedAnimationTags): static
    {
        $this->parsedAnimationTags = array_values(array_unique(array_map('strval', $parsedAnimationTags)));

        return $this;
    }

    public function getCreatedAt(): ?\DateTimeImmutable
    {
        return $this->createdAt;
    }
}
