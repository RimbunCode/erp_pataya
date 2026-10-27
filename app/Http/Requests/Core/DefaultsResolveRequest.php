<?php

namespace App\Http\Requests\Core;

use App\Enums\DefaultsDocumentType;
use App\Models\Purchase\PurchaseSetting;
use App\Models\Sales\SalesSetting;
use App\Services\Core\Setting\CurrentRolePermissionChecker;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class DefaultsResolveRequest extends FormRequest {
    public function authorize(): bool {
        $documentType = $this->input('document_type');
        $type         = is_string($documentType) ? DefaultsDocumentType::tryFrom($documentType) : null;
        if ($type === null) {
            return true;
        }

        $settingsClass = $type->module() === 'purchase' ? PurchaseSetting::class : SalesSetting::class;
        $permissions   = app(CurrentRolePermissionChecker::class);

        return $permissions->allows($this->user(), $type->modelClass(), ['read', 'create'])
            || $permissions->allows($this->user(), $settingsClass, ['read', 'write']);
    }

    public function rules(): array {
        return [
            'document_type'   => ['required', Rule::enum(DefaultsDocumentType::class)],
            'items'           => ['required', 'array', 'min:1', 'max:100'],
            'items.*'         => ['required', 'array:item_id'],
            'items.*.item_id' => ['required', 'ulid', 'distinct'],
        ];
    }
}
