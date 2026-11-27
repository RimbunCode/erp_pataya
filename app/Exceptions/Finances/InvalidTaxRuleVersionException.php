<?php

namespace App\Exceptions\Finances;

use RuntimeException;

/**
 * Versi aturan pajak tidak valid atau transisi statusnya tidak diizinkan (Finance Fase 3, Requirement 2.2-2.3, 2.7):
 * versi `active` tumpang-tindih, faktor DPP selain 11/12 selama Bagian B belum aktif, mengubah versi yang bukan
 * `draft`, rentang tanggal terbalik, tarif/faktor/peran di luar batas. Pesan berlokalisasi lewat
 * `lang/{id,en}/finances/taxRuleVersion.php` (`errors.*`).
 */
class InvalidTaxRuleVersionException extends RuntimeException {
    public static function invalidRange(): self {
        return new self(__('finances/taxRuleVersion.errors.invalid_range'));
    }

    public static function overlap(int $version, string $from, ?string $to): self {
        return new self(__('finances/taxRuleVersion.errors.overlap', [
            'version' => $version,
            'from'    => $from,
            'to'      => $to ?? __('finances/taxRuleVersion.open_ended'),
        ]));
    }

    public static function notDraft(string $status): self {
        return new self(__('finances/taxRuleVersion.errors.not_draft', ['status' => $status]));
    }

    public static function notActive(string $status): self {
        return new self(__('finances/taxRuleVersion.errors.not_active', ['status' => $status]));
    }

    public static function invalidRate(): self {
        return new self(__('finances/taxRuleVersion.errors.invalid_rate'));
    }

    public static function invalidDppFactor(): self {
        return new self(__('finances/taxRuleVersion.errors.invalid_dpp_factor'));
    }

    /**
     * Guard F-17 (Requirement 2.7): kolom hitung dokumen invoice masih memakai 11/12 tetap.
     */
    public static function dppFactorLocked(int $numerator, int $denominator): self {
        return new self(__('finances/taxRuleVersion.errors.dpp_factor_locked', ['factor' => $numerator . '/' . $denominator]));
    }

    public static function invalidRounding(string $mode): self {
        return new self(__('finances/taxRuleVersion.errors.invalid_rounding', ['mode' => $mode]));
    }

    public static function invalidRole(string $role): self {
        return new self(__('finances/taxRuleVersion.errors.invalid_role', ['role' => $role]));
    }

    public static function versionStartsBeforePrevious(string $previousFrom): self {
        return new self(__('finances/taxRuleVersion.errors.version_starts_before_previous', ['from' => $previousFrom]));
    }

    public static function versionEndsBeforePrevious(?string $previousTo): self {
        return new self(__('finances/taxRuleVersion.errors.version_ends_before_previous', ['to' => $previousTo ?? __('finances/taxRuleVersion.open_ended')]));
    }

    public static function unknownTax(): self {
        return new self(__('finances/taxRuleVersion.errors.unknown_tax'));
    }

    public static function deleteNotDraft(): self {
        return new self(__('finances/taxRuleVersion.errors.delete_not_draft'));
    }

    public static function unknownAttribute(string $field): self {
        return new self(__('finances/taxRuleVersion.errors.unknown_attribute', ['field' => $field]));
    }
}
