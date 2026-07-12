<?php

namespace App\Services\CRM;

use App\Models\CRM\Lead;
use App\Models\CRM\LeadActivity;
use App\Models\Sales\Customer;
use App\Services\Sales\CustomerService;
use Symfony\Component\Uid\Ulid;

class LeadService {
    public function storeActivities(Lead $lead, array $activities): void {
        $activityIds = collect($activities)
            ->pluck('id')
            ->filter(fn ($id) => Ulid::isValid((string) $id))
            ->values()
            ->all();
        $existingActivities = LeadActivity::query()
            ->where('lead_id', $lead->id)
            ->whereIn('id', $activityIds)
            ->get()
            ->keyBy('id');

        $keptIds = [];
        foreach ($activities as $activity) {
            $activity['lead_id']       = $lead->id;
            $activity['assigned_to_id'] = $activity['assigned_to']['id'] ?? null;

            if (isset($activity['id']) && Ulid::isValid($activity['id'])) {
                $existingActivities->get($activity['id'])?->update($activity);
                $keptIds[] = $activity['id'];
            } else {
                $keptIds[] = LeadActivity::create($activity)->id;
            }
        }

        LeadActivity::where('lead_id', $lead->id)
            ->whereNotIn('id', $keptIds)
            ->delete();
    }

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
