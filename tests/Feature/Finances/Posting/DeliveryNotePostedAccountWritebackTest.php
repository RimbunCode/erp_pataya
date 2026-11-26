<?php

namespace Tests\Feature\Finances\Posting;

use App\Enums\FormStatus;
use App\Enums\PostingDocumentType;
use App\Events\Inventory\DeliveryNoteGeneralLedgerPostingRequested;
use App\Listeners\Inventory\Ledger\PostDeliveryNoteGeneralLedger;
use App\Models\Core\GlPostingStatus;
use App\Models\Finances\Account;
use App\Models\Finances\PostingProfile;
use App\Models\Inventory\DeliveryNote;
use App\Models\Inventory\DeliveryNoteItem;
use App\Models\Inventory\Item;
use App\Models\Inventory\ItemVariant;
use App\Models\Inventory\Unit;
use App\Models\Inventory\Warehouse;
use App\Services\Finances\Posting\Contexts\PostingContext;
use App\Services\Finances\Posting\PostedAccountNote;
use App\Services\Finances\Posting\PostedAccountNotes;
use App\Services\Inventory\Accounting\DeliveryNoteLineAmounts;
use App\Services\Inventory\Accounting\DeliveryNotePostedAccountRecorder;
use App\Services\Inventory\Accounting\DeliveryNotePostingContextFactory;
use App\Services\Inventory\DeliveryNoteService;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use ReflectionMethod;
use Tests\Support\BuildsFinanceFixtures;
use Tests\Support\EnablesEnginePosting;
use Tests\TestCase;

/**
 * Finance Fase 2, Task 12.1 bagian B (Requirement 13.2) untuk Delivery Note: akun `cost_of_goods_sold`
 * (`posted_account_id`) dan `stock` (`posted_stock_account_id`) per baris ditulis balik senyap oleh engine; nilai per
 * baris diturunkan dari `valuation_rates` (maju) atau dari baris dokumen asal (retur); retry retur tidak lagi
 * menghasilkan total 0.
 */
class DeliveryNotePostedAccountWritebackTest extends TestCase {
    use BuildsFinanceFixtures, EnablesEnginePosting, RefreshDatabase;

    private Account $stock;
    private Account $cogs;
    private ItemVariant $variant;

    protected function setUp(): void {
        parent::setUp();

        $this->setUpFinanceFixtures([PostingProfile::class, GlPostingStatus::class, Unit::class, Warehouse::class, Item::class, ItemVariant::class]);
        $this->stock = $this->makeAccount('1300', 'Persediaan', 'asset', 'debit', 'stock');
        $this->cogs  = $this->makeAccount('5100', 'HPP', 'income', 'debit', 'cost_of_goods_sold');
        $this->enableEnginePosting(['cost_of_goods_sold' => $this->cogs, 'stock' => $this->stock]);
        $this->variant = $this->makeInventoryFixture('DN-WB')['variant'];
    }

    private function makeNote(?DeliveryNote $returnAgainst = null): DeliveryNote {
        $permissionId = (string) Str::ulid();
        DB::table('permissions')->insert([
            'id'         => $permissionId, 'module' => 'inventory', 'name' => 'delivery_note_wb_' . Str::random(6), 'model' => DeliveryNote::class,
            'created_at' => now(), 'updated_at' => now(),
        ]);

        $id = (string) Str::ulid();
        DB::table('delivery_notes')->insert([
            'id'                 => $id,
            'delivery_date'      => now()->subDays(2),
            'reference_to_id'    => $permissionId,
            'referenceable_type' => 'App\\Models\\Sales\\SalesOrder',
            'referenceable_id'   => (string) Str::ulid(),
            'return_against_id'  => $returnAgainst?->id,
            'created_at'         => now(),
            'updated_at'         => now(),
        ]);

        return DeliveryNote::withoutEvents(fn () => DeliveryNote::findOrFail($id));
    }

    /**
     * @param  list<array{rate: float, quantity: float}>  $valuationRates
     */
    private function addItem(DeliveryNote $note, array $valuationRates, ?DeliveryNoteItem $returnAgainstItem = null): DeliveryNoteItem {
        $id = (string) Str::ulid();
        DB::table('delivery_note_items')->insert([
            'id'                     => $id,
            'referenceable_type'     => 'App\\Models\\Sales\\SalesOrderItem',
            'referenceable_id'       => (string) Str::ulid(),
            'delivery_note_id'       => $note->id,
            'item_id'                => $this->variant->id,
            'quantity'               => 1,
            'valuation_rates'        => json_encode($valuationRates),
            'return_against_item_id' => $returnAgainstItem?->id,
            'created_at'             => now(),
            'updated_at'             => now(),
        ]);

        return DeliveryNoteItem::findOrFail($id);
    }

