<?php

namespace App\Services\CRM;

use App\Models\CRM\Lead;
use App\Models\Sales\Customer;
use App\Services\Sales\CustomerService;

class LeadService {
    public function convertToCustomer(Lead $lead): Customer {
        if ($lead->converted_customer_id) {
            return $lead->convertedCustomer;
        }

        $customer = Customer::create([
            'name'       => $lead->company_name,
            'email'      => $lead->email,
            'phone'      => $lead->phone,
            'street'     => $lead->street,
            'city'       => $lead->city,
            'province'   => $lead->province,
            'zip_code'   => $lead->zip_code,
            'country_id' => $lead->country_id,
        ]);
        app(CustomerService::class)->storeBranches($customer, []);
        $customer->logForCreated();

        $lead->update([
            'status'                => 'converted',
            'converted_customer_id' => $customer->id,
            'converted_at'          => now(),
        ]);

        return $customer;
    }
}
