<?php

namespace App\Services\Inventory;

use App\FormStatus;
use App\Models\Finances\Account;
use App\Models\Finances\GeneralLedger;
use App\Models\Inventory\ItemUnit;
use App\Models\Inventory\ItemVariant;
use App\Models\Inventory\Stock;
use App\Models\Inventory\StockEntry;
use App\Models\Inventory\StockLedgerEntry;
use Illuminate\Support\Facades\DB;
use Symfony\Component\Uid\Ulid;

class StockEntryService {
  private function fillRelations(array $data) {
    $data['difference_account_id'] = $data['difference_account']['id'];

    return $data;
  }

  private function fillItemRelations(array $data, StockEntry $stockEntry) {
    $data['item_id'] = $data['item']['id'];
    $data['unit_id'] = $data['unit']['id'];
    // $data['conversion_factor'] = ItemUnit::getConversionFactor($data["item"]["item_id"], $data['unit_id']);
    if (isset($data['source_warehouse'])) {
      $data['source_warehouse_id'] = $data['source_warehouse']['id'];
    }
    if (isset($data['target_warehouse'])) {
      $data['target_warehouse_id'] = $data['target_warehouse']['id'];
    }

    $itemVariant                        = ItemVariant::find($data['item_id']);
    $defaultConvertionFactor            = $itemVariant->conversion_factor;
    $data['conversion_factor']          = ItemUnit::getConversionFactor($itemVariant->item_id, $data['unit_id']);
    $data['qty_needed_in_default_unit'] = $data['quantity'] * ($data['conversion_factor'] / $defaultConvertionFactor ?: 1);
    if ($stockEntry->type != 'item_receipt') {
      $stockSource = Stock::lockForUpdate()->firstOrCreate([
        'item_variant_id' => $data['item_id'],
        'warehouse_id'    => $data['source_warehouse_id'],
      ], [
        'conversion_factor' => $defaultConvertionFactor,
        'unit_id'           => $data['unit_id'],
        'stock_queue'       => [],
      ]);
      // update queue fifo in source warehouse
      $quantityRequest = $data['qty_needed_in_default_unit'];
      $queue           = $stockSource->stock_queue;
      $picked          = [];
      foreach ($queue as $q) {
        if ($quantityRequest <= 0) {
          break;
        }
        if ($q['quantity'] > $quantityRequest) {
          $picked[] = [
            ...$q,
            'quantity' => $quantityRequest,
          ];
          // sisa batch dikembalikan ke antrean
          $q['quantity']   -= $quantityRequest;
          $quantityRequest  = 0;
        } else {
          $quantityRequest -= $q['quantity'];
          $picked[]         = $q;
        }
      }
      $data['basic_amount'] = \array_sum(array_map(fn ($q) => $q['rate'] * $q['quantity'], $picked));
      $data['basic_rate']   = $data['basic_amount'] / ($data['quantity'] - $quantityRequest);
    } else {
      $data['basic_amount'] = $data['basic_rate'] * $data['quantity'];
    }

    return $data;
  }

  private function fillAdditionalCostRelations(array $data) {
    $data['expense_account_id'] = $data['expense_account']['id'];
    return $data;
  }function mapCalculateItem(array $data) {}

  public function create(array $data) {
    $stockEntry = StockEntry::create($this->fillRelations($data));

    if (\in_array($stockEntry->type, ['item_receipt', 'item_transfer'])) {
      foreach ($data['additional_costs'] ?? [] as $additional_cost) {
        $stockEntry->additionalCosts()->create($this->fillAdditionalCostRelations($additional_cost));
      }
    }
    $data['items'] = array_map(fn ($item) => $this->fillItemRelations($item, $stockEntry), $data['items']);

    $totalAdditionalCost  = \array_sum(array_column($data['additional_costs'] ?? [], 'amount'));
    $totalBasicAmountItem = \array_sum(array_column($data['items'], 'basic_amount'));

    foreach ($data['items'] as &$item) {
      $additionalCost = $totalBasicAmountItem != 0
        ? ($item['basic_amount'] / $totalBasicAmountItem) * $totalAdditionalCost
        : 0;

      $valuation_rate = $item['qty_needed_in_default_unit'] <= 0 ? 0 : ($additionalCost + $item['basic_amount']) / ($item['qty_needed_in_default_unit']);

      $item['additional_cost'] = $additionalCost;
      $item['valuation_rate']  = $valuation_rate;

      unset($item['basic_amount']);
      $stockEntry->items()->create($item);
    }
    $stockEntry->logForCreated();
    return $stockEntry;
  }

