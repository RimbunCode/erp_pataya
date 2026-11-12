<?php

namespace App\Exceptions\Finances;

use RuntimeException;

/**
 * Peran akun tidak dapat di-resolve menjadi akun yang valid (Finance Fase 2, Requirement 3.2): tidak ada lapis yang
 * menghasilkan akun, atau akun hasilnya group/nonaktif/terhapus. Pesan menyebut peran, jenis dokumen, varian,
 * tanggal, dan lapis penyebab; job posting gagal ke `GlPostingStatus=failed` dan dapat dicoba ulang setelah profil
 * dilengkapi (Requirement 7.6). Pesan berlokalisasi lewat `lang/{id,en}/finances/posting.php`.
 */
class UnresolvedAccountRoleException extends RuntimeException {
    /**
     * @param  list<string>  $layers  lapis yang diperiksa beserta hasilnya (sudah berlokalisasi)
     */
    public function __construct(
        string $message,
        public readonly string $role = '',
        public readonly string $documentType = '',
        public readonly string $variant = '',
        public readonly string $date = '',
        public readonly array $layers = [],
    ) {
        parent::__construct($message);
    }

    /**
     * Tidak ada lapis yang menghasilkan akun.
     *
     * @param  list<string>  $layers
     */
    public static function notResolved(string $role, string $documentType, string $variant, string $date, array $layers): self {
        return new self(
            __('finances/posting.errors.unresolved_role', [
                'role'     => $role,
                'document' => $documentType,
                'variant'  => $variant,
                'date'     => $date,
                'layers'   => implode('; ', $layers),
            ]),
            $role,
            $documentType,
            $variant,
            $date,
            $layers,
        );
    }

    /**
     * Lapis legacy menemukan lebih dari satu akun untuk pasangan (root_type, account_type) peran itu; tidak dipilih.
     */
    public static function ambiguousLegacy(string $role, string $documentType, string $variant, string $date, string $rootType, string $accountType, int $candidates): self {
        $layer = __('finances/posting.layers.legacy');

        return new self(
            __('finances/posting.errors.unresolved_role_ambiguous', [
                'role'       => $role,
                'document'   => $documentType,
                'variant'    => $variant,
                'date'       => $date,
                'root'       => $rootType,
                'type'       => $accountType,
                'candidates' => $candidates,
            ]),
            $role,
            $documentType,
            $variant,
            $date,
            [$layer],
        );
    }

    /**
     * Sebuah lapis menghasilkan akun yang tidak dapat dipakai (hilang, terhapus, group, nonaktif).
     *
     * @param  string  $layer  lapis penyebab (`master`/`rules`/`profile`/`legacy`)
     * @param  string  $problem  kunci `finances/posting.account_problems.*` (`not_found`/`deleted`/`group`/`disabled`)
     */
    public static function invalidAccount(string $role, string $documentType, string $variant, string $date, string $layer, string $accountLabel, string $problem): self {
        $layerLabel = __("finances/posting.layers.{$layer}");

        return new self(
            __('finances/posting.errors.unresolved_role_account', [
                'role'     => $role,
                'document' => $documentType,
                'variant'  => $variant,
                'date'     => $date,
                'account'  => $accountLabel,
                'reason'   => __("finances/posting.account_problems.{$problem}"),
                'layer'    => $layerLabel,
            ]),
            $role,
            $documentType,
            $variant,
            $date,
            [$layerLabel],
        );
    }
}
