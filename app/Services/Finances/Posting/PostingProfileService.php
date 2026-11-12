<?php

namespace App\Services\Finances\Posting;

use App\Enums\AccountRole;
use App\Enums\PostingDocumentType;
use App\Events\Core\AuditableModelSaved;
use App\Exceptions\Finances\InvalidPostingProfileException;
use App\Exceptions\Finances\InvalidPostingRuleException;
use App\Models\Finances\Account;
use App\Models\Finances\PostingProfile;
use App\Models\Finances\PostingProfileAccount;
use App\Models\Finances\PostingProfileRule;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Siklus hidup Posting Profile (Finance Fase 2, Requirement 2 dan 12.5-12.6): buat draft, ubah draft, salin menjadi
 * versi baru, aktifkan, pensiunkan. Profil bersifat global; hanya profil `draft` yang dapat diubah atau dihapus,
 * profil `active`/`retired` tidak diedit di tempat (perubahan lewat versi baru). Izin (`write`/`activate`)
 * ditegakkan di controller, bukan di service ini (pola `FiscalPeriodService`). Perubahan tercatat lewat
 * `AuditableModelSaved` (Requirement 2.6, mekanisme audit Fase 1).
 *
 * Penjaga duplikat aturan ada di sini karena kolom kondisi nullable (indeks unik DB tidak menganggap NULL sama).
 * Tidak boleh mengimpor model Sales/Purchase/Inventory/Asset (P-8): keberadaan kategori barang diperiksa lewat
 * query builder.
 */
final class PostingProfileService {
    private const VARIANTS             = ['normal', 'return'];
    private const MAX_ROLE_LENGTH      = 64;
    private const MAX_ITEM_TYPE_LENGTH = 64;
    private const MAX_PRIORITY         = 4294967295;

    /**
     * Domain nilai `item_variants.type` / `items.type`: diturunkan dari `categories.type`
     * (`ItemServices`; konstanta sumber `Category::TYPES`). Catatan utang di luar Sprint A: `CategoryRequest` tidak
     * memvalidasi `type` terhadap `Category::TYPES` dan `ItemFactory` memakai 'goods', jadi data nyata/test dapat
     * memuat nilai di luar domain ini. Disalin di sini karena engine tidak boleh mengimpor
     * model Inventory (P-8); `PostingProfileServiceTest` menjaga kesamaannya dengan sumber.
     *
     * @var list<string>
     */
    public const ITEM_TYPES = ['inventory', 'vehicle', 'service'];

    /**
     * Membuat profil `draft` versi 1.
     *
     * @param  array<string, string>  $accounts  peran => `accounts.id`
     * @param  list<array<string, mixed>>  $rules  atribut aturan (`role`, `account_id`, `document_type`, `variant`, `item_type`, `is_stock_item`, `item_category_id`, `priority`)
     *
     * @throws InvalidPostingProfileException
     * @throws InvalidPostingRuleException
     */
    public function createDraft(string $name, CarbonInterface|string $effectiveFrom, CarbonInterface|string|null $effectiveTo = null, array $accounts = [], array $rules = [], ?string $notes = null): PostingProfile {
        $from = $this->date($effectiveFrom);
        $to   = $effectiveTo === null ? null : $this->date($effectiveTo);
        $this->assertRange($from, $to);

        return DB::transaction(function () use ($name, $from, $to, $accounts, $rules, $notes): PostingProfile {
            $profile = PostingProfile::forceCreate([
                'name'           => $name,
                'effective_from' => $from,
                'effective_to'   => $to,
                'status'         => PostingProfile::STATUS_DRAFT,
                'version'        => 1,
                'notes'          => $notes,
            ]);

            $before = $this->snapshot($profile);
            $this->replaceAccounts($profile, $accounts);
            $this->replaceRules($profile, $rules);
            $this->auditMappings($profile, $before);

            return $profile->refresh();
        });
    }

