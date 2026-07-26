<?php

namespace Tests\Feature\Sales;

use App\Http\Requests\Sales\CustomerRequest;
use App\Models\Sales\Customer;
use Database\Factories\Core\CountryFactory;
use Database\Factories\Sales\CustomerFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Route;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Validator;
use Tests\TestCase;

class CustomerRequestTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        foreach (Schema::getTables() as $tableInfo) {
            $table = $tableInfo['name'];
            if (! Schema::hasColumn($table, 'is_example')) {
                Schema::table($table, fn ($t) => $t->boolean('is_example')->default(false));
            }
        }

        CountryFactory::new()->create(['code' => 'IDN']);
    }

    public function test_name_must_be_unique_on_create(): void {
        CustomerFactory::new()->create(['name' => 'TechVision Solutions Ltd']);

        $request   = $this->makeRequest($this->validPayload(['name' => 'TechVision Solutions Ltd']));
        $validator = Validator::make($request->all(), $request->rules());

        $this->assertTrue($validator->fails());
        $this->assertArrayHasKey('name', $validator->errors()->toArray());
    }

    public function test_name_unique_rule_ignores_current_customer_on_update(): void {
        $customer = CustomerFactory::new()->create(['name' => 'TechVision Solutions Ltd']);

        $request = $this->makeRequest(
            $this->validPayload(['name' => 'TechVision Solutions Ltd']),
            $customer,
        );
        $validator = Validator::make($request->all(), $request->rules());

        $this->assertFalse($validator->fails(), json_encode($validator->errors()->toArray()));
    }

    public function test_name_must_be_unique_on_update_against_other_customer(): void {
        CustomerFactory::new()->create(['name' => 'TechVision Solutions Ltd']);
        $customer = CustomerFactory::new()->create(['name' => 'Other Customer']);

        $request = $this->makeRequest(
            $this->validPayload(['name' => 'TechVision Solutions Ltd']),
            $customer,
        );
        $validator = Validator::make($request->all(), $request->rules());

        $this->assertTrue($validator->fails());
        $this->assertArrayHasKey('name', $validator->errors()->toArray());
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function makeRequest(array $payload, ?Customer $customer = null): CustomerRequest {
        $request = CustomerRequest::create(
            $customer ? "/customers/{$customer->id}" : '/customers',
            $customer ? 'PUT' : 'POST',
            $payload,
        );

        if ($customer) {
            $request->setRouteResolver(function () use ($request, $customer) {
                $route = new Route('PUT', 'customers/{customer}', []);
                $route->bind($request);
                $route->setParameter('customer', $customer);

                return $route;
            });
        }

        return $request;
    }

    /**
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    private function validPayload(array $overrides = []): array {
        return array_replace_recursive([
            'name'     => 'Valid Customer Name',
            'phone'    => '08123456789',
            'email'    => 'valid@example.com',
            'vat'      => 'TAX-12.345.678',
            'street'   => 'Jl. Test No. 1',
            'city'     => 'Jakarta',
            'province' => 'DKI Jakarta',
            'zip_code' => '12345',
            'country'  => ['code' => 'IDN'],
            'branches' => [],
        ], $overrides);
    }
}
