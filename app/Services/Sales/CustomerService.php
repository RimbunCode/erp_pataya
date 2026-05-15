<?php

namespace App\Services\Sales;

use App\Models\Core\Branch;
use App\Models\Sales\Customer;
use Symfony\Component\Uid\Ulid;

class CustomerService {
    public function storeBranches(Customer $customer, array $branches) {
        $mainBranch = $customer->branches()->where('is_main_branch', true)->first();
        $branches   = [
            [
                'id'                  => $mainBranch?->id,
                'code'                => str_replace(' ', '-', $customer->name),
                'name'                => $customer->name,
                'is_main_branch'      => true,
                'shipping_country_id' => $customer->country_id,
                'shipping_street'     => $customer->street,
                'shipping_city'       => $customer->city,
                'shipping_state'      => $customer->state,
                'shipping_zip_code'   => $customer->zip_code,
                'billing_address'     => 'same_shipping',
            ],
            ...$branches,
        ];
        $branchIds = collect($branches)
            ->pluck('id')
            ->filter(fn ($id) => Ulid::isValid((string) $id))
            ->values()
            ->all();
        $existingBranches = Branch::query()
            ->whereIn('id', $branchIds)
            ->get()
            ->keyBy('id');
        foreach ($branches as $branch) {
            $branch['branchable_type'] = Customer::class;
            $branch['branchable_id']   = $customer->id;
            if (isset($branch['shipping_country'])) {
                $branch['shipping_country_id'] = $branch['shipping_country']['code'];
            }
            switch ($branch['billing_address']) {
                case 'separate':
                    if (isset($branch['billing_country'])) {
                        $branch['billing_country_id'] = $branch['billing_country']['code'];
                    }
                    break;
                default:
                    $branch['billing_country_id'] = null;
                    $branch['billing_street']     = null;
                    $branch['billing_city']       = null;
                    $branch['billing_state']      = null;
                    $branch['billing_zip_code']   = null;
                    break;
            }
            if (isset($branch['id']) && Ulid::isValid($branch['id'])) {
                $existingBranches->get($branch['id'])?->update($branch);
            } else {
                Branch::create($branch);
            }
        }
    }
}
