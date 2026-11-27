<?php

namespace Tests\Feature;

use App\Models\Finances\FinanceSetting;
use App\Services\Core\Setting\SettingsService;
use Database\Factories\Inventory\ItemVariantFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use RuntimeException;
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

    private function migration(): object {
        return require database_path('migrations/2026_11_27_100001_convert_invoice_item_calculated_columns_to_stored_values.php');
    }

    /**
     * @return array<int, string>
     */
    private function generatedColumns(string $table): array {
        return collect(Schema::getColumns($table))->filter(fn (array $column): bool => $column['generation'] !== null)->pluck('name')->all();
    }

    private function insertSalesItem(string $price = '1200', int $quantity = 10, int $taxRate = 11): string {
        $itemVariant = ItemVariantFactory::new()->create();

        $invoiceId = (string) Str::ulid();
        DB::table('sales_invoices')->insert(['id' => $invoiceId, 'date' => now(), 'amount' => 0, 'created_at' => now(), 'updated_at' => now()]);

        $itemId = (string) Str::ulid();
        DB::table('sales_invoice_items')->insert([
            'id'               => $itemId,
            'sales_invoice_id' => $invoiceId,
            'item_id'          => $itemVariant->id,
            'quantity'         => $quantity,
            'price'            => $price,
            'tax_rate'         => $taxRate,
            'created_at'       => now(),
            'updated_at'       => now(),
        ]);

        return $itemId;
    }

    private function insertPurchaseItem(): string {
        $itemVariant = ItemVariantFactory::new()->create();

        $invoiceId = (string) Str::ulid();
        DB::table('purchase_invoices')->insert(['id' => $invoiceId, 'date' => now(), 'amount' => 0, 'created_at' => now(), 'updated_at' => now()]);

        $itemId = (string) Str::ulid();
        DB::table('purchase_invoice_items')->insert([
            'id'                  => $itemId,
            'purchase_invoice_id' => $invoiceId,
            'item_id'             => $itemVariant->id,
            'quantity'            => 4,
            'rate'                => 3000,
            'tax_rate'            => 11,
            'created_at'          => now(),
            'updated_at'          => now(),
        ]);

        return $itemId;
    }

    public function test_dpp_tax_and_amount_columns_are_plain_stored_columns_after_the_conversion(): void {
        $this->assertNotContains('dpp_amount', $this->generatedColumns('sales_invoice_items'));
        $this->assertNotContains('tax_amount', $this->generatedColumns('sales_invoice_items'));
        $this->assertNotContains('dpp_amount', $this->generatedColumns('purchase_invoice_items'));
        $this->assertNotContains('tax_amount', $this->generatedColumns('purchase_invoice_items'));
        $this->assertNotContains('amount', $this->generatedColumns('purchase_invoice_items'));
        $this->assertContains('basic_amount', $this->generatedColumns('sales_invoice_items'));
        $this->assertContains('basic_amount', $this->generatedColumns('purchase_invoice_items'));

        foreach (['sales_invoice_items', 'purchase_invoice_items'] as $table) {
            $this->assertTrue(Schema::hasColumn($table, 'withholding_amount'));
            $this->assertFalse(Schema::hasColumn($table, 'dpp_amount_v2'), 'Kolom sementara harus sudah di-rename.');
        }
    }

    public function test_a_raw_insert_no_longer_computes_dpp_and_tax_so_the_engine_is_the_only_writer(): void {
        $item = DB::table('sales_invoice_items')->where('id', $this->insertSalesItem())->first();

        $this->assertEqualsWithDelta(12000, $item->basic_amount, 0.01, 'basic_amount tetap quantity x price (generated).');
        $this->assertEqualsWithDelta(0, $item->dpp_amount, 0.001);
        $this->assertEqualsWithDelta(0, $item->tax_amount, 0.001);
        $this->assertEqualsWithDelta(0, $item->withholding_amount, 0.001);
    }

    public function test_down_then_up_round_trip_preserves_values_with_parity(): void {
        $migration = $this->migration();
        $migration->down();

        $this->assertContains('dpp_amount', $this->generatedColumns('sales_invoice_items'));
        $this->assertContains('tax_amount', $this->generatedColumns('purchase_invoice_items'));
        $this->assertContains('amount', $this->generatedColumns('purchase_invoice_items'));

        // Dengan generated lama, baris mentah dihitung otomatis 11/12.
        $salesId        = $this->insertSalesItem('1200', 10, 11);
        $purchaseId     = $this->insertPurchaseItem();
        $salesBefore    = DB::table('sales_invoice_items')->where('id', $salesId)->first();
        $purchaseBefore = DB::table('purchase_invoice_items')->where('id', $purchaseId)->first();
        $this->assertEqualsWithDelta(12000 * 11 / 12, $salesBefore->dpp_amount, 0.01);
        $this->assertEqualsWithDelta(12000 * 11 / 12 * 11 / 100, $salesBefore->tax_amount, 0.01);

        $migration->up();

        $this->assertNotContains('dpp_amount', $this->generatedColumns('sales_invoice_items'));
        $sales    = DB::table('sales_invoice_items')->where('id', $salesId)->first();
        $purchase = DB::table('purchase_invoice_items')->where('id', $purchaseId)->first();

        $this->assertEqualsWithDelta($salesBefore->dpp_amount, $sales->dpp_amount, 0.01, 'Paritas dpp_amount pasca salin.');
        $this->assertEqualsWithDelta($salesBefore->tax_amount, $sales->tax_amount, 0.01);
        $this->assertEqualsWithDelta($purchaseBefore->dpp_amount, $purchase->dpp_amount, 0.01);
        $this->assertEqualsWithDelta($purchaseBefore->tax_amount, $purchase->tax_amount, 0.01);
        $this->assertEqualsWithDelta($purchaseBefore->amount, $purchase->amount, 0.01);
        $this->assertEqualsWithDelta(0, $sales->withholding_amount, 0.001);
    }

    public function test_down_refuses_to_run_when_stored_values_cannot_be_restored_as_generated(): void {
        $id = $this->insertSalesItem();
        DB::table('sales_invoice_items')->where('id', $id)->update(['dpp_amount' => 12000, 'tax_amount' => 0, 'withholding_amount' => 240]);

        $this->expectException(RuntimeException::class);
        $this->migration()->down();
    }

    public function test_down_refuses_to_run_when_values_drift_from_the_legacy_formula(): void {
        $id = $this->insertSalesItem();
        // Faktor 1/1 (bukan 11/12): angka tersimpan tidak bisa diwakili kolom generated lama.
        DB::table('sales_invoice_items')->where('id', $id)->update(['dpp_amount' => 12000, 'tax_amount' => 1320]);

        $this->expectException(RuntimeException::class);
        $this->migration()->down();
    }

    public function test_the_calculation_setting_is_enabled_by_the_migration(): void {
        $this->assertTrue((bool) app(SettingsService::class)->get(FinanceSetting::class)->tax_engine_calc_enabled);
    }
}
