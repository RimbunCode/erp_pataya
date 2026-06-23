<?php

namespace App\Http\Requests\Core;

use App\Http\Requests\BaseFormRequest;
use Illuminate\Contracts\Validation\ValidationRule;

class CurrencyRequest extends BaseFormRequest {
    public function authorize(): bool {
        return true;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array {
        return [
            'code'          => ['required', 'string', 'max:10'],
            'name'          => ['required', 'string', 'max:255'],
            'symbol'        => ['nullable', 'string', 'max:10'],
            'number_format' => ['nullable', 'string', 'max:20'],
        ];
    }
}
