<?php

namespace Tests\Unit\Asset;

use App\Enums\FormStatus;
use App\Events\Asset\AssetScrapped;
use App\Models\Asset\Asset;
use App\Models\Asset\AssetDepreciationSchedule;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class AssetScrapWriteOffTest extends TestCase {
    use RefreshDatabase;

    #[Test]
    public function cancels_unposted_schedule_rows_on_scrap(): void {
        $asset = Asset::factory()->create(['status' => [FormStatus::ACTIVE]]);
        AssetDepreciationSchedule::factory()->count(3)->create(['asset_id' => $asset->id]);

        $asset->scrap();

        $this->assertCount(0, $asset->depreciationSchedules()->get());
    }

    #[Test]
    public function dispatches_write_off_event_when_depreciable_with_remaining_book_value(): void {
        Event::fake([AssetScrapped::class]);

        $asset = Asset::factory()->create([
            'status'                => [FormStatus::ACTIVE],
            'is_depreciable'        => true,
            'gross_purchase_amount' => 10000,
        ]);

        $asset->scrap();

        Event::assertDispatched(AssetScrapped::class, fn ($e) => $e->asset->is($asset) && $e->writeOffAmount == 10000.0);

        $this->assertDatabaseHas('gl_posting_statuses', [
            'referenceable_type' => Asset::class,
            'referenceable_id'   => $asset->id,
            'status'             => FormStatus::PENDING->value,
        ]);
    }

    #[Test]
    public function does_not_dispatch_when_not_depreciable(): void {
        Event::fake([AssetScrapped::class]);

        $asset = Asset::factory()->create([
            'status'                => [FormStatus::ACTIVE],
            'is_depreciable'        => false,
            'gross_purchase_amount' => 10000,
        ]);

        $asset->scrap();

        Event::assertNotDispatched(AssetScrapped::class);
    }

    #[Test]
    public function does_not_dispatch_when_book_value_is_zero(): void {
        Event::fake([AssetScrapped::class]);

        $asset = Asset::factory()->create([
            'status'                => [FormStatus::ACTIVE],
            'is_depreciable'        => true,
            'gross_purchase_amount' => 0,
        ]);

        $asset->scrap();

        Event::assertNotDispatched(AssetScrapped::class);
    }
}
