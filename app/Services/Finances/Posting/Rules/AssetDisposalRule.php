<?php

namespace App\Services\Finances\Posting\Rules;

use App\Enums\AccountRole;
use App\Enums\PostingDocumentType;
use App\Services\Finances\Posting\Contexts\PostingContext;
use App\Services\Finances\Posting\RoleJournalDraft;
use App\Services\Finances\Posting\RoleLine;
use LogicException;

/**
 * Penjualan aset lewat invoice, bentuk baku (design.md, peta rule; T-7, keputusan pemilik produk 2026-11-22 dan opsi A
 * 2026-11-23): satu jurnal `disposal:{sales_invoice_item_id}` per baris invoice.
 *
 * Jurnal Sales Invoice tidak diubah dan sudah mendebit `receivable` / mengkredit `revenue` untuk baris aset itu. Jurnal
 * pelepasan karena itu mendebit `revenue` (membalik pendapatan baris itu), bukan `receivable` (yang akan menggandakan
 * piutang). Gabungan kedua jurnal = bentuk baku: Dr piutang (harga jual), Dr akumulasi penyusutan, Cr aset tetap sebesar
 * HARGA PEROLEHAN, untung di kredit, rugi di debit (`gain_loss_disposal`). Parity terhadap jurnal lama sengaja berbeda
 * (jurnal lama terbalik dan tidak mengeluarkan nilai buku; N-1).
 *
 * Kontrak konteks (semua proporsional terhadap qty baris): `amounts['proceeds']` (hasil penjualan = basic - diskon,
 * tanpa pajak yang masih menyatu di pendapatan sampai Fase 3, F-03), `amounts['cost']` (harga perolehan),
 * `amounts['accumulated_depreciation']` (akumulasi penyusutan: jadwal terposting + saldo awal), `amounts['gain_loss']`
 * (informatif; jurnal menurunkan sendiri proceeds + akumulasi - cost agar seimbang menurut konstruksi);
 * `lines[0]` = atribut barang baris (peran `revenue` peka-barang); `flags['sales_invoice_item_id']`,
 * `flags['discount_split']` dengan `amounts['discount_amount']`.
 *
 * Diposting bila harga perolehan > 0 (kasus impas tetap mengeluarkan aset dan akumulasi). Retur tidak memposting
 * pelepasan (listener tidak membangun konteksnya; rule tidak membaca arah retur). Saat Sales Invoice sumber memposting
 * diskon terpisah (SI mengkredit `revenue` kotor dan mendebit `discount`), pelepasan membalik kotor: Dr `revenue`
 * (proceeds + diskon) dan Cr `discount` (diskon), sehingga pendapatan dan diskon baris aset kembali nol. Kunci idempotensi per baris invoice (Q-P1-6).
 */
final class AssetDisposalRule extends BasePostingRule {
    public function documentType(): PostingDocumentType {
        return PostingDocumentType::AssetDisposal;
    }

    public function build(PostingContext $ctx): array {
        $cost = $ctx->amount('cost');
        if ($cost <= 0 || self::isZero($cost)) {
            return [];
        }

        $lineId = (string) $ctx->flag('sales_invoice_item_id', '');
        if ($lineId === '') {
            throw new LogicException('flags[sales_invoice_item_id] is required for asset disposal posting.');
        }

        $proceeds     = $ctx->amount('proceeds');
        $accumulated  = $ctx->amount('accumulated_depreciation');
        $discount     = $ctx->amount('discount_amount');
        $split        = (bool) $ctx->flag('discount_split', false) && $discount > 0 && ! self::isZero($discount);
        $gainLoss     = $proceeds + $accumulated - $cost;
        $revenueDebit = $split ? $proceeds + $discount : $proceeds;
        $line         = $ctx->lines[0] ?? null;

        $lines = [];
        if ($revenueDebit > 0 && ! self::isZero($revenueDebit)) {
            $lines[] = RoleLine::debit(AccountRole::Revenue, $revenueDebit, line: $line);
        }
        if ($split) {
            $lines[] = RoleLine::credit(AccountRole::Discount, $discount);
        }
        if ($accumulated > 0 && ! self::isZero($accumulated)) {
            $lines[] = RoleLine::debit(AccountRole::AccumulatedDepreciation, $accumulated);
        }
        $lines[] = RoleLine::credit(AccountRole::FixedAsset, $cost);
        if (! self::isZero($gainLoss)) {
            $lines[] = $gainLoss > 0
                ? RoleLine::credit(AccountRole::GainLossDisposal, $gainLoss)
                : RoleLine::debit(AccountRole::GainLossDisposal, -$gainLoss);
        }

        return [new RoleJournalDraft("disposal:{$lineId}", $lines)];
    }
}
