<?php

namespace Tests\Feature\Finances\Posting;

use App\Enums\FormStatus;
use App\Enums\PostingDocumentType;
use App\Events\Finances\PurchaseInvoiceGeneralLedgerPostingRequested;
use App\Events\Finances\SalesInvoiceGeneralLedgerPostingRequested;
use App\Listeners\Finances\Ledger\PostPurchaseInvoiceGeneralLedger;
use App\Listeners\Finances\Ledger\PostSalesInvoiceGeneralLedger;
use App\Models\Core\GlPostingStatus;
use App\Models\Finances\Account;
use App\Models\Finances\FinanceSetting;
use App\Models\Finances\Journal;
use App\Models\Finances\PostingProfile;
use App\Models\Finances\PurchaseInvoice;
use App\Models\Finances\PurchaseInvoiceItem;
use App\Models\Finances\SalesInvoice;
use App\Models\Finances\SalesInvoiceItem;
use App\Models\Inventory\Item;
use App\Models\Inventory\ItemVariant;
use App\Models\Inventory\Unit;
use App\Models\Inventory\Warehouse;
use App\Models\Model as BaseModel;
use App\Models\Purchase\PurchaseOrder;
use App\Services\Core\Setting\SettingsService;
use App\Services\Finances\Accounting\PurchaseInvoicePostedAccountRecorder;
use App\Services\Finances\Ledger\FiscalPeriodService;
use App\Services\Finances\Posting\Contexts\PostingContext;
use App\Services\Finances\Posting\PostedAccountNotes;
use App\Services\Finances\Posting\PostedAccountRecorder;
use App\Services\Finances\Posting\PostingProfileService;
use App\Services\Finances\PurchaseInvoiceService;
use App\Services\Finances\SalesInvoiceService;
use App\Services\Sales\Accounting\SalesInvoicePostedAccountRecorder;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\DataProvider;
use ReflectionMethod;
use RuntimeException;
use Tests\Support\AssertsPostingParity;
use Tests\Support\BuildsFinanceFixtures;
use Tests\TestCase;

/**
 * Finance Fase 2, Task 12.1 (Requirement 13.2, Q-P2-24): engine menulis balik akun yang dipakai ke Sales Invoice dan
 * Purchase Invoice di transaksi yang sama dengan jurnal. Header diisi dari peran tingkat dokumen; kolom header untuk
 * peran per baris (`income_account_id`, `expanse_head_account_id`) hanya bila semua baris satu akun (keputusan pemilik
 * produk 25 Nov 2026); `posted_account_id` per baris diisi dari akun peran baris itu. Penulisan senyap.
 */
class InvoicePostedAccountWritebackTest extends TestCase {
    use AssertsPostingParity, BuildsFinanceFixtures, RefreshDatabase;

    private Account $receivable;
    private Account $revenue;
    private Account $revenueNonStock;
    private Account $payable;
    private Account $expense;
    private Account $expenseNonStock;
    private Account $srnb;
    private Account $discountSales;
    private Account $discountPurchase;
    private PurchaseOrder $purchaseOrder;

