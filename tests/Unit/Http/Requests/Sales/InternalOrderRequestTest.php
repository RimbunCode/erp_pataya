<?php

namespace Tests\Unit\Http\Requests\Sales;

use App\Http\Requests\Sales\InternalOrderRequest;
use Illuminate\Validation\Rules\ProhibitedIf;
use Illuminate\Validation\Rules\RequiredIf;
use PHPUnit\Framework\TestCase;

class InternalOrderRequestTest extends TestCase {
    public function test_customer_fields_are_required_for_sales_order_reference(): void {
        $request = new InternalOrderRequest;
        $request->merge([
            'referenceable_type' => 'App\\Models\\Sales\\SalesOrder',
        ]);

        $rules = $request->rules();

        $this->assertArrayHasKey('customer.id', $rules);
        $this->assertArrayHasKey('customer_branch.id', $rules);
        $this->assertArrayHasKey('customer', $rules);

        $this->assertInstanceOf(RequiredIf::class, $rules['customer.id'][0]);
        $this->assertTrue($rules['customer.id'][0]->condition);
        $this->assertInstanceOf(RequiredIf::class, $rules['customer_branch.id'][0]);
        $this->assertTrue($rules['customer_branch.id'][0]->condition);

        $this->assertInstanceOf(ProhibitedIf::class, $rules['customer'][0]);
        $this->assertFalse($rules['customer'][0]->condition);
    }

    public function test_customer_field_is_prohibited_for_internal_order_reference(): void {
        $request = new InternalOrderRequest;
        $request->merge([
            'referenceable_type' => 'App\\Models\\Sales\\InternalOrder',
        ]);

        $rules = $request->rules();

        $this->assertInstanceOf(RequiredIf::class, $rules['customer.id'][0]);
        $this->assertFalse($rules['customer.id'][0]->condition);
        $this->assertInstanceOf(RequiredIf::class, $rules['customer_branch.id'][0]);
        $this->assertFalse($rules['customer_branch.id'][0]->condition);

        $this->assertInstanceOf(ProhibitedIf::class, $rules['customer'][0]);
        $this->assertTrue($rules['customer'][0]->condition);
    }
}
