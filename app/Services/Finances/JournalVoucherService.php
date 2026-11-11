<?php

namespace App\Services\Finances;

use App\Contracts\SubmitableService;
use App\Enums\FormStatus;
use App\Exceptions\Finances\ClosedPeriodException;
use App\Exceptions\Finances\InvalidJournalException;
use App\Exceptions\Finances\UnbalancedJournalException;
use App\Models\Core\FormatingSeries;
use App\Models\Finances\Account;
use App\Models\Finances\FinanceSetting;
use App\Models\Finances\JournalVoucher;
use App\Models\Finances\JournalVoucherItem;
use App\Models\Model;
use App\Services\Core\Setting\SettingsService;
use App\Services\Finances\Ledger\FiscalPeriodService;
use App\Services\Finances\Ledger\JournalDraft;
use App\Services\Finances\Ledger\JournalDraftValidator;
use App\Services\Finances\Ledger\JournalLineDraft;
use App\Services\Finances\Ledger\JournalService;
use App\Traits\HasDefaultDelete;
use Carbon\CarbonImmutable;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Symfony\Component\Uid\Ulid;

/**
 * Siklus Journal Voucher (Finance Fase 1, Task 11; Requirement 12). Voucher adalah dokumen submitable; `Journal` dan
 * baris GL baru terbentuk di `onApproved()` lewat `JournalService::post()` dengan `source` = voucher dan `posting_key`
 * `{FQCN voucher}:{id}:default`. Draft, diajukan (menunggu persetujuan), ditolak, dan dibatalkan sebelum disetujui tidak
 * pernah menyentuh ledger. Pembatalan sesudah posting ditangani hook `Submitable` (jurnal sumber menjadi `voided`,
 * Requirement 8.6), sama dengan dokumen lain.
 */
class JournalVoucherService implements SubmitableService {
    use HasDefaultDelete;

    private const EDITABLE_FIELDS = ['date', 'description', 'branch_id'];

    public function create(array $data): Model {
        return DB::transaction(function () use ($data) {
            $voucher = JournalVoucher::create([
                'code' => FormatingSeries::generate(JournalVoucher::class, $data, true),
                ...Arr::only($data, self::EDITABLE_FIELDS),
            ]);
            $this->syncItems($voucher, $data['items'] ?? []);

            return $voucher;
        });
    }

    public function update(Model $voucher, array $data): Model {
        return DB::transaction(function () use ($voucher, $data) {
            // Kunci baris dan baca ulang status: update yang bersamaan dengan submit/onApproved tidak boleh mengubah
            // isi voucher yang sudah diajukan (isi itulah yang diposting).
            $locked = $this->lockVoucher($voucher);

            if (! $this->hasStatus($locked, FormStatus::DRAFT)) {
                throw ValidationException::withMessages([
                    'status' => __('finances/journalVoucher.errors.update_not_draft'),
                ]);
            }

            $locked->fillForUpdate(Arr::only($data, self::EDITABLE_FIELDS));
            $this->syncItems($locked, $data['items'] ?? []);

            return $locked;
        });
    }

    public function submit(Model $voucher): mixed {
        return DB::transaction(function () use ($voucher) {
            $locked = $this->lockVoucher($voucher);

            if (! $this->hasStatus($locked, FormStatus::DRAFT)) {
                throw ValidationException::withMessages([
                    'status' => __('finances/journalVoucher.errors.submit_not_draft'),
                ]);
            }

            // Pra-pemeriksaan saat diajukan: voucher yang tidak dapat diposting (tidak seimbang, akun nonaktif,
            // periode tertutup) ditolak di sini, bukan baru gagal saat persetujuan akhir.
            $this->assertPostable($locked);

            $voucher->refresh();
            $voucher->update([
                'code' => FormatingSeries::generate(JournalVoucher::class, $voucher),
            ]);
            // `checkApproval` melakukan commit sebenarnya di akhirnya (lihat `Submitable::checkApproval`): jangan
            // menaruh kode sesudah baris ini (pola `PaymentEntryService::submit`).
            $voucher->checkApproval();

            return $voucher;
        });
    }