    /**
     * Mengubah profil `draft`. `$accounts`/`$rules` null = tidak diubah; array = menggantikan seluruhnya.
     *
     * @param  array{name?: string, effective_from?: CarbonInterface|string, effective_to?: CarbonInterface|string|null, notes?: string|null}  $attributes
     * @param  array<string, string>|null  $accounts
     * @param  list<array<string, mixed>>|null  $rules
     */
    public function updateDraft(PostingProfile $profile, array $attributes = [], ?array $accounts = null, ?array $rules = null): PostingProfile {
        return DB::transaction(function () use ($profile, $attributes, $accounts, $rules): PostingProfile {
            $locked = $this->lockDraft($profile);
            $before = $this->snapshot($locked);

            $from = \array_key_exists('effective_from', $attributes) ? $this->date($attributes['effective_from']) : $locked->effective_from->toDateString();
            $to   = \array_key_exists('effective_to', $attributes)
                ? ($attributes['effective_to'] === null ? null : $this->date($attributes['effective_to']))
                : $locked->effective_to?->toDateString();
            $this->assertRange($from, $to);

            $locked->forceFill([
                'name'           => $attributes['name'] ?? $locked->name,
                'effective_from' => $from,
                'effective_to'   => $to,
                'notes'          => \array_key_exists('notes', $attributes) ? $attributes['notes'] : $locked->notes,
            ])->save();

            if ($accounts !== null) {
                $this->replaceAccounts($locked, $accounts);
            }
            if ($rules !== null) {
                $this->replaceRules($locked, $rules);
            }

            $this->audit($locked, 'updated', $before, $this->snapshot($locked->refresh()));

            return $locked;
        });
    }

    /**
     * Menetapkan (atau mengganti) akun default sebuah peran pada profil `draft`.
     */
    public function setAccount(PostingProfile $profile, AccountRole|string $role, string $accountId): PostingProfileAccount {
        return DB::transaction(function () use ($profile, $role, $accountId): PostingProfileAccount {
            $locked    = $this->lockDraft($profile);
            $before    = $this->snapshot($locked);
            $roleValue = $this->roleValue($role);
            $this->assertAccountUsable($accountId, $roleValue, rule: false);

            $row = PostingProfileAccount::query()->where('posting_profile_id', $locked->getKey())->where('role', $roleValue)->first();
            if ($row === null) {
                $row = PostingProfileAccount::forceCreate([
                    'posting_profile_id' => $locked->getKey(),
                    'role'               => $roleValue,
                    'account_id'         => $accountId,
                ]);
            } else {
                $row->forceFill(['account_id' => $accountId])->save();
            }

            $this->audit($locked, 'updated', $before, $this->snapshot($locked));

            return $row;
        });
    }

    /**
     * Menambah satu aturan akun bersyarat pada profil `draft`.
     *
     * @param  array<string, mixed>  $attributes
     */
    public function addRule(PostingProfile $profile, array $attributes): PostingProfileRule {
        return DB::transaction(function () use ($profile, $attributes): PostingProfileRule {
            $locked = $this->lockDraft($profile);
            $before = $this->snapshot($locked);
            $rule   = $this->createRule($locked, $attributes);

            $this->audit($locked, 'updated', $before, $this->snapshot($locked));

            return $rule;
        });
    }

    /**
     * Menghapus profil `draft` (akun dan aturannya ikut terhapus lewat cascade).
     */
    public function deleteDraft(PostingProfile $profile): void {
        DB::transaction(function () use ($profile): void {
            $locked = $this->lockDraft($profile);

            if (PostingProfile::query()->where('previous_profile_id', $locked->getKey())->exists()) {
                throw InvalidPostingProfileException::referencedByNewerVersion();
            }

            $before = $this->snapshot($locked);

            $locked->accounts()->delete();
            $locked->rules()->delete();
            $locked->delete();

            $this->audit($locked, 'deleted', $before, []);
        });
    }

    /**
     * Salinan profil menjadi versi baru berstatus `draft` (akun default dan aturan ikut disalin; Requirement 2.4,
     * 12.6). `effective_from` baru wajib diisi; profil lama diberi `effective_to` saat versi baru diaktifkan.
     */
    public function createNewVersion(PostingProfile $source, CarbonInterface|string $effectiveFrom, CarbonInterface|string|null $effectiveTo = null, ?string $name = null): PostingProfile {
        $from = $this->date($effectiveFrom);
        $to   = $effectiveTo === null ? null : $this->date($effectiveTo);
        $this->assertRange($from, $to);

        return DB::transaction(function () use ($source, $from, $to, $name): PostingProfile {
            $source = PostingProfile::query()->whereKey($source->getKey())->lockForUpdate()->firstOrFail();

            $copy = PostingProfile::forceCreate([
                'name'                => $name ?? $source->name,
                'effective_from'      => $from,
                'effective_to'        => $to,
                'status'              => PostingProfile::STATUS_DRAFT,
                'version'             => $source->version + 1,
                'previous_profile_id' => $source->getKey(),
                'notes'               => $source->notes,
            ]);

            $before = $this->snapshot($copy);

            foreach ($source->accounts()->get() as $account) {
                PostingProfileAccount::forceCreate([
                    'posting_profile_id' => $copy->getKey(),
                    'role'               => $account->role,
                    'account_id'         => $account->account_id,
                ]);
            }

            foreach ($source->rules()->get() as $rule) {
                PostingProfileRule::forceCreate([
                    'posting_profile_id' => $copy->getKey(),
                    'document_type'      => $rule->document_type,
                    'variant'            => $rule->variant,
                    'role'               => $rule->role,
                    'item_type'          => $rule->item_type,
                    'is_stock_item'      => $rule->is_stock_item,
                    'item_category_id'   => $rule->item_category_id,
                    'account_id'         => $rule->account_id,
                    'priority'           => $rule->priority,
                ]);
            }

            $this->auditMappings($copy, $before);

            return $copy->refresh();
        });
    }

