<?php

namespace App\Services\Sales;

use App\Models\Core\Branch;
use App\Models\Sales\Customer;
use Symfony\Component\Uid\Ulid;

class CustomerService {
  public function storeBranches(Customer $customer, array $branches) {
    $mainBranch = collect($branches)->where('is_main_branch', true)->first();
    if (!$mainBranch) {
      $branches = [
        [
          'name' => $customer->name,
          'is_main_branch' => true,
          'shipping_country_id' => $customer->country_id,
          'shipping_street' => $customer->shipping_street,
          'shipping_city' => $customer->shipping_city,
          'shipping_state' => $customer->shipping_state,
          'shipping_zip_code' => $customer->shipping_zip_code,
          'billing_address' => 'same_shipping',
        ]
      ];
    }
    foreach ($branches as $branch) {
      $branch['branchable_type'] = Customer::class;
      $branch['branchable_id'] = $customer->id;
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
          $branch['billing_street'] = null;
          $branch['billing_city'] = null;
          $branch['billing_state'] = null;
          $branch['billing_zip_code'] = null;
          break;
      }
      if (isset($branch['id']) && Ulid::isValid($branch['id'])) {
        Branch::where('id', $branch['id'])
          ->first()
          ?->update($branch);
      } else {
        Branch::create($branch);
      }
    }
  }
}
