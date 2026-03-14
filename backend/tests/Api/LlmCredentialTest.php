<?php

namespace App\Tests\Api;

use App\Entity\LlmCredential;
use App\Repository\LlmCredentialRepository;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

class LlmCredentialTest extends WebTestCase
{
    private function registerUser($client, string $email): string
    {
        $client->request('POST', '/api/register', [], [], [
            'CONTENT_TYPE' => 'application/json',
        ], json_encode([
            'email' => $email,
            'password' => 'password123',
            'displayName' => 'Credential User',
        ]));

        $data = json_decode($client->getResponse()->getContent(), true);

        return $data['token'];
    }

    public function testProviderCatalogIsAvailable(): void
    {
        $client = static::createClient();
        $token = $this->registerUser($client, 'llm-providers@example.com');

        $client->request('GET', '/api/llm/providers', [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$token,
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertResponseStatusCodeSame(200);
        $data = json_decode($client->getResponse()->getContent(), true);

        $providerIds = array_column($data['providers'] ?? [], 'id');
        $this->assertContains('deepseek', $providerIds);
        $this->assertContains('openrouter', $providerIds);
        $this->assertContains('openai', $providerIds);
        $this->assertContains('minimax', $providerIds);
        $this->assertContains('glm', $providerIds);
        $this->assertContains('gemini', $providerIds);
    }

    public function testOpenRouterModelsCanBeListedAndFiltered(): void
    {
        $client = static::createClient();
        $token = $this->registerUser($client, 'llm-openrouter-models@example.com');

        $client->request('GET', '/api/llm/providers/openrouter/models', [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$token,
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertResponseStatusCodeSame(200);
        $defaultModels = json_decode($client->getResponse()->getContent(), true);
        $this->assertCount(2, $defaultModels['models']);
        $this->assertSame('moonshotai/kimi-k2:free', $defaultModels['models'][0]['id']);
        $this->assertSame('anthropic/claude-3-haiku:free', $defaultModels['models'][1]['id']);
        $this->assertTrue($defaultModels['models'][0]['isFree']);

        $client->request('GET', '/api/llm/providers/openrouter/models?billing=free', [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$token,
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertResponseStatusCodeSame(200);
        $freeModels = json_decode($client->getResponse()->getContent(), true);
        $this->assertCount(2, $freeModels['models']);
        $this->assertTrue($freeModels['models'][0]['isFree']);
        $this->assertGreaterThan($freeModels['models'][1]['createdAt'], $freeModels['models'][0]['createdAt']);

        $client->request('GET', '/api/llm/providers/openrouter/models?billing=paid&search=gpt-4.1', [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$token,
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertResponseStatusCodeSame(200);
        $paidModels = json_decode($client->getResponse()->getContent(), true);
        $this->assertCount(1, $paidModels['models']);
        $this->assertFalse($paidModels['models'][0]['isFree']);
        $this->assertSame('openai/gpt-4.1-mini', $paidModels['models'][0]['id']);
    }

    public function testStaticProviderModelsCanBeListedForSupportedProviders(): void
    {
        $client = static::createClient();
        $token = $this->registerUser($client, 'llm-static-models@example.com');

        $client->request('GET', '/api/llm/providers/deepseek/models', [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$token,
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertResponseStatusCodeSame(200);
        $deepSeekModels = json_decode($client->getResponse()->getContent(), true);
        $this->assertNotEmpty($deepSeekModels['models']);
        $this->assertSame('deepseek-chat', $deepSeekModels['models'][0]['id']);

        $client->request('GET', '/api/llm/providers/glm/models', [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$token,
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertResponseStatusCodeSame(200);
        $glmModels = json_decode($client->getResponse()->getContent(), true);
        $this->assertNotEmpty($glmModels['models']);
        $this->assertSame('glm-5', $glmModels['models'][0]['id']);

        $client->request('GET', '/api/llm/providers/gemini/models?search=flash', [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$token,
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertResponseStatusCodeSame(200);
        $geminiModels = json_decode($client->getResponse()->getContent(), true);
        $this->assertNotEmpty($geminiModels['models']);
        $this->assertSame('gemini-2.5-flash', $geminiModels['models'][0]['id']);

        $client->request('GET', '/api/llm/providers/minimax/models?search=M2.5', [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$token,
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertResponseStatusCodeSame(200);
        $minimaxModels = json_decode($client->getResponse()->getContent(), true);
        $this->assertNotEmpty($minimaxModels['models']);
        $this->assertSame('MiniMax-M2.5', $minimaxModels['models'][0]['id']);

        $client->request('GET', '/api/llm/providers/openai/models?search=gpt-5.2', [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$token,
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertResponseStatusCodeSame(200);
        $openAiModels = json_decode($client->getResponse()->getContent(), true);
        $this->assertNotEmpty($openAiModels['models']);
        $this->assertSame('gpt-5.2', $openAiModels['models'][0]['id']);
    }

    public function testCredentialCanBeCreatedListedAndUpdatedWithoutExposingRawSecret(): void
    {
        $client = static::createClient();
        $token = $this->registerUser($client, 'llm-owner@example.com');

        $client->request('POST', '/api/llm/credentials', [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$token,
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT' => 'application/json',
        ], json_encode([
            'name' => 'Primary OpenRouter',
            'provider' => 'openrouter',
            'secret' => 'openrouter-secret-token',
            'defaultModel' => 'openai/gpt-4.1-mini',
            'isActive' => true,
        ]));

        $this->assertResponseStatusCodeSame(201);
        $created = json_decode($client->getResponse()->getContent(), true);
        $this->assertSame('Primary OpenRouter', $created['name']);
        $this->assertSame('openrouter', $created['provider']);
        $this->assertSame('openai/gpt-4.1-mini', $created['defaultModel']);
        $this->assertSame([], $created['providerOptions']);
        $this->assertTrue($created['isActive']);
        $this->assertTrue($created['hasSecret']);
        $this->assertTrue($created['secretReadable']);
        $this->assertNull($created['secretWarning']);
        $this->assertArrayNotHasKey('secret', $created);
        $this->assertStringEndsWith('oken', $created['maskedSecret']);

        /** @var LlmCredentialRepository $repository */
        $repository = static::getContainer()->get(LlmCredentialRepository::class);
        /** @var LlmCredential $persisted */
        $persisted = $repository->find($created['id']);
        $this->assertNotSame('openrouter-secret-token', $persisted->getEncryptedSecret());

        $client->request('GET', '/api/llm/credentials', [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$token,
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertResponseStatusCodeSame(200);
        $listed = json_decode($client->getResponse()->getContent(), true);
        $this->assertCount(1, $listed['credentials']);
        $this->assertSame($created['maskedSecret'], $listed['credentials'][0]['maskedSecret']);
        $this->assertTrue($listed['credentials'][0]['secretReadable']);

        $client->request('PATCH', '/api/llm/credentials/'.$created['id'], [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$token,
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT' => 'application/json',
        ], json_encode([
            'name' => 'Renamed OpenRouter',
            'secret' => 'new-secret-token',
            'defaultModel' => 'anthropic/claude-3.7-sonnet',
            'isActive' => false,
        ]));

        $this->assertResponseStatusCodeSame(200);
        $updated = json_decode($client->getResponse()->getContent(), true);
        $this->assertSame('Renamed OpenRouter', $updated['name']);
        $this->assertSame('anthropic/claude-3.7-sonnet', $updated['defaultModel']);
        $this->assertFalse($updated['isActive']);
        $this->assertTrue($updated['secretReadable']);
        $this->assertStringEndsWith('oken', $updated['maskedSecret']);
    }

    public function testGlmCredentialCanStoreEndpointModePerConnection(): void
    {
        $client = static::createClient();
        $token = $this->registerUser($client, 'llm-glm-options@example.com');

        $client->request('POST', '/api/llm/credentials', [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$token,
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT' => 'application/json',
        ], json_encode([
            'name' => 'GLM Coding',
            'provider' => 'glm',
            'secret' => 'glm-secret-token',
            'defaultModel' => 'glm-4.7',
            'providerOptions' => [
                'endpointMode' => 'coding',
            ],
            'isActive' => true,
        ]));

        $this->assertResponseStatusCodeSame(201);
        $created = json_decode($client->getResponse()->getContent(), true);
        $this->assertSame(['endpointMode' => 'coding'], $created['providerOptions']);

        $client->request('PATCH', '/api/llm/credentials/'.$created['id'], [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$token,
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT' => 'application/json',
        ], json_encode([
            'providerOptions' => [
                'endpointMode' => 'standard',
            ],
        ]));

        $this->assertResponseStatusCodeSame(200);
        $updated = json_decode($client->getResponse()->getContent(), true);
        $this->assertSame(['endpointMode' => 'standard'], $updated['providerOptions']);
    }

    public function testCredentialEndpointsArePrivateToOwner(): void
    {
        $client = static::createClient();
        $ownerToken = $this->registerUser($client, 'llm-owner-2@example.com');

        $client->request('POST', '/api/llm/credentials', [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$ownerToken,
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT' => 'application/json',
        ], json_encode([
            'name' => 'GLM Primary',
            'provider' => 'glm',
            'secret' => 'glm-secret-token',
            'defaultModel' => 'glm-4.5',
        ]));

        $this->assertResponseStatusCodeSame(201);
        $created = json_decode($client->getResponse()->getContent(), true);

        $otherToken = $this->registerUser($client, 'llm-other@example.com');

        $client->request('GET', '/api/llm/credentials', [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$otherToken,
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertResponseStatusCodeSame(200);
        $listed = json_decode($client->getResponse()->getContent(), true);
        $this->assertSame([], $listed['credentials']);

        $client->request('PATCH', '/api/llm/credentials/'.$created['id'], [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$otherToken,
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT' => 'application/json',
        ], json_encode([
            'isActive' => false,
        ]));

        $this->assertResponseStatusCodeSame(404);

        $client->request('DELETE', '/api/llm/credentials/'.$created['id'], [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$otherToken,
        ]);

        $this->assertResponseStatusCodeSame(404);
    }

    public function testUserCanStoreMultipleNamedCredentialsForSameProvider(): void
    {
        $client = static::createClient();
        $token = $this->registerUser($client, 'llm-multiple@example.com');

        foreach ([1, 2] as $attempt) {
            $client->request('POST', '/api/llm/credentials', [], [], [
                'HTTP_AUTHORIZATION' => 'Bearer '.$token,
                'CONTENT_TYPE' => 'application/json',
                'HTTP_ACCEPT' => 'application/json',
            ], json_encode([
                'name' => 'MiniMax '.$attempt,
                'provider' => 'minimax',
                'secret' => 'minimax-secret-'.$attempt,
                'defaultModel' => 'MiniMax-M1',
            ]));

            $this->assertResponseStatusCodeSame(201);
        }

        $client->request('GET', '/api/llm/credentials', [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$token,
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertResponseStatusCodeSame(200);
        $listed = json_decode($client->getResponse()->getContent(), true);
        $this->assertCount(2, $listed['credentials']);
        $this->assertSame(['MiniMax 1', 'MiniMax 2'], array_column($listed['credentials'], 'name'));
    }

    public function testCredentialCanBeUpdatedWithoutReplacingSecretWhenProviderDoesNotChange(): void
    {
        $client = static::createClient();
        $token = $this->registerUser($client, 'llm-update-no-secret@example.com');

        $client->request('POST', '/api/llm/credentials', [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$token,
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT' => 'application/json',
        ], json_encode([
            'name' => 'MiniMax Main',
            'provider' => 'minimax',
            'secret' => 'minimax-secret-token',
            'defaultModel' => 'MiniMax-M2.5',
            'isActive' => true,
        ]));

        $this->assertResponseStatusCodeSame(201);
        $created = json_decode($client->getResponse()->getContent(), true);

        $client->request('PATCH', '/api/llm/credentials/'.$created['id'], [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$token,
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT' => 'application/json',
        ], json_encode([
            'name' => 'MiniMax Secondary',
            'defaultModel' => 'MiniMax-M2.1',
        ]));

        $this->assertResponseStatusCodeSame(200);
        $updated = json_decode($client->getResponse()->getContent(), true);
        $this->assertSame('MiniMax Secondary', $updated['name']);
        $this->assertSame('MiniMax-M2.1', $updated['defaultModel']);
        $this->assertTrue($updated['hasSecret']);
        $this->assertTrue($updated['secretReadable']);
    }

    public function testChangingProviderRequiresNewSecret(): void
    {
        $client = static::createClient();
        $token = $this->registerUser($client, 'llm-provider-change@example.com');

        $client->request('POST', '/api/llm/credentials', [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$token,
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT' => 'application/json',
        ], json_encode([
            'name' => 'Original GLM',
            'provider' => 'glm',
            'secret' => 'glm-secret-token',
            'defaultModel' => 'glm-4.7',
            'isActive' => true,
        ]));

        $this->assertResponseStatusCodeSame(201);
        $created = json_decode($client->getResponse()->getContent(), true);

        $client->request('PATCH', '/api/llm/credentials/'.$created['id'], [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$token,
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT' => 'application/json',
        ], json_encode([
            'provider' => 'minimax',
            'defaultModel' => 'MiniMax-M2.5',
        ]));

        $this->assertResponseStatusCodeSame(400);
        $error = json_decode($client->getResponse()->getContent(), true);
        $this->assertSame('A new API key is required when changing provider.', $error['message']);
    }
}
