<?php

namespace App\Http\Requests\Core;

use App\Http\Requests\BaseFormRequest;

class TodoRequest extends BaseFormRequest {
    public function authorize(): bool {
        return true;
    }

    public function rules(): array {
        return [
            'reference_type'    => ['nullable', 'string'],
            'reference_id'      => ['nullable', 'string', 'required_with:reference_type'],
            'allocated_to'      => ['required', 'array'],
            'allocated_to.id'   => ['required', 'string', 'exists:assignables,id'],
            'allocated_to.type' => ['required', 'string', 'in:user,role'],
            'description'       => ['nullable', 'string'],
            'priority'          => ['required', 'string', 'in:low,medium,high'],
            'status'            => ['required', 'string', 'in:open,closed,canceled'],
            'date'              => ['nullable', 'date'],
            'due_date'          => ['nullable', 'date'],
        ];
    }
}
