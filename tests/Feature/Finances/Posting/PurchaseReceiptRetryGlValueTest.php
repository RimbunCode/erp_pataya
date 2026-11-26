<?php

namespace Tests\Feature\Finances\Posting;

use App\Enums\FormStatus;
use App\Events\Asset\FixedAssetItemApproved;
use App\Events\Purchase\Order\PurchaseOrderReceiveStatusRecalculationRequested;
use App\Events\Purchase\Request\PurchaseRequestReceiveStatusRecalculationRequested;
use App\Models\Core\GlPostingStatus;
use App\Models\Core\ModelConnection;
use App\Models\Finances\Account;
use App\Models\Finances\PostingProfile;
use App\Models\Finances\PurchaseInvoice;
use App\Models\Finances\PurchaseInvoiceItem;
use App\Models\Inventory\ItemUnit;
use App\Models\Inventory\ItemVariant;
use App\Models\Inventory\Stock;
use App\Models\Inventory\StockLedgerEntry;
use App\Models\Inventory\Unit;
use App\Models\Inventory\Warehouse;
use App\Models\Model as BaseModel;
use App\Models\Purchase\PurchaseOrder;
use App\Models\Purchase\PurchaseOrderItem;
use App\Models\Purchase\PurchaseReceipt;
use App\Models\Purchase\PurchaseReceiptItem;
use App\Services\Purchase\PurchaseReceiptService;
use Database\Factories\Inventory\ItemFactory;
use Database\Factories\Inventory\ItemVariantFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Testing\TestResponse;
use Tests\Support\BuildsFinanceFixtures;
use Tests\Support\EnablesEnginePosting;
use Tests\TestCase;

/**
 * Finance Fase 2, Task 12.1 bagian B: nilai GL per baris Purchase Receipt disimpan saat approve (`gl_value`) dan dipakai
 * retry posting, sehingga retry menghasilkan total dan jurnal yang identik dengan posting asli (retur di luar PO dan
 * ALUR-2 dengan rate invoice yang berbeda dari rate PO).
 */
class PurchaseReceiptRetryGlValueTest extends TestCase {
    use BuildsFinanceFixtures, EnablesEnginePosting, RefreshDatabase;

    private Account $stock;
    private Account $srnb;
    private Warehouse $warehouse;
    private PurchaseOrder $po;

    protected function setUp(): void {
        parent::setUp();

        $this->setUpFinanceFixtures([PostingProfile::class, PurchaseOrder::class, PurchaseReceipt::class, PurchaseInvoice::class, StockLedgerEntry::class]);
        Event::fake([
            PurchaseOrderReceiveStatusRecalculationRequested::class,
            PurchaseRequestReceiveStatusRecalculationRequested::class,
            FixedAssetItemApproved::class,
        ]);

        $this->stock = $this->makeAccount('1300', 'Persediaan', 'asset', 'debit', 'stock');
        $this->srnb  = $this->makeAccount('2100', 'SRNB', 'liability', 'credit', 'stock_received_but_not_billed');
        $this->enableEnginePosting(['stock' => $this->stock, 'stock_received_but_not_billed' => $this->srnb]);

        $this->warehouse = Warehouse::create(['branch_id' => $this->branch->id, 'name' => 'Gudang PR', 'code' => 'WH-PR']);
        $this->po        = BaseModel::withoutEvents(fn () => PurchaseOrder::create([
            'code'          => 'PO-RT-1',
            'date'          => now(),
            'created_by_id' => $this->user->id,
            'status'        => [FormStatus::SUBMITTED],
        ]));
    }

