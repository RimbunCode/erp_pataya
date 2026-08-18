<?php

namespace Tests\Unit\Listeners\Asset\Depreciation;

use App\Enums\FormStatus;
use App\Events\Asset\AssetValueAdjustmentApproved;
use App\Listeners\Asset\Depreciation\PostValueAdjustmentEntry;
use App\Models\Asset\Asset;
use App\Models\Asset\AssetCategoryAccount;
use App\Models\Asset\AssetValueAdjustment;
use App\Models\Core\FormatingSeries;
use App\Models\Core\GlPostingStatus;
use App\Models\Finances\GeneralLedger;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class PostValueAdjustmentEntryTest extends TestCase {
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

        FormatingSeries::firstOrCreate(
            ['model' => GeneralLedger::class],
            ['name' => 'General Ledger', 'format' => 'GL/@[yy]-@[mm]/@[iiii]', 'logs' => ['imy' => []]],
        );
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

    #[Test]
    public function posts_paired_gl_entries_for_value_increase(): void {
        $branchId = $this->makeBranchId();
        $fixedAcc = $this->makeAccountId('asset', 'fixed_asset');
        $diffAcc  = $this->makeAccountId('income', 'revaluation_gain');

        $asset = Asset::factory()->create(['gross_purchase_amount' => 5000]);
        $asset->assetLocation->update(['branch_id' => $branchId]);

        AssetCategoryAccount::factory()->create([
            'asset_category_id'      => $asset->asset_category_id,
            'branch_id'              => $branchId,
            'fixed_asset_account_id' => $fixedAcc,
        ]);

        $adjustment = AssetValueAdjustment::factory()->create([
            'asset_id'              => $asset->id,
            'current_asset_value'   => 5000,
            'new_asset_value'       => 6000,
            'difference_account_id' => $diffAcc,
        ]);
        GlPostingStatus::create([
            'referenceable_type' => AssetValueAdjustment::class,
            'referenceable_id'   => $adjustment->id,
            'status'             => FormStatus::PENDING,
        ]);

        (new PostValueAdjustmentEntry)->handle(new AssetValueAdjustmentApproved($adjustment, now()));

        $this->assertSame(2, GeneralLedger::where('referenceable_type', AssetValueAdjustment::class)
            ->where('referenceable_id', $adjustment->id)
            ->count());

        $glStatus = GlPostingStatus::where('referenceable_id', $adjustment->id)->first();
        $this->assertEquals(FormStatus::POSTED, $glStatus->status);

        $asset->refresh();
        $this->assertEquals(6000.0, (float) $asset->gross_purchase_amount);
    }
}
