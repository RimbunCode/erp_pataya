<?php

namespace Tests\Feature\Settings;

use App\Models\Core\CoreSetting;
use App\Models\Finances\FinanceSetting;
use App\Models\Sales\SalesSetting;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ModuleSettingSingletonTest extends TestCase {
    use RefreshDatabase;

    public function test_current_creates_one_default_row_per_module(): void {
        $coreFirst  = CoreSetting::current();
        $coreSecond = CoreSetting::current();
        $finance    = FinanceSetting::current();
        $sales      = SalesSetting::current();

        $this->assertTrue($coreFirst->is($coreSecond));
        $this->assertSame(1, CoreSetting::query()->count());
        $this->assertSame(1, FinanceSetting::query()->count());
        $this->assertSame(1, SalesSetting::query()->count());
        $this->assertSame(25, $coreFirst->num_per_page);
        $this->assertSame(0, $finance->tax_invoice_serial_last_used);
        $this->assertNull($sales->default_tax_id);
    }

    public function test_unique_constraint_rejects_a_second_singleton(): void {
        CoreSetting::current();

        try {
            CoreSetting::create(['singleton' => true]);
            $this->fail('Second singleton row must violate unique constraint.');
        } catch (UniqueConstraintViolationException) {
            $this->assertSame(1, CoreSetting::query()->count());
        }

        $this->assertTrue(CoreSetting::current()->is(CoreSetting::query()->first()));
    }
}
