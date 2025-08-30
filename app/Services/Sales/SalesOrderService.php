<?php

namespace App\Services\Sales;

use App\FormStatus;
use App\Models\Core\Preference;
use App\Models\Inventory\Stock;
use App\Models\ItemReserved;
use App\Models\Sales\SalesOrder;
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

    $data['currency_code'] = $data['currency']['code'];
    $data['base_currency_code'] = Preference::find('default_currency_id')->value;
    // dd(Preference::find('default_currency_id')->value);
    return $data;
  }

  private function fillItemRelations(array $data, array $salesOrder)
  {
    // dd($data);
    $data['item_id'] = $data['item']['id'];
    $data['unit_id'] = $data['unit']['id'];
    $data['conversion_factor'] = $data['unit']['conversion_factor'];
    $data['tax_id'] = $data['tax']['id'];
    $data['currency_code'] = $salesOrder['currency']['code'];
    $data['base_currency_code'] = Preference::find('default_currency_id')->value;
    $data['exchange_rate'] = $salesOrder['exchange_rate'];
    $data['source_warehouse_id'] = $data['source_warehouse']['id'];
    $data['price'] = $data['price'] ?? 0;
    $data['price_base_currency'] =  0;
    return $data;
  }

  public function create(array $data)
  {
    $salesOrder = SalesOrder::create($this->fillRelations($data));
    foreach ($data['items'] as $item) {
      $item = $this->fillItemRelations($item, $data);
      $salesOrder->items()->create($item);
    }
    return $salesOrder;
  }

  public function update(SalesOrder $salesOrder, array $data)
  {
    $salesOrder->update($this->fillRelations($data));

    $salesOrder->items()
      ->whereNotIn('id', array_column($data['items'], 'id'))
      ->delete();
    foreach ($data['items'] as $item) {
      $item = $this->fillItemRelations($item, $data);

      if (Ulid::isValid($item['id'])) {
        unset($item['item']);
        unset($item['unit']);
        unset($item['tax']);
        unset($item['source_warehouse']);
        $salesOrder->items()
          ->where('id', $item['id'])
          ->update($item);
        continue;
      }

      $salesOrder->items()->create($item);
    }

    return $salesOrder;
  }

  public function submit(SalesOrder $salesOrder)
  {
    $salesOrder->update([
      'status' => FormStatus::SUBMITTED,
    ]);

    return $salesOrder;
  }
}
