<?php

namespace App\Services\Finances\Posting;

use App\Enums\AccountRole;
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
 * - `preview()` membentuk draft beserta akun nyata tanpa menulis (dipakai panel "Akun pencatatan").
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
        private readonly ?PostedAccountRecorderRegistry $recorders = null,
    ) {}

    /**
     * @return list<JournalDraft>
     */
    public function preview(PostingContext $ctx): array {
        $minorUnit = $this->journals->baseCurrency()[1];

        return $this->resolveDrafts($ctx, $this->roleDrafts($ctx, $minorUnit), $minorUnit)[0];
    }

    /**
     * Akun yang akan dipakai `post()` untuk konteks ini, per baris peran, tanpa menulis apa pun (Requirement 13.4).
     * Memakai resolusi yang sama dengan `preview()` dan `post()`; dipakai panel "Akun pencatatan" yang butuh peran dan
     * baris dokumen sumber, yang tidak ada pada draf jurnal.
     */
    public function previewAccounts(PostingContext $ctx): PostedAccountNotes {
        $minorUnit = $this->journals->baseCurrency()[1];

        return $this->resolveDrafts($ctx, $this->roleDrafts($ctx, $minorUnit), $minorUnit)[1];
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

            // Resolusi akun sekali per post; catatan akun dipakai recorder untuk menulis balik ke dokumen sumber.
            [$drafts, $notes] = $this->resolveDrafts($ctx, $roleDrafts, $minorUnit);

            $journals = [];
            foreach ($drafts as $draft) {
                try {
                    $journals[] = $this->journals->post($draft);
                } catch (DuplicatePostingException) {
                    // Balapan: proses lain menulis kunci ini setelah pra-pemeriksaan. Evaluasi ulang: semua ada ->
                    // already_posted; sebagian -> PartialPostingException (menggulung transaksi ini).
                    return PostingOutcome::alreadyPosted($this->existingOrPartial($ctx, $keys, $this->existingJournals($keys, lock: true)));
                }
            }

            // Di dalam transaksi yang sama dengan jurnal: kegagalan recorder menggulung semuanya (Requirement 13.2).
            $this->recorders?->record($ctx, $notes);

            return PostingOutcome::posted($journals, $notes);
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
     * @return array{0: list<JournalDraft>, 1: PostedAccountNotes} draf jurnal dan catatan akun hasil resolve
     */
    private function resolveDrafts(PostingContext $ctx, array $roleDrafts, int $minorUnit): array {
        $drafts = [];
        $notes  = [];

        foreach ($roleDrafts as $draft) {
            $drafts[] = new JournalDraft(
                transactionDate: $ctx->transactionDate,
                lines: $this->resolveLines($ctx, $draft, $minorUnit, $notes),
                postingKey: $this->postingKey($ctx, $draft),
                branchId: $ctx->branchId,
                description: $draft->description ?? $ctx->description,
                sourceType: $ctx->sourceType,
                sourceId: $ctx->sourceId,
                discountSplit: $this->hasDiscountRole($draft),
            );
        }

        return [$drafts, new PostedAccountNotes($notes)];
    }

    /**
     * Bentuk jurnal yang direkam ke `journals.discount_split` (Requirement 14.8): true bila drafnya memuat baris berperan
     * `discount`, yaitu bentuk posting diskon terpisah. Dibaca retur invoice sebagai bentuk invoice ASAL.
     */
    private function hasDiscountRole(RoleJournalDraft $draft): bool {
        foreach ($draft->lines as $line) {
            if ($line->roleValue() === AccountRole::Discount->value) {
                return true;
            }
        }

        return false;
    }

    private function postingKey(PostingContext $ctx, RoleJournalDraft $draft): string {
        return "{$ctx->sourceType}:{$ctx->sourceId}:{$draft->purpose}";
    }

    /**
     * Resolve peran tiap baris, gabungkan baris beraccount dan sisi sama, bulatkan, serap sisa pembulatan.
     *
     * @param  list<PostedAccountNote>  $notes  diisi per baris peran, sebelum penggabungan
     * @return list<JournalLineDraft>
     */
    private function resolveLines(PostingContext $ctx, RoleJournalDraft $draft, int $minorUnit, array &$notes): array {
        /** @var array<string, array{account: string, side: string, amount: float, description: ?string, roles: list<string>}> $groups */
        $groups = [];

        foreach ($draft->lines as $line) {
            $account = $this->resolver->resolve($line->role, $ctx, $line->line);
            $notes[] = new PostedAccountNote($draft->purpose, $line->roleValue(), (string) $account->getKey(), $line->line?->lineId);
            // Baris pajak (versi aturan terisi) tidak digabung dengan versi lain walau akunnya sama (Finance Fase 3, Req. 5.4).
            $key = $line->side . '|' . $account->getKey() . ($line->taxRuleVersionId !== null ? '|' . $line->taxRuleVersionId : '');

            $groups[$key] ??= ['account' => (string) $account->getKey(), 'side' => $line->side, 'amount' => 0.0, 'description' => $line->description, 'roles' => [], 'taxRuleVersionId' => $line->taxRuleVersionId];
            $groups[$key]['amount'] += (float) $line->amount;
            if (! \in_array($line->roleValue(), $groups[$key]['roles'], true)) {
                $groups[$key]['roles'][] = $line->roleValue();
            }
        }

        $discountSplit = false;
        $sideCounts    = [RoleLine::DEBIT => 0, RoleLine::CREDIT => 0];
        $rawSideTotals = [RoleLine::DEBIT => 0.0, RoleLine::CREDIT => 0.0];
        foreach ($groups as $group) {
            $sideCounts[$group['side']]++;
            $rawSideTotals[$group['side']] += $group['amount'];
            $discountSplit = $discountSplit || \in_array(AccountRole::Discount->value, $group['roles'], true);
        }

        foreach ($groups as $key => $group) {
            $groups[$key]['amount'] = MinorUnit::round($group['amount'], $minorUnit);
            if (MinorUnit::toMinor($groups[$key]['amount'], $minorUnit) === 0) {
                unset($groups[$key]); // baris nol setelah pembulatan tidak dapat ditulis (validator menolak baris tanpa jumlah)
            }
        }

        $groups = $discountSplit
            ? $this->absorbDiscountSplitRounding($groups, $minorUnit, max($sideCounts))
            : $this->absorbRounding($this->alignSideTotals($groups, $rawSideTotals, $minorUnit), $minorUnit);

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
                taxRuleVersionId: $group['taxRuleVersionId'],
            );
        }

        return $lines;
    }

    /**
     * Total tiap sisi jurnal harus sama dengan jumlah baris sumber yang dibulatkan sekali (P-12), walau sisi itu
     * terpecah menjadi beberapa kelompok akun yang masing-masing dibulatkan sendiri. Selisih kecil (tidak melebihi
     * jumlah kelompok pada sisi itu) diserap kelompok terbesar sisi tersebut; selisih lain dibiarkan.
     *
     * @param  array<string, array{account: string, side: string, amount: float, description: ?string, roles: list<string>}>  $groups
     * @param  array<string, float>  $rawSideTotals  jumlah mentah per sisi sebelum pembulatan kelompok
     * @return array<string, array{account: string, side: string, amount: float, description: ?string, roles: list<string>}>
     */
    private function alignSideTotals(array $groups, array $rawSideTotals, int $minorUnit): array {
        foreach ([RoleLine::DEBIT, RoleLine::CREDIT] as $side) {
            $keys = array_keys(array_filter($groups, static fn (array $g): bool => $g['side'] === $side));
            if (\count($keys) < 2) {
                continue;
            }

            $current = 0;
            foreach ($keys as $key) {
                $current += MinorUnit::toMinor($groups[$key]['amount'], $minorUnit);
            }
            $delta = MinorUnit::toMinor(MinorUnit::round($rawSideTotals[$side], $minorUnit), $minorUnit) - $current;
            if ($delta === 0 || abs($delta) > \count($keys)) {
                continue;
            }

            $largestKey = $this->largestGroupKey($groups, $side, protectNet: false);
            if ($largestKey === null) {
                continue;
            }
            $adjusted = MinorUnit::toMinor($groups[$largestKey]['amount'], $minorUnit) + $delta;
            if ($adjusted <= 0) {
                continue;
            }
            $groups[$largestKey]['amount'] = (float) MinorUnit::fromMinor($adjusted, $minorUnit);
        }

        return $groups;
    }

    /**
     * Penjumlahan baris yang sudah dibulatkan satu per satu dapat berbeda satu-dua minor unit dari sisi lawannya.
     * Selisih kecil (tidak melebihi jumlah kelompok pada sisi yang terpecah) diserap kelompok terbesar sisi itu;
     * selisih lain dibiarkan agar `JournalService` menolaknya sebagai tak seimbang. Jurnal yang memuat peran `discount`
     * (posting diskon terpisah) memakai `absorbDiscountSplitRounding()`.
     *
     * @param  array<string, array{account: string, side: string, amount: float, description: ?string, roles: list<string>}>  $groups
     * @return array<string, array{account: string, side: string, amount: float, description: ?string, roles: list<string>}>
     */
    private function absorbRounding(array $groups, int $minorUnit): array {
        [$difference, $counts] = $this->imbalance($groups, $minorUnit);
        if ($difference === 0) {
            return $groups;
        }

        $splitSide = $counts[RoleLine::CREDIT] > $counts[RoleLine::DEBIT] ? RoleLine::CREDIT : RoleLine::DEBIT;
        if ($counts[$splitSide] < 2 || abs($difference) > $counts[$splitSide]) {
            return $groups;
        }

        $largestKey = $this->largestGroupKey($groups, $splitSide, protectNet: false);
        if ($largestKey === null) {
            return $groups;
        }

        $adjusted                      = MinorUnit::toMinor($groups[$largestKey]['amount'], $minorUnit) + $this->shiftFor($splitSide, $difference);
        $groups[$largestKey]['amount'] = (float) MinorUnit::fromMinor($adjusted, $minorUnit);

        return $groups;
    }

    /**
     * Pembulatan jurnal posting diskon terpisah (Requirement 14, P-13): kelompok `receivable`/`payable` TIDAK boleh
     * menyerap sisa (jumlahnya harus sama dengan total dokumen). Sisa diserap kelompok terbesar lain pada sisi yang
     * terpecah (diskon, atau akun pendapatan/biaya); bila kelompok itu tidak dapat menyerap (jumlah jadi nol/negatif),
     * atau tidak ada (kelompok `discount` hilang karena nol setelah pembulatan, sehingga sisi itu hanya berisi
     * piutang/utang), kelompok terbesar pada sisi lawan menyerapnya. Batas selisih: jumlah kelompok terbanyak per sisi
     * SEBELUM kelompok nol dibuang (`$sideLimit`); selisih lebih besar dibiarkan agar `JournalService` menolaknya.
     *
     * @param  array<string, array{account: string, side: string, amount: float, description: ?string, roles: list<string>}>  $groups
     * @return array<string, array{account: string, side: string, amount: float, description: ?string, roles: list<string>}>
     */
    private function absorbDiscountSplitRounding(array $groups, int $minorUnit, int $sideLimit): array {
        [$difference, $counts] = $this->imbalance($groups, $minorUnit);
        if ($difference === 0 || abs($difference) > $sideLimit) {
            return $groups;
        }

        $splitSide = $counts[RoleLine::CREDIT] > $counts[RoleLine::DEBIT] ? RoleLine::CREDIT : RoleLine::DEBIT;
        $otherSide = $splitSide === RoleLine::DEBIT ? RoleLine::CREDIT : RoleLine::DEBIT;

        foreach ([$splitSide, $otherSide] as $side) {
            $key = $this->largestGroupKey($groups, $side, protectNet: true);
            if ($key === null) {
                continue;
            }

            $adjusted = MinorUnit::toMinor($groups[$key]['amount'], $minorUnit) + $this->shiftFor($side, $difference);
            if ($adjusted <= 0) {
                continue; // tidak menulis baris nol/negatif; coba sisi lawan, atau biarkan JournalService menolaknya
            }

            $groups[$key]['amount'] = (float) MinorUnit::fromMinor($adjusted, $minorUnit);

            return $groups;
        }

        return $groups;
    }

    /**
     * @param  array<string, array{account: string, side: string, amount: float, description: ?string, roles: list<string>}>  $groups
     * @return array{0: int, 1: array<string, int>} selisih debit - kredit (minor unit) dan jumlah kelompok per sisi
     */
    private function imbalance(array $groups, int $minorUnit): array {
        $totals = [RoleLine::DEBIT => 0, RoleLine::CREDIT => 0];
        $counts = [RoleLine::DEBIT => 0, RoleLine::CREDIT => 0];
        foreach ($groups as $group) {
            $totals[$group['side']] += MinorUnit::toMinor($group['amount'], $minorUnit);
            $counts[$group['side']]++;
        }

        return [$totals[RoleLine::DEBIT] - $totals[RoleLine::CREDIT], $counts];
    }

    /**
     * Kelompok terbesar pada `$side`; `$protectNet` melewati kelompok `receivable`/`payable`.
     *
     * @param  array<string, array{account: string, side: string, amount: float, description: ?string, roles: list<string>}>  $groups
     */
    private function largestGroupKey(array $groups, string $side, bool $protectNet): ?string {
        // Baris pajak terpisah tidak menyerap sisa pembulatan selama ada kelompok lain: jumlah pajak harus tetap sama
        // dengan nilai tersimpan, sisanya diserap baris pendapatan/beban (Finance Fase 3, Requirement 7.4 dan 8.2).
        return $this->largestGroupKeyAmong($groups, $side, $protectNet, excludeTax: true)
            ?? $this->largestGroupKeyAmong($groups, $side, $protectNet, excludeTax: false);
    }

    /**
     * @param  array<string, array{account: string, side: string, amount: float, description: ?string, roles: list<string>, taxRuleVersionId: ?string}>  $groups
     */
    private function largestGroupKeyAmong(array $groups, string $side, bool $protectNet, bool $excludeTax): ?string {
        $largestKey = null;
        foreach ($groups as $key => $group) {
            if ($group['side'] !== $side) {
                continue;
            }
            if ($excludeTax && ($group['taxRuleVersionId'] ?? null) !== null) {
                continue;
            }
            if ($protectNet && array_intersect($group['roles'], [AccountRole::Receivable->value, AccountRole::Payable->value]) !== []) {
                continue;
            }
            if ($largestKey === null || $group['amount'] > $groups[$largestKey]['amount']) {
                $largestKey = (string) $key;
            }
        }

        return $largestKey;
    }

    /**
     * Selisih > 0: debit lebih besar. Pada sisi debit kurangi, pada sisi kredit tambah; kebalikannya bila < 0.
     */
    private function shiftFor(string $side, int $difference): int {
        return $side === RoleLine::DEBIT ? -$difference : $difference;
    }
}
