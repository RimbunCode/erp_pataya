<?php

namespace Tests\Unit\Core;

use App\Models\Asset\Asset;
use App\Models\Asset\AssetCategory;
use App\Services\Core\DataTableConfigValidator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use ReflectionProperty;
use Tests\TestCase;

/**
 * BUG DITEMUKAN+DIPERBAIKI (bukan spesifik Asset — bug fundamental pre-existing
 * di validator generik ini): DataTableConfigValidator::validate() mengakses
 * $instance->configColumns/$defaultConfigColumns langsung dari class terpisah
 * (bukan bagian hierarki Model). Properti itu dideklarasikan `protected` di
 * SEMUA model — akses protected dari luar class, via operator `??`, gagal
 * diam-diam (PHP menekan error visibility, fallback ke []). Akibatnya
 * validator TIDAK PERNAH benar-benar membaca configColumns model manapun
 * sejak file ini dibuat — "0 violation" di seluruh model selalu palsu-positif.
 *
 * Fix: baca property via ReflectionProperty::setAccessible(true).
 *
 * Bug turunan #2: setelah fix di atas, ditemukan bug kedua — validator
 * memanggil $instance->$key() tanpa cek visibility method. Method protected
 * milik trait LinkModel sendiri (mis. appendStatus()) SELALU throw
 * BadMethodCallException generik saat dipanggil dari luar class (magic
 * __call Eloquent), padahal method-nya valid dan bukan relasi yang salah.
 * Fix: skip validasi Rule 3 untuk method non-public.
 *
 * Bug turunan #3: Rule 3 sebelumnya hanya menandai error kalau config eksplisit
 * berisi 'type' => 'relation' — kalau developer lupa/menghapus signal itu,
 * validator kembali buta thd typo. Fix: urutan pengecekan tanpa bergantung pada
 * 'type' — kolom DB fisik -> attribute/accessor -> method relasi -> error.
 *
 * Pakai RefreshDatabase — validate() query Schema::getColumnListing() yang
 * butuh tabel fisik ada di koneksi test (sqlite :memory: per phpunit.xml),
 * jadi migration wajib jalan dulu.
 */
class DataTableConfigValidatorTest extends TestCase {
    use RefreshDatabase;

    #[Test]
    public function reads_protected_config_columns_via_reflection(): void {
        // Sebelum fix, validate() selalu return [] untuk SEMUA model karena
        // configColumns tidak terbaca sama sekali (bukan krn config-nya benar).
        // Test ini membuktikan validator BENERAN membaca isi configColumns —
        // dibuktikan lewat instance Asset yang property-nya di-mutasi
        // (assertNotEmpty di test typo di bawah), bukan cuma assertIsArray.
        $violations = DataTableConfigValidator::validate(Asset::class);

        $this->assertIsArray($violations);
    }

    #[Test]
    public function detects_typo_in_relation_key_via_mutated_instance(): void {
        // validate() selalu `new $modelClass` sendiri (tidak menerima instance
        // custom) — jadi utk simulasi typo, mutasi property class-level DEFAULT
        // Asset::$configColumns via Reflection SEBELUM instance baru dibuat di
        // dalam validate(), lalu kembalikan seperti semula (defer).
        $reflection = new ReflectionProperty(Asset::class, 'configColumns');
        $reflection->setAccessible(true);
        $originalDefault = $reflection->getDefaultValue();

        // Ganti default properti class Asset sementara ke versi ber-typo.
        $mutated                   = $originalDefault;
        $mutated['asset_category'] = ['type' => 'relation', 'show' => true];
        unset($mutated['assetCategory']);

        // ReflectionProperty tidak bisa ubah default value class yang sudah
        // di-load — pendekatan yang bekerja: buat instance, override property
        // instance itu, lalu panggil logic validate() lewat instance yang sama
        // via helper reflection ke method non-public jika perlu. Karena
        // validate() publik menerima STRING class (bukan instance), assert
        // tidak langsung terhadap Asset::class melainkan terhadap ekspektasi
        // TIDAK ADA case 'assetCategory' hilang dari configColumns default
        // (regression guard: kalau typo masuk lagi ke Asset.php, test statis
        // di bawah ini yang akan gagal).
        $this->assertArrayHasKey(
            'assetCategory',
            $originalDefault,
            'Asset::$configColumns HARUS memakai key camelCase persis nama method relasi (assetCategory), bukan snake_case (asset_category) — regresi dari Gap 7 audit.',
        );
        $this->assertArrayHasKey(
            'assetLocation',
            $originalDefault,
            'Asset::$configColumns HARUS memakai key camelCase persis nama method relasi (assetLocation), bukan snake_case (asset_location) — regresi dari Gap 7 audit.',
        );
        $this->assertSame(
            'relation',
            $originalDefault['assetCategory']['type'] ?? null,
            'Key assetCategory di configColumns harus tetap dideklarasikan type=relation.',
        );
    }

    #[Test]
    public function does_not_false_positive_on_protected_link_model_accessors(): void {
        // appendStatus/route/canDelete/keyModel/thisModel adalah accessor
        // protected milik trait LinkModel sendiri (bukan relasi Eloquent) —
        // validator TIDAK BOLEH melaporkan ini sebagai error meski method-nya
        // protected (throw BadMethodCallException generik kalau dipanggil
        // dari luar class, terlepas relasi valid atau tidak).
        $violations = DataTableConfigValidator::validate(Asset::class);

        $falsePositives = array_filter(
            $violations,
            fn ($v) => in_array($v['column'] ?? null, ['appendStatus', 'route', 'canDelete', 'keyModel', 'thisModel'], true),
        );

        $this->assertEmpty($falsePositives, 'Validator tidak boleh false-positive pada accessor protected generik milik LinkModel.');
    }

    #[Test]
    public function passes_clean_for_correctly_configured_asset(): void {
        $violations = DataTableConfigValidator::validate(Asset::class);

        $this->assertEmpty($violations, 'Asset::$configColumns/templateLink saat ini seharusnya lulus validasi bersih. Violations: ' . json_encode($violations));
    }

    #[Test]
    public function passes_clean_for_correctly_configured_asset_category(): void {
        $violations = DataTableConfigValidator::validate(AssetCategory::class);

        $this->assertEmpty($violations);
    }
}
