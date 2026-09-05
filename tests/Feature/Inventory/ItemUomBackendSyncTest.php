<?php

namespace Tests\Feature\Inventory;

use App\Models\Inventory\Item;
use App\Models\Inventory\ItemUnit;
use App\Models\Inventory\Unit;
use App\Services\Inventory\ItemServices;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class ItemUomBackendSyncTest extends TestCase {
    protected function setUp(): void {
        parent::setUp();

        Schema::dropIfExists('permissions');
        Schema::dropIfExists('item_units');
        Schema::dropIfExists('items');
        Schema::dropIfExists('units');

        // RecordAuditLog listener mencatat audit log utk SEMUA model
        // created/updated tanpa syarat user terautentikasi -- Unit::create()
        // (via createUnit() helper di bawah) memicunya. Stub tabel `logs`
        // kalau belum ada (test ini tidak pakai RefreshDatabase, dan TIDAK
        // di-drop+recreate spt tabel lain di atas krn `logs` dipakai bersama
        // test lain dalam :memory: yang sama). Skema identik migration
        // create_logs_table + add_action_to_logs_table.
        if (! Schema::hasTable('logs')) {
            Schema::create('logs', function (Blueprint $table) {
                $table->ulid('id')->primary();
                $table->longText('activity');
                $table->json('comment_json')->nullable();
                $table->text('notes')->nullable();
                $table->string('type')->default('log');
                $table->string('action')->nullable();
                $table->json('data_before')->nullable();
                $table->json('data_after')->nullable();
                $table->ulidMorphs('loggable');
                $table->char('user_id', 26)->nullable();
                $table->timestamps();
                $table->softDeletes();
            });
        }

        Schema::create('permissions', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('model');
            $table->foreignUlid('role_id')->nullable();
            $table->integer('level')->default(0);
            $table->boolean('only_creator')->default(false);
            $table->json('permissions')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('units', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('code');
            $table->string('name');
            $table->string('group')->nullable();
            $table->double('conversion_factor')->nullable()->default(1);
            $table->boolean('is_default')->default(false);
            $table->boolean('is_example')->default(false);
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('items', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('code');
            $table->string('name');
            $table->foreignUlid('default_unit_id')->nullable();
            $table->double('conversion_factor')->nullable()->default(1);
            $table->string('type');
            $table->boolean('have_transactions')->default(false);
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('item_units', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('item_id');
            $table->foreignUlid('unit_id');
            $table->double('conversion_factor')->nullable()->default(1);
            $table->boolean('is_manual')->nullable();
            $table->boolean('generated_by_default_unit')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function test_sanitize_uoms_keeps_only_one_non_others_group_and_ensures_default_unit(): void {
        $defaultUnit = $this->createUnit([
            'group'             => null,
            'conversion_factor' => null,
        ]);
        $lengthMeter = $this->createUnit([
            'group'             => 'Length',
            'conversion_factor' => 1,
        ]);
        $lengthCentimeter = $this->createUnit([
            'group'             => 'Length',
            'conversion_factor' => 0.01,
        ]);
        $weightKilogram = $this->createUnit([
            'group'             => 'Weight',
            'conversion_factor' => 1,
        ]);
        $globalOther = $this->createUnit([
            'group'             => null,
            'conversion_factor' => null,
        ]);

        $service = new ItemServices;

        $result = $service->sanitizeUoms($defaultUnit->id, [
            [
                'id'                     => $lengthMeter->id,
                'conversion_factor'      => 1,
                'isManual'               => true,
                'generatedByDefaultUnit' => false,
            ],
            [
                'id'                     => $weightKilogram->id,
                'conversion_factor'      => 1,
                'isManual'               => true,
                'generatedByDefaultUnit' => false,
            ],
            [
                'id'                     => $lengthCentimeter->id,
                'conversion_factor'      => 0.01,
                'isManual'               => false,
                'generatedByDefaultUnit' => false,
            ],
            [
                'id'                     => $globalOther->id,
                'conversion_factor'      => null,
                'isManual'               => true,
                'generatedByDefaultUnit' => false,
            ],
        ]);

        $resultIds = array_column($result, 'id');

        $this->assertContains($defaultUnit->id, $resultIds);
        $this->assertContains($lengthMeter->id, $resultIds);
        $this->assertContains($lengthCentimeter->id, $resultIds);
        $this->assertContains($globalOther->id, $resultIds);
        $this->assertNotContains($weightKilogram->id, $resultIds);
    }

    public function test_item_uoms_read_uses_saved_flags_and_injects_default_unit_when_missing(): void {
        $defaultUnit = $this->createUnit([
            'group'             => null,
            'conversion_factor' => null,
        ]);
        $lengthMeter = $this->createUnit([
            'group'             => 'Length',
            'conversion_factor' => 1,
        ]);
        $lengthCentimeter = $this->createUnit([
            'group'             => 'Length',
            'conversion_factor' => 0.01,
        ]);

        $item = Item::create([
            'code'              => 'ITEM-TEST-1',
            'name'              => 'Item Test 1',
            'default_unit_id'   => $defaultUnit->id,
            'conversion_factor' => null,
            'type'              => 'stock',
        ]);

        $item->uom()->create([
            'unit_id'                   => $lengthMeter->id,
            'conversion_factor'         => 1,
            'is_manual'                 => true,
            'generated_by_default_unit' => false,
        ]);
        $item->uom()->create([
            'unit_id'                   => $lengthCentimeter->id,
            'conversion_factor'         => 0.01,
            'is_manual'                 => false,
            'generated_by_default_unit' => false,
        ]);

        $reflection = new \ReflectionMethod($item, 'uoms');
        $reflection->setAccessible(true);
        $uoms = collect($reflection->invoke($item));

        $manualRow = $uoms->firstWhere('id', $lengthMeter->id);
        $this->assertNotNull($manualRow);
        $this->assertTrue($manualRow['isManual']);
        $this->assertFalse($manualRow['readOnly']);
        $this->assertFalse($manualRow['generatedByDefaultUnit']);

        $nonManualRow = $uoms->firstWhere('id', $lengthCentimeter->id);
        $this->assertNotNull($nonManualRow);
        $this->assertFalse($nonManualRow['isManual']);
        $this->assertTrue($nonManualRow['readOnly']);
        $this->assertFalse($nonManualRow['generatedByDefaultUnit']);

        $defaultRow = $uoms->firstWhere('id', $defaultUnit->id);
        $this->assertNotNull($defaultRow);
        $this->assertTrue($defaultRow['readOnly']);
        $this->assertFalse($defaultRow['isManual']);
        $this->assertTrue($defaultRow['generatedByDefaultUnit']);
    }

    public function test_item_unit_query_can_filter_by_units_table_through_global_scope(): void {
        $unit = $this->createUnit([
            'name' => 'Joined Unit',
        ]);

        $item = Item::create([
            'code'              => 'ITEM-TEST-2',
            'name'              => 'Item Test 2',
            'default_unit_id'   => $unit->id,
            'conversion_factor' => null,
            'type'              => 'stock',
        ]);

        $item->uom()->create([
            'unit_id'                   => $unit->id,
            'conversion_factor'         => 1,
            'is_manual'                 => true,
            'generated_by_default_unit' => false,
        ]);

        $itemUnit = ItemUnit::where('units.name', 'Joined Unit')->first();

        $this->assertNotNull($itemUnit);
        $this->assertSame($unit->id, $itemUnit->unit_id);
        $this->assertSame($item->id, $itemUnit->item_id);
    }

    public function test_get_conversion_factor_works_with_units_join_global_scope(): void {
        $unit = $this->createUnit();

        $item = Item::create([
            'code'              => 'ITEM-TEST-3',
            'name'              => 'Item Test 3',
            'default_unit_id'   => $unit->id,
            'conversion_factor' => null,
            'type'              => 'stock',
        ]);

        $item->uom()->create([
            'unit_id'                   => $unit->id,
            'conversion_factor'         => 2.5,
            'is_manual'                 => true,
            'generated_by_default_unit' => false,
        ]);

        $conversionFactor = ItemUnit::getConversionFactor($item->id, $unit->id);

        $this->assertSame(2.5, $conversionFactor);
    }

    private function createUnit(array $attributes = []): Unit {
        static $index = 0;
        $index++;

        return Unit::create([
            'code'              => sprintf('UOM-%03d', $index),
            'name'              => sprintf('Unit %03d', $index),
            'group'             => 'Length',
            'conversion_factor' => 1,
            'is_default'        => false,
            ...$attributes,
        ]);
    }
}
