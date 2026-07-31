<?php

namespace App\Http\Requests\Core;

use App\Enums\TodoType;
use App\Http\Requests\BaseFormRequest;
use Illuminate\Validation\Rule;

class AssigneeRequest extends BaseFormRequest {
    public function authorize(): bool {
        return true;
    }

    public function rules(): array {
        return [
            'allocated_to'         => ['nullable', 'array'],
            'allocated_to.id'      => ['required_with:allocated_to', 'string', 'exists:assignables,id'],
            'allocated_to.type'    => ['nullable', 'string', 'in:user,role'],
            'type'                 => ['nullable', 'string', Rule::in(TodoType::values())],
            'reminder_lead_days'   => ['nullable', 'array'],
            'reminder_lead_days.*' => ['integer', 'min:1'],
            'description'          => ['nullable', 'string'],
            'priority'             => ['nullable', 'string', 'in:low,medium,high'],
            'date'                 => ['nullable', 'date'],
            'due_date'             => ['nullable', 'date', 'after_or_equal:date'],
        ];
    }
}