    /** @return array{0: ItemVariant, 1: ItemUnit} */
    private function makeVariant(): array {
        $item     = ItemFactory::new()->create(['is_fixed_asset' => false]);
        $variant  = ItemVariantFactory::new()->create(['item_id' => $item->id]);
        $unit     = Unit::create(['code' => 'PCS-' . fake()->unique()->numerify('####'), 'name' => 'Pieces', 'conversion_factor' => 1, 'is_default' => true]);
        $itemUnit = ItemUnit::create(['item_id' => $item->id, 'unit_id' => $unit->id, 'conversion_factor' => 1, 'is_default' => true]);
        $variant->update(['default_unit_id' => $unit->id]);

        return [$variant, $itemUnit];
    }

    private function makeReceipt(?PurchaseReceipt $returnAgainst = null): PurchaseReceipt {
        return BaseModel::withoutEvents(fn () => PurchaseReceipt::create([
            'code'              => 'PR-' . fake()->unique()->randomNumber(8),
            'date'              => now(),
            'purchase_order_id' => $this->po->id,
            'return_against_id' => $returnAgainst?->id,
            'created_by_id'     => $this->user->id,
        ]));
    }

    private function makeRow(PurchaseReceipt $receipt, ItemVariant $variant, ItemUnit $unit, float $quantity, ?PurchaseOrderItem $poItem = null, ?PurchaseReceiptItem $returnAgainstItem = null): PurchaseReceiptItem {
        return PurchaseReceiptItem::create([
            'purchase_receipt_id'    => $receipt->id,
            'purchase_order_item_id' => $poItem?->id,
            'return_against_item_id' => $returnAgainstItem?->id,
            'item_id'                => $variant->id,
            'item_unit_id'           => $unit->id,
            'quantity'               => $quantity,
            'target_warehouse_id'    => $this->warehouse->id,
        ]);
    }

    private function makePoItem(ItemVariant $variant, ItemUnit $unit, float $quantity, float $rate): PurchaseOrderItem {
        return PurchaseOrderItem::create([
            'purchase_order_id'   => $this->po->id,
            'item_id'             => $variant->id,
            'quantity'            => $quantity,
            'rate'                => $rate,
            'target_warehouse_id' => $this->warehouse->id,
            'item_unit_id'        => $unit->id,
        ]);
    }

    /**
     * Retur off-PO: stok awal 10 dengan satu entri antrean ber-rate 50 milik baris receipt asal, lalu retur 4 unit
     * (nilai 200) di-approve lewat service.
     *
     * @return array{0: PurchaseReceipt, 1: PurchaseReceiptItem}
     */
    private function approveOffPoReturn(): array {
        [$variant, $unit] = $this->makeVariant();
        $original         = $this->makeReceipt();
        $originalRow      = $this->makeRow($original, $variant, $unit, 10);
        Stock::create([
            'item_variant_id'   => $variant->id,
            'warehouse_id'      => $this->warehouse->id,
            'conversion_factor' => 1,
            'item_unit_id'      => $unit->id,
            'quantity'          => 10,
            'stock_queue'       => [['rate' => 50, 'quantity' => 10, 'is_valuated' => true, 'sle_id' => null, 'receipt_item_id' => $originalRow->id]],
        ]);

        $return    = $this->makeReceipt($original);
        $returnRow = $this->makeRow($return, $variant, $unit, 4, null, $originalRow);
        (new PurchaseReceiptService)->onApproved($return);

        return [$return, $returnRow];
    }

    /**
     * Invoice yang sudah di-approve lebih dulu (ALUR-2) dengan satu baris ber-rate invoice.
     */
    private function seedApprovedInvoice(PurchaseOrderItem $poItem, float $quantity, float $rate): void {
        $credit  = $this->makeAccount('2000', 'Utang Usaha', 'liability', 'credit');
        $expense = $this->makeAccount('5000', 'Biaya', 'expense', 'debit');

        $invoice = BaseModel::withoutEvents(fn () => PurchaseInvoice::create([
            'code'                    => 'PI-' . fake()->unique()->randomNumber(8),
            'date'                    => now(),
            'purchase_order_id'       => $this->po->id,
            'credit_account_id'       => $credit->id,
            'expanse_head_account_id' => $expense->id,
            'created_by_id'           => $this->user->id,
        ]));
        $invoice->forceFill(['submitted_at' => now()])->save();
        ModelConnection::create([
            'model_type'     => PurchaseOrder::class,
            'model_id'       => $this->po->id,
            'reference_type' => PurchaseInvoice::class,
            'reference_id'   => $invoice->id,
        ]);
        $poItem->update(['billed_quantity' => $poItem->billed_quantity + $quantity]);
        PurchaseInvoiceItem::create([
            'purchase_invoice_id'    => $invoice->id,
            'purchase_order_item_id' => $poItem->id,
            'item_id'                => $poItem->item_id,
            'quantity'               => $quantity,
            'rate'                   => $rate,
        ]);
    }

