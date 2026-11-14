<?php

namespace Tests\Feature\Finances\Posting;

use App\Enums\FormStatus;
use App\Enums\PostingDocumentType;
use App\Events\Asset\AssetDepreciationDue;
use App\Events\Asset\AssetScrapped;
use App\Events\Asset\AssetSoldViaInvoice;
use App\Events\Asset\AssetValueAdjustmentApproved;
use App\Exceptions\Finances\DuplicatePostingException;
use App\Listeners\Asset\Depreciation\PostDepreciationEntry;
use App\Listeners\Asset\Depreciation\PostScrapWriteOff;
use App\Listeners\Asset\Depreciation\PostValueAdjustmentEntry;
use App\Listeners\Asset\Rental\PostAssetDisposalGainLoss;
use App\Models\Asset\Asset;
use App\Models\Asset\AssetDepreciationSchedule;
use App\Models\Asset\AssetValueAdjustment;
use App\Models\Core\GlPostingStatus;
use App\Models\Finances\Account;
use App\Models\Finances\GeneralLedger;
use App\Models\Finances\Journal;
use App\Models\Finances\PaymentEntry;
use App\Models\Finances\PaymentMethod;
use App\Models\Finances\PaymentSchedule;
use App\Models\Finances\PostingParityLog;
use App\Models\Finances\PostingProfile;
use App\Models\Finances\PurchaseInvoice;
use App\Models\Finances\SalesInvoice;
use App\Models\Finances\SalesInvoiceItem;
use App\Services\Finances\Ledger\JournalService;
use App\Services\Finances\PaymentEntryService;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\AssertsPostingParity;
use Tests\Support\BuildsAssetFixtures;
use Tests\Support\BuildsFinanceFixtures;
use Tests\TestCase;

/**
 * Finance Fase 2, Task 7.3: parity end-to-end kelompok 1 (Asset: depresiasi, scrap, penyesuaian nilai, disposal;
 * Payment Entry). P-1: satu dokumen per mode (`off`, `shadow`, `on`) diproses lewat listener/service sungguhan dan
 * tanda tangan jurnalnya (purpose, tanggal, akun, debit, kredit) harus identik; efek samping dan `GlPostingStatus`
 * juga identik. Mode `shadow` harus mencatat parity `match` (bukan `config_diff`: fixture memetakan profil ke akun
 * yang sama dengan pilihan dokumen). Kontrak listener (Q-P2-12/13) diuji pada mode `on`.
 *
 * Cakupan Payment Entry: receive atas Sales Invoice dan pay atas Purchase Invoice (normal). Arah retur (T-3) dan
 * `internal_transfer` (T-4) menunggu keputusan pemilik produk dan tidak diklaim.
 */
class PostingParityGroup1Test extends TestCase {
    use AssertsPostingParity, BuildsAssetFixtures, BuildsFinanceFixtures, RefreshDatabase;

    private const ASSET_TYPES = [
        PostingDocumentType::AssetDepreciation,
        PostingDocumentType::AssetScrap,
        PostingDocumentType::AssetValueAdjustment,
        PostingDocumentType::AssetDisposal,
    ];

    protected function setUp(): void {
        parent::setUp();

        $this->setUpFinanceFixtures([PostingProfile::class, PostingParityLog::class, SalesInvoice::class, PurchaseInvoice::class, PaymentSchedule::class, PaymentEntry::class]);
    }

    private function setAssetModes(string $mode): void {
        foreach (self::ASSET_TYPES as $type) {
            $this->setPostingMode($type, $mode);
        }
    }

    /**
     * Aset tambahan pada kategori (dan akun kategori) yang sama dengan `$setup`.
     *
     * @param  array{asset: Asset}  $setup
     * @param  array<string, mixed>  $attributes
     */
    private function siblingAsset(array $setup, array $attributes = []): Asset {
        $asset = Asset::factory()->create([
            'asset_category_id'     => $setup['asset']->asset_category_id,
            'gross_purchase_amount' => 1000,
            'status'                => [FormStatus::ACTIVE],
            ...$attributes,
        ]);
        $asset->assetLocation->update(['branch_id' => $this->branch->id]);

        return $asset->refresh();
    }

