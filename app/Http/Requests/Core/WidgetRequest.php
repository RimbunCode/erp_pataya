<?php

namespace App\Http\Requests\Core;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class WidgetRequest extends FormRequest {
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
            'title'                       => ['required', 'string', 'max:100'],
            'type'                        => ['required', 'string', 'max:48'],
            'calculation_type'            => ['nullable', 'string', 'max:48'],
            'time_based_on'               => ['nullable', 'string', 'max:48'],
            'time_interval'               => ['nullable', 'string', 'max:48'],
            'timespan'                    => ['nullable', 'string', 'max:48'],
            'value_based_on'              => ['nullable', 'string', 'max:48'],
            'group_by_type'               => ['nullable', 'string', 'max:48'],
            'group_by_base_on'            => ['nullable', 'string', 'max:48'],
            'aggregate_function_based_on' => ['nullable', 'string', 'max:48'],
            'description'                 => ['nullable', 'string', 'max:255'],
            'model.id'                    => ['required', 'exists:permissions,id'],
            'model.model'                 => ['required', 'string'],
        ];
    }
}
