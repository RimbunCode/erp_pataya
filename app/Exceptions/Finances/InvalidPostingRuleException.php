<?php

namespace App\Exceptions\Finances;

use App\Services\Finances\Posting\PostingProfileService;
use RuntimeException;

/**
 * Aturan akun bersyarat tidak valid (Finance Fase 2, Requirement 12.2, 12.5): akun group/nonaktif/terhapus, kombinasi
 * kondisi ganda pada satu profil, atau kondisi atribut barang pada peran yang bukan peka-barang. Pesan berlokalisasi
 * lewat `lang/{id,en}/finances/postingProfile.php` (`errors.*`).
 */
class InvalidPostingRuleException extends RuntimeException {
    public static function duplicate(string $role): self {
        return new self(__('finances/postingProfile.errors.rule_duplicate', ['role' => $role]));
    }

    public static function itemConditionOnNonLineSensitiveRole(string $role): self {
        return new self(__('finances/postingProfile.errors.rule_item_condition_role', ['role' => $role]));
    }

    public static function unknownDocumentType(string $type): self {
        return new self(__('finances/postingProfile.errors.rule_unknown_document_type', ['type' => $type]));
    }

    public static function invalidVariant(string $variant): self {
        return new self(__('finances/postingProfile.errors.rule_invalid_variant', ['variant' => $variant]));
    }

    public static function unknownCategory(): self {
        return new self(__('finances/postingProfile.errors.rule_unknown_category'));
    }

    public static function negativePriority(): self {
        return new self(__('finances/postingProfile.errors.rule_negative_priority'));
    }

    public static function priorityTooLarge(int $max): self {
        return new self(__('finances/postingProfile.errors.rule_priority_too_large', ['max' => $max]));
    }

    public static function fieldTooLong(string $field, int $max): self {
        return new self(__('finances/postingProfile.errors.field_too_long', ['field' => $field, 'max' => $max]));
    }

    public static function invalidItemType(string $type): self {
        return new self(__('finances/postingProfile.errors.rule_invalid_item_type', ['type' => $type, 'allowed' => implode(', ', PostingProfileService::ITEM_TYPES)]));
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
