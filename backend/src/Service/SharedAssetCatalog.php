<?php

namespace App\Service;

class SharedAssetCatalog
{
    /**
     * @var array<string, array{type:string, source:string, sourceLabel:string, root:string, extensions:list<string>, kind:?string}>
     */
    private array $catalogs;

    public function __construct(
        private string $sharedAssetRoot,
    ) {
        $this->catalogs = [
            'default_vrm' => [
                'type' => 'avatar',
                'source' => 'example',
                'sourceLabel' => 'Default avatar',
                'root' => 'default_vrm',
                'extensions' => ['vrm', 'glb'],
                'kind' => null,
            ],
            'default_vrma' => [
                'type' => 'animation',
                'source' => 'example',
                'sourceLabel' => 'Default animation',
                'root' => 'default_vrma',
                'extensions' => ['vrma'],
                'kind' => 'action',
            ],
            'expressions_vrma' => [
                'type' => 'animation',
                'source' => 'project',
                'sourceLabel' => 'Shared expression',
                'root' => 'expressions_vrma',
                'extensions' => ['vrma'],
                'kind' => 'expression',
            ],
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function listAvatars(): array
    {
        return $this->listCatalog('default_vrm');
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function listAnimations(): array
    {
        return array_merge(
            $this->listCatalog('default_vrma'),
            $this->listCatalog('expressions_vrma'),
        );
    }

    /**
     * @return array{absolutePath:string,downloadName:string,mimeType:string}|null
     */
    public function resolveDownload(string $catalog, string $relativePath): ?array
    {
        $entry = $this->catalogs[$catalog] ?? null;
        if ($entry === null) {
            return null;
        }

        $safeRelativePath = ltrim(str_replace(['..\\', '../'], '', $relativePath), '/\\');
        $absolutePath = $this->sharedAssetRoot.DIRECTORY_SEPARATOR.$entry['root'].DIRECTORY_SEPARATOR.$safeRelativePath;
        if (!is_file($absolutePath)) {
            return null;
        }

        return [
            'absolutePath' => $absolutePath,
            'downloadName' => basename($absolutePath),
            'mimeType' => $this->detectMimeType($absolutePath),
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function listCatalog(string $catalog): array
    {
        $entry = $this->catalogs[$catalog] ?? null;
        if ($entry === null) {
            return [];
        }

        $rootPath = $this->sharedAssetRoot.DIRECTORY_SEPARATOR.$entry['root'];
        if (!is_dir($rootPath)) {
            return [];
        }

        $manifestEntries = $this->loadManifestEntries($rootPath);
        $items = [];
        $iterator = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($rootPath, \FilesystemIterator::SKIP_DOTS),
        );

        foreach ($iterator as $fileInfo) {
            if (!$fileInfo instanceof \SplFileInfo || !$fileInfo->isFile()) {
                continue;
            }

            $extension = strtolower($fileInfo->getExtension());
            if (!in_array($extension, $entry['extensions'], true)) {
                continue;
            }

            $absolutePath = $fileInfo->getPathname();
            $relativePath = str_replace($rootPath.DIRECTORY_SEPARATOR, '', $absolutePath);
            $groupPath = trim(str_replace(DIRECTORY_SEPARATOR, ' / ', dirname($relativePath)), '. /');
            $baseItem = [
                'id' => sprintf('%s:%s', $catalog, str_replace(DIRECTORY_SEPARATOR, '/', $relativePath)),
                'catalog' => $catalog,
                'type' => $entry['type'],
                'kind' => $entry['kind'],
                'name' => basename($relativePath),
                'label' => pathinfo($relativePath, PATHINFO_FILENAME),
                'source' => $entry['source'],
                'sourceLabel' => $entry['sourceLabel'],
                'groupLabel' => $groupPath,
                'relativePath' => str_replace(DIRECTORY_SEPARATOR, '/', $relativePath),
                'downloadUrl' => sprintf(
                    '/api/library/shared-file?catalog=%s&path=%s',
                    rawurlencode($catalog),
                    rawurlencode(str_replace(DIRECTORY_SEPARATOR, '/', $relativePath)),
                ),
            ];
            $manifestItem = $manifestEntries[str_replace(DIRECTORY_SEPARATOR, '/', $relativePath)] ?? $manifestEntries[basename($relativePath)] ?? [];
            $items[] = array_replace($baseItem, is_array($manifestItem) ? $manifestItem : []);
        }

        usort($items, static function (array $left, array $right): int {
            $groupCompare = ($left['groupLabel'] ?? '') <=> ($right['groupLabel'] ?? '');
            if ($groupCompare !== 0) {
                return $groupCompare;
            }

            return ($left['label'] ?? '') <=> ($right['label'] ?? '');
        });

        return $items;
    }

    /**
     * @return array<string, array<string, mixed>>
     */
    private function loadManifestEntries(string $rootPath): array
    {
        $manifestPath = $rootPath.DIRECTORY_SEPARATOR.'catalog.json';
        if (!is_file($manifestPath)) {
            return [];
        }

        $decoded = json_decode((string) file_get_contents($manifestPath), true);
        if (!is_array($decoded) || !isset($decoded['entries']) || !is_array($decoded['entries'])) {
            return [];
        }

        $entries = [];
        foreach ($decoded['entries'] as $entry) {
            if (!is_array($entry) || !isset($entry['file']) || !is_string($entry['file'])) {
                continue;
            }

            $file = str_replace('\\', '/', ltrim($entry['file'], '/'));
            $entries[$file] = $entry;
        }

        return $entries;
    }

    private function detectMimeType(string $absolutePath): string
    {
        if (function_exists('finfo_open')) {
            $finfo = finfo_open(FILEINFO_MIME_TYPE);
            if ($finfo !== false) {
                $mimeType = finfo_file($finfo, $absolutePath);
                finfo_close($finfo);

                if (is_string($mimeType) && $mimeType !== '') {
                    return $mimeType;
                }
            }
        }

        return match (strtolower((string) pathinfo($absolutePath, PATHINFO_EXTENSION))) {
            'vrm' => 'model/gltf-binary',
            'glb' => 'model/gltf-binary',
            'vrma' => 'application/octet-stream',
            default => 'application/octet-stream',
        };
    }
}
