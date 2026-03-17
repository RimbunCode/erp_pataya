<?php

namespace App\Http\Requests\Core;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class ApprovalSchemeRequest extends FormRequest {
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
            'name'                  => ['required', 'string', 'min:3', 'max:255', "unique:approval_schemes,name,{$this->id}"],
            'permission.model'      => ['required', 'string'],
            'permission.id'         => ['required', 'string', 'exists:permissions,id'],
            'permission.*'          => ['nullable'],
            'is_active'             => ['nullable', 'boolean'],
            'steps'                 => ['required', 'array', 'min:1'],
            'steps.*.id'            => ['nullable', 'string'],
            'steps.*.approver_type' => ['required', 'string', 'in:role,user'],
            'steps.*.approver.id'   => ['required', 'string'],
        ];
    }
}
