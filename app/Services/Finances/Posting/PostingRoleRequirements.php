<?php

namespace App\Services\Finances\Posting;

use App\Enums\AccountRole;
use App\Enums\PostingDocumentType;
use App\Models\Finances\FinanceSetting;
use App\Models\Finances\PostingProfile;

/**
 * Peran yang wajib dipetakan pada akun default Posting Profile untuk tiap jenis dokumen (Finance Fase 2,
 * Requirement 8.2): dasar peringatan "peran belum terpetakan" pada halaman profil. Peran akun master
 * (`cash_or_bank`, peran aset) tidak termasuk karena disuplai konfigurasi master, bukan profil.
 *
 * Daftar ini mengikuti peta rule di design.md (peran yang dibaca tiap `PostingRule`); `PostingRoleRequirementsTest`
 * menjaga bahwa seluruh peran valid dan bukan peran master.
 */
final class PostingRoleRequirements {
    /**
     * @return list<AccountRole>
     */
    public static function for(PostingDocumentType $type): array {
        return match ($type) {
            PostingDocumentType::SalesInvoice         => [AccountRole::Receivable, AccountRole::Revenue],
            PostingDocumentType::PurchaseInvoice      => [AccountRole::Stock, AccountRole::StockReceivedButNotBilled, AccountRole::Expense, AccountRole::Payable],
            PostingDocumentType::PurchaseReceipt      => [AccountRole::Stock, AccountRole::StockReceivedButNotBilled],
            PostingDocumentType::DeliveryNote         => [AccountRole::CostOfGoodsSold, AccountRole::Stock],
            PostingDocumentType::PaymentEntry         => [AccountRole::Receivable, AccountRole::Payable],
            PostingDocumentType::StockEntry           => [AccountRole::Stock, AccountRole::StockAdjustment, AccountRole::ExpenseIncludedInValuation],
            PostingDocumentType::AssetValueAdjustment => [AccountRole::AssetRevaluation],
            PostingDocumentType::AssetDepreciation,
            PostingDocumentType::AssetScrap,
            PostingDocumentType::AssetDisposal => [],
        };
    }

    /**
     * Peran wajib yang belum dipetakan pada akun default profil, hanya untuk jenis dokumen yang tidak berstatus
     * `off` (jenis `off` memakai jalur lama sehingga profil tidak dipakainya).
     *
     * @param  array<string, string>  $modes  peta jenis dokumen => mode
     * @return list<array{document_type: string, roles: list<string>}>
     */
    public static function unmapped(PostingProfile $profile, array $modes): array {
        $mapped = $profile->accounts()->pluck('role')->all();
        $result = [];

        foreach (PostingDocumentType::cases() as $type) {
            if (($modes[$type->value] ?? FinanceSetting::POSTING_MODE_OFF) === FinanceSetting::POSTING_MODE_OFF) {
                continue;
            }

            $missing = array_values(array_map(
                static fn (AccountRole $role): string => $role->value,
                array_filter(self::for($type), static fn (AccountRole $role): bool => ! \in_array($role->value, $mapped, true)),
            ));
            if ($missing !== []) {
                $result[] = ['document_type' => $type->value, 'roles' => $missing];
            }
        }

        return $result;
    }
}
