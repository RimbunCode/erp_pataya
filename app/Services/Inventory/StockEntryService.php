<?php

namespace App\Services\Inventory;

use App\Contracts\SubmitableService;
use App\Enums\FormStatus;
use App\Models\Core\FormatingSeries;
use App\Models\Finances\Account;
use App\Models\Finances\GeneralLedger;
use App\Models\Inventory\ItemUnit;
use App\Models\Inventory\Stock;
use App\Models\Inventory\StockEntry;
use App\Models\Inventory\StockLedgerEntry;
use App\Models\Model;
use App\Traits\HasDefaultDelete;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Symfony\Component\Uid\Ulid;

class StockEntryService implements SubmitableService {
    use HasDefaultDelete;

    private function getStockKey(string $itemVariantId, ?string $warehouseId): string {
        return "{$itemVariantId}-{$warehouseId}";
    }

    private function fillRelations(array $data) {
        $data['difference_account_id'] = $data['difference_account']['id'];

        return $data;
    }

    private function fillItemRelations(array $data, StockEntry $stockEntry, array &$stockSourceCache = [], array $units = [], array $defaultUnits = []) {
        $data['item_id']             = $data['item']['id'];
        $data['item_unit_id']        = $data['unit']['id'];
        $data['source_warehouse_id'] = $data['source_warehouse']['id'] ?? null;
        $data['target_warehouse_id'] = $data['target_warehouse']['id'] ?? null;

        $unit                               = $units[$data['unit']['id']] ?? null;
        $defaultUnit                        = $defaultUnits[$data['item']['id']] ?? null;
        $defaultConvertionFactor            = $defaultUnit?->conversion_factor ?? 1;
        $data['conversion_factor']          = $unit?->conversion_factor ?? 1;
        $data['qty_needed_in_default_unit'] = $data['quantity'] * ($data['conversion_factor'] / $defaultConvertionFactor ?: 1);
        if ($stockEntry->type != 'item_receipt') {
            $stockKey = $this->getStockKey($data['item_id'], $data['source_warehouse_id']);
            if (! isset($stockSourceCache[$stockKey])) {
                $stockSourceCache[$stockKey] = Stock::lockForUpdate()->firstOrCreate([
                    'item_variant_id' => $data['item_id'],
                    'warehouse_id'    => $data['source_warehouse_id'],
                ], [
                    'conversion_factor' => $defaultConvertionFactor,
                    'unit_id'           => $unit?->unit_id,
                    'stock_queue'       => [],
                ]);
            }
            $stockSource = $stockSourceCache[$stockKey];
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
                    $q['quantity'] -= $quantityRequest;
                    $quantityRequest = 0;
                } else {
                    $quantityRequest -= $q['quantity'];
                    $picked[] = $q;
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
    }

    private function batchLoadUnits(array $data): array {
        $unitIds = collect($data['items'])->pluck('unit.id')->filter()->unique()->values();

        return ItemUnit::whereIn('item_units.id', $unitIds)->get()->keyBy('id')->all();
    }

    private function batchLoadDefaultUnits(array $data): array {
        $itemIds = collect($data['items'])->pluck('item.id')->filter()->unique()->values();

        return ItemUnit::whereIn('item_units.item_id', $itemIds)->where('item_units.is_default', true)->get()->keyBy('item_id')->all();
    }

    private function preloadStockSourceCache(array $data, StockEntry $stockEntry): array {
        if ($stockEntry->type === 'item_receipt') {
            return [];
        }

        $sourceItemIds      = collect($data['items'])->pluck('item.id')->filter()->values();
        $sourceWarehouseIds = collect($data['items'])->pluck('source_warehouse.id')->filter()->values();

        if ($sourceItemIds->isEmpty() || $sourceWarehouseIds->isEmpty()) {
            return [];
        }

        return Stock::whereIn('item_variant_id', $sourceItemIds)
            ->whereIn('warehouse_id', $sourceWarehouseIds)
            ->lockForUpdate()
            ->get()
            ->keyBy(fn ($stock) => $this->getStockKey($stock->item_variant_id, $stock->warehouse_id))
            ->all();
    }

    public function create(array $data): Model {
        $data['code'] = FormatingSeries::generate(StockEntry::class, $data, true);
        $stockEntry   = StockEntry::create($this->fillRelations($data));

        if (\in_array($stockEntry->type, ['item_receipt', 'item_transfer'])) {
            foreach ($data['additional_costs'] ?? [] as $additional_cost) {
                $stockEntry->additionalCosts()->create($this->fillAdditionalCostRelations($additional_cost));
            }
        }
        $units            = $this->batchLoadUnits($data);
        $defaultUnits     = $this->batchLoadDefaultUnits($data);
        $stockSourceCache = $this->preloadStockSourceCache($data, $stockEntry);

        $data['items'] = array_map(fn ($item) => $this->fillItemRelations($item, $stockEntry, $stockSourceCache, $units, $defaultUnits), $data['items']);

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

        return $stockEntry;
    }

    public function update(Model $stockEntry, array $data): Model {
        $stockEntry->fillForUpdate($this->fillRelations($data));

        // additional cost update
        if (\in_array($stockEntry->type, ['item_receipt', 'item_transfer'])) {
            $stockEntry->additionalCosts()
                ->whereNotIn('id', array_column($data['additional_costs'] ?? [], 'id'))
                ->update(['deleted_at' => now()]);
            $additionalCostIds = collect($data['additional_costs'] ?? [])
                ->pluck('id')
                ->filter(fn ($id) => Ulid::isValid((string) $id))
                ->values()
                ->all();
            $existingAdditionalCosts = $stockEntry->additionalCosts()
                ->whereIn('id', $additionalCostIds)
                ->get()
                ->keyBy('id');

            foreach ($data['additional_costs'] ?? [] as $additional_cost) {
                if (Ulid::isValid($additional_cost['id'])) {
                    $existingAdditionalCosts->get($additional_cost['id'])?->update($this->fillAdditionalCostRelations($additional_cost));

                    continue;
                }
                $stockEntry->additionalCosts()->create($this->fillAdditionalCostRelations($additional_cost));
            }
        } else {
            $stockEntry->additionalCosts()->delete();
        }

        $units            = $this->batchLoadUnits($data);
        $defaultUnits     = $this->batchLoadDefaultUnits($data);
        $stockSourceCache = $this->preloadStockSourceCache($data, $stockEntry);

        $data['items'] = array_map(fn ($item) => $this->fillItemRelations($item, $stockEntry, $stockSourceCache, $units, $defaultUnits), $data['items']);

        $totalAdditionalCost  = \array_sum(array_column($data['additional_costs'] ?? [], 'amount'));
        $totalBasicAmountItem = \array_sum(array_column($data['items'], 'basic_amount'));

        $stockEntry->items()
            ->whereNotIn('id', array_column($data['items'], 'id'))
            ->update(['deleted_at' => now()]);
        $itemIds = collect($data['items'])
            ->pluck('id')
            ->filter(fn ($id) => Ulid::isValid((string) $id))
            ->values()
            ->all();
        $existingItems = $stockEntry->items()
            ->whereIn('id', $itemIds)
            ->get()
            ->keyBy('id');
        foreach ($data['items'] as &$item) {
            $additionalCost = $totalBasicAmountItem != 0
                ? ($item['basic_amount'] / $totalBasicAmountItem) * $totalAdditionalCost
                : 0;

            $valuation_rate = $item['qty_needed_in_default_unit'] <= 0 ? 0 : ($additionalCost + $item['basic_amount']) / ($item['qty_needed_in_default_unit']);

            $item['additional_cost'] = $additionalCost;
            $item['valuation_rate']  = $valuation_rate;
            unset($item['basic_amount']);
            if (Ulid::isValid($item['id'])) {
                $existingItems->get($item['id'])?->update($item);

                continue;
            }
            $stockEntry->items()->create($item);
        }

        return $stockEntry;
    }

    private function rolllbackItems(StockEntry $stockEntry) {
        $items = $stockEntry->items()
            ->get();
        $stocks = Stock::whereIn('item_variant_id', $items->pluck('item_id'))
            ->whereIn('warehouse_id', $items->pluck('source_warehouse_id'))
            ->lockForUpdate()
            ->get()
            ->keyBy(fn ($stock) => $this->getStockKey($stock->item_variant_id, $stock->warehouse_id));

        foreach ($items as $item) {
            $stockKey = $this->getStockKey($item->item_id, $item->source_warehouse_id);
            $stock    = $stocks->get($stockKey);
            if (! $stock) {
                continue;
            }

            $quantity = $item->quantity * $item->conversion_factor / $stock->conversion_factor;
            $stock->update([
                'reserved_quantity' => $stock->reserved_quantity - $quantity,
            ]);
        }
    }

    public function submit(Model $stockEntry): mixed {
        DB::beginTransaction();

        $stockEntry->update([
            'code' => FormatingSeries::generate(StockEntry::class, $stockEntry),
        ]);
        if (\in_array($stockEntry->type, ['item_issue', 'item_transfer', 'item_consumption'])) {

            $items = $stockEntry->items()
                ->with(['item', 'item.item', 'sourceWarehouse', 'unit'])
                ->get();
            $stocks = Stock::whereIn('item_variant_id', $items->pluck('item_id'))
                ->whereIn('warehouse_id', $items->pluck('source_warehouse_id'))
                ->with(['unit'])
                ->lockForUpdate()
                ->get()
                ->keyBy(fn ($stock) => $this->getStockKey($stock->item_variant_id, $stock->warehouse_id));
            $errorItems = [];
            foreach ($items as $item) {
                $stockKey  = $this->getStockKey($item->item_id, $item->source_warehouse_id);
                $stock     = $stocks->get($stockKey);
                $itemLabel = "{$item->item->code} - {$item->item->item_name}";

                if (! $stock) {
                    $errorItems[] = "Item {$itemLabel} is not in {$item->sourceWarehouse->name} stock";

                    continue;
                }
                $quantity = $item->quantity * $item->conversion_factor / $stock->conversion_factor;
                if ($stock->ready_quantity < $quantity) {
                    $stockUnitName = $stock->unit?->name;
                    $orderUnitName = $item->unit?->name;
                    $errorItems[]  = "Item {$itemLabel} in {$item->sourceWarehouse->name} stock is {$stock->ready_quantity} {$stockUnitName} but you need {$quantity} {$stockUnitName} ({$item->quantity} {$orderUnitName})";

                    continue;
                }
                $stock->update([
                    'reserved_quantity' => $stock->reserved_quantity + $quantity,
                ]);
            }
            if (\count($errorItems) > 0) {
                DB::rollBack();
                throw ValidationException::withMessages([
                    'items' => $errorItems,
                ]);
            }
        }
        DB::commit();

        $stockEntry->checkApproval();

        return $stockEntry;
    }

    public function onApproved(Model $stockEntry): mixed {
        DB::beginTransaction();
        $stockEntry->update([
            'status' => FormStatus::COMPLETED,
        ]);

        $items           = $stockEntry->items()->with('item', 'item.item', 'item.defaultUom', 'unit', 'sourceWarehouse', 'targetWarehouse')->get();
        $additionalCosts = $stockEntry->additionalCosts()
            ->with([
                'expenseAccount' => function ($q) {
                    $q->lockForUpdate();
                },
            ])
            ->get();

        $totalAdditionalCost = $additionalCosts->sum('amount');
        $totalBasicAmount    = $items->sum('basic_amount');
        $sourceStocks        = collect();
        $targetStocks        = collect();

        if (\in_array($stockEntry->type, ['item_issue', 'item_transfer', 'item_consumption'])) {
            $sourceStocks = Stock::whereIn('item_variant_id', $items->pluck('item_id'))
                ->whereIn('warehouse_id', $items->pluck('source_warehouse_id'))
                ->lockForUpdate()
                ->get()
                ->keyBy(fn ($stock) => $this->getStockKey($stock->item_variant_id, $stock->warehouse_id));
        }

        if (\in_array($stockEntry->type, ['item_receipt', 'item_transfer'])) {
            $targetStocks = Stock::whereIn('item_variant_id', $items->pluck('item_id'))
                ->whereIn('warehouse_id', $items->pluck('target_warehouse_id'))
                ->lockForUpdate()
                ->get()
                ->keyBy(fn ($stock) => $this->getStockKey($stock->item_variant_id, $stock->warehouse_id));
        }

        $missingSourceStocks = [];
        if (\in_array($stockEntry->type, ['item_issue', 'item_transfer', 'item_consumption'])) {
            foreach ($items as $item) {
                $sourceStockKey = $this->getStockKey($item->item_id, $item->source_warehouse_id);
                if ($sourceStocks->has($sourceStockKey) || isset($missingSourceStocks[$sourceStockKey])) {
                    continue;
                }

                $defaultUom                           = $item->item->defaultUom;
                $missingSourceStocks[$sourceStockKey] = [
                    'item_variant_id'   => $item->item_id,
                    'warehouse_id'      => $item->source_warehouse_id,
                    'conversion_factor' => $defaultUom->conversion_factor,
                    'item_unit_id'      => $defaultUom->id,
                    'stock_queue'       => [],
                ];
            }

            foreach ($missingSourceStocks as $sourceStockKey => $missingSourceStock) {
                $stockSource = Stock::lockForUpdate()->firstOrCreate([
                    'item_variant_id' => $missingSourceStock['item_variant_id'],
                    'warehouse_id'    => $missingSourceStock['warehouse_id'],
                ], [
                    'conversion_factor' => $missingSourceStock['conversion_factor'],
                    'item_unit_id'      => $missingSourceStock['item_unit_id'],
                    'stock_queue'       => $missingSourceStock['stock_queue'],
                ]);
                $sourceStocks->put($sourceStockKey, $stockSource);
            }
        }

        $missingTargetStocks = [];
        if (\in_array($stockEntry->type, ['item_receipt', 'item_transfer'])) {
            foreach ($items as $item) {
                $targetStockKey = $this->getStockKey($item->item_id, $item->target_warehouse_id);
                if ($targetStocks->has($targetStockKey) || isset($missingTargetStocks[$targetStockKey])) {
                    continue;
                }

                $defaultUom                           = $item->item->defaultUom;
                $missingTargetStocks[$targetStockKey] = [
                    'item_variant_id'   => $item->item_id,
                    'warehouse_id'      => $item->target_warehouse_id,
                    'conversion_factor' => $defaultUom->conversion_factor,
                    'item_unit_id'      => $defaultUom->id,
                    'stock_queue'       => [],
                ];
            }

            foreach ($missingTargetStocks as $targetStockKey => $missingTargetStock) {
                $stockTarget = Stock::lockForUpdate()->firstOrCreate([
                    'item_variant_id' => $missingTargetStock['item_variant_id'],
                    'warehouse_id'    => $missingTargetStock['warehouse_id'],
                ], [
                    'conversion_factor' => $missingTargetStock['conversion_factor'],
                    'item_unit_id'      => $missingTargetStock['item_unit_id'],
                    'stock_queue'       => $missingTargetStock['stock_queue'],
                ]);
                $targetStocks->put($targetStockKey, $stockTarget);
            }
        }

        foreach ($items as $item) {
            unset($picked);
            $defaultUom              = $item->item->defaultUom;
            $defaultConvertionFactor = $defaultUom->conversion_factor;
            $qtyNeeded               = $item->quantity * ($item->conversion_factor / $defaultConvertionFactor);

            if (\in_array($stockEntry->type, ['item_issue', 'item_transfer', 'item_consumption'])) {
                // get stock from source warehouse
                $sourceStockKey = $this->getStockKey($item->item_id, $item->source_warehouse_id);
                $stockSource    = $sourceStocks->get($sourceStockKey);
                if (! $stockSource) {
                    continue;
                }

                // update queue fifo in source warehouse

                $rentedQuantity  = $stockSource->rented_quantity ?? 0;
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

                $stockSource->refresh();
                StockLedgerEntry::create([
                    'item_id'                    => $item->item_id,
                    'warehouse_id'               => $item->source_warehouse_id,
                    'item_unit_id'               => $defaultUom->id,
                    'conversion_factor'          => $defaultConvertionFactor,
                    'quantity_change'            => -$qtyNeeded,
                    'quantity_after_transaction' => $stockSource->actual_quantity,
                    'valuation_rate'             => $stockSource->valuation_rate,
                    'balance_stock_value'        => \array_sum(array_map(fn ($q) => $q['rate'] * $q['quantity'], $stockSource->stock_queue)),
                    'change_in_stock_value'      => -\array_sum(array_map(fn ($q) => $q['rate'] * $q['quantity'], $picked)),
                    'stock_queue'                => $stockSource->stock_queue,
                    'referenceable_type'         => StockEntry::class,
                    'referenceable_id'           => $stockEntry->id,
                    'transaction_date'           => now(),
                ]);
            }

            if (\in_array($stockEntry->type, ['item_receipt', 'item_transfer'])) {
                // get stock from target warehouse
                $targetStockKey = $this->getStockKey($item->item_id, $item->target_warehouse_id);
                $stockTarget    = $targetStocks->get($targetStockKey);
                if (! $stockTarget) {
                    continue;
                }

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
                $stockTarget->refresh();
                StockLedgerEntry::create([
                    'item_id'                    => $item->item_id,
                    'warehouse_id'               => $item->target_warehouse_id,
                    'item_unit_id'               => $defaultUom->id,
                    'conversion_factor'          => $defaultConvertionFactor,
                    'quantity_change'            => $qtyNeeded,
                    'quantity_after_transaction' => $stockTarget->actual_quantity,
                    'valuation_rate'             => $stockTarget->valuation_rate,
                    'balance_stock_value'        => \array_sum(array_map(fn ($q) => $q['rate'] * $q['quantity'], $stockTarget->stock_queue)),
                    'change_in_stock_value'      => $basicAmount + $additionalCost,
                    'stock_queue'                => $stockTarget->stock_queue,
                    'referenceable_type'         => StockEntry::class,
                    'referenceable_id'           => $stockEntry->id,
                    'transaction_date'           => now(),
                ]);
            }
        }

        $debitAccount = Account::lockForUpdate()
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
                'transaction_date'   => now(),
            ]);
            GeneralLedger::create([
                'account_id'         => $creditAccount->id,
                'against_account_id' => $debitAccount->id,
                'debit'              => 0,
                'credit'             => $totalBasicAmount,
                'referenceable_type' => StockEntry::class,
                'referenceable_id'   => $stockEntry->id,
                'transaction_date'   => now(),
            ]);
        } elseif (\in_array($stockEntry->type, ['item_issue'])) {
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
                'transaction_date'   => now(),
            ]);
            GeneralLedger::create([
                'account_id'         => $creditAccount->id,
                'against_account_id' => $debitAccount->id,
                'debit'              => $totalBasicAmount,
                'credit'             => 0,
                'referenceable_type' => StockEntry::class,
                'referenceable_id'   => $stockEntry->id,
                'transaction_date'   => now(),
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
                    'transaction_date'   => now(),
                ]);
                GeneralLedger::create([
                    'account_id'         => $expenseAccount->id,
                    'against_account_id' => $debitAccount->id,
                    'debit'              => 0,
                    'credit'             => $additionalCost->amount,
                    'referenceable_type' => StockEntry::class,
                    'referenceable_id'   => $stockEntry->id,
                    'transaction_date'   => now(),
                ]);
            }
        }

        DB::commit();

        return $stockEntry;
    }

    public function onRejected(Model $stockEntry): mixed {
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

    public function cancel(Model $stockEntry): mixed {
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

    public function amend(Model $model): mixed {
        return $model;
    }
}
