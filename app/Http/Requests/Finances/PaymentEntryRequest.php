<?php

namespace App\Http\Requests\Finances;

use App\Http\Requests\BaseFormRequest;
use App\Models\Finances\PurchaseInvoice;
use App\Models\Finances\SalesInvoice;
use App\Rules\ExistsExcludingTrashed;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

class PaymentEntryRequest extends BaseFormRequest {
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
            'date'                 => ['required', 'date'],
            'paid_amount'          => ['required', 'numeric', 'gt:0', fn (string $attribute, mixed $value, Closure $fail) => $this->failWhenOverOutstanding((float) $value, $fail)],
            'payment_type'         => ['required', 'string', 'in:receive,pay,internal_transfer'],
            'payment_method.id'    => ['nullable', new ExistsExcludingTrashed('payment_methods')],
            'party_type'           => ['required_unless:payment_type,internal_transfer', 'string', 'in:customer,supplier'],
            'partyable'            => ['required_unless:payment_type,internal_transfer', 'array'],
            'partyable.id'         => ['required_unless:payment_type,internal_transfer', $this->party_type == 'supplier' ? new ExistsExcludingTrashed('suppliers') : new ExistsExcludingTrashed('customers')],
            'partyable.*'          => ['nullable'],
            'currency.code'        => ['nullable', 'exists:currencies,code'],
            'currency.*'           => ['nullable'],
            'exchange_rate'        => ['nullable', 'numeric', 'min:0'],
            'paymentable'          => ['required_unless:payment_type,internal_transfer', 'array'],
            'paymentable.id'       => ['required_unless:payment_type,internal_transfer', $this->party_type == 'supplier' ? new ExistsExcludingTrashed('purchase_invoices') : new ExistsExcludingTrashed('sales_invoices')],
            'account_paid_to.id'   => ['required', new ExistsExcludingTrashed('accounts')],
            'account_paid_from.id' => ['required', new ExistsExcludingTrashed('accounts')],
            'notes'                => ['nullable', 'string'],
        ];
    }

    /**
     * Pembayaran tidak boleh melebihi sisa tagihan paymentable. Dilewati untuk `internal_transfer` (tanpa paymentable)
     * dan dokumen retur, yang jalurnya belum dicakup hotfix ini.
     *
     * @param  Closure(string): mixed  $fail
     */
    private function failWhenOverOutstanding(float $amount, Closure $fail): void {
        $paymentableId = $this->input('paymentable.id');
        if ($this->input('payment_type') === 'internal_transfer' || ! \is_string($paymentableId) || $paymentableId === '') {
            return;
        }

        $class       = $this->input('party_type') === 'supplier' ? PurchaseInvoice::class : SalesInvoice::class;
        $paymentable = $class::query()->find($paymentableId);
        if ($paymentable === null || $paymentable->return_against_id !== null) {
            return;
        }

        if ($amount > (float) $paymentable->outstanding_amount + 0.005) {
            $fail(__('finances/paymentEntry.errors.paid_amount_exceeds_outstanding'));
        }
    }
}
