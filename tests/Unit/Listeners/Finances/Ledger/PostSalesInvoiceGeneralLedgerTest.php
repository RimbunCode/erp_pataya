<?php

namespace Tests\Unit\Listeners\Finances\Ledger;

use App\Enums\FormStatus;
use App\Events\Finances\SalesInvoiceGeneralLedgerPostingRequested;
use App\Listeners\Finances\Ledger\PostSalesInvoiceGeneralLedger;
use App\Models\Core\GlPostingStatus;
use App\Models\Finances\GeneralLedger;
use App\Models\Finances\SalesInvoice;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use RuntimeException;
use Tests\TestCase;

/**
 * Insert langsung via DB::table() (bukan SalesInvoice::create()/Account::create())
 * untuk hindari boot hook Eloquent -- pola sama dengan PostPurchaseInvoiceGeneralLedgerTest.
 */
class PostSalesInvoiceGeneralLedgerTest extends TestCase {
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

    private function makeSalesInvoiceId(string $debitAccountId, string $incomeAccountId): string {
        $id = (string) Str::ulid();
        DB::table('sales_invoices')->insert([
            'id'                => $id,
            'date'              => now(),
            'debit_account_id'  => $debitAccountId,
            'income_account_id' => $incomeAccountId,
            'amount'            => 0,
            'paid_amount'       => 0,
            'discount_rate'     => 0,
            'discount_amount'   => 0,
            'created_at'        => now(),
            'updated_at'        => now(),
        ]);

        return $id;
    }

    public function test_handle_creates_credit_and_debit_entries(): void {
        $debitAccountId  = $this->makeAccountId('asset', 'accounts_receivable');
        $creditAccountId = $this->makeAccountId('income', 'sales');
        $salesInvoiceId  = $this->makeSalesInvoiceId($debitAccountId, $creditAccountId);

        GlPostingStatus::create([
            'referenceable_type' => SalesInvoice::class,
            'referenceable_id'   => $salesInvoiceId,
            'status'             => FormStatus::PENDING,
        ]);

        $event = new SalesInvoiceGeneralLedgerPostingRequested(
            SalesInvoice::withoutEvents(fn () => SalesInvoice::find($salesInvoiceId)),
            1000.0,
            false,
            now(),
            $debitAccountId,
            $creditAccountId,
        );

        (new PostSalesInvoiceGeneralLedger)->handle($event);

        $this->assertSame(2, GeneralLedger::where('referenceable_type', SalesInvoice::class)
            ->where('referenceable_id', $salesInvoiceId)
            ->count());

        $debitEntry = GeneralLedger::where('account_id', $debitAccountId)
            ->where('referenceable_id', $salesInvoiceId)
            ->first();
        $this->assertEquals(1000.0, $debitEntry->debit);
        $this->assertEquals(0.0, $debitEntry->credit);

        $creditEntry = GeneralLedger::where('account_id', $creditAccountId)
            ->where('referenceable_id', $salesInvoiceId)
            ->first();
        $this->assertEquals(0.0, $creditEntry->debit);
        $this->assertEquals(1000.0, $creditEntry->credit);

        $glPostingStatus = GlPostingStatus::where('referenceable_id', $salesInvoiceId)->first();
        $this->assertEquals(FormStatus::POSTED, $glPostingStatus->status);
    }

    public function test_handle_reverses_debit_credit_when_return(): void {
        $debitAccountId  = $this->makeAccountId('asset', 'accounts_receivable');
        $creditAccountId = $this->makeAccountId('income', 'sales');
        $salesInvoiceId  = $this->makeSalesInvoiceId($debitAccountId, $creditAccountId);

        GlPostingStatus::create([
            'referenceable_type' => SalesInvoice::class,
            'referenceable_id'   => $salesInvoiceId,
            'status'             => FormStatus::PENDING,
        ]);

        $event = new SalesInvoiceGeneralLedgerPostingRequested(
            SalesInvoice::withoutEvents(fn () => SalesInvoice::find($salesInvoiceId)),
            500.0,
            true,
            now(),
            $debitAccountId,
            $creditAccountId,
        );

        (new PostSalesInvoiceGeneralLedger)->handle($event);

        $debitEntry = GeneralLedger::where('account_id', $debitAccountId)
            ->where('referenceable_id', $salesInvoiceId)
            ->first();
        $this->assertEquals(0.0, $debitEntry->debit);
        $this->assertEquals(500.0, $debitEntry->credit);

        $creditEntry = GeneralLedger::where('account_id', $creditAccountId)
            ->where('referenceable_id', $salesInvoiceId)
            ->first();
        $this->assertEquals(500.0, $creditEntry->debit);
        $this->assertEquals(0.0, $creditEntry->credit);
    }

    public function test_failed_marks_gl_posting_status_as_failed(): void {
        $debitAccountId  = $this->makeAccountId('asset', 'accounts_receivable');
        $creditAccountId = $this->makeAccountId('income', 'sales');
        $salesInvoiceId  = $this->makeSalesInvoiceId($debitAccountId, $creditAccountId);

        GlPostingStatus::create([
            'referenceable_type' => SalesInvoice::class,
            'referenceable_id'   => $salesInvoiceId,
            'status'             => FormStatus::PENDING,
        ]);

        $event = new SalesInvoiceGeneralLedgerPostingRequested(
            SalesInvoice::withoutEvents(fn () => SalesInvoice::find($salesInvoiceId)),
            1000.0,
            false,
            now(),
            $debitAccountId,
            $creditAccountId,
        );

        (new PostSalesInvoiceGeneralLedger)->failed($event, new RuntimeException('Account not found'));

        $glPostingStatus = GlPostingStatus::where('referenceable_id', $salesInvoiceId)->first();
        $this->assertEquals(FormStatus::FAILED, $glPostingStatus->status);
        $this->assertEquals(1, $glPostingStatus->retry_count);
        $this->assertEquals('Account not found', $glPostingStatus->last_error);
    }
}
