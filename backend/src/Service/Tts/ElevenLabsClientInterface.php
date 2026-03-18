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
     * @param array<string, scalar|null> $filters
     *
     * @return array{
     *   voices:list<array{
     *     id:string,
     *     voiceId:string,
     *     publicOwnerId:string,
     *     name:string,
     *     gender:?string,
     *     labels:array<string, string>,
     *     category:?string,
     *     description:?string,
     *     previewUrl:?string,
     *     language:?string,
     *     locale:?string
     *   }>,
     *   nextPage:?int
     * }
     */
    public function listSharedVoices(string $secret, array $filters = []): array;

    /**
     * @return array{voiceId:?string,name:?string}
     */
    public function addSharedVoice(string $secret, string $publicUserId, string $voiceId, string $name): array;

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
