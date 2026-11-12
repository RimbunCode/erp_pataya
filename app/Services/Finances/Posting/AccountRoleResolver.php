<?php

namespace App\Services\Finances\Posting;

use App\Enums\AccountRole;
use App\Exceptions\Finances\UnresolvedAccountRoleException;
use App\Models\Finances\Account;
use App\Models\Finances\PostingProfile;
use App\Services\Finances\Ledger\FiscalPeriodService;
use App\Services\Finances\Posting\Contexts\LineAttributes;
use App\Services\Finances\Posting\Contexts\PostingContext;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;

/**
 * Mengubah peran akun menjadi akun nyata (Finance Fase 2, Requirement 3). Urutan lapis tetap:
 *
 * 1. akun master yang dibawa `PostingContext` (`masterAccounts[role]`);
 * 2. aturan akun bersyarat pada profil `active` yang berlaku pada tanggal transaksi (`AccountRuleMatcher`);
 * 3. akun default peran pada profil itu;
 * 4. fallback legacy `(root_type, account_type)` bila `finance.posting.legacy_account_fallback` aktif, dengan
 *    peringatan log. Bila lebih dari satu akun cocok pasangan itu (ambigu), resolver gagal tertutup dengan
 *    `UnresolvedAccountRoleException` (tidak memilih); peran ambigu wajib dipetakan di profil.
 *
 * Akun hasil lapis mana pun divalidasi (ada, tidak terhapus, bukan group, tidak nonaktif; selaras `JournalService`).
 * Lapis yang menghasilkan akun tidak valid melempar `UnresolvedAccountRoleException` dengan lapis penyebabnya, bukan
 * jatuh diam-diam ke lapis berikutnya.
 *
 * Kelas ini TIDAK singleton: cache hidup per instance (satu job/request) dan tidak melintasi instance (Requirement
 * 3.5). Tidak mengunci baris; penguncian akun tetap oleh `JournalService` (Requirement 3.6). Tidak boleh mengimpor
 * model Sales/Purchase/Inventory/Asset (P-8).
 */
final class AccountRoleResolver {
    /** @var array<string, Account> */
    private array $resolved = [];

    /** @var array<string, Account|false> */
    private array $accountsById = [];

    /** @var array<string, PostingProfile|null> */
    private array $profilesByDay = [];

    /** @var array<string, array<string, string>> */
    private array $profileAccounts = [];

    /** @var array<string, Collection> */
    private array $profileRules = [];

    private ?string $timezone = null;

    public function __construct(
        private readonly FiscalPeriodService $periods,
        private readonly AccountRuleMatcher $matcher = new AccountRuleMatcher,
    ) {}

    /**
     * @throws UnresolvedAccountRoleException
     */
    public function resolve(AccountRole|string $role, PostingContext $ctx, ?LineAttributes $line = null): Account {
        $roleValue = $role instanceof AccountRole ? $role->value : $role;
        $enum      = $role instanceof AccountRole ? $role : AccountRole::tryFrom($roleValue);
        $day       = $this->businessDay($ctx);
        $layers    = [];

        // Lapis 1: akun master dari konteks (konfigurasi master, bukan input transaksi).
        $masterId = $ctx->masterAccounts[$roleValue] ?? null;
        if ($masterId !== null && $masterId !== '') {
            if (AccountRole::isMasterRoleValue($roleValue)) {
                return $this->validated($masterId, 'master', $roleValue, $ctx, $day);
            }

            // Requirement 3.1.1: hanya cash_or_bank dan peran aset yang bersumber dari akun master. Peran lain di
            // masterAccounts diabaikan (tidak boleh memotong profil) dan dicatat agar kesalahan pabrik konteks terlihat.
            Log::warning('posting.master_account_ignored', ['role' => $roleValue, 'document_type' => $ctx->documentType->value]);
        }
        $layers[] = __('finances/posting.layers.master_none');

        $profile = $this->profileFor($day);

        $line = $enum?->isLineSensitive() ? $line : null;
        $key  = $this->cacheKey($profile, $roleValue, $ctx, $line);
        if (isset($this->resolved[$key])) {
            return $this->resolved[$key];
        }

        if ($profile !== null) {
            // Lapis 2: aturan akun bersyarat.
            $rule = $this->matcher->match($this->rulesOf($profile), $roleValue, $ctx, $line);
            if ($rule !== null) {
                return $this->resolved[$key] = $this->validated($rule->account_id, 'rules', $roleValue, $ctx, $day);
            }
            $layers[] = __('finances/posting.layers.rules_none');

            // Lapis 3: akun default peran pada profil.
            $defaultId = $this->accountsOf($profile)[$roleValue] ?? null;
            if ($defaultId !== null) {
                return $this->resolved[$key] = $this->validated($defaultId, 'profile', $roleValue, $ctx, $day);
            }
            $layers[] = __('finances/posting.layers.profile_role_missing', ['profile' => $profile->name]);
        } else {
            $layers[] = __('finances/posting.layers.rules_none');
            $layers[] = __('finances/posting.layers.profile_none');
        }

        // Lapis 4: fallback legacy.
        if (! config('finance.posting.legacy_account_fallback')) {
            $layers[] = __('finances/posting.layers.legacy_off');
        } elseif ($enum?->legacyPair() === null) {
            $layers[] = __('finances/posting.layers.legacy_no_pair');
        } else {
            [$rootType, $accountType] = $enum->legacyPair();

            $account = $this->legacyAccount($roleValue, $rootType, $accountType, $ctx, $day);
            if ($account !== null) {
                return $this->resolved[$key] = $this->validated($account->getKey(), 'legacy', $roleValue, $ctx, $day);
            }
            $layers[] = __('finances/posting.layers.legacy_no_account', ['root' => $rootType, 'type' => $accountType]);
        }

        throw UnresolvedAccountRoleException::notResolved($roleValue, $ctx->documentType->value, $ctx->variant(), $day, $layers);
    }

