<?php

namespace Tests\Unit\Asset;

use PHPUnit\Framework\TestCase;

/**
 * Validates: Requirement 11
 *
 * Property: Translation key parity across locales
 * For any translation key defined in lang/en/asset/*.php or lang/en/status.php,
 * the same key SHALL exist in lang/id/asset/*.php or lang/id/status.php and vice versa.
 */
class AssetTranslationParityTest extends TestCase {
    /**
     * @return array<int, string>
     */
    private function extractKeys(array $array, string $prefix = ''): array {
        $keys = [];

        foreach ($array as $key => $value) {
            $fullKey = $prefix === '' ? (string) $key : $prefix . '.' . $key;

            if (is_array($value)) {
                $keys = array_merge($keys, $this->extractKeys($value, $fullKey));
            } else {
                $keys[] = $fullKey;
            }
        }

        sort($keys);

        return $keys;
    }

    private function basePath(): string {
        return dirname(__DIR__, 3);
    }

    public static function assetLangFilesProvider(): array {
        return [
            'category.php'        => ['asset/category.php'],
            'location.php'        => ['asset/location.php'],
            'asset.php'           => ['asset/asset.php'],
            'valueAdjustment.php' => ['asset/valueAdjustment.php'],
            'movement.php'        => ['asset/movement.php'],
            'service.php'         => ['asset/service.php'],
            'maintenance.php'     => ['asset/maintenance.php'],
        ];
    }

    /**
     * @dataProvider assetLangFilesProvider
     */
    public function test_asset_translation_files_exist(string $relativePath): void {
        $this->assertFileExists("{$this->basePath()}/lang/en/{$relativePath}");
        $this->assertFileExists("{$this->basePath()}/lang/id/{$relativePath}");
    }

    /**
     * @dataProvider assetLangFilesProvider
     */
    public function test_asset_translation_key_parity_across_locales(string $relativePath): void {
        $en = require "{$this->basePath()}/lang/en/{$relativePath}";
        $id = require "{$this->basePath()}/lang/id/{$relativePath}";

        $enKeys = $this->extractKeys($en);
        $idKeys = $this->extractKeys($id);

        $missingInId = array_diff($enKeys, $idKeys);
        $missingInEn = array_diff($idKeys, $enKeys);

        $this->assertEmpty($missingInId, 'Keys present in English but missing in Indonesian: ' . implode(', ', $missingInId));
        $this->assertEmpty($missingInEn, 'Keys present in Indonesian but missing in English: ' . implode(', ', $missingInEn));
    }

    /**
     * Asset menambah 9 case FormStatus baru ke lang/*\/status.php — pastikan
     * parity locale tetap terjaga setelah penambahan (bukan file baru,
     * di-append ke file status.php generik yang sudah ada).
     */
    public function test_status_translation_key_parity_includes_asset_statuses(): void {
        $en = require "{$this->basePath()}/lang/en/status.php";
        $id = require "{$this->basePath()}/lang/id/status.php";

        $assetStatusKeys = [
            'scrapped', 'sold', 'out_of_order', 'in_maintenance', 'issued',
            'partially_depreciated', 'fully_depreciated', 'capitalized', 'work_in_progress',
        ];

        foreach ($assetStatusKeys as $key) {
            $this->assertArrayHasKey($key, $en, "Missing '{$key}' in lang/en/status.php");
            $this->assertArrayHasKey($key, $id, "Missing '{$key}' in lang/id/status.php");
        }
    }
}
