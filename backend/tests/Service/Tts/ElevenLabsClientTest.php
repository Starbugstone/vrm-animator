<?php

namespace App\Tests\Service\Tts;

use App\Service\Tts\ElevenLabsClient;
use PHPUnit\Framework\TestCase;

class ElevenLabsClientTest extends TestCase
{
    public function testListVoicesFallsBackToLegacyEndpointWhenSearchCatalogIsUnavailable(): void
    {
        $client = new class extends ElevenLabsClient {
            protected function listVoicesFromSearchEndpoint(string $secret): array
            {
                throw new \RuntimeException('Missing endpoint', 404);
            }

            protected function listVoicesFromLegacyEndpoint(string $secret): array
            {
                return [
                    ['id' => '2', 'name' => 'Beta', 'gender' => 'male', 'language' => 'en', 'locale' => 'en-US'],
                    ['id' => '1', 'name' => 'Alpha', 'gender' => 'female', 'language' => 'fr', 'locale' => 'fr-FR'],
                ];
            }
        };

        $voices = $client->listVoices('secret');

        $this->assertSame(['1', '2'], array_column($voices, 'id'));
    }

    public function testNormalizeVoicePreservesLanguageAndSharingMetadata(): void
    {
        $client = new class extends ElevenLabsClient {
            public function exposeNormalizeVoice(mixed $voice): ?array
            {
                return $this->normalizeVoice($voice);
            }
        };

        $normalized = $client->exposeNormalizeVoice([
            'voice_id' => 'voice_fr_1',
            'name' => 'Claire',
            'category' => 'premade',
            'preview_url' => 'https://example.com/claire.mp3',
            'sharing' => [
                'description' => 'Bright and conversational',
                'labels' => [
                    'accent' => 'parisian',
                    'language' => 'fr',
                ],
            ],
            'labels' => [
                'gender' => 'female',
            ],
            'verified_languages' => [
                [
                    'language' => 'fr',
                    'locale' => 'fr-FR',
                    'accent' => 'parisian',
                    'model_id' => 'eleven_flash_v2_5',
                ],
            ],
        ]);

        $this->assertSame('voice_fr_1', $normalized['id']);
        $this->assertSame('female', $normalized['gender']);
        $this->assertSame('fr', $normalized['language']);
        $this->assertSame('fr-FR', $normalized['locale']);
        $this->assertSame('Bright and conversational', $normalized['description']);
        $this->assertSame('parisian', $normalized['labels']['accent']);
        $this->assertSame('fr-FR', $normalized['verifiedLanguages'][0]['locale']);
    }
}
