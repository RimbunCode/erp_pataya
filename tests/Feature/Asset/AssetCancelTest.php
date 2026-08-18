<?php

namespace Tests\Feature\Asset;

use App\Models\Asset\Asset;
use App\Services\Asset\AssetService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use LogicException;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class AssetCancelTest extends TestCase {
    use RefreshDatabase;

    #[Test]
    public function cancel_service_throws_exception(): void {
        $asset   = Asset::factory()->create();
        $service = new AssetService;

        $this->expectException(LogicException::class);

        $service->cancel($asset);
    }

    #[Test]
    public function can_cancel_returns_false_on_model(): void {
        $asset = Asset::factory()->create();

        $this->assertFalse($asset->canCancel());
    }

    #[Test]
    public function can_delete_returns_false_on_model(): void {
        $asset = Asset::factory()->create();

        $this->assertFalse($asset->canDelete());
    }
}
