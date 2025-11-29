<?php

namespace App\Services\Inventory;

use App\FormStatus;
use App\Models\Finances\Account;
use App\Models\Finances\GeneralLedger;
use App\Models\Inventory\ItemVariant;
use App\Models\Inventory\Stock;
use App\Models\Inventory\StockLedgerEntry;
use Symfony\Component\Uid\Ulid;
use App\Models\Inventory\ItemUnit;
use App\Models\Inventory\StockEntry;

class StockEntryService {
  private function fillRelations(array $data) {
    $data['difference_account_id'] = $data['difference_account']['id'];

    // if (!($data['for_internal'] ?? false)) {
    //   $data['customer_id'] = $data['customer']['id'];
    //   $data['customer_name'] = $data['customer']['name'];
    // }
    // $data['customer_branch_id'] = $data['customer_branch']['id'];
    // $data['customer_branch_name'] = $data['customer_branch']['name'];
    // $data['address'] = [];
    // $data['item_service_id'] = $data['item_service']['id'];
    // $data['item_service_name'] = $data['item_service']['sku'];
    // if (isset($data['branch'])) {
    //   $data['branch_id'] = $data['branch']['id'];
    // }

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
      $data['basic_rate']   = $data['basic_amount'] / $data['quantity'];
    } else {
      $data['basic_amount'] = $data['basic_rate'] * $data['quantity'];
    }

    return $data;
  }

  private function fillAdditionalCostRelations(array $data) {
    $data['expense_account_id'] = $data['expense_account']['id'];
    return $data;
  }

  function mapCalculateItem(array $data) {}

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

  public function submit(StockEntry $stockEntry) {
    $stockEntry->update([
      'status' => FormStatus::SUBMITTED,
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
      $item->item->updateHaveTransactions();
      $item->item->item->updateHaveTransactions();
      $defaultUnit             = $item->item->defaultUnit;
      $defaultConvertionFactor = $item->item->conversion_factor;
      $qtyNeeded               = $item->quantity * ($item->conversion_factor / $defaultConvertionFactor);

      if ($stockEntry->type == "item_issue" || $stockEntry->type == "item_consumption" || $stockEntry->type == "item_transfer") {
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
        $quantityRequest = $qtyNeeded;
        $queue           = $stockSource->stock_queue;
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
            $quantityRequest -= $q['quantity'];
            $picked[]         = $q;
          }
        }

        $stockSource->update([
          'actual_quantity' => $stockSource->actual_quantity - $qtyNeeded,
          'stock_queue'     => $remainingQueue,
        ]);
        StockLedgerEntry::create([
          'item_id'               => $item->item_id,
          'warehouse_id'          => $item->source_warehouse_id,
          'unit_id'               => $defaultUnit->id,
          'conversion_factor'     => $defaultConvertionFactor,
          'quantity_change'       => -$qtyNeeded,
          'quantity_after_change' => $stockSource->actual_quantity,
          'valuation_rate'        => $stockSource->valuation_rate,
          'balance_stock_value'   => \array_sum(array_map(fn ($q) => $q['rate'] * $q['quantity'], $stockSource->stock_queue)),
          'change_in_stock_value' => -\array_sum(array_map(fn ($q) => $q['rate'] * $q['quantity'], $picked)),
          'stock_queue'           => $stockSource->stock_queue,
          'referenceable_type'    => StockEntry::class,
          'referenceable_id'      => $stockEntry->id,
        ]);
      }

      if ($stockEntry->type == "item_receipt" || $stockEntry->type == "item_transfer") {
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
          'balance_stock_value'   => \array_sum(array_map(fn ($q) => $q['rate'] * $q['quantity'], $stockTarget->stock_queue)),
          'change_in_stock_value' => $basicAmount + $additionalCost,
          'stock_queue'           => $stockTarget->stock_queue,
          'referenceable_type'    => StockEntry::class,
          'referenceable_id'      => $stockEntry->id,
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

    return $stockEntry;
  }
}
