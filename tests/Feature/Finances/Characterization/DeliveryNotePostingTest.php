<?php

namespace Tests\Feature\Finances\Characterization;

use App\Enums\FormStatus;
use App\Events\Inventory\DeliveryNoteGeneralLedgerPostingRequested;
use App\Listeners\Inventory\Ledger\PostDeliveryNoteGeneralLedger;
use App\Models\Core\GlPostingStatus;
use App\Models\Finances\Account;
use App\Models\Finances\PostingProfile;
use App\Models\Inventory\DeliveryNote;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Support\BuildsFinanceFixtures;
use Tests\Support\EnablesEnginePosting;
use Tests\TestCase;

/**
 * Characterization Fase 0 (titik posting #4, Lampiran B PRD): Delivery Note.
 *
 * Dikunci di batas event: `totalPicked` adalah keluaran pengambilan stok FIFO (`DeliveryNoteService::onApproved`),
 * di luar refactor posting Fase 2. Jalur rental (`PostAssetDisposalGainLoss`) dicakup di test aset (task 5.6).
 */
class DeliveryNotePostingTest extends TestCase {
    use BuildsFinanceFixtures, EnablesEnginePosting, RefreshDatabase;

    private Account $stock;
    private Account $cogs;

    protected function setUp(): void {
        parent::setUp();

        $this->setUpFinanceFixtures([PostingProfile::class]);
        $this->stock = $this->makeAccount('1300', 'Persediaan', 'asset', 'debit', 'stock');
        $this->cogs  = $this->makeAccount('5100', 'HPP', 'income', 'debit', 'cost_of_goods_sold');

        // Task 14.1: closure legacy dihapus; jurnal ditulis engine dengan akun dari profil (ekspektasi ledger tidak berubah).
        $this->enableEnginePosting(['cost_of_goods_sold' => $this->cogs, 'stock' => $this->stock]);
    }

    private function makeDeliveryNote(): DeliveryNote {
        $permissionId = (string) Str::ulid();
        DB::table('permissions')->insert([
            'id'         => $permissionId, 'module' => 'inventory', 'name' => 'delivery_note_char', 'model' => DeliveryNote::class,
            'created_at' => now(), 'updated_at' => now(),
        ]);

        $id = (string) Str::ulid();
        DB::table('delivery_notes')->insert([
            'id'                 => $id,
            'delivery_date'      => now()->subDays(2),
            'reference_to_id'    => $permissionId,
            'referenceable_type' => 'App\\Models\\Sales\\SalesOrder',
            'referenceable_id'   => (string) Str::ulid(),
            'created_at'         => now(),
            'updated_at'         => now(),
        ]);

        return DeliveryNote::withoutEvents(fn () => DeliveryNote::find($id));
    }

    private function postLedger(DeliveryNote $note, float $total, bool $isReturn): void {
        GlPostingStatus::create([
            'referenceable_type' => DeliveryNote::class,
            'referenceable_id'   => $note->id,
            'status'             => FormStatus::PENDING,
        ]);

        (new PostDeliveryNoteGeneralLedger)->handle(new DeliveryNoteGeneralLedgerPostingRequested($note, $total, $isReturn, now()));
    }

    public function test_normal_delivery_debits_cogs_and_credits_stock(): void {
        $note = $this->makeDeliveryNote();
        $this->postLedger($note, 900, false);

        $this->assertLedger($note, [
            ['account' => $this->cogs, 'against' => $this->stock, 'debit' => 900, 'credit' => 0],
            ['account' => $this->stock, 'against' => $this->cogs, 'debit' => 0, 'credit' => 900],
        ], now()->toDateString());
        $this->assertPostingStatus($note, 'posted');
    }

    public function test_return_delivery_reverses_cogs_and_stock(): void {
        $note = $this->makeDeliveryNote();
        $this->postLedger($note, 300, true);

        $this->assertLedger($note, [
            ['account' => $this->stock, 'against' => $this->cogs, 'debit' => 300, 'credit' => 0],
            ['account' => $this->cogs, 'against' => $this->stock, 'debit' => 0, 'credit' => 300],
        ], now()->toDateString());
        $this->assertPostingStatus($note, 'posted');
    }

    public function test_cogs_account_comes_from_the_profile_not_from_root_type_and_latest_created(): void {
        // F-06 pada HPP diperbaiki Task 14.1: pencarian `root_type`/`account_type`/`latest()` sudah dihapus. Akun HPP
        // lain (root_type apa pun, lebih baru) tidak dipilih; peran `cost_of_goods_sold` dijawab profil.
        $this->makeAccount('5101', 'HPP (expense)', 'expense', 'debit', 'cost_of_goods_sold');
        $newCogs = $this->makeAccount('5102', 'HPP Baru', 'income', 'debit', 'cost_of_goods_sold');
        Account::whereKey($this->cogs->id)->update(['created_at' => now()->subDay()]);

        $note = $this->makeDeliveryNote();
        $this->postLedger($note, 10, false);

        $this->assertSame(0, $this->ledgerOf($note)->where('account_id', $newCogs->id)->count());
        $this->assertSame(1, $this->ledgerOf($note)->where('account_id', $this->cogs->id)->count());
    }
}