    /**
     * Mengaktifkan profil `draft`. Seluruh baris `posting_profiles` dikunci (tabel kecil) agar dua aktivasi
     * serentak tidak lolos pemeriksaan tumpang-tindih bersamaan; mengunci hanya baris aktif tidak menahan apa pun
     * bila belum ada profil aktif. Akun dan aturan divalidasi ulang (akun dapat dinonaktifkan sejak drafting).
     *
     * Bila profil ini salinan (`previous_profile_id`) dari profil aktif yang rentangnya beririsan, profil lama diberi
     * `effective_to` = sehari sebelum `effective_from` profil ini (Requirement 2.4). Irisan dengan profil aktif lain
     * ditolak (Requirement 2.2).
     *
     * @throws InvalidPostingProfileException
     * @throws InvalidPostingRuleException
     */
    public function activate(PostingProfile $profile): PostingProfile {
        return DB::transaction(function () use ($profile): PostingProfile {
            $all    = PostingProfile::query()->lockForUpdate()->get()->keyBy('id');
            $locked = $all->get($profile->getKey()) ?? throw (new ModelNotFoundException)->setModel(PostingProfile::class, [$profile->getKey()]);
            if (! $locked->isDraft()) {
                throw InvalidPostingProfileException::notDraft($locked->status);
            }

            $this->revalidate($locked);

            $from = $locked->effective_from->toDateString();
            $to   = $locked->effective_to?->toDateString();
            $this->assertRange($from, $to);

            $before = $this->snapshot($locked);

            $previous = $locked->previous_profile_id === null ? null : $all->get($locked->previous_profile_id);
            if ($previous !== null && $previous->isActive()) {
                $this->assertContiguous($previous, $from);
            }

            foreach ($all->where('status', PostingProfile::STATUS_ACTIVE) as $other) {
                if (! $this->overlaps($from, $to, $other->effective_from->toDateString(), $other->effective_to?->toDateString())) {
                    continue;
                }

                if ($other->getKey() === $locked->previous_profile_id) {
                    $this->assertCanSupersede($other, $from, $to);
                    $closedAt = CarbonImmutable::parse($from)->subDay()->toDateString();
                    $oldState = $this->snapshot($other);
                    $other->forceFill(['effective_to' => $closedAt])->save();
                    $this->audit($other, 'updated', $oldState, $this->snapshot($other));

                    continue;
                }

                throw InvalidPostingProfileException::overlap($other->name, $other->effective_from->toDateString(), $other->effective_to?->toDateString());
            }

            $locked->forceFill(['status' => PostingProfile::STATUS_ACTIVE])->save();
            $this->audit($locked, 'activated', $before, $this->snapshot($locked));

            return $locked;
        });
    }

    /**
     * Memensiunkan profil `active`: tidak lagi dipilih resolver. Riwayat jurnal tidak berubah.
     */
    public function retire(PostingProfile $profile): PostingProfile {
        return $this->retireWithWarnings($profile)['profile'];
    }

