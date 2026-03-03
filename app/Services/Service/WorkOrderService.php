<?php

namespace App\Services\Service;

use App\FormStatus;
use App\Models\Core\FormatingSeries;
use App\Models\Inventory\ItemUnit;
use App\Models\Inventory\Stock;
use App\Models\ItemReserved;
use App\Models\Service\WorkOrder;
use App\Utils;
use Symfony\Component\Uid\Ulid;

class WorkOrderService {
  private function fillRelations(array $data) {
    if (! ($data['for_internal'] ?? false)) {
      $data['customer_id']   = $data['customer']['id'];
      $data['customer_name'] = $data['customer']['name'];
    } else {
      $data['customer_id']   = null;
      $data['customer_name'] = null;
    }
    $data['customer_branch_id']   = $data['customer_branch']['id'];
    $data['customer_branch_name'] = $data['customer_branch']['name'];
    $data['address']              = [];
    $data['item_service_id']      = $data['item_service']['id'];
    $data['item_service_name']    = $data['item_service']['sku'];
    $data['branch_id']            = $data['branch']['id'] ?? null;

    return $data;
  }

  private function fillItemRelations(array $data) {
    $data['item_variant_id']   = $data['item']['id'];
    $data['item_name']         = $data['item']['sku'];
    $data['unit_id']           = $data['unit']['id'];
    $data['unit_name']         = $data['unit']['name'];
    $data['conversion_factor'] = ItemUnit::getConversionFactor($data["item"]["item_id"], $data['unit_id']);
    return $data;
  }

  public function create(array $data) {
    $data['code'] = FormatingSeries::generate(WorkOrder::class, $data, true);
    $wo           = WorkOrder::create($this->fillRelations($data));

    foreach ($data['items'] as $item) {
      $item = $this->fillItemRelations($item);
      $wo->items()->create($item);
    }
    $wo->logForCreated();
    return $wo;
  }

  public function update(WorkOrder $workOrder, array $data) {
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

  public function submit(WorkOrder $workOrder) {
    $workOrder->update([
      'code' => FormatingSeries::generate(WorkOrder::class, $workOrder),
    ]);
    $workOrder->checkApproval();
    return $workOrder;
  }

  public function onApproved(WorkOrder $workOrder) {
    $workOrder->update([
      'status' => FormStatus::PENDING,
    ]);

    return $workOrder;
  }

  public function onRejected(WorkOrder $workOrder) {
    $workOrder->update([
      'status' => [
        FormStatus::REJECTED,
      ],
    ]);
    return $workOrder;
  }

  public function start(WorkOrder $workOrder) {
    $status = Utils::replaceStatus($workOrder->status, FormStatus::PENDING, FormStatus::IN_PROGRESS);

    $workOrder->fillForUpdate([
      'status'     => $status,
      'started_at' => now(),
    ]);

    $workOrder->logForUpdated();
    return $workOrder;
  }

  public function complate(WorkOrder $workOrder) {
    $status = Utils::replaceStatus($workOrder->status, FormStatus::IN_PROGRESS, FormStatus::COMPLETED);

    $workOrder->fillForUpdate([
      'status'       => $status,
      'completed_at' => now(),
    ]);

    $workOrder->logForUpdated();
    return $workOrder;
  }
}
