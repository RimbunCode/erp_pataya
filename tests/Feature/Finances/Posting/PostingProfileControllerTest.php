<?php

namespace Tests\Feature\Finances\Posting;

use App\Enums\AccountRole;
use App\Models\Finances\Account;
use App\Models\Finances\FinanceSetting;
use App\Models\Finances\PostingParityLog;
use App\Models\Finances\PostingProfile;
use App\Services\Finances\Posting\PostingModeResolver;
use App\Services\Finances\Posting\PostingProfileService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\Support\BuildsFinanceFixtures;
use Tests\TestCase;

/**
 * Finance Fase 2, Task 6.1 (Requirement 8.1-8.2, 11.3): `PostingProfileController`. Otorisasi per aksi
 * (`select`/`read`/`write`/`activate`), validasi, semua penulisan lewat `PostingProfileService`, profil `active` tidak
 * dapat diubah dari UI, dan input yang tidak dikenal ditolak.
 */
class PostingProfileControllerTest extends TestCase {
    use BuildsFinanceFixtures, RefreshDatabase;

    private PostingProfileService $service;
    private Account $receivable;
    private Account $revenue;
    private Account $other;

    protected function setUp(): void {
        parent::setUp();

        $this->setUpFinanceFixtures([PostingProfile::class, PostingParityLog::class]);
        // Halaman Inertia baru belum ada di manifest Vite build lokal; test memeriksa props, bukan aset.
        $this->withoutVite();
        $this->service    = app(PostingProfileService::class);
        $this->receivable = $this->makeAccount('1231', 'Piutang Dagang', 'asset', 'debit', 'receivable');
        $this->revenue    = $this->makeAccount('4110', 'Penjualan', 'income', 'credit', 'income_account');
        $this->other      = $this->makeAccount('5210', 'Beban Umum', 'expense', 'debit');
    }

    /**
     * @param  list<string>  $permissions  izin PostingProfile
     */
    private function actingWith(array $permissions): static {
        return $this->withSession([
            'permissions' => [
                PostingProfile::class => [0 => [['model' => PostingProfile::class, 'level' => 0, 'only_creator' => false, 'permissions' => array_fill_keys($permissions, true)]]],
            ],
            'permissions_version' => '0|0|0|0',
            'currentBranch'       => null,
        ])->withCookie('lang', 'en')->actingAs($this->user);
    }

    private function draft(string $from = '2026-01-01', ?string $to = null, string $name = 'Profil'): PostingProfile {
        return $this->service->createDraft($name, $from, $to, [
            AccountRole::Receivable->value => $this->receivable->id,
            AccountRole::Revenue->value    => $this->revenue->id,
        ]);
    }

    private function active(string $from = '2026-01-01', ?string $to = null, string $name = 'Aktif'): PostingProfile {
        return $this->service->activate($this->draft($from, $to, $name));
    }

    /**
     * @param  array<string, string>  $modes
     */
    private function setModes(array $modes): void {
        $current = FinanceSetting::defaultAttributes()['posting_modes'];
        FinanceSetting::current();
        DB::table('finance_settings')->update(['posting_modes' => json_encode([...$current, ...$modes])]);
        PostingModeResolver::forget();
    }

    public function test_index_requires_select_permission(): void {
        $this->actingWith(['read'])->get(route('postingProfiles.index'))->assertForbidden();
    }

    public function test_index_lists_profiles_with_flags(): void {
        $this->active('2026-01-01', null, 'Aktif');
        $this->draft('2027-01-01', null, 'Draft');

        $this->actingWith(['select', 'write'])->get(route('postingProfiles.index'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('Finances/PostingProfiles/Index')
                ->has('profiles', 2)
                ->where('profiles.0.name', 'Draft')
                ->where('profiles.0.status', 'draft')
                ->where('profiles.1.status', 'active')
                ->where('profiles.1.accounts_count', 2)
                ->where('canWrite', true));
    }

    public function test_index_without_write_cannot_create(): void {
        $this->actingWith(['select'])->get(route('postingProfiles.index'))
            ->assertInertia(fn ($page) => $page->where('canWrite', false));
    }

    public function test_show_requires_read_permission(): void {
        $profile = $this->draft();

        $this->actingWith(['select'])->get(route('postingProfiles.show', $profile))->assertForbidden();
    }

    public function test_show_returns_profile_roles_catalog_and_flags(): void {
        $profile = $this->draft();

        $this->actingWith(['select', 'read', 'write'])->get(route('postingProfiles.show', $profile))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('Finances/PostingProfiles/Form')
                ->where('profile.id', $profile->id)
                ->where('profile.status', 'draft')
                ->where('profile.accounts.receivable.id', $this->receivable->id)
                ->where('profile.accounts.revenue.account_number', '4110')
                ->where('profile.accounts.receivable.thisModel', Account::class)
                ->where('profile.accounts.receivable.templateLink', ':account_number - :account_name')
                ->has('roles', count(AccountRole::cases()))
                ->where('canWrite', true)
                ->where('canActivate', false));
    }

