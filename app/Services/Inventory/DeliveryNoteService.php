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
    $data['customer_id'] = $data['customer']['id'] ?? null;

    // relasi cabang customer
    $data['customer_branch_id'] = $data['customer_branch']['id'];

    // optional branch
    if (isset($data['branch'])) {
      $data['branch_id'] = $data['branch']['id'];
    }
    if (isset($data['return_against'])) {
      $data['return_against_id'] = $data['return_against']['id'];
    }

    $data['reference_to_id'] = $data['reference_to']['id'];

    return $data;
  }

  private function fillItemRelations(array $item) {
    $item['item_id']             = $item['item']['id'];
    $item['unit_id']             = $item['unit']['id'];
    $item['source_warehouse_id'] = $item['source_warehouse']['id'] ?? null;
    $item['conversion_factor']   = ItemUnit::getConversionFactor($item['item']['item_id'], $item['unit_id']);
    $item['quantity']            = $item['quantity'] ?? 0;
    $item['valuation_rates']     = [];

    if (isset($item['return_against_item'])) {
      $item['return_against_item_id'] = $item['return_against_item']['id'];
    }

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
    DeliveryNote::orWhere(function ($query) use ($deliveryNote) {
      $query->where(function ($query) use ($deliveryNote) {
        $query->where('referenceable_type', $deliveryNote->referenceable_type)
          ->where('referenceable_id', $deliveryNote->referenceable_id);
      });
      $query->where('return_against_id', $deliveryNote->return_against_id);
    })->whereRaw("json_overlaps(`status`, ?)", [json_encode(["draft"])])
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
    $returnAgainst = $deliveryNote->returnAgainst;
    $deliveryNote->update([
      'status' => $returnAgainst ? FormStatus::RETURNED : FormStatus::DELIVERED,
    ]);

    $toReference = $deliveryNote->referenceable;
    $items       = $deliveryNote->items()
      ->with([
        'item',
        'item.item',
        'item.item.category',
        'referenceable',
        'returnAgainstItem',
        'sourceWarehouse',
      ])
      ->get();
    $errorItems  = [];
    $totalPicked = 0;
    $isRent      = false;
    foreach ($items as $item) {
      $availableToRent = $toReference->is_rent && $item->item->type == 'vehicle';
      if ($availableToRent) {
        $isRent = true;
      }
      // update delivered quantity dari Sales Order Item
      if ($returnAgainst && !$availableToRent) {
        $item->referenceable->decrement('delivered_quantity', $item->quantity);
      } else {
        $item->referenceable->increment('delivered_quantity', $item->quantity);
      }
      if (!$item->item->is_stock_item) {
        continue;
      }

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
      if ($availableToRent) {
        $stock->updateDetails(
          [
            [
              "operator" => $returnAgainst ? "decrement" : "increment",
              "type"     => "rents",
              "key"      => $toReference->code,
              "value"    => $quantity,
            ],
            ...($returnAgainst ? [] : [
              [
                "operator" => "decrement",
                "type"     => "reservations",
                "key"      => $toReference->code,
                "value"    => $quantity,
              ],
            ]),
          ],
        );
        StockLedgerEntry::create([
          'item_id'               => $item->item_id,
          'warehouse_id'          => $item->source_warehouse_id,
          'unit_id'               => $stock->unit_id,
          'conversion_factor'     => $stock->conversion_factor,
          'quantity_change'       => $returnAgainst ? $quantity : -$quantity,
          'quantity_after_change' => $stock->actual_quantity,
          'valuation_rate'        => $stock->valuation_rate,
          'balance_stock_value'   => \array_sum(array_map(fn($q) => $q['rate'] * $q['quantity'], $stock->stock_queue)),
          'change_in_stock_value' => 0,
          'stock_queue'           => $stock->stock_queue,
          'referenceable_type'    => DeliveryNote::class,
          'referenceable_id'      => $deliveryNote->id,
        ]);
        continue;
      }

      $rentedQuantity  = $stock->rented_quantity ?? 0;
      $quantityRequest = $quantity;

      $queue          = $stock->stock_queue;
      $remainingQueue = [];
      $picked         = [];
      $amountPicked   = 0;

      $offset = $rentedQuantity;

      if ($returnAgainst) {
        $valuationRates  = $item->returnAgainstItem->valuation_rates;
        $remainingQueue  = [
          ...$queue,
          ...$valuationRates ?? [],
        ];
        $amountPicked    = \array_sum(array_map(fn($q) => $q['rate'] * $q['quantity'], $valuationRates ?? []));
        $totalPicked    += $amountPicked;
        $item->returnAgainstItem->update([
          'returned_quantity' => $item->returnAgainstItem->returned_quantity + $quantity
        ]);
        $stock->fill([
          'quantity'    => $stock->quantity + $quantity,
          'stock_queue' => $remainingQueue,
        ]);
        $stock->updateDetails('increment', 'reservations', $toReference->code, $quantity);
        StockLedgerEntry::create([
          'item_id'               => $item->item_id,
          'warehouse_id'          => $item->source_warehouse_id,
          'unit_id'               => $stock->unit_id,
          'conversion_factor'     => $stock->conversion_factor,
          'quantity_change'       => $quantity,
          'quantity_after_change' => $stock->actual_quantity,
          'valuation_rate'        => $stock->valuation_rate,
          'balance_stock_value'   => \array_sum(array_map(fn($q) => $q['rate'] * $q['quantity'], $stock->stock_queue)),
          'change_in_stock_value' => $amountPicked,
          'stock_queue'           => $stock->stock_queue,
          'referenceable_type'    => DeliveryNote::class,
          'referenceable_id'      => $deliveryNote->id,
        ]);
      } else {
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
        $totalPicked += $amountPicked;
        $item->update([
          'valuation_rates' => $picked,
        ]);
        $stock->fill([
          'quantity'    => $stock->quantity - $quantity,
          'stock_queue' => $remainingQueue,
        ]);
        $stock->updateDetails('decrement', 'reservations', $toReference->code, $quantity);
        StockLedgerEntry::create([
          'item_id'               => $item->item_id,
          'warehouse_id'          => $item->source_warehouse_id,
          'unit_id'               => $stock->unit_id,
          'conversion_factor'     => $stock->conversion_factor,
          'quantity_change'       => -$quantity,
          'quantity_after_change' => $stock->actual_quantity,
          'valuation_rate'        => $stock->valuation_rate,
          'balance_stock_value'   => \array_sum(array_map(fn($q) => $q['rate'] * $q['quantity'], $stock->stock_queue)),
          'change_in_stock_value' => -$amountPicked,
          'stock_queue'           => $stock->stock_queue,
          'referenceable_type'    => DeliveryNote::class,
          'referenceable_id'      => $deliveryNote->id,
        ]);
      }
    }

    $undeliveredItems      = $toReference->items()->select(['undelivered_quantity', 'quantity'])->get();
    $countUndeliveredItems = $undeliveredItems->sum('undelivered_quantity');
    $sumQuantity           = $undeliveredItems->sum('quantity');
    if ($countUndeliveredItems == $sumQuantity) {
      $status = Utils::replaceStatus(
        $toReference->status,
        [FormStatus::DELIVERED, FormStatus::PARTIALLY_DELIVERED],
        FormStatus::TO_DELIVER,
      );
    } else if ($countUndeliveredItems > 0) {
      $status = Utils::replaceStatus(
        $toReference->status,
        FormStatus::TO_DELIVER,
        FormStatus::PARTIALLY_DELIVERED,
      );
    } else {
      $status = Utils::replaceStatus(
        $toReference->status,
        [FormStatus::TO_DELIVER, FormStatus::PARTIALLY_DELIVERED],
        FormStatus::DELIVERED,
      );
    }
    if ($isRent) {
      if ($returnAgainst) {
        $status = \array_filter($status, fn($s) => $s != FormStatus::IN_RENT);
      } else {
        $status[] = FormStatus::IN_RENT;
      }
    }
    $toReference->update([
      'status' => $status,
    ]);

    if ($totalPicked > 0) {
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
        'credit'             => $returnAgainst ? 0 : $totalPicked,
        'debit'              => $returnAgainst ? $totalPicked : 0,
        'referenceable_type' => DeliveryNote::class,
        'referenceable_id'   => $deliveryNote->id,
      ]);

      $debitAccount->generalLedgerEntries()->create([
        'against_account_id' => $creditAccount->id,
        'credit'             => $returnAgainst ? $totalPicked : 0,
        'debit'              => $returnAgainst ? 0 : $totalPicked,
        'referenceable_type' => DeliveryNote::class,
        'referenceable_id'   => $deliveryNote->id,
      ]);
    }

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
