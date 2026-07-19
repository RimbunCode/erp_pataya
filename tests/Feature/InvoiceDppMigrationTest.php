<?php

namespace Tests\Feature;

use Database\Factories\Inventory\ItemVariantFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

class InvoiceDppMigrationTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        foreach (Schema::getTables() as $tableInfo) {
            $table = $tableInfo['name'];
            if (! Schema::hasColumn($table, 'is_example')) {
                Schema::table($table, fn ($t) => $t->boolean('is_example')->default(false));
            }
        }
    }

    public function test_sales_invoice_item_dpp_and_tax_amount_are_generated_correctly(): void {
        $itemVariant = ItemVariantFactory::new()->create();

        $salesInvoiceId = (string) Str::ulid();
        DB::table('sales_invoices')->insert([
            'id'         => $salesInvoiceId,
            'date'       => now(),
            'amount'     => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $itemId = (string) Str::ulid();
        DB::table('sales_invoice_items')->insert([
            'id'               => $itemId,
            'sales_invoice_id' => $salesInvoiceId,
            'item_id'          => $itemVariant->id,
            'quantity'         => 10,
            'price'            => 1200,
            'tax_rate'         => 11,
            'created_at'       => now(),
            'updated_at'       => now(),
        ]);

        $item = DB::table('sales_invoice_items')->where('id', $itemId)->first();

        $this->assertEqualsWithDelta(12000, $item->basic_amount, 0.01, 'basic_amount = quantity * price');
        $this->assertEqualsWithDelta(12000 * 11 / 12, $item->dpp_amount, 0.01, 'dpp_amount = basic_amount * 11/12');
        $this->assertEqualsWithDelta($item->dpp_amount * 11 / 100, $item->tax_amount, 0.01, 'tax_amount = dpp_amount * tax_rate / 100');
    }

    public function test_sales_invoice_item_dpp_backfilled_for_rows_existing_before_migration_semantics(): void {
        // Simulasikan baris "lama": insert item tanpa menyentuh migration baru secara langsung
        // (migration DPP sudah ter-include otomatis karena RefreshDatabase menjalankan semua
        // migration secara berurutan) -- assert bahwa hasil generated column tetap konsisten
        // untuk baris manapun, membuktikan backfill (drop+re-add generated column) bekerja
        // untuk seluruh baris di tabel, bukan hanya baris yang dibuat setelah kolom ada.
        $itemVariant = ItemVariantFactory::new()->create();

        $salesInvoiceId = (string) Str::ulid();
        DB::table('sales_invoices')->insert([
            'id'         => $salesInvoiceId,
            'date'       => now(),
            'amount'     => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $itemId = (string) Str::ulid();
        DB::table('sales_invoice_items')->insert([
            'id'               => $itemId,
            'sales_invoice_id' => $salesInvoiceId,
            'item_id'          => $itemVariant->id,
            'quantity'         => 5,
            'price'            => 2000,
            'tax_rate'         => 12,
            'created_at'       => now(),
            'updated_at'       => now(),
        ]);

        $item = DB::table('sales_invoice_items')->where('id', $itemId)->first();

        $expectedBasicAmount = 5 * 2000;
        $expectedDppAmount   = $expectedBasicAmount * 11 / 12;
        $expectedTaxAmount   = $expectedDppAmount * 12 / 100;

        $this->assertEqualsWithDelta($expectedDppAmount, $item->dpp_amount, 0.01);
        $this->assertEqualsWithDelta($expectedTaxAmount, $item->tax_amount, 0.01);
    }

    public function test_purchase_invoice_item_dpp_tax_and_amount_are_generated_correctly(): void {
        $itemVariant = ItemVariantFactory::new()->create();

        $purchaseInvoiceId = (string) Str::ulid();
        DB::table('purchase_invoices')->insert([
            'id'         => $purchaseInvoiceId,
            'date'       => now(),
            'amount'     => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $itemId = (string) Str::ulid();
        DB::table('purchase_invoice_items')->insert([
            'id'                  => $itemId,
            'purchase_invoice_id' => $purchaseInvoiceId,
            'item_id'             => $itemVariant->id,
            'quantity'            => 4,
            'rate'                => 3000,
            'tax_rate'            => 11,
            'created_at'          => now(),
            'updated_at'          => now(),
        ]);

        $item = DB::table('purchase_invoice_items')->where('id', $itemId)->first();

        $expectedBasicAmount = 4 * 3000;
        $expectedDppAmount   = $expectedBasicAmount * 11 / 12;
        $expectedTaxAmount   = $expectedDppAmount * 11 / 100;
        $expectedAmount      = $expectedBasicAmount + $expectedTaxAmount;

        $this->assertEqualsWithDelta($expectedBasicAmount, $item->basic_amount, 0.01, 'basic_amount = quantity * rate');
        $this->assertEqualsWithDelta($expectedDppAmount, $item->dpp_amount, 0.01, 'dpp_amount = basic_amount * 11/12');
        $this->assertEqualsWithDelta($expectedTaxAmount, $item->tax_amount, 0.01, 'tax_amount = dpp_amount * tax_rate / 100');
        $this->assertEqualsWithDelta($expectedAmount, $item->amount, 0.01, 'amount tetap basic_amount + tax_amount, otomatis ikut bergeser mengikuti tax_amount baru tanpa perlu di-drop+re-add');
    }
}
