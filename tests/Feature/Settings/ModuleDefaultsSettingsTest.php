<?php

namespace Tests\Feature\Settings;

use App\Models\Core\Branch;
use App\Models\Finances\PaymentTermTemplate;
use App\Models\Finances\Tax;
use App\Models\Inventory\InventorySetting;
use App\Models\Inventory\Warehouse;
use App\Models\Purchase\PurchaseSetting;
use App\Models\Sales\SalesSetting;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Tests\TestCase;

class ModuleDefaultsSettingsTest extends TestCase {
    use RefreshDatabase;

    public function test_default_module_settings_start_neutral(): void {
        $purchase  = PurchaseSetting::current();
        $sales     = SalesSetting::current();
        $inventory = InventorySetting::current();

        $this->assertNull($purchase->default_tax_id);
        $this->assertNull($purchase->default_target_warehouse_id);
        $this->assertNull($purchase->default_payment_term_template_id);
        $this->assertNull($purchase->over_receipt_tolerance_percent);
        $this->assertNull($purchase->over_billing_tolerance_percent);
        $this->assertSame('none', $purchase->rate_change_action);
        $this->assertNull($sales->default_tax_id);
        $this->assertNull($sales->default_source_warehouse_id);
        $this->assertNull($sales->default_payment_term_template_id);
        $this->assertNull($sales->over_delivery_tolerance_percent);
        $this->assertNull($sales->over_billing_tolerance_percent);
        $this->assertSame('none', $sales->rate_change_action);
        $this->assertSame('none', $sales->below_cost_action);
        $this->assertNull($inventory->default_warehouse_id);
    }

    public function test_rate_change_action_is_validated_for_purchase_and_sales(): void {
        foreach ([PurchaseSetting::class, SalesSetting::class] as $modelClass) {
            $field = 'rate_change_action';

            foreach (['none', 'warn', 'stop'] as $value) {
                $rules = [$field => $modelClass::rules()[$field]];
                $this->assertTrue(Validator::make([$field => $value], $rules)->passes());
            }

            $rules = [$field => $modelClass::rules()[$field]];
            $this->assertFalse(Validator::make([$field => 'ignore'], $rules)->passes());
        }
    }

    public function test_below_cost_action_is_validated_and_disabled_by_default(): void {
        $field = 'below_cost_action';
        $rules = [SalesSetting::rules()[$field] ?? []];

        foreach (['none', 'warn', 'stop'] as $value) {
            $this->assertTrue(Validator::make([$field => $value], [$field => $rules[0]])->passes());
        }

        $this->assertFalse(Validator::make([$field => 'allow'], [$field => $rules[0]])->passes());
    }

    public function test_tolerance_rules_accept_zero_and_one_hundred_but_reject_out_of_range_values(): void {
        foreach ([
            PurchaseSetting::class => ['over_receipt_tolerance_percent', 'over_billing_tolerance_percent'],
            SalesSetting::class    => ['over_delivery_tolerance_percent', 'over_billing_tolerance_percent'],
        ] as $modelClass => $fields) {
            foreach ($fields as $field) {
                $rules = [$field => $modelClass::rules()[$field]];

                foreach ([null, 0, 100] as $validValue) {
                    $this->assertTrue(Validator::make([$field => $validValue], $rules)->passes());
                }

                foreach ([-0.01, 100.01] as $invalidValue) {
                    $this->assertFalse(Validator::make([$field => $invalidValue], $rules)->passes());
                }
            }
        }
    }

    public function test_deleting_default_references_sets_module_settings_to_null(): void {
        $branch = Branch::query()->create([
            'name' => 'Default settings test branch',
        ]);
        $tax = Tax::query()->create([
            'name' => 'Default settings test tax',
            'rate' => 11,
        ]);
        $warehouse = Warehouse::query()->create([
            'branch_id' => $branch->id,
            'name'      => 'Default settings test warehouse',
            'code'      => 'DST-WH',
        ]);
        $paymentTermTemplate = PaymentTermTemplate::query()->create([
            'name' => 'Default settings test payment term',
        ]);

        $purchase = PurchaseSetting::current();
        $purchase->fill([
            'default_tax_id'                   => $tax->id,
            'default_target_warehouse_id'      => $warehouse->id,
            'default_payment_term_template_id' => $paymentTermTemplate->id,
        ])->save();

        $sales = SalesSetting::current();
        $sales->fill([
            'default_tax_id'                   => $tax->id,
            'default_source_warehouse_id'      => $warehouse->id,
            'default_payment_term_template_id' => $paymentTermTemplate->id,
        ])->save();

        $inventory                       = InventorySetting::current();
        $inventory->default_warehouse_id = $warehouse->id;
        $inventory->save();

        DB::table('taxes')->where('id', $tax->id)->delete();
        DB::table('warehouses')->where('id', $warehouse->id)->delete();
        DB::table('payment_term_templates')->where('id', $paymentTermTemplate->id)->delete();

        $this->assertNull($purchase->fresh()->default_tax_id);
        $this->assertNull($purchase->fresh()->default_target_warehouse_id);
        $this->assertNull($purchase->fresh()->default_payment_term_template_id);
        $this->assertNull($sales->fresh()->default_tax_id);
        $this->assertNull($sales->fresh()->default_source_warehouse_id);
        $this->assertNull($sales->fresh()->default_payment_term_template_id);
        $this->assertNull($inventory->fresh()->default_warehouse_id);
    }
}