  public function update(StockEntry $stockEntry, array $data) {
    $stockEntry->fillForUpdate($this->fillRelations($data));

    // additional cost update
    if (\in_array($stockEntry->type, ['item_receipt', 'item_transfer'])) {
      $stockEntry->additionalCosts()
        ->whereNotIn('id', array_column($data['additional_costs'] ?? [], 'id'))
        ->update(['deleted_at' => now()]);

      foreach ($data['additional_costs'] ?? [] as $additional_cost) {
        if (Ulid::isValid($additional_cost['id'])) {
          $stockEntry->additionalCosts()->find($additional_cost['id'])->update($this->fillAdditionalCostRelations($additional_cost));
          continue;
        }
        $stockEntry->additionalCosts()->create($this->fillAdditionalCostRelations($additional_cost));
      }
    } else {
      $stockEntry->additionalCosts()->delete();
    }

    $data['items'] = array_map(fn ($item) => $this->fillItemRelations($item, $stockEntry), $data['items']);

    $totalAdditionalCost  = \array_sum(array_column($data['additional_costs'] ?? [], 'amount'));
    $totalBasicAmountItem = \array_sum(array_column($data['items'], 'basic_amount'));

    $stockEntry->items()
      ->whereNotIn('id', array_column($data['items'], 'id'))
      ->update(['deleted_at' => now()]);
    foreach ($data['items'] as &$item) {
      $additionalCost = $totalBasicAmountItem != 0
        ? ($item['basic_amount'] / $totalBasicAmountItem) * $totalAdditionalCost
        : 0;

      $valuation_rate = $item['qty_needed_in_default_unit'] <= 0 ? 0 : ($additionalCost + $item['basic_amount']) / ($item['qty_needed_in_default_unit']);

      $item['additional_cost'] = $additionalCost;
      $item['valuation_rate']  = $valuation_rate;
      unset($item['basic_amount']);
      if (Ulid::isValid($item['id'])) {
        $stockEntry->items()->find($item['id'])->update($item);
        continue;
      }
      $stockEntry->items()->create($item);
    }
    $stockEntry->logForUpdated();
    return $stockEntry;
  }

  private function rolllbackItems(StockEntry $stockEntry) {
    $items = $stockEntry->items()
      ->get();
    foreach ($items as $item) {
      $stock = Stock::lockForUpdate()
        ->where('item_variant_id', $item->item_id)
        ->where('warehouse_id', $item->source_warehouse_id)
        ->lockForUpdate()
        ->first();

      $quantity = $item->quantity * $item->conversion_factor / $stock->conversion_factor;
      $stock->update([
        'reserved_quantity' => $stock->reserved_quantity - $quantity,
      ]);
    }
  }

