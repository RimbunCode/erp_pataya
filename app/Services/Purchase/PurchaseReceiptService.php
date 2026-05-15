<?php

namespace App\Services\Purchase;

use App\FormStatus;
use App\Models\Core\FormatingSeries;
use App\Models\Core\ModelConnection;
use App\Models\Finances\Account;
use App\Models\Inventory\Stock;
use App\Models\Inventory\StockLedgerEntry;
use App\Models\Purchase\PurchaseOrder;
use App\Models\Purchase\PurchaseReceipt;
use App\Utils;
use Illuminate\Support\Facades\DB;
use Symfony\Component\Uid\Ulid;

class PurchaseReceiptService {
    private function fillRelations(array $data) {
        $data['purchase_order_id'] = $data['purchase_order']['id'];
        $data['supplier_id']       = $data['supplier']['id'];
        $data['return_against_id'] = $data['return_against']['id'] ?? null;

        return $data;
    }

    private function fillItemRelations(array $data) {
        $data['item_id']             = $data['item']['id'];
        $data['item_unit_id']        = $data['unit']['id'];
        $data['conversion_factor']   = $data['unit']['conversion_factor'];
        $data['target_warehouse_id'] = $data['target_warehouse']['id'] ?? '';

        return $data;
    }

    public function create(array $data) {
        $data['code']    = FormatingSeries::generate(PurchaseReceipt::class, $data, true);
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
        DB::beginTransaction();

        $purchaseReceipt->update([
            'code' => FormatingSeries::generate(PurchaseReceipt::class, $purchaseReceipt),
        ]);
        ModelConnection::create([
            'model_type'     => PurchaseOrder::class,
            'model_id'       => $purchaseReceipt->purchase_order_id,
            'reference_type' => PurchaseReceipt::class,
            'reference_id'   => $purchaseReceipt->id,
        ]);
        DB::commit();
        $purchaseReceipt->checkApproval();

        return $purchaseReceipt;
    }

