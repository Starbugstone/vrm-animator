<?php

namespace App\Service\Llm;

class OpenRouterModelCatalog
{
    /**
     * @var list<array{
     *   id:string,
     *   name:string,
     *   description:string,
     *   createdAt:int,
     *   contextLength:int,
     *   pricing:array{prompt:string,completion:string,image:string,request:string},
     *   isFree:bool
     * }>|null
     */
    private static ?array $cachedModels = null;

    public function __construct(
        private bool $llmTestMode = false,
    ) {
    }

    /**
     * @return list<array{
     *   id:string,
     *   name:string,
     *   description:string,
     *   createdAt:int,
     *   contextLength:int,
     *   pricing:array{prompt:string,completion:string,image:string,request:string},
     *   isFree:bool
     * }>
     */
    public function listModels(?string $search = null, string $billing = 'all'): array
    {
        $models = $this->llmTestMode ? $this->getFixtureModels() : $this->fetchModels();
        $normalizedSearch = strtolower(trim((string) $search));
        $normalizedBilling = strtolower(trim($billing));

        $filtered = array_values(array_filter($models, function (array $model) use ($normalizedSearch, $normalizedBilling): bool {
            if ($normalizedBilling === 'free' && !$model['isFree']) {
                return false;
            }

            if ($normalizedBilling === 'paid' && $model['isFree']) {
                return false;
            }

            if ($normalizedSearch === '') {
                return true;
            }

            $haystack = strtolower(implode(' ', [
                $model['id'],
                $model['name'],
                $model['description'],
            ]));

            return str_contains($haystack, $normalizedSearch);
        }));

        usort($filtered, static function (array $left, array $right): int {
            if ($left['isFree'] !== $right['isFree']) {
                return $left['isFree'] ? -1 : 1;
            }

            if (($left['createdAt'] ?? 0) !== ($right['createdAt'] ?? 0)) {
                return ($right['createdAt'] ?? 0) <=> ($left['createdAt'] ?? 0);
            }

            return $left['name'] <=> $right['name'];
        });

        return $filtered;
    }

    /**
     * @return array{
     *   id:string,
     *   name:string,
     *   description:string,
     *   createdAt:int,
     *   contextLength:int,
     *   pricing:array{prompt:string,completion:string,image:string,request:string},
     *   isFree:bool
     * }|null
     */
    public function findModel(string $modelId): ?array
    {
        foreach ($this->llmTestMode ? $this->getFixtureModels() : $this->fetchModels() as $model) {
            if (($model['id'] ?? null) === $modelId) {
                return $model;
            }
        }

        return null;
    }

    /**
     * @return list<array{
     *   id:string,
     *   name:string,
     *   description:string,
     *   createdAt:int,
     *   contextLength:int,
     *   pricing:array{prompt:string,completion:string,image:string,request:string},
     *   isFree:bool
     * }>
     */
    private function fetchModels(): array
    {
        if (self::$cachedModels !== null) {
            return self::$cachedModels;
        }

        $context = stream_context_create([
            'http' => [
                'method' => 'GET',
                'header' => implode("\r\n", [
                    'Accept: application/json',
                ]),
                'timeout' => 20,
                'ignore_errors' => true,
            ],
        ]);

        $body = @file_get_contents('https://openrouter.ai/api/v1/models', false, $context);
        $statusCode = $this->extractStatusCode($http_response_header ?? []);

        if (!is_string($body) || $body === '') {
            throw new \RuntimeException('OpenRouter model catalog request failed.');
        }

        $decoded = json_decode($body, true);
        if (!is_array($decoded)) {
            throw new \RuntimeException('OpenRouter model catalog returned invalid JSON.');
        }

        if ($statusCode >= 400) {
            $message = $decoded['error']['message'] ?? $decoded['message'] ?? 'OpenRouter model catalog request failed.';
            throw new \RuntimeException(is_string($message) ? $message : 'OpenRouter model catalog request failed.');
        }

        $models = $decoded['data'] ?? [];
        if (!is_array($models)) {
            return [];
        }

        self::$cachedModels = array_values(array_filter(array_map(
            fn (mixed $model): ?array => is_array($model) ? $this->normalizeModel($model) : null,
            $models,
        )));

        return self::$cachedModels;
    }

