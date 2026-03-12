<?php

namespace App\Service;

use Symfony\Component\HttpFoundation\File\UploadedFile;
use Symfony\Component\HttpKernel\KernelInterface;

class UploadedAssetStorage
{
    private const DIRECTORY_MAP = [
        'avatar' => 'avatars',
        'animation' => 'animations',
    ];

    public function __construct(
        private KernelInterface $kernel,
    ) {
    }

    /**
     * @param array<string> $allowedExtensions
     */
    public function storeUploadedFile(string $assetType, UploadedFile $file, array $allowedExtensions, int $ownerId): StoredAssetResult
    {
        $extension = strtolower($file->getClientOriginalExtension() ?: $file->guessExtension() ?: '');
        if (!in_array($extension, $allowedExtensions, true)) {
            throw new \InvalidArgumentException('Unsupported file type.');
        }

        $storageDirectory = $this->getStorageDirectory($assetType, $ownerId);
        if (!is_dir($storageDirectory) && !mkdir($storageDirectory, 0775, true) && !is_dir($storageDirectory)) {
            throw new \RuntimeException('Unable to create storage directory.');
        }

        $storedFilename = sprintf(
            '%s-%s.%s',
            $assetType,
            bin2hex(random_bytes(16)),
            $extension,
        );

        $file->move($storageDirectory, $storedFilename);

        $absolutePath = $storageDirectory.DIRECTORY_SEPARATOR.$storedFilename;

        return new StoredAssetResult(
            $storedFilename,
            $file->getClientOriginalName(),
            $file->getClientMimeType() ?: 'application/octet-stream',
            (int) filesize($absolutePath),
            $absolutePath,
        );
    }

    public function deleteStoredFile(?string $assetType, ?string $storedFilename, ?int $ownerId): void
    {
        if (!$assetType || !$storedFilename || !$ownerId) {
            return;
        }

        $absolutePath = $this->getStorageDirectory($assetType, $ownerId).DIRECTORY_SEPARATOR.$storedFilename;
        if (is_file($absolutePath)) {
            @unlink($absolutePath);
        }
    }

    public function getAbsolutePath(string $assetType, string $storedFilename, int $ownerId): string
    {
        return $this->getStorageDirectory($assetType, $ownerId).DIRECTORY_SEPARATOR.$storedFilename;
    }

    private function getStorageDirectory(string $assetType, int $ownerId): string
    {
        $folder = self::DIRECTORY_MAP[$assetType] ?? null;
        if ($folder === null) {
            throw new \InvalidArgumentException('Unknown asset type.');
        }

        if ($ownerId <= 0) {
            throw new \InvalidArgumentException('Invalid owner id.');
        }

        return $this->kernel->getProjectDir()
            .DIRECTORY_SEPARATOR.'var'
            .DIRECTORY_SEPARATOR.'storage'
            .DIRECTORY_SEPARATOR.$folder
            .DIRECTORY_SEPARATOR.sprintf('user-%d', $ownerId);
    }
}
