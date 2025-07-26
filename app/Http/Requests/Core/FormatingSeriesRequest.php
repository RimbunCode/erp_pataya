<?php

namespace App\Http\Requests\Core;

use Illuminate\Foundation\Http\FormRequest;

class FormatingSeriesRequest extends FormRequest {
  /**
   * Determine if the user is authorized to make this request.
   */
  public function authorize(): bool {
    return true;
  }

  /**
   * Get the validation rules that apply to the request.
   *
   * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
   */
  public function rules(): array {
    return [
      'format' => [
        'required',
        'string',
        'regex:/^(?:(?=.*@\[(mm|mmm|mmmm)\])(?=.*@\[(yy|yyyy)\])|(?=.*@\[(yy|yyyy)\])|(?!.*@\[(?:mm|mmm|mmmm|yy|yyyy)\]))(?=.*@\[(i+)\]).*$/'
      ],
    ];
  }
}
