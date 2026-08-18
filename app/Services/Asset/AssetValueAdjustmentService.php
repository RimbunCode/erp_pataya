<?php

namespace App\Services\Asset;

use App\Contracts\SubmitableService;
use App\Enums\FormStatus;
use App\Events\Asset\AssetValueAdjustmentApproved;
use App\Models\Asset\Asset;
use App\Models\Asset\AssetValueAdjustment;
use App\Models\Core\FormatingSeries;
use App\Models\Core\GlPostingStatus;
use App\Models\Model;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;

class AssetValueAdjustmentService implements SubmitableService {
    public function create(array $data): Model {
        DB::beginTransaction();

        try {
            $asset      = Asset::findOrFail($data['asset_id']);
            $adjustment = AssetValueAdjustment::create([
                'code'                => FormatingSeries::generate(AssetValueAdjustment::class, $data, true),
                'current_asset_value' => $asset->bookValue(),
                ...Arr::only($data, [
                    'asset_id', 'date', 'new_asset_value',
                    'difference_account_id', 'branch_id',
                ]),
            ]);
            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();

            throw $e;
        }

        return $adjustment;
    }

    public function update(Model $model, array $data): Model {
        DB::beginTransaction();

        try {
            $model->update(Arr::only($data, [
                'asset_id', 'date', 'new_asset_value',
                'difference_account_id', 'branch_id',
            ]));
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
        DB::beginTransaction();

        try {
            $model->update([
                'code' => FormatingSeries::generate(AssetValueAdjustment::class, $model),
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

        if ((float) $model->difference_amount !== 0.0) {
            GlPostingStatus::create([
                'referenceable_type' => AssetValueAdjustment::class,
                'referenceable_id'   => $model->id,
                'status'             => 'pending',
            ]);
            event(new AssetValueAdjustmentApproved($model, now()));
        }

        return null;
    }

    public function onRejected(Model $model): mixed {
        $model->update(['status' => [FormStatus::DRAFT]]);

        return $model;
    }
}
