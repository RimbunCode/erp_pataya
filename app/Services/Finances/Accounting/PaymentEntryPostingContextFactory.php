<?php

namespace App\Services\Finances\Accounting;

use App\Enums\PostingDocumentType;
use App\Models\Finances\PaymentEntry;
use App\Models\Finances\PurchaseInvoice;
use App\Models\Finances\SalesInvoice;
use App\Services\Finances\Posting\Contexts\PostingContext;
use Illuminate\Support\Carbon;

/**
 * Pabrik `PostingContext` Payment Entry (Finance Fase 2, Task 7.2). Milik domain Finances (engine tidak mengenal model
 * dokumen, P-8).
 *
 * - Jumlah = `paid_amount` entri ini (bukan kumulatif; hotfix F-10 sudah merge, Q-P2-3): nilai sama dengan jalur lama,
 *   tanpa konversi mata uang (F-11, Fase 4).
 * - Tanggal = tanggal Payment Entry atau `now()`, `branchId` null, `sourceType` FQCN: sama dengan `postPair` lama.
 * - Akun master hanya `cash_or_bank` dari `default_account_id` Metode Pembayaran entri ini. Kolom akun dokumen
 *   (`account_paid_from_id`/`account_paid_to_id`) tidak dibaca (Requirement 7.4); lawan `receivable`/`payable`
 *   di-resolve dari profil. Metode pembayaran tanpa akun default tidak melempar di sini: resolver yang menolaknya
 *   hanya bila engine dipakai (mode `shadow`/`on`), sehingga mode `off` tidak berubah.
 * - `paymentable_kind` null untuk dokumen yang dibayar selain Sales/Purchase Invoice: rule menolaknya (T-4). Arah
 *   retur (T-3) dan `internal_transfer` (T-4) tetap menunggu keputusan pemilik produk.
 */
final class PaymentEntryPostingContextFactory {
    /**
     * Konteks minimal tanpa query untuk guard cancel dan pembacaan mode; konteks lengkap (`forApproval`, membaca Metode
     * Pembayaran) hanya dibangun bila mode bukan `off` (Requirement 6.2).
     */
    public function forGuard(PaymentEntry $paymentEntry): PostingContext {
        return new PostingContext(PostingDocumentType::PaymentEntry, $paymentEntry->getMorphClass(), (string) $paymentEntry->getKey(), Carbon::instance($paymentEntry->date ?? now()), null, []);
    }

    public function forApproval(PaymentEntry $paymentEntry): PostingContext {
        $cashAccountId = $paymentEntry->paymentMethod?->default_account_id;

        return new PostingContext(
            documentType: PostingDocumentType::PaymentEntry,
            sourceType: $paymentEntry->getMorphClass(),
            sourceId: (string) $paymentEntry->getKey(),
            transactionDate: Carbon::instance($paymentEntry->date ?? now()),
            branchId: null,
            amounts: ['paid_amount' => (float) $paymentEntry->paid_amount],
            flags: [
                'payment_type'     => $paymentEntry->payment_type,
                'paymentable_kind' => match ($paymentEntry->paymentable_type) {
                    SalesInvoice::class    => 'sales_invoice',
                    PurchaseInvoice::class => 'purchase_invoice',
                    default                => null,
                },
            ],
            masterAccounts: $cashAccountId !== null && $cashAccountId !== '' ? ['cash_or_bank' => (string) $cashAccountId] : [],
        );
    }
}
