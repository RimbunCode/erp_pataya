<?php

namespace App\Services\Sales;

use App\FormStatus;
use App\Models\Core\Preference;
use App\Models\Inventory\Stock;
use App\Models\Sales\InternalOrder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Session;
use Symfony\Component\Uid\Ulid;

class InternalOrderService {
  private function fillRelations(array $data) {
    // optional branch
    if (isset($data['branch'])) {
      $data['branch_id'] = $data['branch']['id'];
    }

    return $data;
  }

  private function fillItemRelations(array $data) {
    // dd($data);
    $data['item_id']             = $data['item']['id'];
    $data['unit_id']             = $data['unit']['id'];
    $data['conversion_factor']   = $data['unit']['conversion_factor'];
    $data['source_warehouse_id'] = $data['source_warehouse']['id'];
    return $data;
  }

  public function create(array $data) {
    $internalOrder = InternalOrder::create($this->fillRelations($data));
    foreach ($data['items'] as $item) {
      $item = $this->fillItemRelations($item);
      $internalOrder->items()->create($item);
    }
    $internalOrder->logForCreated();
    return $internalOrder;
  }

  public function update(InternalOrder $internalOrder, array $data) {
    $internalOrder->fillForUpdate($this->fillRelations($data));

    $internalOrder->items()
      ->whereNotIn('id', array_column($data['items'], 'id'))
      ->delete();

    foreach ($data['items'] as $item) {
      $item = $this->fillItemRelations($item);
      // dd($internal\rderd);

      if (Ulid::isValid($item['id'])) {
        unset($item['item']);
        unset($item['unit']);
        unset($item['source_warehouse']);
        $internalOrder->items()
          ->where('id', $item['id'])
          ->update($item);
        continue;
      }

      $internalOrder->items()->create($item);
    }
    $internalOrder->logForUpdated();
    return $internalOrder;
  }

  public function submit(InternalOrder $internalOrder) {
    DB::beginTransaction();

    $internalOrder->update([
      'status' => FormStatus::SUBMITTED,
    ]);

    $items      = $internalOrder->items()->get();
    $errorItems = [];

    foreach ($items as $item) {
      $stock = Stock::where('item_variant_id', $item->item_id)
        ->where('warehouse_id', $item->source_warehouse_id)
        ->lockForUpdate()
        ->first();

      if (! $stock) {
        $errorItems[] = "Item {$item->item->name} in warehouse ID {$item->source_warehouse_id} has no stock record.";
        continue;
      }

      $quantity = $item->quantity * $item->conversion_factor / $stock->conversion_factor;

      if ($stock->ready_quantity < $quantity) {
        $errorItems[] = "Item {$item->item->name} in {$stock->warehouse->name} stock is {$stock->ready_quantity} but you need {$quantity}";
        continue;
      }

      $stock->update([
        'reserved_quantity' => $stock->reserved_quantity + $quantity,
      ]);
    }

    if (count($errorItems) > 0) {
      DB::rollBack();
      Session::flash('errorItems', $errorItems);
      return $internalOrder;
    }

    DB::commit();

    return $internalOrder;
  }
}
