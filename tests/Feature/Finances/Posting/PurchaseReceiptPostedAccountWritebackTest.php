<?php

namespace Tests\Feature\Finances\Posting;

use App\Enums\FormStatus;
use App\Enums\PostingDocumentType;
use App\Events\Purchase\PurchaseReceiptGeneralLedgerPostingRequested;
use App\Http\Controllers\Core\GlPostingStatusController;
use App\Listeners\Purchase\Ledger\PostPurchaseReceiptGeneralLedger;
use App\Models\Core\GlPostingStatus;
use App\Models\Finances\Account;
use App\Models\Finances\Journal;
use App\Models\Finances\PostingProfile;
use App\Models\Finances\PostingProfileRule;
use App\Models\Inventory\Item;
use App\Models\Inventory\ItemVariant;
use App\Models\Inventory\Unit;
use App\Models\Inventory\Warehouse;
use App\Models\Purchase\PurchaseReceipt;
use App\Models\Purchase\PurchaseReceiptItem;
use App\Services\Finances\Posting\Contexts\LineAttributes;
use App\Services\Finances\Posting\Contexts\PostingContext;
use App\Services\Finances\Posting\PostedAccountNote;
use App\Services\Finances\Posting\PostedAccountNotes;
use App\Services\Finances\Posting\PostedAccountRecorderRegistry;
use App\Services\Purchase\Accounting\PurchaseReceiptPostedAccountRecorder;
use App\Services\Purchase\PurchaseReceiptService;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Tests\Support\BuildsFinanceFixtures;
use Tests\Support\EnablesEnginePosting;
use Tests\TestCase;

/**
 * Finance Fase 2, Task 12.1 bagian B (Requirement 13.2) untuk Purchase Receipt: akun `stock` per baris yang dipakai
 * engine ditulis balik ke `purchase_receipt_items.posted_account_id`, tanpa mengubah total dan bentuk jurnal.
 */
class PurchaseReceiptPostedAccountWritebackTest extends TestCase {
    use BuildsFinanceFixtures, EnablesEnginePosting, RefreshDatabase;

    private Account $stock;
    private Account $srnb;

    protected function setUp(): void {
        parent::setUp();

        $this->setUpFinanceFixtures([PostingProfile::class, PurchaseReceipt::class, Unit::class, Warehouse::class, Item::class, ItemVariant::class]);
        $this->stock = $this->makeAccount('1300', 'Persediaan', 'asset', 'debit', 'stock');
        $this->srnb  = $this->makeAccount('2100', 'SRNB', 'liability', 'credit', 'stock_received_but_not_billed');
        $this->enableEnginePosting(['stock' => $this->stock, 'stock_received_but_not_billed' => $this->srnb]);
    }

    /**
     * @return array{0: PurchaseReceipt, 1: PurchaseReceiptItem, 2: PurchaseReceiptItem}
     */
    private function makeReceiptWithTwoLines(string $code = 'PR-WB-1'): array {
        $inventory = $this->makeInventoryFixture($code);
        $id        = (string) Str::ulid();
        DB::table('purchase_receipts')->insert(['id' => $id, 'code' => 'PR-' . Str::upper(Str::random(8)), 'created_by_id' => $this->user->id, 'date' => now()->subDays(2), 'created_at' => now(), 'updated_at' => now()]);
        $receipt = PurchaseReceipt::withoutEvents(fn () => PurchaseReceipt::find($id));

        $lines = [];
        foreach ([1, 2] as $n) {
            $lines[] = PurchaseReceiptItem::withoutEvents(fn () => PurchaseReceiptItem::create([
                'purchase_receipt_id' => $receipt->id,
                'item_id'             => $inventory['variant']->id,
                'item_unit_id'        => $inventory['itemUnit']->id,
                'target_warehouse_id' => $inventory['warehouse']->id,
                'conversion_factor'   => 1,
                'quantity'            => $n,
            ]));
        }

        return [$receipt, $lines[0], $lines[1]];
    }

