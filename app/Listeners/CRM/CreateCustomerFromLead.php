<?php

namespace App\Listeners\CRM;

use App\Events\CRM\LeadConvertedToCustomer;
use App\Models\Sales\Customer;
use App\Services\Sales\CustomerService;

class CreateCustomerFromLead {
    /**
     * Guard idempoten kedua (selain guard di LeadController::convert()) —
     * app/Providers/EventServiceProvider.php mendaftarkan listener ini 2x
     * dalam satu request (bug pre-existing yang mempengaruhi SEMUA event di
     * aplikasi, ditemukan 2026-08-11, di luar scope Fase 4, lihat memory
     * project_event_listener_double_registration_bug.md). Tanpa guard ini,
     * panggilan kedua bikin Customer duplikat & UNIQUE constraint gagal.
     */
    public function handle(LeadConvertedToCustomer $event): void {
        if ($event->lead->fresh()->converted_customer_id) {
            return;
        }

        $customer     = new Customer($event->customerData);
        $customer->id = $event->customerId;
        $customer->save();

        app(CustomerService::class)->storeBranches($customer, []);

        $event->lead->update([
            'status'                => 'converted',
            'converted_customer_id' => $event->customerId,
            'converted_at'          => now(),
        ]);
    }
}
