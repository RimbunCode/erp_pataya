<?php

namespace App\Http\Requests\Core;

use App\Http\Requests\BaseFormRequest;
use Illuminate\Contracts\Validation\ValidationRule;

class ApprovalSchemeRequest extends BaseFormRequest {
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
            'name'                              => ['required', 'string', 'min:3', 'max:255', "unique:approval_schemes,name,{$this->id}"],
            'permission.model'                  => ['required', 'string'],
            'permission.id'                     => ['required', 'string', 'exists:permissions,id'],
            'permission.*'                      => ['nullable'],
            'is_active'                         => ['nullable', 'boolean'],
            'steps'                             => ['required', 'array', 'min:1'],
            'steps.*.id'                        => ['nullable', 'string'],
            'steps.*.is_advanced'               => ['nullable', 'boolean'],
            'steps.*.approver_type'             => ['required_if:steps.*.is_advanced,false,null', 'nullable', 'string', 'in:role,user'],
            'steps.*.approver.id'               => ['required_if:steps.*.is_advanced,false,null', 'nullable', 'string'],
            'steps.*.approvers'                 => ['required_if:steps.*.is_advanced,true', 'nullable', 'array', 'min:1'],
            'steps.*.approvers.*.id'            => ['nullable', 'string'],
            'steps.*.approvers.*.approver_type' => ['required_with:steps.*.approvers', 'nullable', 'string', 'in:role,user'],
            'steps.*.approvers.*.approver.id'   => ['required_with:steps.*.approvers', 'nullable', 'string'],
        ];
    }
}