    protected function setUp(): void {
        parent::setUp();

        $this->setUpFinanceFixtures([PostingProfile::class, SalesInvoice::class, PurchaseInvoice::class, PurchaseOrder::class, Unit::class, Warehouse::class, Item::class, ItemVariant::class]);

        $this->receivable       = $this->makeAccount('1200', 'Piutang Usaha', 'asset', 'debit', 'accounts_receivable');
        $this->revenue          = $this->makeAccount('4000', 'Penjualan Barang', 'income', 'credit', 'sales');
        $this->revenueNonStock  = $this->makeAccount('4010', 'Penjualan Jasa', 'income', 'credit');
        $this->payable          = $this->makeAccount('2000', 'Utang Usaha', 'liability', 'credit', 'accounts_payable');
        $this->expense          = $this->makeAccount('5000', 'Beban Pembelian', 'expense', 'debit');
        $this->expenseNonStock  = $this->makeAccount('5010', 'Beban Jasa', 'expense', 'debit');
        $this->srnb             = $this->makeAccount('2100', 'SRNB', 'liability', 'credit', 'stock_received_but_not_billed');
        $this->discountSales    = $this->makeAccount('4900', 'Potongan Penjualan', 'income', 'debit');
        $this->discountPurchase = $this->makeAccount('5900', 'Potongan Pembelian', 'expense', 'credit');

        $profiles = app(PostingProfileService::class);
        $profiles->activate($profiles->createDraft('Profil write-back', '2020-01-01', null, [
            'receivable'                    => $this->receivable->id,
            'revenue'                       => $this->revenue->id,
            'payable'                       => $this->payable->id,
            'expense'                       => $this->expense->id,
            'stock_received_but_not_billed' => $this->srnb->id,
            'discount'                      => $this->discountSales->id,
        ], [
            ['role' => 'revenue', 'account_id' => $this->revenueNonStock->id, 'is_stock_item' => false],
            ['role' => 'expense', 'account_id' => $this->expenseNonStock->id, 'is_stock_item' => false],
            ['role' => 'discount', 'account_id' => $this->discountPurchase->id, 'document_type' => 'purchase_invoice'],
        ]));

        $this->purchaseOrder = BaseModel::withoutEvents(fn () => PurchaseOrder::create([
            'code'          => 'PO-WB-1',
            'date'          => now(),
            'status'        => [FormStatus::SUBMITTED],
            'created_by_id' => $this->user->id,
        ]));
    }

    private function setCutover(PostingDocumentType $type): void {
        $today = CarbonImmutable::parse(app(FiscalPeriodService::class)->businessDay(now()))->toDateString();
        app(SettingsService::class)->update(FinanceSetting::class, [FinanceSetting::DISCOUNT_SPLIT_COLUMNS[$type->value] => $today]);
    }

    /**
     * Faktur penjualan tanpa akun dokumen (seperti hasil form setelah Q-P2-23) dengan satu baris per entri `$stockFlags`.
     *
     * @param  list<bool>  $stockFlags  `is_stock_item` varian tiap baris
     */
    private function draftSalesInvoice(array $stockFlags = [true], float $discount = 0): SalesInvoice {
        $invoice = $this->makeSalesInvoice($this->receivable, $this->revenue, ['debit_account_id' => null, 'income_account_id' => null], [
            'item_id'         => ItemVariant::factory()->create(['is_stock_item' => $stockFlags[0]])->id,
            'discount_amount' => $discount,
        ]);
        foreach (\array_slice($stockFlags, 1) as $stockFlag) {
            SalesInvoiceItem::factory()->create([
                'sales_invoice_id' => $invoice->id,
                'item_id'          => ItemVariant::factory()->create(['is_stock_item' => $stockFlag])->id,
                'quantity'         => 2,
                'price'            => 1000,
                'tax_rate'         => 10,
                'discount_amount'  => $discount,
            ]);
        }
        GlPostingStatus::create(['referenceable_type' => SalesInvoice::class, 'referenceable_id' => $invoice->id, 'status' => FormStatus::PENDING]);

        return $invoice->fresh();
    }

    /**
     * @param  list<bool>  $stockFlags
     */
    private function draftPurchaseInvoice(array $stockFlags = [true], float $discount = 0): PurchaseInvoice {
        $invoice = PurchaseInvoice::create([
            'date'              => now()->subDays(3),
            'purchase_order_id' => $this->purchaseOrder->id,
            'branch_id'         => $this->branch->id,
            'status'            => [FormStatus::SUBMITTED],
        ]);
        foreach ($stockFlags as $stockFlag) {
            PurchaseInvoiceItem::create([
                'purchase_invoice_id' => $invoice->id,
                'item_id'             => ItemVariant::factory()->create(['is_stock_item' => $stockFlag])->id,
                'quantity'            => 2,
                'rate'                => 1000,
                'tax_rate'            => 10,
                'discount_amount'     => $discount,
            ]);
        }
        GlPostingStatus::create(['referenceable_type' => PurchaseInvoice::class, 'referenceable_id' => $invoice->id, 'status' => FormStatus::PENDING]);

        return $invoice->fresh();
    }

