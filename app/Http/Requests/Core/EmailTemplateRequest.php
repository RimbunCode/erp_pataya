<?php

namespace App\Http\Requests\Core;

use App\Http\Requests\BaseFormRequest;
use Illuminate\Contracts\Validation\ValidationRule;

class EmailTemplateRequest extends BaseFormRequest {
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
            'name'             => ['required', 'string', 'min:3', 'max:255', "unique:email_templates,name,{$this->id},id,deleted_at,NULL"],
            'permission.model' => ['required', 'string'],
            'permission.*'     => ['nullable'],
            'is_default'       => ['nullable', 'boolean'],
            'subject'          => ['required', 'string', 'max:255'],
            'body_html'        => ['required', 'string'],
            'body_json'        => ['nullable', 'array'],
            'default_language' => ['nullable', 'string'],
            'recipient_path'   => ['nullable', 'string'],
        ];
    }
}
