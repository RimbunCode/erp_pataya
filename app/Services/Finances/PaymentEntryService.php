<?php

namespace App\Services\Finances;

use App\Contracts\SubmitableService;
use App\Enums\FormStatus;
use App\Events\Core\DocumentSubmitted;
use App\Events\Finances\PaymentApplied;
use App\Exceptions\Finances\DuplicatePostingException;
use App\Models\Core\CoreSetting;
use App\Models\Core\FormatingSeries;
use App\Models\Finances\PaymentEntry;
use App\Models\Finances\PurchaseInvoice;
use App\Models\Finances\SalesInvoice;
use App\Models\Model;
use App\Models\Purchase\Supplier;
use App\Models\Sales\Customer;
use App\Services\Core\Setting\SettingsService;
use App\Services\Finances\Accounting\PaymentEntryPostingContextFactory;
use App\Services\Finances\Ledger\JournalService;
use App\Services\Finances\Posting\PostingGateway;
use App\Traits\HasDefaultDelete;
use App\Utils;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PaymentEntryService implements SubmitableService {
    use HasDefaultDelete;

    private function fillRelations(array $data) {
        $data['default_account_id'] = $data['default_account']['id'] ?? null;
        $defaultCurrency            = app(SettingsService::class)->get(CoreSetting::class)->default_currency_id;
        $data['currency_code']      = $data['currency']['code'] ?? $defaultCurrency;
        $data['base_currency_code'] = $defaultCurrency;

        if ($data['currency_code'] != $defaultCurrency && empty($data['exchange_rate'])) {
            throw ValidationException::withMessages(['exchange_rate' => 'Exchange rate is required for non-default currency.']);
        }

        $data['exchange_rate']        = $data['currency_code'] == $defaultCurrency ? 1 : $data['exchange_rate'];
        $data['partyable_id']         = $data['partyable']['id'];
        $data['partyable_type']       = $data['payment_type'] == 'pay' ? Supplier::class : Customer::class;
        $data['paymentable_id']       = $data['paymentable']['id'];
        $data['paymentable_type']     = $data['payment_type'] == 'pay' ? PurchaseInvoice::class : SalesInvoice::class;
        $data['payment_method_id']    = $data['payment_method']['id'] ?? null;
        $data['account_paid_to_id']   = $data['account_paid_to']['id'];
        $data['account_paid_from_id'] = $data['account_paid_from']['id'];
        $data['exchange_rate']        = $data['exchange_rate'] ?? 1;

        return $data;
    }

    public function create(array $data): Model {
        DB::beginTransaction();
        $data['code'] = FormatingSeries::generate(PaymentEntry::class, $data, true);
        $paymentEntry = PaymentEntry::create($this->fillRelations($data));
        DB::commit();

        return $paymentEntry;
    }

    public function update(Model $paymentEntry, array $data): Model {
        return DB::transaction(function () use ($paymentEntry, $data) {
            // Kunci baris dan baca ulang status: update draft yang bersamaan dengan submit/onApproved tidak boleh
            // menimpa paid_amount atau akun Payment Entry yang baru diterapkan.
            $locked = PaymentEntry::whereKey($paymentEntry->getKey())->lockForUpdate()->firstOrFail();

            if (! \in_array(FormStatus::DRAFT, (array) $locked->status, true)) {
                throw ValidationException::withMessages([
                    'status' => __('finances/paymentEntry.errors.update_not_draft'),
                ]);
            }

            $locked->fillForUpdate($this->fillRelations($data));

            return $locked;
        });
    }

    public function submit(Model $paymentEntry): mixed {
        return DB::transaction(function () use ($paymentEntry) {
            // Kunci baris dan baca ulang status (sama dengan `update`): submit ganda yang bersamaan, atau submit
            // atas PE yang sudah diterapkan/dibatalkan, tidak boleh mengganti kode, mengirim ulang
            // DocumentSubmitted, atau memicu approval lagi. Kunci tertahan sampai `checkApproval` (yang memanggil
            // `onApproved` pada jalur tanpa skema) selesai.
            $locked = PaymentEntry::whereKey($paymentEntry->getKey())->lockForUpdate()->firstOrFail();

            if (! \in_array(FormStatus::DRAFT, (array) $locked->status, true)) {
                throw ValidationException::withMessages([
                    'status' => __('finances/paymentEntry.errors.submit_not_draft'),
                ]);
            }

            $paymentEntry->refresh();
            $paymentEntry->update([
                'code' => FormatingSeries::generate(PaymentEntry::class, $paymentEntry),
            ]);
            event(new DocumentSubmitted($paymentEntry, $paymentEntry->paymentable));
            // `checkApproval` melakukan commit sebenarnya di akhirnya (lihat `Submitable::checkApproval`): jangan menaruh
            // kode sesudah baris ini, karena akan berjalan di luar transaksi dan kunci baris.
            $paymentEntry->checkApproval();

            return $paymentEntry;
        });
    }

    public function onApproved(Model $paymentEntry): mixed {
        $result = DB::transaction(function () use ($paymentEntry) {
            // Urutan kunci: paymentable lebih dulu, lalu Payment Entry (sama dengan cancel).
            $paymentableClass = $paymentEntry->paymentable_type;
            $paymentableId    = $paymentEntry->paymentable_id;
            $paymentable      = $paymentableClass::where('id', $paymentableId)
                ->lockForUpdate()
                ->firstOrFail();

            $locked = PaymentEntry::whereKey($paymentEntry->getKey())->lockForUpdate()->firstOrFail();

            // Hanya draft (tanpa skema approval) dan need_approval (jalur approver) yang diterapkan; Payment Entry
            // yang sudah paid, canceled, atau rejected tidak diterapkan ulang (submit ulang, pembatalan di sela approver).
            if (! $this->isApplicable($locked)) {
                return $locked;
            }

            // Paymentable yang dikunci di atas dibaca dari model yang dioper (bisa basi). Bila `update` draft yang
            // bersamaan sempat mengganti paymentable sebelum kunci PE didapat, batalkan transaksi: menerapkan
            // pembayaran ke dokumen lama sementara PE menunjuk dokumen baru tidak dapat dibalik oleh cancel.
            if ($locked->paymentable_type !== $paymentableClass || (string) $locked->paymentable_id !== (string) $paymentableId) {
                throw ValidationException::withMessages([
                    'paymentable' => __('finances/paymentEntry.errors.paymentable_changed'),
                ]);
            }

            $locked->load([
                'accountPaidFrom',
                'accountPaidTo',
            ]);

            $newPaidAmount = (float) $paymentable->paid_amount + (float) $locked->paid_amount;
            $this->allocateToSchedules($paymentable, $newPaidAmount);
            event(new PaymentApplied($paymentable, $newPaidAmount));

            $locked->update([
                'status' => [
                    FormStatus::PAID,
                ],
            ]);

            $this->postLedger($locked);

            return $locked;
        });

        $paymentEntry->refresh();

        return $result;
    }

    private function isApplicable(PaymentEntry $paymentEntry): bool {
        $status = (array) $paymentEntry->status;

        return \in_array(FormStatus::DRAFT, $status, true) || \in_array(FormStatus::NEED_APPROVAL, $status, true);
    }

    /**
     * Jurnal pembayaran: debit `account_paid_to`, kredit `account_paid_from`, sebesar jumlah Payment Entry ini.
     * Nilai tidak dikonversi ke mata uang dasar (F-11, Fase 4).
     */
    private function postLedger(PaymentEntry $paymentEntry): void {
        // Gateway Posting Engine (Finance Fase 2, Task 7.2): closure = jalur Fase 1 apa adanya (mode `off`/`shadow`).
        $outcome = app(PostingGateway::class)->postDeferred(
            app(PaymentEntryPostingContextFactory::class)->forGuard($paymentEntry),
            fn () => app(PaymentEntryPostingContextFactory::class)->forApproval($paymentEntry),
            function () use ($paymentEntry) {
                $debitAccount    = $paymentEntry->accountPaidTo;
                $creditAccount   = $paymentEntry->accountPaidFrom;
                $transactionDate = $paymentEntry->date ?? now();
                $amount          = $paymentEntry->paid_amount;

                // Adapter JournalService (Requirement 8.1): perilaku pasca-hotfix dipertahankan (debit accountPaidTo, kredit
                // accountPaidFrom, jumlah Payment Entry ini). `DuplicatePostingException` sengaja tidak ditangkap: guard
                // status (`isApplicable`) mencegah approve ganda, jadi kunci ganda berarti inkonsistensi yang harus
                // menggulung seluruh penerapan pembayaran.
                app(JournalService::class)->postPair(
                    $debitAccount->id,
                    $creditAccount->id,
                    $amount,
                    $paymentEntry,
                    Carbon::instance($transactionDate),
                );
            },
        );

        // Jalur engine (mode `on`): semantik sama dengan jalur lama. Penerapan pembayaran (jadwal, `PaymentApplied`)
        // sudah berjalan dalam transaksi yang sama sebelum posting, jadi jurnal yang ternyata sudah ada adalah
        // inkonsistensi yang menggulung seluruh approve, bukan keadaan yang dilewati (Q-P2-12b).
        if ($outcome->isAlreadyPosted()) {
            $existing = $outcome->journals[0];

            throw new DuplicatePostingException((string) $existing->getKey(), (string) $existing->posting_key);
        }
    }

    /**
     * Mengalokasikan total terbayar ke jadwal pembayaran secara berurutan (jatuh tempo, lalu id): setiap jadwal
     * menerima paling banyak `payment_amount`-nya. Dihitung dari total, bukan dari delta, sehingga dipakai sama
     * untuk approve dan pembatalan dan tidak me-reset jadwal yang sudah lunas. Kelebihan tidak dialokasikan.
     */
    private function allocateToSchedules(Model $paymentable, float $totalPaid): void {
        $remaining = max(0.0, $totalPaid);

        $schedules = $paymentable->paymentSchedules()->reorder()->orderBy('due_date')->orderBy('id')->get();
        foreach ($schedules as $schedule) {
            $allocated = min((float) $schedule->payment_amount, $remaining);
            if (abs($allocated - (float) $schedule->paid_amount) > 1e-6) {
                $schedule->update(['paid_amount' => $allocated]);
            }
            $remaining -= $allocated;
        }
    }

    public function onRejected(Model $paymentEntry): mixed {
        DB::beginTransaction();
        $paymentEntry->update([
            'status' => [
                FormStatus::REJECTED,
            ],
        ]);

        DB::commit();

        return $paymentEntry;
    }

    public function cancel(Model $paymentEntry): mixed {
        $result = DB::transaction(function () use ($paymentEntry) {
            // Urutan kunci sama dengan onApproved: paymentable dulu, lalu Payment Entry. withTrashed: paymentable
            // yang di-soft-delete tetap dikunci dan dibalik.
            $paymentable = $paymentEntry->paymentable_type
                ? $paymentEntry->paymentable_type::withTrashed()->where('id', $paymentEntry->paymentable_id)->lockForUpdate()->first()
                : null;

            $locked = PaymentEntry::whereKey($paymentEntry->getKey())->lockForUpdate()->firstOrFail();

            if (\in_array(FormStatus::CANCELED, (array) $locked->status, true)) {
                return $locked;
            }

            if (\in_array(FormStatus::PAID, (array) $locked->status, true)) {
                $this->reversePayment($locked, $paymentable);
            }

            $locked->update([
                'status' => [
                    FormStatus::CANCELED,
                ],
            ]);

            return $locked;
        });

        $paymentEntry->refresh();

        return $result;
    }

    /**
     * Membalik penerapan Payment Entry pada paymentable: total terbayar, status pembayaran, dan jadwal.
     * GL di-soft-delete oleh hook `Submitable` saat status berubah ke canceled (F-04 bagian GL, tidak diubah).
     */
    private function reversePayment(PaymentEntry $paymentEntry, ?Model $paymentable): void {
        if ($paymentable === null) {
            throw ValidationException::withMessages([
                'status' => __('finances/paymentEntry.errors.cancel_paymentable_missing'),
            ]);
        }

        $newPaid = (float) $paymentable->paid_amount - (float) $paymentEntry->paid_amount;
        if ($newPaid < -0.005) {
            throw ValidationException::withMessages([
                'status' => __('finances/paymentEntry.errors.cancel_exceeds_paid'),
            ]);
        }
        $newPaid = $newPaid < 0.005 ? 0.0 : $newPaid;

        $this->allocateToSchedules($paymentable, $newPaid);

        $target = match (true) {
            $newPaid <= 0.005                                => FormStatus::UNPAID,
            $newPaid + 0.005 >= (float) $paymentable->amount => FormStatus::PAID,
            default                                          => FormStatus::PARTIALLY_PAID,
        };

        $paymentable->paid_amount = $newPaid;
        $paymentable->status      = Utils::replaceStatus(
            (array) $paymentable->status,
            [FormStatus::UNPAID, FormStatus::PARTIALLY_PAID, FormStatus::PAID],
            $target,
            forceInsert: true,
        );
        $paymentable->save();
    }

    public function amend(Model $model): mixed {
        return $model;
    }
}