    /**
     * Persetujuan akhir: memposting jurnal tepat sekali. Dibungkus transaksi sendiri karena
     * `ApprovalInstanceController::approve` memanggilnya setelah commit keputusan; bila `JournalService` menolak,
     * seluruhnya digulung dan voucher tetap pada status sebelumnya tanpa jurnal.
     */
    public function onApproved(Model $voucher): mixed {
        $result = DB::transaction(function () use ($voucher) {
            $locked = $this->lockVoucher($voucher);

            // Hanya draft (tanpa skema approval) dan need_approval yang diposting; voucher yang sudah disetujui,
            // ditolak, atau dibatalkan (mis. dibatalkan di sela keputusan approver) tidak diposting ulang. Inilah
            // pengaman idempotensi pertama; `posting_key` adalah pengaman kedua.
            if (! $this->isApplicable($locked)) {
                return $locked;
            }

            try {
                app(JournalService::class)->post($this->buildDraft($locked));
            } catch (ClosedPeriodException $e) {
                throw ValidationException::withMessages(['date' => $e->getMessage()]);
            } catch (InvalidJournalException|UnbalancedJournalException $e) {
                throw ValidationException::withMessages(['items' => $e->getMessage()]);
            }
            // `DuplicatePostingException` sengaja tidak ditangkap: guard status mencegah persetujuan ganda, jadi
            // kunci ganda berarti inkonsistensi yang harus menggulung seluruh persetujuan (pola `PaymentEntryService`).

            $locked->update(['status' => [FormStatus::SUBMITTED]]);

            return $locked;
        });

        $voucher->refresh();

        return $result;
    }

    public function onRejected(Model $voucher): mixed {
        $result = DB::transaction(function () use ($voucher) {
            $locked = $this->lockVoucher($voucher);

            // Penolakan hanya berlaku untuk voucher yang masih menunggu: voucher yang sudah dibatalkan, disetujui,
            // atau ditolak tidak ditimpa (mis. dibatalkan di sela keputusan approver).
            if (! $this->isApplicable($locked)) {
                return $locked;
            }

            $locked->update(['status' => [FormStatus::REJECTED]]);

            return $locked;
        });

        $voucher->refresh();

        return $result;
    }

    /**
     * Hanya mengubah status. Hook `Submitable` men-soft-delete baris GL sumber dan menandai jurnalnya `voided` bila
     * voucher sudah diposting (Requirement 8.6); voucher yang belum diposting tidak punya jurnal atau baris GL.
     */
    public function cancel(Model $voucher): mixed {
        $result = DB::transaction(function () use ($voucher) {
            $locked = $this->lockVoucher($voucher);

            if ($this->hasStatus($locked, FormStatus::CANCELED)) {
                return $locked;
            }

            $locked->update(['status' => [FormStatus::CANCELED]]);

            return $locked;
        });

        $voucher->refresh();

        return $result;
    }

    public function amend(Model $model): mixed {
        return $model->amend();
    }

    /**
     * Draft jurnal dari isi voucher: `source` = voucher, `posting_key` idempoten, tanggal = instan `date` voucher.
     */
    private function buildDraft(JournalVoucher $voucher): JournalDraft {
        $lines = $voucher->items()->get()->map(fn (JournalVoucherItem $item) => new JournalLineDraft(
            accountId: $item->account_id,
            debit: $item->debit ?? 0,
            credit: $item->credit ?? 0,
            description: $item->description,
        ))->all();

        return new JournalDraft(
            transactionDate: CarbonImmutable::instance($voucher->date),
            lines: $lines,
            source: $voucher,
            postingKey: "{$voucher->getMorphClass()}:{$voucher->getKey()}:default",
            branchId: $voucher->branch_id,
            description: $voucher->description,
        );
    }

