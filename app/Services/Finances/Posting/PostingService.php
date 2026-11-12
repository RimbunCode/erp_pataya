<?php

namespace App\Services\Finances\Posting;

use App\Exceptions\Finances\DuplicatePostingException;
use App\Exceptions\Finances\PartialPostingException;
use App\Models\Finances\Journal;
use App\Services\Finances\Ledger\JournalDraft;
use App\Services\Finances\Ledger\JournalLineDraft;
use App\Services\Finances\Ledger\JournalService;
use App\Services\Finances\Ledger\MinorUnit;
use App\Services\Finances\Posting\Contexts\PostingContext;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use LogicException;
use RangeException;

/**
 * Satu panggilan untuk memposting konteks (Finance Fase 2, Requirement 5): menjalankan `PostingRule`, me-resolve peran
 * menjadi akun lewat `AccountRoleResolver`, lalu menulis lewat `JournalService::post()`.
 *
 * - `preview()` membentuk draft beserta akun nyata tanpa menulis (dipakai mode `shadow` dan panel "Akun pencatatan").
 * - `post()` atomik untuk seluruh jurnal satu konteks dan idempoten: semua `postingKey` sudah ada -> mengembalikan
 *   jurnal yang ada tanpa menulis (dan tanpa me-resolve akun); sebagian ada -> `PartialPostingException`. Sumber yang
 *   berstatus `canceled` dilewati (guard F-16).
 *
 * `postingKey` = `{sourceType}:{sourceId}:{purpose}` dengan `sourceType` berupa `getMorphClass()` dokumen sumber,
 * sama dengan kunci `JournalService::postPair()`. Jurnal yang nol setelah pembulatan ke minor unit tidak dibuat
 * (Fase 1 Requirement 2.10). Baris peka-barang dengan akun dan sisi yang sama digabung (Requirement 12.4); sisa
 * pembulatan antarbaris diserap baris terbesar pada sisi yang terpecah agar jurnal tetap seimbang (P-12).
 * Tidak boleh mengimpor model Sales/Purchase/Inventory/Asset (P-8).
 */
final class PostingService {
    public function __construct(
        private readonly PostingRuleRegistry $rules,
        private readonly AccountRoleResolver $resolver,
        private readonly JournalService $journals,
        private readonly CanceledSourceGuard $guard,
    ) {}

    /**
     * @return list<JournalDraft>
     */
    public function preview(PostingContext $ctx): array {
        $minorUnit = $this->journals->baseCurrency()[1];

        return $this->resolveDrafts($ctx, $this->roleDrafts($ctx, $minorUnit), $minorUnit);
    }

    /**
     * `purpose` yang dimiliki konteks ini menurut rule, sebelum jurnal nol-setelah-pembulatan dibuang. Dipakai
     * `ParityComparator` agar hanya jurnal milik konteks yang dibandingkan (mis. satu aset dijual lewat dua baris
     * invoice, masing-masing `disposal:{id}`).
     *
     * @return list<string>
     */
    public function purposes(PostingContext $ctx): array {
        return array_map(
            static fn (RoleJournalDraft $draft): string => $draft->purpose,
            $this->rules->for($ctx->documentType)->build($ctx),
        );
    }

    /**
     * Hasil terstruktur (Q-P2-12): `posted` (jurnal baru atau tidak ada yang perlu ditulis), `already_posted` (semua
     * jurnal sudah ada; pemanggil tidak boleh mengulang efek samping non-idempoten), `skipped` (penjaga `canceled`).
     */
    public function post(PostingContext $ctx, bool $checkCanceled = true): PostingOutcome {
        return DB::transaction(function () use ($ctx, $checkCanceled): PostingOutcome {
            // Guard di dalam transaksi dan membaca sumber dengan kunci baris (lihat CanceledSourceGuard) agar
            // pembatalan yang bersamaan menunggu, bukan menyelip di antara pemeriksaan dan penulisan.
            if ($checkCanceled && $this->guard->skipIfCanceled($ctx)) {
                return PostingOutcome::skipped();
            }

            $minorUnit  = $this->journals->baseCurrency()[1];
            $roleDrafts = $this->roleDrafts($ctx, $minorUnit);
            if ($roleDrafts === []) {
                return PostingOutcome::posted();
            }

            $keys     = array_map(fn (RoleJournalDraft $draft): string => $this->postingKey($ctx, $draft), $roleDrafts);
            $existing = $this->existingJournals($keys);

            if ($existing->isNotEmpty()) {
                return PostingOutcome::alreadyPosted($this->existingOrPartial($ctx, $keys, $existing));
            }

            $journals = [];
            foreach ($this->resolveDrafts($ctx, $roleDrafts, $minorUnit) as $draft) {
                try {
                    $journals[] = $this->journals->post($draft);
                } catch (DuplicatePostingException) {
                    // Balapan: proses lain menulis kunci ini setelah pra-pemeriksaan. Evaluasi ulang: semua ada ->
                    // already_posted; sebagian -> PartialPostingException (menggulung transaksi ini).
                    return PostingOutcome::alreadyPosted($this->existingOrPartial($ctx, $keys, $this->existingJournals($keys, lock: true)));
                }
            }

            return PostingOutcome::posted($journals);
        });
    }

