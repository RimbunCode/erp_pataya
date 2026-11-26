<?php

namespace Tests\Feature\Finances\Posting;

use App\Events\Sales\Order\DocumentDeliveryStatusRecalculationRequested;
use App\Models\Core\GlPostingStatus;
use App\Models\Finances\Account;
use App\Models\Finances\PostingProfile;
use App\Models\Finances\PostingProfileRule;
use App\Models\Inventory\DeliveryNote;
use App\Models\Inventory\DeliveryNoteItem;
use App\Models\Inventory\Item;
use App\Models\Inventory\ItemUnit;
use App\Models\Inventory\ItemVariant;
use App\Models\Inventory\Stock;
use App\Models\Inventory\StockLedgerEntry;
use App\Models\Inventory\Unit;
use App\Models\Inventory\Warehouse;
use App\Services\Inventory\DeliveryNoteService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Tests\Support\BuildsFinanceFixtures;
use Tests\Support\EnablesEnginePosting;
use Tests\TestCase;

/**
 * Finance Fase 2, Task 12.1 bagian B untuk Delivery Note: uji yang memanggil `DeliveryNoteService::onApproved` sungguhan
 * (nilai per baris dari pengambilan stok, jurnal lewat listener, catatan akun per baris), aturan profil bersyarat
 * per kategori barang (Requirement 12.4), dan amend yang mengosongkan kolom akun pada baris draft baru.
 */
class DeliveryNoteApprovalWritebackTest extends TestCase {
    use BuildsFinanceFixtures, EnablesEnginePosting, RefreshDatabase;

    private Account $stock;
    private Account $cogs;

    protected function setUp(): void {
        parent::setUp();

        $this->setUpFinanceFixtures([PostingProfile::class, DeliveryNote::class, GlPostingStatus::class, StockLedgerEntry::class, Unit::class, Warehouse::class, Item::class, ItemVariant::class]);
        $this->stock = $this->makeAccount('1300', 'Persediaan', 'asset', 'debit', 'stock');
        $this->cogs  = $this->makeAccount('5100', 'HPP', 'income', 'debit', 'cost_of_goods_sold');
        $this->enableEnginePosting(['cost_of_goods_sold' => $this->cogs, 'stock' => $this->stock]);
    }

    private function makeNote(string $code = 'DN-WB-1'): DeliveryNote {
        $warehouseId  = Warehouse::create(['branch_id' => $this->branch->id, 'name' => 'Gudang Sumber ' . $code, 'code' => 'WS-' . $code])->id;
        $permissionId = (string) Str::ulid();
        DB::table('permissions')->insert([
            'id'         => $permissionId, 'module' => 'inventory', 'name' => 'delivery_note_wb_' . Str::random(6), 'model' => DeliveryNote::class,
            'created_at' => now(), 'updated_at' => now(),
        ]);

        $id = (string) Str::ulid();
        DB::table('delivery_notes')->insert([
            'id'              => $id,
            'code'            => $code,
            'created_by_id'   => $this->user->id,
            'delivery_date'   => now()->subDay(),
            'reference_to_id' => $permissionId,
            // Dokumen sumber hanya perlu berupa model nyata (event status pengiriman mengetik `Model`); baris uji bebas
            // sumber sehingga isinya tidak dibaca. Gudang dipakai agar tidak perlu membangun Sales Order.
            'referenceable_type' => Warehouse::class,
            'referenceable_id'   => $warehouseId,
            'created_at'         => now(),
            'updated_at'         => now(),
        ]);

        return DeliveryNote::withoutEvents(fn () => DeliveryNote::findOrFail($id));
    }

    /**
     * Varian dengan stok awal satu batch (rate dan jumlah tertentu) di gudangnya.
     *
     * @return array{variant: ItemVariant, warehouse: Warehouse, itemUnit: ItemUnit}
     */
    private function makeStockedVariant(string $code, float $rate, float $quantity, ?string $categoryId = null): array {
        $fixture = $this->makeInventoryFixture($code);
        if ($categoryId !== null) {
            $fixture['variant']->update(['category_id' => $categoryId]);
        }
        Stock::create([
            'item_variant_id'   => $fixture['variant']->id,
            'warehouse_id'      => $fixture['warehouse']->id,
            'conversion_factor' => 1,
            'item_unit_id'      => $fixture['itemUnit']->id,
            'quantity'          => $quantity,
            'stock_queue'       => [['rate' => $rate, 'quantity' => $quantity, 'is_valuated' => true, 'sle_id' => null]],
        ]);

        return $fixture;
    }

