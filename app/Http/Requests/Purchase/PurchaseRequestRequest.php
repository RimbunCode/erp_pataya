<?php

namespace App\Http\Requests\Purchase;

use App\Http\Requests\BaseFormRequest;
use App\Rules\ExistsExcludingTrashed;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rule;

class PurchaseRequestRequest extends BaseFormRequest {
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array {
        return [
            'date'                       => ['required', 'date'],
            'required_date'              => ['required', 'date', Rule::date()->afterOrEqual($this->date)],
            'external_note'              => ['nullable', 'string'],
            'items'                      => ['required', 'array', 'min:1'],
            'items.*.id'                 => ['required', 'string'],
            'items.*.item.id'            => ['required', new ExistsExcludingTrashed('item_variants')],
            'items.*.item.*'             => ['nullable'],
            'items.*.description'        => ['nullable', 'string'],
            'items.*.referenceable_type' => ['nullable', 'string'],
            'items.*.referenceable_id'   => ['nullable', 'string'],
            'items.*.required_date'      => ['required', 'date', Rule::date()->afterOrEqual($this->date)],
            'items.*.quantity'           => ['required', 'numeric', 'min:1'],
            'items.*.unit.id'            => ['required', new ExistsExcludingTrashed('item_units')],
            'items.*.unit.*'             => ['nullable'],

        ];
    }
}
