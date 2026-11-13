<?php

namespace App\Services\Finances\Posting;

use App\Models\Finances\Journal;
use App\Models\Finances\PostingParityLog;
use App\Services\Finances\Ledger\JournalDraft;
use App\Services\Finances\Ledger\JournalReversalService;
use App\Services\Finances\Ledger\JournalService;
use App\Services\Finances\Ledger\MinorUnit;
use App\Services\Finances\Posting\Contexts\PostingContext;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Throwable;

/**
 * Membandingkan jurnal jalur lama dengan hasil engine pada mode `shadow` (Finance Fase 2, Requirement 6.5-6.6).
 *
 * Representasi kanonik per `purpose`: tanggal (hari, zona penyimpanan) dan daftar terurut `(account_id, debit_minor,
 * credit_minor)`. Status per jurnal, lalu gabungan dengan prioritas `mismatch` > `config_diff` > `rounding` > `match`:
 *
 * - `match`: identik.
 * - `rounding`: akun dan jumlah baris sama, selisih nilai paling banyak satu minor unit per baris.
 * - `config_diff`: nilai (debit/kredit) sama tetapi akun berbeda; satu-satunya perbedaan adalah akun yang dipilih
 *   pengguna pada dokumen lama versus hasil konfigurasi. Akun kedua sisi disimpan pada `diff`.
 * - `mismatch`: selainnya, termasuk kumpulan `purpose` jurnal yang berbeda dan tanggal berbeda.
 *
 * `compare()` murni (tanpa DB) agar dapat diuji tanpa database; `record()`/`recordEngineError()` memuat jurnal lama
 * dan menulis `posting_parity_logs`.
 */
final class ParityComparator {
    /**
     * @param  array<string, array{date: string, lines: list<array{account_id: string, debit: int, credit: int}>}>  $legacy
     * @param  array<string, array{date: string, lines: list<array{account_id: string, debit: int, credit: int}>}>  $engine
     */
    public function compare(array $legacy, array $engine, ?string $documentType = null): ParityResult {
        $diff     = [];
        $statuses = [];

        $missing = array_values(array_diff(array_keys($legacy), array_keys($engine)));
        $extra   = array_values(array_diff(array_keys($engine), array_keys($legacy)));
        if ($missing !== [] || $extra !== []) {
            $diff['purposes'] = ['missing_in_engine' => $missing, 'extra_in_engine' => $extra];
            $statuses[]       = PostingParityLog::STATUS_MISMATCH;
        }

        foreach (array_intersect(array_keys($legacy), array_keys($engine)) as $purpose) {
            [$status, $detail] = $this->comparePurpose($legacy[$purpose], $engine[$purpose], $documentType, (string) $purpose);
            if ($status !== PostingParityLog::STATUS_MATCH) {
                $diff[$purpose] = $detail;
            }
            $statuses[] = $status;
        }

        foreach ([PostingParityLog::STATUS_MISMATCH, PostingParityLog::STATUS_CONFIG_DIFF, PostingParityLog::STATUS_ROUNDING] as $status) {
            if (\in_array($status, $statuses, true)) {
                return new ParityResult($status, $legacy, $engine, $diff);
            }
        }

        return new ParityResult(PostingParityLog::STATUS_MATCH, $legacy, $engine);
    }

    /**
     * Bandingkan jurnal jalur lama dokumen `$ctx` dengan draft engine dan catat hasilnya.
     *
     * @param  list<JournalDraft>  $drafts  hasil `PostingService::preview()`
     * @param  list<string>|null  $purposes  `purpose` milik konteks (`PostingService::purposes()`); jurnal lama lain
     *                                       dari sumber yang sama (mis. disposal baris invoice lain) tidak dibandingkan
     */
    public function record(PostingContext $ctx, array $drafts, ?array $purposes = null): PostingParityLog {
        $result = $this->compare($this->legacyOf($ctx, $purposes), $this->engineOf($ctx, $drafts), $ctx->documentType->value);

        return PostingParityLog::forceCreate([
            'document_type' => $ctx->documentType->value,
            'source_type'   => $ctx->sourceType,
            'source_id'     => $ctx->sourceId,
            'status'        => $result->status,
            'legacy'        => $result->legacy,
            'engine'        => $result->engine,
            'diff'          => $result->diff === [] ? null : $result->diff,
        ]);
    }

