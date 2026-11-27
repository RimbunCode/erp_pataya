<?php

namespace Tests\Unit\Listeners\Asset\Rental;

use App\Enums\FormStatus;
use App\Events\Asset\AssetSoldViaInvoice;
use App\Listeners\Asset\Rental\PostAssetDisposalGainLoss;
use App\Models\Asset\Asset;
use App\Models\Asset\AssetCategoryAccount;
use App\Models\Core\GlPostingStatus;
use App\Models\Finances\GeneralLedger;
use App\Models\Finances\Journal;
use App\Models\Finances\PostingProfile;
use App\Models\Finances\SalesInvoice;
use App\Models\Finances\SalesInvoiceItem;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use LogicException;
use PHPUnit\Framework\Attributes\Test;
use RuntimeException;
use Tests\Support\EnablesEnginePosting;
use Tests\TestCase;

class PostAssetDisposalGainLossTest extends TestCase {
    use EnablesEnginePosting, RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        foreach (Schema::getTables() as $tableInfo) {
            $table = $tableInfo['name'];
            if (! Schema::hasColumn($table, 'is_example')) {
                Schema::table($table, fn ($t) => $t->boolean('is_example')->default(false));
            }
        }

        GeneralLedger::initPermissions();
        Journal::initPermissions();
        PostingProfile::initPermissions();

        // Task 14.1: closure legacy dihapus; disposal ditulis engine dengan akun master AssetCategoryAccount. T-7: jurnal
        // pelepasan membalik pendapatan baris aset, jadi profil harus memetakan `revenue`.
        $this->enableEnginePosting(['revenue' => $this->makeAccountId('income', 'sales')]);
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

    private function makeBranchId(): string {
        $id = (string) Str::ulid();
        DB::table('branches')->insert([
            'id'             => $id,
            'name'           => 'Branch ' . fake()->unique()->numerify('###'),
            'is_main_branch' => false,
            'created_at'     => now(),
            'updated_at'     => now(),
        ]);

        return $id;
    }

    private function makeAssetWithCategoryAccount(float $grossAmount = 1000): Asset {
        $branchId = $this->makeBranchId();
        $fixed    = $this->makeAccountId('asset', 'fixed_asset');
        $accum    = $this->makeAccountId('asset', 'accumulated_depreciation');
        $gainLoss = $this->makeAccountId('income', 'gain_loss_disposal');

        $asset = Asset::factory()->create([
            'gross_purchase_amount' => $grossAmount,
            'status'                => [FormStatus::ACTIVE],
        ]);
        $asset->assetLocation->update(['branch_id' => $branchId]);

        AssetCategoryAccount::factory()->create([
            'asset_category_id'                   => $asset->asset_category_id,
            'branch_id'                           => $branchId,
            'fixed_asset_account_id'              => $fixed,
            'accumulated_depreciation_account_id' => $accum,
            'gain_loss_disposal_account_id'       => $gainLoss,
        ]);

        return $asset->refresh();
    }

    private function makeLine(Asset $asset, float $quantity, float $price): SalesInvoiceItem {
        return SalesInvoiceItem::factory()->create([
            'item_id'  => null,
            'asset_id' => $asset->id,
            'quantity' => $quantity,
            'price'    => $price,
        ]);
    }

    #[Test]
    public function posts_gain_when_sale_price_exceeds_book_value(): void {
        $asset = $this->makeAssetWithCategoryAccount(1000);
        $line  = $this->makeLine($asset, 1, 1500);

        (new PostAssetDisposalGainLoss)->handle(new AssetSoldViaInvoice($line));

        // Bentuk baku (T-7): Dr pendapatan 1.500, Cr aset tetap 1.000 (perolehan), Cr untung 500; akumulasi 0 tidak berbaris.
        $rows = GeneralLedger::where('referenceable_type', Asset::class)->where('referenceable_id', $asset->id)->get();
        $this->assertCount(3, $rows);
        $this->assertEqualsWithDelta(1500, $rows->sum('debit'), 0.01);
        $this->assertEqualsWithDelta(1500, $rows->sum('credit'), 0.01);

        $line->refresh();
        $this->assertNotNull($line->processed_at);

        $glStatus = GlPostingStatus::where('referenceable_type', SalesInvoiceItem::class)
            ->where('referenceable_id', $line->id)
            ->first();
        $this->assertEquals(FormStatus::POSTED, $glStatus->status);
    }

