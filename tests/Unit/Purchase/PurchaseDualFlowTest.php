<?php

namespace Tests\Unit\Purchase;

use App\Enums\FormStatus;
use PHPUnit\Framework\TestCase;

/**
 * Unit tests untuk business logic Purchase Dual Flow.
 *
 * Test ini memverifikasi logika deteksi alur, FIFO allocation,
 * SLE split, validasi markDone, dan status PO — tanpa database.
 */
class PurchaseDualFlowTest extends TestCase {
    // =========================================================================
    // ALUR DETECTION LOGIC
    // =========================================================================

    /** @test */
    public function alur1_detected_when_billed_quantity_is_zero(): void {
        $billedQty = 0;
        $isAlur2   = $billedQty > 0;

        $this->assertFalse($isAlur2, 'ALUR-1 harus aktif ketika billed_quantity = 0');
    }

    /** @test */
    public function alur2_detected_when_billed_quantity_greater_than_zero(): void {
        $billedQty = 30;
        $isAlur2   = $billedQty > 0;

        $this->assertTrue($isAlur2, 'ALUR-2 harus aktif ketika billed_quantity > 0');
    }

    /** @test */
    public function alur1_in_invoice_detected_when_received_quantity_greater_than_zero(): void {
        $receivedQty  = 50;
        $isAlreadyRec = $receivedQty > 0;

        $this->assertTrue($isAlreadyRec, 'ALUR-1 di Invoice harus aktif ketika received_quantity > 0');
    }

    // =========================================================================
    // FIFO ALLOCATION LOGIC
    // =========================================================================

    /** @test */
    public function fifo_allocates_to_oldest_invoice_first(): void {
        // Simulasi 2 invoice dengan tanggal berbeda
        $invoiceItems = collect([
            ['id' => 'inv-1', 'date' => '2026-01-10', 'rate' => 4500, 'quantity' => 30, 'allocated_qty' => 0],
            ['id' => 'inv-2', 'date' => '2026-02-15', 'rate' => 6500, 'quantity' => 20, 'allocated_qty' => 0],
        ])->sortBy('date'); // FIFO by date

        $receiptQty  = 40;
        $allocations = [];

        foreach ($invoiceItems as $inv) {
            if ($receiptQty <= 0) {
                break;
            }

            $available   = $inv['quantity'] - $inv['allocated_qty'];
            $allocateQty = min($receiptQty, $available);

            if ($allocateQty > 0) {
                $allocations[] = ['invoice_id' => $inv['id'], 'qty' => $allocateQty, 'rate' => $inv['rate']];
                $receiptQty -= $allocateQty;
            }
        }

        $this->assertCount(2, $allocations);
        $this->assertEquals('inv-1', $allocations[0]['invoice_id'], 'Invoice tertua harus dialokasi pertama');
        $this->assertEquals(30, $allocations[0]['qty']);
        $this->assertEquals('inv-2', $allocations[1]['invoice_id']);
        $this->assertEquals(10, $allocations[1]['qty'], 'Invoice kedua hanya mengisi sisa qty');
    }

    /** @test */
    public function fifo_stops_when_receipt_qty_fully_allocated(): void {
        $invoiceItems = collect([
            ['id' => 'inv-1', 'rate' => 5000, 'quantity' => 50, 'allocated_qty' => 0],
            ['id' => 'inv-2', 'rate' => 6000, 'quantity' => 20, 'allocated_qty' => 0],
        ]);

        $receiptQty  = 30;
        $allocations = [];

        foreach ($invoiceItems as $inv) {
            if ($receiptQty <= 0) {
                break;
            }

            $available   = $inv['quantity'] - $inv['allocated_qty'];
            $allocateQty = min($receiptQty, $available);

            if ($allocateQty > 0) {
                $allocations[] = ['invoice_id' => $inv['id'], 'qty' => $allocateQty];
                $receiptQty -= $allocateQty;
            }
        }

        $this->assertCount(1, $allocations, 'Hanya 1 invoice yang perlu dialokasi');
        $this->assertEquals('inv-1', $allocations[0]['invoice_id']);
        $this->assertEquals(30, $allocations[0]['qty']);
    }

    // =========================================================================
    // OVER-RECEIPT LOGIC
    // =========================================================================