    /**
     * Mencatat kegagalan engine pada mode `shadow` (Requirement 6.3): tanpa sisi engine.
     */
    public function recordEngineError(PostingContext $ctx, Throwable $error, ?array $purposes = null): PostingParityLog {
        return PostingParityLog::forceCreate([
            'document_type' => $ctx->documentType->value,
            'source_type'   => $ctx->sourceType,
            'source_id'     => $ctx->sourceId,
            'status'        => PostingParityLog::STATUS_ENGINE_ERR,
            'legacy'        => $this->legacyOf($ctx, $purposes),
            'engine'        => null,
            'diff'          => ['error' => $error::class, 'message' => $error->getMessage()],
        ]);
    }

    /**
     * @return array<string, array{date: string, lines: list<array{account_id: string, debit: int, credit: int}>}>
     */
    public function legacyOf(PostingContext $ctx, ?array $purposes = null): array {
        $minorUnit = app(JournalService::class)->baseCurrency()[1];
        $prefix    = "{$ctx->sourceType}:{$ctx->sourceId}:";

        // Tanpa LIKE: karakter escape pada FQCN (`\`) tidak portabel antar mesin basis data.
        $journals = Journal::query()
            ->withoutGlobalScopes()
            ->where('source_type', $ctx->sourceType)
            ->where('source_id', $ctx->sourceId)
            ->where('status', 'posted')
            ->with('lines')
            ->get()
            ->filter(fn (Journal $journal): bool => str_starts_with((string) $journal->posting_key, $prefix)
                && ! str_ends_with((string) $journal->posting_key, ':' . JournalReversalService::REVERSAL_PURPOSE));

        $result = [];
        foreach ($journals as $journal) {
            $lines = [];
            foreach ($journal->lines as $line) {
                $lines[] = [
                    'account_id' => (string) $line->account_id,
                    'debit'      => MinorUnit::toMinor((float) $line->debit, $minorUnit),
                    'credit'     => MinorUnit::toMinor((float) $line->credit, $minorUnit),
                ];
            }

            $purpose = substr((string) $journal->posting_key, \strlen($prefix));
            if ($purposes !== null && ! \in_array($purpose, $purposes, true)) {
                continue;
            }

            $result[$purpose] = [
                'date'  => $this->day($journal->transaction_date),
                'lines' => $this->sorted($lines),
            ];
        }

        ksort($result);

        return $result;
    }

    /**
     * @param  list<JournalDraft>  $drafts
     * @return array<string, array{date: string, lines: list<array{account_id: string, debit: int, credit: int}>}>
     */
    public function engineOf(PostingContext $ctx, array $drafts): array {
        $minorUnit = app(JournalService::class)->baseCurrency()[1];
        $prefix    = "{$ctx->sourceType}:{$ctx->sourceId}:";

        $result = [];
        foreach ($drafts as $draft) {
            $lines = [];
            foreach ($draft->lines as $line) {
                $lines[] = [
                    'account_id' => $line->accountId,
                    'debit'      => MinorUnit::toMinor($line->debit, $minorUnit),
                    'credit'     => MinorUnit::toMinor($line->credit, $minorUnit),
                ];
            }

            $result[substr((string) $draft->postingKey, \strlen($prefix))] = [
                'date'  => $this->day($draft->transactionDate),
                'lines' => $this->sorted($lines),
            ];
        }

        ksort($result);

        return $result;
    }

    /**
     * @param  array{date: string, lines: list<array{account_id: string, debit: int, credit: int}>}  $legacy
     * @param  array{date: string, lines: list<array{account_id: string, debit: int, credit: int}>}  $engine
     * @return array{0: string, 1: array<string, mixed>}
     */
    private function comparePurpose(array $legacy, array $engine, ?string $documentType, string $purpose): array {
        if ($legacy['date'] !== $engine['date']) {
            return [PostingParityLog::STATUS_MISMATCH, ['reason' => 'date', 'legacy' => $legacy['date'], 'engine' => $engine['date']]];
        }

        if ($legacy['lines'] === $engine['lines']) {
            return [PostingParityLog::STATUS_MATCH, []];
        }

        $a = $legacy['lines'];
        $b = $engine['lines'];

        if (\count($a) === \count($b)) {
            // Rounding: akun sama (urut akun, lalu jumlah), selisih <= 1 minor unit per baris.
            if (array_column($a, 'account_id') === array_column($b, 'account_id') && $this->withinOneMinor($a, $b)) {
                return [PostingParityLog::STATUS_ROUNDING, ['reason' => 'rounding']];
            }

            // Config diff: hanya pada jurnal yang akunnya dipilih pengguna pada dokumen lama, dan hanya bila setiap
            // akun yang ada di kedua sisi tetap pada sisi dan jumlah yang sama (tidak tertukar/berpermutasi).
            if ($this->userChosenAccounts($documentType, $purpose) && ($diff = $this->accountOnlyDiff($a, $b)) !== null) {
                return [PostingParityLog::STATUS_CONFIG_DIFF, ['reason' => 'accounts', ...$diff]];
            }
        }

        return [PostingParityLog::STATUS_MISMATCH, ['reason' => 'lines']];
    }