    /**
     * @return array{
     *   id:string,
     *   name:string,
     *   description:string,
     *   createdAt:int,
     *   contextLength:int,
     *   pricing:array{prompt:string,completion:string,image:string,request:string},
     *   isFree:bool
     * }|null
     */
    private function normalizeModel(array $model): ?array
    {
        $id = trim((string) ($model['id'] ?? ''));
        if ($id === '') {
            return null;
        }

        $pricing = [
            'prompt' => $this->normalizePrice($model['pricing']['prompt'] ?? '0'),
            'completion' => $this->normalizePrice($model['pricing']['completion'] ?? '0'),
            'image' => $this->normalizePrice($model['pricing']['image'] ?? '0'),
            'request' => $this->normalizePrice($model['pricing']['request'] ?? '0'),
        ];

        return [
            'id' => $id,
            'name' => trim((string) ($model['name'] ?? $id)),
            'description' => trim((string) ($model['description'] ?? '')),
            'createdAt' => max(0, (int) ($model['created'] ?? $model['created_at'] ?? 0)),
            'contextLength' => max(0, (int) ($model['context_length'] ?? 0)),
            'pricing' => $pricing,
            'isFree' => $this->isFreePricing($pricing),
        ];
    }

    private function normalizePrice(mixed $value): string
    {
        $stringValue = trim((string) $value);

        return $stringValue !== '' ? $stringValue : '0';
    }

    /**
     * @param array{prompt:string,completion:string,image:string,request:string} $pricing
     */
    private function isFreePricing(array $pricing): bool
    {
        foreach ($pricing as $value) {
            if ((float) $value > 0.0) {
                return false;
            }
        }

        return true;
    }

    /**
     * @param list<string> $responseHeaders
     */
    private function extractStatusCode(array $responseHeaders): int
    {
        foreach ($responseHeaders as $header) {
            if (!is_string($header) || !preg_match('/^HTTP\/\S+\s+(\d{3})/', $header, $matches)) {
                continue;
            }

            return (int) $matches[1];
        }

        return 0;
    }

    /**
     * @return list<array{
     *   id:string,
     *   name:string,
     *   description:string,
     *   createdAt:int,
     *   contextLength:int,
     *   pricing:array{prompt:string,completion:string,image:string,request:string},
     *   isFree:bool
     * }>
     */
    private function getFixtureModels(): array
    {
        return [
            [
                'id' => 'moonshotai/kimi-k2:free',
                'name' => 'Kimi K2 Free',
                'description' => 'Test free model fixture',
                'createdAt' => 1710000002,
                'contextLength' => 131072,
                'pricing' => [
                    'prompt' => '0',
                    'completion' => '0',
                    'image' => '0',
                    'request' => '0',
                ],
                'isFree' => true,
            ],
            [
                'id' => 'openai/gpt-4.1-mini',
                'name' => 'GPT-4.1 Mini',
                'description' => 'Test paid model fixture',
                'createdAt' => 1710000001,
                'contextLength' => 128000,
                'pricing' => [
                    'prompt' => '0.0000004',
                    'completion' => '0.0000016',
                    'image' => '0',
                    'request' => '0',
                ],
                'isFree' => false,
            ],
            [
                'id' => 'anthropic/claude-3-haiku:free',
                'name' => 'Claude 3 Haiku Free',
                'description' => 'Older free model fixture',
                'createdAt' => 1700000000,
                'contextLength' => 200000,
                'pricing' => [
                    'prompt' => '0',
                    'completion' => '0',
                    'image' => '0',
                    'request' => '0',
                ],
                'isFree' => true,
            ],
        ];
    }
}
