<?php

namespace Tests\Feature\Finances\Characterization;

use App\Enums\FormStatus;
use App\Events\Asset\AssetSoldViaInvoice;
use App\Listeners\Asset\Rental\PostAssetDisposalGainLoss;
use App\Models\Asset\Asset;
use App\Models\Core\GlPostingStatus;
use App\Models\Finances\SalesInvoiceItem;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\BuildsAssetFixtures;
use Tests\Support\BuildsFinanceFixtures;
use Tests\TestCase;

/**
 * Characterization Fase 0 (titik posting #10, Lampiran B PRD): laba/rugi pelepasan aset (penjualan via invoice).
 *
 * Baris GL mengacu ke ASET (bukan invoice atau baris invoice); `GlPostingStatus` mengacu ke baris invoice dan
 * dibuat langsung berstatus `posted`. Tanda laba/rugi dikunci apa adanya: laba mengkredit aset tetap dan
 * mendebit akun laba-rugi, rugi sebaliknya. Ini tampak terbalik terhadap konvensi umum dan dicatat sebagai
 * temuan untuk ditinjau (laporan audit Fase 0), bukan diperbaiki di fase ini.
 */
class AssetDisposalGainLossPostingTest extends TestCase {
    use BuildsAssetFixtures, BuildsFinanceFixtures, RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        $this->setUpFinanceFixtures();
    }

    private function sell(Asset $asset, float $price): SalesInvoiceItem {
        $line = SalesInvoiceItem::factory()->create(['item_id' => null, 'asset_id' => $asset->id, 'quantity' => 1, 'price' => $price]);

        (new PostAssetDisposalGainLoss)->handle(new AssetSoldViaInvoice($line));

        return $line->fresh();
    }

    public function test_sale_above_book_value_credits_fixed_asset_and_debits_gain_loss_account(): void {
        ['asset' => $asset, 'fixed' => $fixed, 'gainLoss' => $gainLoss] = $this->makeAssetWithAccounts();

        $line = $this->sell($asset, 1500);

        $this->assertLedger($asset, [
            ['account' => $gainLoss, 'against' => $fixed, 'debit' => 500, 'credit' => 0],
            ['account' => $fixed, 'against' => $gainLoss, 'debit' => 0, 'credit' => 500],
        ], now()->toDateString());
        $this->assertNotNull($line->processed_at);
        $this->assertPostingStatus($line, 'posted');
    }

    public function test_sale_below_book_value_credits_gain_loss_account_and_debits_fixed_asset(): void {
        ['asset' => $asset, 'fixed' => $fixed, 'gainLoss' => $gainLoss] = $this->makeAssetWithAccounts();

        $this->sell($asset, 700);

        $this->assertLedger($asset, [
            ['account' => $fixed, 'against' => $gainLoss, 'debit' => 300, 'credit' => 0],
            ['account' => $gainLoss, 'against' => $fixed, 'debit' => 0, 'credit' => 300],
        ], now()->toDateString());
    }

    public function test_sale_at_book_value_posts_no_ledger_rows_but_marks_line_processed(): void {
        ['asset' => $asset] = $this->makeAssetWithAccounts();

        $line = $this->sell($asset, 1000);

        $this->assertCount(0, $this->ledgerOf($asset));
        $this->assertNotNull($line->processed_at);
        $this->assertSame(FormStatus::POSTED, GlPostingStatus::where('referenceable_id', $line->id)->first()->status);
    }
}
