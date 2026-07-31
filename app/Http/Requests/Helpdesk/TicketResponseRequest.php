<?php

namespace App\Http\Requests\Helpdesk;

use App\Enums\TodoType;
use App\Http\Requests\BaseFormRequest;
use App\Services\Core\PrintTemplate\HTMLSanitizerService;
use Illuminate\Validation\Rule;

class TicketResponseRequest extends BaseFormRequest {
    public function authorize(): bool {
        return true;
    }

    protected function prepareForValidation(): void {
        $html = $this->input('content');
        if (is_array($html)) {
            $this->merge(['content' => null]);
        } elseif (is_string($html) && $html !== '') {
            $sanitizer = app(HTMLSanitizerService::class);
            $this->merge(['content' => $sanitizer->sanitize($html)->sanitizedHTML]);
        }

        $contentJson = $this->input('content_json');
        if (is_string($contentJson) && $contentJson !== '') {
            $decoded = json_decode($contentJson, true);
            $this->merge(['content_json' => is_array($decoded) ? $decoded : null]);
        }
    }

    public function rules(): array {
        return [
            'type'           => ['required', 'string', 'in:bug_problem,task,question,other'],
            'priority'       => ['required', 'string', 'in:low,medium,high,critical'],
            'subject'        => ['required', 'string', 'max:255'],
            'assign_to'      => ['required', 'array'],
            'assign_to.id'   => ['required', 'string', Rule::exists('assignables', 'id')->whereNull('deleted_at')],
            'assign_to.type' => ['required', 'string', 'in:user,role'],
            'status'         => ['required', 'string', 'in:new,in_progress,on_hold,resolved,done'],
            'progress'       => ['required', 'integer', 'min:0', 'max:100'],
            'start_date'     => ['required', 'date'],
            'due_date'       => ['nullable', 'date'],
            'content'        => ['nullable', 'string'],
            'content_json'   => ['nullable', 'array'],

            'buffered_tags'         => ['nullable', 'array'],
            'buffered_tags.*.id'    => ['nullable', 'string'],
            'buffered_tags.*.name'  => ['required_with:buffered_tags.*', 'string', 'max:255'],
            'buffered_tags.*.isNew' => ['nullable', 'boolean'],

            'buffered_assignees'                   => ['nullable', 'array'],
            'buffered_assignees.*.allocated_to_id' => ['nullable', 'string'],
            'buffered_assignees.*.id'              => ['nullable', 'string'],
            // 'type' di sini adalah assignee-kind (user/role) — BUKAN Todo::type
            // (task/event/meeting/deadline). Todo::type dikirim lewat key
            // 'todo_type' terpisah untuk menghindari tabrakan nama.
            'buffered_assignees.*.type'                 => ['required_with:buffered_assignees.*', 'string'],
            'buffered_assignees.*.name'                 => ['nullable', 'string'],
            'buffered_assignees.*.todo_type'            => ['nullable', 'string', Rule::in(TodoType::values())],
            'buffered_assignees.*.reminder_lead_days'   => ['nullable', 'array'],
            'buffered_assignees.*.reminder_lead_days.*' => ['integer', 'min:1'],
            'buffered_assignees.*.priority'             => ['nullable', 'string'],
            'buffered_assignees.*.description'          => ['nullable', 'string'],
            'buffered_assignees.*.date'                 => ['nullable', 'date'],
            'buffered_assignees.*.due_date'             => ['nullable', 'date'],

            'filesId'   => ['nullable', 'array'],
            'filesId.*' => ['nullable', 'string'],
        ];
    }
}