    /**
     * `$lock`: current read (`FOR UPDATE`) untuk jalur setelah `DuplicatePostingException`; pada MySQL REPEATABLE READ
     * SELECT biasa tidak melihat commit proses lain, sehingga kunci yang baru ditulis lawan tampak hilang dan memicu
     * `PartialPostingException` palsu (Requirement 5.4).
     *
     * @param  list<string>  $keys
     * @return Collection<string, Journal>
     */
    private function existingJournals(array $keys, bool $lock = false): Collection {
        $query = Journal::query()->withoutGlobalScopes()->whereIn('posting_key', $keys);

        return ($lock ? $query->lockForUpdate() : $query)->get()->keyBy('posting_key');
    }

    /**
     * @param  list<string>  $keys
     * @param  Collection<string, Journal>  $existing
     * @return list<Journal>
     *
     * @throws PartialPostingException
     */
    private function existingOrPartial(PostingContext $ctx, array $keys, Collection $existing): array {
        if ($existing->count() === \count($keys)) {
            return array_map(fn (string $key): Journal => $existing->get($key), $keys);
        }

        $present = array_values(array_filter($keys, fn (string $key): bool => $existing->has($key)));

        throw PartialPostingException::for($ctx->sourceType, $ctx->sourceId, $present, array_values(array_diff($keys, $present)));
    }

    /**
     * Jurnal berperan hasil rule, tanpa jurnal yang nol setelah pembulatan.
     *
     * @return list<RoleJournalDraft>
     */
    private function roleDrafts(PostingContext $ctx, int $minorUnit): array {
        $drafts = [];
        $seen   = [];

        foreach ($this->rules->for($ctx->documentType)->build($ctx) as $draft) {
            if (isset($seen[$draft->purpose])) {
                throw new LogicException("Posting rule for [{$ctx->documentType->value}] produced duplicate purpose [{$draft->purpose}].");
            }
            $seen[$draft->purpose] = true;

            if ($this->isZeroAfterRounding($draft, $minorUnit)) {
                continue;
            }

            $drafts[] = $draft;
        }

        return $drafts;
    }

    private function isZeroAfterRounding(RoleJournalDraft $draft, int $minorUnit): bool {
        try {
            foreach ($draft->lines as $line) {
                if (! is_numeric($line->amount) || (float) $line->amount < 0 || MinorUnit::toMinor($line->amount, $minorUnit) !== 0) {
                    return false;
                }
            }
        } catch (RangeException) {
            return false; // `JournalService::post()` menolaknya dengan pesan baris.
        }

        return true;
    }

    /**
     * @param  list<RoleJournalDraft>  $roleDrafts
     * @return list<JournalDraft>
     */
    private function resolveDrafts(PostingContext $ctx, array $roleDrafts, int $minorUnit): array {
        return array_map(fn (RoleJournalDraft $draft): JournalDraft => new JournalDraft(
            transactionDate: $ctx->transactionDate,
            lines: $this->resolveLines($ctx, $draft, $minorUnit),
            postingKey: $this->postingKey($ctx, $draft),
            branchId: $ctx->branchId,
            description: $draft->description ?? $ctx->description,
            sourceType: $ctx->sourceType,
            sourceId: $ctx->sourceId,
        ), $roleDrafts);
    }

    private function postingKey(PostingContext $ctx, RoleJournalDraft $draft): string {
        return "{$ctx->sourceType}:{$ctx->sourceId}:{$draft->purpose}";
    }

