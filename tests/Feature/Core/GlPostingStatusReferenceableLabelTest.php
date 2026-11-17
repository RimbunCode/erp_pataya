<?php

namespace Tests\Feature\Core;

use App\Enums\FormStatus;
use App\Models\Asset\AssetDepreciationSchedule;
use App\Models\Core\GlPostingStatus;
use App\Models\Finances\SalesInvoiceItem;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Schema;
use PHPUnit\Framework\Attributes\Test;
use ReflectionProperty;
use Tests\TestCase;

/**
 * Label dokumen sumber di daftar Status Posting GL dibentuk dari `templateLink` anak morph. Child morph hanya
 * di-SELECT tanpa relasi bersarang, jadi relasi yang dirujuk templat (`:asset.asset_name`, `:item`) harus dimuat
 * lewat `morphWith`; kalau tidak, label tampil sebagai token mentah.
 */
class GlPostingStatusReferenceableLabelTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        foreach (Schema::getTables() as $tableInfo) {
            $table = $tableInfo['name'];
            if (! Schema::hasColumn($table, 'is_example')) {
                Schema::table($table, fn ($t) => $t->boolean('is_example')->default(false));
            }
        }
    }

    #[Test]
    public function depreciation_schedule_reference_loads_its_asset_for_the_label(): void {
        $schedule = AssetDepreciationSchedule::factory()->create();
        GlPostingStatus::create([
            'referenceable_type' => AssetDepreciationSchedule::class,
            'referenceable_id'   => $schedule->id,
            'status'             => FormStatus::PENDING,
        ]);

        $status = GlPostingStatus::with('referenceable')->firstOrFail();

        $this->assertTrue($status->referenceable->relationLoaded('asset'));
        $this->assertSame(
            $schedule->asset->asset_name,
            Arr::get($status->referenceable->toArray(), 'asset.asset_name'),
        );
    }

    #[Test]
    public function sales_invoice_item_reference_is_configured_to_load_item_and_asset(): void {
        $property = new ReflectionProperty(MorphTo::class, 'morphableEagerLoads');
        $property->setAccessible(true);

        $loads = $property->getValue((new GlPostingStatus)->referenceable());

        $this->assertSame(['item', 'asset'], $loads[SalesInvoiceItem::class]);
    }

    #[Test]
    public function sales_invoice_item_label_uses_the_asset_for_asset_lines(): void {
        $this->assertSame(':asset_id ? :asset | :item', SalesInvoiceItem::templateLink());
    }
}
