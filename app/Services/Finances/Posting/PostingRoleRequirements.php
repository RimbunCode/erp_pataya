<?php

namespace App\Services\Finances\Posting;

use App\Enums\AccountRole;
use App\Enums\PostingDocumentType;
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
            PostingDocumentType::SalesInvoice         => [AccountRole::Receivable, AccountRole::Revenue, AccountRole::WithholdingReceivable],
            PostingDocumentType::PurchaseInvoice      => [AccountRole::Stock, AccountRole::StockReceivedButNotBilled, AccountRole::Expense, AccountRole::Payable, AccountRole::WithholdingPayable],
            PostingDocumentType::PurchaseReceipt      => [AccountRole::Stock, AccountRole::StockReceivedButNotBilled],
            PostingDocumentType::DeliveryNote         => [AccountRole::CostOfGoodsSold, AccountRole::Stock],
            PostingDocumentType::PaymentEntry         => [AccountRole::Receivable, AccountRole::Payable],
            PostingDocumentType::StockEntry           => [AccountRole::Stock, AccountRole::StockAdjustment, AccountRole::ExpenseIncludedInValuation],
            PostingDocumentType::AssetValueAdjustment => [AccountRole::AssetRevaluation],
            PostingDocumentType::AssetDepreciation,
            PostingDocumentType::AssetScrap => [],
            // T-7 (opsi A): pelepasan membalik pendapatan baris aset, jadi `revenue` (peka-barang, diskon bila posting diskon
            // terpisah) harus ter-resolve; peran aset tetap berasal dari akun master kategori aset.
            PostingDocumentType::AssetDisposal => [AccountRole::Revenue],
        };
    }

    /**
     * Peran pajak yang WAJIB bersyarat (Finance Fase 3, Requirement 7.7; keputusan pemilik produk 27 November 2026):
     * dituntut hanya sesudah `finance_tax_split_from.{type}` terisi untuk jenis dokumen itu, karena sebelum cutover
     * jurnal masih menanamkan pajak dan peran ini tidak dibaca. Kosong untuk jenis dokumen tanpa cutover pajak.
     *
     * @return list<AccountRole>
     */
    public static function taxSplitRolesFor(PostingDocumentType $type): array {
        return match ($type) {
            PostingDocumentType::SalesInvoice    => [AccountRole::TaxOutput],
            PostingDocumentType::PurchaseInvoice => [AccountRole::TaxInput],
            default                              => [],
        };
    }

    /**
     * Peran wajib yang belum dipetakan pada akun default profil, untuk semua jenis dokumen (engine selalu aktif;
     * mode off/shadow dihapus 2026-11-22, Q-P2-23).
     *
     * @param  list<string>  $taxSplitTypes  nilai jenis dokumen yang `finance_tax_split_from`-nya sudah terisi; untuknya
     *                                       peran pajak (`taxSplitRolesFor`) ikut diwajibkan
     * @return list<array{document_type: string, roles: list<string>}>
     */
    public static function unmapped(PostingProfile $profile, array $taxSplitTypes = []): array {
        $mapped = $profile->accounts()->pluck('role')->all();
        $result = [];

        foreach (PostingDocumentType::cases() as $type) {
            $required = self::for($type);
            if (\in_array($type->value, $taxSplitTypes, true)) {
                $required = [...$required, ...self::taxSplitRolesFor($type)];
            }

            $missing = array_values(array_map(
                static fn (AccountRole $role): string => $role->value,
                array_filter($required, static fn (AccountRole $role): bool => ! \in_array($role->value, $mapped, true)),
            ));
            if ($missing !== []) {
                $result[] = ['document_type' => $type->value, 'roles' => $missing];
            }
        }

        return $result;
    }
}