    /**
     * @return list<?string> `posted_account_id` per baris
     */
    private function itemAccounts(string $table, string $foreignKey, string $invoiceId): array {
        return DB::table($table)->where($foreignKey, $invoiceId)->orderBy('id')->pluck('posted_account_id')->all();
    }

    private function runSalesListener(SalesInvoice $invoice, float $total, bool $isReturn = false): void {
        (new PostSalesInvoiceGeneralLedger)->handle(new SalesInvoiceGeneralLedgerPostingRequested($invoice, $total, $isReturn, now(), null, null));
    }

    private function runPurchaseListener(PurchaseInvoice $invoice, float $total, bool $isReturn = false): void {
        (new PostPurchaseInvoiceGeneralLedger)->handle(new PurchaseInvoiceGeneralLedgerPostingRequested($invoice, 0.0, $total, $isReturn, now(), null, null));
    }

    private function failingRecorder(PostingDocumentType $type): PostedAccountRecorder {
        return new class($type) implements PostedAccountRecorder
        {
            public function __construct(private PostingDocumentType $type) {}

            public function documentType(): PostingDocumentType {
                return $this->type;
            }

            public function record(PostingContext $ctx, PostedAccountNotes $notes): void {
                throw new RuntimeException('recorder gagal');
            }
        };
    }

    public function test_sales_invoice_approve_writes_header_and_line_accounts(): void {
        $invoice = $this->draftSalesInvoice();
        $this->assertNull($invoice->debit_account_id);
        $this->assertNull($invoice->income_account_id);

        app(SalesInvoiceService::class)->onApproved($invoice);

        $fresh = $invoice->fresh();
        $this->assertSame($this->receivable->id, $fresh->debit_account_id);
        $this->assertSame($this->revenue->id, $fresh->income_account_id);
        $this->assertSame([$this->revenue->id], $this->itemAccounts('sales_invoice_items', 'sales_invoice_id', $invoice->id));
    }

    public function test_sales_invoice_return_writes_the_same_accounts(): void {
        $invoice = $this->draftSalesInvoice();

        $this->runSalesListener($invoice, 2183.33, isReturn: true);

        $fresh = $invoice->fresh();
        $this->assertSame($this->receivable->id, $fresh->debit_account_id);
        $this->assertSame($this->revenue->id, $fresh->income_account_id);
        $this->assertSame([$this->revenue->id], $this->itemAccounts('sales_invoice_items', 'sales_invoice_id', $invoice->id));
    }

    public function test_sales_invoice_with_mixed_line_accounts_leaves_income_account_null_and_fills_each_line(): void {
        $invoice = $this->draftSalesInvoice([true, false]);

        app(SalesInvoiceService::class)->onApproved($invoice);

        $fresh = $invoice->fresh();
        $this->assertSame($this->receivable->id, $fresh->debit_account_id);
        $this->assertNull($fresh->income_account_id, 'Akun pendapatan beragam: kolom header null.');
        $this->assertEqualsCanonicalizing(
            [$this->revenue->id, $this->revenueNonStock->id],
            $this->itemAccounts('sales_invoice_items', 'sales_invoice_id', $invoice->id),
        );
    }

    public function test_sales_invoice_discount_split_writes_the_revenue_account_not_the_discount_account(): void {
        $this->setCutover(PostingDocumentType::SalesInvoice);
        $invoice = $this->draftSalesInvoice([true], 200);

        app(SalesInvoiceService::class)->onApproved($invoice);

        $fresh = $invoice->fresh();
        $this->assertSame($this->receivable->id, $fresh->debit_account_id);
        $this->assertSame($this->revenue->id, $fresh->income_account_id);
        $this->assertSame([$this->revenue->id], $this->itemAccounts('sales_invoice_items', 'sales_invoice_id', $invoice->id));
        $this->assertSame(1, Journal::query()->where('source_id', $invoice->id)->count());
    }