    private function pending(Model $document): void {
        GlPostingStatus::create(['referenceable_type' => $document::class, 'referenceable_id' => $document->getKey(), 'status' => FormStatus::PENDING]);
    }

    private function postingStatusOf(Model $document): ?string {
        return GlPostingStatus::where('referenceable_type', $document::class)->where('referenceable_id', $document->getKey())->first()?->status->value;
    }

    private function adjustment(Asset $asset, Account $difference, float $current, float $new): AssetValueAdjustment {
        $adjustment = AssetValueAdjustment::factory()->create([
            'asset_id'              => $asset->id,
            'current_asset_value'   => $current,
            'new_asset_value'       => $new,
            'difference_account_id' => $difference->id,
        ]);
        $this->pending($adjustment);

        return $adjustment;
    }

    public function test_asset_depreciation_scrap_and_value_adjustment_are_identical_in_all_modes(): void {
        $setup      = $this->makeAssetWithAccounts();
        $difference = $this->makeAccount('7200', 'Selisih Revaluasi', 'income', 'credit', 'revaluation_gain');
        $this->activateParityProfile(['asset_revaluation' => $difference]);
        $date = CarbonImmutable::parse('2026-11-10 09:00:00');

        $signatures = [];
        $effects    = [];
        foreach (['off', 'shadow', 'on'] as $mode) {
            $this->setAssetModes($mode);

            $schedule = AssetDepreciationSchedule::factory()->create(['asset_id' => $this->siblingAsset($setup)->id, 'schedule_date' => $date->subDay(), 'depreciation_amount' => 400]);
            $this->pending($schedule);
            (new PostDepreciationEntry)->handle(new AssetDepreciationDue($schedule, $date));

            $scrapped = $this->siblingAsset($setup, ['is_depreciable' => true]);
            $this->pending($scrapped);
            (new PostScrapWriteOff)->handle(new AssetScrapped($scrapped, 1000.0, $date));
            $scrapped = $scrapped->fresh();

            $increase = $this->adjustment($this->siblingAsset($setup, ['gross_purchase_amount' => 5000]), $difference, 5000, 6000);
            (new PostValueAdjustmentEntry)->handle(new AssetValueAdjustmentApproved($increase, $date));
            $decrease = $this->adjustment($this->siblingAsset($setup, ['gross_purchase_amount' => 5000]), $difference, 5000, 4200);
            (new PostValueAdjustmentEntry)->handle(new AssetValueAdjustmentApproved($decrease, $date));

            $signatures['depreciation'][$mode] = $this->journalSignature($schedule);
            $signatures['scrap'][$mode]        = $this->journalSignature($scrapped);
            $signatures['increase'][$mode]     = $this->journalSignature($increase);
            $signatures['decrease'][$mode]     = $this->journalSignature($decrease);

            // Catatan jujur (M-5): jurnal scrap selalu dua baris (satu debit akumulasi, satu kredit aset tetap), jadi
            // "baris kredit pada akun fixed_asset" dan "baris kredit pertama" menghasilkan baris yang sama dan tidak ada
            // skenario yang membedakannya tanpa mengubah rule engine. Pencocokan akun di `PostScrapWriteOff` bersifat
            // defensif; yang dibuktikan di sini: baris yang ditunjuk memang kredit pada akun aset tetap di ketiga mode.
            $scrapLine      = GeneralLedger::find($scrapped->journal_entry_for_scrap_id);
            $effects[$mode] = [
                'statuses' => [$this->postingStatusOf($schedule), $this->postingStatusOf($scrapped), $this->postingStatusOf($increase), $this->postingStatusOf($decrease)],
                'gross'    => [(float) $increase->asset->fresh()->gross_purchase_amount, (float) $decrease->asset->fresh()->gross_purchase_amount],
                'scrap_id' => [$scrapLine?->account_id === $setup['fixed']->id, (float) $scrapLine?->credit],
            ];

            if ($mode === 'shadow') {
                foreach ([$schedule, $scrapped, $increase, $decrease] as $document) {
                    $this->assertSame('match', $this->parityLogStatus($document), $document::class);
                }
            } else {
                $this->assertNull($this->parityLogStatus($schedule), "Mode {$mode} tidak membuat catatan parity.");
            }
        }

        foreach ($signatures as $scenario => $byMode) {
            $this->assertSignaturesIdentical($scenario, $byMode);
        }
        $this->assertEquals($effects['off'], $effects['shadow']);
        $this->assertEquals($effects['off'], $effects['on']);

        // Bukan sekadar identik: nilai dikunci (debit beban/kredit akumulasi, hapus buku, revaluasi naik/turun).
        $this->assertEquals(['depreciation' => ['date' => '2026-11-10', 'lines' => [['6100', 400.0, 0.0], ['1590', 0.0, 400.0]]]], $signatures['depreciation']['on']);
        $this->assertEquals(['1590', 1000.0, 0.0], $signatures['scrap']['on']['write_off']['lines'][0]);
        $this->assertEquals([['1500', 1000.0, 0.0], ['7200', 0.0, 1000.0]], $signatures['increase']['on']['value_adjustment']['lines']);
        $this->assertEquals([['7200', 800.0, 0.0], ['1500', 0.0, 800.0]], $signatures['decrease']['on']['value_adjustment']['lines']);
        $this->assertEquals([['statuses' => ['posted', 'posted', 'posted', 'posted'], 'gross' => [6000.0, 4200.0], 'scrap_id' => [true, 1000.0]]], [$effects['on']]);
    }

