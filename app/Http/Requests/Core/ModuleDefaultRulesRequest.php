<?php

namespace App\Http\Requests\Core;

use App\Enums\DefaultsDocumentType;
use App\Models\Inventory\Category;
use App\Models\Purchase\PurchaseSetting;
use App\Models\Sales\SalesSetting;
use App\Rules\ExistsExcludingTrashed;
use App\Services\Core\Setting\CurrentRolePermissionChecker;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ModuleDefaultRulesRequest extends FormRequest {
    public function authorize(): bool {
        $settingsClass = match ($this->route('moduleKey')) {
            'purchase' => PurchaseSetting::class,
            'sales'    => SalesSetting::class,
            default    => null,
        };

        return $settingsClass !== null
            && app(CurrentRolePermissionChecker::class)->allows($this->user(), $settingsClass, ['write']);
    }

    public function rules(): array {
        $module        = (string) $this->route('moduleKey');
        $documentTypes = array_map(
            fn (DefaultsDocumentType $type): string => $type->value,
            array_filter(DefaultsDocumentType::cases(), fn (DefaultsDocumentType $type): bool => $type->module() === $module),
        );
        $taxDocumentTypes = array_map(
            fn (DefaultsDocumentType $type): string => $type->value,
            array_filter(
                DefaultsDocumentType::cases(),
                fn (DefaultsDocumentType $type): bool => $type->module() === $module && $type->supportsTaxDefault(),
            ),
        );
        $warehouseDocumentTypes = array_map(
            fn (DefaultsDocumentType $type): string => $type->value,
            array_filter(
                DefaultsDocumentType::cases(),
                fn (DefaultsDocumentType $type): bool => $type->module() === $module && $type->supportsWarehouseDefault(),
            ),
        );

        return [
            'rules_version'                      => ['required', 'string', 'size:64'],
            'tax_rules'                          => ['present', 'array', 'max:200'],
            'tax_rules.*'                        => ['required', 'array:id,document_type,item_type,is_stock_item,item_category_id,tax_id,priority'],
            'tax_rules.*.id'                     => ['sometimes', 'required', 'ulid', 'distinct'],
            'tax_rules.*.document_type'          => ['nullable', 'string', Rule::in($taxDocumentTypes)],
            'tax_rules.*.item_type'              => ['nullable', 'string', Rule::in(Category::TYPES)],
            'tax_rules.*.is_stock_item'          => ['nullable', 'boolean'],
            'tax_rules.*.item_category_id'       => ['nullable', 'ulid', new ExistsExcludingTrashed('categories')],
            'tax_rules.*.tax_id'                 => ['present', 'nullable', 'ulid', new ExistsExcludingTrashed('taxes')],
            'tax_rules.*.priority'               => ['sometimes', 'integer', 'min:0', 'max:4294967295'],
            'warehouse_rules'                    => ['present', 'array', 'max:200'],
            'warehouse_rules.*'                  => ['required', 'array:id,document_type,item_type,is_stock_item,item_category_id,warehouse_id,priority'],
            'warehouse_rules.*.id'               => ['sometimes', 'required', 'ulid', 'distinct'],
            'warehouse_rules.*.document_type'    => ['nullable', 'string', Rule::in($warehouseDocumentTypes)],
            'warehouse_rules.*.item_type'        => ['nullable', 'string', Rule::in(Category::TYPES)],
            'warehouse_rules.*.is_stock_item'    => ['nullable', 'boolean'],
            'warehouse_rules.*.item_category_id' => ['nullable', 'ulid', new ExistsExcludingTrashed('categories')],
            'warehouse_rules.*.warehouse_id'     => ['required', 'ulid', new ExistsExcludingTrashed('warehouses')],
            'warehouse_rules.*.priority'         => ['sometimes', 'integer', 'min:0', 'max:4294967295'],
        ];
    }
}