    /**
     * Seperti `retire()`, tetapi juga mengembalikan peringatan celah (keputusan pemilik produk 2026-11-12, Q-P2-11):
     * pemensiunan tidak pernah ditolak karena celah (profil yang keliru harus dapat ditarik), namun rentang tanggal
     * profil ini yang tidak lagi dicakup profil aktif lain dilaporkan, juga lewat `Log::warning`
     * (`posting.profile_retire_gap`), karena resolver gagal tertutup pada tanggal tanpa profil aktif.
     *
     * @return array{profile: PostingProfile, warnings: list<array{from: string, to: string|null, message: string}>}
     */
    public function retireWithWarnings(PostingProfile $profile): array {
        return DB::transaction(function () use ($profile): array {
            $locked = PostingProfile::query()->whereKey($profile->getKey())->lockForUpdate()->firstOrFail();
            if (! $locked->isActive()) {
                throw InvalidPostingProfileException::notActive($locked->status);
            }

            $before = $this->snapshot($locked);
            $locked->forceFill(['status' => PostingProfile::STATUS_RETIRED])->save();
            $this->audit($locked, 'retired', $before, $this->snapshot($locked));

            // Profil aktif tidak pernah beririsan (Req 2.2), jadi seluruh rentang profil ini menjadi tanpa profil aktif.
            $gaps = [[$locked->effective_from->toDateString(), $locked->effective_to?->toDateString()]];

            $warnings = [];
            foreach ($gaps as [$gapFrom, $gapTo]) {
                $warnings[] = [
                    'from'    => $gapFrom,
                    'to'      => $gapTo,
                    'message' => __('finances/postingProfile.warnings.retire_gap', ['from' => $gapFrom, 'to' => $gapTo ?? __('finances/postingProfile.open_ended')]),
                ];
                Log::warning('posting.profile_retire_gap', ['from' => $gapFrom, 'to' => $gapTo]);
            }

            return ['profile' => $locked, 'warnings' => $warnings];
        });
    }

    /**
     * Versi baru yang akan menutup profil lama (keputusan pemilik produk 2026-11-12, Q-P2-7):
     *
     * - `effective_from` versi baru harus sesudah `effective_from` profil lama; bila tidak, tanggal yang sudah
     *   dicakup profil lama akan berpindah ke profil baru dan hasil resolve dokumen yang sudah diposting berubah.
     *   (Tanggal jurnal terakhir yang di-resolve profil lama tidak dapat ditentukan dari data: jurnal tidak mencatat
     *   profil yang dipakai.)
     * - `effective_to` versi baru tidak boleh lebih awal dari `effective_to` profil lama (atau berakhir sedangkan
     *   profil lama tanpa batas akhir); selisihnya menjadi celah tanpa profil aktif.
     */
    /**
     * Salinan versi harus bersambung (keputusan pemilik produk 2026-11-12, Q-P2-10): bila profil lama berbatas akhir,
     * `effective_from` versi baru = `effective_to` profil lama + 1 hari; selain itu muncul celah tanpa profil aktif
     * (resolver gagal tertutup) atau tumpang-tindih. Profil lama tanpa batas akhir diatur `assertCanSupersede`.
     */
    private function assertContiguous(PostingProfile $old, string $from): void {
        $oldTo = $old->effective_to?->toDateString();
        if ($oldTo === null) {
            return;
        }

        $expected = CarbonImmutable::parse($oldTo)->addDay()->toDateString();
        if ($from !== $expected) {
            throw InvalidPostingProfileException::versionNotContiguous($expected);
        }
    }

    private function assertCanSupersede(PostingProfile $old, string $from, ?string $to): void {
        $oldFrom = $old->effective_from->toDateString();
        $oldTo   = $old->effective_to?->toDateString();

        if ($from <= $oldFrom) {
            throw InvalidPostingProfileException::versionStartsBeforePrevious($oldFrom);
        }

        if ($to !== null && ($oldTo === null || $to < $oldTo)) {
            throw InvalidPostingProfileException::versionEndsBeforePrevious($oldTo);
        }
    }

    private function lockDraft(PostingProfile $profile): PostingProfile {
        $locked = PostingProfile::query()->whereKey($profile->getKey())->lockForUpdate()->firstOrFail();
        if (! $locked->isDraft()) {
            throw InvalidPostingProfileException::notDraft($locked->status);
        }

        return $locked;
    }

    /**
     * @param  array<string, string>  $accounts
     */
    private function replaceAccounts(PostingProfile $profile, array $accounts): void {
        foreach ($accounts as $role => $accountId) {
            $this->assertAccountUsable($accountId, $this->roleValue($role), rule: false);
        }

        $profile->accounts()->delete();
        foreach ($accounts as $role => $accountId) {
            PostingProfileAccount::forceCreate([
                'posting_profile_id' => $profile->getKey(),
                'role'               => $this->roleValue($role),
                'account_id'         => $accountId,
            ]);
        }
    }

    /**
     * @param  list<array<string, mixed>>  $rules
     */
    private function replaceRules(PostingProfile $profile, array $rules): void {
        $profile->rules()->delete();
        foreach ($rules as $attributes) {
            $this->createRule($profile, $attributes);
        }
    }

