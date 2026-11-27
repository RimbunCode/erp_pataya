<?php

namespace App\Services\Finances\Posting\DiscountSplit;

use App\Enums\AccountRole;
use App\Enums\PostingDocumentType;
use App\Exceptions\Finances\InvalidPostingProfileException;
use App\Models\Finances\FinanceSetting;
use App\Models\Finances\PostingProfile;
use App\Models\Finances\PostingProfileRule;
use App\Services\Finances\Posting\AccountRuleMatcher;
use App\Services\Finances\Posting\Contexts\PostingContext;
use Illuminate\Validation\ValidationException;

/**
 * Validasi Requirement 14.4: peran `discount` harus sudah terpetakan pada profil aktif sebelum tanggal cutover boleh
 * diisi, dan tidak boleh hilang dari profil yang berlaku sesudah cutover terisi. Dipakai dua jalur:
 *
 * - `assertMapped()` (simpan setting, `SettingsService::update()`): untuk jenis dokumen yang bersangkutan pada profil
 *   `active` yang berlaku pada tanggal cutover (harus ada), dan setiap profil `active` lain yang masih berlaku
 *   sesudah tanggal itu (versi/rentang berikutnya).
 * - `assertProfileKeepsDiscountMapped()` (aktivasi versi profil, `PostingProfileService::activate()`; keputusan
 *   pemilik produk 22 November 2026): menolak aktivasi profil yang menjangkau tanggal cutover terisi tetapi tidak
 *   memetakan `discount` untuk jenis dokumen itu, supaya cutover tidak berubah menjadi gagal posting.
 *
 * "Terpetakan" berarti:
 *
 * - Sales Invoice: akun default peran `discount` pada profil, atau aturan akun bersyarat `role = discount` untuk jenis
 *   dokumen itu (atau tanpa jenis dokumen), varian normal (atau tanpa varian), dan tanpa kondisi barang (peran
 *   `discount` tingkat dokumen, bukan peka-barang, sehingga aturan berkondisi barang tidak pernah cocok).
 * - Purchase Invoice (keputusan pemilik produk 22 November 2026): peran `discount` dipakai bersama Sales dan Purchase
 *   Invoice, sehingga pemetaan Purchase Invoice WAJIB berasal dari aturan akun bersyarat `document_type =
 *   purchase_invoice` untuk varian normal DAN retur. Akun default profil dan aturan tanpa jenis dokumen tidak
 *   dihitung (akan jatuh ke akun diskon penjualan). Pemenang dinilai dengan `AccountRuleMatcher` yang sama dengan
 *   resolver, sehingga aturan retur tanpa jenis dokumen yang menang atas aturan Purchase Invoice ikut tertangkap.
 *
 * Fallback legacy `(income, discount)` TIDAK dihitung: ia akan membuat diskon pembelian jatuh diam-diam ke akun diskon
 * penjualan. Mengosongkan tanggal tidak divalidasi (selalu boleh). Hanya membaca.
 */
final class DiscountSplitMappingValidator {
    /**
     * @throws ValidationException bila tidak ada profil aktif pada tanggal cutover atau ada profil yang belum memetakan `discount`
     */
    public function assertMapped(PostingDocumentType $type, string $from): void {
        $column = FinanceSetting::DISCOUNT_SPLIT_COLUMNS[$type->value] ?? null;
        if ($column === null) {
            return;
        }

        $profiles = PostingProfile::query()
            ->where('status', PostingProfile::STATUS_ACTIVE)
            ->where(fn ($query) => $query->whereNull('effective_to')->orWhereDate('effective_to', '>=', $from))
            ->orderBy('effective_from')
            ->orderBy('version')
            ->with(['accounts', 'rules'])
            ->get();

        $covering = $profiles->first(fn (PostingProfile $profile): bool => $profile->effective_from->toDateString() <= $from);
        if ($covering === null) {
            throw ValidationException::withMessages([
                $column => __('finances/posting.errors.discount_split_no_profile', [
                    'document' => $this->documentLabel($type),
                    'date'     => $from,
                ]),
            ]);
        }

        $unmapped = $profiles
            ->filter(fn (PostingProfile $profile): bool => ! $this->mapsDiscount($profile, $type))
            ->map(fn (PostingProfile $profile): string => $profile->name)
            ->values()
            ->all();

        if ($unmapped !== []) {
            throw ValidationException::withMessages([
                $column => __($type === PostingDocumentType::PurchaseInvoice ? 'finances/posting.errors.discount_split_unmapped_purchase' : 'finances/posting.errors.discount_split_unmapped', [
                    'role'     => AccountRole::Discount->value,
                    'document' => $this->documentLabel($type),
                    'profiles' => implode(', ', $unmapped),
                ]),
            ]);
        }
    }

