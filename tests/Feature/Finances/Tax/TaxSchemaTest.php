<?php

namespace Tests\Feature\Finances\Tax;

use App\Models\Finances\FinanceSetting;
use App\Models\Finances\Tax;
use App\Models\Finances\TaxRuleVersion;
use App\Models\User\Permission;
use App\Services\Core\Setting\SettingsService;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

/**
 * Finance Fase 3, Task 2: skema aditif Tax Engine. Fokus F-12 (Requirement 13.2): `DataTable::initPermissions()`
 * menambah kolom saat runtime, jadi tabel baru harus mendeklarasikannya eksplisit supaya `initPermissions()` no-op,
 * dan kolom klasifikasi yang ditambahkan ke `taxes` tidak boleh berubah definisinya karenanya.
 */
class TaxSchemaTest extends TestCase {
    use RefreshDatabase;

    /**
     * @return array{columns: array<string, array<string, mixed>>, indexes: array<string, array<string, mixed>>}
     */
    private function snapshot(string $table): array {
        $columns = [];
        foreach (Schema::getColumns($table) as $column) {
            $columns[$column['name']] = [
                'type'     => $column['type'],
                'nullable' => $column['nullable'],
                'default'  => $column['default'],
            ];
        }
        ksort($columns);

        $indexes = [];
        foreach (Schema::getIndexes($table) as $index) {
            $indexes[$index['name']] = ['columns' => $index['columns'], 'unique' => $index['unique'], 'primary' => $index['primary']];
        }
        ksort($indexes);

        return ['columns' => $columns, 'indexes' => $indexes];
    }

    public function test_init_permissions_is_a_noop_on_tax_rule_versions(): void {
        $before = $this->snapshot('tax_rule_versions');

        TaxRuleVersion::initPermissions();

        $this->assertSame($before, $this->snapshot('tax_rule_versions'), 'initPermissions() mengubah skema tax_rule_versions.');
        $this->assertArrayNotHasKey('code', $before['columns'], 'tax_rule_versions tidak memakai kode series.');
        $this->assertArrayNotHasKey('deleted_at', $before['columns']);
        $this->assertSame(['is_example'], $before['indexes']['tax_rule_versions_is_example_index']['columns']);
    }

    public function test_init_permissions_leaves_the_classification_columns_of_taxes_untouched(): void {
        $classification = ['category', 'behavior', 'jurisdiction_code', 'is_creditable'];
        $before         = array_intersect_key($this->snapshot('taxes')['columns'], array_flip($classification));
        $this->assertCount(4, $before);

        Tax::initPermissions();

        $this->assertSame($before, array_intersect_key($this->snapshot('taxes')['columns'], array_flip($classification)));
    }

    public function test_existing_tax_rows_are_not_guessed_and_keep_additive_behavior(): void {
        // Baris yang dibuat tanpa menyebut kolom klasifikasi mewakili data lama saat migration dijalankan.
        $id = (string) Str::ulid();
        DB::table('taxes')->insert(['id' => $id, 'name' => 'PPN lama', 'rate' => 11, 'created_at' => now(), 'updated_at' => now()]);

        $tax = Tax::query()->findOrFail($id);

        $this->assertSame(Tax::CATEGORY_UNCLASSIFIED, $tax->category);
        $this->assertSame(Tax::BEHAVIOR_ADDITIVE, $tax->behavior);
        $this->assertSame('ID', $tax->jurisdiction_code);
        $this->assertTrue($tax->is_creditable);
        $this->assertFalse($tax->isClassifiedAdditive(), 'Pajak unclassified tidak pernah dipisah (P-6).');
        $this->assertFalse($tax->isPpn());
    }

    public function test_classified_tax_helpers(): void {
        $ppn = new Tax(['category' => Tax::CATEGORY_PPN_STANDARD, 'behavior' => Tax::BEHAVIOR_ADDITIVE]);
        $pph = new Tax(['category' => Tax::CATEGORY_PPH_23, 'behavior' => Tax::BEHAVIOR_WITHHOLDING]);

        $this->assertTrue($ppn->isPpn());
        $this->assertTrue($ppn->isClassifiedAdditive());
        $this->assertFalse($pph->isPpn());
        $this->assertFalse($pph->isClassifiedAdditive(), 'Withholding tidak menambah total dokumen.');
    }

    public function test_tax_rule_versions_table_has_the_columns_of_requirement_2_1(): void {
        $expected = [
            'id', 'tax_id', 'version', 'effective_from', 'effective_to', 'rate', 'dpp_numerator', 'dpp_denominator',
            'rounding_mode', 'output_role', 'input_role', 'status', 'notes', 'created_by_id', 'created_at', 'updated_at',
        ];
        foreach ($expected as $column) {
            $this->assertTrue(Schema::hasColumn('tax_rule_versions', $column), "tax_rule_versions.{$column} tidak ada.");
        }

        $snapshot = $this->snapshot('tax_rule_versions');
        $this->assertTrue($snapshot['indexes']['tax_rule_versions_tax_id_version_unique']['unique']);
        $this->assertSame(['tax_id', 'version'], $snapshot['indexes']['tax_rule_versions_tax_id_version_unique']['columns']);
        $this->assertSame(['tax_id', 'status', 'effective_from'], $snapshot['indexes']['tax_rule_versions_effective_index']['columns']);
        $this->assertTrue($snapshot['columns']['effective_to']['nullable'], 'effective_to harus nullable (tanpa batas akhir).');
    }