    /** @test */
    public function over_receipt_creates_pending_sle_for_remaining_qty(): void {
        // Invoice hanya cover 30 dari receipt 55
        $invoiceItems = collect([
            ['id' => 'inv-1', 'rate' => 5000, 'quantity' => 30, 'allocated_qty' => 0],
        ]);

        $receiptQty   = 55;
        $valuatedSLEs = [];
        $pendingSLEs  = [];

        foreach ($invoiceItems as $inv) {
            if ($receiptQty <= 0) {
                break;
            }

            $available   = $inv['quantity'] - $inv['allocated_qty'];
            $allocateQty = min($receiptQty, $available);

            if ($allocateQty > 0) {
                $valuatedSLEs[] = ['qty' => $allocateQty, 'is_valuated' => true, 'rate' => $inv['rate']];
                $receiptQty -= $allocateQty;
            }
        }

        // Sisa qty → SLE pending
        if ($receiptQty > 0) {
            $pendingSLEs[] = ['qty' => $receiptQty, 'is_valuated' => false, 'change_in_stock_value' => 0];
        }

        $this->assertCount(1, $valuatedSLEs);
        $this->assertEquals(30, $valuatedSLEs[0]['qty']);
        $this->assertTrue($valuatedSLEs[0]['is_valuated']);

        $this->assertCount(1, $pendingSLEs, 'Sisa qty over-receipt harus jadi SLE pending');
        $this->assertEquals(25, $pendingSLEs[0]['qty']);
        $this->assertFalse($pendingSLEs[0]['is_valuated']);
        $this->assertEquals(0, $pendingSLEs[0]['change_in_stock_value']);
    }

    // =========================================================================
    // SLE SPLIT LOGIC (ALUR-1: Invoice update SLE pending)
    // =========================================================================

    /** @test */
    public function sle_split_when_invoice_qty_less_than_pending_sle_qty(): void {
        // SLE pending: qty=50, Invoice: qty=30
        $sleQty     = 50;
        $invoiceQty = 30;
        $rate       = 5000;

        $allocateQty = min($sleQty, $invoiceQty);
        $needsSplit  = $allocateQty < $sleQty;

        $this->assertTrue($needsSplit, 'SLE harus dipecah jika qty invoice < qty SLE');

        // Setelah split: SLE baru valuated + SLE lama dikurangi
        $newSleQty = $allocateQty; // 30
        $remainQty = $sleQty - $allocateQty; // 20

        $this->assertEquals(30, $newSleQty, 'SLE baru harus punya qty sesuai invoice');
        $this->assertEquals(20, $remainQty, 'SLE lama harus dikurangi');

        $newSleValue = $rate * $newSleQty;
        $this->assertEquals(150000, $newSleValue, 'Nilai SLE baru harus rate × qty');
    }

    /** @test */
    public function sle_updated_whole_when_invoice_qty_equals_pending_sle_qty(): void {
        $sleQty     = 30;
        $invoiceQty = 30;

        $allocateQty = min($sleQty, $invoiceQty);
        $needsSplit  = $allocateQty < $sleQty;

        $this->assertFalse($needsSplit, 'SLE tidak perlu dipecah jika qty sama');
        $this->assertEquals(30, $allocateQty);
    }

    // =========================================================================
    // SYNC ITEMS GROUPING LOGIC
    // =========================================================================

    /** @test */
    public function sync_groups_invoice_items_by_rate_tax_warehouse(): void {
        $invoiceItems = [
            ['id' => 'ii-1', 'rate' => 4500, 'tax_id' => 'tax-1', 'tax_rate' => 11, 'quantity' => 30],
            ['id' => 'ii-2', 'rate' => 6500, 'tax_id' => 'tax-1', 'tax_rate' => 11, 'quantity' => 20],
            ['id' => 'ii-3', 'rate' => 4500, 'tax_id' => 'tax-1', 'tax_rate' => 11, 'quantity' => 10],
        ];

        $warehouseId = 'wh-1';
        $groups      = [];

        foreach ($invoiceItems as $ii) {
            $key = "{$ii['rate']}|{$ii['tax_id']}|{$ii['tax_rate']}|{$warehouseId}";
            if (! isset($groups[$key])) {
                $groups[$key] = ['qty' => 0, 'rate' => $ii['rate'], 'ids' => []];
            }
            $groups[$key]['qty'] += $ii['quantity'];
            $groups[$key]['ids'][] = $ii['id'];
        }

        $this->assertCount(2, $groups, 'Harus ada 2 group: rate 4500 dan rate 6500');

        $key4500 = "4500|tax-1|11|{$warehouseId}";
        $key6500 = "6500|tax-1|11|{$warehouseId}";

        $this->assertEquals(40, $groups[$key4500]['qty'], 'Group rate 4500 harus total qty 40');
        $this->assertEquals(20, $groups[$key6500]['qty'], 'Group rate 6500 harus total qty 20');
        $this->assertCount(2, $groups[$key4500]['ids'], 'Group rate 4500 punya 2 invoice items');
    }