    public function onApproved(PurchaseReceipt $purchaseReceipt) {
        DB::beginTransaction();
        $returnAgainst = $purchaseReceipt->returnAgainst;
        $purchaseReceipt->update([
            'status' => $returnAgainst ? FormStatus::RETURNED : FormStatus::RECEIVED,
        ]);

        $purchaseOrder = $purchaseReceipt->purchaseOrder;

        $items = $purchaseReceipt->items()
            ->with([
                'item',
                'item.item',
                'item.defaultUom',
                'purchaseOrderItem',
                'targetWarehouse',
                'returnAgainstItem',
            ])->get();

        $totalRates = 0;
        foreach ($items as $item) {
            $defaultUom              = $item->item->defaultUom;
            $defaultConvertionFactor = $defaultUom->conversion_factor;
            $stock                   = Stock::lockForUpdate()->firstOrCreate([
                'item_variant_id' => $item->item_id,
                'warehouse_id'    => $item->target_warehouse_id,
            ], [
                'conversion_factor' => $defaultConvertionFactor,
                'item_unit_id'      => $defaultUom->id,
                'stock_queue'       => [],
            ]);
            $quantity                = $item->quantity * $item->conversion_factor / $stock->conversion_factor;
            $queue                   = $stock->stock_queue;

            $totalRate   = $item->purchaseOrderItem->rate * $quantity;
            $totalRates += $totalRate;

            if ($returnAgainst) {
                for ($i = \count($queue) - 1; $i >= 0; $i--) {
                    if ($queue[$i]['rate'] == $item->purchaseOrderItem->rate) {
                        $queue[$i]['quantity'] -= $quantity;
                        break;
                    }
                }

                $stock->update([
                    'stock_queue' => $queue,
                    'quantity'    => $stock->quantity - $quantity,
                ]);

                $stock->updateDetails('increment', 'incomings', $purchaseOrder->code, $quantity);

                $item->returnAgainstItem->increment('returned_quantity', $quantity);
                $item->purchaseOrderItem->decrement('received_quantity', $quantity);
                $stock->refresh();
                StockLedgerEntry::create([
                    'item_id'                    => $item->item_id,
                    'warehouse_id'               => $item->target_warehouse_id,
                    'item_unit_id'               => $defaultUom->id,
                    'conversion_factor'          => $defaultConvertionFactor,
                    'quantity_change'            => -$quantity,
                    'quantity_after_transaction' => $stock->actual_quantity,
                    'valuation_rate'             => $stock->valuation_rate,
                    'balance_stock_value'        => \array_sum(array_map(fn ($q) => $q['rate'] * $q['quantity'], $stock->stock_queue)),
                    'change_in_stock_value'      => -$totalRate,
                    'stock_queue'                => $stock->stock_queue,
                    'referenceable_type'         => PurchaseReceipt::class,
                    'referenceable_id'           => $purchaseReceipt->id,
                ]);

                continue;
            }

            $queue[] = [
                'rate'     => $item->purchaseOrderItem->rate,
                'quantity' => $quantity,
            ];

            $stock->update([
                'stock_queue' => $queue,
                'quantity'    => $stock->quantity + $quantity,
            ]);
            $item->purchaseOrderItem->increment('received_quantity', $quantity);
            $stock->updateDetails('decrement', 'incomings', $purchaseOrder->code, $quantity);
            $stock->refresh();
            StockLedgerEntry::create([
                'item_id'                    => $item->item_id,
                'warehouse_id'               => $item->target_warehouse_id,
                'item_unit_id'               => $defaultUom->id,
                'conversion_factor'          => $defaultConvertionFactor,
                'quantity_change'            => $quantity,
                'quantity_after_transaction' => $stock->actual_quantity,
                'valuation_rate'             => $stock->valuation_rate,
                'balance_stock_value'        => \array_sum(array_map(fn ($q) => $q['rate'] * $q['quantity'], $stock->stock_queue)),
                'change_in_stock_value'      => $totalRate,
                'stock_queue'                => $stock->stock_queue,
                'referenceable_type'         => PurchaseReceipt::class,
                'referenceable_id'           => $purchaseReceipt->id,
            ]);

        }

        $unreceived_items     = $purchaseOrder->items()->select('unreceived_quantity', 'quantity');
        $countUnreceivedItems = $unreceived_items->sum('unreceived_quantity');
        $sumQuantity          = $unreceived_items->sum('quantity');
        if ($countUnreceivedItems == $sumQuantity) {
            $status = Utils::replaceStatus(
                $purchaseOrder->status,
                [FormStatus::RECEIVED, FormStatus::PARTIALLY_RECEIVED],
                FormStatus::TO_RECEIVE,
            );
        } elseif ($countUnreceivedItems > 0) {
            $status = Utils::replaceStatus(
                $purchaseOrder->status,
                FormStatus::TO_RECEIVE,
                FormStatus::PARTIALLY_RECEIVED,
            );
        } else {
            $status = Utils::replaceStatus(
                $purchaseOrder->status,
                [FormStatus::TO_RECEIVE, FormStatus::PARTIALLY_RECEIVED],
                FormStatus::RECEIVED,
            );
        }

        $purchaseOrder->update([
            'status' => $status,
        ]);

        $debitAccount = Account::lockForUpdate()
            ->where('root_type', 'asset')
            ->where('account_type', 'stock')
            ->latest()->first();

        $creditAccount = Account::lockForUpdate()
            ->where('root_type', 'liability')
            ->where('account_type', 'stock_received_but_not_billed')
            ->latest()->first();

        $creditAccount->generalLedgerEntries()->create([
            'against_account_id' => $debitAccount->id,
            'credit'             => $returnAgainst ? 0 : $totalRates,
            'debit'              => $returnAgainst ? $totalRates : 0,
            'referenceable_type' => PurchaseReceipt::class,
            'referenceable_id'   => $purchaseReceipt->id,
        ]);

        $debitAccount->generalLedgerEntries()->create([
            'against_account_id' => $creditAccount->id,
            'credit'             => $returnAgainst ? $totalRates : 0,
            'debit'              => $returnAgainst ? 0 : $totalRates,
            'referenceable_type' => PurchaseReceipt::class,
            'referenceable_id'   => $purchaseReceipt->id,
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
