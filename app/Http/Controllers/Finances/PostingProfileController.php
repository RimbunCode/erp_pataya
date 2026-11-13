<?php

namespace App\Http\Controllers\Finances;

use App\Enums\AccountRole;
use App\Enums\PostingDocumentType;
use App\Exceptions\Finances\InvalidPostingProfileException;
use App\Exceptions\Finances\InvalidPostingRuleException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Finances\PostingProfileRequest;
use App\Http\Requests\Finances\PostingProfileVersionRequest;
use App\Models\Finances\Account;
use App\Models\Finances\PostingProfile;
use App\Models\Finances\PostingProfileRule;
use App\Services\Finances\Posting\PostingModeResolver;
use App\Services\Finances\Posting\PostingProfileService;
use App\Services\Finances\Posting\PostingRoleRequirements;
use Carbon\CarbonImmutable;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpKernel\Exception\HttpException;

/**
 * Halaman pengelolaan Posting Profile (Finance Fase 2, Requirement 8.1-8.2, 8.5): daftar, form draft (tabel peran
 * => akun default), salin versi, aktifkan, pensiunkan, dan hapus draft. Seluruh penulisan lewat
 * `PostingProfileService` (model `$guarded = ['*']`; tidak ada mass assignment dari request) dan hanya input yang
 * dikenal `PostingProfileRequest` yang diterima. Profil `active`/`retired` hanya dapat dibaca, disalin, atau
 * dipensiunkan. Aturan akun bersyarat ditampilkan baca-saja; editornya adalah Task 12.2.
 *
 * Izin: `select` (daftar), `read` (detail), `write` (buat/ubah/salin/hapus draft), `activate` (aktifkan/pensiunkan).
 */
class PostingProfileController extends Controller {
    public function __construct(Request $request) {
        parent::__construct($request, PostingProfile::class);
    }

    protected function enforcePermission(string $method) {
        return match ($method) {
            'form', 'save', 'discard', 'newVersion' => 'write',
            'activate', 'retire'                    => 'activate',
            default                                 => parent::enforcePermission($method),
        };
    }

    public function index(): Response {
        $this->setBreadcrumbs();

        $profiles = PostingProfile::query()
            ->withCount('accounts')
            ->orderByDesc('effective_from')
            ->orderByDesc('version')
            ->get()
            ->map(fn (PostingProfile $profile): array => [
                'id'             => $profile->id,
                'name'           => $profile->name,
                'status'         => $profile->status,
                'version'        => $profile->version,
                'effective_from' => $profile->effective_from->toDateString(),
                'effective_to'   => $profile->effective_to?->toDateString(),
                'accounts_count' => $profile->accounts_count,
            ])
            ->all();

        return Inertia::render('Finances/PostingProfiles/Index', [
            'profiles' => $profiles,
            'canWrite' => $this->hasPermission('write'),
            'canRead'  => $this->hasPermission('read'),
        ]);
    }

    public function form(): Response {
        $this->setBreadcrumbs('finances.postingProfile.new');

        return Inertia::render('Finances/PostingProfiles/Form', [
            ...$this->catalog(),
            'profile'     => null,
            'unmapped'    => [],
            'canWrite'    => true,
            'canActivate' => false,
            'defaultFrom' => CarbonImmutable::now()->toDateString(),
        ]);
    }

    public function show(PostingProfile $postingProfile, PostingModeResolver $modes): Response {
        $this->setBreadcrumbs($postingProfile);

        return Inertia::render('Finances/PostingProfiles/Form', [
            ...$this->catalog(),
            'profile'     => $this->profilePayload($postingProfile),
            'unmapped'    => $postingProfile->status === PostingProfile::STATUS_RETIRED ? [] : PostingRoleRequirements::unmapped($postingProfile, $modes->all()),
            'canWrite'    => $this->hasPermission('write'),
            'canActivate' => $this->hasPermission('activate'),
            'defaultFrom' => ($postingProfile->effective_to ?? $postingProfile->effective_from)->addDay()->toDateString(),
        ]);
    }

    public function save(PostingProfileRequest $request, PostingProfileService $profiles): RedirectResponse {
        $data = $request->validated();

        $profile = $this->guarded(fn (): PostingProfile => $profiles->createDraft(
            $data['name'],
            $data['effective_from'],
            $data['effective_to'] ?? null,
            $request->accountMap(),
            [],
            $data['notes'] ?? null,
        ));

        return redirect()->route('postingProfiles.show', $profile)->with('success', __('finances/postingProfile.messages.created', ['name' => $profile->name]));
    }

    public function update(PostingProfileRequest $request, PostingProfile $postingProfile, PostingProfileService $profiles): RedirectResponse {
        $data = $request->validated();

        // Peran kustom di luar katalog UI (Requirement 1.3) tidak boleh hilang saat tabel peran disimpan.
        $custom = $postingProfile->accounts()->pluck('account_id', 'role')
            ->reject(fn (string $accountId, string $role): bool => \in_array($role, AccountRole::values(), true))
            ->all();

        $this->guarded(fn (): PostingProfile => $profiles->updateDraft(
            $postingProfile,
            [
                'name'           => $data['name'],
                'effective_from' => $data['effective_from'],
                'effective_to'   => $data['effective_to'] ?? null,
                'notes'          => $data['notes'] ?? null,
            ],
            // Tanpa kunci `accounts` pemetaan tidak diubah (null), bukan dikosongkan.
            $request->has('accounts') ? [...$custom, ...$request->accountMap()] : null,
        ));

        return back()->with('success', __('finances/postingProfile.messages.updated', ['name' => $data['name']]));
    }

