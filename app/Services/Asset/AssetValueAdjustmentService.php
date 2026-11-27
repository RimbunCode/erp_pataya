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
            $data       = $this->flattenRelationFields($data);
            $asset      = Asset::findOrFail($data['asset_id']);
            $adjustment = AssetValueAdjustment::create([
                'code'                => FormatingSeries::generate(AssetValueAdjustment::class, $data, true),
                'current_asset_value' => $asset->bookValue(),
                ...Arr::only($data, ['asset_id', 'date', 'new_asset_value', 'branch_id']),
                // Akun selisih tidak diterima dari input; engine yang menentukan (Q-P2-23, 2026-11-22).
                'difference_account_id' => null,
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
            $data = $this->flattenRelationFields($data);
            $model->update([
                ...Arr::only($data, ['asset_id', 'date', 'new_asset_value', 'branch_id']),
                // Update draft mengosongkan akun lama; engine mengisinya (Q-P2-23, 2026-11-22).
                'difference_account_id' => null,
            ]);
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

    /**
     * Frontend mengirim relasi (asset) sebagai objek
     * LinkModel utuh ({id, ...}), bukan string id flat. Ekstrak `.id` ke key
     * `_id` yang dikonsumsi Arr::only() di atas, sama seperti pola
     * PurchaseOrderService::fillItemRelations() / AssetService::flattenRelationFields().
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function flattenRelationFields(array $data): array {
        if (isset($data['asset']['id'])) {
            $data['asset_id'] = $data['asset']['id'];
        }

        return $data;
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

    /**
     * Seluruh perubahan status, `GlPostingStatus`, dan posting inline berjalan dalam satu transaksi dokumen (pola
     * `SalesInvoiceService`/`PaymentEntryService`): kegagalan posting inline (mis. peran akun belum dipetakan di
     * Posting Profile) menggulung status dokumen dan exception-nya, yang pesannya menyebut peran dan halaman
     * konfigurasi, sampai ke pengguna (Requirement 9.3 dan 13.7), bukan ditelan `PostingExecutionRouter`.
     */
    public function onApproved(Model $model): mixed {
        DB::transaction(function () use ($model) {
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
        });

        return null;
    }

    public function onRejected(Model $model): mixed {
        $model->update(['status' => [FormStatus::DRAFT]]);

        return $model;
    }
}