    public function test_show_account_payload_is_limited_to_the_allowed_keys(): void {
        $profile = $this->service->createDraft('Profil', '2026-01-01', null, [AccountRole::Receivable->value => $this->receivable->id], [
            ['role' => 'revenue', 'account_id' => $this->other->id, 'document_type' => 'sales_invoice', 'variant' => 'return'],
        ]);
        $allowed = ['id', 'account_number', 'account_name', 'is_group', 'is_disabled', 'deleted_at', 'thisModel', 'templateLink', 'route', 'keyModel'];

        $this->actingWith(['select', 'read'])->get(route('postingProfiles.show', $profile))
            ->assertInertia(function ($page) use ($allowed) {
                $props = $page->toArray()['props'];
                foreach ([$props['profile']['accounts']['receivable'], $props['profile']['rules'][0]['account']] as $account) {
                    $this->assertEmpty(array_diff(array_keys($account), $allowed), 'Payload akun memuat kunci di luar daftar yang diizinkan.');
                    $this->assertArrayNotHasKey('balance_amount', $account);
                }
            });
    }

    public function test_show_marks_soft_deleted_accounts_with_deleted_at(): void {
        $profile = $this->draft();
        $this->receivable->delete();

        $this->actingWith(['select', 'read'])->get(route('postingProfiles.show', $profile))
            ->assertInertia(fn ($page) => $page
                ->whereNot('profile.accounts.receivable.deleted_at', null)
                ->where('profile.accounts.revenue.deleted_at', null));
    }

    public function test_show_warns_about_required_roles_only_for_document_types_not_off(): void {
        $profile = $this->draft(); // hanya receivable dan revenue
        $this->setModes(['sales_invoice' => 'shadow', 'purchase_receipt' => 'on']);

        $this->actingWith(['select', 'read'])->get(route('postingProfiles.show', $profile))
            ->assertInertia(fn ($page) => $page
                ->has('unmapped', 1)
                ->where('unmapped.0.document_type', 'purchase_receipt')
                ->where('unmapped.0.roles', ['stock', 'stock_received_but_not_billed']));
    }

    public function test_show_has_no_unmapped_warning_when_every_type_is_off(): void {
        $profile = $this->draft();

        $this->actingWith(['select', 'read'])->get(route('postingProfiles.show', $profile))
            ->assertInertia(fn ($page) => $page->where('unmapped', []));
    }

    public function test_show_lists_conditional_rules_read_only(): void {
        $profile = $this->service->createDraft('Profil', '2026-01-01', null, [], [
            ['role' => 'revenue', 'account_id' => $this->other->id, 'document_type' => 'sales_invoice', 'variant' => 'return', 'priority' => 2],
        ]);

        $this->actingWith(['select', 'read'])->get(route('postingProfiles.show', $profile))
            ->assertInertia(fn ($page) => $page
                ->has('profile.rules', 1)
                ->where('profile.rules.0.variant', 'return')
                ->where('profile.rules.0.account.id', $this->other->id)
                ->where('profile.rules.0.account.thisModel', Account::class));
    }

    public function test_form_requires_write_permission(): void {
        $this->actingWith(['select', 'read'])->get(route('postingProfiles.form'))->assertForbidden();
        $this->actingWith(['select', 'read', 'write'])->get(route('postingProfiles.form'))->assertOk();
    }

