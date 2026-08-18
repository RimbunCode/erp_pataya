<?php

namespace App\Events\CRM;

use App\Models\CRM\Lead;
use Illuminate\Foundation\Events\Dispatchable;

class LeadConvertedToCustomer {
    use Dispatchable;

    public function __construct(
        public readonly Lead $lead,
        public readonly string $customerId,
        public readonly array $customerData,
    ) {}
}
