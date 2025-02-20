<?php

namespace App\Http\Requests\User;

use Illuminate\Foundation\Http\FormRequest;

class RoleRequest extends FormRequest {
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
    $defaultRules = [
      'name' => ['required', 'string', 'max:255'],
      'description' => ['nullable', 'string'],
      'is_disabled' => ['nullable', 'boolean'],
    ];

    if ($this->isMethod('POST')) {
      return $defaultRules;
    }
    return [
      ...$defaultRules,
      'rules' => ['nullable', 'array'],
      'rules.*.permission_id' => ['required', 'string', 'exists:permissions,id'],
      'rules.*.level' => ['required', 'integer'],
      'rules.*.only_creator' => ['required', 'boolean'],
      'rules.*.permissions' => ['required', 'array'],
    ];
  }
}
