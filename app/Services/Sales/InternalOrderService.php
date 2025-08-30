<?php

namespace App\Services\Sales;

use App\FormStatus;
use App\Models\Core\Preference;
use App\Models\Sales\InternalOrder;
use Symfony\Component\Uid\Ulid;

class InternalOrderService
{
  private function fillRelations(array $data)
  {
    // optional branch
    if (isset($data['branch'])) {
      $data['branch_id'] = $data['branch']['id'];
    }
    return $data;
  }

  private function fillItemRelations(array $data)
  {
    // dd($data);
    $data['item_id'] = $data['item']['id'];
    $data['unit_id'] = $data['unit']['id'];
    $data['conversion_factor'] = $data['unit']['conversion_factor'];
    $data['source_warehouse_id'] = $data['source_warehouse']['id'];
    return $data;
  }

  public function create(array $data)
  {
    $internalOrder = InternalOrder::create($this->fillRelations($data));
    foreach ($data['items'] as $item) {
      $item = $this->fillItemRelations($item);
      $internalOrder->items()->create($item);
    }
    return $internalOrder;
  }

  public function update(InternalOrder $internalOrder, array $data)
  {
    $internalOrder->update($this->fillRelations($data));

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

    return $internalOrder;
  }

  public function submit(InternalOrder $internalOrder)
  {
    $internalOrder->update([
      'status' => FormStatus::SUBMITTED,
    ]);

    return $internalOrder;
  }
}
