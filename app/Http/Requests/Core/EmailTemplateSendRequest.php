<?php

namespace App\Http\Requests\Core;

use App\Http\Requests\BaseFormRequest;
use App\Rules\ExistsExcludingTrashed;
use Illuminate\Contracts\Validation\ValidationRule;

class EmailTemplateSendRequest extends BaseFormRequest {
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
            'to'          => ['required', 'email'],
            'cc'          => ['nullable', 'array'],
            'cc.*'        => ['email'],
            'bcc'         => ['nullable', 'array'],
            'bcc.*'       => ['email'],
            'from_name'   => ['nullable', 'string', 'max:255'],
            'subject'     => ['required', 'string', 'max:255'],
            'body'        => ['required', 'string'],
            'fileIds'     => ['nullable', 'array'],
            'fileIds.*'   => ['string', new ExistsExcludingTrashed('files')],
            'include_pdf' => ['nullable', 'boolean'],
        ];
    }
}