    /**
     * Memvalidasi lalu menyimpan satu aturan pada profil (duplikat dihitung terhadap aturan yang sudah tersimpan).
     *
     * @param  array<string, mixed>  $attributes
     */
    private function createRule(PostingProfile $profile, array $attributes): PostingProfileRule {
        $normalized = $this->normalizeRule($attributes);
        $this->validateRule($profile, $normalized);

        return PostingProfileRule::forceCreate([...$normalized, 'posting_profile_id' => $profile->getKey()]);
    }

    /**
     * @param  array<string, mixed>  $attributes
     * @return array{role: string, account_id: string, document_type: ?string, variant: ?string, item_type: ?string, is_stock_item: ?bool, item_category_id: ?string, priority: int}
     */
    private function normalizeRule(array $attributes): array {
        $role = $attributes['role'] ?? null;
        $role = $role instanceof AccountRole ? $role->value : $role;
        $type = $attributes['document_type'] ?? null;

        return [
            'role'             => (string) ($role ?? ''),
            'account_id'       => (string) ($attributes['account_id'] ?? ''),
            'document_type'    => $type instanceof PostingDocumentType ? $type->value : $this->nullIfBlank($type),
            'variant'          => $this->nullIfBlank($attributes['variant'] ?? null),
            'item_type'        => $this->nullIfBlank($attributes['item_type'] ?? null),
            'is_stock_item'    => isset($attributes['is_stock_item']) && $attributes['is_stock_item'] !== '' ? (bool) $attributes['is_stock_item'] : null,
            'item_category_id' => $this->nullIfBlank($attributes['item_category_id'] ?? null),
            'priority'         => (int) ($attributes['priority'] ?? 0),
        ];
    }

    /**
     * @param  array{role: string, account_id: string, document_type: ?string, variant: ?string, item_type: ?string, is_stock_item: ?bool, item_category_id: ?string, priority: int}  $rule
     */
    private function validateRule(PostingProfile $profile, array $rule): void {
        if ($rule['role'] === '') {
            throw InvalidPostingRuleException::roleRequired();
        }

        if (mb_strlen($rule['role']) > self::MAX_ROLE_LENGTH) {
            throw InvalidPostingRuleException::fieldTooLong('role', self::MAX_ROLE_LENGTH);
        }

        if ($rule['priority'] < 0) {
            throw InvalidPostingRuleException::negativePriority();
        }

        if ($rule['priority'] > self::MAX_PRIORITY) {
            throw InvalidPostingRuleException::priorityTooLarge(self::MAX_PRIORITY);
        }

        if ($rule['item_type'] !== null) {
            if (mb_strlen($rule['item_type']) > self::MAX_ITEM_TYPE_LENGTH) {
                throw InvalidPostingRuleException::fieldTooLong('item_type', self::MAX_ITEM_TYPE_LENGTH);
            }
            if (! \in_array($rule['item_type'], self::ITEM_TYPES, true)) {
                throw InvalidPostingRuleException::invalidItemType($rule['item_type']);
            }
        }

        if ($rule['document_type'] !== null && PostingDocumentType::tryFrom($rule['document_type']) === null) {
            throw InvalidPostingRuleException::unknownDocumentType($rule['document_type']);
        }

        if ($rule['variant'] !== null && ! \in_array($rule['variant'], self::VARIANTS, true)) {
            throw InvalidPostingRuleException::invalidVariant($rule['variant']);
        }

        $hasItemCondition = $rule['item_type'] !== null || $rule['is_stock_item'] !== null || $rule['item_category_id'] !== null;
        if ($hasItemCondition && ! AccountRole::isLineSensitiveRole($rule['role'])) {
            throw InvalidPostingRuleException::itemConditionOnNonLineSensitiveRole($rule['role']);
        }

        if ($rule['item_category_id'] !== null && ! DB::table('categories')->where('id', $rule['item_category_id'])->whereNull('deleted_at')->exists()) {
            throw InvalidPostingRuleException::unknownCategory();
        }

        $this->assertAccountUsable($rule['account_id'], $rule['role'], rule: true);

        $duplicate = PostingProfileRule::query()
            ->where('posting_profile_id', $profile->getKey())
            ->where('role', $rule['role'])
            ->get()
            ->contains(fn (PostingProfileRule $existing): bool => $existing->document_type === $rule['document_type']
                && $existing->variant === $rule['variant']
                && $existing->item_type === $rule['item_type']
                && $existing->is_stock_item === $rule['is_stock_item']
                && $existing->item_category_id === $rule['item_category_id']);
        if ($duplicate) {
            throw InvalidPostingRuleException::duplicate($rule['role']);
        }
    }

