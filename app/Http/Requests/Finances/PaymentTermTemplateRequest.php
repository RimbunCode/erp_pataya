<?php

namespace App\Http\Requests\Finances;

use App\Http\Requests\BaseFormRequest;
use App\Rules\ExistsExcludingTrashed;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Validator;

class PaymentTermTemplateRequest extends BaseFormRequest {
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
            'name'        => ['required', 'string', 'min:3', 'max:255'],
            'description' => ['nullable', 'string'],
            'items'       => ['required', 'array', 'min:1'],
            'items.*.id'  => ['required', 'string'],
            // Nilai opsi WAJIB sama persis dengan yang dikirim form. Sumber
            // kebenarannya adalah `weeks_after_invoice_week` -- dipakai di
            // resources/js/Pages/Finances/PaymentTermTemplate/Form.jsx (daftar
            // opsi Select + switch kalkulasi due_date), di
            // resources/js/Pages/Finances/Components/PaymentSchedule.jsx, dan
            // di 8 file lang (en/id x paymentTerm/salesInvoice/purchaseInvoice/
            // salesOrder). Rule ini sebelumnya menulis `weeks_after_invoice_date`
            // sehingga opsi "Minggu setelah minggu faktur" selalu ditolak
            // validasi. Kolom DB-nya string biasa (tanpa enum), jadi konsistensi
            // nilai murni dijaga di sini.
            'items.*.due_date_based_on' => ['required', 'string', 'in:days_after_invoice_date,weeks_after_invoice_week,months_after_invoice_month'],
            'items.*.credit_period'     => ['required', 'numeric', 'min:0'],
            'items.*.invoice_portion'   => ['required', 'numeric', 'min:0', 'max:100'],
            'items.*.discount_type'     => ['nullable', 'string'],
            'items.*.discount'          => ['nullable', 'numeric', 'required_with:items.*.discount_type'],
            'items.*.description'       => ['nullable', 'string'],
            'items.*.payment_method'    => ['nullable', 'array'],
            'items.*.payment_method.id' => ['nullable', new ExistsExcludingTrashed('payment_methods')],
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
