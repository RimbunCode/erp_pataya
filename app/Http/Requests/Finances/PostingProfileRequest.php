<?php

namespace App\Http\Requests\Finances;

use App\Enums\AccountRole;
use App\Http\Requests\Finances\Concerns\RejectsUnknownInput;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

/**
 * Masukan simpan/ubah Posting Profile `draft` (Finance Fase 2, Requirement 8.1): nama, rentang berlaku, catatan, dan
 * peta peran => akun default. Peran dibatasi pada katalog `AccountRole`; kelayakan akun (non-group, aktif) dan
 * tumpang-tindih diputuskan `PostingProfileService`. Status, versi, dan rantai versi tidak dapat diisi dari request.
 */
class PostingProfileRequest extends FormRequest {
    use RejectsUnknownInput {
        withValidator as private rejectUnknownInput;
    }

    public function authorize(): bool {
        return true;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array {
        return [
            'name'           => ['required', 'string', 'max:255'],
            'effective_from' => ['required', 'date_format:Y-m-d'],
            'effective_to'   => ['nullable', 'date_format:Y-m-d', 'after_or_equal:effective_from'],
            'notes'          => ['nullable', 'string', 'max:2000'],
            'accounts'       => ['nullable', 'array'],
            'accounts.*'     => ['nullable', 'string', 'max:64'],
        ];
    }

    public function withValidator(Validator $validator): void {
        $this->rejectUnknownInput($validator);

        $validator->after(function (Validator $validator): void {
            foreach (array_keys((array) $this->input('accounts', [])) as $role) {
                if (! \in_array((string) $role, AccountRole::values(), true)) {
                    $validator->errors()->add("accounts.{$role}", __('finances/postingProfile.errors.unknown_role', ['role' => $role]));
                }
            }
        });
    }

    /**
     * Peta peran => akun tanpa peran yang dikosongkan.
     *
     * @return array<string, string>
     */
    public function accountMap(): array {
        return array_filter(
            array_map('strval', (array) $this->validated('accounts', [])),
            static fn (string $accountId): bool => $accountId !== '',
        );
    }
}
