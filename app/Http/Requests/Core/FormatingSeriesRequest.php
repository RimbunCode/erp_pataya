<?php

namespace App\Http\Requests\Core;

use App\Http\Requests\BaseFormRequest;
use Illuminate\Contracts\Validation\ValidationRule;

class FormatingSeriesRequest extends BaseFormRequest {
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
            'format' => [
                'required',
                'string',
                'regex:/^(?:(?=.*@\[(mm|mmm|mmmm)\])(?=.*@\[(yy|yyyy)\])|(?=.*@\[(yy|yyyy)\])|(?!.*@\[(?:mm|mmm|mmmm|yy|yyyy)\]))(?=.*@\[(i+)\]).*$/',
            ],
        ];
    }
}
