<?php

namespace App\Http\Requests\Core;

use App\Http\Requests\BaseFormRequest;

class AssigneeRequest extends BaseFormRequest {
    public function authorize(): bool {
        return true;
    }

    public function rules(): array {
        return [
            'allocated_to'      => ['required', 'array'],
            'allocated_to.id'   => ['required', 'string', 'exists:assignables,id'],
            'allocated_to.type' => ['required', 'string', 'in:user,role'],
            'description'       => ['nullable', 'string'],
            'priority'          => ['nullable', 'string', 'in:low,medium,high'],
            'date'              => ['nullable', 'date'],
            'due_date'          => ['nullable', 'date', 'after_or_equal:date'],
        ];
    }
}
