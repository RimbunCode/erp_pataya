<?php

namespace App\Http\Requests\CRM;

use App\Http\Requests\BaseFormRequest;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rule;

/**
 * Memakai BaseFormRequest supaya `branch` aktif ikut di data tervalidasi:
 * format kode Quotation (`@[branch_code]/QTN-@[iiii]/@[yy]`) membutuhkannya.
 */
class QuotationRequest extends BaseFormRequest {
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
        $requiredForLetterTypes = fn () => in_array($this->input('type'), ['new_unit', 'rental'], true);

        return [
            'type'                 => ['required', Rule::in(['spare_part', 'new_unit', 'rental'])],
            'attn'                 => ['required', 'string', 'max:255'],
            'subject'              => [Rule::requiredIf($requiredForLetterTypes), 'nullable', 'string', 'max:255'],
            'issued_city'          => ['nullable', 'string', 'max:255'],
            'introduction'         => ['required', 'string'],
            'date'                 => ['required', 'date'],
            'valid_until'          => [Rule::requiredIf($requiredForLetterTypes), 'nullable', 'date', 'after_or_equal:date'],
            'customer.id'          => ['required', 'string', 'exists:customers,id'],
            'opportunity.id'       => ['nullable', 'string', 'exists:opportunities,id'],
            'items'                => ['required', 'array', 'min:1'],
            'items.*.id'           => ['required', 'string'],
            'items.*.item.id'      => ['required', 'string', 'exists:item_variants,id'],
            'items.*.item_unit.id' => ['nullable', 'string', 'exists:item_units,id'],
            'items.*.description'  => ['nullable', 'string'],
            'items.*.remark'       => ['nullable', 'string', 'max:255'],
            'items.*.quantity'     => ['required', 'numeric', 'min:0.01'],
            'items.*.price'        => ['nullable', 'numeric', 'min:0'],
            'items.*.tax.id'       => ['nullable', 'string', 'exists:taxes,id'],
            'sections'             => ['nullable', 'array'],
            'sections.*.id'        => ['nullable', 'string'],
            'sections.*.title'     => ['required', 'string', 'max:255'],
            'sections.*.content'   => ['required', 'string'],
            'sections.*.order'     => ['nullable', 'integer', 'min:0'],
        ];
    }
}
