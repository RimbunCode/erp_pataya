<?php

namespace Tests\Unit\Listeners\Finances\Ledger;

use App\Enums\FormStatus;
use App\Events\Finances\PurchaseInvoiceGeneralLedgerPostingRequested;
use App\Listeners\Finances\Ledger\PostPurchaseInvoiceGeneralLedger;
use App\Models\Core\GlPostingStatus;
use App\Models\Finances\GeneralLedger;
use App\Models\Finances\PurchaseInvoice;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use RuntimeException;
use Tests\TestCase;

/**
 * Insert langsung via DB::table() (bukan PurchaseInvoice::create()/Account::create())
 * untuk hindari boot hook Eloquent — pola sama dengan
 * PostPurchaseReceiptGeneralLedgerTest/PostDeliveryNoteGeneralLedgerTest.
 */
class PostPurchaseInvoiceGeneralLedgerTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        foreach (Schema::getTables() as $tableInfo) {
            $table = $tableInfo['name'];
            if (! Schema::hasColumn($table, 'is_example')) {
                Schema::table($table, fn ($t) => $t->boolean('is_example')->default(false));
            }
        }

        GeneralLedger::initPermissions();
    }

    private function makeAccountId(string $rootType, string $accountType): string {
        $id = (string) Str::ulid();
        DB::table('accounts')->insert([
            'id'             => $id,
            'account_name'   => ucfirst($accountType),
            'account_number' => (string) random_int(1000, 9999),
            'root_type'      => $rootType,
            'account_type'   => $accountType,
            'report_type'    => 'balance_sheet',
            'created_at'     => now(),
            'updated_at'     => now(),
        ]);

        return $id;
    }

    private function makePurchaseInvoiceId(string $expenseHeadAccountId, string $creditAccountId): string {
        $id = (string) Str::ulid();
        DB::table('purchase_invoices')->insert([
            'id'                      => $id,
            'date'                    => now(),
            'expanse_head_account_id' => $expenseHeadAccountId,
            'credit_account_id'       => $creditAccountId,
            'amount'                  => 0,
            'paid_amount'             => 0,
            'discount_rate'           => 0,
            'discount_amount'         => 0,
            'created_at'              => now(),
            'updated_at'              => now(),
        ]);

        return $id;
    }

    public function test_handle_creates_stock_srnb_and_expense_credit_entries(): void {
        $this->makeAccountId('asset', 'stock');
        $this->makeAccountId('liability', 'stock_received_but_not_billed');
        $expenseHeadAccountId = $this->makeAccountId('expense', 'expense');
        $creditAccountId      = $this->makeAccountId('liability', 'creditors');
        $purchaseInvoiceId    = $this->makePurchaseInvoiceId($expenseHeadAccountId, $creditAccountId);

        GlPostingStatus::create([
            'referenceable_type' => PurchaseInvoice::class,
            'referenceable_id'   => $purchaseInvoiceId,
            'status'             => FormStatus::PENDING,
        ]);

        $event = new PurchaseInvoiceGeneralLedgerPostingRequested(
            PurchaseInvoice::withoutEvents(fn () => PurchaseInvoice::find($purchaseInvoiceId)),
            400.0,
            1000.0,
            false,
            now(),
            $expenseHeadAccountId,
            $creditAccountId,
        );

        (new PostPurchaseInvoiceGeneralLedger)->handle($event);

        // 2 entry Stock/SRNB (totalStockGL > 0) + 2 entry Expense/Credit (selalu) = 4
        $this->assertSame(4, GeneralLedger::where('referenceable_type', PurchaseInvoice::class)
            ->where('referenceable_id', $purchaseInvoiceId)
            ->count());

        $stockEntry = GeneralLedger::where('account_id', function ($q) {
            $q->select('id')->from('accounts')->where('account_type', 'stock');
        })->where('referenceable_id', $purchaseInvoiceId)->first();
        $this->assertEquals(400.0, $stockEntry->debit);

        $debitEntry = GeneralLedger::where('account_id', $expenseHeadAccountId)
            ->where('referenceable_id', $purchaseInvoiceId)
            ->first();
        $this->assertEquals(1000.0, $debitEntry->debit);
        $this->assertEquals(0.0, $debitEntry->credit);

        $creditEntry = GeneralLedger::where('account_id', $creditAccountId)
            ->where('referenceable_id', $purchaseInvoiceId)
            ->first();
        $this->assertEquals(0.0, $creditEntry->debit);
        $this->assertEquals(1000.0, $creditEntry->credit);

        $glPostingStatus = GlPostingStatus::where('referenceable_id', $purchaseInvoiceId)->first();
        $this->assertEquals(FormStatus::POSTED, $glPostingStatus->status);
    }

    public function test_handle_skips_stock_srnb_entries_when_total_stock_gl_is_zero(): void {
        $expenseHeadAccountId = $this->makeAccountId('expense', 'expense');
        $creditAccountId      = $this->makeAccountId('liability', 'creditors');
        $purchaseInvoiceId    = $this->makePurchaseInvoiceId($expenseHeadAccountId, $creditAccountId);

        GlPostingStatus::create([
            'referenceable_type' => PurchaseInvoice::class,
            'referenceable_id'   => $purchaseInvoiceId,
            'status'             => FormStatus::PENDING,
        ]);

        $event = new PurchaseInvoiceGeneralLedgerPostingRequested(
            PurchaseInvoice::withoutEvents(fn () => PurchaseInvoice::find($purchaseInvoiceId)),
            0.0,
            1000.0,
            false,
            now(),
            $expenseHeadAccountId,
            $creditAccountId,
        );

        (new PostPurchaseInvoiceGeneralLedger)->handle($event);

        // Hanya 2 entry Expense/Credit — Stock/SRNB di-skip karena totalStockGL == 0
        $this->assertSame(2, GeneralLedger::where('referenceable_type', PurchaseInvoice::class)
            ->where('referenceable_id', $purchaseInvoiceId)
            ->count());
    }

    public function test_handle_uses_invoice_specific_accounts_not_generic_query(): void {
        // 2 pasang akun expense/credit berbeda — listener HARUS pakai akun sesuai
        // invoice (dari event), BUKAN query generik "akun terbaru" (regresi bug lama).
        $this->makeAccountId('expense', 'expense'); // akun expense lain, dibuat lebih dulu
        $expenseHeadAccountId = $this->makeAccountId('expense', 'expense'); // akun invoice ini (lebih baru)
        $this->makeAccountId('liability', 'creditors'); // akun credit lain
        $creditAccountId   = $this->makeAccountId('liability', 'creditors'); // akun invoice ini (lebih baru)
        $purchaseInvoiceId = $this->makePurchaseInvoiceId($expenseHeadAccountId, $creditAccountId);

        // Sengaja invoice INI pakai akun yang BUKAN "terbaru" — insert 1 akun expense/credit lagi SETELAHNYA
        $newerExpenseId = $this->makeAccountId('expense', 'expense');
        $newerCreditId  = $this->makeAccountId('liability', 'creditors');

        GlPostingStatus::create([
            'referenceable_type' => PurchaseInvoice::class,
            'referenceable_id'   => $purchaseInvoiceId,
            'status'             => FormStatus::PENDING,
        ]);

        $event = new PurchaseInvoiceGeneralLedgerPostingRequested(
            PurchaseInvoice::withoutEvents(fn () => PurchaseInvoice::find($purchaseInvoiceId)),
            0.0,
            500.0,
            false,
            now(),
            $expenseHeadAccountId,
            $creditAccountId,
        );

        (new PostPurchaseInvoiceGeneralLedger)->handle($event);

        $this->assertSame(0, GeneralLedger::where('account_id', $newerExpenseId)->count());
        $this->assertSame(0, GeneralLedger::where('account_id', $newerCreditId)->count());
        $this->assertSame(1, GeneralLedger::where('account_id', $expenseHeadAccountId)
            ->where('referenceable_id', $purchaseInvoiceId)->count());
        $this->assertSame(1, GeneralLedger::where('account_id', $creditAccountId)
            ->where('referenceable_id', $purchaseInvoiceId)->count());
    }

    public function test_failed_marks_gl_posting_status_as_failed(): void {
        $expenseHeadAccountId = $this->makeAccountId('expense', 'expense');
        $creditAccountId      = $this->makeAccountId('liability', 'creditors');
        $purchaseInvoiceId    = $this->makePurchaseInvoiceId($expenseHeadAccountId, $creditAccountId);

        GlPostingStatus::create([
            'referenceable_type' => PurchaseInvoice::class,
            'referenceable_id'   => $purchaseInvoiceId,
            'status'             => FormStatus::PENDING,
        ]);

        $event = new PurchaseInvoiceGeneralLedgerPostingRequested(
            PurchaseInvoice::withoutEvents(fn () => PurchaseInvoice::find($purchaseInvoiceId)),
            400.0,
            1000.0,
            false,
            now(),
            $expenseHeadAccountId,
            $creditAccountId,
        );

        (new PostPurchaseInvoiceGeneralLedger)->failed($event, new RuntimeException('Account not found'));

        $glPostingStatus = GlPostingStatus::where('referenceable_id', $purchaseInvoiceId)->first();
        $this->assertEquals(FormStatus::FAILED, $glPostingStatus->status);
        $this->assertEquals(1, $glPostingStatus->retry_count);
        $this->assertEquals('Account not found', $glPostingStatus->last_error);
    }
}
