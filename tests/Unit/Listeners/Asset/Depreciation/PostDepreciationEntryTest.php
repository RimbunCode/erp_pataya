<?php

namespace Tests\Unit\Listeners\Asset\Depreciation;

use App\Enums\FormStatus;
use App\Events\Asset\AssetDepreciationDue;
use App\Listeners\Asset\Depreciation\PostDepreciationEntry;
use App\Models\Asset\Asset;
use App\Models\Asset\AssetCategoryAccount;
use App\Models\Asset\AssetDepreciationSchedule;
use App\Models\Core\FormatingSeries;
use App\Models\Core\GlPostingStatus;
use App\Models\Finances\GeneralLedger;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use LogicException;
use PHPUnit\Framework\Attributes\Test;
use RuntimeException;
use Tests\TestCase;

class PostDepreciationEntryTest extends TestCase {
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
            [
                'name'   => 'General Ledger',
                'format' => 'GL/@[yy]-@[mm]/@[iiii]',
                'logs'   => ['imy' => []],
            ],
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

    private function makeAssetWithCategoryAccount(): Asset {
        $branchId = $this->makeBranchId();
        $expense  = $this->makeAccountId('expense', 'depreciation_expense');
        $accum    = $this->makeAccountId('asset', 'accumulated_depreciation');

        $asset = Asset::factory()->create();
        $asset->assetLocation->update(['branch_id' => $branchId]);

        AssetCategoryAccount::factory()->create([
            'asset_category_id'                   => $asset->asset_category_id,
            'branch_id'                           => $branchId,
            'depreciation_expense_account_id'     => $expense,
            'accumulated_depreciation_account_id' => $accum,
        ]);

        return $asset->refresh();
    }

    #[Test]
    public function posts_paired_gl_entries_and_marks_status_posted(): void {
        $asset    = $this->makeAssetWithCategoryAccount();
        $schedule = AssetDepreciationSchedule::factory()->create([
            'asset_id'            => $asset->id,
            'depreciation_amount' => 500.0,
        ]);
        GlPostingStatus::create([
            'referenceable_type' => AssetDepreciationSchedule::class,
            'referenceable_id'   => $schedule->id,
            'status'             => FormStatus::PENDING,
        ]);

        (new PostDepreciationEntry)->handle(new AssetDepreciationDue($schedule, now()));

        $this->assertSame(2, GeneralLedger::where('referenceable_type', AssetDepreciationSchedule::class)
            ->where('referenceable_id', $schedule->id)
            ->count());

        $glStatus = GlPostingStatus::where('referenceable_id', $schedule->id)->first();
        $this->assertEquals(FormStatus::POSTED, $glStatus->status);
        $this->assertNotNull($glStatus->posted_at);
    }

    #[Test]
    public function skips_gl_creation_when_amount_is_zero_but_still_marks_posted(): void {
        $asset    = $this->makeAssetWithCategoryAccount();
        $schedule = AssetDepreciationSchedule::factory()->create([
            'asset_id'            => $asset->id,
            'depreciation_amount' => 0,
        ]);
        GlPostingStatus::create([
            'referenceable_type' => AssetDepreciationSchedule::class,
            'referenceable_id'   => $schedule->id,
            'status'             => FormStatus::PENDING,
        ]);

        (new PostDepreciationEntry)->handle(new AssetDepreciationDue($schedule, now()));

        $this->assertSame(0, GeneralLedger::where('referenceable_type', AssetDepreciationSchedule::class)
            ->where('referenceable_id', $schedule->id)
            ->count());

        $glStatus = GlPostingStatus::where('referenceable_id', $schedule->id)->first();
        $this->assertEquals(FormStatus::POSTED, $glStatus->status);
    }

    #[Test]
    public function throws_when_asset_category_account_missing_for_branch(): void {
        $asset    = Asset::factory()->create();
        $schedule = AssetDepreciationSchedule::factory()->create([
            'asset_id'            => $asset->id,
            'depreciation_amount' => 100.0,
        ]);
        GlPostingStatus::create([
            'referenceable_type' => AssetDepreciationSchedule::class,
            'referenceable_id'   => $schedule->id,
            'status'             => FormStatus::PENDING,
        ]);

        $this->expectException(LogicException::class);

        (new PostDepreciationEntry)->handle(new AssetDepreciationDue($schedule, now()));
    }

    #[Test]
    public function marks_asset_fully_depreciated_when_last_schedule_posted(): void {
        $asset = $this->makeAssetWithCategoryAccount();
        $s1    = AssetDepreciationSchedule::factory()->create(['asset_id' => $asset->id, 'depreciation_amount' => 500]);

        GlPostingStatus::create([
            'referenceable_type' => AssetDepreciationSchedule::class,
            'referenceable_id'   => $s1->id,
            'status'             => FormStatus::PENDING,
        ]);

        (new PostDepreciationEntry)->handle(new AssetDepreciationDue($s1, now()));

        $asset->refresh();
        $statusValues = array_map(fn (FormStatus $s) => $s->value, $asset->status ?? []);
        $this->assertContains(FormStatus::FULLY_DEPRECIATED->value, $statusValues);
        $this->assertTrue($asset->is_fully_depreciated);
    }

    #[Test]
    public function failed_marks_gl_posting_status_as_failed(): void {
        $asset    = Asset::factory()->create();
        $schedule = AssetDepreciationSchedule::factory()->create(['asset_id' => $asset->id]);
        GlPostingStatus::create([
            'referenceable_type' => AssetDepreciationSchedule::class,
            'referenceable_id'   => $schedule->id,
            'status'             => FormStatus::PENDING,
        ]);

        (new PostDepreciationEntry)->failed(new AssetDepreciationDue($schedule, now()), new RuntimeException('Account not found'));

        $glStatus = GlPostingStatus::where('referenceable_id', $schedule->id)->first();
        $this->assertEquals(FormStatus::FAILED, $glStatus->status);
        $this->assertEquals(1, $glStatus->retry_count);
        $this->assertEquals('Account not found', $glStatus->last_error);
    }
}