    public function test_asset_disposal_is_identical_in_all_modes_and_skipped_when_the_invoice_is_canceled(): void {
        $setup = $this->makeAssetWithAccounts();
        $this->activateParityProfile([]);

        $signatures = [];
        $effects    = [];
        foreach (['off', 'shadow', 'on'] as $mode) {
            $this->setAssetModes($mode);

            foreach (['gain' => 1500, 'loss' => 700, 'flat' => 1000] as $case => $price) {
                $asset = $this->siblingAsset($setup);
                $line  = SalesInvoiceItem::factory()->create(['item_id' => null, 'asset_id' => $asset->id, 'quantity' => 1, 'price' => $price]);
                (new PostAssetDisposalGainLoss)->handle(new AssetSoldViaInvoice($line));

                $signature = [];
                foreach ($this->journalSignature($asset) as $purpose => $journal) {
                    $this->assertSame("disposal:{$line->id}", $purpose);
                    $signature['disposal'] = $journal;
                }
                $signatures[$case][$mode] = $signature;
                $effects[$case][$mode]    = [$line->fresh()->processed_at !== null, $this->postingStatusOf($line)];
            }

            // Sales Invoice dibatalkan sebelum job berjalan (Q-P2-13): tanpa jurnal, status `skipped`, tidak diproses.
            $asset   = $this->siblingAsset($setup);
            $line    = SalesInvoiceItem::factory()->create(['item_id' => null, 'asset_id' => $asset->id, 'quantity' => 1, 'price' => 1500]);
            $invoice = SalesInvoice::query()->findOrFail($line->sales_invoice_id);
            $invoice->update(['status' => [FormStatus::CANCELED]]);
            (new PostAssetDisposalGainLoss)->handle(new AssetSoldViaInvoice($line));

            $signatures['canceled'][$mode] = $this->journalSignature($asset);
            $effects['canceled'][$mode]    = [$line->fresh()->processed_at !== null, $this->postingStatusOf($line)];
        }

        foreach (['gain', 'loss'] as $case) {
            $this->assertSignaturesIdentical($case, $signatures[$case]);
        }
        $this->assertSignaturesIdentical('flat', $signatures['flat'], allowEmpty: true);
        $this->assertSignaturesIdentical('canceled', $signatures['canceled'], allowEmpty: true);

        // Tanda laba/rugi dikunci apa adanya (T-7): laba mendebit akun laba-rugi, rugi mendebit aset tetap.
        $this->assertEquals([['7100', 500.0, 0.0], ['1500', 0.0, 500.0]], $signatures['gain']['on']['disposal']['lines']);
        $this->assertEquals([['1500', 300.0, 0.0], ['7100', 0.0, 300.0]], $signatures['loss']['on']['disposal']['lines']);
        $this->assertSame([], $signatures['flat']['on']);
        $this->assertSame([], $signatures['canceled']['on']);

        foreach (['gain', 'loss', 'flat'] as $case) {
            $this->assertEquals($effects[$case]['off'], $effects[$case]['shadow']);
            $this->assertEquals($effects[$case]['off'], $effects[$case]['on']);
            $this->assertSame([true, 'posted'], $effects[$case]['on'], $case);
        }
        foreach (['off', 'shadow', 'on'] as $mode) {
            $this->assertSame([false, 'skipped'], $effects['canceled'][$mode], "Disposal tertunda (invoice canceled), mode {$mode}.");
        }
    }

