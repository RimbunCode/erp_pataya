<?php

namespace App\Http\Requests\Core;

use App\Enums\TodoType;
use App\Http\Requests\BaseFormRequest;
use Illuminate\Validation\Rule;

class TodoRequest extends BaseFormRequest {
    public function authorize(): bool {
        return true;
    }

    public function rules(): array {
        return [
            'reference_type'       => ['nullable', 'string'],
            'reference_id'         => ['nullable', 'string', 'required_with:reference_type'],
            'allocated_to'         => ['nullable', 'array'],
            'allocated_to.id'      => ['required_with:allocated_to', 'string', 'exists:assignables,id'],
            'allocated_to.type'    => ['nullable', 'string', 'in:user,role'],
            'type'                 => ['required', 'string', Rule::in(TodoType::values())],
            'reminder_lead_days'   => ['nullable', 'array'],
            'reminder_lead_days.*' => ['integer', 'min:1'],
            'confirm_reassign'     => ['nullable', 'boolean'],
            'description'          => ['nullable', 'string'],
            'priority'             => ['required', 'string', 'in:low,medium,high'],
            'status'               => ['required', 'string', 'in:open,closed,canceled'],
            'date'                 => ['nullable', 'date'],
            'due_date'             => ['nullable', 'date', 'after_or_equal:date'],
        ];
    }
}
