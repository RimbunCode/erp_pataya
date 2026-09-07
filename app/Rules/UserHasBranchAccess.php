<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Support\Facades\Auth;
use Illuminate\Translation\PotentiallyTranslatedString;

/**
 * Validasi branch_id yang dikirim client benar-benar salah satu Branch yang
 * diakses user (pivot user_branch) — KECUALI user affiliated ke Branch
 * is_main_branch=true, yang boleh assign resource ke branch manapun.
 *
 * Mencegah spoofing branch_id lewat raw request pada form (Warehouse,
 * AssetLocation, dst) yang di FE cuma restrict pilihan dropdown, bukan
 * enforcement (lihat resources/js/Hooks/useBranchFieldAccess.js).
 */
class UserHasBranchAccess implements ValidationRule {
    /**
     * @param  Closure(string, ?string=): PotentiallyTranslatedString  $fail
     */
    public function validate(string $attribute, mixed $value, Closure $fail): void {
        $user = Auth::user();
        if (! $user) {
            $fail('validation.exists')->translate();

            return;
        }

        $branches = $user->branches()
            ->withoutGlobalScope('country')
            ->get(['branches.id', 'branches.is_main_branch']);

        if ($branches->contains('is_main_branch', true)) {
            return;
        }

        if (! $branches->contains('id', $value)) {
            $fail('validation.exists')->translate();
        }
    }
}
