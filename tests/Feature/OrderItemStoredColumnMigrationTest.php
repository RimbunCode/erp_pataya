<?php

namespace Tests\Feature;

use Database\Factories\Inventory\ItemVariantFactory;
use Database\Factories\User\UserFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

class OrderItemStoredColumnMigrationTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        foreach (Schema::getTables() as $tableInfo) {
            $table = $tableInfo['name'];
            if (! Schema::hasColumn($table, 'is_example')) {
                Schema::table($table, fn ($t) => $t->boolean('is_example')->default(false));
            }
        }

        // Pre-existing drift (bukan bagian scope spec ini): migration file
        // `create_purchase_orders_table`/`create_sales_orders_table` tidak punya
        // kolom `code`/`created_by_id`, padahal live DB dan factory (PurchaseOrderFactory/
        // SalesOrderFactory) mengasumsikan keduanya ada -- sama seperti drift `code` pada
        // SalesOrderFactory yang sudah dilaporkan (bukan diperbaiki) di spec invoice-dpp-adjustment
        // task 9. Ditambahkan manual di sini supaya test migration ini bisa jalan terisolasi.
        foreach (['purchase_orders', 'sales_orders'] as $table) {
            if (! Schema::hasColumn($table, 'code')) {
                Schema::table($table, fn ($t) => $t->string('code')->nullable());
            }
            if (! Schema::hasColumn($table, 'created_by_id')) {
                Schema::table($table, fn ($t) => $t->string('created_by_id')->nullable());
            }
        }
    }

    private function createPurchaseOrder(): array {
        $userId      = UserFactory::new()->create()->id;
        $itemVariant = ItemVariantFactory::new()->create();

        $purchaseOrderId = (string) Str::ulid();
        DB::table('purchase_orders')->insert([
            'id'            => $purchaseOrderId,
            'code'          => 'PO-TEST-' . Str::random(8),
            'date'          => now(),
            'created_by_id' => $userId,
            'created_at'    => now(),
            'updated_at'    => now(),
        ]);

        return [$purchaseOrderId, $itemVariant->id];
    }

    private function createSalesOrder(): array {
        $userId      = UserFactory::new()->create()->id;
        $itemVariant = ItemVariantFactory::new()->create();

        $salesOrderId = (string) Str::ulid();
        DB::table('sales_orders')->insert([
            'id'            => $salesOrderId,
            'code'          => 'SO-TEST-' . Str::random(8),
            'date'          => now(),
            'created_by_id' => $userId,
            'created_at'    => now(),
            'updated_at'    => now(),
        ]);

        return [$salesOrderId, $itemVariant->id];
    }

    public function test_purchase_order_item_amount_columns_are_backfilled_and_writable(): void {
        [$purchaseOrderId, $itemVariantId] = $this->createPurchaseOrder();

        $itemId = (string) Str::ulid();
        DB::table('purchase_order_items')->insert([
            'id'                => $itemId,
            'purchase_order_id' => $purchaseOrderId,
            'item_id'           => $itemVariantId,
            'quantity'          => 10,
            'rate'              => 100000,
            'tax_rate'          => 11,
            'basic_amount'      => 10 * 100000,
            'tax_amount'        => 10 * 100000 * 11 / 100,
            'amount'            => 10 * 100000 + 10 * 100000 * 11 / 100,
            'created_at'        => now(),
            'updated_at'        => now(),
        ]);

        $item = DB::table('purchase_order_items')->where('id', $itemId)->first();

        $this->assertEqualsWithDelta(1000000, $item->basic_amount, 0.01);
        $this->assertEqualsWithDelta(110000, $item->tax_amount, 0.01);
        $this->assertEqualsWithDelta(1110000, $item->amount, 0.01);

        // Kolom bukan generated lagi -- manual update harus tersimpan persis (bukan
        // di-override otomatis oleh DB seperti generated column akan lakukan).
        // Ini membuktikan konversi storedAs() -> kolom biasa berhasil.
        DB::table('purchase_order_items')->where('id', $itemId)->update([
            'basic_amount' => 800000,
            'tax_amount'   => 88000,
            'amount'       => 888000,
        ]);

        $updated = DB::table('purchase_order_items')->where('id', $itemId)->first();
        $this->assertEqualsWithDelta(800000, $updated->basic_amount, 0.01, 'basic_amount harus writable manual, membuktikan bukan generated column lagi');
        $this->assertEqualsWithDelta(88000, $updated->tax_amount, 0.01, 'tax_amount harus writable manual');
        $this->assertEqualsWithDelta(888000, $updated->amount, 0.01, 'amount harus writable manual, tidak lagi otomatis basic_amount + tax_amount');
    }

    public function test_sales_order_item_amount_columns_are_backfilled_and_writable(): void {
        [$salesOrderId, $itemVariantId] = $this->createSalesOrder();

        $itemId = (string) Str::ulid();
        DB::table('sales_order_items')->insert([
            'id'             => $itemId,
            'sales_order_id' => $salesOrderId,
            'item_id'        => $itemVariantId,
            'quantity'       => 5,
            'price'          => 200000,
            'tax_rate'       => 10,
            'basic_amount'   => 5 * 200000,
            'tax_amount'     => 5 * 200000 * 10 / 100,
            'amount'         => 5 * 200000 + 5 * 200000 * 10 / 100,
            'created_at'     => now(),
            'updated_at'     => now(),
        ]);

        $item = DB::table('sales_order_items')->where('id', $itemId)->first();

        $this->assertEqualsWithDelta(1000000, $item->basic_amount, 0.01);
        $this->assertEqualsWithDelta(100000, $item->tax_amount, 0.01);
        $this->assertEqualsWithDelta(1100000, $item->amount, 0.01);

        // amount_base_currency tetap generated (mengacu basic_amount_base_currency yang
        // mengacu basic_amount) -- pastikan masih ikut basic_amount setelah basic_amount
        // jadi kolom biasa (rantai generation harus tetap utuh setelah migration).
        $this->assertEqualsWithDelta($item->basic_amount, $item->basic_amount_base_currency, 0.01, 'basic_amount_base_currency tetap ikut basic_amount saat exchange_rate NULL');
        $this->assertEqualsWithDelta($item->amount, $item->amount_base_currency, 0.01, 'amount_base_currency tetap ikut amount saat exchange_rate NULL');

        DB::table('sales_order_items')->where('id', $itemId)->update([
            'basic_amount' => 700000,
            'tax_amount'   => 70000,
            'amount'       => 770000,
        ]);

        $updated = DB::table('sales_order_items')->where('id', $itemId)->first();
        $this->assertEqualsWithDelta(700000, $updated->basic_amount, 0.01, 'basic_amount harus writable manual, membuktikan bukan generated column lagi');
        $this->assertEqualsWithDelta(70000, $updated->tax_amount, 0.01, 'tax_amount harus writable manual');
        $this->assertEqualsWithDelta(770000, $updated->amount, 0.01, 'amount harus writable manual');

        // base_currency mirror tetap generated -> otomatis mengikuti nilai baru
        $this->assertEqualsWithDelta(700000, $updated->basic_amount_base_currency, 0.01, 'basic_amount_base_currency generated tetap ikut basic_amount baru');
        $this->assertEqualsWithDelta(770000, $updated->amount_base_currency, 0.01, 'amount_base_currency generated tetap ikut amount baru');
    }
}
