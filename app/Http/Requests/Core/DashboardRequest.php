<?php

namespace App\Http\Requests\Core;

use Illuminate\Foundation\Http\FormRequest;

class DashboardRequest extends FormRequest {
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
      // dd($this->all()),
      'title'                => ['required', 'string'],
      'widgets'              => ['required', 'array', 'min:1'],
      'widgets.*.id'         => ['required', 'string',],
      'widgets.*.widget.id'  => ['required', 'string', 'exists:widgets,id'],
      'widgets.*.width'      => ['required', 'string'],
      'widgets.*.is_visible' => ['nullable', 'boolean'],

    ];
  }
}
