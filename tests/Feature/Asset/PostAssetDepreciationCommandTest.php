<?php

namespace Tests\Feature\Asset;

use App\Enums\FormStatus;
use App\Events\Asset\AssetDepreciationDue;
use App\Http\Controllers\Core\GlPostingStatusController;
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
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class PostAssetDepreciationCommandTest extends TestCase {
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

    private function makeAssetWithSchedule(): array {
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

        $schedule = AssetDepreciationSchedule::factory()->create([
            'asset_id'            => $asset->id,
            'schedule_date'       => now()->subDay(),
            'depreciation_amount' => 500.0,
        ]);

        return [$asset->refresh(), $schedule];
    }

    #[Test]
    public function command_creates_pending_status_and_posts_gl(): void {
        [, $schedule] = $this->makeAssetWithSchedule();

        $this->artisan('assets:post-depreciation')->assertSuccessful();

        $glStatus = GlPostingStatus::where('referenceable_type', AssetDepreciationSchedule::class)
            ->where('referenceable_id', $schedule->id)
            ->first();
        $this->assertNotNull($glStatus);
        $this->assertEquals(FormStatus::POSTED, $glStatus->status);

        $this->assertSame(2, GeneralLedger::where('referenceable_type', AssetDepreciationSchedule::class)
            ->where('referenceable_id', $schedule->id)
            ->count());
    }

    #[Test]
    public function command_does_not_reprocess_schedule_already_having_gl_posting_status(): void {
        [, $schedule] = $this->makeAssetWithSchedule();

        $this->artisan('assets:post-depreciation')->assertSuccessful();
        $countAfterFirst = GeneralLedger::where('referenceable_type', AssetDepreciationSchedule::class)
            ->where('referenceable_id', $schedule->id)
            ->count();

        $this->artisan('assets:post-depreciation')->assertSuccessful();
        $countAfterSecond = GeneralLedger::where('referenceable_type', AssetDepreciationSchedule::class)
            ->where('referenceable_id', $schedule->id)
            ->count();

        $this->assertSame($countAfterFirst, $countAfterSecond);
    }

    #[Test]
    public function command_ignores_schedule_not_yet_due(): void {
        $asset    = Asset::factory()->create();
        $schedule = AssetDepreciationSchedule::factory()->create([
            'asset_id'      => $asset->id,
            'schedule_date' => now()->addMonth(),
        ]);

        $this->artisan('assets:post-depreciation')->assertSuccessful();

        $this->assertDatabaseMissing('gl_posting_statuses', [
            'referenceable_type' => AssetDepreciationSchedule::class,
            'referenceable_id'   => $schedule->id,
        ]);
    }

    #[Test]
    public function resolve_retry_event_supports_asset_depreciation_schedule(): void {
        [, $schedule] = $this->makeAssetWithSchedule();

        $glStatus = GlPostingStatus::create([
            'referenceable_type' => AssetDepreciationSchedule::class,
            'referenceable_id'   => $schedule->id,
            'status'             => FormStatus::FAILED,
            'retry_count'        => 2,
            'last_error'         => 'previous failure',
        ]);

        $controllerReflection = new \ReflectionClass(GlPostingStatusController::class);
        $controller           = $controllerReflection->newInstanceWithoutConstructor();
        $reflection           = new \ReflectionMethod($controller, 'resolveRetryEvent');
        $reflection->setAccessible(true);

        $event = $reflection->invoke($controller, $glStatus->load('referenceable'));

        $this->assertInstanceOf(AssetDepreciationDue::class, $event);
        $this->assertTrue($event->schedule->is($schedule));
    }
}
