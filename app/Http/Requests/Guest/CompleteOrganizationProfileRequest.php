<?php

namespace App\Http\Requests\Guest;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Password;

class CompleteOrganizationProfileRequest extends FormRequest {
    public function authorize(): bool {
        return true;
    }

    /**
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array {
        return [
            'organization_name' => ['required', 'string', 'max:255'],
            'email'             => ['required', 'email', 'max:255'],
            'contact_person'    => ['required', 'string', 'max:255'],
            'address'           => ['nullable', 'string', 'max:500'],
            'phone'             => ['nullable', 'string', 'max:20'],
            'website'           => ['nullable', 'url', 'max:255'],
            'industry'          => ['nullable', 'string', 'max:100'],
            'employee_count'    => ['nullable', 'string', 'in:1-10,11-50,51-200,201-500,500+'],
            'logo'              => ['nullable', 'image', 'max:2048'],
            'password'          => ['required', 'string', 'confirmed', Password::min(8)],
        ];
    }
}
<?php

namespace App\Http\Requests\Guest;

use App\Http\Requests\BaseFormRequest;

class CompleteOrganizationProfileRequest extends BaseFormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            //
        ];
    }
}
