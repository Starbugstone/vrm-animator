<?php

namespace App\Tests\Api;

use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

class AvatarMemoryTest extends WebTestCase
{
    private function registerUser($client, string $email): string
    {
        $client->request('POST', '/api/register', [], [], [
            'CONTENT_TYPE' => 'application/json',
        ], json_encode([
            'email' => $email,
            'password' => 'password123',
            'displayName' => 'Memory User',
        ]));

        $data = json_decode($client->getResponse()->getContent(), true);

        return $data['token'];
    }

    public function testAvatarMemoryCanBeFetchedAndUpdated(): void
    {
        $client = static::createClient();
        $token = $this->registerUser($client, 'memory-owner@example.com');

        $client->request('POST', '/api/avatars', [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$token,
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT' => 'application/json',
        ], json_encode([
            'name' => 'Memory Avatar',
            'filename' => 'memory-avatar.vrm',
            'backstory' => 'Raised in the clouds.',
            'personality' => 'Patient and curious.',
        ]));

        $avatar = json_decode($client->getResponse()->getContent(), true);

        $client->request('GET', '/api/avatars/'.$avatar['id'].'/memory', [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$token,
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertResponseStatusCodeSame(200);
        $memory = json_decode($client->getResponse()->getContent(), true);
        $this->assertStringContainsString('Memory Avatar', $memory['markdownContent']);
        $this->assertArrayHasKey('memoryStats', $memory);
        $this->assertArrayHasKey('chatMemoryContext', $memory);
        $this->assertArrayHasKey('compression', $memory);
        $this->assertArrayHasKey('warning', $memory);
        $this->assertStringContainsString('## Long-Term Memory', $memory['markdownContent']);

        $client->request('PATCH', '/api/avatars/'.$avatar['id'].'/memory', [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$token,
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT' => 'application/json',
        ], json_encode([
            'markdownContent' => $memory['markdownContent']."\n- The user loves teal.\n",
            'revision' => $memory['revision'],
        ]));

        $this->assertResponseStatusCodeSame(200);
        $updated = json_decode($client->getResponse()->getContent(), true);
        $this->assertGreaterThan($memory['revision'], $updated['revision']);
    }

    public function testAvatarMemoryIsPrivateToOwner(): void
    {
        $client = static::createClient();
        $ownerToken = $this->registerUser($client, 'memory-owner-2@example.com');

        $client->request('POST', '/api/avatars', [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$ownerToken,
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT' => 'application/json',
        ], json_encode([
            'name' => 'Private Memory Avatar',
            'filename' => 'private-memory.vrm',
        ]));

        $avatar = json_decode($client->getResponse()->getContent(), true);

        $otherToken = $this->registerUser($client, 'memory-other@example.com');
        $client->request('GET', '/api/avatars/'.$avatar['id'].'/memory', [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$otherToken,
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertResponseStatusCodeSame(404);
    }

    public function testAvatarMemoryRejectsStaleRevisionAndCanBeReset(): void
    {
        $client = static::createClient();
        $token = $this->registerUser($client, 'memory-reset@example.com');

        $client->request('POST', '/api/avatars', [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$token,
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT' => 'application/json',
        ], json_encode([
            'name' => 'Reset Avatar',
            'filename' => 'reset-avatar.vrm',
        ]));

        $this->assertResponseStatusCodeSame(201);
        $avatar = json_decode($client->getResponse()->getContent(), true);

        $client->request('GET', '/api/avatars/'.$avatar['id'].'/memory', [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$token,
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertResponseStatusCodeSame(200);
        $memory = json_decode($client->getResponse()->getContent(), true);

        $client->request('PATCH', '/api/avatars/'.$avatar['id'].'/memory', [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$token,
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT' => 'application/json',
        ], json_encode([
            'markdownContent' => $memory['markdownContent']."\n- Updated once.\n",
            'revision' => $memory['revision'],
        ]));

        $this->assertResponseStatusCodeSame(200);
        $updated = json_decode($client->getResponse()->getContent(), true);

        $client->request('PATCH', '/api/avatars/'.$avatar['id'].'/memory', [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$token,
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT' => 'application/json',
        ], json_encode([
            'markdownContent' => $memory['markdownContent']."\n- Stale update.\n",
            'revision' => $memory['revision'],
        ]));

        $this->assertResponseStatusCodeSame(409);
        $error = json_decode($client->getResponse()->getContent(), true);
        $this->assertStringContainsString('revision', strtolower($error['message'] ?? ''));

        $client->request('POST', '/api/avatars/'.$avatar['id'].'/memory/reset', [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$token,
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertResponseStatusCodeSame(200);
        $reset = json_decode($client->getResponse()->getContent(), true);
        $this->assertGreaterThan($updated['revision'], $reset['revision']);
        $this->assertStringContainsString('Reset Avatar', $reset['markdownContent']);
    }

    public function testAvatarMemoryCanBeCompressedWithConfiguredAvatarLlm(): void
    {
        $client = static::createClient();
        $token = $this->registerUser($client, 'memory-compress@example.com');

        $client->request('POST', '/api/avatars', [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$token,
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT' => 'application/json',
        ], json_encode([
            'name' => 'Compression Avatar',
            'filename' => 'compression-avatar.vrm',
            'backstory' => 'Keeps careful notes.',
            'personality' => 'Thoughtful and warm.',
        ]));

        $this->assertResponseStatusCodeSame(201);
        $avatar = json_decode($client->getResponse()->getContent(), true);

        $client->request('POST', '/api/llm/credentials', [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$token,
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT' => 'application/json',
        ], json_encode([
            'name' => 'OpenAI Main',
            'provider' => 'openai',
            'secret' => 'openai-secret-token',
            'defaultModel' => 'gpt-5-mini',
            'isActive' => true,
        ]));

        $this->assertResponseStatusCodeSame(201);
        $credential = json_decode($client->getResponse()->getContent(), true);

        $client->request('POST', '/api/avatars/'.$avatar['id'].'/personas', [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$token,
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT' => 'application/json',
        ], json_encode([
            'name' => 'Compression Persona',
            'personality' => 'Thoughtful and warm.',
            'llmCredentialId' => $credential['id'],
            'isPrimary' => true,
        ]));

        $this->assertResponseStatusCodeSame(201);

        $client->request('GET', '/api/avatars/'.$avatar['id'].'/memory', [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$token,
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertResponseStatusCodeSame(200);
        $memory = json_decode($client->getResponse()->getContent(), true);

        $client->request('PATCH', '/api/avatars/'.$avatar['id'].'/memory', [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$token,
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT' => 'application/json',
        ], json_encode([
            'markdownContent' => str_replace(
                "## Long-Term Memory",
                "- The user prefers jasmine tea.\n- The user wants concise answers.\n- They promised to revisit the travel plan.\n\n## Long-Term Memory",
                $memory['markdownContent'],
            ),
            'revision' => $memory['revision'],
        ]));

        $this->assertResponseStatusCodeSame(200);
        $updated = json_decode($client->getResponse()->getContent(), true);

        $client->request('POST', '/api/avatars/'.$avatar['id'].'/memory/compress', [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$token,
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT' => 'application/json',
        ], json_encode([
            'revision' => $updated['revision'],
        ]));

        $this->assertResponseStatusCodeSame(200);
        $compressed = json_decode($client->getResponse()->getContent(), true);
        $this->assertSame('llm-compress', $compressed['lastUpdatedBy']);
        $this->assertArrayHasKey('compressionRun', $compressed);
        $this->assertArrayHasKey('summary', $compressed['compressionRun']);
        $this->assertArrayHasKey('changed', $compressed['compressionRun']);
        $this->assertArrayHasKey('before', $compressed['compressionRun']);
        $this->assertArrayHasKey('after', $compressed['compressionRun']);
        $this->assertStringContainsString('# Avatar Memory', $compressed['markdownContent']);
        $this->assertStringContainsString('The user prefers jasmine tea.', $compressed['markdownContent']);
        $this->assertStringContainsString('- name: Compression Avatar', $compressed['markdownContent']);
        $this->assertStringContainsString('- backstory: Keeps careful notes.', $compressed['markdownContent']);
        $this->assertStringContainsString('- personality: Thoughtful and warm.', $compressed['markdownContent']);
    }

    public function testGlmMemoryDiagnosticsUseCurrentModelBudgetAndDisableThinkingForCompression(): void
    {
        $client = static::createClient();
        $token = $this->registerUser($client, 'memory-glm-diagnostics@example.com');

        $client->request('POST', '/api/avatars', [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$token,
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT' => 'application/json',
        ], json_encode([
            'name' => 'Bee Cat',
            'filename' => 'bee-cat.vrm',
            'backstory' => 'Young, fun, bee cat girl, bouncy, jumps a lot, talkative.',
            'personality' => 'Talkative, lively, cheerful, happy.',
        ]));

        $this->assertResponseStatusCodeSame(201);
        $avatar = json_decode($client->getResponse()->getContent(), true);

        $client->request('POST', '/api/llm/credentials', [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$token,
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT' => 'application/json',
        ], json_encode([
            'name' => 'GLM Main',
            'provider' => 'glm',
            'secret' => 'glm-secret-token',
            'defaultModel' => 'glm-4.7',
            'providerOptions' => [
                'endpointMode' => 'coding',
            ],
            'isActive' => true,
        ]));

        $this->assertResponseStatusCodeSame(201);
        $credential = json_decode($client->getResponse()->getContent(), true);

        $client->request('POST', '/api/avatars/'.$avatar['id'].'/personas', [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$token,
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT' => 'application/json',
        ], json_encode([
            'name' => 'Bee Cat Persona',
            'personality' => 'Talkative, lively, cheerful, happy.',
            'llmCredentialId' => $credential['id'],
            'isPrimary' => true,
        ]));

        $this->assertResponseStatusCodeSame(201);

        $client->request('GET', '/api/avatars/'.$avatar['id'].'/memory', [], [], [
            'HTTP_AUTHORIZATION' => 'Bearer '.$token,
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertResponseStatusCodeSame(200);
        $memory = json_decode($client->getResponse()->getContent(), true);

        $this->assertSame('glm-4.7', $memory['llmConfiguration']['model']);
        $this->assertSame('configured', $memory['llmConfiguration']['policySource']);
        $this->assertSame(1800, $memory['memoryStats']['budgetCharacters']);
        $this->assertSame('coding', $memory['compression']['requestPreview']['providerOptions']['endpointMode']);
        $this->assertArrayNotHasKey('thinking', $memory['compression']['requestPreview']['providerOptions']);
    }

}
