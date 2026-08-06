<?php

namespace App\Services\Service;

use App\Contracts\SubmitableService;
use App\Enums\FormStatus;
use App\Models\Core\Branch;
use App\Models\Core\FormatingSeries;
use App\Models\Inventory\ItemUnit;
use App\Models\Inventory\ItemVariant;
use App\Models\Model;
use App\Models\Sales\Customer;
use App\Models\Service\WorkOrder;
use App\Traits\HasDefaultDelete;
use App\Utils;
use Symfony\Component\Uid\Ulid;

class WorkOrderService implements SubmitableService {
    use HasDefaultDelete;

    private function fillRelations(array $data) {
        if (! ($data['for_internal'] ?? false)) {
            $data['customer_id']   = $data['customer']['id'];
            $data['customer_name'] = Customer::find($data['customer']['id'])?->name;
        } else {
            $data['customer_id']   = null;
            $data['customer_name'] = null;
        }
        $data['customer_branch_id']   = $data['customer_branch']['id'];
        $data['customer_branch_name'] = Branch::find($data['customer_branch']['id'])?->name;
        $data['address']              = [];
        $data['item_service_id']      = $data['item_service']['id'];
        $data['item_service_name']    = ItemVariant::find($data['item_service']['id'])?->code;

        return $data;
    }

    private function fillItemRelations(array $data, array $units = []) {
        $unit                      = $units[$data['unit']['id']] ?? null;
        $data['item_variant_id']   = $data['item']['id'];
        $data['item_name']         = $data['item']['code'];
        $data['item_unit_id']      = $data['unit']['id'];
        $data['unit_name']         = $unit?->unit?->name ?? null;
        $data['conversion_factor'] = $unit?->conversion_factor ?? 1;

        return $data;
    }

    private function batchLoadUnits(array $data): array {
        $unitIds = collect($data['items'])->pluck('unit.id')->filter()->unique()->values();

        return ItemUnit::with('unit')->whereIn('item_units.id', $unitIds)->get()->keyBy('id')->all();
    }

    public function create(array $data): Model {
        $data['code'] = FormatingSeries::generate(WorkOrder::class, $data, true);
        $wo           = WorkOrder::create($this->fillRelations($data));
        $units        = $this->batchLoadUnits($data);

        foreach ($data['items'] as $item) {
            $item = $this->fillItemRelations($item, $units);
            $wo->items()->create($item);
        }

        return $wo;
    }

    public function update(Model $workOrder, array $data): Model {
        $workOrder->fillForUpdate($this->fillRelations($data));

        $workOrder->items()
            ->whereNotIn('id', array_column($data['items'], 'id'))
            ->update(['deleted_at' => now()]);
        $itemIds = collect($data['items'])
            ->pluck('id')
            ->filter(fn ($id) => Ulid::isValid((string) $id))
            ->values()
            ->all();
        $existingItems = $workOrder->items()
            ->whereIn('id', $itemIds)
            ->get()
            ->keyBy('id');

        $units = $this->batchLoadUnits($data);

        foreach ($data['items'] as $item) {
            $item = $this->fillItemRelations($item, $units);

            if (Ulid::isValid($item['id'])) {
                unset($item['item']);
                unset($item['unit']);
                $existingItems->get($item['id'])?->update($item);

                continue;
            }
            $workOrder->items()->create($item);
        }

        return $workOrder;
    }

    public function submit(Model $workOrder): mixed {
        $workOrder->update([
            'code' => FormatingSeries::generate(WorkOrder::class, $workOrder),
        ]);
        $workOrder->checkApproval();

        return $workOrder;
    }

    public function onApproved(Model $workOrder): mixed {
        $workOrder->update([
            'status' => FormStatus::PENDING,
        ]);

        return $workOrder;
    }

    public function onRejected(Model $workOrder): mixed {
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

        return $workOrder;
    }

    public function complate(WorkOrder $workOrder) {
        $status = Utils::replaceStatus($workOrder->status, FormStatus::IN_PROGRESS, FormStatus::COMPLETED);

        $workOrder->fillForUpdate([
            'status'       => $status,
            'completed_at' => now(),
        ]);

        return $workOrder;
    }

    public function cancel(Model $workOrder): mixed {
        $workOrder->fillForUpdate([
            'status' => FormStatus::CANCELED,
        ]);

        return $workOrder;
    }

    public function amend(Model $model): mixed {
        return $model;
    }
}
