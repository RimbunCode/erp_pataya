<?php

namespace App\Http\Requests\Core;

use App\Http\Requests\BaseFormRequest;
use App\Utils;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rule;

class PrintTemplateRequest extends BaseFormRequest {
    private const array PAPER_OPTIONS       = ['A4', 'A5', 'Letter', 'Legal', 'Tabloid', 'F4', 'custom'];
    private const array ORIENTATION_OPTIONS = ['portrait', 'landscape'];

    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool {
        return true;
    }

    protected function prepareForValidation(): void {
        $orientation = $this->input('orientation');
        if (! \is_string($orientation)) {
            return;
        }

        if (strtolower(trim($orientation)) === 'potrait') {
            $this->merge([
                'orientation' => 'portrait',
            ]);
        }
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array {
        if (! Utils::isInertiaRequest($this)) {

            return [];
        }

        return [
            'name'                 => ['required', 'string', 'min:3', 'max:255', "unique:print_templates,name,{$this->id}"],
            'is_letter_head'       => ['nullable', 'boolean'],
            'permission.model'     => ['nullable', Rule::requiredIf(! ($this->is_letter_head ?? false)), 'string'],
            'permission.*'         => ['nullable'],
            'is_default'           => ['nullable', 'boolean'],
            'default_language'     => ['nullable', 'string'],
            'letter_head.id'       => ['nullable', 'exists:print_templates,id'],
            'paper'                => ['nullable', Rule::requiredIf(! ($this->is_letter_head ?? false)), 'string', Rule::in(self::PAPER_OPTIONS)],
            'orientation'          => ['nullable', Rule::requiredIf(! ($this->is_letter_head ?? false)), 'string', Rule::in(self::ORIENTATION_OPTIONS)],
            'width'                => ['nullable', Rule::requiredIf(! ($this->is_letter_head ?? false)), 'numeric'],
            'height'               => ['nullable', Rule::requiredIf(! ($this->is_letter_head ?? false)), 'numeric'],
            'margin_top'           => ['nullable', Rule::requiredIf(! ($this->is_letter_head ?? false)), 'numeric'],
            'margin_bottom'        => ['nullable', Rule::requiredIf(! ($this->is_letter_head ?? false)), 'numeric'],
            'margin_left'          => ['nullable', Rule::requiredIf(! ($this->is_letter_head ?? false)), 'numeric'],
            'margin_right'         => ['nullable', Rule::requiredIf(! ($this->is_letter_head ?? false)), 'numeric'],
            'page_number'          => ['nullable', Rule::requiredIf(! ($this->is_letter_head ?? false)), 'string'],
            'show_absolute_values' => ['nullable', 'boolean'],
            'unit'                 => ['nullable', Rule::requiredIf(! ($this->is_letter_head ?? false)), 'string'],
            'font_family'          => ['nullable', Rule::requiredIf(! ($this->is_letter_head ?? false)), 'string'],
        ];
    }
}