    /** Meniru kegagalan posting: jurnal dan catatan akun dihapus, status dikembalikan ke failed. */
    private function simulateFailedPosting(PurchaseReceipt $receipt): GlPostingStatus {
        DB::table('general_ledgers')->where('referenceable_id', $receipt->id)->delete();
        DB::table('journals')->delete();
        PurchaseReceiptItem::query()->where('purchase_receipt_id', $receipt->id)->update(['posted_account_id' => null]);
        $status = GlPostingStatus::where('referenceable_type', PurchaseReceipt::class)->where('referenceable_id', $receipt->id)->sole();
        $status->update(['status' => FormStatus::FAILED, 'posted_at' => null, 'retry_count' => 1, 'last_error' => 'gagal']);

        return $status;
    }

    private function retry(GlPostingStatus $status): TestResponse {
        return $this
            ->withSession([
                'permissions' => [
                    GlPostingStatus::class => [0 => [[
                        'model'        => GlPostingStatus::class,
                        'level'        => 0,
                        'only_creator' => false,
                        'permissions'  => ['select' => true, 'read' => true, 'write' => true],
                    ]]],
                ],
                'permissions_version' => '0|0|0|0',
                'currentBranch'       => null,
            ])
            ->withCookie('lang', 'en')
            ->actingAs($this->user)
            ->post(route('gl-posting-statuses.retry', $status));
    }

    public function test_off_po_return_retry_posts_the_same_total_and_journal_as_the_approval(): void {
        [$return, $returnRow] = $this->approveOffPoReturn();

        $this->assertEqualsWithDelta(200.0, $returnRow->fresh()->gl_value, 0.0001);
        $expected = [
            ['account' => $this->srnb, 'against' => $this->stock, 'debit' => 200, 'credit' => 0],
            ['account' => $this->stock, 'against' => $this->srnb, 'debit' => 0, 'credit' => 200],
        ];
        $this->assertLedger($return, $expected);
        $this->assertPostingStatus($return, 'posted');

        $status = $this->simulateFailedPosting($return);
        $this->retry($status)->assertRedirect();

        $this->assertLedger($return, $expected);
        $this->assertPostingStatus($return, 'posted');
        $this->assertSame($this->stock->id, $returnRow->fresh()->posted_account_id);
    }

    public function test_already_billed_receipt_retry_uses_the_invoice_rate_not_the_po_rate(): void {
        [$variant, $unit] = $this->makeVariant();
        $poItem           = $this->makePoItem($variant, $unit, 10, 1000);
        $this->seedApprovedInvoice($poItem, 10, 1500);
        $receipt = $this->makeReceipt();
        $row     = $this->makeRow($receipt, $variant, $unit, 10, $poItem);

        (new PurchaseReceiptService)->onApproved($receipt);

        $this->assertEqualsWithDelta(15000.0, $row->fresh()->gl_value, 0.0001);
        $expected = [
            ['account' => $this->stock, 'against' => $this->srnb, 'debit' => 15000, 'credit' => 0],
            ['account' => $this->srnb, 'against' => $this->stock, 'debit' => 0, 'credit' => 15000],
        ];
        $this->assertLedger($receipt, $expected);

        $status = $this->simulateFailedPosting($receipt);
        $this->retry($status)->assertRedirect();

        $this->assertLedger($receipt, $expected);
        $this->assertPostingStatus($receipt, 'posted');
        $this->assertSame($this->stock->id, $row->fresh()->posted_account_id);
    }

