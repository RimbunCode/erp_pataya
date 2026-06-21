<?php

namespace App\Http\Requests\Admin;

use App\Http\Requests\BaseFormRequest;
use Illuminate\Contracts\Validation\ValidationRule;

class SendOrganizationInvitationRequest extends BaseFormRequest {
    public function authorize(): bool {
        return true;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array {
        return [
            'organization_name' => ['required', 'string', 'max:255'],
            'email'             => ['required', 'email', 'max:255'],
            'contact_person'    => ['required', 'string', 'max:255'],
        ];
    }
}