    public function test_sales_invoice_write_back_is_silent_and_scoped_to_the_posted_document(): void {
        $invoice = $this->draftSalesInvoice();
        $other   = $this->draftSalesInvoice();
        $before  = DB::table('sales_invoices')->where('id', $invoice->id)->value('updated_at');

        $this->runSalesListener($invoice, 2183.33);

        $this->assertSame($before, DB::table('sales_invoices')->where('id', $invoice->id)->value('updated_at'), 'Write-back senyap: updated_at tidak berubah.');
        $this->assertNull($other->fresh()->debit_account_id);
        $this->assertSame([null], $this->itemAccounts('sales_invoice_items', 'sales_invoice_id', $other->id));
    }

    public function test_sales_invoice_retry_after_posting_does_not_overwrite_the_recorded_accounts(): void {
        $invoice = $this->draftSalesInvoice();
        $this->runSalesListener($invoice, 2183.33);

        DB::table('sales_invoices')->where('id', $invoice->id)->update(['debit_account_id' => $this->payable->id]);

        $this->runSalesListener($invoice->fresh(), 2183.33);

        $this->assertSame($this->payable->id, $invoice->fresh()->debit_account_id, 'already_posted tidak memanggil recorder.');
        $this->assertSame(1, Journal::query()->where('source_id', $invoice->id)->count());
    }

    public function test_sales_invoice_journal_and_write_back_are_atomic(): void {
        $invoice  = $this->draftSalesInvoice();
        $recorder = $this->failingRecorder(PostingDocumentType::SalesInvoice);
        app()->bind(SalesInvoicePostedAccountRecorder::class, fn () => $recorder);

        try {
            $this->runSalesListener($invoice, 2183.33);
            $this->fail('Kegagalan recorder harus merambat.');
        } catch (RuntimeException $e) {
            $this->assertSame('recorder gagal', $e->getMessage());
        }

        $this->assertSame(0, Journal::query()->where('source_id', $invoice->id)->count(), 'Jurnal tergulung bersama write-back.');
        $this->assertNull($invoice->fresh()->debit_account_id);
    }

    public function test_purchase_invoice_approve_writes_header_and_line_accounts(): void {
        $invoice = $this->draftPurchaseInvoice();
        $this->assertNull($invoice->credit_account_id);
        $this->assertNull($invoice->expanse_head_account_id);

        app(PurchaseInvoiceService::class)->onApproved($invoice);

        $fresh = $invoice->fresh();
        $this->assertSame($this->payable->id, $fresh->credit_account_id);
        $this->assertSame($this->expense->id, $fresh->expanse_head_account_id);
        $this->assertSame([$this->expense->id], $this->itemAccounts('purchase_invoice_items', 'purchase_invoice_id', $invoice->id));
    }

    public function test_purchase_invoice_return_writes_the_same_accounts(): void {
        $invoice = $this->draftPurchaseInvoice();

        $this->runPurchaseListener($invoice, 2183.33, isReturn: true);

        $fresh = $invoice->fresh();
        $this->assertSame($this->payable->id, $fresh->credit_account_id);
        $this->assertSame($this->expense->id, $fresh->expanse_head_account_id);
        $this->assertSame([$this->expense->id], $this->itemAccounts('purchase_invoice_items', 'purchase_invoice_id', $invoice->id));
    }

    public function test_purchase_invoice_with_mixed_line_accounts_leaves_expense_head_account_null(): void {
        $invoice = $this->draftPurchaseInvoice([true, false]);

        app(PurchaseInvoiceService::class)->onApproved($invoice);

        $fresh = $invoice->fresh();
        $this->assertSame($this->payable->id, $fresh->credit_account_id);
        $this->assertNull($fresh->expanse_head_account_id, 'Akun beban beragam: kolom header null.');
        $this->assertEqualsCanonicalizing(
            [$this->expense->id, $this->expenseNonStock->id],
            $this->itemAccounts('purchase_invoice_items', 'purchase_invoice_id', $invoice->id),
        );
    }

