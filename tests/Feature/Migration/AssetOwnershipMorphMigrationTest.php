<?php

namespace Tests\Feature\Migration;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use RuntimeException;
use Tests\TestCase;

/**
 * Migration `convert_asset_ownership_to_morph` (spec asset-ownership-morph
 * Requirement 1): skema lama dipulihkan dulu lewat down(), baris lama
 * di-seed, lalu up() mengonversinya.
 */
class AssetOwnershipMorphMigrationTest extends TestCase {
    use RefreshDatabase;

    private function migration(): object {
        return require database_path('migrations/2026_10_02_000001_convert_asset_ownership_to_morph.php');
    }

    private function insertOld(string $type, ?string $supplierId = null, ?string $customerId = null, ?string $companyId = null): string {
        $id = (string) Str::ulid();
        DB::table('assets')->insert([
            'id'                    => $id,
            'code'                  => 'AST-' . Str::random(6),
            'asset_name'            => 'Aset ' . $type,
            'ownership_type'        => $type,
            'ownership_company_id'  => $companyId,
            'ownership_supplier_id' => $supplierId,
            'ownership_customer_id' => $customerId,
            'created_at'            => now(),
            'updated_at'            => now(),
        ]);

        return $id;
    }

    public function test_up_converts_three_types_and_drops_old_columns(): void {
        $migration = $this->migration();
        $migration->down();

        $supplier = (string) Str::ulid();
        $customer = (string) Str::ulid();
        $a        = $this->insertOld('supplier', supplierId: $supplier);
        $b        = $this->insertOld('customer', customerId: $customer);
        $c        = $this->insertOld('company', companyId: (string) Str::ulid());

        $migration->up();

        $rows = DB::table('assets')->get()->keyBy('id');
        $this->assertSame('supplier', $rows[$a]->ownership_type);
        $this->assertSame($supplier, $rows[$a]->ownership_id);
        $this->assertSame('customer', $rows[$b]->ownership_type);
        $this->assertSame($customer, $rows[$b]->ownership_id);
        $this->assertSame('company', $rows[$c]->ownership_type);
        $this->assertNull($rows[$c]->ownership_id);

        foreach (['ownership_company_id', 'ownership_supplier_id', 'ownership_customer_id'] as $column) {
            $this->assertFalse(Schema::hasColumn('assets', $column), "$column harus hilang");
        }
        $this->assertTrue(Schema::hasColumn('assets', 'ownership_customer_branch_id'));
    }

    public function test_down_restores_supplier_and_customer_values(): void {
        $migration = $this->migration();
        $migration->down();
        $supplier = (string) Str::ulid();
        $customer = (string) Str::ulid();
        $a        = $this->insertOld('supplier', supplierId: $supplier);
        $b        = $this->insertOld('customer', customerId: $customer);
        $c        = $this->insertOld('company');
        $migration->up();

        $migration->down();

        $rows = DB::table('assets')->get()->keyBy('id');
        $this->assertSame($supplier, $rows[$a]->ownership_supplier_id);
        $this->assertNull($rows[$a]->ownership_customer_id);
        $this->assertSame($customer, $rows[$b]->ownership_customer_id);
        $this->assertNull($rows[$c]->ownership_supplier_id);
        $this->assertNull($rows[$c]->ownership_company_id);
        $this->assertFalse(Schema::hasColumn('assets', 'ownership_id'));

        $migration->up(); // kembali ke skema baru agar teardown konsisten
    }

    public function test_unknown_ownership_type_stops_migration_without_changing_data(): void {
        $migration = $this->migration();
        $migration->down();
        $bad  = $this->insertOld('weird');
        $good = $this->insertOld('supplier', supplierId: (string) Str::ulid());

        try {
            $migration->up();
            $this->fail('Migration harus berhenti');
        } catch (RuntimeException $e) {
            $this->assertStringContainsString($bad, $e->getMessage());
        }

        $this->assertFalse(Schema::hasColumn('assets', 'ownership_id'));
        $this->assertTrue(Schema::hasColumn('assets', 'ownership_supplier_id'));
        $this->assertSame('weird', DB::table('assets')->where('id', $bad)->value('ownership_type'));
        $this->assertNotNull(DB::table('assets')->where('id', $good)->value('ownership_supplier_id'));

        DB::table('assets')->where('id', $bad)->delete();
        $migration->up();
    }
}
