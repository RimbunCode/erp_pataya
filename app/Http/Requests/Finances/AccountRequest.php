<?php

namespace App\Http\Requests\Finances;

use App\Http\Requests\BaseFormRequest;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rule;

class AccountRequest extends BaseFormRequest {
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
        // dd($this->all());
        return [
            'account_name'      => ['required', 'string', 'max:255'],
            'account_number'    => ['required', 'string', 'max:255', Rule::unique('accounts', 'account_number')->whereNull('deleted_at')->ignore($this->id)],
            'parent_account.id' => ['required', 'exists:accounts,id'],
            'is_group'          => ['nullable', 'boolean'],
            'balance_type'      => ['nullable', 'string', 'in:debit,credit'],
            'account_type'      => ['nullable', 'string', 'max:255'],
            'currency.code'     => ['nullable', 'exists:currencies,code'],
            'tax_rate'          => ['nullable', 'numeric', 'between:0,100'],
            'is_disabled'       => ['boolean'],
        ];
    }
}
