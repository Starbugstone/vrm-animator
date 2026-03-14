<?php

namespace App\Tests\Api;

use App\Service\Tts\ElevenLabsClient;
use App\Service\Tts\ElevenLabsClientInterface;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

class TtsCredentialTest extends WebTestCase
{
    protected function tearDown(): void
    {
        ElevenLabsClient::setTestDouble(null);

        parent::tearDown();
    }

    private function registerUser($client, string $email): string
    {
        $client->request('POST', '/api/register', [], [], [
            'CONTENT_TYPE' => 'application/json',
        ], json_encode([
            'email' => $email,
            'password' => 'password123',
            'displayName' => 'TTS User',
        ]));

        $data = json_decode($client->getResponse()->getContent(), true);

        return $data['token'];
    }

    public function testTtsProvidersAndCredentialsCanBeManagedWithoutExposingRawSecret(): void
    {
        $client = static::createClient();
        $token = $this->registerUser($client, 'tts-owner@example.com');

        $client->request('GET', '/api/tts/providers', [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$token,
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertResponseStatusCodeSame(200);
        $providers = json_decode($client->getResponse()->getContent(), true);
        $this->assertSame('elevenlabs', $providers['providers'][0]['id']);
        $this->assertSame('eleven_flash_v2_5', $providers['providers'][0]['defaultModel']);

        $client->request('POST', '/api/tts/credentials', [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$token,
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT' => 'application/json',
        ], json_encode([
            'name' => 'Main ElevenLabs',
            'secret' => 'elevenlabs-secret-token',
            'defaultModel' => 'eleven_multilingual_v2',
            'isActive' => true,
        ]));

        $this->assertResponseStatusCodeSame(201);
        $created = json_decode($client->getResponse()->getContent(), true);
        $this->assertSame('elevenlabs', $created['provider']);
        $this->assertSame('Main ElevenLabs', $created['name']);
        $this->assertSame('eleven_multilingual_v2', $created['defaultModel']);
        $this->assertTrue($created['hasSecret']);
        $this->assertTrue($created['secretReadable']);
        $this->assertArrayNotHasKey('secret', $created);

        $client->request('PATCH', '/api/tts/credentials/'.$created['id'], [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$token,
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT' => 'application/json',
        ], json_encode([
            'name' => 'Fast ElevenLabs',
            'defaultModel' => 'eleven_flash_v2_5',
            'isActive' => false,
        ]));

        $this->assertResponseStatusCodeSame(200);
        $updated = json_decode($client->getResponse()->getContent(), true);
        $this->assertSame('Fast ElevenLabs', $updated['name']);
        $this->assertSame('eleven_flash_v2_5', $updated['defaultModel']);
        $this->assertFalse($updated['isActive']);

        $client->request('GET', '/api/tts/credentials', [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$token,
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertResponseStatusCodeSame(200);
        $listed = json_decode($client->getResponse()->getContent(), true);
        $this->assertCount(1, $listed['credentials']);
        $this->assertSame('Fast ElevenLabs', $listed['credentials'][0]['name']);
    }

    public function testAvatarTtsSettingsCanUseOwnedCredentialAndListVoices(): void
    {
        $client = static::createClient();
        $fakeClient = new class implements ElevenLabsClientInterface {
            public function listVoices(string $secret): array
            {
                return [
                    [
                        'id' => 'voice_f_1',
                        'name' => 'Ava',
                        'gender' => 'female',
                        'labels' => ['gender' => 'female', 'accent' => 'american'],
                        'category' => 'premade',
                        'description' => 'Warm and friendly',
                        'previewUrl' => 'https://example.com/ava.mp3',
                    ],
                    [
                        'id' => 'voice_m_1',
                        'name' => 'Adam',
                        'gender' => 'male',
                        'labels' => ['gender' => 'male', 'accent' => 'american'],
                        'category' => 'premade',
                        'description' => 'Calm and steady',
                        'previewUrl' => 'https://example.com/adam.mp3',
                    ],
                ];
            }

            public function streamSpeech(string $secret, string $voiceId, string $text, ?string $modelId, callable $onChunk): void
            {
                $onChunk('FAKE-MP3-A');
                $onChunk('FAKE-MP3-B');
            }
        };

        ElevenLabsClient::setTestDouble($fakeClient);
        $token = $this->registerUser($client, 'tts-avatar@example.com');

        $client->request('POST', '/api/avatars', [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$token,
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT' => 'application/json',
        ], json_encode([
            'name' => 'Voice Avatar',
            'filename' => 'voice-avatar.vrm',
            'presentationGender' => 'female',
            'speechLanguage' => 'en-US',
        ]));

        $this->assertResponseStatusCodeSame(201);
        $avatar = json_decode($client->getResponse()->getContent(), true);

        $client->request('POST', '/api/tts/credentials', [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$token,
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT' => 'application/json',
        ], json_encode([
            'name' => 'Avatar ElevenLabs',
            'secret' => 'elevenlabs-key',
            'defaultModel' => 'eleven_flash_v2_5',
        ]));

        $this->assertResponseStatusCodeSame(201);
        $credential = json_decode($client->getResponse()->getContent(), true);

        $client->request('GET', '/api/tts/credentials/'.$credential['id'].'/voices', [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$token,
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertResponseStatusCodeSame(200);
        $voices = json_decode($client->getResponse()->getContent(), true);
        $this->assertCount(2, $voices['voices']);
        $this->assertSame('female', $voices['voices'][0]['gender']);

        $client->request('POST', '/api/avatars/'.$avatar['id'].'/tts/stream', [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$token,
            'CONTENT_TYPE' => 'application/json',
        ], json_encode([
            'text' => 'Preview this voice before saving.',
            'ttsCredentialId' => $credential['id'],
            'ttsVoiceId' => 'voice_f_1',
        ]));

        $this->assertResponseStatusCodeSame(200);
        $this->assertStringStartsWith('audio/mpeg', (string) $client->getResponse()->headers->get('content-type'));

        $client->request('PATCH', '/api/avatars/'.$avatar['id'].'/tts', [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$token,
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT' => 'application/json',
        ], json_encode([
            'presentationGender' => 'female',
            'speechVoiceGender' => 'male',
            'speechLanguage' => 'fr-FR',
            'ttsCredentialId' => $credential['id'],
            'ttsVoiceId' => 'voice_m_1',
        ]));

        $this->assertResponseStatusCodeSame(200);
        $updated = json_decode($client->getResponse()->getContent(), true);
        $this->assertSame('female', $updated['presentationGender']);
        $this->assertSame('male', $updated['speechVoiceGender']);
        $this->assertSame('fr-FR', $updated['speechLanguage']);
        $this->assertSame($credential['id'], $updated['ttsCredentialId']);
        $this->assertSame('voice_m_1', $updated['ttsVoiceId']);
        $this->assertSame('Adam', $updated['ttsVoiceName']);
        $this->assertSame('male', $updated['ttsVoiceGenderTag']);
        $this->assertFalse($updated['usesBrowserFallback']);

        $client->request('POST', '/api/avatars/'.$avatar['id'].'/tts/stream', [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$token,
            'CONTENT_TYPE' => 'application/json',
        ], json_encode([
            'text' => 'Hello from ElevenLabs.',
        ]));

        $this->assertResponseStatusCodeSame(200);
        $this->assertStringStartsWith('audio/mpeg', (string) $client->getResponse()->headers->get('content-type'));
    }

    public function testTtsEndpointsArePrivateToTheOwner(): void
    {
        $client = static::createClient();
        $ownerToken = $this->registerUser($client, 'tts-owner-private@example.com');

        $client->request('POST', '/api/tts/credentials', [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$ownerToken,
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT' => 'application/json',
        ], json_encode([
            'name' => 'Private ElevenLabs',
            'secret' => 'private-tts-secret',
        ]));

        $this->assertResponseStatusCodeSame(201);
        $credential = json_decode($client->getResponse()->getContent(), true);

        $otherToken = $this->registerUser($client, 'tts-other-private@example.com');

        $client->request('GET', '/api/tts/credentials', [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$otherToken,
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertResponseStatusCodeSame(200);
        $listed = json_decode($client->getResponse()->getContent(), true);
        $this->assertSame([], $listed['credentials']);

        $client->request('GET', '/api/tts/credentials/'.$credential['id'].'/voices', [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$otherToken,
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertResponseStatusCodeSame(404);
    }
}
