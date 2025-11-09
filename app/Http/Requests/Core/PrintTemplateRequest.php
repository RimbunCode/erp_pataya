<?php

namespace App\Http\Requests\Core;

use App\Utils;
use Illuminate\Foundation\Http\FormRequest;

class PrintTemplateRequest extends FormRequest {
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
    if (! Utils::isInertiaRequest($this))

      return [];
    return [
      'name'             => ['required', 'string', 'min:3', 'max:255', "unique:print_templates,name,{$this->id}"],
      'permission.model' => ['required', 'string',],
      'permission.*'     => ['nullable'],
      'is_default'       => ['nullable', 'boolean'],
    ];
  }
}
