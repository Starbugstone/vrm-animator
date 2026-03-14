<?php

namespace App\Service\Tts;

interface ElevenLabsClientInterface
{
    /**
     * @return list<array{
     *   id:string,
     *   name:string,
     *   gender:?string,
     *   labels:array<string, string>,
     *   category:?string,
     *   description:?string,
     *   previewUrl:?string
     * }>
     */
    public function listVoices(string $secret): array;

    /**
     * @param callable(string):void $onChunk
     */
    public function streamSpeech(
        string $secret,
        string $voiceId,
        string $text,
        ?string $modelId,
        callable $onChunk,
    ): void;
}
