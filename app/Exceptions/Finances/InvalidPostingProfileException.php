<?php

namespace App\Exceptions\Finances;

use RuntimeException;

/**
 * Posting Profile tidak valid atau transisi statusnya tidak diizinkan (Finance Fase 2, Requirement 2.2-2.4):
 * profil `active` tumpang-tindih, akun group/nonaktif/terhapus, mengubah profil yang bukan `draft`, rentang tanggal
 * terbalik. Pesan berlokalisasi lewat `lang/{id,en}/finances/postingProfile.php` (`errors.*`).
 */
class InvalidPostingProfileException extends RuntimeException {
    public static function invalidRange(): self {
        return new self(__('finances/postingProfile.errors.invalid_range'));
    }

    public static function overlap(string $profileName, string $from, ?string $to): self {
        return new self(__('finances/postingProfile.errors.overlap', [
            'name' => $profileName,
            'from' => $from,
            'to'   => $to ?? __('finances/postingProfile.open_ended'),
        ]));
    }

    public static function notDraft(string $status): self {
        return new self(__('finances/postingProfile.errors.not_draft', ['status' => $status]));
    }

    public static function copyFromDraft(): self {
        return new self(__('finances/postingProfile.errors.copy_draft'));
    }

    public static function notActive(string $status): self {
        return new self(__('finances/postingProfile.errors.not_active', ['status' => $status]));
    }

    public static function versionStartsBeforePrevious(string $previousFrom): self {
        return new self(__('finances/postingProfile.errors.version_starts_before_previous', ['from' => $previousFrom]));
    }

    public static function versionNotContiguous(string $expectedFrom): self {
        return new self(__('finances/postingProfile.errors.version_not_contiguous', ['from' => $expectedFrom]));
    }

    public static function versionEndsBeforePrevious(?string $previousTo): self {
        return new self(__('finances/postingProfile.errors.version_ends_before_previous', ['to' => $previousTo ?? __('finances/postingProfile.open_ended')]));
    }

    public static function roleTooLong(int $max): self {
        return new self(__('finances/postingProfile.errors.field_too_long', ['field' => 'role', 'max' => $max]));
    }

    public static function referencedByNewerVersion(): self {
        return new self(__('finances/postingProfile.errors.delete_referenced'));
    }

    public static function roleRequired(): self {
        return new self(__('finances/postingProfile.errors.role_required'));
    }

    /**
     * @param  string  $problem  kunci `finances/posting.account_problems.*`
     */
    public static function accountProblem(string $role, string $accountLabel, string $problem): self {
        return new self(__('finances/postingProfile.errors.account_problem', [
            'role'    => $role,
            'account' => $accountLabel,
            'reason'  => __("finances/posting.account_problems.{$problem}"),
        ]));
    }
}
