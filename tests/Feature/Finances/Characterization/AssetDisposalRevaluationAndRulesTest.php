<?php

namespace Tests\Feature\Finances\Characterization;

use App\Enums\FormStatus;
use App\Events\Asset\AssetValueAdjustmentApproved;
use App\Listeners\Asset\Depreciation\PostValueAdjustmentEntry;
use App\Models\Asset\Asset;
use App\Models\Asset\AssetValueAdjustment;
use App\Models\Core\GlPostingStatus;
use App\Models\Finances\Account;
use App\Models\Finances\Journal;
use App\Models\Finances\PostingProfile;
use App\Models\Finances\SalesInvoice;
use App\Services\Finances\Posting\PostingProfileService;
use App\Services\Finances\SalesInvoiceService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\AssertsPostingParity;
use Tests\Support\BuildsAssetFixtures;
use Tests\Support\BuildsFinanceFixtures;
use Tests\Support\EnablesEnginePosting;
use Tests\TestCase;

/**
 * F1 (revaluasi/AVA ikut keluar saat aset terjual) dan F6 (akun `revenue` pelepasan = akun `revenue` jurnal Sales Invoice
 * walau ada aturan akun bersyarat `document_type = sales_invoice`). Keputusan pemilik produk 2026-11-26.
 *
 * F1: AVA terposting menambah `gross_purchase_amount` (PostValueAdjustmentEntry) sehingga `total_asset_cost` yang dipakai
 * jurnal pelepasan sudah memuat revaluasi bersih; tes ini mengunci bahwa akun aset tetap kembali nol.
 */
class AssetDisposalRevaluationAndRulesTest extends TestCase {
    use AssertsPostingParity, BuildsAssetFixtures, BuildsFinanceFixtures, EnablesEnginePosting, RefreshDatabase;

    private Account $revenue;
    private Account $receivable;
    private Account $revaluation;

    protected function setUp(): void {
        parent::setUp();

        $this->setUpFinanceFixtures([PostingProfile::class, SalesInvoice::class]);

        $this->receivable  = $this->makeAccount('1200', 'Piutang Usaha', 'asset', 'debit', 'accounts_receivable');
        $this->revenue     = $this->makeAccount('4100', 'Penjualan', 'income', 'credit', 'sales');
        $this->revaluation = $this->makeAccount('7200', 'Selisih Revaluasi', 'income', 'credit', 'revaluation_gain');
    }

    /**
     * Saldo bersih (debit - kredit) per nomor akun dari semua jurnal.
     *
     * @return array<string, float>
     */
    private function netBalances(): array {
        $accounts = Account::query()->withoutGlobalScopes()->pluck('account_number', 'id');
        $net      = [];
        foreach (Journal::query()->with('lines')->get() as $journal) {
            foreach ($journal->lines as $line) {
                $number       = (string) $accounts[$line->account_id];
                $net[$number] = round(($net[$number] ?? 0.0) + (float) $line->debit - (float) $line->credit, 2);
            }
        }
        ksort($net);

        return $net;
    }

    private function postRevaluation(Asset $asset, float $newValue): void {
        $adjustment = AssetValueAdjustment::factory()->create([
            'asset_id'              => $asset->id,
            'current_asset_value'   => $asset->bookValue(),
            'new_asset_value'       => $newValue,
            'difference_account_id' => null,
        ]);
        GlPostingStatus::create([
            'referenceable_type' => AssetValueAdjustment::class,
            'referenceable_id'   => $adjustment->id,
            'status'             => FormStatus::PENDING,
        ]);

        (new PostValueAdjustmentEntry)->handle(new AssetValueAdjustmentApproved($adjustment, now()));
    }

    public function test_revalued_asset_sold_in_full_leaves_the_fixed_asset_account_at_zero(): void {
        $this->enableEnginePosting(['receivable' => $this->receivable, 'revenue' => $this->revenue, 'asset_revaluation' => $this->revaluation]);
        ['asset' => $asset] = $this->makeAssetWithAccounts(['gross_purchase_amount' => 1000, 'opening_accumulated_depreciation' => 400]);

        // Nilai buku 600 -> 900: AVA +300 (Dr aset tetap, Cr revaluasi); perolehan efektif 1.300.
        $this->postRevaluation($asset, 900);
        $asset = $asset->fresh();
        $this->assertEqualsWithDelta(1300.0, (float) $asset->total_asset_cost, 0.001);

        $invoice = $this->makeSalesInvoice($this->receivable, $this->revenue, [], ['item_id' => null, 'asset_id' => $asset->id, 'quantity' => 1, 'price' => 1000, 'tax_rate' => 0]);
        app(SalesInvoiceService::class)->onApproved($invoice);

        $net = $this->netBalances();
        // Perolehan awal 1.000 (tidak diposting di fixture) + AVA 300 - pelepasan 1.300 = 0.
        $this->assertSame(0.0, round(1000.0 + $net['1500'], 2));
        $this->assertSame(-300.0, $net['7200']);
        $this->assertSame(0.0, round(array_sum($net), 2));
    }

    public function test_partial_sale_of_a_revalued_asset_removes_the_revaluation_proportionally(): void {
        $this->enableEnginePosting(['receivable' => $this->receivable, 'revenue' => $this->revenue, 'asset_revaluation' => $this->revaluation]);
        ['asset' => $asset] = $this->makeAssetWithAccounts(['gross_purchase_amount' => 1000, 'opening_accumulated_depreciation' => 400, 'asset_quantity' => 4, 'allow_bulk_quantity' => true]);

        $this->postRevaluation($asset, 1000); // +400: perolehan efektif 1.400
        $asset = $asset->fresh();

        $invoice = $this->makeSalesInvoice($this->receivable, $this->revenue, [], ['item_id' => null, 'asset_id' => $asset->id, 'quantity' => 2, 'price' => 500, 'tax_rate' => 0]);
        app(SalesInvoiceService::class)->onApproved($invoice);

        // Dua dari empat unit: perolehan 700 keluar (setengah dari 1.400); sisa aset tetap 1.000 + 400 - 700 = 700.
        $this->assertSame(700.0, round(1000.0 + $this->netBalances()['1500'], 2));
    }

    public function test_sales_invoice_scoped_revenue_rule_gives_the_same_revenue_account_in_the_invoice_and_the_disposal(): void {
        $special  = $this->makeAccount('4150', 'Penjualan Khusus SI', 'income', 'credit');
        $profiles = app(PostingProfileService::class);
        $profiles->activate($profiles->createDraft('Profil uji', '2020-01-01', null, [
            'receivable' => $this->receivable->id,
            'revenue'    => $this->revenue->id,
        ], [
            ['role' => 'revenue', 'account_id' => $special->id, 'document_type' => 'sales_invoice'],
        ]));
        ['asset' => $asset] = $this->makeAssetWithAccounts(['gross_purchase_amount' => 1000, 'opening_accumulated_depreciation' => 400]);

        $invoice = $this->makeSalesInvoice($this->receivable, $this->revenue, [], ['item_id' => null, 'asset_id' => $asset->id, 'quantity' => 1, 'price' => 700, 'tax_rate' => 0]);
        app(SalesInvoiceService::class)->onApproved($invoice);

        $net = $this->netBalances();
        // Pendapatan baris aset kembali nol bersih di akun aturan; akun default tidak tersentuh.
        $this->assertSame(0.0, $net['4150']);
        $this->assertArrayNotHasKey('4100', $net);
        $this->assertSame(0.0, round(array_sum($net), 2));
    }
}
