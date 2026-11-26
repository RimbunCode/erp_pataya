<?php

namespace Tests\Feature\Finances\Posting;

use App\Enums\FormStatus;
use App\Events\Finances\SalesInvoiceGeneralLedgerPostingRequested;
use App\Listeners\Finances\Ledger\PostSalesInvoiceGeneralLedger;
use App\Models\Core\GlPostingStatus;
use App\Models\Finances\Account;
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
use App\Services\Finances\Posting\AccountPanel\PostedAccountPanel;
use App\Services\Finances\Posting\PostingProfileService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Tests\Support\BuildsFinanceFixtures;
use Tests\TestCase;

/**
 * Finance Fase 2, Task 12.4 (Requirement 13.4 dan 13.7): panel baca-saja "Akun pencatatan". Pratinjau sebelum approve
 * memakai resolver yang sama dengan posting dan tidak menulis apa pun; sesudah approve panel membaca kolom tercatat;
 * peran yang tidak ter-resolve menjadi state `error` berpesan jelas, bukan halaman 500.
 */
class PostedAccountPanelTest extends TestCase {
    use BuildsFinanceFixtures, RefreshDatabase;

    private Account $receivable;
    private Account $revenue;
    private Account $revenueNonStock;
    private Account $payable;
    private Account $expense;
    private Account $srnb;
    private PurchaseOrder $purchaseOrder;

    protected function setUp(): void {
        parent::setUp();

        $this->setUpFinanceFixtures([PostingProfile::class, SalesInvoice::class, PurchaseInvoice::class, PurchaseOrder::class, Unit::class, Warehouse::class, Item::class, ItemVariant::class]);

        $this->receivable      = $this->makeAccount('1200', 'Piutang Usaha', 'asset', 'debit', 'accounts_receivable');
        $this->revenue         = $this->makeAccount('4000', 'Penjualan Barang', 'income', 'credit', 'sales');
        $this->revenueNonStock = $this->makeAccount('4010', 'Penjualan Jasa', 'income', 'credit');
        $this->payable         = $this->makeAccount('2000', 'Utang Usaha', 'liability', 'credit', 'accounts_payable');
        $this->expense         = $this->makeAccount('5000', 'Beban Pembelian', 'expense', 'debit');
        $this->srnb            = $this->makeAccount('2100', 'SRNB', 'liability', 'credit', 'stock_received_but_not_billed');

        $profiles = app(PostingProfileService::class);
        $profiles->activate($profiles->createDraft('Profil panel', '2020-01-01', null, [
            'receivable'                    => $this->receivable->id,
            'revenue'                       => $this->revenue->id,
            'payable'                       => $this->payable->id,
            'expense'                       => $this->expense->id,
            'stock_received_but_not_billed' => $this->srnb->id,
        ], [
            ['role' => 'revenue', 'account_id' => $this->revenueNonStock->id, 'is_stock_item' => false],
        ]));

        $this->purchaseOrder = BaseModel::withoutEvents(fn () => PurchaseOrder::create([
            'code'          => 'PO-PANEL-1',
            'date'          => now(),
            'status'        => [FormStatus::SUBMITTED],
            'created_by_id' => $this->user->id,
        ]));
    }

    /**
     * @param  list<bool>  $stockFlags  `is_stock_item` varian tiap baris
     * @param  list<FormStatus>  $status
     */
    private function salesInvoice(array $stockFlags = [true], array $status = [FormStatus::DRAFT]): SalesInvoice {
        $invoice = $this->makeSalesInvoice($this->receivable, $this->revenue, ['debit_account_id' => null, 'income_account_id' => null, 'status' => $status], [
            'item_id' => ItemVariant::factory()->create(['is_stock_item' => $stockFlags[0]])->id,
        ]);
        foreach (\array_slice($stockFlags, 1) as $stockFlag) {
            SalesInvoiceItem::factory()->create([
                'sales_invoice_id' => $invoice->id,
                'item_id'          => ItemVariant::factory()->create(['is_stock_item' => $stockFlag])->id,
                'quantity'         => 2,
                'price'            => 1000,
                'tax_rate'         => 10,
            ]);
        }
        GlPostingStatus::create(['referenceable_type' => SalesInvoice::class, 'referenceable_id' => $invoice->id, 'status' => FormStatus::PENDING]);

        return $invoice->fresh();
    }

