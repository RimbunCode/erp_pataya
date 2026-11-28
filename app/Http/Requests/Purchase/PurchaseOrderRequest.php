<?php

namespace App\Http\Requests\Purchase;

use App\Http\Requests\BaseFormRequest;
use App\Http\Requests\Concerns\NormalizesRowTaxes;
use App\Http\Requests\Finances\Rules\AdditionalDiscountRules;
use App\Http\Requests\Finances\Rules\PaymentSchedulesRules;
use App\Rules\ExistsExcludingTrashed;
use App\Services\Finances\Tax\ItemTaxSelection;
use DateTimeInterface;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PurchaseOrderRequest extends BaseFormRequest {
    use NormalizesRowTaxes;

    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool {
        return true;
    }

    /**
     * `tax` tunggal dinormalisasi menjadi `taxes: [tax]` (kontrak pajak majemuk per item, Q-MT-8).
     */
    protected function prepareForValidation(): void {
        parent::prepareForValidation();
        $this->normalizeRowTaxes();
    }

    public function withValidator(Validator $validator): void {
        $validator->after(function (Validator $validator): void {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            $this->validateRowTaxCombinations($validator, (array) $this->input('items', []));
        });
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array {
        return self::fieldRules($this);
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public static function fieldRules(Request $request): array {
        $date              = $request->input('date');
        $requiredDateRules = ['required', 'date'];
        if (is_scalar($date) || $date instanceof DateTimeInterface) {
            $requiredDateRules[] = Rule::date()->afterOrEqual($date instanceof DateTimeInterface ? $date : (string) $date);
        }

        return [
            'date'                        => ['required', 'date'],
            'required_date'               => $requiredDateRules,
            'external_note'               => ['nullable', 'string'],
            'supplier.id'                 => ['required', new ExistsExcludingTrashed('suppliers')],
            'supplier.*'                  => ['nullable'],
            'exchange_rate'               => ['nullable', 'numeric'],
            'currency.code'               => ['nullable', 'exists:currencies,code'],
            'currency.*'                  => ['nullable'],
            'items'                       => ['required', 'array', 'min:1'],
            'items.*.id'                  => ['required', 'string'],
            'items.*.item.id'             => ['required', new ExistsExcludingTrashed('item_variants')],
            'items.*.item.*'              => ['nullable'],
            'items.*.description'         => ['nullable', 'string'],
            'items.*.referenceable_type'  => ['nullable', 'string'],
            'items.*.referenceable_id'    => ['nullable', 'string'],
            'items.*.required_date'       => $requiredDateRules,
            'items.*.quantity'            => ['required', 'numeric', 'min:1'],
            'items.*.unit.id'             => ['required', new ExistsExcludingTrashed('item_units')],
            'items.*.unit.*'              => ['nullable'],
            'items.*.target_warehouse.id' => ['required', new ExistsExcludingTrashed('warehouses')],
            'items.*.target_warehouse.*'  => ['nullable'],
            'items.*.tax.id'              => ['nullable', new ExistsExcludingTrashed('taxes')],
            'items.*.tax.*'               => ['nullable'],
            'items.*.taxes'               => ['required', 'array', 'min:1', 'max:' . ItemTaxSelection::MAX_TAXES],
            'items.*.taxes.*.id'          => ['required', new ExistsExcludingTrashed('taxes')],
            'items.*.taxes.*.*'           => ['nullable'],
            'items.*.rate'                => ['required', 'numeric', 'min:0'],
            ...AdditionalDiscountRules::make($request),
            ...PaymentSchedulesRules::make($request),
        ];
    }
}
