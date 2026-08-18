<?php

namespace Tests\Feature\Asset;

use Tests\TestCase;

/**
 * Validates: Requirement 11
 *
 * Memastikan key translasi yang dipakai di kode (AssetRequest, Asset model,
 * AssetLocation model) benar-benar teregistrasi — __() harus mengembalikan
 * teks manusiawi, BUKAN key mentah (perilaku default Laravel saat translasi
 * tidak ditemukan).
 */
class AssetTranslationResolutionTest extends TestCase {
    /**
     * Format key __() Laravel untuk file di dalam subfolder lang adalah
     * "{folder}/{file}.{key}" (garis miring), BUKAN "{folder}.{file}.{key}"
     * (titik) — beda dari format t() frontend (laravel-react-i18n) yang
     * memakai titik untuk semuanya. Dikonfirmasi via tinker: __('inventory.category.columns.name')
     * TIDAK resolve, __('inventory/category.columns.name') resolve.
     */
    public static function keyProvider(): array {
        return [
            'category.title'                    => ['asset/category.title'],
            'location.title'                    => ['asset/location.title'],
            'asset.title'                       => ['asset/asset.title'],
            'ownership_field_must_be_empty'     => ['asset/asset.ownership_field_must_be_empty'],
            'rentable_must_be_single_unit'      => ['asset/asset.rentable_must_be_single_unit'],
            'cannot_cancel'                     => ['asset/asset.cannot_cancel'],
            'cannot_transition_status'          => ['asset/asset.cannot_transition_status'],
            'location.cannot_delete_has_assets' => ['asset/asset.location.cannot_delete_has_assets'],
            'sell_not_implemented'              => ['asset/asset.sell_not_implemented'],
        ];
    }

    /**
     * @dataProvider keyProvider
     */
    public function test_translation_key_resolves_to_human_text_in_id(string $translationKey): void {
        app()->setLocale('id');

        $resolved = __($translationKey);

        $this->assertNotEquals($translationKey, $resolved, "Key '{$translationKey}' did not resolve (locale: id) — masih return key mentah.");
    }

    /**
     * @dataProvider keyProvider
     */
    public function test_translation_key_resolves_to_human_text_in_en(string $translationKey): void {
        app()->setLocale('en');

        $resolved = __($translationKey);

        $this->assertNotEquals($translationKey, $resolved, "Key '{$translationKey}' did not resolve (locale: en) — masih return key mentah.");
    }

    public function test_new_form_status_cases_resolve_to_human_text(): void {
        $statuses = [
            'scrapped', 'sold', 'out_of_order', 'in_maintenance', 'issued',
            'partially_depreciated', 'fully_depreciated', 'capitalized', 'work_in_progress',
        ];

        foreach (['id', 'en'] as $locale) {
            app()->setLocale($locale);

            foreach ($statuses as $status) {
                $key      = "status.{$status}";
                $resolved = __($key);

                $this->assertNotEquals($key, $resolved, "Status key '{$key}' did not resolve (locale: {$locale}).");
            }
        }
    }
}
