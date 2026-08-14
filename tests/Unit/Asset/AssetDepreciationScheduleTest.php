<?php

namespace Tests\Unit\Asset;

use App\Models\Asset\Asset;
use App\Models\Asset\AssetDepreciationSchedule;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphOne;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class AssetDepreciationScheduleTest extends TestCase {
    use RefreshDatabase;

    #[Test]
    public function asset_returns_belongs_to_relation(): void {
        $schedule = new AssetDepreciationSchedule;

        $this->assertInstanceOf(BelongsTo::class, $schedule->asset());
        $this->assertInstanceOf(Asset::class, $schedule->asset()->getRelated());
    }

    #[Test]
    public function gl_posting_status_returns_morph_one_relation(): void {
        $schedule = new AssetDepreciationSchedule;

        $this->assertInstanceOf(MorphOne::class, $schedule->glPostingStatus());
    }

    #[Test]
    public function asset_depreciation_schedules_relation_returns_created_rows(): void {
        $asset = Asset::factory()->create();
        AssetDepreciationSchedule::factory()->count(3)->create(['asset_id' => $asset->id]);

        $this->assertCount(3, $asset->depreciationSchedules);
    }
}