    /**
     * Jurnal yang akunnya dipilih pengguna pada dokumen lama (Requirement 13.1): Sales Invoice, Purchase Invoice
     * (jurnal `expense`), Payment Entry, Stock Entry (termasuk biaya tambahan), dan Asset Value Adjustment. Dokumen
     * lain memakai pencarian `account_type`/akun master, sehingga beda akun di sana adalah `mismatch`.
     */
    private function userChosenAccounts(?string $documentType, string $purpose): bool {
        return match ($documentType) {
            'sales_invoice', 'payment_entry', 'stock_entry', 'asset_value_adjustment' => true,
            'purchase_invoice'                                                        => $purpose === 'expense',
            default                                                                   => false,
        };
    }

    /**
     * Bila perbedaan hanya akun (akun bersama identik pada sisi dan jumlah, akun yang berbeda membawa jumlah
     * yang sama), kembalikan akun kedua sisi; selain itu null.
     *
     * @param  list<array{account_id: string, debit: int, credit: int}>  $a
     * @param  list<array{account_id: string, debit: int, credit: int}>  $b
     * @return array{legacy_accounts: list<string>, engine_accounts: list<string>}|null
     */
    private function accountOnlyDiff(array $a, array $b): ?array {
        $byAccount = static function (array $lines): array {
            $map = [];
            foreach ($lines as $line) {
                $map[$line['account_id']][] = [$line['debit'], $line['credit']];
            }
            foreach ($map as &$entries) {
                sort($entries);
            }

            return $map;
        };

        $ma = $byAccount($a);
        $mb = $byAccount($b);

        foreach (array_intersect_key($ma, $mb) as $account => $entries) {
            if ($entries !== $mb[$account]) {
                return null; // sisi/jumlah akun yang sama berubah (tertukar atau berpermutasi)
            }
        }

        $restA = array_values(array_filter($a, static fn (array $l): bool => ! isset($mb[$l['account_id']])));
        $restB = array_values(array_filter($b, static fn (array $l): bool => ! isset($ma[$l['account_id']])));

        if ($restA === [] || $this->amountsOf($restA) !== $this->amountsOf($restB)) {
            return null;
        }

        return ['legacy_accounts' => array_column($restA, 'account_id'), 'engine_accounts' => array_column($restB, 'account_id')];
    }

    /**
     * @param  list<array{account_id: string, debit: int, credit: int}>  $a
     * @param  list<array{account_id: string, debit: int, credit: int}>  $b
     */
    private function withinOneMinor(array $a, array $b): bool {
        foreach ($a as $i => $line) {
            if (abs($line['debit'] - $b[$i]['debit']) > 1 || abs($line['credit'] - $b[$i]['credit']) > 1) {
                return false;
            }
        }

        return true;
    }

    /**
     * @param  list<array{account_id: string, debit: int, credit: int}>  $lines
     * @return list<array{debit: int, credit: int}>
     */
    private function amountsOf(array $lines): array {
        $amounts = array_map(static fn (array $line): array => ['debit' => $line['debit'], 'credit' => $line['credit']], $lines);
        usort($amounts, static fn (array $x, array $y): int => [$x['debit'], $x['credit']] <=> [$y['debit'], $y['credit']]);

        return $amounts;
    }

    /**
     * @param  list<array{account_id: string, debit: int, credit: int}>  $lines
     * @return list<array{account_id: string, debit: int, credit: int}>
     */
    private function sorted(array $lines): array {
        usort($lines, static fn (array $x, array $y): int => [$x['account_id'], $x['debit'], $x['credit']] <=> [$y['account_id'], $y['debit'], $y['credit']]);

        return $lines;
    }

    private function day(CarbonInterface|string $date): string {
        return CarbonImmutable::parse($date)->setTimezone((string) config('app.timezone'))->toDateString();
    }
}