    /**
     * @return array{cash: Account, receivable: Account, payable: Account, method: PaymentMethod}
     */
    private function paymentFixture(): array {
        $cash       = $this->makeAccount('1100', 'Kas', 'asset', 'debit', 'cash');
        $receivable = $this->makeAccount('1200', 'Piutang Usaha', 'asset', 'debit', 'accounts_receivable');
        $payable    = $this->makeAccount('2100', 'Utang Usaha', 'liability', 'credit', 'accounts_payable');
        $method     = PaymentMethod::create(['name' => 'Kas Tunai', 'default_account_id' => $cash->id]);
        $this->activateParityProfile(['receivable' => $receivable, 'payable' => $payable]);

        return compact('cash', 'receivable', 'payable', 'method');
    }

    public function test_payment_entry_receive_and_pay_are_identical_in_all_modes(): void {
        ['cash' => $cash, 'receivable' => $receivable, 'payable' => $payable, 'method' => $method] = $this->paymentFixture();

        $signatures = [];
        $effects    = [];
        foreach (['off', 'shadow', 'on'] as $mode) {
            $this->setPostingMode(PostingDocumentType::PaymentEntry, $mode);

            $sales    = $this->makeUnpaidSalesInvoice(1_000_000);
            $receive  = $this->makePaymentEntry($sales, 400_000, $receivable, $cash, ['payment_method_id' => $method->id]);
            $purchase = $this->makeUnpaidPurchaseInvoice(500_000);
            $pay      = $this->makePaymentEntry($purchase, 500_000, $cash, $payable, ['payment_method_id' => $method->id]);

            app(PaymentEntryService::class)->onApproved($receive->fresh());
            app(PaymentEntryService::class)->onApproved($pay->fresh());

            $signatures['receive'][$mode] = $this->journalSignature($receive);
            $signatures['pay'][$mode]     = $this->journalSignature($pay);
            $effects[$mode]               = [
                (float) $sales->fresh()->paid_amount, array_map(fn ($status)    => $status->value, $sales->fresh()->status),
                (float) $purchase->fresh()->paid_amount, array_map(fn ($status) => $status->value, $purchase->fresh()->status),
                \count(GlPostingStatus::where('referenceable_type', PaymentEntry::class)->get()),
            ];

            if ($mode === 'shadow') {
                $this->assertSame('match', $this->parityLogStatus($receive));
                $this->assertSame('match', $this->parityLogStatus($pay));
            } else {
                $this->assertNull($this->parityLogStatus($receive));
            }
        }

        foreach ($signatures as $scenario => $byMode) {
            $this->assertSignaturesIdentical($scenario, $byMode);
        }
        $this->assertEquals($effects['off'], $effects['shadow']);
        $this->assertEquals($effects['off'], $effects['on']);

        // Jumlah entri ini (bukan kumulatif; F-10 sudah diperbaiki hotfix, Q-P2-3): debit kas, kredit piutang; pay sebaliknya.
        $this->assertEquals(['default' => ['date' => now()->subDay()->toDateString(), 'lines' => [['1100', 400000.0, 0.0], ['1200', 0.0, 400000.0]]]], $signatures['receive']['on']);
        $this->assertEquals([['2100', 500000.0, 0.0], ['1100', 0.0, 500000.0]], $signatures['pay']['on']['default']['lines']);
    }

