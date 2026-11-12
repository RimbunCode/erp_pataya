<?php

namespace App\Services\Finances\Posting;

use App\Enums\AccountRole;
use App\Models\Finances\PostingProfileRule;
use App\Services\Finances\Posting\Contexts\LineAttributes;
use App\Services\Finances\Posting\Contexts\PostingContext;

/**
 * Memilih aturan akun bersyarat yang berlaku (Finance Fase 2, Requirement 12.2-12.4). Murni: tidak menyentuh DB;
 * pemanggil (resolver) yang memuat aturan profil.
 *
 * Algoritme (design.md, "Aturan Akun Bersyarat"):
 *
 * 1. Ambil aturan untuk `role` yang semua kondisi non-null-nya sama dengan konteks (`document_type`, varian, atribut
 *    barang `$line`). Aturan yang mensyaratkan atribut barang tidak cocok bila `$line` null atau atributnya null.
 * 2. Urutkan menurun menurut jumlah kondisi non-null (spesifisitas), lalu `priority`, lalu kunci kanonik isi aturan
 *    (kondisi + akun, naik). Pemutus terakhir ini menjamin hasil tidak bergantung urutan penyimpanan (P-10) bila dua
 *    aturan berkombinasi kondisi berbeda tetapi spesifisitas dan prioritasnya sama; `id` (ULID) sengaja tidak dipakai
 *    karena mengikuti urutan penyisipan.
 * 3. Konteks retur: lintasan pertama HANYA mempertimbangkan aturan yang secara eksplisit `variant = return`; bila tidak
 *    ada yang cocok, dievaluasi lagi seperti dokumen normal (aturan `variant` null atau `normal`). Aturan tanpa varian
 *    tidak ikut lintasan pertama, supaya retur tanpa aturan khusus resolve ke akun yang sama dengan dokumen normal
 *    (P-11), bukan ke aturan generik yang kebetulan lebih spesifik daripada aturan normal.
 */
final class AccountRuleMatcher {
    /**
     * @param  iterable<PostingProfileRule>  $rules  aturan satu profil (semua peran)
     */
    public function match(iterable $rules, AccountRole|string $role, PostingContext $ctx, ?LineAttributes $line = null): ?PostingProfileRule {
        $roleValue = $role instanceof AccountRole ? $role->value : $role;

        $forRole = [];
        foreach ($rules as $rule) {
            if ($rule->role === $roleValue) {
                $forRole[] = $rule;
            }
        }

        if ($forRole === []) {
            return null;
        }

        if ($ctx->isReturn()) {
            $returnMatch = $this->best($forRole, $ctx, $line, strictReturn: true);
            if ($returnMatch !== null) {
                return $returnMatch;
            }
        }

        return $this->best($forRole, $ctx, $line, strictReturn: false);
    }

    /**
     * @param  list<PostingProfileRule>  $candidates
     */
    private function best(array $candidates, PostingContext $ctx, ?LineAttributes $line, bool $strictReturn): ?PostingProfileRule {
        $matching = array_values(array_filter(
            $candidates,
            fn (PostingProfileRule $rule): bool => $this->matches($rule, $ctx, $line, $strictReturn),
        ));

        if ($matching === []) {
            return null;
        }

        usort($matching, static function (PostingProfileRule $a, PostingProfileRule $b): int {
            return [$b->specificity(), (int) $b->priority, self::canonicalKey($a)]
                <=> [$a->specificity(), (int) $a->priority, self::canonicalKey($b)];
        });

        return $matching[0];
    }

    private function matches(PostingProfileRule $rule, PostingContext $ctx, ?LineAttributes $line, bool $strictReturn): bool {
        if ($rule->document_type !== null && $rule->document_type !== $ctx->documentType->value) {
            return false;
        }

        if ($strictReturn) {
            if ($rule->variant !== PostingContext::VARIANT_RETURN) {
                return false;
            }
        } elseif ($rule->variant !== null && $rule->variant !== PostingContext::VARIANT_NORMAL) {
            return false;
        }

        if ($rule->item_type !== null && ($line === null || $line->itemType !== $rule->item_type)) {
            return false;
        }

        if ($rule->is_stock_item !== null && ($line === null || $line->isStockItem === null || $line->isStockItem !== (bool) $rule->is_stock_item)) {
            return false;
        }

        if ($rule->item_category_id !== null && ($line === null || $line->itemCategoryId !== $rule->item_category_id)) {
            return false;
        }

        return true;
    }

    /**
     * Kunci kanonik isi aturan (bukan `id`), dipakai sebagai pemutus seri terakhir.
     */
    private static function canonicalKey(PostingProfileRule $rule): string {
        return implode('|', [
            $rule->document_type ?? '',
            $rule->variant ?? '',
            $rule->item_type ?? '',
            $rule->is_stock_item === null ? '' : ((bool) $rule->is_stock_item ? '1' : '0'),
            $rule->item_category_id ?? '',
            $rule->account_id,
        ]);
    }
}