    /**
     * @param  list<array{role: string, label: string, lines: int, account: array{id: string, number: ?string, name: ?string}}>  $rows
     * @return array<string, array{account: string, lines: int}>
     */
    private function byRole(array $rows): array {
        $map = [];
        foreach ($rows as $row) {
            $map[$row['role']] = ['account' => $row['account']['id'], 'lines' => $row['lines']];
        }

        return $map;
    }

    private function panel(): PostedAccountPanel {
        return app(PostedAccountPanel::class);
    }

    public function test_draft_sales_invoice_previews_the_accounts_the_resolver_would_use(): void {
        $result = $this->panel()->build($this->salesInvoice());

        $this->assertSame('preview', $result['state']);
        $this->assertFalse($result['estimated']);
        $this->assertSame(
            ['receivable' => ['account' => $this->receivable->id, 'lines' => 0], 'revenue' => ['account' => $this->revenue->id, 'lines' => 1]],
            $this->byRole($result['rows']),
        );
        $this->assertSame('1200', $result['rows'][0]['account']['number']);
        $this->assertSame('Piutang Usaha', $result['rows'][0]['account']['name']);
    }

    public function test_preview_follows_per_line_conditional_accounts(): void {
        $result = $this->panel()->build($this->salesInvoice([true, false, false]));

        $revenue = array_values(array_filter($result['rows'], fn (array $row): bool => $row['role'] === 'revenue'));
        $this->assertCount(2, $revenue, 'Dua akun pendapatan berbeda (barang dan non-barang).');
        $this->assertEqualsCanonicalizing([1, 2], array_column($revenue, 'lines'));
    }

    public function test_preview_ignores_stale_account_columns_on_a_draft(): void {
        $invoice = $this->salesInvoice();
        DB::table('sales_invoices')->where('id', $invoice->id)->update(['debit_account_id' => $this->payable->id]);

        $result = $this->panel()->build($invoice->fresh());

        $this->assertSame('preview', $result['state']);
        $this->assertSame($this->receivable->id, $this->byRole($result['rows'])['receivable']['account']);
    }

    public function test_preview_writes_nothing(): void {
        $invoice = $this->salesInvoice();
        $before  = [
            'updated' => DB::table('sales_invoices')->where('id', $invoice->id)->value('updated_at'),
            'journal' => Journal::query()->withoutGlobalScopes()->count(),
            'gl'      => GlPostingStatus::query()->count(),
        ];

        DB::enableQueryLog();
        $this->panel()->build($invoice);
        $queries = DB::getQueryLog();
        DB::disableQueryLog();

        foreach ($queries as $query) {
            $this->assertStringStartsWith('select', strtolower(ltrim($query['query'])), "Pratinjau hanya boleh membaca: {$query['query']}");
        }
        $this->assertSame($before['updated'], DB::table('sales_invoices')->where('id', $invoice->id)->value('updated_at'));
        $this->assertSame($before['journal'], Journal::query()->withoutGlobalScopes()->count());
        $this->assertSame($before['gl'], GlPostingStatus::query()->count());
        $this->assertNull($invoice->fresh()->debit_account_id);
    }

    public function test_preview_query_count_does_not_grow_with_the_number_of_lines(): void {
        $small = $this->salesInvoice([true, false]);
        $large = $this->salesInvoice([true, false, true, false, true, false, true, false]);

        // Panggilan pertama membayar introspeksi skema dan cache setting; ukur setelah pemanasan.
        $this->panel()->build($small);

        $count = function (SalesInvoice $invoice): array {
            DB::flushQueryLog();
            DB::enableQueryLog();
            $this->panel()->build($invoice);
            $queries = array_column(DB::getQueryLog(), 'query');
            DB::disableQueryLog();

            return $queries;
        };

        $smallQueries = $count($small);
        $largeQueries = $count($large);
        $this->assertSame(\count($smallQueries), \count($largeQueries), 'Jumlah query pratinjau tidak boleh tumbuh bersama jumlah baris.');
    }

    public function test_posted_sales_invoice_shows_the_recorded_columns(): void {
        $invoice = $this->salesInvoice([true, false]);
        (new PostSalesInvoiceGeneralLedger)->handle(new SalesInvoiceGeneralLedgerPostingRequested($invoice, 4366.66, false, now(), null, null));
        $invoice->update(['status' => [FormStatus::UNPAID]]);

        $result = $this->panel()->build($invoice->fresh());

        $this->assertSame('recorded', $result['state']);
        $this->assertSame($this->receivable->id, $this->byRole($result['rows'])['receivable']['account']);
        $revenue = array_values(array_filter($result['rows'], fn (array $row): bool => $row['role'] === 'revenue'));
        $this->assertEqualsCanonicalizing([$this->revenue->id, $this->revenueNonStock->id], array_column(array_column($revenue, 'account'), 'id'));
    }

