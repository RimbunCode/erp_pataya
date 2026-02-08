<?php

namespace App\Services\Finances;

use App\Models\Core\Preference;
use App\Models\Finances\PaymentEntry;
use Illuminate\Support\Facades\DB;

class PaymentEntryService {
  private function fillRelations(array $data) {
    if (isset($data['default_account'])) {
      $data['default_account_id'] = $data['default_account']['id'];
    }
    $defaultCurrency            = Preference::find('default_currency_id')->value;
    $data['currency_code']      = !isset($data['currency']) ? $defaultCurrency : $data['currency']['code'];
    $data['base_currency_code'] = $defaultCurrency;
    $data['partyable_id']       = $data['partyable']['id'];
    $data['partyable_type']     = $data['payment_type'] == 'pay' ? \App\Models\Purchase\Supplier::class : \App\Models\Sales\Customer::class;
    $data['paymentable_id']     = $data['paymentable']['id'];
    $data['paymentable_type']   = $data['payment_type'] == 'pay' ? \App\Models\Finances\PurchaseInvoice::class : \App\Models\Finances\SalesInvoice::class;
    if (isset($data['payment_method'])) {
      $data['payment_method_id'] = $data['payment_method']['id'];
    }
    $data['account_paid_to_id']   = $data['account_paid_to']['id'];
    $data['account_paid_from_id'] = $data['account_paid_from']['id'];

    return $data;
  }

  public function create(array $data) {
    DB::beginTransaction();
    $paymentEntry = PaymentEntry::create($this->fillRelations($data));
    $paymentEntry->logForCreated();
    DB::commit();
    return $paymentEntry;
  }

  public function update(PaymentEntry $paymentEntry, array $data) {
    DB::beginTransaction();
    $paymentEntry->fillForUpdate($this->fillRelations($data));
    $paymentEntry->logForUpdated();
    DB::commit();
    return $paymentEntry;
  }
}
