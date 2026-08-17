<?php

namespace App\Http\Requests\Sales;

use App\Enums\FormStatus;
use App\Http\Requests\BaseFormRequest;
use App\Http\Requests\Finances\Rules\AdditionalDiscountRules;
use App\Http\Requests\Finances\Rules\PaymentSchedulesRules;
use App\Models\Asset\AssetService;
use App\Models\Asset\AssetServiceConsumedItem;
use App\Models\Sales\SalesOrderItem;
use App\Rules\ExistsExcludingTrashed;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Validation\Rule;

class SalesOrderRequest extends BaseFormRequest {
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
            'date'           => ['required', 'date'],
            'rent_date.from' => [Rule::requiredIf($this->is_rent ?? false), 'date', 'nullable'],
            'rent_date.to'   => [
                Rule::requiredIf($this->is_rent ?? false),
                Rule::date()->afterOrEqual($this->start_date ?? now()),
                'date',
                'nullable',
            ],
            'is_rent'                     => ['nullable', 'boolean'],
            'customer.id'                 => [Rule::requiredIf(! ($this->is_rent ?? false)), new ExistsExcludingTrashed('customers')],
            'customer.*'                  => ['nullable'],
            'customer_branch.id'          => ['required', new ExistsExcludingTrashed('branches')],
            'customer_branch.*'           => ['nullable'],
            'reference_so.id'             => ['nullable', new ExistsExcludingTrashed('sales_orders')],
            'reference_so.*'              => ['nullable'],
            'items'                       => ['required', 'array', 'min:1'],
            'items.*.id'                  => ['required', 'string'],
            'items.*.item.id'             => ['required', new ExistsExcludingTrashed('item_variants')],
            'items.*.item.*'              => ['nullable'],
            'items.*.description'         => ['nullable', 'string'],
            'items.*.quantity'            => ['required', 'numeric', 'min:1'],
            'items.*.unit.id'             => ['required', new ExistsExcludingTrashed('item_units')],
            'items.*.unit.*'              => ['nullable'],
            'items.*.tax.id'              => ['required', new ExistsExcludingTrashed('taxes')],
            'items.*.tax.*'               => ['nullable'],
            'items.*.price'               => ['nullable', 'numeric'],
            'items.*.source_warehouse.id' => ['nullable', new ExistsExcludingTrashed('warehouses')],
            'items.*.referenceable.type'  => ['nullable', 'string', Rule::in([AssetService::class, AssetServiceConsumedItem::class])],
            'items.*.referenceable.id'    => ['nullable', 'string', 'required_with:items.*.referenceable.type'],
            'currency.code'               => ['nullable', 'exists:currencies,code'],
            'exchange_rate'               => ['nullable', 'numeric'],
            'external_note'               => ['nullable', 'string'],
            ...AdditionalDiscountRules::make($this),
            ...PaymentSchedulesRules::make($this),
        ];
    }

    public function withValidator(Validator $validator): void {
        $validator->after(function (Validator $validator): void {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            $this->validateAssetServiceReferenceables($validator);
        });
    }

    /**
     * Requirement 5, spec asset-service-billing: baris SalesOrderItem yang
     * referenceable ke AssetService/AssetServiceConsumedItem hanya boleh dibuat
     * kalau AssetService terkait sudah APPROVED, dan tiap AssetServiceConsumedItem
     * hanya boleh dipakai SATU baris SalesOrderItem (1:1, tidak boleh dobel).
     */
    private function validateAssetServiceReferenceables(Validator $validator): void {
        foreach ((array) $this->input('items', []) as $index => $item) {
            $type = $item['referenceable']['type'] ?? null;
            $id   = $item['referenceable']['id'] ?? null;

            if (! $type || ! $id) {
                continue;
            }

            if ($type === AssetService::class) {
                $assetService = AssetService::find($id);
                if (! $assetService || ! in_array(FormStatus::APPROVED, $assetService->status ?? [], true)) {
                    $validator->errors()->add(
                        "items.{$index}.referenceable.id",
                        __('sales/salesOrder.referenceable_not_approved'),
                    );
                }

                continue;
            }

            if ($type === AssetServiceConsumedItem::class) {
                $consumedItem = AssetServiceConsumedItem::with('assetService')->find($id);
                if (! $consumedItem || ! in_array(FormStatus::APPROVED, $consumedItem->assetService?->status ?? [], true)) {
                    $validator->errors()->add(
                        "items.{$index}.referenceable.id",
                        __('sales/salesOrder.referenceable_not_approved'),
                    );

                    continue;
                }

                $alreadyUsed = SalesOrderItem::where('referenceable_type', AssetServiceConsumedItem::class)
                    ->where('referenceable_id', $id)
                    ->where('id', '!=', $item['id'] ?? null)
                    ->exists();

                if ($alreadyUsed) {
                    $validator->errors()->add(
                        "items.{$index}.referenceable.id",
                        __('sales/salesOrder.referenceable_already_used'),
                    );
                }
            }
        }
    }
}
