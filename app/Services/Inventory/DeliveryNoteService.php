<?php

namespace App\Services\Inventory;

use App\FormStatus;
use App\Models\Core\ModelConnection;
use App\Models\Inventory\DeliveryNote;
use App\Models\Inventory\ItemUnit;
use App\Models\Inventory\Stock;
use App\Models\Inventory\StockLedgerEntry;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Session;
use Symfony\Component\Uid\Ulid;
use function Laravel\Prompts\form;

class DeliveryNoteService {
  /**
   * Create a new class instance.
   */
  public function fillRelations(array $data) {
    $data['customer_id'] = $data['customer']['id'];

    // relasi cabang customer
    $data['customer_branch_id'] = $data['customer_branch']['id'];

    // optional branch
    if (isset($data['branch'])) {
      $data['branch_id'] = $data['branch']['id'];
    }

    return $data;
  }

  private function fillItemRelations(array $item) {
    $item['item_id']             = $item['item']['id'];
    $item['unit_id']             = $item['unit']['id'];
    $item['source_warehouse_id'] = $item['source_warehouse']['id'] ?? null;
    $item['conversion_factor']   = ItemUnit::getConversionFactor($item['item']['item_id'], $item['unit_id']);
    $item['quantity']            = $item['quantity'] ?? 0;

    return $item;
  }

  public function create(array $data) {
    $deliveryNote = DeliveryNote::create($this->fillRelations($data));

    foreach ($data['items'] as $item) {
      $item = $this->fillItemRelations($item);
      $deliveryNote->items()->create($item);
    }

    $deliveryNote->logForCreated();
    return $deliveryNote;
  }

  public function update(DeliveryNote $deliveryNote, array $data) {
    $deliveryNote->fillForUpdate($this->fillRelations($data));

    $deliveryNote->items()
      ->whereNotIn('id', array_column($data['items'], 'id'))
      ->delete();

    foreach ($data['items'] as $item) {
      $item = $this->fillItemRelations($item);

      if (Ulid::isValid($item['id'])) {
        $deliveryNote->items()->find($item['id'])->update($item);
        continue;
      }

      $deliveryNote->items()->create($item);
    }
    $deliveryNote->logForUpdated();
    return $deliveryNote;
  }

  // submit function for delivery note
  public function submit(DeliveryNote $deliveryNote) {
    DB::beginTransaction();
    $deliveryNote->update([
      'status' => FormStatus::DELIVERED,
    ]);

    $items      = $deliveryNote->items()
      ->get();
    $errorItems = [];
    foreach ($items as $item) {
      // update delivered quantity dari Sales Order Item
      $item->referenceable->update([
        'delivered_quantity' => $item->referenceable->delivered_quantity + $item->quantity
      ]);

      // update stock
      $stock = Stock::where('item_variant_id', $item->item_id)
        ->where('warehouse_id', $item->source_warehouse_id)
        ->lockForUpdate()
        ->first();
      if (!$stock) {
        $errorItems[] = "Item {$item->item->name} is not in {$item->sourceWarehouse->name} stock";
        continue;
      }
      $quantity = $item->quantity * $item->conversion_factor / $stock->conversion_factor;
      if ($stock->actual_quantity < $quantity) {
        $errorItems[] = "Item {$item->item->name} in {$stock->warehouse->name} stock is {$stock->actual_quantity} but you need {$quantity}";
        continue;
      }
      $quantityRequest = $quantity;
      $queue           = $stock->stock_queue;
      $picked          = [];
      $remainingQueue  = [];
      foreach ($queue as $q) {
        if ($quantityRequest <= 0) {
          $remainingQueue[] = $q;
          continue;
        }
        if ($q['quantity'] > $quantityRequest) {
          $picked[] = [
            ...$q,
            'quantity' => $quantityRequest,
          ];
          // sisa batch dikembalikan ke antrean
          $q['quantity']    -= $quantityRequest;
          $remainingQueue[]  = $q;

          $quantityRequest = 0;
        } else {
          $quantityRequest  -= $q['quantity'];
          $picked[]          = $q;
        }
      }
      $stock->update([
        'actual_quantity'   => $stock->actual_quantity - $quantity,
        'reserved_quantity' => $stock->reserved_quantity - $quantity,
        'stock_queue'       => $remainingQueue,

      ]);
      StockLedgerEntry::create([
        'item_id'               => $item->item_id,
        'warehouse_id'          => $item->source_warehouse_id,
        'unit_id'               => $stock->unit_id,
        'conversion_factor'     => $stock->conversion_factor,
        'quantity_change'       => -$quantity,
        'quantity_after_change' => $stock->actual_quantity,
        'valuation_rate'        => $stock->valuation_rate,
        'balance_stock_value'   => \array_sum(array_map(fn($q) => $q['rate'] * $q['quantity'], $stock->stock_queue)),
        'change_in_stock_value' => -\array_sum(array_map(fn($q) => $q['rate'] * $q['quantity'], $picked)),
        'stock_queue'           => $stock->stock_queue,
        'referenceable_type'    => DeliveryNote::class,
        'referenceable_id'      => $deliveryNote->id,
      ]);
    }

    $toReference    = $deliveryNote->referenceable;
    $referenceItems = $toReference->items()->where('remaining_quantity', '>', 0)->get();
    if ($referenceItems->count() > 0) {
      $status = match ($toReference->status) {
        FormStatus::TO_DELIVER_AND_BILL, FormStatus::PARTIALLY_DELIVERED_AND_TO_BILL => FormStatus::PARTIALLY_DELIVERED_AND_TO_BILL,
        FormStatus::TO_DELIVER, FormStatus::PARTIALLY_DELIVERED                      => FormStatus::PARTIALLY_DELIVERED,
        default                                                                      => FormStatus::PARTIALLY_DELIVERED,
      };
      $toReference->update([
        'status' => $status,
      ]);

    } else {
      $status = match ($toReference->status) {
        FormStatus::TO_DELIVER_AND_BILL, FormStatus::PARTIALLY_DELIVERED_AND_TO_BILL => FormStatus::TO_BILL,
        FormStatus::TO_DELIVER, FormStatus::PARTIALLY_DELIVERED                      => FormStatus::COMPLETED,
        default                                                                      => FormStatus::COMPLETED,
      };
      $toReference->update([
        'status' => $status,
      ]);
    }
    ModelConnection::create([
      'model_type'     => $deliveryNote->referenceable_type,
      'model_id'       => $deliveryNote->referenceable_id,
      'reference_type' => DeliveryNote::class,
      'reference_id'   => $deliveryNote->id,
    ]);
    if (count($errorItems) > 0) {
      DB::rollBack();
      Session::flash('errorItems', $errorItems);
      return $deliveryNote;
    }

    $deliveryNote->logForSubmitted();
    DB::commit();

    return $deliveryNote;
  }
}
