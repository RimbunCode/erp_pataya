<?php

namespace App\Http\Requests\Core;

use App\Http\Requests\BaseFormRequest;
use App\Rules\ExistsExcludingTrashed;
use App\Services\Core\CustomChartSource\CustomChartSourceRegistry;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Validator;

class ChartRequest extends BaseFormRequest {
    public function authorize(): bool {
        return true;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array {
        return [
            'chart_name'                    => ['required', 'string', 'max:100'],
            'chart_source_type'             => ['required', 'string', 'in:count,sum,average,group_by,custom'],
            'visual_type'                   => ['required', 'string', 'in:line,bar,pie,donut,percentage,heatmap'],
            'model.id'                      => ['required_unless:chart_source_type,custom', new ExistsExcludingTrashed('permissions')],
            'model.model'                   => ['required_unless:chart_source_type,custom', 'string'],
            'timeseries'                    => ['nullable', 'boolean'],
            'based_on'                      => ['nullable', 'string', 'max:255'],
            'value_based_on'                => ['nullable', 'string', 'max:255'],
            'timespan'                      => ['nullable', 'string', 'in:last_week,last_month,last_quarter,last_year,custom'],
            'time_interval'                 => ['nullable', 'string', 'in:daily,weekly,monthly,quarterly,yearly'],
            'from_date'                     => ['nullable', 'date'],
            'to_date'                       => ['nullable', 'date'],
            'group_by_based_on'             => ['nullable', 'string', 'max:255'],
            'group_by_type'                 => ['nullable', 'string', 'in:count,sum,average'],
            'aggregate_function_based_on'   => ['nullable', 'string', 'max:255'],
            'number_of_groups'              => ['nullable', 'integer', 'min:1', 'max:50'],
            'heatmap_year'                  => ['nullable', 'integer'],
            'color'                         => ['nullable', 'string', 'max:32'],
            'currency'                      => ['nullable', 'string', 'max:10'],
            'show_values_over_chart'        => ['nullable', 'boolean'],
            'show_full_number'              => ['nullable', 'boolean'],
            'custom_options'                => ['nullable', 'array'],
            'method'                        => ['nullable', 'string', 'max:100'],
            'filters'                       => ['nullable', 'array'],
            'is_shared_all'                 => ['nullable', 'boolean'],
            'assignables'                   => ['nullable', 'array'],
            'assignables.*.assignable'      => ['required_with:assignables', 'array'],
            'assignables.*.assignable.type' => ['required_with:assignables', 'string', 'in:role,user'],
            'assignables.*.assignable.id'   => ['required_with:assignables', 'string'],
        ];
    }

    /**
     * Requirement 3.2/3.3: field wajib berbeda tergantung group_by vs timeseries.
     * Requirement 7.2: method (source=custom) wajib terdaftar registry.
     */
    public function withValidator(Validator $validator): void {
        $validator->after(function (Validator $validator) {
            if ($this->input('chart_source_type') === 'group_by' && ! $this->filled('group_by_based_on')) {
                $validator->errors()->add('group_by_based_on', __('validation.required', ['attribute' => 'group_by_based_on']));
            }

            if ($this->input('chart_source_type') === 'group_by' && ! $this->filled('group_by_type')) {
                $validator->errors()->add('group_by_type', __('validation.required', ['attribute' => 'group_by_type']));
            }

            if ($this->boolean('timeseries') && ! $this->filled('based_on')) {
                $validator->errors()->add('based_on', __('validation.required', ['attribute' => 'based_on']));
            }

            if ($this->input('chart_source_type') === 'custom') {
                $method = $this->input('method');
                if (! $method || ! app(CustomChartSourceRegistry::class)->isRegistered($method)) {
                    $validator->errors()->add('method', 'Custom source tidak terdaftar.');
                }
            }
        });
    }
}
