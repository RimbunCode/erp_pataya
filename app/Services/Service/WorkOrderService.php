<?php

namespace App\Services\Service;

use App\FormStatus;
use App\Models\Core\FormatingSeries;
use App\Models\Inventory\ItemUnit;
use App\Models\Inventory\Stock;
use App\Models\ItemReserved;
use App\Models\Service\WorkOrder;
use Symfony\Component\Uid\Ulid;

class WorkOrderService
{
  private function fillRelations(array $data)
  {
    if (!($data['for_internal'] ?? false)) {
      $data['customer_id'] = $data['customer']['id'];
      $data['customer_name'] = $data['customer']['name'];
    }
    $data['customer_branch_id'] = $data['customer_branch']['id'];
    $data['customer_branch_name'] = $data['customer_branch']['name'];
    $data['address'] = [];
    $data['item_service_id'] = $data['item_service']['id'];
    $data['item_service_name'] = $data['item_service']['sku'];
    if (isset($data['branch'])) {
      $data['branch_id'] = $data['branch']['id'];
    }

    return $data;
  }
  private function fillItemRelations(array $data)
  {
    $data['item_variant_id'] = $data['item']['id'];
    $data['item_name'] = $data['item']['sku'];
    $data['unit_id'] = $data['unit']['id'];
    $data['unit_name'] = $data['unit']['name'];
    $data['conversion_factor'] = ItemUnit::getConversionFactor($data["item"]["item_id"], $data['unit_id']);
    return $data;
  }
  public function create(array $data)
  {
    $wo = WorkOrder::create($this->fillRelations($data));

    foreach ($data['items'] as $item) {
      $item = $this->fillItemRelations($item);
      $wo->items()->create($item);
    }
    $wo->logForCreated();
    return $wo;
  }
  public function update(WorkOrder $workOrder, array $data)
  {
    $workOrder->fillForUpdate($this->fillRelations($data));

    $workOrder->items()
      ->whereNotIn('id', array_column($data['items'], 'id'))
      ->update(['deleted_at' => now()]);

    foreach ($data['items'] as $item) {
      $item = $this->fillItemRelations($item);

      if (Ulid::isValid($item['id'])) {
        unset($item['item']);
        unset($item['unit']);
        $workOrder->items()
          ->where('id', $item['id'])
          ->update(values: $item);
        continue;
      }
      $workOrder->items()->create($item);
    }

    $workOrder->logForUpdated();
    return $workOrder;
  }

  public function submit(WorkOrder $workOrder)
  {
    $workOrder->update([
      'status' => FormStatus::SUBMITTED,
    ]);

    // $items = $workOrder->items()
    //   ->without(['unit'])
    //   ->get();

    // $itemsId = $items->pluck('id');


    // $itemInStocks = [];
    // foreach ($items as $item) {

    //   $reserved = ItemReserved::fill([
    //     'reserveable_type' => WorkOrder::class,
    //     'reserveable_id' => $workOrder->id,
    //     'item_variant_id' => $stock->item_variant_id,
    //     'quantity' => 0,
    //     'unit_id' => $item->unit_id,
    //   ]);

    //   if ($item->unit_id == $stock->unit_id) {
    //     $reservedQty = $item->quantity;
    //     $reserved->unit_id = $item->unit_id;
    //   } else {
    //     if ($item->unit->conversion_factor > $stock->unit->conversion_factor) {
    //       $reservedQty = $item->quantity * $item->unit->conversion_factor / $stock->unit->conversion_factor;
    //       $reserved->unit_id = $stock->unit_id;
    //     } else {
    //       $reservedQty = $item->quantity * $stock->unit->conversion_factor / $item->unit->conversion_factor;
    //       $reserved->unit_id = $item->unit_id;
    //     }
    //   }

    //   $reserved->quantity = $reservedQty;
    //   $reserved->save();
    // }

    $workOrder->logForSubmitted();

    return $workOrder;
  }
}
