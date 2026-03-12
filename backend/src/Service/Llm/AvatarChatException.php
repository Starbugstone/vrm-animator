<?php

namespace App\Service\Llm;

final class AvatarChatException extends \RuntimeException
{
    public function __construct(
        string $message,
        private int $statusCode,
        ?\Throwable $previous = null,
    ) {
        parent::__construct($message, 0, $previous);
    }

    public function getStatusCode(): int
    {
        return $this->statusCode;
    }
}
