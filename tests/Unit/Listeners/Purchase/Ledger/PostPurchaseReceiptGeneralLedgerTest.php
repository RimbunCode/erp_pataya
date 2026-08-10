<?php

namespace Tests\Unit\Listeners\Purchase\Ledger;

use App\Enums\FormStatus;
use App\Events\Purchase\PurchaseReceiptGeneralLedgerPostingRequested;
use App\Listeners\Purchase\Ledger\PostPurchaseReceiptGeneralLedger;
use App\Models\Core\GlPostingStatus;
use App\Models\Finances\GeneralLedger;
use App\Models\Purchase\PurchaseReceipt;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use RuntimeException;
use Tests\TestCase;

/**
 * Insert langsung via DB::table() (bukan Account::create()/PurchaseReceipt::create())
 * untuk hindari boot hook Eloquent (TreeView butuh kolom lft/rgt yang tidak ada di
 * skema accounts, Submitable butuh created_by_id yang tidak ada di skema
 * purchase_receipts) — listener yang diuji di sini cuma butuh baca kolom, tidak
 * memicu boot hook model sumbernya.
 */
class PostPurchaseReceiptGeneralLedgerTest extends TestCase {
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

    private function makePurchaseReceiptId(): string {
        $id = (string) Str::ulid();
        DB::table('purchase_receipts')->insert([
            'id'         => $id,
            'date'       => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return $id;
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

    public function test_handle_creates_two_gl_entries_for_normal_receipt(): void {
        $this->makeAccountId('asset', 'stock');
        $this->makeAccountId('liability', 'stock_received_but_not_billed');
        $purchaseReceiptId = $this->makePurchaseReceiptId();

        GlPostingStatus::create([
            'referenceable_type' => PurchaseReceipt::class,
            'referenceable_id'   => $purchaseReceiptId,
            'status'             => FormStatus::PENDING,
        ]);

        $event = new PurchaseReceiptGeneralLedgerPostingRequested(
            PurchaseReceipt::withoutEvents(fn () => PurchaseReceipt::find($purchaseReceiptId)),
            1000.0,
            false,
            now(),
        );

        (new PostPurchaseReceiptGeneralLedger)->handle($event);

        $this->assertSame(2, GeneralLedger::where('referenceable_type', PurchaseReceipt::class)
            ->where('referenceable_id', $purchaseReceiptId)
            ->count());

        $stockEntry = GeneralLedger::whereHas('account', fn ($q) => $q->where('account_type', 'stock'))
            ->where('referenceable_id', $purchaseReceiptId)
            ->first();
        $this->assertEquals(1000.0, $stockEntry->debit);
        $this->assertEquals(0.0, $stockEntry->credit);

        $srnbEntry = GeneralLedger::whereHas('account', fn ($q) => $q->where('account_type', 'stock_received_but_not_billed'))
            ->where('referenceable_id', $purchaseReceiptId)
            ->first();
        $this->assertEquals(0.0, $srnbEntry->debit);
        $this->assertEquals(1000.0, $srnbEntry->credit);

        $glPostingStatus = GlPostingStatus::where('referenceable_id', $purchaseReceiptId)->first();
        $this->assertEquals(FormStatus::POSTED, $glPostingStatus->status);
        $this->assertNotNull($glPostingStatus->posted_at);
    }

    public function test_handle_reverses_debit_credit_for_return(): void {
        $this->makeAccountId('asset', 'stock');
        $this->makeAccountId('liability', 'stock_received_but_not_billed');
        $purchaseReceiptId = $this->makePurchaseReceiptId();

        GlPostingStatus::create([
            'referenceable_type' => PurchaseReceipt::class,
            'referenceable_id'   => $purchaseReceiptId,
            'status'             => FormStatus::PENDING,
        ]);

        $event = new PurchaseReceiptGeneralLedgerPostingRequested(
            PurchaseReceipt::withoutEvents(fn () => PurchaseReceipt::find($purchaseReceiptId)),
            500.0,
            true,
            now(),
        );

        (new PostPurchaseReceiptGeneralLedger)->handle($event);

        $stockEntry = GeneralLedger::whereHas('account', fn ($q) => $q->where('account_type', 'stock'))
            ->where('referenceable_id', $purchaseReceiptId)
            ->first();
        $this->assertEquals(0.0, $stockEntry->debit);
        $this->assertEquals(500.0, $stockEntry->credit);
    }

    public function test_failed_marks_gl_posting_status_as_failed(): void {
        $purchaseReceiptId = $this->makePurchaseReceiptId();

        GlPostingStatus::create([
            'referenceable_type' => PurchaseReceipt::class,
            'referenceable_id'   => $purchaseReceiptId,
            'status'             => FormStatus::PENDING,
        ]);

        $event = new PurchaseReceiptGeneralLedgerPostingRequested(
            PurchaseReceipt::withoutEvents(fn () => PurchaseReceipt::find($purchaseReceiptId)),
            1000.0,
            false,
            now(),
        );

        (new PostPurchaseReceiptGeneralLedger)->failed($event, new RuntimeException('Account not found'));

        $glPostingStatus = GlPostingStatus::where('referenceable_id', $purchaseReceiptId)->first();
        $this->assertEquals(FormStatus::FAILED, $glPostingStatus->status);
        $this->assertEquals(1, $glPostingStatus->retry_count);
        $this->assertEquals('Account not found', $glPostingStatus->last_error);
    }

    public function test_failed_increments_retry_count_on_repeated_failure(): void {
        $purchaseReceiptId = $this->makePurchaseReceiptId();

        GlPostingStatus::create([
            'referenceable_type' => PurchaseReceipt::class,
            'referenceable_id'   => $purchaseReceiptId,
            'status'             => FormStatus::PENDING,
            'retry_count'        => 2,
        ]);

        $event = new PurchaseReceiptGeneralLedgerPostingRequested(
            PurchaseReceipt::withoutEvents(fn () => PurchaseReceipt::find($purchaseReceiptId)),
            1000.0,
            false,
            now(),
        );

        (new PostPurchaseReceiptGeneralLedger)->failed($event, new RuntimeException('still failing'));

        $glPostingStatus = GlPostingStatus::where('referenceable_id', $purchaseReceiptId)->first();
        $this->assertEquals(3, $glPostingStatus->retry_count);
    }
}
