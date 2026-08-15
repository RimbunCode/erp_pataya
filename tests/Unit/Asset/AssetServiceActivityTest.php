<?php

namespace Tests\Unit\Asset;

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
}