    public function test_save_creates_draft_through_the_service(): void {
        $this->actingWith(['select', 'write'])->post(route('postingProfiles.save'), [
            'name'           => 'Profil Baru',
            'effective_from' => '2026-01-01',
            'effective_to'   => null,
            'notes'          => 'catatan',
            'accounts'       => ['receivable' => $this->receivable->id, 'revenue' => $this->revenue->id, 'payable' => null],
        ])->assertRedirect();

        $profile = PostingProfile::query()->where('name', 'Profil Baru')->firstOrFail();
        $this->assertSame('draft', $profile->status);
        $this->assertSame(1, $profile->version);
        $this->assertEqualsCanonicalizing(['receivable', 'revenue'], $profile->accounts()->pluck('role')->all());
    }

    public function test_save_requires_write_permission(): void {
        $this->actingWith(['select', 'read'])->post(route('postingProfiles.save'), [
            'name' => 'X', 'effective_from' => '2026-01-01',
        ])->assertForbidden();

        $this->assertSame(0, PostingProfile::query()->count());
    }

    public function test_save_validates_required_fields_and_dates(): void {
        $this->actingWith(['select', 'write'])->post(route('postingProfiles.save'), [])->assertSessionHasErrors(['name', 'effective_from']);
        $this->actingWith(['select', 'write'])->post(route('postingProfiles.save'), [
            'name' => 'X', 'effective_from' => '2026-06-01', 'effective_to' => '2026-01-01',
        ])->assertSessionHasErrors('effective_to');
        $this->actingWith(['select', 'write'])->post(route('postingProfiles.save'), [
            'name' => 'X', 'effective_from' => 'bukan-tanggal',
        ])->assertSessionHasErrors('effective_from');

        $this->assertSame(0, PostingProfile::query()->count());
    }

    public function test_save_rejects_unknown_input_and_cannot_set_status_or_version(): void {
        $this->actingWith(['select', 'write'])->post(route('postingProfiles.save'), [
            'name'                => 'Nakal',
            'effective_from'      => '2026-01-01',
            'status'              => 'active',
            'version'             => 9,
            'previous_profile_id' => 'x',
            'branch_id'           => 'x',
        ])->assertSessionHasErrors(['status', 'version', 'previous_profile_id', 'branch_id']);

        $this->assertSame(0, PostingProfile::query()->count());
    }

    public function test_save_rejects_unknown_role_keys(): void {
        $this->actingWith(['select', 'write'])->post(route('postingProfiles.save'), [
            'name' => 'X', 'effective_from' => '2026-01-01', 'accounts' => ['tidak_ada' => $this->receivable->id],
        ])->assertSessionHasErrors('accounts.tidak_ada');

        $this->assertSame(0, PostingProfile::query()->count());
    }

    public function test_save_rejects_group_and_disabled_accounts_via_the_service(): void {
        $group = Account::create(['account_name' => 'Grup', 'account_number' => '1000', 'root_type' => 'asset', 'report_type' => 'balance_sheet', 'balance_type' => 'debit', 'is_group' => true]);
        $this->actingWith(['select', 'write'])->post(route('postingProfiles.save'), [
            'name' => 'X', 'effective_from' => '2026-01-01', 'accounts' => ['receivable' => $group->id],
        ])->assertSessionHasErrors('profile');

        $this->other->update(['is_disabled' => true]);
        $this->actingWith(['select', 'write'])->post(route('postingProfiles.save'), [
            'name' => 'X', 'effective_from' => '2026-01-01', 'accounts' => ['revenue' => $this->other->id],
        ])->assertSessionHasErrors('profile');

        $this->assertSame(0, PostingProfile::query()->count());
    }

    public function test_save_rejects_unknown_account_id(): void {
        $this->actingWith(['select', 'write'])->post(route('postingProfiles.save'), [
            'name' => 'X', 'effective_from' => '2026-01-01', 'accounts' => ['receivable' => '01ARZ3NDEKTSV4RRFFQ69G5FAV'],
        ])->assertSessionHasErrors('profile');

        $this->assertSame(0, PostingProfile::query()->count());
    }

    public function test_update_changes_draft_and_keeps_custom_roles(): void {
        $profile = $this->service->createDraft('Awal', '2026-01-01', null, [
            'receivable' => $this->receivable->id,
            'custom_tax' => $this->other->id,
        ]);

        $this->actingWith(['select', 'read', 'write'])->put(route('postingProfiles.update', $profile), [
            'name'           => 'Diubah',
            'effective_from' => '2026-02-01',
            'accounts'       => ['revenue' => $this->revenue->id],
        ])->assertRedirect();

        $profile->refresh();
        $this->assertSame('Diubah', $profile->name);
        $this->assertSame('2026-02-01', $profile->effective_from->toDateString());
        $this->assertEqualsCanonicalizing(['revenue', 'custom_tax'], $profile->accounts()->pluck('role')->all());
    }

