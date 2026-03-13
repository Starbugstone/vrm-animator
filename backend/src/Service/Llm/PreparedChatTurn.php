<?php

namespace App\Service\Llm;

use App\Entity\Avatar;
use App\Entity\AvatarPersona;
use App\Entity\Conversation;
use App\Entity\LlmCredential;
use App\Entity\User;

final readonly class PreparedChatTurn
{
    /**
     * @param list<CueAsset> $assets
     * @param list<array{role:string,content:string}> $providerMessages
     */
    public function __construct(
        public User $user,
        public Avatar $avatar,
        public string $message,
        public ?Conversation $conversation,
        public ?AvatarPersona $persona,
        public LlmCredential $credential,
        public string $provider,
        public string $model,
        public ChatModelPolicy $modelPolicy,
        public array $assets,
        public array $providerMessages,
    ) {
    }
}