    public function test_payment_entry_on_mode_rolls_back_the_approval_when_the_journal_already_exists(): void {
        ['cash' => $cash, 'receivable' => $receivable, 'method' => $method] = $this->paymentFixture();
        $this->setPostingMode(PostingDocumentType::PaymentEntry, 'on');

        $invoice = $this->makeUnpaidSalesInvoice(1_000_000);
        $payment = $this->makePaymentEntry($invoice, 400_000, $receivable, $cash, ['payment_method_id' => $method->id]);

        // Jurnal dengan kunci yang sama sudah ada (inkonsistensi), seperti `DuplicatePostingException` jalur lama.
        app(JournalService::class)->postPair($cash->id, $receivable->id, 400_000, $payment, CarbonImmutable::now());

        try {
            app(PaymentEntryService::class)->onApproved($payment->fresh());
            $this->fail('Approve harus digulung.');
        } catch (DuplicatePostingException) {
            $this->assertEquals(0.0, (float) $invoice->fresh()->paid_amount, 'Penerapan pembayaran digulung.');
            $this->assertContains(FormStatus::DRAFT, $payment->fresh()->status);
            $this->assertSame(1, Journal::count());
        }
    }

    public function test_on_mode_listeners_follow_the_outcome_contract_for_retries_and_canceled_sources(): void {
        $setup      = $this->makeAssetWithAccounts();
        $difference = $this->makeAccount('7200', 'Selisih Revaluasi', 'income', 'credit', 'revaluation_gain');
        $this->activateParityProfile(['asset_revaluation' => $difference]);
        $this->setAssetModes('on');
        $date = CarbonImmutable::parse('2026-11-10 09:00:00');

        // (b) already_posted tidak mengulang `gross_purchase_amount`; (a) status tetap `posted`.
        $adjustment = $this->adjustment($this->siblingAsset($setup, ['gross_purchase_amount' => 5000]), $difference, 5000, 6000);
        (new PostValueAdjustmentEntry)->handle(new AssetValueAdjustmentApproved($adjustment, $date));
        $this->assertEquals(6000.0, (float) $adjustment->asset->fresh()->gross_purchase_amount);
        (new PostValueAdjustmentEntry)->handle(new AssetValueAdjustmentApproved($adjustment->fresh(), $date));
        $this->assertEquals(6000.0, (float) $adjustment->asset->fresh()->gross_purchase_amount, 'Retry tidak mengulang efek samping non-idempoten.');
        $this->assertSame(1, Journal::where('source_id', $adjustment->id)->count());

        // (c) journal_entry_for_scrap_id dari jurnal hasil engine; retry tidak menimpanya.
        $scrapped = $this->siblingAsset($setup, ['is_depreciable' => true]);
        $this->pending($scrapped);
        (new PostScrapWriteOff)->handle(new AssetScrapped($scrapped, 1000.0, $date));
        $firstId = $scrapped->fresh()->journal_entry_for_scrap_id;
        $this->assertNotNull($firstId);
        $this->assertSame($setup['fixed']->id, GeneralLedger::find($firstId)->account_id);
        (new PostScrapWriteOff)->handle(new AssetScrapped($scrapped->fresh(), 1000.0, $date));
        $this->assertSame($firstId, $scrapped->fresh()->journal_entry_for_scrap_id);
        $this->assertSame('posted', $this->postingStatusOf($scrapped));

        // (a) dokumen dibatalkan sebelum job: `skipped` tidak ditimpa menjadi `posted`, tanpa jurnal dan tanpa efek samping.
        $canceled = $this->adjustment($this->siblingAsset($setup, ['gross_purchase_amount' => 5000]), $difference, 5000, 6000);
        $canceled->update(['status' => [FormStatus::CANCELED]]);
        (new PostValueAdjustmentEntry)->handle(new AssetValueAdjustmentApproved($canceled->fresh(), $date));
        $this->assertSame('skipped', $this->postingStatusOf($canceled));
        $this->assertSame(0, Journal::where('source_id', $canceled->id)->count());
        $this->assertEquals(5000.0, (float) $canceled->asset->fresh()->gross_purchase_amount);
    }
}
