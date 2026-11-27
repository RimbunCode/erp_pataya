<?php

namespace App\Http\Requests\Finances;

use App\Http\Requests\BaseFormRequest;
use App\Models\Finances\Tax;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * Masukan master Pajak. Klasifikasi (`category`, `behavior`, `is_creditable`; Finance Fase 3, Requirement 1.1-1.3)
 * bersifat opsional pada request: bila tidak dikirim, nilai tersimpan tidak berubah (default migration pada pajak
 * baru). Kombinasi `behavior = withholding` dengan kategori PPN ditolak di sini (Requirement 1.3), dinilai
 * terhadap gabungan input dan nilai tersimpan agar pembaruan sebagian tidak melewatinya.
 */
class TaxRequest extends BaseFormRequest {
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
            'name'          => ['required', 'string', 'min:3', 'max:255'],
            'rate'          => ['required', 'numeric', 'min:0', 'max:100'],
            'category'      => ['sometimes', 'required', 'string', Rule::in(Tax::CATEGORIES)],
            'behavior'      => ['sometimes', 'required', 'string', Rule::in(Tax::BEHAVIORS)],
            'is_creditable' => ['sometimes', 'required', 'boolean'],
        ];
    }

    public function withValidator(Validator $validator): void {
        $validator->after(function (Validator $validator): void {
            if ($validator->errors()->hasAny(['category', 'behavior'])) {
                return;
            }

            $existing = $this->route('tax');
            $existing = $existing instanceof Tax ? $existing : null;

            $category = (string) ($this->input('category') ?? $existing?->category ?? Tax::CATEGORY_UNCLASSIFIED);
            $behavior = (string) ($this->input('behavior') ?? $existing?->behavior ?? Tax::BEHAVIOR_ADDITIVE);

            if ($behavior === Tax::BEHAVIOR_WITHHOLDING && \in_array($category, Tax::PPN_CATEGORIES, true)) {
                $validator->errors()->add('behavior', __('finances/taxes.errors.withholding_ppn'));
            }
        });
    }
}
