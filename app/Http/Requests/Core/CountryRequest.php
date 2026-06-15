<?php

namespace App\Http\Requests\Core;

use App\Http\Requests\BaseFormRequest;
use Illuminate\Contracts\Validation\ValidationRule;

class CountryRequest extends BaseFormRequest {
    public function authorize(): bool {
        return true;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array {
        return [
            'code'        => ['required', 'string', 'max:2'],
            'name'        => ['required', 'string', 'max:255'],
            'lang_code'   => ['nullable', 'string', 'max:20'],
            'url_flag'    => ['nullable', 'string', 'max:500'],
            'timezones'   => ['nullable', 'array'],
            'timezones.*' => ['string'],
        ];
    }
}
