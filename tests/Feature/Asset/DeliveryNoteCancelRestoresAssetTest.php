<?php

namespace Tests\Feature\Asset;

use App\Enums\AssetMovementPurpose;
use App\Enums\FormStatus;
use App\Events\Asset\AssetSoldViaDelivery;
use App\Listeners\Asset\Rental\MarkAssetSoldFromDelivery;
use App\Models\Asset\Asset;
use App\Models\Asset\AssetDepreciationSchedule;
use App\Models\Asset\AssetMovement;
use App\Models\Core\FormatingSeries;
use App\Models\Core\GlPostingStatus;
use App\Models\Inventory\DeliveryNote;
use App\Models\Inventory\DeliveryNoteItem;
use App\Models\User\User;
use App\Services\Inventory\DeliveryNoteService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Pembatalan Delivery Note penjualan aset membalik efek MarkAssetSoldFromDelivery pada aset.
 */
class DeliveryNoteCancelRestoresAssetTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        foreach ([User::class, FormatingSeries::class, DeliveryNote::class, Asset::class, AssetMovement::class] as $model) {
            $model::initPermissions();
        }

        DB::table('preferences')->insert([
            'key'        => 'timezone', 'value' => json_encode('UTC'), 'is_example' => false,
            'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    private function makeAsset(float $quantity = 1): Asset {
        return Asset::factory()->create([
            'allow_bulk_quantity' => $quantity > 1,
            'asset_quantity'      => $quantity,
            'status'              => [FormStatus::ACTIVE],
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

    /**
     * Baris DN penjualan aset bebas (tanpa sumber SO), belum diproses.
     */
    private function makeLine(Asset $asset, float $quantity): DeliveryNoteItem {
        $deliveryNote = DeliveryNote::factory()->create();

        return DeliveryNoteItem::create([
            'delivery_note_id' => $deliveryNote->id,
            'asset_id'         => $asset->id,
            'quantity'         => $quantity,
            'valuation_rates'  => [],
        ]);
    }

    /** Meniru approve DN: listener penjualan aset berjalan. */
    private function deliver(DeliveryNoteItem $line): void {
        app(MarkAssetSoldFromDelivery::class)->handle(new AssetSoldViaDelivery($line->fresh()));
    }

    private function cancel(DeliveryNoteItem $line): void {
        app(DeliveryNoteService::class)->cancel($line->deliveryNote->fresh());
    }

    private function sellMovement(DeliveryNoteItem $line): ?AssetMovement {
        return AssetMovement::query()
            ->where('reference_type', DeliveryNote::class)
            ->where('reference_id', $line->delivery_note_id)
            ->where('purpose', AssetMovementPurpose::SELL->value)
            ->first();
    }

    #[Test]
    public function cancel_restores_fully_sold_asset(): void {
        $asset    = $this->makeAsset();
        $unposted = $this->schedule($asset);
        $posted   = $this->schedule($asset, true);
        $line     = $this->makeLine($asset, 1);

        $this->deliver($line);
        $asset->refresh();
        $this->assertSame([FormStatus::SOLD], $asset->status);
        $this->assertNotNull($asset->disposal_date);
        $this->assertSoftDeleted($unposted);

        $this->cancel($line);

        $asset->refresh();
        $this->assertEqualsWithDelta(0.0, (float) $asset->sold_quantity, 0.0001);
        $this->assertSame([FormStatus::ACTIVE], $asset->status);
        $this->assertNull($asset->disposal_date);
        $this->assertNotSoftDeleted($unposted);
        $this->assertNotSoftDeleted($posted);
        $this->assertSame([FormStatus::CANCELED], $this->sellMovement($line)->status);
        $this->assertNull($line->fresh()->processed_at);
        $this->assertSame([FormStatus::CANCELED], $line->deliveryNote->fresh()->status);
    }

    #[Test]
    public function cancel_partial_sale_restores_partially_sold_asset(): void {
        $asset    = $this->makeAsset(3);
        $schedule = $this->schedule($asset);
        $first    = $this->makeLine($asset, 1);
        $second   = $this->makeLine($asset, 1);

        $this->deliver($first);
        $this->deliver($second);
        $this->assertEqualsWithDelta(2.0, (float) $asset->fresh()->sold_quantity, 0.0001);

        $this->cancel($second);

        $asset->refresh();
        $this->assertEqualsWithDelta(1.0, (float) $asset->sold_quantity, 0.0001);
        $this->assertContains(FormStatus::ACTIVE, $asset->status);
        $this->assertContains(FormStatus::PARTIALLY_SOLD, $asset->status);
        $this->assertNotContains(FormStatus::SOLD, $asset->status);
        $this->assertNotSoftDeleted($schedule);
        $this->assertSame([FormStatus::CANCELED], $this->sellMovement($second)->status);
        $this->assertNotSame([FormStatus::CANCELED], $this->sellMovement($first)->status);

        $this->cancel($first);

        $asset->refresh();
        $this->assertEqualsWithDelta(0.0, (float) $asset->sold_quantity, 0.0001);
        $this->assertSame([FormStatus::ACTIVE], $asset->status);
    }

    #[Test]
    public function cancelling_twice_is_idempotent(): void {
        $asset  = $this->makeAsset(2);
        $first  = $this->makeLine($asset, 1);
        $second = $this->makeLine($asset, 1);

        $this->deliver($first);
        $this->deliver($second);
        $this->cancel($second);
        $this->cancel($second);

        $asset->refresh();
        $this->assertEqualsWithDelta(1.0, (float) $asset->sold_quantity, 0.0001);
        $this->assertContains(FormStatus::PARTIALLY_SOLD, $asset->status);
    }

    #[Test]
    public function scrapped_asset_is_not_restored(): void {
        $asset = $this->makeAsset(2);
        $line  = $this->makeLine($asset, 1);

        $this->deliver($line);
        $asset->refresh();
        $asset->forceFill([
            'status'        => [FormStatus::PARTIALLY_SOLD, FormStatus::SCRAPPED],
            'disposal_date' => now(),
        ])->save();

        $this->cancel($line);

        $asset->refresh();
        $this->assertEqualsWithDelta(1.0, (float) $asset->sold_quantity, 0.0001);
        $this->assertContains(FormStatus::SCRAPPED, $asset->status);
        $this->assertNotNull($asset->disposal_date);
    }

    #[Test]
    public function undelivered_line_changes_nothing(): void {
        $asset = $this->makeAsset();
        $line  = $this->makeLine($asset, 1);
        $asset->update(['sold_quantity' => 1, 'status' => [FormStatus::SOLD]]);

        $this->cancel($line);

        $asset->refresh();
        $this->assertEqualsWithDelta(1.0, (float) $asset->sold_quantity, 0.0001);
        $this->assertSame([FormStatus::SOLD], $asset->status);
        $this->assertSame([FormStatus::CANCELED], $line->deliveryNote->fresh()->status);
    }
}