    private function postLedger(DeliveryNote $note, float $total, bool $isReturn): void {
        GlPostingStatus::create([
            'referenceable_type' => DeliveryNote::class,
            'referenceable_id'   => $note->id,
            'status'             => FormStatus::PENDING,
        ]);

        (new PostDeliveryNoteGeneralLedger)->handle(new DeliveryNoteGeneralLedgerPostingRequested($note->load('items'), $total, $isReturn, now()));
    }

    public function test_line_amounts_use_own_valuation_rates_forward_and_original_rates_for_return(): void {
        $note  = $this->makeNote();
        $line1 = $this->addItem($note, [['rate' => 100, 'quantity' => 2], ['rate' => 110, 'quantity' => 1]]);
        $this->addItem($note, []);

        $this->assertSame([$line1->id => 310.0], DeliveryNoteLineAmounts::forDocument($note->load('items'), false));

        $return  = $this->makeNote($note);
        $retItem = $this->addItem($return, [], $line1);

        $this->assertSame([$retItem->id => 310.0], DeliveryNoteLineAmounts::forDocument($return->load('items.returnAgainstItem'), true));
        $this->assertSame([], DeliveryNoteLineAmounts::forDocument($return, false), 'Retur tanpa rates sendiri bernilai 0 bila dibaca sebagai maju.');
    }

    public function test_factory_fills_lines_for_valued_items_only_with_item_attributes(): void {
        $note  = $this->makeNote();
        $line1 = $this->addItem($note, [['rate' => 100, 'quantity' => 3]]);
        $this->addItem($note, []);

        $ctx = (new DeliveryNotePostingContextFactory)->forPosting($note, 300.0, false, CarbonImmutable::now());

        $this->assertCount(1, $ctx->lines);
        $this->assertSame($line1->id, $ctx->lines[0]->lineId);
        $this->assertEqualsWithDelta(300, $ctx->lines[0]->amount('amount'), 0.001);
        $this->assertSame('inventory', $ctx->lines[0]->itemType);
        $this->assertSame(300.0, $ctx->amount('total_picked'));
    }

    public function test_approval_posting_writes_back_cogs_and_stock_accounts_per_line_without_changing_the_journal(): void {
        $note  = $this->makeNote();
        $line1 = $this->addItem($note, [['rate' => 100, 'quantity' => 3]]);
        $line2 = $this->addItem($note, [['rate' => 200, 'quantity' => 3]]);
        $empty = $this->addItem($note, []);

        $this->postLedger($note, 900, false);

        $this->assertLedger($note, [
            ['account' => $this->cogs, 'against' => $this->stock, 'debit' => 900, 'credit' => 0],
            ['account' => $this->stock, 'against' => $this->cogs, 'debit' => 0, 'credit' => 900],
        ], now()->toDateString());
        $this->assertPostingStatus($note, 'posted');

        foreach ([$line1, $line2] as $line) {
            $this->assertSame($this->cogs->id, $line->fresh()->posted_account_id);
            $this->assertSame($this->stock->id, $line->fresh()->posted_stock_account_id);
        }
        $this->assertNull($empty->fresh()->posted_account_id);
        $this->assertNull($empty->fresh()->posted_stock_account_id);
    }

    public function test_return_posting_swaps_sides_and_still_writes_back_both_accounts(): void {
        $original = $this->makeNote();
        $origLine = $this->addItem($original, [['rate' => 100, 'quantity' => 3]]);
        $return   = $this->makeNote($original);
        $retLine  = $this->addItem($return, [], $origLine);

        $this->postLedger($return, 300, true);

        $this->assertLedger($return, [
            ['account' => $this->stock, 'against' => $this->cogs, 'debit' => 300, 'credit' => 0],
            ['account' => $this->cogs, 'against' => $this->stock, 'debit' => 0, 'credit' => 300],
        ], now()->toDateString());
        $this->assertSame($this->cogs->id, $retLine->fresh()->posted_account_id);
        $this->assertSame($this->stock->id, $retLine->fresh()->posted_stock_account_id);
    }

    public function test_document_without_items_keeps_document_level_journal_and_writes_nothing(): void {
        $note = $this->makeNote();

        $this->postLedger($note, 750, false);

        $this->assertLedger($note, [
            ['account' => $this->cogs, 'against' => $this->stock, 'debit' => 750, 'credit' => 0],
            ['account' => $this->stock, 'against' => $this->cogs, 'debit' => 0, 'credit' => 750],
        ]);
        $this->assertPostingStatus($note, 'posted');
    }

