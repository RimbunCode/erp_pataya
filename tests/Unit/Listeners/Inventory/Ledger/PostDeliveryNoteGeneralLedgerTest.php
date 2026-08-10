<?php

namespace Tests\Unit\Listeners\Inventory\Ledger;

use App\Enums\FormStatus;
use App\Events\Inventory\DeliveryNoteGeneralLedgerPostingRequested;
use App\Listeners\Inventory\Ledger\PostDeliveryNoteGeneralLedger;
use App\Models\Core\GlPostingStatus;
use App\Models\Finances\GeneralLedger;
use App\Models\Inventory\DeliveryNote;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use RuntimeException;
use Tests\TestCase;

/**
 * Insert langsung via DB::table() (bukan DeliveryNote::create()/Account::create())
 * untuk hindari boot hook Eloquent (Submitable/TreeView butuh kolom yang tidak ada
 * di skema test SQLite) — pola sama dengan PostPurchaseReceiptGeneralLedgerTest.
 */
class PostDeliveryNoteGeneralLedgerTest extends TestCase {
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

    private function makeDeliveryNoteId(): string {
        $permissionId = (string) Str::ulid();
        DB::table('permissions')->insert([
            'id'         => $permissionId,
            'module'     => 'inventory',
            'name'       => 'delivery_note',
            'model'      => DeliveryNote::class,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $id = (string) Str::ulid();
        DB::table('delivery_notes')->insert([
            'id'                 => $id,
            'delivery_date'      => now(),
            'reference_to_id'    => $permissionId,
            'referenceable_type' => 'App\\Models\\Sales\\SalesOrder',
            'referenceable_id'   => (string) Str::ulid(),
            'created_at'         => now(),
            'updated_at'         => now(),
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

    public function test_handle_creates_two_gl_entries_for_forward_pick(): void {
        $this->makeAccountId('asset', 'stock');
        $this->makeAccountId('income', 'cost_of_goods_sold');
        $deliveryNoteId = $this->makeDeliveryNoteId();

        GlPostingStatus::create([
            'referenceable_type' => DeliveryNote::class,
            'referenceable_id'   => $deliveryNoteId,
            'status'             => FormStatus::PENDING,
        ]);

        $event = new DeliveryNoteGeneralLedgerPostingRequested(
            DeliveryNote::withoutEvents(fn () => DeliveryNote::find($deliveryNoteId)),
            750.0,
            false,
            now(),
        );

        (new PostDeliveryNoteGeneralLedger)->handle($event);

        $this->assertSame(2, GeneralLedger::where('referenceable_type', DeliveryNote::class)
            ->where('referenceable_id', $deliveryNoteId)
            ->count());

        $stockEntry = GeneralLedger::whereHas('account', fn ($q) => $q->where('account_type', 'stock'))
            ->where('referenceable_id', $deliveryNoteId)
            ->first();
        $this->assertEquals(0.0, $stockEntry->debit);
        $this->assertEquals(750.0, $stockEntry->credit);

        $cogsEntry = GeneralLedger::whereHas('account', fn ($q) => $q->where('account_type', 'cost_of_goods_sold'))
            ->where('referenceable_id', $deliveryNoteId)
            ->first();
        $this->assertEquals(750.0, $cogsEntry->debit);
        $this->assertEquals(0.0, $cogsEntry->credit);

        $glPostingStatus = GlPostingStatus::where('referenceable_id', $deliveryNoteId)->first();
        $this->assertEquals(FormStatus::POSTED, $glPostingStatus->status);
        $this->assertNotNull($glPostingStatus->posted_at);
    }

    public function test_handle_reverses_debit_credit_for_return(): void {
        $this->makeAccountId('asset', 'stock');
        $this->makeAccountId('income', 'cost_of_goods_sold');
        $deliveryNoteId = $this->makeDeliveryNoteId();

        GlPostingStatus::create([
            'referenceable_type' => DeliveryNote::class,
            'referenceable_id'   => $deliveryNoteId,
            'status'             => FormStatus::PENDING,
        ]);

        $event = new DeliveryNoteGeneralLedgerPostingRequested(
            DeliveryNote::withoutEvents(fn () => DeliveryNote::find($deliveryNoteId)),
            300.0,
            true,
            now(),
        );

        (new PostDeliveryNoteGeneralLedger)->handle($event);

        $stockEntry = GeneralLedger::whereHas('account', fn ($q) => $q->where('account_type', 'stock'))
            ->where('referenceable_id', $deliveryNoteId)
            ->first();
        $this->assertEquals(300.0, $stockEntry->debit);
        $this->assertEquals(0.0, $stockEntry->credit);
    }

    public function test_failed_marks_gl_posting_status_as_failed(): void {
        $deliveryNoteId = $this->makeDeliveryNoteId();

        GlPostingStatus::create([
            'referenceable_type' => DeliveryNote::class,
            'referenceable_id'   => $deliveryNoteId,
            'status'             => FormStatus::PENDING,
        ]);

        $event = new DeliveryNoteGeneralLedgerPostingRequested(
            DeliveryNote::withoutEvents(fn () => DeliveryNote::find($deliveryNoteId)),
            750.0,
            false,
            now(),
        );

        (new PostDeliveryNoteGeneralLedger)->failed($event, new RuntimeException('Account not found'));

        $glPostingStatus = GlPostingStatus::where('referenceable_id', $deliveryNoteId)->first();
        $this->assertEquals(FormStatus::FAILED, $glPostingStatus->status);
        $this->assertEquals(1, $glPostingStatus->retry_count);
        $this->assertEquals('Account not found', $glPostingStatus->last_error);
    }
}