    public function test_purchase_invoice_discount_split_writes_the_expense_account_not_the_discount_account(): void {
        $this->setCutover(PostingDocumentType::PurchaseInvoice);
        $invoice = $this->draftPurchaseInvoice([false], 200);

        app(PurchaseInvoiceService::class)->onApproved($invoice);

        $fresh = $invoice->fresh();
        $this->assertSame($this->payable->id, $fresh->credit_account_id);
        $this->assertSame($this->expenseNonStock->id, $fresh->expanse_head_account_id);
        $this->assertSame([$this->expenseNonStock->id], $this->itemAccounts('purchase_invoice_items', 'purchase_invoice_id', $invoice->id));
    }

    public function test_purchase_invoice_retry_after_posting_does_not_overwrite_the_recorded_accounts(): void {
        $invoice = $this->draftPurchaseInvoice();
        $this->runPurchaseListener($invoice, 2183.33);

        DB::table('purchase_invoices')->where('id', $invoice->id)->update(['credit_account_id' => $this->receivable->id]);

        $this->runPurchaseListener($invoice->fresh(), 2183.33);

        $this->assertSame($this->receivable->id, $invoice->fresh()->credit_account_id);
    }

    public function test_purchase_invoice_journal_and_write_back_are_atomic(): void {
        $invoice  = $this->draftPurchaseInvoice();
        $recorder = $this->failingRecorder(PostingDocumentType::PurchaseInvoice);
        app()->bind(PurchaseInvoicePostedAccountRecorder::class, fn () => $recorder);

        try {
            $this->runPurchaseListener($invoice, 2183.33);
            $this->fail('Kegagalan recorder harus merambat.');
        } catch (RuntimeException $e) {
            $this->assertSame('recorder gagal', $e->getMessage());
        }

        $this->assertSame(0, Journal::query()->where('source_id', $invoice->id)->count());
        $this->assertNull($invoice->fresh()->credit_account_id);
    }

    public function test_draft_item_fill_clears_posted_account_and_ignores_request_value(): void {
        $payload = ['id' => 'x', 'posted_account_id' => $this->revenue->id, 'unit' => ['id' => null], 'tax' => ['id' => null], 'item' => ['id' => null], 'quantity' => 1, 'price' => 1, 'rate' => 1];

        $out = (new ReflectionMethod(SalesInvoiceService::class, 'fillItemRelations'))->invoke(app(SalesInvoiceService::class), $payload, $this->draftSalesInvoice());
        $this->assertArrayHasKey('posted_account_id', $out);
        $this->assertNull($out['posted_account_id'], 'Update draft menol-kan akun baris, nilai dari request diabaikan (Q-P2-24).');

        $out = (new ReflectionMethod(PurchaseInvoiceService::class, 'fillItemRelations'))->invoke(app(PurchaseInvoiceService::class), $payload, $this->draftPurchaseInvoice());
        $this->assertArrayHasKey('posted_account_id', $out);
        $this->assertNull($out['posted_account_id']);
    }

    public function test_posted_account_relation_loads_on_both_invoice_item_models(): void {
        $salesItem = new SalesInvoiceItem(['posted_account_id' => $this->revenue->id]);
        $this->assertInstanceOf(BelongsTo::class, $salesItem->postedAccount());
        $this->assertSame($this->revenue->id, $salesItem->postedAccount()->getResults()?->id);

        $purchaseItem = new PurchaseInvoiceItem(['posted_account_id' => $this->revenue->id]);
        $this->assertInstanceOf(BelongsTo::class, $purchaseItem->postedAccount());
        $this->assertSame($this->revenue->id, $purchaseItem->postedAccount()->getResults()?->id);
    }