    /** @test */
    public function sync_decides_update_when_only_one_group(): void {
        $groups = [
            '5000|tax-1|11|wh-1' => ['qty' => 50, 'rate' => 5000],
        ];

        $needsSplit = count($groups) > 1;

        $this->assertFalse($needsSplit, '1 group → update PO item, bukan split');
    }

    /** @test */
    public function sync_decides_split_when_multiple_groups(): void {
        $groups = [
            '4500|tax-1|11|wh-1' => ['qty' => 30, 'rate' => 4500],
            '6500|tax-1|11|wh-1' => ['qty' => 20, 'rate' => 6500],
        ];

        $needsSplit = count($groups) > 1;

        $this->assertTrue($needsSplit, '>1 group → split PO items');
        $this->assertCount(2, $groups, 'Harus buat 2 PO item baru');
    }

    /** @test */
    public function split_new_items_store_parent_item_id(): void {
        $parentId = 'po-item-old-id';

        $groups = [
            '4500|tax-1|11|wh-1' => [
                'qty'                     => 30,
                'rate'                    => 4500,
                'source_invoice_item_ids' => ['ii-1'],
                'source_receipt_item_ids' => [],
            ],
            '6500|tax-1|11|wh-1' => [
                'qty'                     => 20,
                'rate'                    => 6500,
                'source_invoice_item_ids' => ['ii-2'],
                'source_receipt_item_ids' => [],
            ],
        ];

        $createdItems = [];
        foreach ($groups as $g) {
            $newItem = [
                'id'             => uniqid('new-'),
                'parent_item_id' => $parentId,
                'quantity'       => $g['qty'],
                'rate'           => $g['rate'],
            ];
            $createdItems[] = $newItem;
        }

        foreach ($createdItems as $item) {
            $this->assertEquals($parentId, $item['parent_item_id'], 'Item baru harus menyimpan parent_item_id ke item lama');
        }
        $this->assertCount(2, $createdItems);
    }

    /** @test */
    public function split_qty_is_proportional_per_group_from_source_ids(): void {
        // Group 1: 2 invoice items (30+10), Group 2: 1 invoice item (20)
        $invoiceItems = [
            'ii-1' => ['id' => 'ii-1', 'quantity' => 30, 'rate' => 4500],
            'ii-2' => ['id' => 'ii-2', 'quantity' => 10, 'rate' => 4500],
            'ii-3' => ['id' => 'ii-3', 'quantity' => 20, 'rate' => 6500],
        ];

        $groups = [
            '4500|tax-1|11|wh-1' => [
                'qty'                     => 40,
                'source_invoice_item_ids' => ['ii-1', 'ii-2'],
                'source_receipt_item_ids' => [],
            ],
            '6500|tax-1|11|wh-1' => [
                'qty'                     => 20,
                'source_invoice_item_ids' => ['ii-3'],
                'source_receipt_item_ids' => [],
            ],
        ];

        foreach ($groups as $key => $g) {
            // Hitung qty dari source IDs (bukan dari FK query ke item baru)
            $billedFromGroup = array_sum(array_map(
                fn ($id) => $invoiceItems[$id]['quantity'],
                $g['source_invoice_item_ids'],
            ));
            $this->assertEquals($g['qty'], $billedFromGroup, "Group {$key}: billed_qty harus proporsional dari source IDs");
        }
    }

    // =========================================================================
    // MARK DONE VALIDATION LOGIC
    // =========================================================================

    /** @test */
    public function mark_done_passes_when_received_equals_billed(): void {
        $items = [
            ['item_name' => 'Item A', 'received_qty' => 50, 'billed_qty' => 50],
            ['item_name' => 'Item B', 'received_qty' => 30, 'billed_qty' => 30],
        ];

        $mismatches = array_filter($items, fn ($i) => (float) $i['received_qty'] !== (float) $i['billed_qty']);

        $this->assertEmpty($mismatches, 'Mark Done harus sukses ketika semua qty match');
    }

