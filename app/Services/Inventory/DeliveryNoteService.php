<?php

namespace App\Services\Inventory;

use App\FormStatus;
use App\Models\Core\ModelConnection;
use App\Models\Finances\Account;
use App\Models\Inventory\DeliveryNote;
use App\Models\Inventory\ItemUnit;
use App\Models\Inventory\Stock;
use App\Models\Inventory\StockLedgerEntry;
use App\Utils;
use Illuminate\Support\Facades\Auth;
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

    ModelConnection::create([
      'model_type'     => $deliveryNote->referenceable_type,
      'model_id'       => $deliveryNote->referenceable_id,
      'reference_type' => DeliveryNote::class,
      'reference_id'   => $deliveryNote->id,
    ]);
    DeliveryNote::where('referenceable_type', $deliveryNote->referenceable_type)
      ->where('referenceable_id', $deliveryNote->referenceable_id)
      ->where('status', 'draft')
      ->whereNot('created_by', Auth::user()->id)
      ->update([
        'status'      => 'canceled',
        'canceled_at' => now(),
      ]);
    DB::commit();
    $deliveryNote->checkApproval();

    return $deliveryNote;
  }

  public function onApproved(DeliveryNote $deliveryNote) {
    DB::beginTransaction();
    $deliveryNote->update([
      'status' => FormStatus::DELIVERED,
    ]);

    $toReference  = $deliveryNote->referenceable;
    $items        = $deliveryNote->items()
      ->with(['item', 'item.item', 'item.item.category'])
      ->get();
    $errorItems   = [];
    $amountPicked = 0;
    foreach ($items as $item) {
      // update delivered quantity dari Sales Order Item
      $item->referenceable->update([
        'delivered_quantity' => $item->referenceable->delivered_quantity + $item->quantity
      ]);
      if (! $item->item->is_stock_item) {
        continue;
      }

      // update stock
      $stock = Stock::where('item_variant_id', $item->item_id)
        ->where('warehouse_id', $item->source_warehouse_id)
        ->lockForUpdate()
        ->first();
      if (! $stock) {
        $errorItems[] = "Item {$item->item->name} is not in {$item->sourceWarehouse->name} stock";
        continue;
      }
      $quantity = $item->quantity * $item->conversion_factor / $stock->conversion_factor;
      if ($stock->actual_quantity < $quantity) {
        $errorItems[] = "Item {$item->item->name} in {$stock->warehouse->name} stock is {$stock->actual_quantity} but you need {$quantity}";
        continue;
      }
      if ($toReference->is_rent && $item->item->item->category->type == 'vehicle') {
        $stock->update([
          'loan_quantity' => $quantity,
        ]);
        StockLedgerEntry::create([
          'item_id'               => $item->item_id,
          'warehouse_id'          => $item->source_warehouse_id,
          'unit_id'               => $stock->unit_id,
          'conversion_factor'     => $stock->conversion_factor,
          'quantity_change'       => -$quantity,
          'quantity_after_change' => $stock->actual_quantity,
          'valuation_rate'        => $stock->valuation_rate,
          'balance_stock_value'   => \array_sum(array_map(fn ($q) => $q['rate'] * $q['quantity'], $stock->stock_queue)),
          'change_in_stock_value' => 0,
          'stock_queue'           => $stock->stock_queue,
          'referenceable_type'    => DeliveryNote::class,
          'referenceable_id'      => $deliveryNote->id,
        ]);
        continue;
      }

      $loanQuantity    = $stock->loan_quantity ?? 0;
      $quantityRequest = $quantity;

      $queue          = $stock->stock_queue;
      $remainingQueue = [];
      $picked         = [];
      $amountPicked   = 0;

      $offset = $loanQuantity;

      foreach ($queue as $q) {
        // belum sampai batch target
        if ($offset >= $q['quantity']) {
          $offset -= $q['quantity'];

          // batch tetap ada
          if ($q['quantity'] > 0) {
            $remainingQueue[] = $q;
          }
          continue;
        }

        // batch target
        if ($offset >= 0) {
          // ambil dari batch ini
          $picked[] = [
            'quantity' => $quantityRequest,
            'rate'     => $q['rate'],
          ];

          $amountPicked += $quantityRequest * $q['rate'];

          // kurangi qty
          $q['quantity'] -= $quantityRequest;

          // hanya masukkan jika masih ada sisa
          if ($q['quantity'] > 0) {
            $remainingQueue[] = $q;
          }

          // setelah batch target, sisanya copy apa adanya
          $offset = -1;
          continue;
        }

        // batch setelah target
        if ($q['quantity'] > 0) {
          $remainingQueue[] = $q;
        }
      }

      $stock->update([
        'quantity'          => $stock->quantity - $quantity,
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
        'balance_stock_value'   => \array_sum(array_map(fn ($q) => $q['rate'] * $q['quantity'], $stock->stock_queue)),
        'change_in_stock_value' => -\array_sum(array_map(fn ($q) => $q['rate'] * $q['quantity'], $picked)),
        'stock_queue'           => $stock->stock_queue,
        'referenceable_type'    => DeliveryNote::class,
        'referenceable_id'      => $deliveryNote->id,
      ]);
    }

    $referenceItems = $toReference->items()->where('remaining_quantity', '>', 0)->get();
    if ($referenceItems->count() > 0) {
      $status = Utils::replaceStatus(
        $toReference->status,
        FormStatus::TO_DELIVER,
        FormStatus::PARTIALLY_DELIVERED,
      );
      $toReference->update([
        'status' => $status,
      ]);

    } else {
      $status = Utils::replaceStatus(
        $toReference->status,
        [FormStatus::TO_DELIVER, FormStatus::PARTIALLY_DELIVERED],
        FormStatus::DELIVERED,
      );
      $toReference->update([
        'status' => $status,
      ]);
    }

    $creditAccount = Account::lockForUpdate()
      ->where('root_type', 'asset')
      ->where('account_type', 'stock')
      ->latest()->first();
    $debitAccount  = Account::lockForUpdate()
      ->where('root_type', 'income')
      ->where('account_type', 'cost_of_goods_sold')
      ->latest()->first();

    $creditAccount->generalLedgerEntries()->create([
      'against_account_id' => $debitAccount->id,
      'credit'             => $amountPicked,
      'debit'              => 0,
      'referenceable_type' => DeliveryNote::class,
      'referenceable_id'   => $deliveryNote->id,
    ]);

    $debitAccount->generalLedgerEntries()->create([
      'against_account_id' => $creditAccount->id,
      'credit'             => 0,
      'debit'              => $amountPicked,
      'referenceable_type' => DeliveryNote::class,
      'referenceable_id'   => $deliveryNote->id,
    ]);

    DB::commit();
    return $deliveryNote;
  }

  public function onRejected(DeliveryNote $deliveryNote) {
    $deliveryNote->update([
      'status' => FormStatus::REJECTED,
    ]);
    return $deliveryNote;
  }

  public function cancel(DeliveryNote $deliveryNote) {
    $deliveryNote->update([
      'status' => FormStatus::CANCELED,
    ]);
    return $deliveryNote;
  }
}