    /**
     * Hari bisnis transaksi dalam zona waktu perusahaan (Q-P1-5), konsisten dengan periode fiskal. Zona dibaca sekali
     * per instance.
     */
    private function businessDay(PostingContext $ctx): string {
        $this->timezone ??= $this->periods->companyTimezone();

        return $ctx->transactionDate->copy()->setTimezone($this->timezone)->toDateString();
    }

    /**
     * Profil `active` yang berlaku pada hari itu. Overlap dicegah `PostingProfileService`; bila data tetap ganda,
     * urutan `effective_from` lalu `version` menurun menjaga hasil deterministik.
     */
    private function profileFor(string $day): ?PostingProfile {
        if (! \array_key_exists($day, $this->profilesByDay)) {
            $this->profilesByDay[$day] = PostingProfile::query()
                ->where('status', PostingProfile::STATUS_ACTIVE)
                ->whereDate('effective_from', '<=', $day)
                ->where(fn ($query) => $query->whereNull('effective_to')->orWhereDate('effective_to', '>=', $day))
                ->orderByDesc('effective_from')
                ->orderByDesc('version')
                ->orderByDesc('id')
                ->first();
        }

        return $this->profilesByDay[$day];
    }

    /**
     * @return array<string, string> peran => account_id
     */
    private function accountsOf(PostingProfile $profile): array {
        return $this->profileAccounts[$profile->getKey()] ??= $profile->accounts()->pluck('account_id', 'role')->all();
    }

    private function rulesOf(PostingProfile $profile): Collection {
        return $this->profileRules[$profile->getKey()] ??= $profile->rules()->get();
    }

    private function cacheKey(?PostingProfile $profile, string $role, PostingContext $ctx, ?LineAttributes $line): string {
        return implode('|', [
            $profile?->getKey() ?? 'legacy',
            $role,
            $ctx->documentType->value,
            $ctx->variant(),
            $line?->itemType ?? '',
            $line === null || $line->isStockItem === null ? '' : ($line->isStockItem ? '1' : '0'),
            $line?->itemCategoryId ?? '',
        ]);
    }

    /**
     * Akun legacy `(root_type, account_type)`: `created_at` terbaru (dengan `id` sebagai pemutus agar deterministik
     * pada akun seed yang berstempel waktu sama); peringatan bila ambigu.
     */
    private function legacyAccount(string $role, string $rootType, string $accountType, PostingContext $ctx, string $day): ?Account {
        $candidates = Account::query()
            ->where('root_type', $rootType)
            ->where('account_type', $accountType)
            ->orderBy('id')
            ->get();

        if ($candidates->isEmpty()) {
            return null;
        }

        // Gagal tertutup (keputusan pemilik produk 2026-11-12, Q-P2-6): lebih dari satu akun untuk pasangan ini
        // berarti pilihan "terbaru" dapat menjurnal ke akun yang salah tanpa terlihat. Peran harus dipetakan di profil.
        if ($candidates->count() > 1) {
            Log::warning('posting.legacy_account_ambiguous', [
                'role'          => $role,
                'document_type' => $ctx->documentType->value,
                'root_type'     => $rootType,
                'account_type'  => $accountType,
                'candidates'    => $candidates->count(),
            ]);

            throw UnresolvedAccountRoleException::ambiguousLegacy($role, $ctx->documentType->value, $ctx->variant(), $day, $rootType, $accountType, $candidates->count());
        }

        Log::warning('posting.legacy_account_fallback', [
            'role'          => $role,
            'document_type' => $ctx->documentType->value,
            'root_type'     => $rootType,
            'account_type'  => $accountType,
        ]);

        return $candidates->first();
    }

    /**
     * @throws UnresolvedAccountRoleException bila akun hilang, terhapus, group, atau nonaktif
     */
    private function validated(string $accountId, string $layer, string $role, PostingContext $ctx, string $day): Account {
        $account = $this->accountsById[$accountId] ??= Account::query()->withoutGlobalScopes()->find($accountId) ?? false;

        $problem = match (true) {
            $account === false            => 'not_found',
            $account->deleted_at !== null => 'deleted',
            (bool) $account->is_group     => 'group',
            (bool) $account->is_disabled  => 'disabled',
            default                       => null,
        };

        if ($problem !== null) {
            $label = $account === false ? $accountId : "{$account->account_number} - {$account->account_name}";

            throw UnresolvedAccountRoleException::invalidAccount($role, $ctx->documentType->value, $ctx->variant(), $day, $layer, $label, $problem);
        }

        return $account;
    }
}
