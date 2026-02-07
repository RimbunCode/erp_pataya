<?php

namespace App\Http\Requests\Finances\Rules;

use Illuminate\Http\Request;

class PaymentSchedulesRules {
  /**
   * Return validation rules for payment schedules fields.
   *
   * @param \Illuminate\Http\Request $request
   * @return array<string, mixed>
   */
  public static function make(Request $request): array {
    return [
      'payment_schedules'                     => ['nullable', 'array'],
      'payment_schedules.*.id'                => ['required', 'string'],
      'payment_schedules.*.payment_term.id'   => ['nullable', 'exists:payment_terms,id'],
      'payment_schedules.*.payment_term.*'    => ['nullable'],
      'payment_schedules.*.payment_method.id' => ['nullable', 'exists:payment_methods,id'],
      'payment_schedules.*.payment_method.*'  => ['nullable'],
      'payment_schedules.*.due_date'          => ['required', 'date'],
      'payment_schedules.*.payment_amount'    => ['required', 'numeric'],
      'payment_schedules.*.discount_type'     => [
        'nullable',
        'in:percentage,amount',
      ],
      'payment_schedules.*.discount'          => [
        'nullable',
        'numeric',
        'required_with:payment_schedules.*.discount_type',
      ],
      'payment_schedules.*.discount_date'     => [
        'nullable',
        'date',
        'required_with:payment_schedules.*.discount',
      ],
      'payment_schedules.*.description'       => ['nullable', 'string'],
      'payment_schedules.*.invoice_portion'   => ['required', 'numeric'],
    ];
  }
}
