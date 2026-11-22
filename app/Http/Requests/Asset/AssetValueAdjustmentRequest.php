<?php

namespace App\Http\Requests\Asset;

use App\Enums\PostingDocumentType;
use App\Services\Finances\Posting\PostingModeResolver;
use Illuminate\Foundation\Http\FormRequest;

class AssetValueAdjustmentRequest extends FormRequest {
    /**
     * Akun selisih hanya divalidasi saat engine belum `on` untuk Asset Value Adjustment. Saat `on`, aturannya tidak ada
     * (termasuk `difference_account.*`) sehingga `validated()` membuang seluruh kolom akun dari request dan akun
     * ditentukan engine (Finance Fase 2, Task 12.3, Requirement 13.1/13.3).
     *
     * @return array<string, array<mixed>>
     */
    private function accountRules(): array {
        if (app(PostingModeResolver::class)->isOn(PostingDocumentType::AssetValueAdjustment)) {
            return [];
        }

        return [
            'difference_account.id' => ['required', 'string', 'exists:accounts,id'],
            'difference_account.*'  => ['nullable'],
        ];
    }

    public function rules(): array {
        return [
            'asset.id'        => ['required', 'string', 'exists:assets,id'],
            'asset.*'         => ['nullable'],
            'date'            => ['required', 'date'],
            'new_asset_value' => ['required', 'numeric', 'min:0'],
            ...$this->accountRules(),
            'branch_id' => ['nullable', 'string', 'exists:branches,id'],
        ];
    }
}
