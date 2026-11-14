<?php

namespace Tests\Support;

use App\Enums\PostingDocumentType;
use App\Models\Finances\Account;
use App\Models\Finances\FinanceSetting;
use App\Models\Finances\Journal;
use App\Models\Finances\PostingParityLog;
use App\Models\Finances\PostingProfile;
use App\Services\Core\Setting\SettingsService;
use App\Services\Finances\Posting\PostingModeResolver;
use App\Services\Finances\Posting\PostingProfileService;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

/**
 * Pembantu parity test end-to-end Finance Fase 2 (Task 7.3, 8.4; P-1): satu dokumen per mode (`off`, `shadow`, `on`)
 * diproses lewat listener/service sungguhan, lalu tanda tangan jurnalnya (purpose, tanggal, akun, debit, kredit)
 * harus identik di ketiga mode. Dipakai bersama `BuildsFinanceFixtures` (`setUpFinanceFixtures()` harus memuat
 * `PostingProfile` dan `PostingParityLog`).
 */
trait AssertsPostingParity {
    /** @var list<string> */
    private const PARITY_MODES = [FinanceSetting::POSTING_MODE_OFF, FinanceSetting::POSTING_MODE_SHADOW, FinanceSetting::POSTING_MODE_ON];

    /**
     * `ParityComparator` berkelas `final` (tidak bisa di-mock): paksa kegagalan nyata pada insert `posting_parity_logs`.
     * Insert ke-N melempar `$errors[N-1]`; insert setelah daftar habis berjalan normal.
     *
     * @param  list<\Throwable>  $errors
     */
    protected function failParityLogInserts(array $errors): void {
        DB::listen(function ($query) use (&$errors): void {
            if ($errors !== [] && str_starts_with(strtolower($query->sql), 'insert') && str_contains($query->sql, 'posting_parity_logs')) {
                throw array_shift($errors);
            }
        });
    }

    protected function setPostingMode(PostingDocumentType $type, string $mode): void {
        // Mode jenis lain dipertahankan: `posting_modes` disimpan sebagai satu kolom JSON untuk semua jenis.
        PostingModeResolver::forget();
        $modes = array_merge(FinanceSetting::defaultAttributes()['posting_modes'], app(PostingModeResolver::class)->all(), [$type->value => $mode]);
        app(SettingsService::class)->updateInternal(FinanceSetting::class, ['posting_modes' => $modes]);
        PostingModeResolver::forget();
    }

    /**
     * Profil aktif sejak 2020: peran => akun default, supaya hasil engine (mode `on`) memakai akun fixture yang sama
     * dengan jalur lama.
     *
     * @param  array<string, Account>  $roleAccounts
     */
    protected function activateParityProfile(array $roleAccounts): PostingProfile {
        $profiles = app(PostingProfileService::class);

        return $profiles->activate($profiles->createDraft('Profil parity', '2020-01-01', null, array_map(fn (Account $account): string => (string) $account->id, $roleAccounts)));
    }

    /**
     * Tanda tangan jurnal dokumen sumber: per purpose, tanggal (hari) dan baris (akun, debit, kredit) terurut.
     *
     * @return array<string, array{date: string, lines: list<array{0: string, 1: float, 2: float}>}>
     */
    protected function journalSignature(Model $source): array {
        $prefix   = $source->getMorphClass() . ':' . $source->getKey() . ':';
        $accounts = Account::query()->withoutGlobalScopes()->pluck('account_number', 'id');
        $result   = [];

        $journals = Journal::query()
            ->where('source_type', $source->getMorphClass())
            ->where('source_id', $source->getKey())
            ->get();

        foreach ($journals as $journal) {
            $purpose = str_starts_with((string) $journal->posting_key, $prefix) ? substr((string) $journal->posting_key, \strlen($prefix)) : (string) $journal->posting_key;

            $lines = [];
            foreach ($journal->lines as $line) {
                $lines[] = [(string) $accounts[$line->account_id], round((float) $line->debit, 4), round((float) $line->credit, 4)];
            }
            usort($lines, fn (array $a, array $b): int => [$b[1], $a[0]] <=> [$a[1], $b[0]]);

            $result[$purpose] = ['date' => $journal->transaction_date->toDateString(), 'lines' => $lines];
        }

        ksort($result);

        return $result;
    }

    /**
     * Status parity log mode `shadow` untuk sebuah dokumen sumber (satu catatan), atau null bila tidak ada.
     */
    protected function parityLogStatus(Model $source): ?string {
        $logs = PostingParityLog::query()->where('source_type', $source->getMorphClass())->where('source_id', $source->getKey())->get();
        $this->assertLessThanOrEqual(1, $logs->count(), 'Satu catatan parity per dokumen.');

        return $logs->first()?->status;
    }

    /**
     * Pastikan tanda tangan dokumen identik di semua mode dan tidak kosong (kecuali `$allowEmpty`).
     *
     * @param  array<string, array<string, mixed>>  $signaturesByMode  mode => tanda tangan
     */
    protected function assertSignaturesIdentical(string $scenario, array $signaturesByMode, bool $allowEmpty = false): void {
        $this->assertSame(self::PARITY_MODES, array_keys($signaturesByMode), $scenario);

        if (! $allowEmpty) {
            $this->assertNotEmpty($signaturesByMode[FinanceSetting::POSTING_MODE_OFF], "{$scenario}: jalur lama harus menulis jurnal.");
        }

        $this->assertEquals($signaturesByMode[FinanceSetting::POSTING_MODE_OFF], $signaturesByMode[FinanceSetting::POSTING_MODE_SHADOW], "{$scenario}: shadow harus identik dengan off.");
        $this->assertEquals($signaturesByMode[FinanceSetting::POSTING_MODE_OFF], $signaturesByMode[FinanceSetting::POSTING_MODE_ON], "{$scenario}: on harus identik dengan off.");
    }
}