    public function test_tax_rule_version_defaults_match_requirement_2_1(): void {
        $tax = Tax::query()->create(['name' => 'PPN', 'rate' => 11]);

        $version = TaxRuleVersion::query()->forceCreate([
            'tax_id'         => $tax->id,
            'version'        => 1,
            'effective_from' => '2026-01-01',
            'rate'           => 11,
        ])->refresh();

        $this->assertSame(1, $version->dpp_numerator);
        $this->assertSame(1, $version->dpp_denominator);
        $this->assertSame(TaxRuleVersion::ROUNDING_PER_LINE, $version->rounding_mode);
        $this->assertSame('tax_output', $version->output_role);
        $this->assertSame('tax_input', $version->input_role);
        $this->assertSame(TaxRuleVersion::STATUS_DRAFT, $version->status);
        $this->assertNull($version->effective_to);
        $this->assertSame('1/1', $version->dppFactorLabel());
    }

    public function test_tax_rule_version_unique_per_tax_and_version_number(): void {
        $tax  = Tax::query()->create(['name' => 'PPN', 'rate' => 11]);
        $base = ['tax_id' => $tax->id, 'version' => 1, 'effective_from' => '2026-01-01', 'rate' => 11];
        TaxRuleVersion::query()->forceCreate($base);

        $this->expectException(QueryException::class);
        TaxRuleVersion::query()->forceCreate($base);
    }

    public function test_snapshot_columns_are_nullable_so_legacy_rows_stay_valid(): void {
        foreach (['sales_invoice_items', 'purchase_invoice_items', 'general_ledgers'] as $table) {
            $columns = $this->snapshot($table)['columns'];
            $this->assertArrayHasKey('tax_rule_version_id', $columns, "{$table}.tax_rule_version_id tidak ada.");
            $this->assertTrue($columns['tax_rule_version_id']['nullable'], "{$table}.tax_rule_version_id harus nullable (Requirement 5.5).");
        }

        foreach (['sales_invoices', 'purchase_invoices'] as $table) {
            $columns = $this->snapshot($table)['columns'];
            $this->assertArrayHasKey('tax_breakdown', $columns, "{$table}.tax_breakdown tidak ada.");
            $this->assertTrue($columns['tax_breakdown']['nullable'], "{$table}.tax_breakdown harus nullable.");
        }
    }

    public function test_tax_engine_settings_have_the_documented_defaults(): void {
        $setting = app(SettingsService::class)->get(FinanceSetting::class);

        $this->assertSame(['sales_invoice' => null, 'purchase_invoice' => null], $setting->tax_split_from, 'Cutover kosong = tidak aktif (Requirement 7.5).');
        $this->assertTrue($setting->company_is_pkp, 'Requirement 7.9: default PKP true.');
        $this->assertTrue($setting->tax_engine_calc_enabled, 'Requirement 12.3: setelah konversi Bagian B perhitungan engine aktif secara default (guard faktor DPP terangkat).');
    }

    public function test_tax_engine_settings_are_internal_and_validated(): void {
        $service = app(SettingsService::class);

        $service->updateInternal(FinanceSetting::class, [
            'tax_split_from' => ['sales_invoice' => '2026-12-01', 'purchase_invoice' => null],
        ]);
        $this->assertSame('2026-12-01', $service->get(FinanceSetting::class)->refresh()->tax_split_from['sales_invoice']);

        try {
            $service->updateInternal(FinanceSetting::class, ['tax_split_from' => ['sales_invoice' => 'bukan-tanggal', 'purchase_invoice' => null]]);
            $this->fail('Tanggal cutover tidak valid harus ditolak.');
        } catch (ValidationException $e) {
            $this->assertArrayHasKey('tax_split_from.sales_invoice', $e->errors());
        }

        // Bukan bagian rules() umum: tidak dapat ditulis lewat halaman/permintaan setting biasa.
        foreach (['tax_split_from', 'company_is_pkp', 'tax_engine_calc_enabled'] as $key) {
            $this->assertArrayNotHasKey($key, FinanceSetting::rules());
            $this->assertArrayHasKey($key, FinanceSetting::internalRules());
        }
    }

    public function test_permissions_include_manage_rule_versions(): void {
        TaxRuleVersion::initPermissions();

        $permission = Permission::where('model', TaxRuleVersion::class)->firstOrFail();
        foreach (['select', 'read', 'write', 'manage_rule_versions'] as $action) {
            $this->assertContains($action, $permission->permissions, "TaxRuleVersion harus memiliki izin {$action}.");
        }
    }

    public function test_migration_down_restores_the_previous_schema(): void {
        $migration = require base_path('database/migrations/2026_11_21_100003_add_tax_snapshot_columns.php');
        $migration->down();

        $this->assertFalse(Schema::hasColumn('general_ledgers', 'tax_rule_version_id'));
        $this->assertFalse(Schema::hasColumn('sales_invoices', 'tax_breakdown'));

        $migration->up();

        $this->assertTrue(Schema::hasColumn('general_ledgers', 'tax_rule_version_id'));
        $this->assertTrue(Schema::hasColumn('purchase_invoice_items', 'tax_rule_version_id'));
    }
}
