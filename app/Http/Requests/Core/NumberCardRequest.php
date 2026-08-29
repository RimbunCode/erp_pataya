<?php

namespace App\Http\Requests\Core;

use App\Http\Requests\BaseFormRequest;
use App\Rules\ExistsExcludingTrashed;
use App\Services\Core\CustomChartSource\CustomChartSourceRegistry;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Validator;

class NumberCardRequest extends BaseFormRequest {
    public function authorize(): bool {
        return true;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array {
        return [
            'label'                         => ['required', 'string', 'max:100'],
            'source_type'                   => ['required', 'string', 'in:document_type,custom'],
            'function'                      => ['nullable', 'string', 'in:count,sum,average,minimum,maximum'],
            'aggregate_function_based_on'   => ['nullable', 'string', 'max:255'],
            'model.id'                      => ['required_if:source_type,document_type', new ExistsExcludingTrashed('permissions')],
            'model.model'                   => ['required_if:source_type,document_type', 'string'],
            'filters'                       => ['nullable', 'array'],
            'currency'                      => ['nullable', 'string', 'max:10'],
            'color'                         => ['nullable', 'string', 'max:32'],
            'background_color'              => ['nullable', 'string', 'max:32'],
            'show_full_number'              => ['nullable', 'boolean'],
            'show_percentage_stats'         => ['nullable', 'boolean'],
            'stats_time_interval'           => ['nullable', 'string', 'in:daily,weekly,monthly,yearly'],
            'method'                        => ['nullable', 'string', 'max:100'],
            'is_shared_all'                 => ['nullable', 'boolean'],
            'assignables'                   => ['nullable', 'array'],
            'assignables.*.assignable'      => ['required_with:assignables', 'array'],
            'assignables.*.assignable.type' => ['required_with:assignables', 'string', 'in:role,user'],
            'assignables.*.assignable.id'   => ['required_with:assignables', 'string'],
        ];
    }

    /**
     * Requirement 1.2: function!=count wajib aggregate_function_based_on.
     * Requirement 7.2: method (source=custom) wajib terdaftar registry.
     */
    public function withValidator(Validator $validator): void {
        $validator->after(function (Validator $validator) {
            if ($this->input('source_type') === 'document_type'
                && $this->input('function') !== 'count'
                && ! $this->filled('aggregate_function_based_on')) {
                $validator->errors()->add('aggregate_function_based_on', __('validation.required', ['attribute' => 'aggregate_function_based_on']));
            }

            if ($this->input('source_type') === 'custom') {
                $method = $this->input('method');
                if (! $method || ! app(CustomChartSourceRegistry::class)->isRegistered($method)) {
                    $validator->errors()->add('method', 'Custom source tidak terdaftar.');
                }
            }
        });
    }
}
