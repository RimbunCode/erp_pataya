<?php

namespace App\Http\Requests\Helpdesk;

use App\Http\Requests\BaseFormRequest;

class TiketResponseRequest extends BaseFormRequest {
    public function authorize(): bool {
        return true;
    }

    public function rules(): array {
        return [
            'assign_to'    => ['nullable', 'array'],
            'assign_to.id' => ['nullable', 'exists:users,id'],
            'status'       => ['required', 'string', 'in:new,in_progress,on_hold,resolved,done'],
            'progress'     => ['required', 'integer', 'min:0', 'max:100'],
            'content'      => ['nullable', 'string'],
            'end_date'     => ['nullable', 'date'],
        ];
    }
}
