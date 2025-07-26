<?php

namespace App\Services\Service;

use App\FormStatus;
use App\Models\Core\FormatingSeries;
use App\Models\Inventory\Stock;
use App\Models\ItemReserved;
use App\Models\Service\WorkOrder;
use Symfony\Component\Uid\Ulid;

class WorkOrderService {
  private function fillRelations(array $data) {
    if (!($data['for_internal'] ?? false)) {
      $data['customer_id'] = $data['customer']['id'];
      $data['customer_name'] = $data['customer']['name'];
    }
    $data['customer_branch_id'] = $data['customer_branch']['id'];
    $data['customer_branch_name'] = $data['customer_branch']['name'];
    $data['source_warehouse_id'] = $data['source_warehouse']['id'];
    $data['source_warehouse_name'] = $data['source_warehouse']['name'];
    $data['address'] = [];
    $data['item_service_id'] = $data['item_service']['id'];
    $data['item_service_name'] = $data['item_service']['sku'];
    if (isset($data['branch'])) {
      $data['branch_id'] = $data['branch']['id'];
    }

    return $data;
  }
  private function fillItemRelations(array $data) {
    $data['item_variant_id'] = $data['item']['id'];
    $data['item_name'] = $data['item']['sku'];
    $data['unit_id'] = $data['unit']['id'];
    $data['unit_name'] = $data['unit']['name'];
    $data['conversion_factor'] = $data['unit']['conversion_factor'];
    return $data;
  }
  public function create(array $data) {
    $wo = WorkOrder::create($this->fillRelations($data));

    foreach ($data['items'] as $item) {
      $item = $this->fillItemRelations($item);
      $wo->items()->create($item);
    }
    return $wo;
  }
  public function update(WorkOrder $workOrder, array $data) {
    $workOrder->update($this->fillRelations($data));

    foreach ($data['items'] as $item) {
      $item = $this->fillItemRelations($item);
      if (Ulid::isValid($item['id'])) {
        unset($item['item']);
        unset($item['unit']);
        $workOrder->items()
          ->where('id', $item['id'])
          ->update($item);
        continue;
      }
      $workOrder->items()->create($item);
    }
    $workOrder->items()
      ->whereNotIn('id', array_column($data['items'], 'id'))
      ->delete();
    return $workOrder;
  }

  public function submit(WorkOrder $workOrder) {
    $workOrder->update([
      'status' => FormStatus::SUBMITTED,
    ]);

    $items = $workOrder->items()
      ->without(['unit'])
      ->get();

    $itemsId = $items->pluck('id');

    $stocks = Stock::with(["unit"])
      ->whereIn('item_variant_id', $itemsId)
      ->where('warehouse_id', $workOrder->source_warehouse_id)
      ->orderBy('created_at')
      ->get();

    $itemInStocks = [];
    foreach ($stocks as $stock) {
      $item = $items->firstWhere('item_variant_id', $stock->item_variant_id);

      $reserved = ItemReserved::fill([
        'reserveable_type' => WorkOrder::class,
        'reserveable_id' => $workOrder->id,
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

    return $workOrder;
  }
}
