<?php

namespace App\Http\Requests\Finances\Concerns;

use Illuminate\Validation\Validator;

/**
 * Menolak input yang kuncinya tidak dikenal `rules()` (mis. `status`, `version`, `previous_profile_id`): konfigurasi
 * akun posting tidak boleh menerima atribut yang tidak dirancang untuk dimasukkan pengguna (Finance Fase 2,
 * Requirement 8, 11.2). Kunci pengangkut metode/CSRF (`_method`, `_token`) dan `onlyCreator` (disisipkan konstruktor `Controller` dasar dari izin) diabaikan.
 */
trait RejectsUnknownInput {
    public function withValidator(Validator $validator): void {
        $validator->after(function (Validator $validator): void {
            $known = array_map(static fn (string $key): string => explode('.', $key)[0], array_keys($validator->getRules()));

            foreach (array_keys($this->except(['_method', '_token', 'onlyCreator'])) as $key) {
                if (! \in_array($key, $known, true)) {
                    $validator->errors()->add((string) $key, __('finances/postingProfile.errors.unknown_input', ['field' => $key]));
                }
            }
        });
    }
}