    /** Baris bebas (tanpa sumber SO/IO) sehingga tidak butuh fixture Sales Order. */
    private function addFreeLine(DeliveryNote $note, array $fixture, float $quantity): DeliveryNoteItem {
        $id = (string) Str::ulid();
        DB::table('delivery_note_items')->insert([
            'id'                  => $id,
            'delivery_note_id'    => $note->id,
            'item_id'             => $fixture['variant']->id,
            'item_unit_id'        => $fixture['itemUnit']->id,
            'source_warehouse_id' => $fixture['warehouse']->id,
            'quantity'            => $quantity,
            'conversion_factor'   => 1,
            'valuation_rates'     => json_encode([]),
            'created_at'          => now(),
            'updated_at'          => now(),
        ]);

        return DeliveryNoteItem::findOrFail($id);
    }

    private function makeCategory(): string {
        $id = (string) Str::ulid();
        DB::table('categories')->insert(['id' => $id, 'name' => 'Kategori ' . Str::random(4), 'created_at' => now(), 'updated_at' => now()]);

        return $id;
    }

    public function test_on_approved_posts_per_line_journal_and_writes_back_accounts(): void {
        Event::fake([DocumentDeliveryStatusRecalculationRequested::class]);

        $first  = $this->makeStockedVariant('DN-E2E-A', 100, 10);
        $second = $this->makeStockedVariant('DN-E2E-B', 50, 10);
        $note   = $this->makeNote();
        $line1  = $this->addFreeLine($note, $first, 2);
        $line2  = $this->addFreeLine($note, $second, 3);

        (new DeliveryNoteService)->onApproved($note);

        // 2 x 100 + 3 x 50 = 350
        $this->assertSame([['rate' => 100.0, 'quantity' => 2.0]], array_map(fn ($r) => ['rate' => (float) $r['rate'], 'quantity' => (float) $r['quantity']], $line1->fresh()->valuation_rates));
        $this->assertLedger($note, [
            ['account' => $this->cogs, 'against' => $this->stock, 'debit' => 350, 'credit' => 0],
            ['account' => $this->stock, 'against' => $this->cogs, 'debit' => 0, 'credit' => 350],
        ]);
        $this->assertPostingStatus($note, 'posted');
        foreach ([$line1, $line2] as $line) {
            $this->assertSame($this->cogs->id, $line->fresh()->posted_account_id);
            $this->assertSame($this->stock->id, $line->fresh()->posted_stock_account_id);
        }
    }

    public function test_conditional_profile_rules_split_cogs_and_stock_per_item_category(): void {
        Event::fake([DocumentDeliveryStatusRecalculationRequested::class]);

        $categoryId = $this->makeCategory();
        $special    = $this->makeStockedVariant('DN-CAT-A', 100, 10, $categoryId);
        $plain      = $this->makeStockedVariant('DN-CAT-B', 50, 10);
        $note       = $this->makeNote();
        $line1      = $this->addFreeLine($note, $special, 2);
        $line2      = $this->addFreeLine($note, $plain, 3);

        $specialCogs  = $this->makeAccount('5110', 'HPP Khusus', 'income', 'debit', 'cost_of_goods_sold');
        $specialStock = $this->makeAccount('1310', 'Persediaan Khusus', 'asset', 'debit', 'stock');
        $profileId    = PostingProfile::query()->sole()->id;
        foreach (['cost_of_goods_sold' => $specialCogs, 'stock' => $specialStock] as $role => $account) {
            PostingProfileRule::forceCreate([
                'posting_profile_id' => $profileId,
                'role'               => $role,
                'account_id'         => $account->id,
                'item_category_id'   => $categoryId,
                'priority'           => 10,
            ]);
        }

        (new DeliveryNoteService)->onApproved($note);

        $this->assertSame($specialCogs->id, $line1->fresh()->posted_account_id);
        $this->assertSame($specialStock->id, $line1->fresh()->posted_stock_account_id);
        $this->assertSame($this->cogs->id, $line2->fresh()->posted_account_id);
        $this->assertSame($this->stock->id, $line2->fresh()->posted_stock_account_id);

        $ledger = $this->ledgerOf($note);
        $this->assertCount(4, $ledger);
        $this->assertEqualsWithDelta(200, $ledger->where('account_id', $specialCogs->id)->sum('debit'), 0.01);
        $this->assertEqualsWithDelta(150, $ledger->where('account_id', $this->cogs->id)->sum('debit'), 0.01);
        $this->assertEqualsWithDelta(200, $ledger->where('account_id', $specialStock->id)->sum('credit'), 0.01);
        $this->assertEqualsWithDelta(150, $ledger->where('account_id', $this->stock->id)->sum('credit'), 0.01);
    }

