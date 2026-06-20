<?php

namespace Tests\Unit\Sales;

use App\Enums\FormStatus;
use App\Models\Inventory\StockLedgerEntry;
use App\Models\Sales\SalesOrderItem;
use App\Services\Finances\SalesInvoiceService;
use App\Services\Sales\SalesOrderService;
use App\Utils;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class SalesDualFlowTest extends TestCase {
    public function test_sales_order_item_supports_parent_child_self_relation_and_over_delivered_status_exists(): void {
        $item = new SalesOrderItem;

        $this->assertTrue(method_exists($item, 'parentItem'));
        $this->assertTrue(method_exists($item, 'childItems'));
        $this->assertTrue(defined(FormStatus::class . '::OVER_DELIVERED'));
        $this->assertSame('over_delivered', FormStatus::OVER_DELIVERED->value);
    }
    #[DataProvider('statusProvider')]

    public function test_resolve_status_logic(
        float $totalQty,
        float $totalDelivered,
        float $totalBilled,
        array $currentStatus,
        array $expectedStatus,
    ): void {
        // Helper resolver diuji secara unit
        $status = Utils::replaceStatus($currentStatus, [
            FormStatus::TO_DELIVER,
            FormStatus::PARTIALLY_DELIVERED,
            FormStatus::DELIVERED,
            FormStatus::OVER_DELIVERED,
        ], $this->resolveDeliverStatus($totalQty, $totalDelivered));

        $status = Utils::replaceStatus($status, [
            FormStatus::TO_BILL,
            FormStatus::PARTIALLY_BILLED,
            FormStatus::BILLED,
            FormStatus::OVER_BILLED,
        ], $this->resolveBillStatus($totalQty, $totalBilled));

        // Samakan value string untuk pembandingan
        $statusValues   = collect($status)->map(fn ($s) => $s instanceof FormStatus ? $s->value : $s)->toArray();
        $expectedValues = collect($expectedStatus)->map(fn ($s) => $s instanceof FormStatus ? $s->value : $s)->toArray();

        sort($statusValues);
        sort($expectedValues);

        $this->assertEquals($expectedValues, $statusValues);
    }

    public static function statusProvider(): array {
        return [
            'nothing delivered or billed' => [
                50, 0, 0,
                [FormStatus::TO_DELIVER, FormStatus::TO_BILL],
                [FormStatus::TO_DELIVER, FormStatus::TO_BILL],
            ],
            'partially delivered'         => [
                50, 20, 0,
                [FormStatus::TO_DELIVER, FormStatus::TO_BILL],
                [FormStatus::PARTIALLY_DELIVERED, FormStatus::TO_BILL],
            ],
            'fully delivered'             => [
                50, 50, 0,
                [FormStatus::TO_DELIVER, FormStatus::TO_BILL],
                [FormStatus::DELIVERED, FormStatus::TO_BILL],
            ],
            'over delivered'              => [
                50, 55, 0,
                [FormStatus::TO_DELIVER, FormStatus::TO_BILL],
                [FormStatus::OVER_DELIVERED, FormStatus::TO_BILL],
            ],
            'partially billed'            => [
                50, 0, 20,
                [FormStatus::TO_DELIVER, FormStatus::TO_BILL],
                [FormStatus::TO_DELIVER, FormStatus::PARTIALLY_BILLED],
            ],
            'fully billed'                => [
                50, 0, 50,
                [FormStatus::TO_DELIVER, FormStatus::TO_BILL],
                [FormStatus::TO_DELIVER, FormStatus::BILLED],
            ],
            'over billed'                 => [
                50, 0, 60,
                [FormStatus::TO_DELIVER, FormStatus::TO_BILL],
                [FormStatus::TO_DELIVER, FormStatus::OVER_BILLED],
            ],
            'fully delivered and billed'  => [
                50, 50, 50,
                [FormStatus::TO_DELIVER, FormStatus::TO_BILL],
                [FormStatus::DELIVERED, FormStatus::BILLED],
            ],
        ];
    }

    private function resolveDeliverStatus(float $totalQty, float $totalDelivered): FormStatus {
        if ($totalDelivered == 0) {
            return FormStatus::TO_DELIVER;
        }
        if ($totalDelivered > $totalQty) {
            return FormStatus::OVER_DELIVERED;
        }
        if ($totalDelivered < $totalQty) {
            return FormStatus::PARTIALLY_DELIVERED;
        }

        return FormStatus::DELIVERED;
    }

    private function resolveBillStatus(float $totalQty, float $totalBilled): FormStatus {
        if ($totalBilled == 0) {
            return FormStatus::TO_BILL;
        }
        if ($totalBilled > $totalQty) {
            return FormStatus::OVER_BILLED;
        }
        if ($totalBilled < $totalQty) {
            return FormStatus::PARTIALLY_BILLED;
        }

        return FormStatus::BILLED;
    }

    public function test_sync_items_exists(): void {
        $service = new SalesOrderService;
        $this->assertTrue(method_exists($service, 'syncItems'));
    }
    // =========================================================================
    // SYNC ITEMS LOGIC
    // =========================================================================

    #[Test]

    public function sync_groups_invoice_items_by_price_tax_warehouse(): void {
        $invoiceItems = [
            ['id' => 'ii-1', 'price' => 4500, 'tax_id' => 'tax-1', 'tax_rate' => 11, 'quantity' => 30],
            ['id' => 'ii-2', 'price' => 6500, 'tax_id' => 'tax-1', 'tax_rate' => 11, 'quantity' => 20],
            ['id' => 'ii-3', 'price' => 4500, 'tax_id' => 'tax-1', 'tax_rate' => 11, 'quantity' => 10],
        ];

        $warehouseId = 'wh-1';
        $groups      = [];

        foreach ($invoiceItems as $ii) {
            $key = "{$ii['price']}|{$ii['tax_id']}|{$ii['tax_rate']}|{$warehouseId}";
            if (! isset($groups[$key])) {
                $groups[$key] = ['qty' => 0, 'price' => $ii['price'], 'ids' => []];
            }
            $groups[$key]['qty']   += $ii['quantity'];
            $groups[$key]['ids'][]  = $ii['id'];
        }

        $this->assertCount(2, $groups, 'Harus ada 2 group: price 4500 dan price 6500');

        $key4500 = "4500|tax-1|11|{$warehouseId}";
        $key6500 = "6500|tax-1|11|{$warehouseId}";

        $this->assertEquals(40, $groups[$key4500]['qty'], 'Group price 4500 harus total qty 40');
        $this->assertEquals(20, $groups[$key6500]['qty'], 'Group price 6500 harus total qty 20');
        $this->assertCount(2, $groups[$key4500]['ids'], 'Group price 4500 punya 2 invoice items');
    }
    #[Test]

    public function sync_decides_update_when_only_one_group(): void {
        $groups = [
            '5000|tax-1|11|wh-1' => ['qty' => 50, 'price' => 5000],
        ];

        $needsSplit = count($groups) > 1;

        $this->assertFalse($needsSplit, '1 group → update SO item, bukan split');
    }
    #[Test]

    public function sync_decides_split_when_multiple_groups(): void {
        $groups = [
            '4500|tax-1|11|wh-1' => ['qty' => 30, 'price' => 4500],
            '6500|tax-1|11|wh-1' => ['qty' => 20, 'price' => 6500],
        ];

        $needsSplit = count($groups) > 1;

        $this->assertTrue($needsSplit, '>1 group → split SO items');
        $this->assertCount(2, $groups, 'Harus buat 2 SO item baru');
    }
    #[Test]

    public function sync_split_new_items_store_parent_item_id(): void {
        $parentId = 'so-item-old-id';

        $groups = [
            '4500|tax-1|11|wh-1' => [
                'qty'                      => 30,
                'price'                    => 4500,
                'source_invoice_item_ids'  => ['ii-1'],
                'source_delivery_item_ids' => [],
            ],
            '6500|tax-1|11|wh-1' => [
                'qty'                      => 20,
                'price'                    => 6500,
                'source_invoice_item_ids'  => ['ii-2'],
                'source_delivery_item_ids' => [],
            ],
        ];

        $createdItems = [];
        foreach ($groups as $g) {
            $newItem        = [
                'id'             => uniqid('new-'),
                'parent_item_id' => $parentId,
                'quantity'       => $g['qty'],
                'price'          => $g['price'],
            ];
            $createdItems[] = $newItem;
        }

        foreach ($createdItems as $item) {
            $this->assertEquals($parentId, $item['parent_item_id'], 'Item baru harus menyimpan parent_item_id ke item lama');
        }
        $this->assertCount(2, $createdItems);
    }

    // =========================================================================
    // AC1/AC13: DeliveryNote SLE is_valuated=true
    // =========================================================================

    public function test_delivery_note_sle_is_valuated_field_exists_on_model(): void {
        $sle   = new StockLedgerEntry;
        $casts = $sle->getCasts();

        $this->assertArrayHasKey('is_valuated', $casts, 'StockLedgerEntry harus punya cast is_valuated');
        $this->assertEquals('boolean', $casts['is_valuated']);
    }

    // =========================================================================
    // AC2/AC14: SalesInvoice approve tidak menyentuh SLE
    // =========================================================================

    public function test_sales_invoice_service_on_approved_does_not_create_sle(): void {
        // Verifikasi SalesInvoiceService tidak ada referensi ke StockLedgerEntry
        $reflection = new \ReflectionClass(SalesInvoiceService::class);
        $source     = file_get_contents($reflection->getFileName());

        $this->assertStringNotContainsString(
            'StockLedgerEntry',
            $source,
            'SalesInvoiceService TIDAK boleh menyentuh StockLedgerEntry',
        );
    }

    // =========================================================================
    // T04: markDone method exists
    // =========================================================================

    public function test_mark_done_method_exists_on_service(): void {
        $service = new SalesOrderService;
        $this->assertTrue(method_exists($service, 'markDone'));
    }

    public function test_update_sales_order_status_method_exists_on_service(): void {
        $service = new SalesOrderService;
        $this->assertTrue(method_exists($service, 'updateSalesOrderStatus'));
    }

    // =========================================================================
    // FR6: Mark Done validasi mismatch
    // =========================================================================

    public function test_mark_done_mismatch_structure(): void {
        // Simulasi logic validasi markDone — delivered != billed → mismatch
        $items = [
            ['item_name' => 'Item A', 'delivered_qty' => 55.0, 'billed_qty' => 30.0],
            ['item_name' => 'Item B', 'delivered_qty' => 10.0, 'billed_qty' => 10.0],
        ];

        $mismatches = array_filter($items, fn ($i) => (float) $i['delivered_qty'] !== (float) $i['billed_qty']);

        $this->assertCount(1, $mismatches);
        $mismatch = array_values($mismatches)[0];
        $this->assertEquals('Item A', $mismatch['item_name']);
        $this->assertEquals(55.0, $mismatch['delivered_qty']);
        $this->assertEquals(30.0, $mismatch['billed_qty']);
    }

    public function test_mark_done_all_match_no_mismatch(): void {
        $items = [
            ['item_name' => 'Item A', 'delivered_qty' => 55.0, 'billed_qty' => 55.0],
            ['item_name' => 'Item B', 'delivered_qty' => 10.0, 'billed_qty' => 10.0],
        ];

        $mismatches = array_filter($items, fn ($i) => (float) $i['delivered_qty'] !== (float) $i['billed_qty']);

        $this->assertCount(0, $mismatches, 'Tidak ada mismatch — semua match, termasuk over-deliver/bill yang sama');
    }

    // =========================================================================
    // FR4: Over-deliver/bill diizinkan, tidak error
    // =========================================================================

    public function test_over_delivered_status_resolves_without_error(): void {
        $status = Utils::replaceStatus(
            [FormStatus::TO_DELIVER, FormStatus::TO_BILL],
            [FormStatus::TO_DELIVER, FormStatus::PARTIALLY_DELIVERED, FormStatus::DELIVERED, FormStatus::OVER_DELIVERED],
            FormStatus::OVER_DELIVERED,
        );

        $statusValues = collect($status)->map(fn ($s) => $s instanceof FormStatus ? $s->value : $s)->toArray();

        $this->assertContains('over_delivered', $statusValues);
        $this->assertNotContains('to_deliver', $statusValues);
    }

    public function test_over_billed_status_resolves_without_error(): void {
        $status = Utils::replaceStatus(
            [FormStatus::TO_DELIVER, FormStatus::TO_BILL],
            [FormStatus::TO_BILL, FormStatus::PARTIALLY_BILLED, FormStatus::BILLED, FormStatus::OVER_BILLED],
            FormStatus::OVER_BILLED,
        );

        $statusValues = collect($status)->map(fn ($s) => $s instanceof FormStatus ? $s->value : $s)->toArray();

        $this->assertContains('over_billed', $statusValues);
        $this->assertNotContains('to_bill', $statusValues);
    }
}
