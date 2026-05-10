<?php

namespace Tests\Feature\Inventory;

use App\Models\Inventory\Item;
use App\Models\Inventory\Unit;
use App\Services\Inventory\ItemServices;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class ItemUomBackendSyncTest extends TestCase {
    protected function setUp(): void {
        parent::setUp();

        Schema::dropIfExists('item_units');
        Schema::dropIfExists('items');
        Schema::dropIfExists('units');

        Schema::create('units', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('code');
            $table->string('name');
            $table->string('group')->nullable();
            $table->double('conversion_factor')->nullable()->default(1);
            $table->boolean('is_default')->default(false);
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
