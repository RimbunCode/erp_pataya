<?php

namespace App\Services\Sales;

use App\FormStatus;
use App\Models\Core\Preference;
use App\Models\Inventory\ItemUnit;
use App\Models\Inventory\Stock;
use App\Models\ItemReserved;
use App\Models\Sales\SalesOrder;
use App\Utils;
use Symfony\Component\Uid\Ulid;

class SalesOrderService
{
  private function fillRelations(array $data)
  {

    $data['customer_id'] = $data['customer']['id'];
    $data['customer_name'] = $data['customer']['name'];


    // relasi cabang customer
    $data['customer_branch_id'] = $data['customer_branch']['id'];
    $data['customer_branch_name'] = $data['customer_branch']['name'];


    // optional branch
    if (isset($data['branch'])) {
      $data['branch_id'] = $data['branch']['id'];
    }

    $defaultCurrency = Preference::find('default_currency_id')->value;
    $data['currency_code'] = !isset($data['currency']) ? $defaultCurrency : $data['currency']['code'];
    $data['base_currency_code'] = $defaultCurrency;
    return $data;
  }

  private function fillItemRelations(array $data, SalesOrder $salesOrder)
  {
    // dd($data);
    $data['item_id'] = $data['item']['id'];
    $data['unit_id'] = $data['unit']['id'];
    $data['conversion_factor'] = ItemUnit::getConversionFactor($data["item"]["item_id"], $data['unit_id']);
    $data['tax_id'] = $data['tax']['id'];
    $data['currency_code'] = $salesOrder->currency_code;
    $data['base_currency_code'] = $salesOrder->base_currency_code;
    $data['exchange_rate'] = $salesOrder->exchange_rate;
    $data['source_warehouse_id'] = $data['source_warehouse']['id'];
    $data['price'] = $data['price'] ?? 0;
    $data['price_base_currency'] =  0;

    return $data;
  }

  private function fillPaymentScheduleRelations(array $data, SalesOrder $salesOrder)
  {
    $data['for_internal'] = false;
    $data['currency_code'] = $salesOrder->currency_code;
    $data['base_currency_code'] = $salesOrder->base_currency_code;
    $data['exchange_rate'] = $salesOrder->exchange_rate;

    if (isset($data['payment_term'])) {
      $data['payment_term_id'] = $data['payment_term']['id'];
    }
    if (isset($data['payment_method'])) {
      $data['payment_method_id'] = $data['payment_method']['id'];
    }
    return $data;
  }

  public function create(array $data)
  {
    $salesOrder = SalesOrder::create($this->fillRelations($data));
    foreach ($data['items'] as $item) {
      $item = $this->fillItemRelations($item,  $salesOrder);
      $salesOrder->items()->create($item);
    }
    foreach ($data['payment_schedules'] ?? [] as $payment_schedule) {
      $payment_schedule = $this->fillPaymentScheduleRelations($payment_schedule, $salesOrder);
      $salesOrder->paymentSchedules()->create($payment_schedule);
    }
    $salesOrder->logForCreated();
    return $salesOrder;
  }

  public function update(SalesOrder $salesOrder, array $data)
  {
    $salesOrder->fillForUpdate($this->fillRelations($data));

    $salesOrder->items()
      ->whereNotIn('id', array_column($data['items'], 'id'))
      ->delete();
    foreach ($data['items'] as $item) {
      $item = $this->fillItemRelations($item, $salesOrder);

      if (Ulid::isValid($item['id'])) {
        $salesOrder->items()
          ->find($item['id'])
          ->update($item);
        continue;
      }

      $salesOrder->items()->create($item);
    }
    // dd($data);
    $salesOrder->paymentSchedules()
      ->whereNotIn('id', array_column($data['payment_schedules'], 'id'))
      ->delete();
    foreach ($data['payment_schedules'] as $payment_schedule) {
      $payment_schedule = $this->fillPaymentScheduleRelations($payment_schedule, $salesOrder);
      if (Ulid::isValid($payment_schedule['id'])) {
        $salesOrder->paymentSchedules()->find($payment_schedule['id'])->update($payment_schedule);
        continue;
      }
      $salesOrder->paymentSchedules()->create($payment_schedule);
    }
    $salesOrder->logForUpdated();
    return $salesOrder;
  }


  public function submit(SalesOrder $salesOrder)
  {
    $salesOrder->update([
      'status' => FormStatus::SUBMITTED,
    ]);

    $items = $salesOrder->items()
      ->get();

    foreach ($items as $item) {
      $remaining_qty = $item->quantity;
      $stocks = Stock::with(["unit"])
        ->where('item_variant_id', $item->id)
        ->where('warehouse_id', $item->source_warehouse_id)
        ->where('ready_quantity', '>', 0)
        ->orderBy('created_at')
        ->get();
      foreach ($stocks as $stock) {
        if (Utils::convertQuantity($stock->ready_quantity, $stock->conversion_factor, $item->conversion_factor) > $remaining_qty) {
          $stocks->reserved_quantity = $remaining_qty;
          $remaining_qty = 0;
        }
      }
    }



    foreach ($stocks as $stock) {
      $item = $items->firstWhere('item_variant_id', $stock->item_variant_id);

      $reserved = ItemReserved::fill([
        'reserveable_type' => SalesOrder::class,
        'reserveable_id' => $salesOrder->id,
        'item_variant_id' => $stock->item_variant_id,
        'stock_id' => $stock->id,
        'quantity' => 0,
        'unit_id' => $item->unit_id,
      ]);

      if ($item->unit_id == $stock->unit_id) {
        $reservedQty = $item->quantity;
        $reserved->unit_id = $item->unit_id;
      } else {
        if ($item->unit->conversion_factor > $stock->unit->conversion_factor) {
          $reservedQty = $item->quantity * $item->unit->conversion_factor / $stock->unit->conversion_factor;
          $reserved->unit_id = $stock->unit_id;
        } else {
          $reservedQty = $item->quantity * $stock->unit->conversion_factor / $item->unit->conversion_factor;
          $reserved->unit_id = $item->unit_id;
        }
      }

      $reserved->quantity = $reservedQty;
      $reserved->save();
    }

    $salesOrder->logForSubmitted();

    return $salesOrder;
  }
}
