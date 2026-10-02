<?php

namespace Tests\Feature\CRM;

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * Migration convert_quotation_item_amount_to_stored_column: `amount` semula
 * generated column (quantity * price) dan berubah menjadi kolom biasa. Angka lama
 * tidak boleh hilang (design 1.3, daftar risiko).
 */
class QuotationItemAmountMigrationTest extends QuotationTestCase {
    private const ADD_FIELDS = '2026_10_01_024302_add_letter_fields_to_quotation_items_table';
    private const CONVERT    = '2026_10_01_024306_convert_quotation_item_amount_to_stored_column';

    private function runMigration(string $name): void {
        Artisan::call('migrate', ['--path' => "database/migrations/{$name}.php", '--force' => true]);
    }

    private function rollbackMigration(string $name): void {
        Artisan::call('migrate:rollback', ['--path' => "database/migrations/{$name}.php", '--force' => true]);
    }

    private function insertQuotation(): string {
        $id = (string) Str::ulid();
        DB::table('quotations')->insert([
            'id'            => $id,
            'code'          => 'QTN-' . Str::random(6),
            'date'          => now(),
            'customer_id'   => $this->customer->id,
            'created_by_id' => $this->user->id,
            'created_at'    => now(),
            'updated_at'    => now(),
        ]);

        return $id;
    }

    private function insertItem(string $quotationId, float $quantity, float $price): string {
        $id = (string) Str::ulid();
        DB::table('quotation_items')->insert([
            'id'           => $id,
            'quotation_id' => $quotationId,
            'item_id'      => $this->variant->id,
            'quantity'     => $quantity,
            'price'        => $price,
            'created_at'   => now(),
            'updated_at'   => now(),
        ]);

        return $id;
    }

    /**
     * Kembalikan skema ke keadaan sebelum migration baru: `amount` generated.
     */
    private function rollbackToGeneratedAmount(): void {
        $this->rollbackMigration(self::CONVERT);
        $this->rollbackMigration(self::ADD_FIELDS);
    }

    private function migrateForward(): void {
        $this->runMigration(self::ADD_FIELDS);
        $this->runMigration(self::CONVERT);
    }

    public function test_amount_lama_tetap_ada_setelah_migration(): void {
        $quotationId = $this->insertQuotation();
        $this->rollbackToGeneratedAmount();

        $first  = $this->insertItem($quotationId, 3, 125);
        $second = $this->insertItem($quotationId, 2, 1500.5);
        $this->assertEquals(375, DB::table('quotation_items')->where('id', $first)->value('amount'), 'amount lama adalah generated');

        $this->migrateForward();

        $this->assertEquals(375, DB::table('quotation_items')->where('id', $first)->value('amount'));
        $this->assertEquals(3001, DB::table('quotation_items')->where('id', $second)->value('amount'));
    }

    public function test_basic_amount_diisi_dari_amount_lama_dan_pajak_nol(): void {
        $quotationId = $this->insertQuotation();
        $this->rollbackToGeneratedAmount();
        $itemId = $this->insertItem($quotationId, 4, 250);

        $this->migrateForward();

        $row = DB::table('quotation_items')->where('id', $itemId)->first();
        $this->assertEquals(1000, $row->basic_amount, 'sebelum ada pajak basic_amount = amount');
        $this->assertEquals(1000, $row->amount);
        $this->assertEquals(0, $row->tax_amount);
        $this->assertEquals(0, $row->tax_rate);
    }

    public function test_amount_menjadi_kolom_biasa_yang_dapat_ditulis(): void {
        $quotationId = $this->insertQuotation();
        $this->rollbackToGeneratedAmount();
        $itemId = $this->insertItem($quotationId, 1, 10);

        $this->migrateForward();

        DB::table('quotation_items')->where('id', $itemId)->update(['amount' => 999]);
        $this->assertEquals(999, DB::table('quotation_items')->where('id', $itemId)->value('amount'));
    }

    public function test_quotation_tanpa_item_tidak_membuat_migration_gagal(): void {
        $this->insertQuotation();
        $this->rollbackToGeneratedAmount();

        $this->migrateForward();

        $this->assertTrue(Schema::hasColumn('quotation_items', 'basic_amount'));
        $this->assertSame(0, DB::table('quotation_items')->count());
    }

    public function test_kolom_baru_tersedia_setelah_migration(): void {
        foreach (['item_unit_id', 'remark', 'tax_id', 'tax_rate', 'basic_amount', 'tax_amount', 'amount'] as $column) {
            $this->assertTrue(Schema::hasColumn('quotation_items', $column), $column);
        }
        foreach (['type', 'attn', 'subject', 'issued_city', 'introduction', 'basic_amount', 'tax_amount'] as $column) {
            $this->assertTrue(Schema::hasColumn('quotations', $column), $column);
        }
    }
}
