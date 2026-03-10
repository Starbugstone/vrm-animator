<?php

namespace App\Service;

final class StoredAssetResult
{
    public function __construct(
        public readonly string $storedFilename,
        public readonly string $originalFilename,
        public readonly string $mimeType,
        public readonly int $sizeBytes,
        public readonly string $absolutePath,
    ) {
    }
}