    #[Test]
    public function return_line_posts_nothing_and_is_marked_skipped(): void {
        $asset         = $this->makeAssetWithCategoryAccount(1000);
        $returnInvoice = SalesInvoice::factory()->create(['return_against_id' => SalesInvoice::factory()->create()->id]);
        $line          = $this->makeLine($asset, 1, 1500);
        $line->update(['sales_invoice_id' => $returnInvoice->id]);

        (new PostAssetDisposalGainLoss)->handle(new AssetSoldViaInvoice($line->fresh()));

        $this->assertSame(0, GeneralLedger::where('referenceable_type', Asset::class)->where('referenceable_id', $asset->id)->count());
        $this->assertNull($line->fresh()->processed_at);
        $this->assertEquals(FormStatus::SKIPPED, GlPostingStatus::where('referenceable_type', SalesInvoiceItem::class)->where('referenceable_id', $line->id)->first()->status);
    }

    #[Test]
    public function fractional_proportions_keep_the_journal_balanced(): void {
        // 3 unit senilai 1.000, jual 1 unit: perolehan 333,33; jurnal tetap seimbang setelah pembulatan.
        $asset = $this->makeAssetWithCategoryAccount(1000);
        $asset->update(['asset_quantity' => 3, 'allow_bulk_quantity' => true, 'opening_accumulated_depreciation' => 100]);
        $line = $this->makeLine($asset->fresh(), 1, 250);

        (new PostAssetDisposalGainLoss)->handle(new AssetSoldViaInvoice($line));

        $rows = GeneralLedger::where('referenceable_type', Asset::class)->where('referenceable_id', $asset->id)->get();
        $this->assertGreaterThanOrEqual(3, $rows->count());
        $this->assertEqualsWithDelta($rows->sum('debit'), $rows->sum('credit'), 0.001);
        $this->assertNotNull($line->fresh()->processed_at);
    }

    #[Test]
    public function is_idempotent_when_line_already_processed(): void {
        $asset = $this->makeAssetWithCategoryAccount(1000);
        $line  = $this->makeLine($asset, 1, 1500);
        $line->update(['processed_at' => now()]);

        (new PostAssetDisposalGainLoss)->handle(new AssetSoldViaInvoice($line));

        $this->assertSame(0, GeneralLedger::where('referenceable_type', Asset::class)
            ->where('referenceable_id', $asset->id)
            ->count());
    }

    #[Test]
    public function throws_when_asset_category_account_missing_for_branch(): void {
        $asset = Asset::factory()->create(['status' => [FormStatus::ACTIVE]]);
        $line  = $this->makeLine($asset, 1, 1500);

        $this->expectException(LogicException::class);

        (new PostAssetDisposalGainLoss)->handle(new AssetSoldViaInvoice($line));
    }

    #[Test]
    public function failed_marks_gl_posting_status_as_failed(): void {
        $asset = Asset::factory()->create(['status' => [FormStatus::ACTIVE]]);
        $line  = $this->makeLine($asset, 1, 1500);

        (new PostAssetDisposalGainLoss)->failed(new AssetSoldViaInvoice($line), new RuntimeException('Account not found'));

        $glStatus = GlPostingStatus::where('referenceable_type', SalesInvoiceItem::class)
            ->where('referenceable_id', $line->id)
            ->first();
        $this->assertEquals(FormStatus::FAILED, $glStatus->status);
        $this->assertEquals('Account not found', $glStatus->last_error);
    }

