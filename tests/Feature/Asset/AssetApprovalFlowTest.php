<?php

namespace Tests\Feature\Asset;

use App\Enums\FormStatus;
use App\Models\Asset\Asset;
use App\Services\Asset\AssetService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class AssetApprovalFlowTest extends TestCase {
    use RefreshDatabase;

    #[Test]
    public function on_approved_sets_active_when_available_date_passed(): void {
        $asset   = Asset::factory()->create(['available_for_use_date' => now()->subDay()]);
        $service = new AssetService;

        $service->onApproved($asset);
        $asset->refresh();

        $statusValues = array_map(fn (FormStatus $s) => $s->value, $asset->status);
        $this->assertContains(FormStatus::ACTIVE->value, $statusValues);
    }

    #[Test]
    public function on_approved_keeps_submitted_when_date_in_future(): void {
        $asset   = Asset::factory()->create(['available_for_use_date' => now()->addWeek()]);
        $service = new AssetService;

        $service->onApproved($asset);
        $asset->refresh();

        $statusValues = array_map(fn (FormStatus $s) => $s->value, $asset->status);
        $this->assertContains(FormStatus::SUBMITTED->value, $statusValues);
    }

    #[Test]
    public function on_rejected_returns_to_draft(): void {
        $asset   = Asset::factory()->create();
        $service = new AssetService;

        $service->onRejected($asset);
        $asset->refresh();

        $statusValues = array_map(fn (FormStatus $s) => $s->value, $asset->status);
        $this->assertContains(FormStatus::DRAFT->value, $statusValues);
    }
}