    private function postReceipt(PurchaseReceipt $receipt, float $total, bool $isReturn, array $lineAmounts): void {
        GlPostingStatus::create([
            'referenceable_type' => PurchaseReceipt::class,
            'referenceable_id'   => $receipt->id,
            'status'             => FormStatus::PENDING,
        ]);

        (new PostPurchaseReceiptGeneralLedger)->handle(new PurchaseReceiptGeneralLedgerPostingRequested($receipt, $total, $isReturn, now(), $lineAmounts));
    }

    public function test_posting_writes_back_stock_account_per_line_and_keeps_the_journal_unchanged(): void {
        [$receipt, $first, $second] = $this->makeReceiptWithTwoLines();

        $this->postReceipt($receipt, 1200, false, [$first->id => 500.0, $second->id => 700.0]);

        $this->assertSame($this->stock->id, $first->fresh()->posted_account_id);
        $this->assertSame($this->stock->id, $second->fresh()->posted_account_id);
        $this->assertLedger($receipt, [
            ['account' => $this->stock, 'against' => $this->srnb, 'debit' => 1200, 'credit' => 0],
            ['account' => $this->srnb, 'against' => $this->stock, 'debit' => 0, 'credit' => 1200],
        ]);
    }

    public function test_return_swaps_the_sides_but_still_records_the_stock_account(): void {
        [$receipt, $first, $second] = $this->makeReceiptWithTwoLines();

        $this->postReceipt($receipt, 400, true, [$first->id => 150.0, $second->id => 250.0]);

        $this->assertSame($this->stock->id, $first->fresh()->posted_account_id);
        $this->assertSame($this->stock->id, $second->fresh()->posted_account_id);
        $this->assertLedger($receipt, [
            ['account' => $this->srnb, 'against' => $this->stock, 'debit' => 400, 'credit' => 0],
            ['account' => $this->stock, 'against' => $this->srnb, 'debit' => 0, 'credit' => 400],
        ]);
    }

    public function test_without_line_amounts_the_journal_is_document_level_and_no_account_is_recorded(): void {
        [$receipt, $first] = $this->makeReceiptWithTwoLines();

        $this->postReceipt($receipt, 1200, false, []);

        $this->assertNull($first->fresh()->posted_account_id);
        $this->assertLedger($receipt, [
            ['account' => $this->stock, 'against' => $this->srnb, 'debit' => 1200, 'credit' => 0],
            ['account' => $this->srnb, 'against' => $this->stock, 'debit' => 0, 'credit' => 1200],
        ]);
    }

    public function test_line_amounts_that_do_not_sum_to_the_total_fall_back_to_the_document_level_journal(): void {
        [$receipt, $first, $second] = $this->makeReceiptWithTwoLines();

        $this->postReceipt($receipt, 1200, false, [$first->id => 100.0, $second->id => 200.0]);

        $this->assertNull($first->fresh()->posted_account_id);
        $this->assertNull($second->fresh()->posted_account_id);
        $this->assertLedger($receipt, [
            ['account' => $this->stock, 'against' => $this->srnb, 'debit' => 1200, 'credit' => 0],
            ['account' => $this->srnb, 'against' => $this->stock, 'debit' => 0, 'credit' => 1200],
        ]);
        $this->assertSame(1, Journal::query()->count());
    }

    public function test_zero_valued_lines_are_not_recorded(): void {
        [$receipt, $first, $second] = $this->makeReceiptWithTwoLines();

        $this->postReceipt($receipt, 700, false, [$first->id => 0.0, $second->id => 700.0]);

        $this->assertNull($first->fresh()->posted_account_id);
        $this->assertSame($this->stock->id, $second->fresh()->posted_account_id);
    }

