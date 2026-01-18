<?php

namespace App\Services\Sales;

use App\Models\Sales\SalesReturn;
use App\Models\Sales\SalesOrder;
use App\Models\Inventory\ItemUnit;
use Illuminate\Support\Facades\DB;
use Symfony\Component\Uid\Ulid;

class SalesReturnService {
  private function fillRelations(array $data) {
    // Sales return biasanya punya sales_order yang direferensikan
    $data['delivery_note_id'] = $data['delivery_note']['id'];
    $data['sales_order_id']   = $data['delivery_note']['referenceable_id'];

    return $data;
  }

  private function fillItemRelations(array $item, SalesReturn $salesReturn) {
    $item['item_id']             = $item['item']['id'];
    $item['unit_id']             = $item['unit']['id'];
    $item['target_warehouse_id'] = $item['target_warehouse']['id'];
    $item['source_warehouse_id'] = $item['source_warehouse']['id'] ?? null;
    $item['conversion_factor']   = ItemUnit::getConversionFactor($item['item']['item_id'], $item['unit_id']);
    $item['quantity']            = $item['quantity'] ?? 0;

    return $item;
  }

  public function create(array $data) {
    return DB::transaction(function () use ($data) {
      $salesReturn = SalesReturn::create($this->fillRelations($data));

      foreach ($data['items'] as $item) {
        $item = $this->fillItemRelations($item, $salesReturn);
        $salesReturn->items()->create($item);
      }

      $salesReturn->logForCreated(); // kalau kamu punya trait logging seperti di SalesOrder

      return $salesReturn;
    });
  }

  public function update(SalesReturn $salesReturn, array $data) {
    return DB::transaction(function () use ($salesReturn, $data) {
      $salesReturn->fillForUpdate($this->fillRelations($data));

      // Hapus item yang tidak lagi ada
      $salesReturn->items()
        ->whereNotIn('id', array_column($data['items'], 'id'))
        ->delete();

      foreach ($data['items'] as $item) {
        $item = $this->fillItemRelations($item, $salesReturn);

        if (Ulid::isValid($item['id'])) {
          $salesReturn->items()->find($item['id'])->update($item);
          continue;
        }

        $salesReturn->items()->create($item);
      }

      $salesReturn->logForUpdated();

      return $salesReturn;
    });
  }

  public function submit() {
    //
  }
}
