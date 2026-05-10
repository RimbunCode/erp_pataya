<?php

namespace Tests\Feature\Inventory;

use App\Models\Inventory\Unit;
use Tests\TestCase;

class UnitGroupAttributeTest extends TestCase {
    public function test_null_group_is_exposed_as_others(): void {
        $unit        = new Unit;
        $unit->group = null;

        $this->assertSame('Others', $unit->group);
        $this->assertNull($unit->getAttributes()['group']);
    }

    public function test_others_group_is_persisted_as_null_attribute(): void {
        $unit        = new Unit;
        $unit->group = 'Others';

        $this->assertSame('Others', $unit->group);
        $this->assertNull($unit->getAttributes()['group']);
    }

    public function test_non_others_group_value_is_preserved(): void {
        $unit        = new Unit;
        $unit->group = 'Length';

        $this->assertSame('Length', $unit->group);
        $this->assertSame('Length', $unit->getAttributes()['group']);
    }
}

