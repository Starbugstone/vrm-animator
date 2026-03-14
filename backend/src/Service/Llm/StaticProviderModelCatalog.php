<?php

namespace App\Service\Llm;

use Symfony\Component\HttpKernel\KernelInterface;

class StaticProviderModelCatalog
{
    /**
     * @var array<string, list<array{id:string,name:string,description:string,group:string,releasedAt:string,contextLength:int,isRecommended:bool}>>
     */
    private static ?array $catalog = null;

    public function __construct(
        private KernelInterface $kernel,
    ) {
    }

    /**
     * @return list<array{
     *   id:string,
     *   name:string,
     *   description:string,
     *   group:string,
     *   releasedAt:string,
     *   contextLength:int,
     *   isRecommended:bool
     * }>
     */
    public function listModels(string $provider, ?string $search = null): array
    {
        $catalog = $this->loadCatalog();
        if (!array_key_exists($provider, $catalog)) {
            return [];
        }

        $normalizedSearch = strtolower(trim((string) $search));
        $models = array_values(array_filter(
            $catalog[$provider],
            static function (array $model) use ($normalizedSearch): bool {
                if ($normalizedSearch === '') {
                    return true;
                }

                $haystack = strtolower(implode(' ', [
                    $model['id'],
                    $model['name'],
                    $model['description'],
                    $model['group'],
                ]));

                return str_contains($haystack, $normalizedSearch);
            },
        ));

        usort($models, static function (array $left, array $right): int {
            if (($left['isRecommended'] ?? false) !== ($right['isRecommended'] ?? false)) {
                return ($left['isRecommended'] ?? false) ? -1 : 1;
            }

            if (($left['releasedAt'] ?? '') !== ($right['releasedAt'] ?? '')) {
                return strcmp((string) ($right['releasedAt'] ?? ''), (string) ($left['releasedAt'] ?? ''));
            }

            return strcmp((string) $left['name'], (string) $right['name']);
        });

        return $models;
    }

    /**
     * @return array{id:string,name:string,description:string,group:string,releasedAt:string,contextLength:int,isRecommended:bool}|null
     */
    public function findModel(string $provider, string $modelId): ?array
    {
        $catalog = $this->loadCatalog();
        if (!array_key_exists($provider, $catalog)) {
            return null;
        }

        foreach ($catalog[$provider] as $model) {
            if (($model['id'] ?? null) === $modelId) {
                return $model;
            }
        }

        return null;
    }

    /**
     * @return array<string, list<array{id:string,name:string,description:string,group:string,releasedAt:string,contextLength:int,isRecommended:bool}>>
     */
    private function loadCatalog(): array
    {
        if (self::$catalog !== null) {
            return self::$catalog;
        }

        $root = rtrim($this->kernel->getProjectDir(), '/').'/config/llm_models';
        $catalog = [];

        foreach (glob($root.'/*.php') ?: [] as $path) {
            $provider = pathinfo($path, PATHINFO_FILENAME);
            if (!is_string($provider) || trim($provider) === '') {
                continue;
            }

            $catalog[strtolower(trim($provider))] = $this->requireCatalogFile($path);
        }

        self::$catalog = $catalog;

        return self::$catalog;
    }

    /**
     * @return list<array{id:string,name:string,description:string,group:string,releasedAt:string,contextLength:int,isRecommended:bool}>
     */
    private function requireCatalogFile(string $path): array
    {
        $catalog = require $path;

        return is_array($catalog) ? array_values($catalog) : [];
    }
}
