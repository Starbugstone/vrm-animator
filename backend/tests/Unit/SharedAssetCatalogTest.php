<?php

namespace App\Tests\Unit;

use App\Service\SharedAssetCatalog;
use PHPUnit\Framework\TestCase;

class SharedAssetCatalogTest extends TestCase
{
    public function testManifestMetadataOverridesDefaultAnimationKind(): void
    {
        $root = sys_get_temp_dir().'/shared-asset-catalog-'.bin2hex(random_bytes(6));
        mkdir($root.'/default_vrma/idle', 0777, true);
        file_put_contents($root.'/default_vrma/idle/Idle Test.vrma', 'vrma');
        file_put_contents($root.'/default_vrma/catalog.json', json_encode([
            'entries' => [
                [
                    'file' => 'idle/Idle Test.vrma',
                    'label' => 'Idle Test',
                    'kind' => 'idle',
                    'description' => 'Looping idle.',
                ],
            ],
        ], JSON_THROW_ON_ERROR));

        $catalog = new SharedAssetCatalog($root);
        $items = $catalog->listAnimations();

        $this->assertCount(1, $items);
        $this->assertSame('idle', $items[0]['kind'] ?? null);
        $this->assertSame('Idle Test', $items[0]['label'] ?? null);
        $this->assertSame('Looping idle.', $items[0]['description'] ?? null);
    }
}