    public function test_update_without_accounts_key_keeps_the_existing_mapping(): void {
        $profile = $this->draft();

        $this->actingWith(['select', 'read', 'write'])->put(route('postingProfiles.update', $profile), [
            'name' => 'Ganti Nama', 'effective_from' => '2026-01-01',
        ])->assertRedirect();

        $profile->refresh();
        $this->assertSame('Ganti Nama', $profile->name);
        $this->assertEqualsCanonicalizing(['receivable', 'revenue'], $profile->accounts()->pluck('role')->all());
    }

    public function test_index_exposes_can_read_flag(): void {
        $this->actingWith(['select'])->get(route('postingProfiles.index'))->assertInertia(fn ($page) => $page->where('canRead', false));
        $this->actingWith(['select', 'read'])->get(route('postingProfiles.index'))->assertInertia(fn ($page) => $page->where('canRead', true));
    }

    public function test_update_cannot_write_an_active_profile(): void {
        $profile = $this->active();

        $this->actingWith(['select', 'read', 'write'])->put(route('postingProfiles.update', $profile), [
            'name'           => 'Dibajak',
            'effective_from' => '2030-01-01',
            'accounts'       => ['receivable' => $this->other->id],
        ])->assertSessionHasErrors('profile');

        $profile->refresh();
        $this->assertSame('Aktif', $profile->name);
        $this->assertSame('2026-01-01', $profile->effective_from->toDateString());
        $this->assertSame($this->receivable->id, $profile->accounts()->where('role', 'receivable')->value('account_id'));
    }

    public function test_update_cannot_smuggle_status_through_the_request(): void {
        $profile = $this->draft();

        $this->actingWith(['select', 'read', 'write'])->put(route('postingProfiles.update', $profile), [
            'name' => 'X', 'effective_from' => '2026-01-01', 'status' => 'active',
        ])->assertSessionHasErrors('status');

        $this->assertSame('draft', $profile->refresh()->status);
    }

    public function test_update_requires_write_permission(): void {
        $profile = $this->draft();

        $this->actingWith(['select', 'read'])->put(route('postingProfiles.update', $profile), [
            'name' => 'X', 'effective_from' => '2026-01-01',
        ])->assertForbidden();

        $this->assertSame('Profil', $profile->refresh()->name);
    }

    public function test_discard_deletes_only_drafts(): void {
        $draft  = $this->draft('2027-01-01', null, 'Draft');
        $active = $this->active();

        $this->actingWith(['select', 'write'])->delete(route('postingProfiles.discard', $draft))->assertRedirect(route('postingProfiles.index'));
        $this->assertNull(PostingProfile::query()->find($draft->id));

        $this->actingWith(['select', 'write'])->delete(route('postingProfiles.discard', $active))->assertSessionHasErrors('profile');
        $this->assertNotNull(PostingProfile::query()->find($active->id));
    }

    public function test_discard_requires_write_permission(): void {
        $draft = $this->draft();

        $this->actingWith(['select', 'read', 'activate'])->delete(route('postingProfiles.discard', $draft))->assertForbidden();
        $this->assertNotNull(PostingProfile::query()->find($draft->id));
    }

    public function test_new_version_copies_accounts_and_rules_into_a_draft(): void {
        $source = $this->service->createDraft('Dasar', '2026-01-01', null, [
            'receivable' => $this->receivable->id,
        ], [
            ['role' => 'revenue', 'account_id' => $this->other->id, 'document_type' => 'sales_invoice', 'variant' => 'return', 'priority' => 1],
        ]);
        $this->service->activate($source);

        $this->actingWith(['select', 'read', 'write'])->post(route('postingProfiles.newVersion', $source), [
            'effective_from' => '2026-07-01',
        ])->assertRedirect();

        $copy = PostingProfile::query()->where('previous_profile_id', $source->id)->firstOrFail();
        $this->assertSame('draft', $copy->status);
        $this->assertSame(2, $copy->version);
        $this->assertSame('2026-07-01', $copy->effective_from->toDateString());
        $this->assertSame(['receivable'], $copy->accounts()->pluck('role')->all());
        $this->assertSame(1, $copy->rules()->count());
        $this->assertSame('active', $source->refresh()->status, 'Profil lama tetap aktif sampai versi baru diaktifkan.');
    }

