<?php

namespace App\Service\Llm;

final class TokenEstimator
{
    public function estimateText(string $text): int
    {
        $characters = mb_strlen(trim($text));
        if ($characters === 0) {
            return 0;
        }

        return $this->estimateCharacters($characters);
    }

    public function estimateCharacters(int $characters): int
    {
        if ($characters <= 0) {
            return 0;
        }

        return (int) ceil($characters / 4);
    }
}