    public function test_document_posted_before_the_fix_falls_back_to_the_po_rate_calculation(): void {
        [$variant, $unit] = $this->makeVariant();
        $poItem           = $this->makePoItem($variant, $unit, 10, 1000);
        $this->seedApprovedInvoice($poItem, 10, 1500);
        $receipt = $this->makeReceipt();
        $row     = $this->makeRow($receipt, $variant, $unit, 10, $poItem);
        (new PurchaseReceiptService)->onApproved($receipt);

        $status = $this->simulateFailedPosting($receipt);
        // Dokumen lama: nilai per baris belum pernah dicatat.
        PurchaseReceiptItem::query()->whereKey($row->id)->update(['gl_value' => null]);
        $this->retry($status)->assertRedirect();

        $this->assertLedger($receipt, [
            ['account' => $this->stock, 'against' => $this->srnb, 'debit' => 10000, 'credit' => 0],
            ['account' => $this->srnb, 'against' => $this->stock, 'debit' => 0, 'credit' => 10000],
        ]);
        $this->assertPostingStatus($receipt, 'posted');
    }

    public function test_retry_of_a_return_with_zero_total_is_not_refused(): void {
        // Sama seperti approve, yang juga mem-posting retur bernilai 0 (kondisi `$returnAgainst || total > 0`).
        [$return, $returnRow] = $this->approveOffPoReturn();
        $status               = $this->simulateFailedPosting($return);
        PurchaseReceiptItem::query()->whereKey($returnRow->id)->update(['gl_value' => null]);

        $this->retry($status)->assertSessionHasNoErrors();
    }

    public function test_retry_with_zero_total_is_refused_and_the_status_stays_failed(): void {
        [$return, $returnRow] = $this->approveOffPoReturn();
        $status               = $this->simulateFailedPosting($return);
        // Dokumen lama off-PO non-retur tanpa nilai tersimpan: perhitungan lama menghasilkan 0.
        PurchaseReceiptItem::query()->whereKey($returnRow->id)->update(['gl_value' => null]);
        $return->newQuery()->whereKey($return->id)->update(['return_against_id' => null]);

        $this->retry($status)->assertSessionHasErrors('retry');

        $this->assertSame(0, $this->ledgerOf($return)->count());
        $this->assertSame('failed', $status->fresh()->status->value);
        $this->assertSame(1, $status->fresh()->retry_count);
    }

    public function test_amend_clears_the_stored_gl_value_of_the_new_draft_lines(): void {
        [$return, $returnRow] = $this->approveOffPoReturn();
        $return->update(['code' => 'PR-AMD-RT']);

        $amended = $return->fresh()->amend();

        $this->assertNotSame($return->id, $amended->id);
        $this->assertEqualsWithDelta(200.0, $returnRow->fresh()->gl_value, 0.0001, 'Dokumen asal tidak berubah.');
        $newLines = PurchaseReceiptItem::query()->where('purchase_receipt_id', $amended->id)->get();
        $this->assertCount(1, $newLines);
        $this->assertNull($newLines->first()->gl_value);
    }

    public function test_gl_value_from_a_client_is_discarded_by_fill_item_relations(): void {
        [$variant, $unit] = $this->makeVariant();

        $method = new \ReflectionMethod(PurchaseReceiptService::class, 'fillItemRelations');
        $result = $method->invoke(new PurchaseReceiptService, [
            'item'             => ['id' => $variant->id],
            'unit'             => ['id' => $unit->id],
            'target_warehouse' => ['id' => $this->warehouse->id],
            'gl_value'         => 999999,
        ], [$unit->id => $unit]);

        $this->assertNull($result['gl_value']);
    }
}
