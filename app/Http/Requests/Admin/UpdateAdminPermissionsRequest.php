<?php

namespace App\Http\Requests\Admin;

use App\Http\Requests\BaseFormRequest;
use App\Services\Admin\AdminPermissionService;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rule;

class UpdateAdminPermissionsRequest extends BaseFormRequest {
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
            'permissions'   => ['present', 'array'],
            'permissions.*' => ['required', 'string', Rule::in(AdminPermissionService::ALLOWED_PERMISSION_NAMES)],
        ];
    }
}
