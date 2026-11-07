<?php

namespace App\Services\Finances\Ledger;

use App\Enums\JournalStatus;
use App\Exceptions\Finances\ClosedPeriodException;
use App\Exceptions\Finances\DuplicatePostingException;
use App\Exceptions\Finances\InvalidJournalException;
use App\Exceptions\Finances\UnbalancedJournalException;
use App\Models\Core\CoreSetting;
use App\Models\Core\Currency;
use App\Models\Core\FormatingSeries;
use App\Models\Finances\Account;
use App\Models\Finances\FinanceSetting;
use App\Models\Finances\FiscalPeriod;
use App\Models\Finances\GeneralLedger;
use App\Models\Finances\Journal;
use App\Services\Core\Setting\SettingsService;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

/**
 * Satu-satunya pintu penulisan jurnal baru (Finance Fase 1, Requirement 2). Jurnal dan seluruh barisnya ditulis dalam
 * satu transaksi; bila dipanggil di dalam transaksi pemanggil (listener, service) Laravel memakai savepoint dan
 * pengecualian diteruskan ke pemanggil.
 *
 * Urutan penting (lihat `design.md`): validasi struktur dan keseimbangan tanpa DB, lalu transaksi: kunci akun
 * (urutan `id` menaik, anti-deadlock; kompatibel dengan pemanggil yang sudah mengunci akun yang sama), periode
 * fiskal, pengecekan akun, nomor jurnal (kunci baris series), jurnal, lalu baris per baris. Kunci series
 * (`FormatingSeries::generate`) diambil SETELAH kunci akun agar urutan kunci konsisten untuk semua posting.
 */
final class JournalService {
    private const DEFAULT_MINOR_UNIT = Iso4217::DEFAULT_MINOR_UNIT;

    public function __construct(
        private readonly FiscalPeriodService $periods,
        private readonly SettingsService $settings,
    ) {}

    /**
     * @throws InvalidJournalException bila draft atau akun tidak valid, atau seri penomoran belum terdaftar
     * @throws UnbalancedJournalException bila Σdebit ≠ Σkredit dalam minor unit
     * @throws ClosedPeriodException bila penegakan periode aktif dan periodenya tertutup/tak ada
     * @throws DuplicatePostingException bila `postingKey` sudah dipakai
     */
    public function post(JournalDraft $draft): Journal {
        return $this->postWithBaseCurrency($draft, $this->baseCurrency());
    }

    /**
     * Isi `post()` dengan mata uang dasar yang sudah dihitung pemanggil, agar setting dan minor unit dibaca sekali
     * per posting (juga saat dipanggil dari `postPair()`).
     *
     * @param  array{0: string|null, 1: int}  $baseCurrency  [kode mata uang dasar, minor unit]
     */
    private function postWithBaseCurrency(JournalDraft $draft, array $baseCurrency): Journal {
        $draft = $this->withStorageTimezone($draft);

        // Pra-pemeriksaan tanpa kunci: retry job yang sudah terposting selalu berakhir sebagai duplikat, apa pun
        // keadaan akun/periode sekarang. Balapan sebenarnya ditangkap oleh kunci unik saat INSERT.
        if ($draft->postingKey !== null) {
            $existing = Journal::query()->withoutGlobalScopes()->where('posting_key', $draft->postingKey)->value('id');
            if ($existing !== null) {
                throw new DuplicatePostingException($existing, $draft->postingKey);
            }
        }

        [$currencyCode, $minorUnit] = $baseCurrency;
        $normalized                 = JournalDraftValidator::validate($draft, $minorUnit);
        $enforcePeriod              = (bool) $this->settings->getForRead(FinanceSetting::class)->enforce_fiscal_period;

        // Seri penomoran dibuat otomatis bila belum ada (keputusan A pemilik produk 2026-11-04) dan tidak pernah
        // ditulis ulang bila sudah ada. Dipanggil sebelum transaksi jurnal ini, tetapi adapter memanggil posting di
        // dalam DB::transaction luar (Payment Entry, Stock Entry, hook Submitable), sehingga pembuatan seri ikut
        // transaksi luar itu; pelanggaran unik akibat dua proses yang membuatnya bersamaan ditangkap di `FormatingSeries::ensureExists()` (fallback `first()` saja tidak cukup di bawah snapshot REPEATABLE READ).
        Journal::ensureNumberingSeries();

        return DB::transaction(function () use ($draft, $normalized, $currencyCode, $enforcePeriod): Journal {
            $this->lockAndValidateAccounts($normalized);

            $period = $enforcePeriod
                ? $this->periods->assertOpen($draft->transactionDate, lockForShare: true)
                : $this->periods->resolve($draft->transactionDate);

            $journal = $this->insertJournal($draft, $normalized, $currencyCode, $period);
            $lines   = $this->insertLines($draft, $normalized, $journal);

            $journal->setRelation('lines', new Collection($lines));

            return $journal;
        });
    }