    public function test_new_version_requires_write_and_a_non_draft_source(): void {
        $draft = $this->draft();

        $this->actingWith(['select', 'read'])->post(route('postingProfiles.newVersion', $this->active('2025-01-01', '2025-12-31', 'Lama')), [
            'effective_from' => '2026-01-01',
        ])->assertForbidden();

        $this->actingWith(['select', 'write'])->post(route('postingProfiles.newVersion', $draft), [
            'effective_from' => '2027-01-01',
        ])->assertSessionHasErrors('profile');

        $this->assertSame(0, PostingProfile::query()->whereNotNull('previous_profile_id')->count());
    }

    public function test_new_version_requires_effective_from_and_rejects_unknown_input(): void {
        $source = $this->active();

        $this->actingWith(['select', 'write'])->post(route('postingProfiles.newVersion', $source), [])->assertSessionHasErrors('effective_from');
        $this->actingWith(['select', 'write'])->post(route('postingProfiles.newVersion', $source), [
            'effective_from' => '2026-07-01', 'status' => 'active',
        ])->assertSessionHasErrors('status');

        $this->assertSame(0, PostingProfile::query()->whereNotNull('previous_profile_id')->count());
    }

    public function test_activate_requires_the_activate_permission(): void {
        $profile = $this->draft();

        $this->actingWith(['select', 'read', 'write'])->put(route('postingProfiles.activate', $profile))->assertForbidden();
        $this->assertSame('draft', $profile->refresh()->status);

        $this->actingWith(['select', 'read', 'activate'])->put(route('postingProfiles.activate', $profile))->assertRedirect();
        $this->assertSame('active', $profile->refresh()->status);
    }

    public function test_activate_rejects_overlapping_profiles_with_a_message(): void {
        $this->active('2026-01-01', null, 'Aktif');
        $other = $this->draft('2026-06-01', null, 'Tumpang');

        $this->actingWith(['select', 'activate'])->put(route('postingProfiles.activate', $other))->assertSessionHasErrors('profile');

        $this->assertSame('draft', $other->refresh()->status);
    }

    public function test_activate_of_a_new_version_closes_the_previous_profile(): void {
        $source = $this->active('2026-01-01', null, 'V1');
        $copy   = $this->service->createNewVersion($source, '2026-07-01');

        $this->actingWith(['select', 'activate'])->put(route('postingProfiles.activate', $copy))->assertRedirect();

        $this->assertSame('active', $copy->refresh()->status);
        $this->assertSame('2026-06-30', $source->refresh()->effective_to->toDateString());
    }

    public function test_retire_requires_the_activate_permission(): void {
        $profile = $this->active();

        $this->actingWith(['select', 'read', 'write'])->put(route('postingProfiles.retire', $profile))->assertForbidden();
        $this->assertSame('active', $profile->refresh()->status);
    }

    public function test_retire_flashes_the_date_gap_warning(): void {
        $profile = $this->active('2026-01-01', '2026-12-31');

        $this->actingWith(['select', 'activate'])->put(route('postingProfiles.retire', $profile))
            ->assertRedirect()
            ->assertSessionHas('retireWarnings', fn (array $warnings): bool => count($warnings) === 1 && str_contains($warnings[0], '2026-01-01') && str_contains($warnings[0], '2026-12-31'));

        $this->assertSame('retired', $profile->refresh()->status);
    }

    public function test_retire_only_applies_to_active_profiles(): void {
        $draft = $this->draft();

        $this->actingWith(['select', 'activate'])->put(route('postingProfiles.retire', $draft))->assertSessionHasErrors('profile');

        $this->assertSame('draft', $draft->refresh()->status);
    }

    public function test_controllers_never_write_models_directly(): void {
        // Model $guarded = ['*'] dan seluruh penulisan harus lewat service (otorisasi, validasi, audit).
        foreach (['PostingProfileController', 'PostingParityLogController'] as $controller) {
            $source = file_get_contents(app_path("Http/Controllers/Finances/{$controller}.php"));

            $this->assertDoesNotMatchRegularExpression('/::(create|forceCreate|updateOrCreate|insert)\(|->(fill|forceFill|update|delete|save|insert)\(|fillForUpdate/', $source, $controller);
        }
    }
}
