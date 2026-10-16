<?php

namespace App\Http\Requests\Purchase;

use App\Http\Requests\BaseFormRequest;
use App\Models\Inventory\ItemUnit;
use App\Models\Inventory\ItemVariant;
use App\Models\Purchase\PurchaseRequestItem;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class PurchaseOrderBatchRequest extends BaseFormRequest {
    public function authorize(): bool {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array {
        $rules = [
            'token'                           => ['required', 'string', 'max:100'],
            'idempotency_key'                 => ['required', 'uuid'],
            'drafts'                          => ['required', 'array', 'min:1'],
            'drafts.*'                        => ['required', 'array'],
            'drafts.*.id'                     => ['required', 'string', 'max:100', 'distinct'],
            'drafts.*.items.*.source_item_id' => ['required', 'ulid'],
        ];

        $drafts = $this->input('drafts', []);
        if (! is_array($drafts)) {
            return $rules;
        }

        foreach ($drafts as $index => $draft) {
            if (! is_array($draft)) {
                continue;
            }

            $prefix = "drafts.{$index}.";
            foreach (PurchaseOrderRequest::fieldRules(new Request($draft)) as $field => $fieldRules) {
                $rules[$prefix . $field] = array_map(function ($rule) use ($prefix) {
                    if (is_string($rule) && str_starts_with($rule, 'required_with:')) {
                        $fields = explode(',', substr($rule, strlen('required_with:')));

                        return 'required_with:' . implode(',', array_map(fn ($field) => $prefix . $field, $fields));
                    }

                    return $rule;
                }, $fieldRules);
            }

            $rules[$prefix . 'items.*.referenceable_type'] = ['prohibited'];
            $rules[$prefix . 'items.*.referenceable_id']   = ['prohibited'];
        }

        return $rules;
    }

    /**
     * @param  array<int, array<string, mixed>>  $drafts
     * @param  iterable<PurchaseRequestItem>  $sourceItems  Authorized, current items resolved from the staging token.
     */
    public static function validateSourceItems(array $drafts, iterable $sourceItems): void {
        $sources  = collect($sourceItems)->keyBy('id');
        $variants = ItemVariant::query()
            ->whereIn('id', $sources->pluck('item_variant_id')->filter()->unique())
            ->pluck('item_id', 'id');
        $unitIds = collect($drafts)->flatMap(fn (array $draft): array => array_map(
            fn (array $item): mixed => data_get($item, 'unit.id'),
            $draft['items'] ?? [],
        ))->filter()->unique();
        $units  = ItemUnit::query()->whereIn('item_units.id', $unitIds)->get()->keyBy('id');
        $errors = [];

        foreach ($drafts as $draftIndex => $draft) {
            foreach ($draft['items'] as $itemIndex => $item) {
                $path   = "drafts.{$draftIndex}.items.{$itemIndex}.";
                $source = $sources->get($item['source_item_id']);

                if (! $source || $source->trashed()) {
                    $errors[$path . 'source_item_id'] = __('validation.exists', ['attribute' => $path . 'source_item_id']);

                    continue;
                }

                if (! $source->item_variant_id || (string) data_get($item, 'item.id') !== (string) $source->item_variant_id) {
                    $errors[$path . 'item.id'] = __('validation.in', ['attribute' => $path . 'item.id']);
                }
                $unit = $units->get(data_get($item, 'unit.id'));
                if (! $unit || (string) $unit->item_id !== (string) $variants->get($source->item_variant_id) || $unit->conversion_factor <= 0) {
                    $errors[$path . 'unit.id'] = __('validation.in', ['attribute' => $path . 'unit.id']);
                }
            }
        }

        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }
    }
}
