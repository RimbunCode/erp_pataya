<?php

namespace App\Http\Requests\Finances\Rules;

use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AdditionalDiscountRules
{
    /**
     * Return validation rules for additional discount fields.
     *
     * @return array<string, mixed>
     */
    public static function make(Request $request): array
    {
        return [
            'discount_on' => ['nullable', 'in:grand_total,net_total'],
            'discount_rate' => [
                'nullable',
                'numeric',
                'min:0',
                'max:100',
                Rule::requiredIf(fn () => $request->has('discount_on')),
            ],
            'discount_amount' => [
                'nullable',
                'numeric',
                'min:0',
                Rule::requiredIf(fn () => $request->has('discount_on')),
            ],
        ];
    }
}
