<?php

namespace App\Services\Finances\Posting\Rules;

use App\Enums\AccountRole;
use App\Enums\PostingDocumentType;
use App\Services\Finances\Posting\Contexts\PostingContext;
use App\Services\Finances\Posting\Contexts\TaxComponentLine;
use App\Services\Finances\Posting\RoleJournalDraft;
use App\Services\Finances\Posting\RoleLine;

/**
 * Sales Invoice (design.md, peta rule): satu jurnal `default`, debit `receivable` sebesar `total`, kredit `revenue`.
 * Retur menukar sisi. Kontrak konteks: `amounts['total']`; `flags['is_return']`; `lines[]` opsional dengan
 * `amounts['amount']` per baris (jumlah kredit `revenue` per baris, peka-barang) yang harus berjumlah `total`
 * (pabrik konteks menjaganya; selisih memicu `UnbalancedJournalException`). Tanpa `lines`, `revenue` satu baris
 * sebesar `total`, persis jalur Fase 1.
 *
 * Posting diskon terpisah (Requirement 14.2): bila `flags['discount_split']` dan `amounts['discount_amount']` > 0
 * dan ada `lines[]`, `revenue` dikredit sebesar `amounts['gross_amount']` per baris (kotor = bersih + diskon), satu baris
 * `discount` didebit sebesar `amounts['discount_amount']` (tingkat dokumen, bukan peka-barang), dan `receivable` tetap
 * `total` (bersih): Σdebit = total + diskon = Σ kotor = Σkredit (P-13). Pabrik konteks menjaga Σ `gross_amount` baris =
 * `total` + `discount_amount`. Tanpa flag, atau diskon nol, bentuk jurnal identik dengan sebelumnya. Dasar pajak/DPP
 * tidak disentuh (Requirement 14.5).
 *
 * Pemisahan baris pajak (Finance Fase 3, Requirement 7.1): bila `flags['tax_split']` dan `taxComponents` memuat komponen
 * yang `isSplittable()`, tiap komponen dikredit pada perannya (`tax_output`) sebesar `amount` tersimpan dengan
 * `taxRuleVersionId`, sedangkan `revenue` per baris dikurangi bagian pajak baris itu (`lineShares`) atau, tanpa
 * `lines`, satu baris sebesar `total` dikurangi Σ pajak (sisa, sehingga jurnal seimbang tanpa baris pembulatan,
 * Requirement 7.4). Komponen yang tidak dapat dipisah tetap tertanam di `revenue` (bentuk lama, Requirement 7.3).
 * Tanpa flag atau tanpa komponen terpisah, bentuk jurnal identik dengan sebelumnya. Retur menukar semua sisi.
 */
final class SalesInvoiceRule extends BasePostingRule {
    public function documentType(): PostingDocumentType {
        return PostingDocumentType::SalesInvoice;
    }

    public function build(PostingContext $ctx): array {
        $total = $ctx->amount('total');
        if (self::isZero($total)) {
            return [];
        }

        $discount = $ctx->amount('discount_amount');
        $split    = (bool) $ctx->flag('discount_split', false) && $ctx->lines !== [] && ! self::isZero($discount);

        $taxLines = (bool) $ctx->flag('tax_split', false)
            ? array_values(array_filter($ctx->taxComponents, static fn (TaxComponentLine $component): bool => $component->isSplittable(false)))
            : [];

        $revenue = [];
        foreach ($ctx->lines as $line) {
            $amount = ($split ? $line->amount('gross_amount') : $line->amount('amount')) - self::sharesOf($taxLines, $line->lineId);
            if (! self::isZero($amount)) {
                $revenue[] = RoleLine::credit(AccountRole::Revenue, $amount, line: $line);
            }
        }
        if ($revenue === []) {
            $split   = false;
            $revenue = [RoleLine::credit(AccountRole::Revenue, $total - array_sum(array_map(static fn (TaxComponentLine $component): float => $component->amount, $taxLines)))];
        }

        $lines = [RoleLine::debit(AccountRole::Receivable, $total)];
        if ($split) {
            $lines[] = RoleLine::debit(AccountRole::Discount, $discount);
        }
        $lines = [...$lines, ...$revenue];
        foreach ($taxLines as $component) {
            $lines[] = RoleLine::credit($component->role, $component->amount, taxRuleVersionId: $component->ruleVersionId);
        }

        if ($ctx->isReturn()) {
            $lines = array_map(static fn (RoleLine $line): RoleLine => new RoleLine(
                $line->role,
                $line->side === RoleLine::DEBIT ? RoleLine::CREDIT : RoleLine::DEBIT,
                $line->amount,
                $line->description,
                $line->line,
                $line->taxRuleVersionId,
            ), $lines);
        }

        return [new RoleJournalDraft('default', $lines)];
    }

    /**
     * @param  list<TaxComponentLine>  $components
     */
    private static function sharesOf(array $components, ?string $lineId): float {
        return array_sum(array_map(static fn (TaxComponentLine $component): float => $component->shareOf($lineId), $components));
    }
}