    /**
     * Resolve peran tiap baris, gabungkan baris beraccount dan sisi sama, bulatkan, serap sisa pembulatan.
     *
     * @return list<JournalLineDraft>
     */
    private function resolveLines(PostingContext $ctx, RoleJournalDraft $draft, int $minorUnit): array {
        /** @var array<string, array{account: string, side: string, amount: float, description: ?string}> $groups */
        $groups = [];

        foreach ($draft->lines as $line) {
            $account = $this->resolver->resolve($line->role, $ctx, $line->line);
            $key     = $line->side . '|' . $account->getKey();

            $groups[$key] ??= ['account' => (string) $account->getKey(), 'side' => $line->side, 'amount' => 0.0, 'description' => $line->description];
            $groups[$key]['amount'] += (float) $line->amount;
        }

        foreach ($groups as $key => $group) {
            $groups[$key]['amount'] = MinorUnit::round($group['amount'], $minorUnit);
            if (MinorUnit::toMinor($groups[$key]['amount'], $minorUnit) === 0) {
                unset($groups[$key]); // baris nol setelah pembulatan tidak dapat ditulis (validator menolak baris tanpa jumlah)
            }
        }

        $groups = $this->absorbRounding($groups, $minorUnit);

        $debitAccounts  = array_values(array_unique(array_column(array_filter($groups, fn (array $g): bool => $g['side'] === RoleLine::DEBIT), 'account')));
        $creditAccounts = array_values(array_unique(array_column(array_filter($groups, fn (array $g): bool => $g['side'] === RoleLine::CREDIT), 'account')));

        $lines = [];
        foreach ($groups as $group) {
            $debit   = $group['side'] === RoleLine::DEBIT;
            $against = $debit ? $creditAccounts : $debitAccounts;

            $lines[] = new JournalLineDraft(
                accountId: $group['account'],
                debit: $debit ? $group['amount'] : 0,
                credit: $debit ? 0 : $group['amount'],
                description: $group['description'],
                againstAccountId: \count($against) === 1 ? $against[0] : null,
            );
        }

        return $lines;
    }

    /**
     * Penjumlahan baris yang sudah dibulatkan satu per satu dapat berbeda satu-dua minor unit dari sisi lawannya.
     * Selisih kecil (tidak melebihi jumlah kelompok pada sisi yang terpecah) diserap kelompok terbesar sisi itu;
     * selisih lain dibiarkan agar `JournalService` menolaknya sebagai tak seimbang.
     *
     * @param  array<string, array{account: string, side: string, amount: float, description: ?string}>  $groups
     * @return array<string, array{account: string, side: string, amount: float, description: ?string}>
     */
    private function absorbRounding(array $groups, int $minorUnit): array {
        $totals = [RoleLine::DEBIT => 0, RoleLine::CREDIT => 0];
        $counts = [RoleLine::DEBIT => 0, RoleLine::CREDIT => 0];
        foreach ($groups as $group) {
            $totals[$group['side']] += MinorUnit::toMinor($group['amount'], $minorUnit);
            $counts[$group['side']]++;
        }

        $difference = $totals[RoleLine::DEBIT] - $totals[RoleLine::CREDIT];
        if ($difference === 0) {
            return $groups;
        }

        $splitSide = $counts[RoleLine::CREDIT] > $counts[RoleLine::DEBIT] ? RoleLine::CREDIT : RoleLine::DEBIT;
        if ($counts[$splitSide] < 2 || abs($difference) > $counts[$splitSide]) {
            return $groups;
        }

        $largestKey = null;
        foreach ($groups as $key => $group) {
            if ($group['side'] === $splitSide && ($largestKey === null || $group['amount'] > $groups[$largestKey]['amount'])) {
                $largestKey = $key;
            }
        }

        // Selisih > 0: debit lebih besar. Pada sisi debit kurangi, pada sisi kredit tambah; kebalikannya bila < 0.
        $shift                         = $splitSide === RoleLine::DEBIT ? -$difference : $difference;
        $adjusted                      = MinorUnit::toMinor($groups[$largestKey]['amount'], $minorUnit) + $shift;
        $groups[$largestKey]['amount'] = (float) MinorUnit::fromMinor($adjusted, $minorUnit);

        return $groups;
    }
}