    public function test_updating_a_recorded_item_through_fill_resets_its_posted_account(): void {
        $invoice = $this->draftSalesInvoice();
        $this->runSalesListener($invoice, 2183.33);
        $item = $invoice->items()->first();
        $this->assertSame($this->revenue->id, $item->fresh()->posted_account_id);

        $payload = ['id' => $item->id, 'unit' => ['id' => null], 'tax' => ['id' => null], 'item' => ['id' => $item->item_id], 'quantity' => 3, 'price' => 1000];
        $filled  = (new ReflectionMethod(SalesInvoiceService::class, 'fillItemRelations'))->invoke(app(SalesInvoiceService::class), $payload, $invoice);
        $item->fill($filled);
        $item->save();

        $this->assertNull($item->fresh()->posted_account_id);
    }

    /**
     * @return array<string, array{0: list<bool>}> `is_stock_item` varian tiap baris
     */
    public static function lineStockCombinations(): array {
        return [
            'satu baris stok'               => [[true]],
            'satu baris non-stok'           => [[false]],
            'stok dan non-stok'             => [[true, false]],
            'dua non-stok'                  => [[false, false]],
            'tiga baris campuran'           => [[true, false, true]],
            'empat baris non-stok dan stok' => [[false, true, false, false]],
        ];
    }

    /**
     * P-14 (Requirement 13.1-13.2): apa pun yang tersisa di kolom akun dokumen sebelum approve (nilai kiriman klien
     * yang lolos, data lama), akun tercatat sesudah posting sama dengan hasil resolver untuk peran masing-masing.
     *
     * @param  list<bool>  $stockFlags
     */
    #[DataProvider('lineStockCombinations')]
    public function test_sales_invoice_recorded_accounts_equal_the_resolver_result_whatever_the_columns_held(array $stockFlags): void {
        $invoice = $this->draftSalesInvoice($stockFlags);
        DB::table('sales_invoices')->where('id', $invoice->id)->update(['debit_account_id' => $this->payable->id, 'income_account_id' => $this->expense->id]);
        DB::table('sales_invoice_items')->where('sales_invoice_id', $invoice->id)->update(['posted_account_id' => $this->expense->id]);

        app(SalesInvoiceService::class)->onApproved($invoice->fresh());

        $expectedLines = array_map(fn (bool $stock): string => $stock ? $this->revenue->id : $this->revenueNonStock->id, $stockFlags);
        $fresh         = $invoice->fresh();
        $this->assertSame($this->receivable->id, $fresh->debit_account_id);
        $this->assertSame(\count(array_unique($expectedLines)) === 1 ? $expectedLines[0] : null, $fresh->income_account_id);
        $this->assertEqualsCanonicalizing($expectedLines, $this->itemAccounts('sales_invoice_items', 'sales_invoice_id', $invoice->id));
    }

    /**
     * @param  list<bool>  $stockFlags
     */
    #[DataProvider('lineStockCombinations')]
    public function test_purchase_invoice_recorded_accounts_equal_the_resolver_result_whatever_the_columns_held(array $stockFlags): void {
        $invoice = $this->draftPurchaseInvoice($stockFlags);
        DB::table('purchase_invoices')->where('id', $invoice->id)->update(['credit_account_id' => $this->receivable->id, 'expanse_head_account_id' => $this->revenue->id]);
        DB::table('purchase_invoice_items')->where('purchase_invoice_id', $invoice->id)->update(['posted_account_id' => $this->revenue->id]);

        app(PurchaseInvoiceService::class)->onApproved($invoice->fresh());

        $expectedLines = array_map(fn (bool $stock): string => $stock ? $this->expense->id : $this->expenseNonStock->id, $stockFlags);
        $fresh         = $invoice->fresh();
        $this->assertSame($this->payable->id, $fresh->credit_account_id);
        $this->assertSame(\count(array_unique($expectedLines)) === 1 ? $expectedLines[0] : null, $fresh->expanse_head_account_id);
        $this->assertEqualsCanonicalizing($expectedLines, $this->itemAccounts('purchase_invoice_items', 'purchase_invoice_id', $invoice->id));
    }
}
