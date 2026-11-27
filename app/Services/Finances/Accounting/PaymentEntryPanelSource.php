<?php

namespace App\Services\Finances\Accounting;

use App\Enums\AccountRole;
use App\Enums\PostingDocumentType;
use App\Models\Finances\PaymentEntry;
use App\Models\Finances\PurchaseInvoice;
use App\Models\Finances\SalesInvoice;
use App\Services\Finances\Posting\AccountPanel\PanelPreviewUnavailableException;
use App\Services\Finances\Posting\AccountPanel\PanelSource;
use App\Services\Finances\Posting\AccountPanel\RecordedColumns;
use App\Services\Finances\Posting\Contexts\PostingContext;
use Illuminate\Database\Eloquent\Model;

/**
 * Sisi baca panel "Akun pencatatan" Payment Entry (Finance Fase 2, Task 12.4; Requirement 13.4). Milik domain Finances
 * (P-8), pasangan `PaymentEntryPostedAccountRecorder`. Arah mengikuti `payment_type`: `receive` mendebit
 * `cash_or_bank` (`account_paid_to_id`) dan mengkredit lawan (`account_paid_from_id`); `pay` kebalikannya. Lawan
 * mengikuti jenis dokumen yang dibayar (`receivable` untuk Sales Invoice, `payable` untuk Purchase Invoice).
 */
final class PaymentEntryPanelSource implements PanelSource {
    public function __construct(private readonly PaymentEntryPostingContextFactory $factory) {}

    public function documentType(): PostingDocumentType {
        return PostingDocumentType::PaymentEntry;
    }

    public function previewContext(Model $document): ?PostingContext {
        /** @var PaymentEntry $document */
        // Engine menolak jenis ini (T-4: `internal_transfer`, atau dokumen yang dibayar bukan Sales/Purchase Invoice).
        // Itu penolakan yang dapat diduga, bukan galat: tampilkan pesannya tanpa `report()` pada tiap muat halaman.
        if (! in_array($document->payment_type, ['receive', 'pay'], true) || ! in_array($document->paymentable_type, [SalesInvoice::class, PurchaseInvoice::class], true)) {
            throw new PanelPreviewUnavailableException(__('finances/postedAccounts.errors.payment_type_unsupported'));
        }

        return $this->factory->forApproval($document);
    }

    public function previewIsEstimate(): bool {
        return false;
    }

    public function recorded(Model $document): array {
        /** @var PaymentEntry $document */
        $counterpart = match ($document->paymentable_type) {
            SalesInvoice::class    => AccountRole::Receivable->value,
            PurchaseInvoice::class => AccountRole::Payable->value,
            default                => null,
        };
        $cash = AccountRole::CashOrBank->value;

        return match ($document->payment_type) {
            'receive' => [
                ...RecordedColumns::single($cash, $document->account_paid_to_id),
                ...RecordedColumns::single($counterpart, $document->account_paid_from_id),
            ],
            'pay' => [
                ...RecordedColumns::single($cash, $document->account_paid_from_id),
                ...RecordedColumns::single($counterpart, $document->account_paid_to_id),
            ],
            default => [],
        };
    }
}
