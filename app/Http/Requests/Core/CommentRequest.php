<?php

namespace App\Http\Requests\Core;

use App\Http\Requests\BaseFormRequest;
use Illuminate\Contracts\Validation\ValidationRule;

class CommentRequest extends BaseFormRequest {
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
            'comment'      => ['required', 'string', 'min:3'],
            'comment_json' => ['nullable', 'array'],
        ];
    }

    public function messages(): array {
        return [
            'comment.required' => 'Comment is required',
            'comment.min'      => 'Comment must be at least 3 characters',
        ];
    }
}