    /**
     * Akun harus ada, tidak terhapus, bukan group, dan tidak nonaktif (selaras `JournalService`).
     */
    private function assertAccountUsable(string $accountId, string $role, bool $rule): void {
        $account = Account::query()->withoutGlobalScopes()->find($accountId);

        $problem = match (true) {
            $account === null             => 'not_found',
            $account->deleted_at !== null => 'deleted',
            (bool) $account->is_group     => 'group',
            (bool) $account->is_disabled  => 'disabled',
            default                       => null,
        };
        if ($problem === null) {
            return;
        }

        $label = $account === null ? $accountId : "{$account->account_number} - {$account->account_name}";

        throw $rule
            ? InvalidPostingRuleException::accountProblem($role, $label, $problem)
            : InvalidPostingProfileException::accountProblem($role, $label, $problem);
    }

    /**
     * Validasi ulang isi profil saat aktivasi.
     */
    private function revalidate(PostingProfile $profile): void {
        foreach ($profile->accounts()->get() as $row) {
            $this->assertAccountUsable($row->account_id, $row->role, rule: false);
        }
        foreach ($profile->rules()->get() as $rule) {
            if ($rule->item_category_id !== null && ! DB::table('categories')->where('id', $rule->item_category_id)->whereNull('deleted_at')->exists()) {
                throw InvalidPostingRuleException::unknownCategory();
            }
            $this->assertAccountUsable($rule->account_id, $rule->role, rule: true);
        }
    }

    private function roleValue(AccountRole|string $role): string {
        $value = $role instanceof AccountRole ? $role->value : $role;
        if ($value === '') {
            throw InvalidPostingProfileException::roleRequired();
        }
        if (mb_strlen($value) > self::MAX_ROLE_LENGTH) {
            throw InvalidPostingProfileException::roleTooLong(self::MAX_ROLE_LENGTH);
        }

        return $value;
    }

    private function nullIfBlank(mixed $value): ?string {
        return $value === null || $value === '' ? null : (string) $value;
    }

    private function date(CarbonInterface|string $value): string {
        return $value instanceof CarbonInterface ? $value->toDateString() : CarbonImmutable::parse($value)->toDateString();
    }

    private function assertRange(string $from, ?string $to): void {
        if ($to !== null && $to < $from) {
            throw InvalidPostingProfileException::invalidRange();
        }
    }

    private function overlaps(string $fromA, ?string $toA, string $fromB, ?string $toB): bool {
        return ($toB === null || $fromA <= $toB) && ($toA === null || $fromB <= $toA);
    }

    /**
     * @return array<string, mixed>
     */
    private function snapshot(PostingProfile $profile): array {
        $rules = $profile->rules()->get()->map(fn (PostingProfileRule $rule): array => [
            'role'             => $rule->role,
            'document_type'    => $rule->document_type,
            'variant'          => $rule->variant,
            'item_type'        => $rule->item_type,
            'is_stock_item'    => $rule->is_stock_item,
            'item_category_id' => $rule->item_category_id,
            'account_id'       => $rule->account_id,
            'priority'         => $rule->priority,
        ])->sortBy(fn (array $row): string => json_encode($row))->values()->all();

        return [
            'name'           => $profile->name,
            'status'         => $profile->status,
            'version'        => $profile->version,
            'effective_from' => $profile->effective_from?->toDateString(),
            'effective_to'   => $profile->effective_to?->toDateString(),
            'accounts'       => $profile->accounts()->orderBy('role')->pluck('account_id', 'role')->all(),
            'rules'          => $rules,
        ];
    }

    /**
     * Audit `updated` agar isi pemetaan awal (akun default dan aturan) tercatat sebelum aktivasi (Requirement 2.6).
     * Tidak dikirim bila tidak ada pemetaan.
     *
     * @param  array<string, mixed>  $before
     */
    private function auditMappings(PostingProfile $profile, array $before): void {
        $after = $this->snapshot($profile);
        if ($after['accounts'] === [] && $after['rules'] === []) {
            return;
        }

        $this->audit($profile, 'updated', $before, $after);
    }

    /**
     * @param  array<string, mixed>  $before
     * @param  array<string, mixed>  $after
     */
    private function audit(PostingProfile $profile, string $action, array $before, array $after): void {
        event(new AuditableModelSaved($profile, $action, $before, $after));
    }
}