    /**
     * Adapter dua baris untuk titik posting lama (Requirement 2.9): debit `$debitAccountId`, kredit
     * `$creditAccountId`; `$reverseSides` menukar sisi (retur). Mengembalikan null bila jumlahnya nol setelah
     * pembulatan, tanpa membuat jurnal (Requirement 2.10; perubahan disengaja dari perilaku lama yang membuat baris
     * 0/0, N-8).
     *
     * `postingKey` = `{source_type}:{source_id}:{purpose}`; satu sumber yang diposting lebih dari sekali (mis. banyak
     * baris yang sama-sama bersumber satu dokumen) harus memberi `purpose` yang berbeda per posting.
     */
    public function postPair(
        string $debitAccountId,
        string $creditAccountId,
        float|int|string $amount,
        Model $source,
        CarbonInterface $transactionDate,
        string $purpose = 'default',
        bool $reverseSides = false,
        ?string $branchId = null,
    ): ?Journal {
        $baseCurrency = $this->baseCurrency();

        if ($this->isZeroAfterRounding($amount, $baseCurrency[1])) {
            return null;
        }

        if ($reverseSides) {
            [$debitAccountId, $creditAccountId] = [$creditAccountId, $debitAccountId];
        }

        return $this->postWithBaseCurrency(new JournalDraft(
            transactionDate: $transactionDate,
            lines: [
                new JournalLineDraft($debitAccountId, debit: $amount, againstAccountId: $creditAccountId),
                new JournalLineDraft($creditAccountId, credit: $amount, againstAccountId: $debitAccountId),
            ],
            source: $source,
            postingKey: "{$source->getMorphClass()}:{$source->getKey()}:{$purpose}",
            branchId: $branchId,
        ), $baseCurrency);
    }

    /**
     * Menormalkan `transactionDate` ke zona penyimpanan (`APP_TIMEZONE`, UTC) di satu titik masuk: Eloquent
     * memformat jam dinding objek Carbon apa adanya tanpa konversi, sehingga tanggal non-UTC (mis. 23.30 WIB) akan
     * tersimpan sebagai 23.30 UTC dan periode fiskal tidak cocok dengan tanggal tersimpan (Requirement 6.9). Semua
     * pemakai (periode, `journals.transaction_date`, baris GL, termasuk reversal yang memanggil `post()`) memakai
     * draft yang sudah dinormalisasi; instan waktunya tidak berubah.
     */
    private function withStorageTimezone(JournalDraft $draft): JournalDraft {
        return $draft->withTransactionDate(CarbonImmutable::instance($draft->transactionDate)->setTimezone((string) config('app.timezone')));
    }

    private function isZeroAfterRounding(float|int|string $amount, int $minorUnit): bool {
        if (! is_numeric($amount) || (float) $amount < 0) {
            return false;
        }

        try {
            return MinorUnit::toMinor($amount, $minorUnit) === 0;
        } catch (\RangeException) {
            return false; // `post()` menolaknya dengan pesan baris.
        }
    }

    /**
     * Mata uang dasar dari setting umum (`default_currency_id`) dan minor unit-nya. Tanpa setting, kode null dan
     * minor unit 2.
     *
     * @return array{0: string|null, 1: int}
     */
    public function baseCurrency(): array {
        $code = $this->settings->getForRead(CoreSetting::class)->default_currency_id;
        if ($code === null || $code === '') {
            return [null, self::DEFAULT_MINOR_UNIT];
        }

        $minorUnit = Currency::query()->withoutGlobalScopes()->whereKey($code)->value('minor_unit');

        return [$code, $minorUnit === null ? self::DEFAULT_MINOR_UNIT : (int) $minorUnit];
    }

