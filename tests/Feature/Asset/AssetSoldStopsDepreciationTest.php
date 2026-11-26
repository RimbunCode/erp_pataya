<?php

namespace Tests\Feature\Asset;

use App\Enums\FormStatus;
use App\Events\Asset\AssetDepreciationDue;
use App\Listeners\Asset\Depreciation\PostDepreciationEntry;
use App\Models\Asset\Asset;
use App\Models\Asset\AssetDepreciationSchedule;
use App\Models\Core\FormatingSeries;
use App\Models\Core\GlPostingStatus;
use App\Models\Finances\GeneralLedger;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * F3: aset terjual habis menghentikan jadwal penyusutan yang belum terposting (seperti scrap).
 */
class AssetSoldStopsDepreciationTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        foreach ([FormatingSeries::class, Asset::class] as $model) {
            $model::initPermissions();
        }

        DB::table('preferences')->insert([
            'key'        => 'timezone', 'value' => json_encode('UTC'), 'is_example' => false,
            'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    private function schedule(Asset $asset, bool $posted = false): AssetDepreciationSchedule {
        $schedule = AssetDepreciationSchedule::factory()->create([
            'asset_id' => $asset->id, 'schedule_date' => now()->subDay(), 'depreciation_amount' => 100.0,
        ]);
        if ($posted) {
            GlPostingStatus::create([
                'referenceable_type' => AssetDepreciationSchedule::class,
                'referenceable_id'   => $schedule->id,
                'status'             => FormStatus::POSTED->value,
            ]);
        }

        return $schedule;
    }

    #[Test]
    public function fully_sold_deletes_unposted_schedules_and_keeps_posted(): void {
        $asset    = Asset::factory()->create(['allow_bulk_quantity' => true, 'asset_quantity' => 2, 'status' => [FormStatus::ACTIVE]]);
        $unposted = $this->schedule($asset);
        $posted   = $this->schedule($asset, true);

        $asset->addSoldQuantity(2);
        $asset->addSoldQuantity(0); // idempoten

        $this->assertSoftDeleted($unposted);
        $this->assertNotSoftDeleted($posted);
    }

    #[Test]
    public function partial_sale_keeps_schedules(): void {
        $asset    = Asset::factory()->create(['allow_bulk_quantity' => true, 'asset_quantity' => 2, 'status' => [FormStatus::ACTIVE]]);
        $unposted = $this->schedule($asset);

        $asset->addSoldQuantity(1);

        $this->assertNotSoftDeleted($unposted);
    }

    #[Test]
    public function listener_skips_schedule_of_sold_asset(): void {
        $asset    = Asset::factory()->create(['asset_quantity' => 1, 'sold_quantity' => 1, 'status' => [FormStatus::SOLD]]);
        $schedule = $this->schedule($asset);
        GlPostingStatus::create([
            'referenceable_type' => AssetDepreciationSchedule::class,
            'referenceable_id'   => $schedule->id,
            'status'             => 'pending',
        ]);

        (new PostDepreciationEntry)->handle(new AssetDepreciationDue($schedule, now()));

        $this->assertEquals(FormStatus::SKIPPED, GlPostingStatus::where('referenceable_id', $schedule->id)->first()->status);
        $this->assertSame(0, GeneralLedger::where('referenceable_id', $schedule->id)->count());
        $this->assertFalse((bool) $asset->refresh()->is_fully_depreciated);
    }

    #[Test]
    public function command_ignores_schedule_of_sold_asset(): void {
        $asset    = Asset::factory()->create(['asset_quantity' => 1, 'sold_quantity' => 1, 'status' => [FormStatus::SOLD]]);
        $schedule = $this->schedule($asset);

        $this->artisan('assets:post-depreciation')->assertSuccessful();

        $this->assertDatabaseMissing('gl_posting_statuses', ['referenceable_id' => $schedule->id]);
    }

    #[Test]
    public function listener_does_not_overwrite_an_already_posted_row_of_sold_asset(): void {
        $asset    = Asset::factory()->create(['asset_quantity' => 1, 'sold_quantity' => 1, 'status' => [FormStatus::SOLD]]);
        $schedule = $this->schedule($asset, true);

        (new PostDepreciationEntry)->handle(new AssetDepreciationDue($schedule, now()));

        $this->assertEquals(FormStatus::POSTED, GlPostingStatus::where('referenceable_id', $schedule->id)->first()->status);
    }
}