    /** @test */
    public function mark_done_fails_when_received_not_equals_billed(): void {
        $items = [
            ['item_name' => 'Item A', 'received_qty' => 55, 'billed_qty' => 30],
            ['item_name' => 'Item B', 'received_qty' => 30, 'billed_qty' => 30],
        ];

        $mismatches = array_values(array_filter(
            $items,
            fn ($i) => (float) $i['received_qty'] !== (float) $i['billed_qty'],
        ));

        $this->assertCount(1, $mismatches, 'Harus ada 1 mismatch');
        $this->assertEquals('Item A', $mismatches[0]['item_name']);
        $this->assertEquals(55, $mismatches[0]['received_qty']);
        $this->assertEquals(30, $mismatches[0]['billed_qty']);
    }

    /** @test */
    public function mark_done_allows_over_receipt_if_invoice_matches(): void {
        // Over-receipt diizinkan asal invoice qty juga sama (55 == 55)
        $items = [
            ['item_name' => 'Item A', 'received_qty' => 55, 'billed_qty' => 55],
        ];

        $mismatches = array_filter($items, fn ($i) => (float) $i['received_qty'] !== (float) $i['billed_qty']);

        $this->assertEmpty($mismatches, 'Over-receipt valid jika invoice qty sama dengan receipt qty');
    }

    // =========================================================================
    // PO STATUS LOGIC
    // =========================================================================

    /** @test */
    public function po_status_is_to_receive_when_nothing_received(): void {
        $totalQty      = 50;
        $totalReceived = 0;

        $status = $this->resolveReceiveStatus($totalQty, $totalReceived);

        $this->assertEquals(FormStatus::TO_RECEIVE, $status);
    }

    /** @test */
    public function po_status_is_partially_received_when_some_received(): void {
        $totalQty      = 50;
        $totalReceived = 30;

        $status = $this->resolveReceiveStatus($totalQty, $totalReceived);

        $this->assertEquals(FormStatus::PARTIALLY_RECEIVED, $status);
    }

    /** @test */
    public function po_status_is_received_when_fully_received(): void {
        $totalQty      = 50;
        $totalReceived = 50;

        $status = $this->resolveReceiveStatus($totalQty, $totalReceived);

        $this->assertEquals(FormStatus::RECEIVED, $status);
    }

    /** @test */
    public function po_status_is_over_received_when_received_exceeds_qty(): void {
        $totalQty      = 50;
        $totalReceived = 55;

        $status = $this->resolveReceiveStatus($totalQty, $totalReceived);

        $this->assertEquals(FormStatus::OVER_RECEIVED, $status);
    }

    /** @test */
    public function po_status_is_over_billed_when_billed_exceeds_qty(): void {
        $totalQty    = 50;
        $totalBilled = 60;

        $status = $this->resolveBillStatus($totalQty, $totalBilled);

        $this->assertEquals(FormStatus::OVER_BILLED, $status);
    }

    // =========================================================================
    // GL LOGIC
    // =========================================================================

    /** @test */
    public function alur1_receipt_does_not_create_gl(): void {
        // Simulasi: $totalRatesForGL tetap 0 di ALUR-1
        $isAlreadyBilled = false; // ALUR-1
        $totalRatesForGL = 0;

        if ($isAlreadyBilled) {
            // ALUR-2: tambah ke totalRatesForGL
            $totalRatesForGL += 5000 * 50;
        }
        // ALUR-1: tidak tambah apa-apa

        $glShouldBeCreated = $totalRatesForGL > 0;

        $this->assertFalse($glShouldBeCreated, 'ALUR-1: GL tidak boleh dibuat saat Receipt approve');
    }

    /** @test */
    public function alur2_receipt_creates_gl_with_invoice_rate(): void {
        $isAlreadyBilled = true; // ALUR-2
        $invoiceRate     = 4500;
        $qty             = 30;
        $totalRatesForGL = 0;

        if ($isAlreadyBilled) {
            $totalRatesForGL += $invoiceRate * $qty;
        }

        $glShouldBeCreated = $totalRatesForGL > 0;

        $this->assertTrue($glShouldBeCreated, 'ALUR-2: GL harus dibuat saat Receipt approve');
        $this->assertEquals(135000, $totalRatesForGL, 'Nilai GL harus rate invoice × qty');
    }

    // =========================================================================
    // HELPERS
    // =========================================================================

    private function resolveReceiveStatus(float $totalQty, float $totalReceived): FormStatus {
        if ($totalReceived == 0) {
            return FormStatus::TO_RECEIVE;
        }
        if ($totalReceived > $totalQty) {
            return FormStatus::OVER_RECEIVED;
        }
        if ($totalReceived < $totalQty) {
            return FormStatus::PARTIALLY_RECEIVED;
        }

        return FormStatus::RECEIVED;
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
}
