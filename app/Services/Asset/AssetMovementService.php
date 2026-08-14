<?php

namespace App\Services\Asset;

use App\Contracts\SubmitableService;
use App\Enums\AssetMovementPurpose;
use App\Enums\FormStatus;
use App\Events\Asset\AssetMovementApproved;
use App\Models\Asset\AssetMovement;
use App\Models\Core\FormatingSeries;
use App\Models\Model;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use LogicException;

class AssetMovementService implements SubmitableService {
    public function create(array $data): Model {
        DB::beginTransaction();

        try {
            $movement = AssetMovement::create([
                'code' => FormatingSeries::generate(AssetMovement::class, $data, true),
                ...Arr::only($data, ['purpose', 'transaction_date', 'branch_id', 'reference_type', 'reference_id']),
            ]);

            foreach ($data['items'] ?? [] as $item) {
                $movement->items()->create(Arr::only($item, [
                    'asset_id', 'source_location_id', 'target_location_id',
                    'from_custodian_id', 'to_custodian_id',
                ]));
            }
            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();

            throw $e;
        }

        return $movement;
    }

    public function update(Model $model, array $data): Model {
        DB::beginTransaction();

        try {
            $model->update(Arr::only($data, ['purpose', 'transaction_date', 'branch_id', 'reference_type', 'reference_id']));

            if (array_key_exists('items', $data)) {
                $model->items()->delete();
                foreach ($data['items'] as $item) {
                    $model->items()->create(Arr::only($item, [
                        'asset_id', 'source_location_id', 'target_location_id',
                        'from_custodian_id', 'to_custodian_id',
                    ]));
                }
            }
            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();

            throw $e;
        }

        return $model;
    }

    public function delete(Model $model): void {
        $model->delete();
    }

    public function submit(Model $model): mixed {
        $this->validateItems($model);

        DB::beginTransaction();

        try {
            $model->update([
                'code' => FormatingSeries::generate(AssetMovement::class, $model),
            ]);
            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();

            throw $e;
        }

        return $model->checkApproval();
    }

    public function cancel(Model $model): mixed {
        $model->update(['status' => [FormStatus::CANCELED]]);

        return $model;
    }

    public function amend(Model $model): mixed {
        return $model->amend();
    }

    public function onApproved(Model $model): mixed {
        $statusValues   = array_map(fn (FormStatus $s) => $s->value, $model->status ?? []);
        $statusValues   = array_values(array_diff($statusValues, [FormStatus::DRAFT->value]));
        $statusValues[] = FormStatus::SUBMITTED->value;

        $model->update(['status' => array_map(fn (string $v) => FormStatus::from($v), $statusValues)]);

        event(new AssetMovementApproved($model));

        return null;
    }

    public function onRejected(Model $model): mixed {
        $model->update(['status' => [FormStatus::DRAFT]]);

        return $model;
    }

    /**
     * Requirement 2: validasi field lokasi wajib per purpose, konsistensi
     * source_location dengan lokasi Asset saat ini, dan status Asset ACTIVE.
     */
    private function validateItems(AssetMovement $model): void {
        $purpose = $model->purpose;

        foreach ($model->items as $item) {
            $asset = $item->asset;

            if (! $asset || ! in_array(FormStatus::ACTIVE, $asset->status ?? [], true)) {
                throw new LogicException(__('asset/movement.asset_must_be_active', ['code' => $asset?->code]));
            }

            if (in_array($purpose, [AssetMovementPurpose::TRANSFER, AssetMovementPurpose::TRANSFER_AND_ISSUE], true)) {
                if (! $item->source_location_id || ! $item->target_location_id) {
                    throw new LogicException(__('asset/movement.transfer_requires_both_locations'));
                }
            }

            if ($purpose === AssetMovementPurpose::ISSUE && ! $item->target_location_id) {
                throw new LogicException(__('asset/movement.issue_requires_target_location'));
            }

            if ($purpose === AssetMovementPurpose::RECEIPT && ! $item->source_location_id) {
                throw new LogicException(__('asset/movement.receipt_requires_source_location'));
            }

            if ($item->source_location_id && $item->source_location_id !== $asset->asset_location_id) {
                throw new LogicException(__('asset/movement.source_location_mismatch', ['code' => $asset->code]));
            }
        }
    }
}