    public function test_recorder_writes_diverse_accounts_and_only_touches_its_own_document(): void {
        [$receipt, $first, $second] = $this->makeReceiptWithTwoLines('PR-WB-A');
        [, $foreignFirst]           = $this->makeReceiptWithTwoLines('PR-WB-B');
        $other                      = $this->makeAccount('1310', 'Persediaan Lain', 'asset', 'debit', 'stock');

        $ctx = new PostingContext(PostingDocumentType::PurchaseReceipt, PurchaseReceipt::class, (string) $receipt->id, CarbonImmutable::now(), null, ['total' => 1.0], [], [], [new LineAttributes(lineId: (string) $first->id), new LineAttributes(lineId: (string) $second->id)]);
        (new PurchaseReceiptPostedAccountRecorder)->record($ctx, new PostedAccountNotes([
            new PostedAccountNote('default', 'stock', $this->stock->id, (string) $first->id),
            new PostedAccountNote('default', 'stock', $other->id, (string) $second->id),
            new PostedAccountNote('default', 'stock', $other->id, (string) $foreignFirst->id),
            new PostedAccountNote('default', 'stock_received_but_not_billed', $this->srnb->id),
        ]));

        $this->assertSame($this->stock->id, $first->fresh()->posted_account_id);
        $this->assertSame($other->id, $second->fresh()->posted_account_id);
        $this->assertNull($foreignFirst->fresh()->posted_account_id, 'Baris milik Purchase Receipt lain tidak tersentuh.');
    }

    public function test_recorder_is_registered_in_the_default_map_for_purchase_receipt(): void {
        $this->assertSame(PurchaseReceiptPostedAccountRecorder::class, PostedAccountRecorderRegistry::DEFAULT_MAP['purchase_receipt'] ?? null);
    }

    public function test_item_posted_account_id_from_a_client_is_discarded_by_fill_item_relations(): void {
        $inventory = $this->makeInventoryFixture('PR-WB-C');
        $account   = $this->makeAccount('5900', 'Akun Sembarang', 'expense', 'debit');
        $unit      = (object) ['conversion_factor' => 1];

        $method = new \ReflectionMethod(PurchaseReceiptService::class, 'fillItemRelations');
        $result = $method->invoke(new PurchaseReceiptService, [
            'item'              => ['id' => $inventory['variant']->id],
            'unit'              => ['id' => $inventory['itemUnit']->id],
            'target_warehouse'  => ['id' => $inventory['warehouse']->id],
            'posted_account_id' => $account->id,
        ], [$inventory['itemUnit']->id => $unit]);

        $this->assertNull($result['posted_account_id']);
    }