    public function discard(PostingProfile $postingProfile, PostingProfileService $profiles): RedirectResponse {
        $this->guarded(fn () => $profiles->deleteDraft($postingProfile));

        return redirect()->route('postingProfiles.index')->with('success', __('finances/postingProfile.messages.discarded', ['name' => $postingProfile->name]));
    }

    public function newVersion(PostingProfileVersionRequest $request, PostingProfile $postingProfile, PostingProfileService $profiles): RedirectResponse {
        $data = $request->validated();

        $copy = $this->guarded(fn (): PostingProfile => $profiles->createNewVersion(
            $postingProfile,
            $data['effective_from'],
            $data['effective_to'] ?? null,
            $data['name'] ?? null,
        ));

        return redirect()->route('postingProfiles.show', $copy)->with('success', __('finances/postingProfile.messages.version_created', ['version' => $copy->version]));
    }

    public function activate(PostingProfile $postingProfile, PostingProfileService $profiles): RedirectResponse {
        $this->guarded(fn (): PostingProfile => $profiles->activate($postingProfile));

        return back()->with('success', __('finances/postingProfile.messages.activated', ['name' => $postingProfile->name]));
    }

    public function retire(PostingProfile $postingProfile, PostingProfileService $profiles): RedirectResponse {
        $result = $this->guarded(fn (): array => $profiles->retireWithWarnings($postingProfile));

        $redirect = back()->with('success', __('finances/postingProfile.messages.retired', ['name' => $postingProfile->name]));

        // Peringatan celah (Requirement 2.4, Q-P2-11) dikirim sebagai flash agar halaman dapat menampilkannya.
        return $result['warnings'] === []
            ? $redirect
            : $redirect->with('retireWarnings', array_column($result['warnings'], 'message'));
    }

    /**
     * Menjalankan aksi service dan menerjemahkan penolakan domain menjadi galat validasi (422) yang dapat
     * ditampilkan halaman.
     *
     * @template T
     *
     * @param  callable(): T  $action
     * @return T
     */
    private function guarded(callable $action): mixed {
        try {
            return $action();
        } catch (InvalidPostingProfileException|InvalidPostingRuleException $e) {
            throw ValidationException::withMessages(['profile' => $e->getMessage()]);
        }
    }

    /**
     * @return array{roles: list<array{value: string, label: string, line_sensitive: bool, master: bool}>, documentTypes: list<string>}
     */
    private function catalog(): array {
        return [
            'roles' => array_map(static fn (AccountRole $role): array => [
                'value'          => $role->value,
                'label'          => $role->label(),
                'line_sensitive' => $role->isLineSensitive(),
                'master'         => $role->isMasterRole(),
            ], AccountRole::cases()),
            'documentTypes' => PostingDocumentType::values(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function profilePayload(PostingProfile $profile): array {
        $rules = $profile->rules()->get();

        $accountIds = $profile->accounts()->pluck('account_id')->merge($rules->pluck('account_id'))->unique()->all();
        $accounts   = Account::query()->withoutGlobalScopes()->whereIn('id', $accountIds)->get()->keyBy('id');
        // Nilai relasi untuk LinkModel: objek akun serialisasi model (membawa `thisModel`, `templateLink`, dst.) karena
        // LinkModel membuang nilai yang `thisModel`-nya tidak cocok dengan modelnya.
        $label = static fn (?string $id): ?array => $id !== null && $accounts->has($id)
            ? Arr::only($accounts[$id]->toArray(), ['id', 'account_number', 'account_name', 'is_group', 'is_disabled', 'deleted_at', 'thisModel', 'templateLink', 'route', 'keyModel'])
            : null;

        $categories = DB::table('categories')->whereIn('id', $rules->pluck('item_category_id')->filter()->all())->pluck('name', 'id');

        return [
            'id'                  => $profile->id,
            'name'                => $profile->name,
            'status'              => $profile->status,
            'version'             => $profile->version,
            'effective_from'      => $profile->effective_from->toDateString(),
            'effective_to'        => $profile->effective_to?->toDateString(),
            'notes'               => $profile->notes,
            'previous_profile_id' => $profile->previous_profile_id,
            'accounts'            => $profile->accounts()->get()->mapWithKeys(fn ($row): array => [$row->role => $label($row->account_id)])->all(),
            'rules'               => $rules->map(fn (PostingProfileRule $rule): array => [
                'id'            => $rule->id,
                'role'          => $rule->role,
                'document_type' => $rule->document_type,
                'variant'       => $rule->variant,
                'item_type'     => $rule->item_type,
                'is_stock_item' => $rule->is_stock_item,
                'category'      => $rule->item_category_id === null ? null : ($categories[$rule->item_category_id] ?? null),
                'account'       => $label($rule->account_id),
                'priority'      => $rule->priority,
            ])->all(),
        ];
    }

    private function hasPermission(string $action): bool {
        try {
            PostingProfile::_checkPermission($action);
        } catch (HttpException) {
            return false;
        }

        return true;
    }
}