    /**
     * Mengunci akun yang terlibat (urutan `id` menaik) dan menolak akun yang hilang, terhapus, grup, atau nonaktif.
     * Global scope dilepas agar akun contoh/terhapus tidak tampak "hilang"; penolakan dilakukan eksplisit.
     */
    private function lockAndValidateAccounts(NormalizedJournal $normalized): void {
        $ids      = $normalized->accountIds();
        $accounts = Account::query()
            ->withoutGlobalScopes()
            ->whereIn('id', $ids)
            ->orderBy('id')
            ->lockForUpdate()
            ->get()
            ->keyBy('id');

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

    private function insertJournal(JournalDraft $draft, NormalizedJournal $normalized, ?string $currencyCode, ?FiscalPeriod $period): Journal {
        $total                   = MinorUnit::fromMinor($normalized->totalMinor, $normalized->minorUnit);
        [$sourceType, $sourceId] = $this->sourceReference($draft);

        try {
            return Journal::forceCreate([
                'code'              => FormatingSeries::generate(Journal::class, []),
                'transaction_date'  => $draft->transactionDate,
                'fiscal_period_id'  => $period?->id,
                'branch_id'         => $draft->branchId,
                'status'            => JournalStatus::Posted->value,
                'source_type'       => $sourceType,
                'source_id'         => $sourceId,
                'posting_key'       => $draft->postingKey,
                'currency_code'     => $currencyCode,
                'description'       => $draft->description,
                'total_debit'       => $total,
                'total_credit'      => $total,
                'legacy_origin'     => false,
                'legacy_unbalanced' => false,
                'posted_at'         => now(),
                'posted_by_id'      => Auth::id(),
            ]);
        } catch (UniqueConstraintViolationException $e) {
            // Balapan: proses lain meng-commit `posting_key` yang sama setelah pra-pemeriksaan. INSERT yang menabrak
            // kunci unik menunggu commit lawan, jadi barisnya sudah terlihat oleh pembacaan terkunci (current read);
            // pembacaan biasa pada REPEATABLE READ dapat melewatkannya.
            $owner = $draft->postingKey === null ? null : Journal::query()
                ->withoutGlobalScopes()
                ->where('posting_key', $draft->postingKey)
                ->lockForUpdate()
                ->value('id');

            if ($owner === null) {
                throw $e;
            }

            throw new DuplicatePostingException($owner, $draft->postingKey);
        }
    }

    /**
     * @return array{0: string|null, 1: string|null}
     */
    private function sourceReference(JournalDraft $draft): array {
        if ($draft->source !== null) {
            return [$draft->source->getMorphClass(), (string) $draft->source->getKey()];
        }

        return [$draft->sourceType, $draft->sourceId];
    }

    /**
     * Baris ditulis satu per satu (bukan bulk insert) agar hook `creating` yang membuat `code` baris (F-15) tetap
     * berjalan. Sumber null (jurnal manual): baris merujuk jurnal itu sendiri.
     *
     * @return list<GeneralLedger>
     */
    private function insertLines(JournalDraft $draft, NormalizedJournal $normalized, Journal $journal): array {
        [$sourceType, $sourceId] = $this->sourceReference($draft);
        $referenceableType       = $sourceType ?? $journal->getMorphClass();
        $referenceableId         = $sourceId ?? $journal->getKey();

        $created = [];
        foreach ($normalized->lines as $line) {
            $created[] = GeneralLedger::create([
                'journal_id'         => $journal->id,
                'line_no'            => $line->lineNo,
                'account_id'         => $line->draft->accountId,
                'against_account_id' => $line->draft->againstAccountId,
                'branch_id'          => $draft->branchId,
                'referenceable_type' => $referenceableType,
                'referenceable_id'   => $referenceableId,
                'partyable_type'     => $line->draft->party?->getMorphClass() ?? $line->draft->partyType,
                'partyable_id'       => $line->draft->party?->getKey() ?? $line->draft->partyId,
                'debit'              => (float) MinorUnit::fromMinor($line->debitMinor, $normalized->minorUnit),
                'credit'             => (float) MinorUnit::fromMinor($line->creditMinor, $normalized->minorUnit),
                'transaction_date'   => $draft->transactionDate,
                'description'        => $line->draft->description ?? $draft->description,
            ]);
        }

        return $created;
    }
}
