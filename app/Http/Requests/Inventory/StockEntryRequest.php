<?php

namespace App\Http\Requests\Inventory;

use App\Enums\PostingDocumentType;
use App\Http\Requests\BaseFormRequest;
use App\Rules\ExistsExcludingTrashed;
use App\Services\Finances\Posting\PostingModeResolver;
use Illuminate\Contracts\Validation\ValidationRule;

class StockEntryRequest extends BaseFormRequest {
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool {
        return true;
    }

    /**
     * Akun pencatatan (akun selisih dan akun biaya tambahan) hanya divalidasi saat engine belum `on` untuk Stock
     * Entry. Saat `on`, aturannya tidak ada sehingga `validated()` membuang kolom akun dari request dan akun
     * ditentukan engine (Finance Fase 2, Task 12.3, Requirement 13.1/13.3).
     *
     * @return array<string, array<mixed>>
     */
    private function accountRules(): array {
        if (app(PostingModeResolver::class)->isOn(PostingDocumentType::StockEntry)) {
            return [];
        }

        return [
            'difference_account.id'                 => ['required', new ExistsExcludingTrashed('accounts')],
            'additional_costs.*.expense_account.id' => ['required', new ExistsExcludingTrashed('accounts')],
        ];
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array {
        return [
            ...$this->accountRules(),
            'date' => ['required', 'date'],
            'type' => ['required', 'string', 'in:item_transfer,item_issue,item_consumption,item_receipt'],
            // 'in_transit' => ['nullable', 'required_if:type,item_transfer', 'boolean'],
            'in_transit' => ['nullable', 'boolean'],
            // 'received_date' => ['nullable', 'required_if:type,item_transfer', 'date'],
            'received_date'               => ['nullable', 'date'],
            'notes'                       => ['nullable', 'string'],
            'items'                       => ['required', 'array', 'min:1'],
            'items.*.id'                  => ['required'],
            'items.*.item.id'             => ['required', new ExistsExcludingTrashed('item_variants')],
            'items.*.item.*'              => ['nullable'],
            'items.*.quantity'            => ['required', 'numeric', 'min:1'],
            'items.*.unit.id'             => ['required', new ExistsExcludingTrashed('item_units')],
            'items.*.unit.*'              => ['nullable'],
            'items.*.source_warehouse.id' => ['nullable', new ExistsExcludingTrashed('warehouses')],
            'items.*.source_warehouse.*'  => ['nullable'],
            'items.*.target_warehouse.id' => ['nullable', new ExistsExcludingTrashed('warehouses')],
            'items.*.target_warehouse.*'  => ['nullable'],
            'items.*.basic_rate'          => ['nullable', 'required_if:type,item_receipt', 'numeric', 'min:0'],
            'items.*.conversion_factor'   => ['nullable', 'numeric', 'min:0'],
            'additional_costs'            => ['nullable', 'array'],
            'additional_costs.*.id'       => ['required'],
            'additional_costs.*.purpose'  => ['required', 'string'],
            'additional_costs.*.amount'   => ['required', 'numeric'],
        ];
    }
}
