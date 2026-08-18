<?php

namespace Tests\Unit\Listeners\CRM;

use App\Events\CRM\LeadConvertedToCustomer;
use App\Listeners\CRM\CreateCustomerFromLead;
use App\Models\CRM\Lead;
use App\Models\Sales\Customer;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

class CreateCustomerFromLeadTest extends TestCase {
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

    private function makeLead(): Lead {
        return Lead::create(['company_name' => 'Acme Corp']);
    }

    private function customerData(): array {
        return [
            'name'       => 'Acme Corp',
            'email'      => 'acme@example.test',
            'phone'      => '08123456789',
            'street'     => 'Jl. Contoh No. 1',
            'city'       => 'Jakarta',
            'province'   => 'DKI Jakarta',
            'zip_code'   => '12345',
            'country_id' => null,
        ];
    }

    public function test_handle_creates_customer_with_pre_generated_id(): void {
        $lead       = $this->makeLead();
        $customerId = (string) Str::ulid();

        $event = new LeadConvertedToCustomer($lead, $customerId, $this->customerData());

        (new CreateCustomerFromLead)->handle($event);

        $customer = Customer::find($customerId);
        $this->assertNotNull($customer);
        $this->assertEquals('Acme Corp', $customer->name);
        $this->assertEquals('acme@example.test', $customer->email);
    }

    public function test_handle_updates_lead_status_and_converted_fields(): void {
        $lead       = $this->makeLead();
        $customerId = (string) Str::ulid();

        $event = new LeadConvertedToCustomer($lead, $customerId, $this->customerData());

        (new CreateCustomerFromLead)->handle($event);

        $lead->refresh();
        $this->assertEquals('converted', $lead->status);
        $this->assertEquals($customerId, $lead->converted_customer_id);
        $this->assertNotNull($lead->converted_at);
    }

    public function test_handle_creates_main_branch_for_customer(): void {
        $lead       = $this->makeLead();
        $customerId = (string) Str::ulid();

        $event = new LeadConvertedToCustomer($lead, $customerId, $this->customerData());

        (new CreateCustomerFromLead)->handle($event);

        $customer = Customer::find($customerId);
        $this->assertSame(1, $customer->branches()->where('is_main_branch', true)->count());
    }
}