    public function test_recorder_only_touches_its_own_document_lines(): void {
        $accountA = $this->makeAccount('5110', 'HPP A', 'expense', 'debit', 'cost_of_goods_sold');
        $accountB = $this->makeAccount('1310', 'Stok B', 'asset', 'debit', 'stock');
        $note     = $this->makeNote();
        $other    = $this->makeNote();
        $mine     = $this->addItem($note, [['rate' => 1, 'quantity' => 1]]);
        $foreign  = $this->addItem($other, [['rate' => 1, 'quantity' => 1]]);

        $ctx = new PostingContext(PostingDocumentType::DeliveryNote, DeliveryNote::class, (string) $note->id, CarbonImmutable::now(), null, ['total_picked' => 1.0]);
        (new DeliveryNotePostedAccountRecorder)->record($ctx, new PostedAccountNotes([
            new PostedAccountNote('default', 'cost_of_goods_sold', $accountA->id, (string) $mine->id),
            new PostedAccountNote('default', 'stock', $accountB->id, (string) $mine->id),
            new PostedAccountNote('default', 'cost_of_goods_sold', $accountA->id, (string) $foreign->id),
        ]));

        $this->assertSame($accountA->id, $mine->fresh()->posted_account_id);
        $this->assertSame($accountB->id, $mine->fresh()->posted_stock_account_id);
        $this->assertNull($foreign->fresh()->posted_account_id, 'Baris dokumen lain tidak boleh tersentuh.');
    }

    public function test_item_fill_discards_posted_account_columns_sent_by_a_client(): void {
        $method = new ReflectionMethod(DeliveryNoteService::class, 'fillItemRelations');
        $result = $method->invoke(new DeliveryNoteService, [
            'posted_account_id'       => 'client-account',
            'posted_stock_account_id' => 'client-stock-account',
            'item'                    => ['id' => $this->variant->id],
            'unit'                    => ['id' => null],
        ]);

        $this->assertNull($result['posted_account_id']);
        $this->assertNull($result['posted_stock_account_id']);
    }

    public function test_retry_of_a_return_uses_original_line_values_instead_of_zero(): void {
        Event::fake([DeliveryNoteGeneralLedgerPostingRequested::class]);

        $original = $this->makeNote();
        $origLine = $this->addItem($original, [['rate' => 100, 'quantity' => 3]]);
        $return   = $this->makeNote($original);
        $this->addItem($return, [], $origLine);
        $status = GlPostingStatus::create([
            'referenceable_type' => DeliveryNote::class,
            'referenceable_id'   => $return->id,
            'status'             => FormStatus::FAILED,
            'retry_count'        => 2,
            'last_error'         => 'gagal',
        ]);

        $this->retry($status)->assertRedirect();

        Event::assertDispatched(
            DeliveryNoteGeneralLedgerPostingRequested::class,
            fn ($e) => $e->isReturn === true && abs($e->totalPicked - 300) < 0.001,
        );
    }

    public function test_retry_of_a_return_posts_a_journal_and_writes_back_accounts(): void {
        $original = $this->makeNote();
        $origLine = $this->addItem($original, [['rate' => 100, 'quantity' => 3]]);
        $return   = $this->makeNote($original);
        $retLine  = $this->addItem($return, [], $origLine);
        $status   = GlPostingStatus::create([
            'referenceable_type' => DeliveryNote::class,
            'referenceable_id'   => $return->id,
            'status'             => FormStatus::FAILED,
            'retry_count'        => 1,
            'last_error'         => 'gagal',
        ]);

        $this->retry($status)->assertRedirect();

        $this->assertLedger($return, [
            ['account' => $this->stock, 'against' => $this->cogs, 'debit' => 300, 'credit' => 0],
            ['account' => $this->cogs, 'against' => $this->stock, 'debit' => 0, 'credit' => 300],
        ]);
        $this->assertPostingStatus($return, 'posted');
        $this->assertSame($this->cogs->id, $retLine->fresh()->posted_account_id);
        $this->assertSame($this->stock->id, $retLine->fresh()->posted_stock_account_id);
    }

    public function test_retry_of_a_forward_delivery_posts_and_writes_back_accounts(): void {
        $note   = $this->makeNote();
        $line   = $this->addItem($note, [['rate' => 50, 'quantity' => 4]]);
        $status = GlPostingStatus::create([
            'referenceable_type' => DeliveryNote::class,
            'referenceable_id'   => $note->id,
            'status'             => FormStatus::FAILED,
        ]);

        $this->retry($status)->assertRedirect();

        $this->assertLedger($note, [
            ['account' => $this->cogs, 'against' => $this->stock, 'debit' => 200, 'credit' => 0],
            ['account' => $this->stock, 'against' => $this->cogs, 'debit' => 0, 'credit' => 200],
        ]);
        $this->assertSame($this->cogs->id, $line->fresh()->posted_account_id);
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
}