  public function submit(StockEntry $stockEntry) {
    if (\in_array($stockEntry->type, ['item_issue', 'item_transfer', 'item_consumption'])) {
      DB::beginTransaction();

      $items      = $stockEntry->items()
        ->with(['item', 'item.item', 'item.sourceWarehouse'])
        ->get();
      $errorItems = [];
      foreach ($items as $item) {
        $item->item->updateHaveTransactions();
        $item->item->item->updateHaveTransactions();
        $stock = Stock::lockForUpdate()
          ->where('item_variant_id', $item->item_id)
          ->where('warehouse_id', $item->source_warehouse_id)
          ->lockForUpdate()
          ->first();
        if (! $stock) {
          $errorItems[] = "Item {$item->item->name} is not in {$item->sourceWarehouse->name} stock";
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
      if (\count($errorItems) > 0) {
        DB::rollBack();
        throw \Illuminate\Validation\ValidationException::withMessages([
          'items' => $errorItems,
        ]);
      }
      DB::commit();
    }

    $stockEntry->checkApproval();

    return $stockEntry;
  }

  public function onApproved(StockEntry $stockEntry) {
    DB::beginTransaction();
    $stockEntry->update([
      'status' => FormStatus::COMPLETED,
    ]);

    $items           = $stockEntry->items()->with('item', 'item.item', 'item.defaultUnit', 'unit', 'sourceWarehouse', 'targetWarehouse')->get();
    $additionalCosts = $stockEntry->additionalCosts()
      ->with([
        'expenseAccount' => function ($q) {
          $q->lockForUpdate();
        },
      ])
      ->get();

    $totalAdditionalCost = $additionalCosts->sum('amount');
    $totalBasicAmount    = $items->sum('basic_amount');

    foreach ($items as $item) {
      unset($picked);
      $defaultUnit             = $item->item->defaultUnit;
      $defaultConvertionFactor = $item->item->conversion_factor;
      $qtyNeeded               = $item->quantity * ($item->conversion_factor / $defaultConvertionFactor);

      if (\in_array($stockEntry->type, ['item_issue', 'item_transfer', 'item_consumption'])) {
        // get stock from source warehouse
        $stockSource = Stock::lockForUpdate()->firstOrCreate([
          'item_variant_id' => $item->item_id,
          'warehouse_id'    => $item->source_warehouse_id,
        ], [
          'conversion_factor' => $defaultConvertionFactor,
          'unit_id'           => $defaultUnit->id,
          'stock_queue'       => [],
        ]);

        // update queue fifo in source warehouse

        $rentedQuantity  = $stock->rented_quantity ?? 0;
        $quantityRequest = $qtyNeeded;

        $queue          = $stockSource->stock_queue;
        $remainingQueue = [];
        $picked         = [];
        $amountPicked   = 0;

        $offset = $rentedQuantity;
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

        $stockSource->update([
          'quantity'    => $stockSource->quantity - $qtyNeeded,
          'stock_queue' => $remainingQueue,
        ]);

        StockLedgerEntry::create([
          'item_id'                    => $item->item_id,
          'warehouse_id'               => $item->source_warehouse_id,
          'unit_id'                    => $defaultUnit->id,
          'conversion_factor'          => $defaultConvertionFactor,
          'quantity_change'            => -$qtyNeeded,
          'quantity_after_transaction' => $stockSource->actual_quantity,
          'valuation_rate'             => $stockSource->valuation_rate,
          'balance_stock_value'        => \array_sum(array_map(fn ($q) => $q['rate'] * $q['quantity'], $stockSource->stock_queue)),
          'change_in_stock_value'      => -\array_sum(array_map(fn ($q) => $q['rate'] * $q['quantity'], $picked)),
          'stock_queue'                => $stockSource->stock_queue,
          'referenceable_type'         => StockEntry::class,
          'referenceable_id'           => $stockEntry->id,
        ]);
      }

      if (\in_array($stockEntry->type, ['item_receipt', 'item_transfer'])) {
        // get stock from target warehouse
        $stockTarget = Stock::lockForUpdate()->firstOrCreate([
          'item_variant_id' => $item->item_id,
          'warehouse_id'    => $item->target_warehouse_id,
        ], [
          'unit_id'           => $defaultUnit->id,
          'conversion_factor' => $defaultConvertionFactor,
          'stock_queue'       => [],
        ]);

        // update queue fifo in target warehouse
        $queue = $stockTarget->stock_queue;
        if (isset($picked)) {
          // update if item transfer from source warehouse
          $basicAmount    = \array_sum(array_map(fn ($q) => $q['rate'] * $q['quantity'], $picked));
          $basicRate      = $basicAmount / $qtyNeeded;
          $additionalCost = $totalBasicAmount != 0
            ? ($basicAmount / $totalBasicAmount) * $totalAdditionalCost
            : 0;

          $valuation_rate = $additionalCost / $qtyNeeded + $basicRate;

          $queue[] = [
            'rate'     => $valuation_rate,
            'quantity' => $qtyNeeded,
          ];
        } else {
          // update if item receipt
          $basicAmount    = $item->basic_amount;
          $additionalCost = $totalBasicAmount != 0
            ? ($basicAmount / $totalBasicAmount) * $totalAdditionalCost
            : 0;
          $valuation_rate = ($additionalCost + $basicAmount) / $qtyNeeded;
          $queue[]        = [
            'rate'     => $valuation_rate,
            'quantity' => $qtyNeeded,
          ];
        }

        $stockTarget->update([
          'quantity'    => $stockTarget->quantity + $qtyNeeded,
          'stock_queue' => $queue,
        ]);
        StockLedgerEntry::create([
          'item_id'                    => $item->item_id,
          'warehouse_id'               => $item->target_warehouse_id,
          'unit_id'                    => $defaultUnit->id,
          'conversion_factor'          => $defaultConvertionFactor,
          'quantity_change'            => $qtyNeeded,
          'quantity_after_transaction' => $stockTarget->actual_quantity,
          'valuation_rate'             => $stockTarget->valuation_rate,
          'balance_stock_value'        => \array_sum(array_map(fn ($q) => $q['rate'] * $q['quantity'], $stockTarget->stock_queue)),
          'change_in_stock_value'      => $basicAmount + $additionalCost,
          'stock_queue'                => $stockTarget->stock_queue,
          'referenceable_type'         => StockEntry::class,
          'referenceable_id'           => $stockEntry->id,
        ]);
      }
    }

    $debitAccount  = Account::lockForUpdate()
      ->where('root_type', 'asset')
      ->where('account_type', 'stock')
      ->latest()->first();
    $creditAccount = $stockEntry->differenceAccount()->lockForUpdate()->first();

    // record general ledger
    if (\in_array($stockEntry->type, ['item_receipt'])) {
      $debitAccount->update([
        'have_transactions' => true,
        'balance_amount'    => $debitAccount->balance_amount + $totalBasicAmount,
      ]);

      $creditAccount->update([
        'have_transactions' => true,
        'balance_amount'    => $creditAccount->balance_amount - $totalBasicAmount,
      ]);

      GeneralLedger::create([
        'account_id'         => $debitAccount->id,
        'against_account_id' => $creditAccount->id,
        'debit'              => $totalBasicAmount,
        'credit'             => 0,
        'referenceable_type' => StockEntry::class,
        'referenceable_id'   => $stockEntry->id,
      ]);
      GeneralLedger::create([
        'account_id'         => $creditAccount->id,
        'against_account_id' => $debitAccount->id,
        'debit'              => 0,
        'credit'             => $totalBasicAmount,
        'referenceable_type' => StockEntry::class,
        'referenceable_id'   => $stockEntry->id,
      ]);
    } else if (\in_array($stockEntry->type, ['item_issue'])) {
      $debitAccount->update([
        'have_transactions' => true,
        'balance_amount'    => $debitAccount->balance_amount - $totalBasicAmount,
      ]);

      $creditAccount->update([
        'have_transactions' => true,
        'balance_amount'    => $creditAccount->balance_amount + $totalBasicAmount,
      ]);

      GeneralLedger::create([
        'account_id'         => $debitAccount->id,
        'against_account_id' => $creditAccount->id,
        'debit'              => 0,
        'credit'             => $totalBasicAmount,
        'referenceable_type' => StockEntry::class,
        'referenceable_id'   => $stockEntry->id,
      ]);
      GeneralLedger::create([
        'account_id'         => $creditAccount->id,
        'against_account_id' => $debitAccount->id,
        'debit'              => $totalBasicAmount,
        'credit'             => 0,
        'referenceable_type' => StockEntry::class,
        'referenceable_id'   => $stockEntry->id,
      ]);
    }

    // record general ledger for additional cost
    if ($additionalCosts->count() > 0) {
      foreach ($additionalCosts as $additionalCost) {
        $expenseAccount = $additionalCost->expenseAccount;
        $debitAccount->update([
          'have_transactions' => true,
          'balance_amount'    => $debitAccount->balance_amount + $additionalCost->amount,
        ]);
        $expenseAccount->update([
          'have_transactions' => true,
          'balance_amount'    => $expenseAccount->balance_amount - $additionalCost->amount,
        ]);

        GeneralLedger::create([
          'account_id'         => $debitAccount->id,
          'against_account_id' => $expenseAccount->id,
          'debit'              => $additionalCost->amount,
          'credit'             => 0,
          'referenceable_type' => StockEntry::class,
          'referenceable_id'   => $stockEntry->id,
        ]);
        GeneralLedger::create([
          'account_id'         => $expenseAccount->id,
          'against_account_id' => $debitAccount->id,
          'debit'              => 0,
          'credit'             => $additionalCost->amount,
          'referenceable_type' => StockEntry::class,
          'referenceable_id'   => $stockEntry->id,
        ]);
      }
    }

    DB::commit();
    return $stockEntry;
  }

  public function onRejected(StockEntry $stockEntry) {
    DB::beginTransaction();
    $stockEntry->update([
      'status' => [
        FormStatus::REJECTED,
      ],
    ]);

    $this->rolllbackItems($stockEntry);

    DB::commit();
    return $stockEntry;

  }

  public function cancel(StockEntry $stockEntry) {
    DB::beginTransaction();
    $stockEntry->update([
      'status' => [
        FormStatus::CANCELED,
      ],
    ]);

    $this->rolllbackItems($stockEntry);

    DB::commit();
    return $stockEntry;

  }
}