    /**
     * Penolakan aktivasi (keputusan 22 November 2026): bila `$profile` (draft yang akan aktif) menjangkau tanggal
     * cutover terisi suatu jenis dokumen (`effective_to` kosong atau sama/sesudah cutover) tetapi tidak memetakan
     * `discount` untuk jenis itu, aktivasi ditolak.
     *
     * @throws InvalidPostingProfileException
     */
    public function assertProfileKeepsDiscountMapped(PostingProfile $profile, FinanceSetting $setting): void {
        $profile->loadMissing(['accounts', 'rules']);

        foreach (FinanceSetting::DISCOUNT_SPLIT_COLUMNS as $value => $column) {
            $type = PostingDocumentType::from($value);
            $from = $setting->discountSplitFrom($type);
            if ($from === null) {
                continue;
            }

            $to = $profile->effective_to?->toDateString();
            if ($to !== null && $to < $from) {
                continue;
            }

            if (! $this->mapsDiscount($profile, $type)) {
                throw InvalidPostingProfileException::discountUnmappedAfterCutover(
                    AccountRole::Discount->value,
                    $this->documentLabel($type),
                    $from,
                    $type === PostingDocumentType::PurchaseInvoice,
                );
            }
        }
    }

    public function mapsDiscount(PostingProfile $profile, PostingDocumentType $type): bool {
        if ($type === PostingDocumentType::PurchaseInvoice) {
            return $this->purchaseInvoiceRuleWins($profile, PostingContext::VARIANT_NORMAL)
                && $this->purchaseInvoiceRuleWins($profile, PostingContext::VARIANT_RETURN);
        }

        if ($profile->accounts->contains(fn ($account): bool => $account->role === AccountRole::Discount->value)) {
            return true;
        }

        return $profile->rules->contains(fn (PostingProfileRule $rule): bool => $rule->role === AccountRole::Discount->value
            && ($rule->document_type === null || $rule->document_type === $type->value)
            && ($rule->variant === null || $rule->variant === PostingContext::VARIANT_NORMAL)
            && $rule->item_type === null
            && $rule->is_stock_item === null
            && $rule->item_category_id === null);
    }

    /**
     * Mensimulasikan lapis aturan akun bersyarat untuk peran `discount` pada konteks Purchase Invoice tanpa baris:
     * pemenangnya harus aturan yang tegas bersyarat `document_type = purchase_invoice`.
     */
    private function purchaseInvoiceRuleWins(PostingProfile $profile, string $variant): bool {
        $ctx = new PostingContext(
            documentType: PostingDocumentType::PurchaseInvoice,
            sourceType: 'purchase_invoice',
            sourceId: '',
            transactionDate: now(),
            branchId: null,
            amounts: [],
            flags: ['is_return' => $variant === PostingContext::VARIANT_RETURN],
        );

        $winner = (new AccountRuleMatcher)->match($profile->rules, AccountRole::Discount, $ctx, null);

        return $winner !== null && $winner->document_type === PostingDocumentType::PurchaseInvoice->value;
    }

    private function documentLabel(PostingDocumentType $type): string {
        // Kunci lang bertitik ('document_type.options' sebagai kunci datar) tidak dapat diakses lewat notasi titik.
        $options = __('finances/postingParityLog.columns');

        return \is_array($options) ? ($options['document_type.options'][$type->value] ?? $type->value) : $type->value;
    }
}
