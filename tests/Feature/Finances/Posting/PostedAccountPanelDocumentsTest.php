<?php

namespace Tests\Feature\Finances\Posting;

use App\Enums\FormStatus;
use App\Models\Finances\Account;
use App\Models\Finances\PaymentEntry;
use App\Models\Finances\PaymentMethod;
use App\Models\Finances\PaymentSchedule;
use App\Models\Finances\PostingProfile;
use App\Models\Finances\PurchaseInvoice;
use App\Models\Finances\SalesInvoice;
use App\Models\Inventory\DeliveryNote;
use App\Models\Inventory\Item;
use App\Models\Inventory\ItemVariant;
use App\Models\Inventory\StockEntry;
use App\Models\Inventory\Unit;
use App\Models\Inventory\Warehouse;
use App\Models\Purchase\PurchaseReceipt;
use App\Models\Purchase\PurchaseReceiptItem;
use App\Services\Finances\Posting\AccountPanel\PostedAccountPanel;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Exceptions;
use Illuminate\Support\Str;
use Tests\Support\BuildsFinanceFixtures;
use Tests\Support\EnablesEnginePosting;
use Tests\TestCase;

/**
 * Finance Fase 2, Task 12.4 (Requirement 13.4): panel "Akun pencatatan" untuk Payment Entry (pratinjau dan tercatat
 * mengikuti arah `payment_type`) dan Purchase Receipt (tanpa pratinjau; baca kolom tercatat sesudah approve).
 */
class PostedAccountPanelDocumentsTest extends TestCase {
    use BuildsFinanceFixtures, EnablesEnginePosting, RefreshDatabase;

    private Account $cash;
    private Account $receivable;
    private Account $payable;
    private Account $stock;
    private Account $srnb;

    protected function setUp(): void {
        parent::setUp();

        $this->setUpFinanceFixtures([SalesInvoice::class, PurchaseInvoice::class, PaymentSchedule::class, PaymentEntry::class, PaymentMethod::class, PostingProfile::class, PurchaseReceipt::class, DeliveryNote::class, StockEntry::class, Unit::class, Warehouse::class, Item::class, ItemVariant::class]);
        $this->cash       = $this->makeAccount('1100', 'Kas', 'asset', 'debit', 'cash');
        $this->receivable = $this->makeAccount('1200', 'Piutang Usaha', 'asset', 'debit', 'accounts_receivable');
        $this->payable    = $this->makeAccount('2000', 'Utang Usaha', 'liability', 'credit', 'accounts_payable');
        $this->stock      = $this->makeAccount('1300', 'Persediaan', 'asset', 'debit', 'stock');
        $this->srnb       = $this->makeAccount('2100', 'SRNB', 'liability', 'credit', 'stock_received_but_not_billed');
        $this->enableEnginePosting(['receivable' => $this->receivable, 'payable' => $this->payable, 'stock' => $this->stock, 'stock_adjustment' => $this->stock, 'stock_received_but_not_billed' => $this->srnb]);
    }

    /**
     * @param  array{state: string, rows: list<array{role: string, account: array{id: string}}>}  $result
     * @return array<string, string> peran => id akun
     */
    private function accounts(array $result): array {
        return array_column(array_map(fn (array $row): array => [$row['role'], $row['account']['id']], $result['rows']), 1, 0);
    }

    public function test_draft_receive_payment_entry_previews_cash_and_receivable(): void {
        $payment = $this->makePaymentEntry($this->makeUnpaidSalesInvoice(1_000_000), 100, $this->receivable, $this->cash);

        $result = app(PostedAccountPanel::class)->build($payment->fresh());

        $this->assertSame('preview', $result['state']);
        $this->assertSame(['cash_or_bank' => $this->cash->id, 'receivable' => $this->receivable->id], $this->accounts($result));
    }

    public function test_approved_pay_payment_entry_reads_the_recorded_direction(): void {
        $payment = $this->makePaymentEntry($this->makeUnpaidPurchaseInvoice(1_000_000), 100, $this->cash, $this->payable);
        DB::table('payment_entries')->where('id', $payment->id)->update(['status' => json_encode([FormStatus::APPROVED->value])]);

        $result = app(PostedAccountPanel::class)->build($payment->fresh());

        $this->assertSame('recorded', $result['state']);
        $this->assertSame(['cash_or_bank' => $this->cash->id, 'payable' => $this->payable->id], $this->accounts($result));
    }

    public function test_stock_entry_is_flagged_as_estimate_and_reads_header_and_additional_cost_columns(): void {
        $entry = $this->makeStockEntry([FormStatus::DRAFT]);
        $this->addStockEntryLines($entry, 2);

        $result = app(PostedAccountPanel::class)->build($entry->fresh());
        $this->assertSame('preview', $result['state']);
        $this->assertTrue($result['estimated']);
        $this->assertSame($this->stock->id, $this->accounts($result)['stock_adjustment']);
        $this->assertSame(2, array_values(array_filter($result['rows'], fn (array $row): bool => $row['role'] === 'stock_adjustment'))[0]['lines']);

        DB::table('stock_entries')->where('id', $entry->id)->update(['status' => json_encode([FormStatus::APPROVED->value]), 'difference_account_id' => $this->stock->id]);

        $recorded = app(PostedAccountPanel::class)->build($entry->fresh());
        $this->assertSame('recorded', $recorded['state']);
        $this->assertSame(['stock_adjustment' => $this->stock->id], $this->accounts($recorded));
    }

