<?php

namespace App\Services\Purchase;

use App\FormStatus;
use App\Models\Core\Preference;
use App\Models\Inventory\ItemUnit;
use App\Models\Inventory\Stock;
use App\Models\Purchase\PurchaseOrder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Session;
use Symfony\Component\Uid\Ulid;

class PurchaseOrderService {
  private function fillRelations(array $data) {
    $data['supplier_id']   = $data['supplier']['id'];
    $data['supplier_name'] = $data['supplier']['name'];

    // optional branch
    if (isset($data['branch'])) {
      $data['branch_id'] = $data['branch']['id'];
    }

    $defaultCurrency            = Preference::find('default_currency_id')->value;
    $data['currency_code']      = !isset($data['currency']) ? $defaultCurrency : $data['currency']['code'];
    $data['base_currency_code'] = $defaultCurrency;

    return $data;
  }

  private function fillItemRelations(array $data, PurchaseOrder $purchaseOrder) {
    $data['item_id']             = $data['item']['id'];
    $data['unit_id']             = $data['unit']['id'];
    $data['conversion_factor']   = ItemUnit::getConversionFactor($data["item"]["item_id"], $data['unit_id']);
    $data['exchange_rate']       = $purchaseOrder->exchange_rate;
    $data['tax_id']              = $data['tax']['id'];
    $data['tax_rate']            = $data['tax']['rate'] ?? 0;
    $data['target_warehouse_id'] = $data['target_warehouse']['id'];

    return $data;
  }

  private function fillPaymentScheduleRelations(array $data, PurchaseOrder $purchaseOrder) {
    $data['currency_code']      = $purchaseOrder->currency_code;
    $data['base_currency_code'] = $purchaseOrder->base_currency_code;
    $data['exchange_rate']      = $purchaseOrder->exchange_rate;

    if (isset($data['payment_term'])) {
      $data['payment_term_id'] = $data['payment_term']['id'];
    }
    if (isset($data['payment_method'])) {
      $data['payment_method_id'] = $data['payment_method']['id'];
    }
    return $data;
  }

  public function create(array $data) {
    $purchaseOrder = PurchaseOrder::create($this->fillRelations($data));
    foreach ($data['items'] as $item) {
      $item = $this->fillItemRelations($item, $purchaseOrder);
      $purchaseOrder->items()->create($item);
    }
    foreach ($data['payment_schedules'] ?? [] as $payment_schedule) {
      $payment_schedule = $this->fillPaymentScheduleRelations($payment_schedule, $purchaseOrder);
      $purchaseOrder->paymentSchedules()->create($payment_schedule);
    }
    $purchaseOrder->logForCreated();
    return $purchaseOrder;
  }

  public function update(PurchaseOrder $purchaseOrder, array $data) {
    $purchaseOrder->fillForUpdate($this->fillRelations($data));

    $purchaseOrder->items()
      ->whereNotIn('id', array_column($data['items'], 'id'))
      ->delete();
    foreach ($data['items'] as $item) {
      $item = $this->fillItemRelations($item, $purchaseOrder);

      if (Ulid::isValid($item['id'])) {
        $purchaseOrder->items()
          ->find($item['id'])
          ->update($item);
        continue;
      }

      $purchaseOrder->items()->create($item);
    }
    if (\array_key_exists('payment_schedules', $data)) {

      $purchaseOrder->paymentSchedules()
        ->whereNotIn('id', array_column($data['payment_schedules'], 'id'))
        ->delete();
      foreach ($data['payment_schedules'] as $payment_schedule) {
        $payment_schedule = $this->fillPaymentScheduleRelations($payment_schedule, $purchaseOrder);
        if (Ulid::isValid($payment_schedule['id'])) {
          $purchaseOrder->paymentSchedules()->find($payment_schedule['id'])->update($payment_schedule);
          continue;
        }
        $purchaseOrder->paymentSchedules()->create($payment_schedule);
      }
    }

    $purchaseOrder->logForUpdated();
    return $purchaseOrder;
  }

  public function submit(PurchaseOrder $purchaseOrder) {
    DB::beginTransaction();

    $purchaseOrder->update([
      'status' => FormStatus::TO_RECEIVE,
    ]);

    $purchaseOrder->logForSubmitted();
    DB::commit();

    return $purchaseOrder;
  }
}
