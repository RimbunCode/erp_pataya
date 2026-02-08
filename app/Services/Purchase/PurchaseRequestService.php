<?php

namespace App\Services\Purchase;

use App\FormStatus;
use App\Models\Core\ModelConnection;
use App\Models\Purchase\PurchaseRequest;
use Illuminate\Support\Facades\DB;
use Symfony\Component\Uid\Ulid;

class PurchaseRequestService
{
    private function fillRelations(array $data)
    {
        if (isset($data['branch'])) {
            $data['branch_id'] = $data['branch']['id'];
        }

        return $data;
    }

    private function fillItemRelations(array $data)
    {
        $data['item_variant_id'] = $data['item']['id'];
        $data['item_name'] = $data['item']['sku'];
        $data['unit_id'] = $data['unit']['id'];
        $data['unit_name'] = $data['unit']['name'];
        $data['conversion_factor'] = $data['unit']['conversion_factor'];

        return $data;
    }

    public function create(array $data)
    {
        $pr = PurchaseRequest::create($this->fillRelations($data));

        foreach ($data['items'] as $item) {
            $item = $this->fillItemRelations($item);
            $pr->items()->create($item);
        }
        $pr->logForCreated();

        return $pr;
    }

    public function update(PurchaseRequest $purchaseRequest, array $data)
    {
        $purchaseRequest->fillForUpdate($this->fillRelations($data));

        $purchaseRequest->items()
            ->whereNotIn('id', array_column($data['items'], 'id'))
            ->update(['deleted_at' => now()]);

        foreach ($data['items'] as $item) {
            $item = $this->fillItemRelations($item);

            if (Ulid::isValid($item['id'])) {
                $purchaseRequest->items()->find($item['id'])?->update($item);

                continue;
            }
            $purchaseRequest->items()->create($item);
        }
        $purchaseRequest->logForUpdated();

        return $purchaseRequest;
    }

    public function submit(PurchaseRequest $purchaseRequest)
    {
        $purchaseRequest->checkApproval();

        return $purchaseRequest;
    }

    public function onApproved(PurchaseRequest $purchaseRequest)
    {
        DB::beginTransaction();
        $purchaseRequest->update([
            'status' => FormStatus::TO_ORDER,
        ]);

        $items = $purchaseRequest->items()
            ->whereNotNull('referenceable_type')
            ->whereNotNull('referenceable_id')
            ->with(['referenceable'])
            ->get();

        $modelConnections = [];
        foreach ($items as $item) {
            // Update ordered_quantity from source item
            $sourceModel = $item->referenceable_type;
            $sourceItem = $sourceModel::find($item->referenceable_id);
            $orderedQty = $sourceItem->ordered_quantity + $item->quantity;
            $sourceItem->update([
                'ordered_quantity' => $orderedQty > $sourceItem->quantity ? $sourceItem->quantity : $orderedQty,
            ]);

            // Create Model connection beetween WorkOrder and PurchaseRequest
            $parentRelation = $sourceItem->parentRelation();
            $parentRelationKey = $parentRelation->getForeignKeyName();
            $modelConnections[] = [
                'model_type' => \get_class($parentRelation->getRelated()),
                'model_id' => $sourceItem->$parentRelationKey,
            ];
        }
        $modelConnections = \collect($modelConnections)->unique('model_id')->toArray();

        // Create ModelConnection for each item
        foreach ($modelConnections as $modelConnection) {
            ModelConnection::firstOrCreate([
                'model_type' => $modelConnection['model_type'],
                'model_id' => $modelConnection['model_id'],
                'reference_type' => PurchaseRequest::class,
                'reference_id' => $purchaseRequest->id,
            ]);
        }

        DB::commit();

        return $purchaseRequest;
    }

    public function onRejected(PurchaseRequest $purchaseRequest)
    {
        $purchaseRequest->update([
            'status' => FormStatus::REJECTED,
        ]);

        return $purchaseRequest;
    }

    public function cancel(PurchaseRequest $purchaseRequest)
    {
        $purchaseRequest->update([
            'status' => FormStatus::CANCELED,
        ]);

        return $purchaseRequest;
    }
}
