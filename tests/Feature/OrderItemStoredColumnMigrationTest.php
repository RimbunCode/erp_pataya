<?php

namespace Tests\Feature;

use Database\Factories\Inventory\ItemVariantFactory;
use Database\Factories\User\UserFactory;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Verifikasi migration add_discount_amount_to_purchase_order_items_table /
 * add_discount_amount_to_sales_order_items_table: basic_amount KEMBALI jadi
 * generated column (quantity * rate/price) -- kebalikan dari migration
 * convert_purchase_order_items_amounts_to_stored_columns (spec
 * dpp-discount-and-tax-compliance), diselaraskan dengan pola
 * PurchaseInvoiceItem/SalesInvoiceItem. discount_amount kolom baru (biasa,
 * writable), tax_amount/amount TETAP writable (beda dari Invoice yang punya
 * dpp_amount sebagai perantara generated).
 */
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

    public function test_purchase_order_item_basic_amount_is_generated_and_rejects_manual_write(): void {
        [$purchaseOrderId, $itemVariantId] = $this->createPurchaseOrder();

        $itemId = (string) Str::ulid();
        DB::table('purchase_order_items')->insert([
            'id'                => $itemId,
            'purchase_order_id' => $purchaseOrderId,
            'item_id'           => $itemVariantId,
            'quantity'          => 10,
            'rate'              => 100000,
            'tax_rate'          => 11,
            'discount_amount'   => 0,
            'tax_amount'        => 10 * 100000 * 11 / 100,
            'amount'            => 10 * 100000 + 10 * 100000 * 11 / 100,
            'created_at'        => now(),
            'updated_at'        => now(),
        ]);

        $item = DB::table('purchase_order_items')->where('id', $itemId)->first();

        // basic_amount generated dari quantity * rate -- tidak perlu diinsert manual
        $this->assertEqualsWithDelta(1000000, $item->basic_amount, 0.01);
        $this->assertEqualsWithDelta(110000, $item->tax_amount, 0.01);
        $this->assertEqualsWithDelta(1110000, $item->amount, 0.01);

        // discount_amount/tax_amount/amount TETAP writable manual (Service layer yang menulis)
        DB::table('purchase_order_items')->where('id', $itemId)->update([
            'discount_amount' => 200000,
            'tax_amount'      => 88000,
            'amount'          => 888000,
        ]);

        $updated = DB::table('purchase_order_items')->where('id', $itemId)->first();
        $this->assertEqualsWithDelta(1000000, $updated->basic_amount, 0.01, 'basic_amount kotor tidak berubah walau discount_amount ditulis');
        $this->assertEqualsWithDelta(200000, $updated->discount_amount, 0.01);
        $this->assertEqualsWithDelta(88000, $updated->tax_amount, 0.01, 'tax_amount harus tetap writable manual');
        $this->assertEqualsWithDelta(888000, $updated->amount, 0.01, 'amount harus tetap writable manual');

        // basic_amount sendiri REJECT manual write -- generated column
        $this->expectException(QueryException::class);
        DB::table('purchase_order_items')->where('id', $itemId)->update(['basic_amount' => 1]);
    }

    public function test_sales_order_item_basic_amount_is_generated_and_base_currency_chain_follows_net(): void {
        [$salesOrderId, $itemVariantId] = $this->createSalesOrder();

        $itemId = (string) Str::ulid();
        DB::table('sales_order_items')->insert([
            'id'              => $itemId,
            'sales_order_id'  => $salesOrderId,
            'item_id'         => $itemVariantId,
            'quantity'        => 5,
            'price'           => 200000,
            'tax_rate'        => 10,
            'discount_amount' => 0,
            'tax_amount'      => 5 * 200000 * 10 / 100,
            'amount'          => 5 * 200000 + 5 * 200000 * 10 / 100,
            'created_at'      => now(),
            'updated_at'      => now(),
        ]);

        $item = DB::table('sales_order_items')->where('id', $itemId)->first();

        $this->assertEqualsWithDelta(1000000, $item->basic_amount, 0.01);
        $this->assertEqualsWithDelta(100000, $item->tax_amount, 0.01);
        $this->assertEqualsWithDelta(1100000, $item->amount, 0.01);

        // *_base_currency generated dari (basic_amount - discount_amount)/tax_amount --
        // NET, bukan basic_amount kotor -- konsisten dengan nilai currency dokumen.
        $this->assertEqualsWithDelta($item->basic_amount, $item->basic_amount_base_currency, 0.01, 'basic_amount_base_currency ikut basic_amount saat discount_amount=0 & exchange_rate NULL');
        $this->assertEqualsWithDelta($item->amount, $item->amount_base_currency, 0.01, 'amount_base_currency ikut amount saat exchange_rate NULL');

        DB::table('sales_order_items')->where('id', $itemId)->update([
            'discount_amount' => 300000,
            'tax_amount'      => 70000,
            'amount'          => 770000,
        ]);

        $updated = DB::table('sales_order_items')->where('id', $itemId)->first();
        $this->assertEqualsWithDelta(1000000, $updated->basic_amount, 0.01, 'basic_amount kotor tidak berubah');
        $this->assertEqualsWithDelta(300000, $updated->discount_amount, 0.01);
        $this->assertEqualsWithDelta(70000, $updated->tax_amount, 0.01, 'tax_amount harus tetap writable manual');
        $this->assertEqualsWithDelta(770000, $updated->amount, 0.01, 'amount harus tetap writable manual');

        // base_currency mirror generated dari NET (basic_amount - discount_amount), bukan basic_amount kotor
        $this->assertEqualsWithDelta(700000, $updated->basic_amount_base_currency, 0.01, 'basic_amount_base_currency generated dari (basic_amount - discount_amount)');
        $this->assertEqualsWithDelta(770000, $updated->amount_base_currency, 0.01, 'amount_base_currency generated ikut amount baru');

        // basic_amount sendiri REJECT manual write -- generated column
        $this->expectException(QueryException::class);
        DB::table('sales_order_items')->where('id', $itemId)->update(['basic_amount' => 1]);
    }
}
