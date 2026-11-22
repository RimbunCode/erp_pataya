<?php

namespace App\Services\Finances\Posting\DiscountSplit;

use App\Enums\AccountRole;
use App\Enums\PostingDocumentType;
use App\Models\Finances\FinanceSetting;
use App\Models\Finances\PostingProfile;
use App\Models\Finances\PostingProfileRule;
use App\Services\Finances\Posting\Contexts\PostingContext;
use Illuminate\Validation\ValidationException;

/**
 * Validasi Requirement 14.4: peran `discount` harus sudah terpetakan pada profil aktif sebelum tanggal cutover boleh
 * diisi. Dinilai untuk jenis dokumen yang bersangkutan pada:
 *
 * - profil `active` yang berlaku pada tanggal cutover (harus ada), dan
 * - setiap profil `active` lain yang masih berlaku sesudah tanggal itu (versi/rentang berikutnya).
 *
 * "Terpetakan" berarti akun default peran `discount` pada profil, atau aturan akun bersyarat `role = discount` untuk
 * jenis dokumen itu (atau tanpa jenis dokumen), varian normal (atau tanpa varian), dan tanpa kondisi barang (peran
 * `discount` tingkat dokumen, bukan peka-barang, sehingga aturan berkondisi barang tidak pernah cocok). Fallback legacy
 * `(income, discount)` TIDAK dihitung: ia akan membuat diskon pembelian jatuh diam-diam ke akun diskon penjualan.
 *
 * Mengosongkan tanggal tidak divalidasi (selalu boleh). Hanya membaca; dipanggil `SettingsService::update()` sebelum
 * menyimpan.
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
                $column => __('finances/posting.errors.discount_split_unmapped', [
                    'role'     => AccountRole::Discount->value,
                    'document' => $this->documentLabel($type),
                    'profiles' => implode(', ', $unmapped),
                ]),
            ]);
        }
    }

    private function mapsDiscount(PostingProfile $profile, PostingDocumentType $type): bool {
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

    private function documentLabel(PostingDocumentType $type): string {
        // Kunci lang bertitik ('document_type.options' sebagai kunci datar) tidak dapat diakses lewat notasi titik.
        $options = __('finances/postingParityLog.columns');

        return \is_array($options) ? ($options['document_type.options'][$type->value] ?? $type->value) : $type->value;
    }
}