    public function test_approved_document_without_recorded_accounts_is_pending_posting(): void {
        $result = $this->panel()->build($this->salesInvoice([true], [FormStatus::UNPAID]));

        $this->assertSame('pending_posting', $result['state']);
        $this->assertSame([], $result['rows']);
    }

    public function test_canceled_document_has_no_panel(): void {
        $result = $this->panel()->build($this->salesInvoice([true], [FormStatus::CANCELED]));

        $this->assertSame('unavailable', $result['state']);
    }

    public function test_unresolved_role_becomes_an_error_state_that_names_the_role(): void {
        DB::table('posting_profiles')->update(['effective_from' => now()->addYear()->toDateString()]);

        $result = $this->panel()->build($this->salesInvoice());

        $this->assertSame('error', $result['state']);
        $this->assertTrue($result['fixable']);
        $this->assertStringContainsString('receivable', (string) $result['message']);
        $this->assertSame([], $result['rows']);
    }

    public function test_draft_purchase_invoice_previews_and_is_flagged_as_estimate(): void {
        $invoice = PurchaseInvoice::create([
            'date'              => now()->subDays(3),
            'purchase_order_id' => $this->purchaseOrder->id,
            'branch_id'         => $this->branch->id,
            'status'            => [FormStatus::DRAFT],
        ]);
        PurchaseInvoiceItem::create([
            'purchase_invoice_id' => $invoice->id,
            'item_id'             => ItemVariant::factory()->create(['is_stock_item' => false])->id,
            'quantity'            => 2,
            'rate'                => 1000,
            'tax_rate'            => 10,
            'discount_amount'     => 0,
        ]);

        $result = $this->panel()->build($invoice->fresh());

        $this->assertSame('preview', $result['state']);
        $this->assertTrue($result['estimated']);
        $this->assertSame($this->payable->id, $this->byRole($result['rows'])['payable']['account']);
    }

    public function test_models_without_a_panel_are_not_supported(): void {
        $this->assertTrue($this->panel()->supports($this->salesInvoice()));
        $this->assertFalse($this->panel()->supports($this->user));
        $this->assertSame('unavailable', $this->panel()->build($this->user)['state']);
    }

    /**
     * @return array<string, mixed>
     */
    private function sessionWithPermission(): array {
        return [
            'permissions' => [
                SalesInvoice::class => [
                    0 => [[
                        'model'        => SalesInvoice::class,
                        'level'        => 0,
                        'only_creator' => false,
                        'permissions'  => ['select' => true, 'read' => true],
                    ]],
                ],
            ],
            'permissions_version' => '0|0|0|0',
            'currentBranch'       => $this->branch->id,
        ];
    }

    /**
     * @return array<string, string>
     */
    private function partialHeaders(): array {
        return [
            'X-Inertia'                   => 'true',
            'X-Inertia-Version'           => (string) Inertia::getVersion(),
            'X-Inertia-Partial-Component' => 'Finances/SalesInvoice/Show',
            'X-Inertia-Partial-Data'      => 'postedAccounts',
        ];
    }

    public function test_show_page_serves_the_panel_as_a_deferred_prop_to_authorized_users(): void {
        $invoice = $this->salesInvoice();

        $response = $this->withSession($this->sessionWithPermission())->withCookie('lang', 'en')->actingAs($this->user)
            ->get(route('salesInvoices.show', $invoice), $this->partialHeaders());

        $this->assertSame(200, $response->getStatusCode(), (string) $response->headers->get('Location'));
        $this->assertSame('preview', $response->json('props.postedAccounts.state'));
        $this->assertSame($this->receivable->id, $this->byRole($response->json('props.postedAccounts.rows'))['receivable']['account']);
    }

    public function test_show_page_does_not_serve_the_panel_without_read_permission(): void {
        $invoice = $this->salesInvoice();

        $response = $this->withSession(['permissions' => [], 'permissions_version' => '0|0|0|0', 'currentBranch' => $this->branch->id])->withCookie('lang', 'en')->actingAs($this->user)
            ->get(route('salesInvoices.show', $invoice), $this->partialHeaders());

        $response->assertForbidden();
        $this->assertStringNotContainsString('postedAccounts', (string) $response->getContent());
    }
}