    public function test_purchase_receipt_has_no_preview_before_approve_and_reads_lines_after(): void {
        $inventory = $this->makeInventoryFixture('PR-PANEL');
        $id        = (string) Str::ulid();
        DB::table('purchase_receipts')->insert(['id' => $id, 'code' => 'PR-' . Str::upper(Str::random(8)), 'created_by_id' => $this->user->id, 'date' => now()->subDays(2), 'status' => json_encode([FormStatus::DRAFT->value]), 'created_at' => now(), 'updated_at' => now()]);
        $receipt = PurchaseReceipt::withoutEvents(fn () => PurchaseReceipt::find($id));
        $line    = PurchaseReceiptItem::withoutEvents(fn () => PurchaseReceiptItem::create([
            'purchase_receipt_id' => $receipt->id,
            'item_id'             => $inventory['variant']->id,
            'item_unit_id'        => $inventory['itemUnit']->id,
            'target_warehouse_id' => $inventory['warehouse']->id,
            'conversion_factor'   => 1,
            'quantity'            => 1,
        ]));

        $panel = app(PostedAccountPanel::class);
        $this->assertSame('pending_approval', $panel->build($receipt->fresh())['state']);

        DB::table('purchase_receipts')->where('id', $id)->update(['status' => json_encode([FormStatus::TO_BILL->value])]);
        $this->assertSame('pending_posting', $panel->build($receipt->fresh())['state']);

        DB::table('purchase_receipt_items')->where('id', $line->id)->update(['posted_account_id' => $this->stock->id]);
        $result = $panel->build($receipt->fresh());

        $this->assertSame('recorded', $result['state']);
        $this->assertSame(['stock' => $this->stock->id], $this->accounts($result));
        $this->assertSame(1, $result['rows'][0]['lines']);
    }

    private function addStockEntryLines(StockEntry $entry, int $count): void {
        $inventory = $this->makeInventoryFixture('SE-PANEL');
        for ($i = 0; $i < $count; $i++) {
            DB::table('stock_entry_items')->insert([
                'id'                  => (string) Str::ulid(),
                'stock_entry_id'      => $entry->id,
                'item_id'             => $inventory['variant']->id,
                'source_warehouse_id' => $inventory['warehouse']->id,
                'item_unit_id'        => $inventory['itemUnit']->id,
                'quantity'            => 1,
                'basic_rate'          => 100,
                'created_at'          => now(),
                'updated_at'          => now(),
            ]);
        }
    }

    public function test_stock_entry_without_lines_previews_no_journal_note(): void {
        $entry = $this->makeStockEntry([FormStatus::DRAFT]);

        $this->assertSame('no_journal', app(PostedAccountPanel::class)->build($entry->fresh())['state']);
    }

    public function test_internal_transfer_payment_entry_shows_a_plain_message_without_reporting(): void {
        Exceptions::fake();
        $payment = $this->makePaymentEntry($this->makeUnpaidSalesInvoice(1_000_000), 100, $this->receivable, $this->cash);
        DB::table('payment_entries')->where('id', $payment->id)->update(['payment_type' => 'internal_transfer']);

        $result = app(PostedAccountPanel::class)->build($payment->fresh());

        $this->assertSame('error', $result['state']);
        $this->assertFalse($result['fixable']);
        $this->assertSame(__('finances/postedAccounts.errors.payment_type_unsupported'), $result['message']);
        Exceptions::assertNothingReported();
    }

    public function test_delivery_note_reads_cogs_and_stock_per_line(): void {
        $inventory    = $this->makeInventoryFixture('DN-PANEL');
        $cogs         = $this->makeAccount('5100', 'HPP', 'expense', 'debit', 'cost_of_goods_sold');
        $permissionId = (string) Str::ulid();
        DB::table('permissions')->insert(['id' => $permissionId, 'module' => 'inventory', 'name' => 'dn_panel_' . Str::random(6), 'model' => DeliveryNote::class, 'created_at' => now(), 'updated_at' => now()]);
        $id = (string) Str::ulid();
        DB::table('delivery_notes')->insert([
            'id'                 => $id,
            'code'               => 'DN-' . Str::upper(Str::random(8)),
            'created_by_id'      => $this->user->id,
            'delivery_date'      => now()->subDay(),
            'reference_to_id'    => $permissionId,
            'referenceable_type' => 'App\Models\Sales\SalesOrder',
            'referenceable_id'   => (string) Str::ulid(),
            'status'             => json_encode([FormStatus::TO_BILL->value]),
            'created_at'         => now(),
            'updated_at'         => now(),
        ]);
        foreach ([1, 2] as $_) {
            DB::table('delivery_note_items')->insert([
                'id'                      => (string) Str::ulid(),
                'referenceable_type'      => 'App\Models\Sales\SalesOrderItem',
                'referenceable_id'        => (string) Str::ulid(),
                'delivery_note_id'        => $id,
                'item_id'                 => $inventory['variant']->id,
                'quantity'                => 1,
                'valuation_rates'         => json_encode([]),
                'posted_account_id'       => $cogs->id,
                'posted_stock_account_id' => $this->stock->id,
                'created_at'              => now(),
                'updated_at'              => now(),
            ]);
        }

        $result = app(PostedAccountPanel::class)->build(DeliveryNote::withoutEvents(fn () => DeliveryNote::findOrFail($id)));

        $this->assertSame('recorded', $result['state']);
        $this->assertSame(['cost_of_goods_sold' => $cogs->id, 'stock' => $this->stock->id], $this->accounts($result));
        $this->assertSame([2, 2], array_column($result['rows'], 'lines'));
    }
}
