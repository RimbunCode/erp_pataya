<?php

namespace Tests\Unit\Listeners\Asset\Rental;

use App\Enums\FormStatus;
use App\Events\Asset\AssetSoldViaInvoice;
use App\Listeners\Asset\Rental\PostAssetDisposalGainLoss;
use App\Models\Asset\Asset;
use App\Models\Asset\AssetCategoryAccount;
use App\Models\Core\GlPostingStatus;
use App\Models\Finances\GeneralLedger;
use App\Models\Finances\SalesInvoiceItem;
use App\Models\Finances\SalesInvoiceItemAsset;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use LogicException;
use PHPUnit\Framework\Attributes\Test;
use RuntimeException;
use Tests\TestCase;

class PostAssetDisposalGainLossTest extends TestCase {
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
        $gainLoss = $this->makeAccountId('income', 'gain_loss_disposal');

        $asset = Asset::factory()->create([
            'gross_purchase_amount' => $grossAmount,
            'status'                => [FormStatus::ACTIVE],
        ]);
        $asset->assetLocation->update(['branch_id' => $branchId]);

        AssetCategoryAccount::factory()->create([
            'asset_category_id'             => $asset->asset_category_id,
            'branch_id'                     => $branchId,
            'fixed_asset_account_id'        => $fixed,
            'gain_loss_disposal_account_id' => $gainLoss,
        ]);

        return $asset->refresh();
    }

    private function makeLine(Asset $asset, float $quantity, float $price, float $itemQuantity = 1): SalesInvoiceItemAsset {
        $item = SalesInvoiceItem::factory()->create([
            'quantity' => $itemQuantity,
            'price'    => $price,
        ]);

        return SalesInvoiceItemAsset::factory()->create([
            'sales_invoice_item_id' => $item->id,
            'asset_id'              => $asset->id,
            'quantity'              => $quantity,
        ]);
    }

    #[Test]
    public function posts_gain_when_sale_price_exceeds_book_value(): void {
        $asset = $this->makeAssetWithCategoryAccount(1000);
        $line  = $this->makeLine($asset, 1, 1500);

        (new PostAssetDisposalGainLoss)->handle(new AssetSoldViaInvoice($line));

        $this->assertSame(2, GeneralLedger::where('referenceable_type', Asset::class)
            ->where('referenceable_id', $asset->id)
            ->count());

        $line->refresh();
        $this->assertNotNull($line->processed_at);

        $glStatus = GlPostingStatus::where('referenceable_id', $line->id)->first();
        $this->assertEquals(FormStatus::POSTED, $glStatus->status);
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

        $glStatus = GlPostingStatus::where('referenceable_id', $line->id)->first();
        $this->assertEquals(FormStatus::FAILED, $glStatus->status);
        $this->assertEquals('Account not found', $glStatus->last_error);
    }
}