    #[Test]
    public function retry_after_failure_leaves_a_single_posted_row_without_a_stale_failed_row(): void {
        $asset = $this->makeAssetWithCategoryAccount(1000);
        $line  = $this->makeLine($asset, 1, 1500);

        (new PostAssetDisposalGainLoss)->failed(new AssetSoldViaInvoice($line), new RuntimeException('Deadlock'));
        (new PostAssetDisposalGainLoss)->failed(new AssetSoldViaInvoice($line), new RuntimeException('Deadlock lagi'));
        $this->assertSame(1, GlPostingStatus::where('referenceable_type', SalesInvoiceItem::class)->where('referenceable_id', $line->id)->count(), 'failed() berulang tidak membuat baris ganda.');

        (new PostAssetDisposalGainLoss)->handle(new AssetSoldViaInvoice($line));

        $rows = GlPostingStatus::where('referenceable_type', SalesInvoiceItem::class)->where('referenceable_id', $line->id)->get();
        $this->assertCount(1, $rows, 'Satu baris status per disposal.');
        $this->assertEquals(FormStatus::POSTED, $rows->first()->status);
        $this->assertNotNull($rows->first()->posted_at);
        $this->assertSame(0, GlPostingStatus::where('status', FormStatus::FAILED->value)->count(), 'Tidak ada baris FAILED tersisa.');
        $this->assertNotNull($line->fresh()->processed_at);
    }

    #[Test]
    public function failed_does_not_overwrite_terminal_rows_or_processed_lines(): void {
        $asset = Asset::factory()->create(['status' => [FormStatus::ACTIVE]]);

        foreach ([FormStatus::POSTED, FormStatus::SKIPPED] as $terminal) {
            $line = $this->makeLine($asset, 1, 1500);
            GlPostingStatus::create(['referenceable_type' => SalesInvoiceItem::class, 'referenceable_id' => $line->id, 'status' => $terminal->value]);

            (new PostAssetDisposalGainLoss)->failed(new AssetSoldViaInvoice($line), new RuntimeException('MaxAttemptsExceeded'));

            $rows = GlPostingStatus::where('referenceable_type', SalesInvoiceItem::class)->where('referenceable_id', $line->id)->get();
            $this->assertCount(1, $rows);
            $this->assertEquals($terminal, $rows->first()->status, "{$terminal->value} tidak boleh menjadi FAILED.");
            $this->assertNull($rows->first()->last_error);
        }

        // Baris sudah diproses (processed_at terisi) tanpa baris status: tidak dibuat FAILED.
        $processed = $this->makeLine($asset, 1, 1500);
        $processed->update(['processed_at' => now()]);
        (new PostAssetDisposalGainLoss)->failed(new AssetSoldViaInvoice($processed), new RuntimeException('MaxAttemptsExceeded'));
        $this->assertSame(0, GlPostingStatus::where('referenceable_type', SalesInvoiceItem::class)->where('referenceable_id', $processed->id)->count());
    }

    #[Test]
    public function failed_still_marks_missing_pending_and_failed_rows_as_failed_without_duplicates(): void {
        $asset = Asset::factory()->create(['status' => [FormStatus::ACTIVE]]);

        $missing = $this->makeLine($asset, 1, 1500);
        $pending = $this->makeLine($asset, 1, 1500);
        GlPostingStatus::create(['referenceable_type' => SalesInvoiceItem::class, 'referenceable_id' => $pending->id, 'status' => FormStatus::PENDING->value]);
        $failed = $this->makeLine($asset, 1, 1500);
        GlPostingStatus::create(['referenceable_type' => SalesInvoiceItem::class, 'referenceable_id' => $failed->id, 'status' => FormStatus::FAILED->value, 'retry_count' => 1]);

        foreach ([$missing, $pending, $failed] as $line) {
            (new PostAssetDisposalGainLoss)->failed(new AssetSoldViaInvoice($line), new RuntimeException('Deadlock'));

            $rows = GlPostingStatus::where('referenceable_type', SalesInvoiceItem::class)->where('referenceable_id', $line->id)->get();
            $this->assertCount(1, $rows, 'Tanpa baris ganda.');
            $this->assertEquals(FormStatus::FAILED, $rows->first()->status);
            $this->assertSame('Deadlock', $rows->first()->last_error);
        }

        $this->assertSame(2, (int) GlPostingStatus::where('referenceable_type', SalesInvoiceItem::class)->where('referenceable_id', $failed->id)->value('retry_count'), 'retry_count bertambah pada baris FAILED yang ada.');
    }
}
