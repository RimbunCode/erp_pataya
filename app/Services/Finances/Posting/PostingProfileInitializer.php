<?php

namespace App\Services\Finances\Posting;

use App\Enums\AccountRole;
use App\Models\Finances\Account;
use App\Models\Finances\FiscalYear;
use App\Models\Finances\PostingProfile;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;

/**
 * Membangkitkan profil awal (default) dari COA saat ini (Finance Fase 2, Requirement 2.5): setiap peran yang punya
 * pasangan legacy `(root_type, account_type)` dipetakan ke akunnya BILA tepat satu akun aktif non-group cocok. Bila
 * lebih dari satu akun cocok (ambigu) atau tidak ada, peran dilaporkan dan tidak ditebak. Peran tanpa padanan legacy
 * (akun master atau belum dipakai) dilaporkan terpisah.
 *
 * Profil dibuat berstatus `draft` untuk ditinjau akuntan sebelum diaktifkan (rollout langkah 2). Idempoten: profil
 * awal dikenali dari `name` + versi 1 tanpa pendahulu; menjalankan ulang tidak menggandakan profil, hanya melengkapi
 * peran yang kini dapat di-resolve pada profil yang masih `draft` tanpa menimpa pemetaan yang sudah ada.
 */
final class PostingProfileInitializer {
    public const PROFILE_NAME = 'Profil Awal (dari COA)';

    public function __construct(private readonly PostingProfileService $profiles) {}

    /**
     * Analisis read-only COA terhadap katalog peran.
     *
     * @return array{
     *     resolved: array<string, array{id: string, label: string}>,
     *     ambiguous: array<string, list<string>>,
     *     missing: array<string, string>,
     *     master: list<string>
     * }
     */
    public function analyze(): array {
        $report = ['resolved' => [], 'ambiguous' => [], 'missing' => [], 'master' => []];

        foreach (AccountRole::cases() as $role) {
            $pair = $role->legacyPair();
            if ($pair === null) {
                $report['master'][] = $role->value;

                continue;
            }

            [$rootType, $accountType] = $pair;
            $candidates               = Account::query()
                ->where('root_type', $rootType)
                ->where('account_type', $accountType)
                ->where('is_group', false)
                ->where('is_disabled', false)
                ->orderBy('account_number')
                ->get();

            if ($candidates->isEmpty()) {
                $report['missing'][$role->value] = "{$rootType}/{$accountType}";
            } elseif ($candidates->count() > 1) {
                $report['ambiguous'][$role->value] = $candidates->map(fn (Account $account): string => $this->label($account))->all();
            } else {
                $account                          = $candidates->first();
                $report['resolved'][$role->value] = ['id' => $account->getKey(), 'label' => $this->label($account)];
            }
        }

        return $report;
    }

    /**
     * Menulis profil awal dari hasil `analyze()`.
     *
     * @param  array{resolved: array<string, array{id: string, label: string}>}  $report
     * @return array{profile: PostingProfile|null, action: string, written: list<string>}
     *                                                                                    `action`: `created` | `completed` | `unchanged` | `locked` (profil awal sudah bukan draft; tidak diubah)
     */
    public function apply(array $report, CarbonInterface|string|null $effectiveFrom = null): array {
        $existing = PostingProfile::query()
            ->where('name', self::PROFILE_NAME)
            ->where('version', 1)
            ->whereNull('previous_profile_id')
            ->first();

        $accounts = array_map(static fn (array $row): string => $row['id'], $report['resolved']);

        if ($existing === null) {
            $profile = $this->profiles->createDraft(self::PROFILE_NAME, $effectiveFrom ?? $this->defaultEffectiveFrom(), null, $accounts);

            return ['profile' => $profile, 'action' => 'created', 'written' => array_keys($accounts)];
        }

        if (! $existing->isDraft()) {
            return ['profile' => $existing, 'action' => 'locked', 'written' => []];
        }

        $mapped  = $existing->accounts()->pluck('role')->all();
        $written = [];
        foreach ($accounts as $role => $accountId) {
            if (\in_array($role, $mapped, true)) {
                continue;
            }
            $this->profiles->setAccount($existing, $role, $accountId);
            $written[] = $role;
        }

        return ['profile' => $existing, 'action' => $written === [] ? 'unchanged' : 'completed', 'written' => $written];
    }

    /**
     * Awal tahun fiskal tertua; tanpa tahun fiskal, 1 Januari tahun berjalan.
     */
    public function defaultEffectiveFrom(): string {
        $earliest = FiscalYear::query()->min('start_date');

        return $earliest !== null
            ? CarbonImmutable::parse($earliest)->toDateString()
            : CarbonImmutable::now()->startOfYear()->toDateString();
    }

    private function label(Account $account): string {
        return "{$account->account_number} - {$account->account_name}";
    }
}
