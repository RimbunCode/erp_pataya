<?php

namespace App\Http\Requests\Inventory;

use App\Http\Requests\BaseFormRequest;
use App\Models\Inventory\ItemVariant;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Database\Query\Builder;
use Illuminate\Validation\Rule;

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

        $ruleAlternative = Rule::exists('item_variants', 'id');
        //     if ($this->has('two_way') && $this->two_way) {
        //       $ruleAlternative = $ruleAlternative->using(function (Builder $query) {
        //        $count = ItemVariant::join('items', 'items.id', '=', 'item_variants.item_id')
        //           ->where('item_variants.allow_alternative_item', true)
        //           ->orWhere('items.allow_alternative_item', true)
        //           ->count("item_variants.id");

        // $count > ? $query->whereRaw("TRUE");
        //       });
        //     }
        // $ruleItem = Rule::exists('item_variants', 'id')->using(function () {
        //   $query->join('items', 'items.id', '=', 'item_variants.item_id')
        //     ->where('item_variants.allow_alternative_item', true)
        //     ->orWhere('items.allow_alternative_item', true);
        // });
        return [
            'two_way'        => ['nullable', 'boolean'],
            'item.id'        => ['required', 'string'],
            'alternative.id' => ['required', 'string'],
        ];
    }
}
