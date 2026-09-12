<?php

namespace Tests\Unit\Asset;

use App\Enums\FormStatus;
use App\Models\Asset\AssetService;
use App\Models\Asset\AssetServiceActivity;
use App\Models\User\User;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class AssetServiceActivityTest extends TestCase {
    use RefreshDatabase;

    #[Test]
    public function asset_service_returns_belongs_to_relation(): void {
        $activity = new AssetServiceActivity;

        $this->assertInstanceOf(BelongsTo::class, $activity->assetService());
        $this->assertInstanceOf(AssetService::class, $activity->assetService()->getRelated());
    }

    #[Test]
    public function pic_returns_belongs_to_relation(): void {
        $activity = new AssetServiceActivity;

        $this->assertInstanceOf(BelongsTo::class, $activity->pic());
        $this->assertInstanceOf(User::class, $activity->pic()->getRelated());
    }

    #[Test]
    public function saved_sync_ignores_insertion_order_and_follows_action_date(): void {
        $service = AssetService::factory()->create();

        // Activity A: hari ini, in_progress -- disimpan LEBIH DULU.
        $activityA = AssetServiceActivity::factory()->for($service, 'assetService')->create([
            'action_date' => now(),
            'status'      => FormStatus::IN_PROGRESS,
        ]);
        $this->assertSame([FormStatus::IN_PROGRESS->value], array_map(fn ($s) => $s->value, $service->fresh()->status));

        // Activity B: KEMARIN (backdate), waiting -- disimpan SETELAH A,
        // tapi action_date-nya lebih awal dari A. Status HARUS tetap ikut A.
        AssetServiceActivity::factory()->for($service, 'assetService')->create([
            'action_date' => now()->subDay(),
            'status'      => FormStatus::WAITING,
        ]);
        $this->assertSame(
            [FormStatus::IN_PROGRESS->value],
            array_map(fn ($s) => $s->value, $service->fresh()->status),
            'activity B di-backdate ke kemarin, status AssetService seharusnya TETAP ikut activity A (action_date terbesar)',
        );

        // Edit activity A jadi BESOK -- tetap jadi action_date terbesar,
        // tapi status-nya diubah jadi resolved. Status AssetService ikut.
        $activityA->update(['action_date' => now()->addDay(), 'status' => FormStatus::RESOLVED]);
        $this->assertSame([FormStatus::RESOLVED->value], array_map(fn ($s) => $s->value, $service->fresh()->status));
    }

    #[Test]
    public function saved_sync_tie_break_uses_id_when_action_date_identical(): void {
        $service    = AssetService::factory()->create();
        $sameMoment = now();

        AssetServiceActivity::factory()->for($service, 'assetService')->create([
            'action_date' => $sameMoment,
            'status'      => FormStatus::WAITING,
        ]);
        // Activity kedua, action_date PERSIS sama, disimpan belakangan --
        // ULID-nya otomatis lebih besar (chronological), jadi menang tie-break.
        AssetServiceActivity::factory()->for($service, 'assetService')->create([
            'action_date' => $sameMoment,
            'status'      => FormStatus::ON_HOLD,
        ]);

        $this->assertSame([FormStatus::ON_HOLD->value], array_map(fn ($s) => $s->value, $service->fresh()->status));
    }
}