    /**
     * Pra-pemeriksaan posting (tanpa menulis): struktur dan keseimbangan dalam minor unit mata uang dasar, akun
     * dapat diposting, dan periode terbuka bila penegakan aktif. Pemeriksaan otoritatif tetap dilakukan
     * `JournalService::post()` saat persetujuan; ini hanya mempersempit jendela gagal di persetujuan akhir.
     *
     * @throws ValidationException
     */
    private function assertPostable(JournalVoucher $voucher): void {
        $draft = $this->buildDraft($voucher);

        try {
            JournalDraftValidator::validate($draft, app(JournalService::class)->baseCurrency()[1]);
            $this->assertAccountsPostable($draft);

            if ((bool) app(SettingsService::class)->getForRead(FinanceSetting::class)->enforce_fiscal_period) {
                app(FiscalPeriodService::class)->assertOpen($draft->transactionDate);
            }
        } catch (ClosedPeriodException $e) {
            throw ValidationException::withMessages(['date' => $e->getMessage()]);
        } catch (InvalidJournalException|UnbalancedJournalException $e) {
            throw ValidationException::withMessages(['items' => $e->getMessage()]);
        }
    }

    /**
     * @throws InvalidJournalException
     */
    private function assertAccountsPostable(JournalDraft $draft): void {
        $ids      = collect($draft->lines)->pluck('accountId')->unique()->all();
        $accounts = Account::query()->withoutGlobalScopes()->whereIn('id', $ids)->get()->keyBy('id');

        foreach ($ids as $id) {
            /** @var Account|null $account */
            $account = $accounts->get($id);
            if ($account === null) {
                throw InvalidJournalException::accountNotFound($id);
            }

            $label = "{$account->account_number} - {$account->account_name}";
            if ($account->deleted_at !== null) {
                throw InvalidJournalException::accountDeleted($label);
            }
            if ($account->is_group) {
                throw InvalidJournalException::accountIsGroup($label);
            }
            if ($account->is_disabled) {
                throw InvalidJournalException::accountDisabled($label);
            }
        }
    }

    /**
     * Menyamakan baris voucher dengan payload: baris berid ULID yang sudah ada diperbarui, sisanya dibuat, yang tidak
     * ada di payload dihapus. `line_no` mengikuti urutan payload. Hanya dipanggil pada voucher berstatus draft.
     *
     * @param  array<int, array<string, mixed>>  $items
     */
    private function syncItems(JournalVoucher $voucher, array $items): void {
        $existing = $voucher->items()->get()->keyBy('id');
        $keepIds  = [];

        foreach (array_values($items) as $index => $item) {
            $attributes = [
                'account_id'  => $item['account']['id'],
                'debit'       => $item['debit'] ?? 0,
                'credit'      => $item['credit'] ?? 0,
                'description' => $item['description'] ?? null,
                'line_no'     => $index + 1,
            ];

            $id    = (string) ($item['id'] ?? '');
            $model = Ulid::isValid($id) ? $existing->get($id) : null;
            if ($model !== null) {
                $model->update($attributes);
            } else {
                $model = $voucher->items()->create($attributes);
            }
            $keepIds[] = $model->id;
        }

        $voucher->items()->whereNotIn('id', $keepIds)->delete();
    }

    /**
     * Baris voucher dikunci dengan global scope cabang dilepas: persetujuan dapat dilakukan approver yang sesi
     * cabangnya berbeda dari pembuat, dan kegagalan menemukan baris tidak boleh membatalkan persetujuan.
     */
    private function lockVoucher(Model $voucher): JournalVoucher {
        return JournalVoucher::query()
            ->withoutGlobalScope('branch')
            ->whereKey($voucher->getKey())
            ->lockForUpdate()
            ->firstOrFail();
    }

    private function hasStatus(JournalVoucher $voucher, FormStatus $status): bool {
        return \in_array($status, (array) $voucher->status, true);
    }

    private function isApplicable(JournalVoucher $voucher): bool {
        return $this->hasStatus($voucher, FormStatus::DRAFT) || $this->hasStatus($voucher, FormStatus::NEED_APPROVAL);
    }
}
