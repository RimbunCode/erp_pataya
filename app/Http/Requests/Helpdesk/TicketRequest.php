<?php

namespace App\Http\Requests\Helpdesk;

use App\Http\Requests\BaseFormRequest;

class TicketRequest extends BaseFormRequest {
    public function authorize(): bool {
        return true;
    }

    public function rules(): array {
        return [
            'type'         => ['required', 'string', 'in:bug_problem,task,question,other'],
            'priority'     => ['required', 'string', 'in:low,medium,high,critical'],
            'subject'      => ['required', 'string', 'max:255'],
            'status'       => ['required', 'string', 'in:new,in_progress,on_hold,resolved,done'],
            'progress'     => ['required', 'integer', 'min:0', 'max:100'],
            'assign_to'    => ['required', 'array'],
            'assign_to.id' => ['required', 'exists:users,id'],
            'start_date'   => ['required', 'date'],
            'due_date'     => ['nullable', 'date'],
            'end_date'     => ['nullable', 'date'],
        ];
    }
}
