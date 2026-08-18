<?php

namespace Tests\Feature\Asset;

use App\Enums\FormStatus;
use App\Events\Asset\AssetValueAdjustmentApproved;
use App\Models\Asset\Asset;
use App\Models\Asset\AssetValueAdjustment;
use App\Services\Asset\AssetValueAdjustmentService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class AssetValueAdjustmentSubmitTest extends TestCase {
    use RefreshDatabase;

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

    #[Test]
    public function on_approved_dispatches_event_when_difference_is_nonzero(): void {
        Event::fake([AssetValueAdjustmentApproved::class]);

        $asset      = Asset::factory()->create(['gross_purchase_amount' => 5000]);
        $accountId  = $this->makeAccountId('income', 'revaluation_gain');
        $adjustment = AssetValueAdjustment::factory()->create([
            'asset_id'              => $asset->id,
            'current_asset_value'   => 5000,
            'new_asset_value'       => 6000,
            'difference_account_id' => $accountId,
        ]);

        (new AssetValueAdjustmentService)->onApproved($adjustment);

        Event::assertDispatched(AssetValueAdjustmentApproved::class, fn ($e) => $e->adjustment->is($adjustment));

        $this->assertDatabaseHas('gl_posting_statuses', [
            'referenceable_type' => AssetValueAdjustment::class,
            'referenceable_id'   => $adjustment->id,
            'status'             => FormStatus::PENDING->value,
        ]);
    }

    #[Test]
    public function on_approved_does_not_dispatch_event_when_difference_is_zero(): void {
        Event::fake([AssetValueAdjustmentApproved::class]);

        $asset      = Asset::factory()->create();
        $accountId  = $this->makeAccountId('income', 'revaluation_gain');
        $adjustment = AssetValueAdjustment::factory()->create([
            'asset_id'              => $asset->id,
            'current_asset_value'   => 5000,
            'new_asset_value'       => 5000,
            'difference_account_id' => $accountId,
        ]);

        (new AssetValueAdjustmentService)->onApproved($adjustment);

        Event::assertNotDispatched(AssetValueAdjustmentApproved::class);
        $this->assertDatabaseCount('gl_posting_statuses', 0);
    }
}
