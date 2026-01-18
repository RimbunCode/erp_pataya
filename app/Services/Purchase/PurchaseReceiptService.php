<?php

namespace App\Services\Purchase;

use App\FormStatus;
use App\Models\Inventory\ItemUnit;
use App\Models\Inventory\Stock;
use App\Models\Inventory\StockLedgerEntry;
use App\Models\Purchase\PurchaseReceipt;
use Illuminate\Support\Facades\DB;
use Symfony\Component\Uid\Ulid;

class PurchaseReceiptService {
  private function fillRelations(array $data) {
    $data['purchase_order_id'] = $data['purchase_order']['id'];
    $data['supplier_id']       = $data['supplier']['id'];

    // optional branch
    if (isset($data['branch'])) {
      $data['branch_id'] = $data['branch']['id'];
    }

    return $data;
  }

  private function fillItemRelations(array $data) {
    $data['purchase_order_item_id'] = $data['purchase_order_item']['id'] ?? null;
    $data['item_id']                = $data['item']['id'];
    $data['unit_id']                = $data['unit']['id'] ?? '';
    $data['conversion_factor']      = ItemUnit::getConversionFactor($data['item']["item_id"], $data['unit_id']);
    $data['target_warehouse_id']    = $data['target_warehouse']['id'] ?? '';

    return $data;
  }

  public function create(array $data) {
    $purchaseReceipt = PurchaseReceipt::create($this->fillRelations($data));
    foreach ($data['items'] as $item) {
      $item = $this->fillItemRelations($item);
      $purchaseReceipt->items()->create($item);
    }
    $purchaseReceipt->logForCreated();
    return $purchaseReceipt;
  }

  public function update(PurchaseReceipt $purchaseReceipt, array $data) {
    $purchaseReceipt->fillForUpdate($this->fillRelations($data));

    $purchaseReceipt->items()
      ->whereNotIn('id', array_column($data['items'], 'id'))
      ->delete();
    foreach ($data['items'] as $item) {
      $item = $this->fillItemRelations($item);

      if (Ulid::isValid($item['id'])) {
        $purchaseReceipt->items()
          ->find($item['id'])
          ->update($item);
        continue;
      }

      $purchaseReceipt->items()->create($item);
    }

    $purchaseReceipt->logForUpdated();
    return $purchaseReceipt;
  }

  public function submit(PurchaseReceipt $purchaseReceipt) {
    $purchaseReceipt->checkApproval();
    return $purchaseReceipt;
  }

  public function onApproved(PurchaseReceipt $purchaseReceipt) {
    DB::beginTransaction();
    $purchaseReceipt->update([
      'status' => FormStatus::COMPLETED,
    ]);

    $items           = $purchaseReceipt->items()->with('item', 'item.item', 'item.defaultUnit', 'unit', 'targetWarehouse')->get();
    $orderItems      = $purchaseReceipt->purchaseOrder->items()->get();
    $discountAmount  = $purchaseReceipt->purchaseOrder->discount_amount;
    $discountPerItem = $discountAmount / $orderItems->count();

    $idItems = $items->pluck('id');
    // $totalAmount = $orderItems->sum('amount');

    $totalOrderQty  = 0;
    $totalNeededQty = 0;

    foreach ($orderItems as $item) {
      $defaultUnit             = $item->item->defaultUnit;
      $defaultConvertionFactor = $item->item->conversion_factor;
      $qtyTotal                = $item->quantity * ($item->conversion_factor / $defaultConvertionFactor);
      $qtyNeeded               = $itemReceipt->quantity * ($item->conversion_factor / $defaultConvertionFactor);

      if (!$idItems->contains($item->id)) {
        $totalOrderQty += $qtyTotal;
        continue;
      }
      $totalNeededQty += $qtyNeeded;

      $itemReceipt = $orderItems->find('id', $item->id);

      $item->item->updateHaveTransactions();
      $item->item->item->updateHaveTransactions();
      $defaultUnit             = $item->item->defaultUnit;
      $defaultConvertionFactor = $item->item->conversion_factor;
      $qtyTotal                = $item->quantity * ($item->conversion_factor / $defaultConvertionFactor);
      $qtyNeeded               = $itemReceipt->quantity * ($item->conversion_factor / $defaultConvertionFactor);

      $stockTarget = Stock::lockForUpdate()->firstOrCreate([
        'item_id'      => $item->item_id,
        'warehouse_id' => $item->target_warehouse_id,
      ], [
        'unit_id'           => $defaultUnit->id,
        'conversion_factor' => $defaultConvertionFactor,
        'stock_queue'       => [],
      ]);

      // update queue fifo in target warehouse
      $queue = $stockTarget->stock_queue;

      // update if item receipt
      $rate           = $item->amount / $qtyTotal;
      $totalAmount    = $item->amount;
      $discountRate   = $totalAmount != 0
        ? ($rate / $totalAmount) * $discountPerItem
        : 0;
      $valuation_rate = $rate - $discountRate;
      $queue[]        = [
        'rate'     => $valuation_rate,
        'quantity' => $qtyNeeded,
      ];

      $stockTarget->update([
        'actual_quantity' => $stockTarget->actual_quantity + $qtyNeeded,
        'stock_queue'     => $queue,
      ]);
      StockLedgerEntry::create([
        'item_id'               => $item->item_id,
        'warehouse_id'          => $item->target_warehouse_id,
        'unit_id'               => $defaultUnit->id,
        'conversion_factor'     => $defaultConvertionFactor,
        'quantity_change'       => $qtyNeeded,
        'quantity_after_change' => $stockTarget->actual_quantity,
        'valuation_rate'        => $stockTarget->valuation_rate,
        'balance_stock_value'   => \array_sum(array_map(fn($q) => $q['rate'] * $q['quantity'], $stockTarget->stock_queue)),
        'change_in_stock_value' => $valuation_rate * $qtyNeeded,
        'stock_queue'           => $stockTarget->stock_queue,
        'referenceable_type'    => $purchaseReceipt::class,
        'referenceable_id'      => $purchaseReceipt->id,
      ]);
    }

    $purchaseReceipt->purchaseOrder->update([
      'status' => $totalOrderQty == $totalNeededQty ? FormStatus::RECEIVED : FormStatus::PARTIALLY_RECEIVED,
    ]);

    DB::commit();

    return $purchaseReceipt;
  }

  public function onRejected(PurchaseReceipt $purchaseReceipt) {
    $purchaseReceipt->update([
      'status' => [
        FormStatus::REJECTED,
      ],
    ]);
    return $purchaseReceipt;
  }

  public function cancel(PurchaseReceipt $purchaseReceipt) {
    $purchaseReceipt->update([
      'status' => [
        FormStatus::CANCELED,
      ],
    ]);
    return $purchaseReceipt;
  }
}
