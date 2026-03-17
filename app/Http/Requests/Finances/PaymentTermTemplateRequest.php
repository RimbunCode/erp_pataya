<?php

namespace App\Http\Requests\Finances;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class PaymentTermTemplateRequest extends FormRequest {
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
            'name'                      => ['required', 'string', 'min:3', 'max:255'],
            'description'               => ['nullable', 'string'],
            'items'                     => ['required', 'array', 'min:1'],
            'items.*.id'                => ['required', 'string'],
            'items.*.due_date_based_on' => ['required', 'string', 'in:days_after_invoice_date,weeks_after_invoice_date,months_after_invoice_month'],
            'items.*.credit_period'     => ['required', 'numeric', 'min:0'],
            'items.*.invoice_portion'   => ['required', 'numeric', 'min:0', 'max:100'],
            'items.*.discount_type'     => ['nullable', 'string'],
            'items.*.discount'          => ['nullable', 'numeric', 'required_with:items.*.discount_type'],
            'items.*.description'       => ['nullable', 'string'],
            'items.*.payment_method'    => ['nullable', 'array'],
            'items.*.payment_method.id' => ['nullable', 'exists:payment_methods,id'],
        ];
    }

    public function withValidator(Validator $validator): void {
        $validator->after(function (Validator $validator) {
            $items = $this->input('items', []);
            if (! \is_array($items) || $items === []) {
                return;
            }

            $totalInvoicePortion = \array_sum(\array_map(
                fn ($item) => (float) ($item['invoice_portion'] ?? 0),
                $items,
            ));

            if (\abs($totalInvoicePortion - 100.0) > 0.00001) {
                $validator->errors()->add('invoice_portion', 'Total invoice portion must be 100%');
            }
        });
    }
}
