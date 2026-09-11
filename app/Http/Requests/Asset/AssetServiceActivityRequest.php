<?php

namespace App\Http\Requests\Asset;

use App\Enums\FormStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class AssetServiceActivityRequest extends FormRequest {
    public function rules(): array {
        return [
            'action_date' => ['required', 'date'],
            'pic_id'      => ['nullable', 'string', 'exists:users,id'],
            'description' => ['required', 'string'],
            'status'      => ['required', Rule::in([
                FormStatus::IN_PROGRESS->value,
                FormStatus::RESOLVED->value,
                FormStatus::WAITING->value,
                FormStatus::ON_HOLD->value,
                FormStatus::COMPLETED->value,
            ])],
        ];
    }

    /**
     * Requirement 9 AC8 & AC10: batas bawah (action_date tidak boleh
     * sebelum activity pertama) dan batas atas khusus status=completed
     * (action_date wajib setelah activity terbesar yang sudah ada).
     */
    public function withValidator(Validator $validator): void {
        $validator->after(function (Validator $validator) {
            $assetService = $this->route('assetService')
                ?? $this->route('activity')?->assetService;
            if (! $assetService) {
                return;
            }

            $newActionDate = $this->date('action_date');

            // AC8: relasi activities() sudah default orderBy action_date
            // ASC, id ASC (AssetService::activities()) -- oldest('id')
            // konsisten (ascending), aman TANPA reorder().
            $firstActionDate = $assetService->activities()->oldest('id')->value('action_date');
            if ($firstActionDate && $newActionDate?->lt($firstActionDate)) {
                $validator->errors()->add(
                    'action_date',
                    __('asset/service.action_date_before_first'),
                );
            }

            // AC10: kebalikan arah dari AC8 -- butuh DESCENDING, reorder()
            // WAJIB supaya tidak numpuk di atas default ASC relasi (bug yang
            // sama ditemukan & difix di AssetServiceActivity::booted()).
            if ($this->input('status') === FormStatus::COMPLETED->value) {
                $currentLatest = $assetService->activities()
                    ->when($this->route('activity'), fn ($q, $activity) => $q->whereKeyNot($activity->id))
                    ->reorder('action_date', 'desc')->orderByDesc('id')
                    ->value('action_date');

                if ($currentLatest && ! $newActionDate?->gt($currentLatest)) {
                    $validator->errors()->add(
                        'action_date',
                        __('asset/service.completed_action_date_must_be_latest'),
                    );
                }
            }
        });
    }
}