    /**
     * Pastikan penolakan approve tidak meninggalkan efek samping apa pun.
     */
    private function assertNoApprovalSideEffects(DeliveryNote $note, array $stockedFixtures, float $stockQuantity, mixed $statusBefore): void {
        foreach ($stockedFixtures as $fixture) {
            $this->assertEqualsWithDelta($stockQuantity, (float) Stock::where('item_variant_id', $fixture['variant']->id)->value('quantity'), 0.0001);
        }
        $this->assertSame(0, StockLedgerEntry::count());
        $this->assertSame(0, GlPostingStatus::count());
        $this->assertSame([], DeliveryNoteItem::where('delivery_note_id', $note->id)->whereNotNull('posted_account_id')->pluck('id')->all());
        $this->assertSame($statusBefore, $note->fresh()->status, 'Status dokumen kembali seperti semula (rollback).');
    }

    public function test_forward_delivery_with_insufficient_stock_is_rejected_without_side_effects(): void {
        Event::fake([DocumentDeliveryStatusRecalculationRequested::class]);

        $enough = $this->makeStockedVariant('DN-OK', 100, 10);
        $short  = $this->makeStockedVariant('DN-SHORT', 50, 1);
        $note   = $this->makeNote();
        $this->addFreeLine($note, $enough, 2);
        $this->addFreeLine($note, $short, 5);
        $statusBefore = $note->status;

        try {
            (new DeliveryNoteService)->onApproved($note);
            $this->fail('Diharapkan ValidationException.');
        } catch (ValidationException $e) {
            $this->assertCount(1, $e->errors()['items']);
            $this->assertStringContainsString('DN-SHORT', $e->errors()['items'][0]);
        }

        // Baris yang stoknya cukup juga tidak boleh ikut berkurang.
        $this->assertEqualsWithDelta(10, (float) Stock::where('item_variant_id', $enough['variant']->id)->value('quantity'), 0.0001);
        $this->assertEqualsWithDelta(1, (float) Stock::where('item_variant_id', $short['variant']->id)->value('quantity'), 0.0001);
        $this->assertSame(0, StockLedgerEntry::count());
        $this->assertSame(0, GlPostingStatus::count());
        $this->assertSame($statusBefore, $note->fresh()->status);
        Event::assertNotDispatched(DocumentDeliveryStatusRecalculationRequested::class);
    }

    public function test_forward_delivery_without_stock_row_in_warehouse_is_rejected(): void {
        Event::fake([DocumentDeliveryStatusRecalculationRequested::class]);

        $fixture = $this->makeInventoryFixture('DN-NOSTOCK');
        $note    = $this->makeNote();
        $this->addFreeLine($note, $fixture, 1);

        try {
            (new DeliveryNoteService)->onApproved($note);
            $this->fail('Diharapkan ValidationException.');
        } catch (ValidationException $e) {
            $this->assertStringContainsString('is not in', $e->errors()['items'][0]);
        }

        $this->assertSame(0, StockLedgerEntry::count());
        $this->assertSame(0, GlPostingStatus::count());
        Event::assertNotDispatched(DocumentDeliveryStatusRecalculationRequested::class);
    }

