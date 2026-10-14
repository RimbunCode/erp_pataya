<?php

namespace App\Http\Requests\CRM;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class QuotationSectionTemplateRequest extends FormRequest {
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool {
        return true;
    }

    protected function prepareForValidation(): void {
        parent::prepareForValidation();

        $content = $this->input('content');
        if (\is_string($content)) {
            $this->merge(['content' => QuotationSectionContent::clean($content)]);
        }
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array {
        return [
            'name'           => ['required', 'string', 'max:255'],
            'title'          => ['required', 'string', 'max:255'],
            'quotation_type' => ['nullable', Rule::in(['spare_part', 'new_unit', 'rental'])],
            'content'        => ['required', 'string'],
            'content_json'   => ['nullable', 'array'],
        ];
    }
}
