<?php

namespace Tests\Unit\Core;

use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/**
 * Kunci `core.datatable.*` yang dirujuk langsung oleh komponen frontend
 * (Components/Table/Pagination.jsx dan Components/SelectModel.jsx) harus ada di
 * kedua locale; bila tidak, UI menampilkan kunci mentahnya.
 */
class DatatableTranslationKeysTest extends TestCase {
    /**
     * @return array<string, array{0: string, 1: string}>
     */
    public static function requiredKeys(): array {
        $cases = [];

        foreach (['en', 'id'] as $locale) {
            foreach (['previous', 'next', 'total'] as $key) {
                $cases["{$locale}.{$key}"] = [$locale, $key];
            }
        }

        return $cases;
    }

    #[DataProvider('requiredKeys')]
    public function test_key_dirujuk_komponen_frontend_ada_dan_terisi(string $locale, string $key): void {
        $translations = require dirname(__DIR__, 3) . "/lang/{$locale}/core/datatable.php";

        $this->assertArrayHasKey($key, $translations, "lang/{$locale}/core/datatable.php tidak punya kunci '{$key}'.");
        $this->assertIsString($translations[$key]);
        $this->assertNotSame('', trim($translations[$key]));
    }
}