    public function test_all_failing_lines_are_reported_together_including_lines_sharing_one_stock(): void {
        Event::fake([DocumentDeliveryStatusRecalculationRequested::class]);

        $shared  = $this->makeStockedVariant('DN-SHARED', 10, 5);
        $missing = $this->makeInventoryFixture('DN-MISSING');
        $note    = $this->makeNote();
        $this->addFreeLine($note, $shared, 3);
        $this->addFreeLine($note, $shared, 3); // sendiri cukup, bersama 6 > 5
        $this->addFreeLine($note, $missing, 1);
        $statusBefore = $note->status;

        try {
            (new DeliveryNoteService)->onApproved($note);
            $this->fail('Diharapkan ValidationException.');
        } catch (ValidationException $e) {
            $this->assertCount(2, $e->errors()['items']);
        }

        $this->assertNoApprovalSideEffects($note, [$shared], 5, $statusBefore);
    }

    public function test_return_into_warehouse_with_zero_stock_succeeds_and_posts_a_journal(): void {
        Event::fake([DocumentDeliveryStatusRecalculationRequested::class]);

        $fixture  = $this->makeStockedVariant('DN-RET0', 100, 0);
        $original = $this->makeNote('DN-RET0-O');
        $origLine = $this->addFreeLine($original, $fixture, 2);
        $origLine->forceFill(['valuation_rates' => [['rate' => 100, 'quantity' => 2]]])->save();

        $return = $this->makeNote('DN-RET0-R');
        DB::table('delivery_notes')->where('id', $return->id)->update(['return_against_id' => $original->id]);
        $returnLine = $this->addFreeLine($return, $fixture, 2);
        DB::table('delivery_note_items')->where('id', $returnLine->id)->update(['return_against_item_id' => $origLine->id]);

        (new DeliveryNoteService)->onApproved($return->fresh());

        $this->assertEqualsWithDelta(2, (float) Stock::where('item_variant_id', $fixture['variant']->id)->value('quantity'), 0.0001);
        $this->assertSame(1, StockLedgerEntry::count());
        $this->assertLedger($return, [
            ['account' => $this->stock, 'against' => $this->cogs, 'debit' => 200, 'credit' => 0],
            ['account' => $this->cogs, 'against' => $this->stock, 'debit' => 0, 'credit' => 200],
        ]);
        $this->assertPostingStatus($return, 'posted');
    }

    public function test_return_without_stock_row_is_still_rejected_without_side_effects(): void {
        Event::fake([DocumentDeliveryStatusRecalculationRequested::class]);

        $fixture  = $this->makeInventoryFixture('DN-RETNO');
        $original = $this->makeNote('DN-RETNO-O');
        $origLine = $this->addFreeLine($original, $fixture, 1);
        $origLine->forceFill(['valuation_rates' => [['rate' => 100, 'quantity' => 1]]])->save();

        $return = $this->makeNote('DN-RETNO-R');
        DB::table('delivery_notes')->where('id', $return->id)->update(['return_against_id' => $original->id]);
        $returnLine = $this->addFreeLine($return, $fixture, 1);
        DB::table('delivery_note_items')->where('id', $returnLine->id)->update(['return_against_item_id' => $origLine->id]);

        $this->expectException(ValidationException::class);
        try {
            (new DeliveryNoteService)->onApproved($return->fresh());
        } finally {
            $this->assertSame(0, StockLedgerEntry::count());
            $this->assertSame(0, GlPostingStatus::count());
        }
    }

    public function test_amend_leaves_both_posted_account_columns_of_the_new_draft_lines_empty(): void {
        $fixture = $this->makeInventoryFixture('DN-AMD');
        $note    = $this->makeNote('DN-AMD-1');
        $line    = $this->addFreeLine($note, $fixture, 1);
        $line->forceFill(['posted_account_id' => $this->cogs->id, 'posted_stock_account_id' => $this->stock->id])->save();

        $amended = $note->fresh()->amend();

        $this->assertNotSame($note->id, $amended->id);
        $this->assertSame($this->cogs->id, $line->fresh()->posted_account_id, 'Dokumen asal tidak berubah.');
        $this->assertSame($this->stock->id, $line->fresh()->posted_stock_account_id);
        $newLines = DeliveryNoteItem::query()->where('delivery_note_id', $amended->id)->get();
        $this->assertCount(1, $newLines);
        $this->assertNull($newLines->first()->posted_account_id);
        $this->assertNull($newLines->first()->posted_stock_account_id);
    }
}