    /**
     * Receipt dua baris (qty 1 dan 2) yang masing-masing terhubung ke PO Item ber-rate 100 dan 250 dan sudah mencatat `gl_value` (100 dan 500).
     *
     * @return array{0: PurchaseReceipt, 1: PurchaseReceiptItem, 2: PurchaseReceiptItem}
     */
    private function makeReceiptWithPoItems(string $code = 'PR-WB-PO'): array {
        [$receipt, $first, $second] = $this->makeReceiptWithTwoLines($code);

        $poId = (string) Str::ulid();
        DB::table('purchase_orders')->insert(['id' => $poId, 'date' => now(), 'created_at' => now(), 'updated_at' => now()]);
        foreach ([[$first, 100], [$second, 250]] as [$line, $rate]) {
            $poItemId = (string) Str::ulid();
            DB::table('purchase_order_items')->insert([
                'id'       => $poItemId, 'purchase_order_id' => $poId, 'item_id' => $line->item_id,
                'quantity' => 10, 'rate' => $rate, 'created_at' => now(), 'updated_at' => now(),
            ]);
            // Nilai GL per baris yang dicatat saat approve; retry memakainya apa adanya (Task 12.1 bagian B).
            DB::table('purchase_receipt_items')->where('id', $line->id)->update([
                'purchase_order_item_id' => $poItemId,
                'gl_value'               => (float) $line->quantity * $rate,
            ]);
        }

        return [$receipt, PurchaseReceiptItem::findOrFail($first->id), PurchaseReceiptItem::findOrFail($second->id)];
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

    public function test_retry_event_carries_line_amounts_consistent_with_the_total(): void {
        [$receipt, $first, $second] = $this->makeReceiptWithPoItems();
        $status                     = GlPostingStatus::create([
            'referenceable_type' => PurchaseReceipt::class,
            'referenceable_id'   => $receipt->id,
            'status'             => FormStatus::FAILED,
        ]);

        $method = new \ReflectionMethod(GlPostingStatusController::class, 'resolveRetryEvent');
        $event  = $method->invoke((new \ReflectionClass(GlPostingStatusController::class))->newInstanceWithoutConstructor(), $status);

        $this->assertInstanceOf(PurchaseReceiptGeneralLedgerPostingRequested::class, $event);
        $this->assertCount(2, $event->lineAmounts);
        $this->assertEqualsWithDelta(100.0, $event->lineAmounts[$first->id], 0.0001);
        $this->assertEqualsWithDelta(500.0, $event->lineAmounts[$second->id], 0.0001);
        $this->assertEqualsWithDelta(600.0, $event->totalRatesForGL, 0.0001);
    }

    public function test_retry_route_posts_the_journal_and_writes_back_the_account_per_line(): void {
        [$receipt, $first, $second] = $this->makeReceiptWithPoItems();
        $status                     = GlPostingStatus::create([
            'referenceable_type' => PurchaseReceipt::class,
            'referenceable_id'   => $receipt->id,
            'status'             => FormStatus::FAILED,
            'retry_count'        => 1,
            'last_error'         => 'gagal',
        ]);

        $this->retry($status)->assertRedirect();

        $this->assertLedger($receipt, [
            ['account' => $this->stock, 'against' => $this->srnb, 'debit' => 600, 'credit' => 0],
            ['account' => $this->srnb, 'against' => $this->stock, 'debit' => 0, 'credit' => 600],
        ]);
        $this->assertPostingStatus($receipt, 'posted');
        $this->assertSame($this->stock->id, $first->fresh()->posted_account_id);
        $this->assertSame($this->stock->id, $second->fresh()->posted_account_id);
    }

    public function test_conditional_profile_rule_splits_the_stock_journal_per_item_category(): void {
        [$receipt, $first, $second] = $this->makeReceiptWithTwoLines('PR-WB-CAT');
        $categoryId                 = (string) Str::ulid();
        DB::table('categories')->insert(['id' => $categoryId, 'name' => 'Kategori Khusus', 'created_at' => now(), 'updated_at' => now()]);
        ItemVariant::query()->whereKey($first->item_id)->update(['category_id' => $categoryId]);
        // Kedua baris memakai varian yang sama dari fixture; pindahkan baris kedua ke varian tanpa kategori.
        $plain = $this->makeInventoryFixture('PR-WB-PLAIN');
        DB::table('purchase_receipt_items')->where('id', $second->id)->update(['item_id' => $plain['variant']->id]);

        $special = $this->makeAccount('1320', 'Persediaan Khusus', 'asset', 'debit', 'stock');
        PostingProfileRule::forceCreate([
            'posting_profile_id' => PostingProfile::query()->sole()->id,
            'role'               => 'stock',
            'account_id'         => $special->id,
            'item_category_id'   => $categoryId,
            'priority'           => 10,
        ]);

        $this->postReceipt($receipt, 1200, false, [$first->id => 500.0, $second->id => 700.0]);

        $this->assertSame($special->id, $first->fresh()->posted_account_id);
        $this->assertSame($this->stock->id, $second->fresh()->posted_account_id);
        $ledger = $this->ledgerOf($receipt);
        $this->assertCount(3, $ledger);
        $this->assertEqualsWithDelta(500, $ledger->where('account_id', $special->id)->sum('debit'), 0.01);
        $this->assertEqualsWithDelta(700, $ledger->where('account_id', $this->stock->id)->sum('debit'), 0.01);
        $this->assertEqualsWithDelta(1200, $ledger->where('account_id', $this->srnb->id)->sum('credit'), 0.01);
    }

    public function test_amend_leaves_the_posted_account_of_the_new_draft_lines_empty(): void {
        [$receipt, $first] = $this->makeReceiptWithTwoLines('PR-WB-AMD');
        $first->forceFill(['posted_account_id' => $this->stock->id])->save();
        $receipt->update(['code' => 'PR-AMD-1']);

        $amended = $receipt->fresh()->amend();

        $this->assertNotSame($receipt->id, $amended->id);
        $this->assertSame($this->stock->id, $first->fresh()->posted_account_id, 'Dokumen asal tidak berubah.');
        $newLines = PurchaseReceiptItem::query()->where('purchase_receipt_id', $amended->id)->get();
        $this->assertCount(2, $newLines);
        $this->assertSame([null, null], $newLines->pluck('posted_account_id')->all());
    }
}
