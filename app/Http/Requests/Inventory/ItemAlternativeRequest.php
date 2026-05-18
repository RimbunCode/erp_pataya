<?php

namespace App\Http\Requests\Inventory;

use App\Http\Requests\BaseFormRequest;
use App\Models\Inventory\ItemVariant;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Validator;

class ItemAlternativeRequest extends BaseFormRequest {
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
            'two_way'        => ['nullable', 'boolean'],
            'item.id'        => ['required', 'string', 'exists:item_variants,id'],
            'alternative.id' => ['required', 'string', 'different:item.id', 'exists:item_variants,id'],
        ];
    }

    public function withValidator(Validator $validator): void {
        $validator->after(function (Validator $validator): void {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            $itemId        = $this->input('item.id');
            $alternativeId = $this->input('alternative.id');
            $isTwoWay      = $this->boolean('two_way');

            if (! \is_string($itemId) || ! \is_string($alternativeId)) {
                return;
            }

            $variants = ItemVariant::query()
                ->select([
                    'item_variants.id',
                    'item_variants.allow_alternative_item',
                    'items.allow_alternative_item as item_allow_alternative_item',
                ])
                ->join('items', 'items.id', '=', 'item_variants.item_id')
                ->whereIn('item_variants.id', [$itemId, $alternativeId])
                ->get()
                ->keyBy('id');

            $item = $variants->get($itemId);
            if (! $item || ! $this->variantAllowsAlternative($item)) {
                $validator->errors()->add('item.id', 'Selected item must allow alternative items.');
            }

            if (! $isTwoWay) {
                return;
            }

            $alternative = $variants->get($alternativeId);
            if (! $alternative || ! $this->variantAllowsAlternative($alternative)) {
                $validator->errors()->add('alternative.id', 'Selected alternative item must allow alternative items when two way is enabled.');
            }
        });
    }

    private function variantAllowsAlternative(ItemVariant $variant): bool {
        return (bool) $variant->allow_alternative_item || (bool) $variant->item_allow_alternative_item;
    }
}
