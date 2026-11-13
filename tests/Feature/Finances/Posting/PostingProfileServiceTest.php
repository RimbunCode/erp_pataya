<?php

namespace Tests\Feature\Finances\Posting;

use App\Enums\AccountRole;
use App\Events\Core\AuditableModelSaved;
use App\Exceptions\Finances\InvalidPostingProfileException;
use App\Exceptions\Finances\InvalidPostingRuleException;
use App\Models\Finances\Account;
use App\Models\Finances\PostingProfile;
use App\Models\Finances\PostingProfileRule;
use App\Models\Inventory\Category;
use App\Services\Finances\Posting\PostingProfileService;
use Illuminate\Database\Eloquent\MassAssignmentException;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Str;
use Tests\Support\BuildsFinanceFixtures;
use Tests\TestCase;

/**
 * Finance Fase 2, Task 3.1: siklus hidup Posting Profile (Requirement 2.2-2.4, 12.5-12.6; P-3: dua profil `active`
 * tumpang-tindih tidak dapat dibuat).
 */
class PostingProfileServiceTest extends TestCase {
    use BuildsFinanceFixtures, RefreshDatabase;

    private PostingProfileService $service;
    private Account $receivable;
    private Account $revenue;
    private Account $revenueReturn;
    private Account $expense;

    protected function setUp(): void {
        parent::setUp();

        $this->setUpFinanceFixtures([PostingProfile::class]);
        $this->service       = app(PostingProfileService::class);
        $this->receivable    = $this->makeAccount('1231', 'Piutang Dagang', 'asset', 'debit', 'receivable');
        $this->revenue       = $this->makeAccount('4110', 'Penjualan', 'income', 'credit', 'income_account');
        $this->revenueReturn = $this->makeAccount('4120', 'Retur Penjualan', 'income', 'credit', 'income_account');
        $this->expense       = $this->makeAccount('5210', 'Beban Umum', 'expense', 'debit');
    }

    private function draft(string $from = '2026-01-01', ?string $to = null, string $name = 'Profil'): PostingProfile {
        return $this->service->createDraft($name, $from, $to, [
            AccountRole::Receivable->value => $this->receivable->id,
            AccountRole::Revenue->value    => $this->revenue->id,
        ]);
    }

    private function category(): string {
        $id = (string) Str::ulid();
        DB::table('categories')->insert(['id' => $id, 'name' => 'Kategori', 'created_at' => now(), 'updated_at' => now()]);

        return $id;
    }

    public function test_create_draft_stores_profile_accounts_and_rules(): void {
        $profile = $this->service->createDraft('Profil A', '2026-01-01', null, [
            'receivable' => $this->receivable->id,
            'custom_tax' => $this->expense->id, // peran kustom di luar enum (Requirement 1.3)
        ], [
            ['role' => 'revenue', 'account_id' => $this->revenueReturn->id, 'document_type' => 'sales_invoice', 'variant' => 'return', 'priority' => 3],
        ], 'catatan');

        $this->assertSame(PostingProfile::STATUS_DRAFT, $profile->status);
        $this->assertSame(1, $profile->version);
        $this->assertNull($profile->previous_profile_id);
        $this->assertSame('2026-01-01', $profile->effective_from->toDateString());
        $this->assertNull($profile->effective_to);
        $this->assertSame('catatan', $profile->notes);
        $this->assertEqualsCanonicalizing(['receivable', 'custom_tax'], $profile->accounts()->pluck('role')->all());

        $rule = $profile->rules()->firstOrFail();
        $this->assertSame('return', $rule->variant);
        $this->assertSame(3, $rule->priority);
        $this->assertNull($rule->is_stock_item);
        $this->assertSame(1, $rule->specificity() - 1, 'document_type + variant = 2 kondisi');
    }

    /**
     * Mass assignment ditolak (MassAssignmentException bila aplikasi melarang pembuangan diam-diam) atau diabaikan.
     */
    private function attemptFill(Model $model, array $attributes): void {
        try {
            $model->fill($attributes);
        } catch (MassAssignmentException) {
            // diharapkan
        }
    }

    public function test_profile_cannot_be_mass_assigned(): void {
        $profile = new PostingProfile;
        $this->attemptFill($profile, ['name' => 'X', 'effective_from' => '2026-01-01', 'status' => 'active', 'version' => 9]);

        $this->assertNull($profile->name);
        $this->assertNull($profile->status);
        $this->assertNull($profile->version);
    }

    public function test_invalid_date_range_is_rejected(): void {
        $this->expectException(InvalidPostingProfileException::class);

        $this->service->createDraft('X', '2026-02-01', '2026-01-01');
    }

    public function test_group_disabled_deleted_and_missing_accounts_are_rejected_on_profile_accounts(): void {
        $group    = Account::create(['account_name' => 'Grup', 'account_number' => '1000', 'root_type' => 'asset', 'report_type' => 'balance_sheet', 'balance_type' => 'debit', 'is_group' => true]);
        $disabled = $this->makeAccount('1900', 'Nonaktif', 'asset');
        $disabled->update(['is_disabled' => true]);
        $deleted = $this->makeAccount('1901', 'Terhapus', 'asset');
        $deleted->delete();

        foreach ([$group->id, $disabled->id, $deleted->id, (string) Str::ulid()] as $accountId) {
            try {
                $this->service->createDraft('X', '2026-01-01', null, ['receivable' => $accountId]);
                $this->fail('Akun tidak valid seharusnya ditolak.');
            } catch (InvalidPostingProfileException $e) {
                $this->assertStringContainsString('receivable', $e->getMessage());
            }
        }

        $this->assertSame(0, PostingProfile::query()->count(), 'Penolakan menggulung transaksi.');
    }

    public function test_activation_rejects_overlapping_active_profiles(): void {
        $first = $this->service->activate($this->draft('2026-01-01', '2026-12-31', 'A'));
        $this->assertSame(PostingProfile::STATUS_ACTIVE, $first->status);

        $overlapping = $this->draft('2026-06-01', null, 'B');
        try {
            $this->service->activate($overlapping);
            $this->fail('Profil tumpang-tindih seharusnya ditolak.');
        } catch (InvalidPostingProfileException $e) {
            $this->assertStringContainsString('A', $e->getMessage());
        }
        $this->assertSame(PostingProfile::STATUS_DRAFT, $overlapping->refresh()->status);

        // Tidak beririsan: boleh aktif bersamaan.
        $next = $this->service->activate($this->draft('2027-01-01', null, 'C'));
        $this->assertSame(PostingProfile::STATUS_ACTIVE, $next->status);
        $this->assertSame(2, PostingProfile::query()->where('status', 'active')->count());
    }

    public function test_open_ended_active_profile_blocks_any_later_overlap(): void {
        $this->service->activate($this->draft('2026-01-01', null, 'A'));

        $this->expectException(InvalidPostingProfileException::class);
        $this->service->activate($this->draft('2030-01-01', null, 'Z'));
    }

    public function test_draft_overlap_is_allowed_until_activation(): void {
        $this->service->activate($this->draft('2026-01-01', null, 'A'));

        $draft = $this->draft('2026-06-01', null, 'B');

        $this->assertSame(PostingProfile::STATUS_DRAFT, $draft->status);
    }

    public function test_activation_revalidates_accounts_disabled_after_drafting(): void {
        $draft = $this->draft();
        $this->receivable->update(['is_disabled' => true]);

        $this->expectException(InvalidPostingProfileException::class);
        $this->service->activate($draft);
    }

    public function test_only_draft_profiles_can_be_activated_edited_or_deleted(): void {
        $active = $this->service->activate($this->draft());

        foreach ([
            fn () => $this->service->activate($active),
            fn () => $this->service->updateDraft($active, ['name' => 'Baru']),
            fn () => $this->service->setAccount($active, 'payable', $this->expense->id),
            fn () => $this->service->addRule($active, ['role' => 'revenue', 'account_id' => $this->revenue->id]),
            fn () => $this->service->deleteDraft($active),
        ] as $attempt) {
            try {
                $attempt();
                $this->fail('Profil aktif tidak boleh diubah di tempat.');
            } catch (InvalidPostingProfileException $e) {
                $this->assertStringContainsString('active', $e->getMessage());
            }
        }

        $this->assertSame('Profil', $active->refresh()->name);
        $this->assertSame(2, $active->accounts()->count());
    }

    public function test_update_draft_replaces_accounts_and_rules(): void {
        $profile = $this->draft();

        $this->service->updateDraft(
            $profile,
            ['name'    => 'Diubah', 'effective_to' => '2026-12-31'],
            ['payable' => $this->expense->id],
            [['role' => 'revenue', 'account_id' => $this->revenueReturn->id, 'variant' => 'return']],
        );

        $profile->refresh();
        $this->assertSame('Diubah', $profile->name);
        $this->assertSame('2026-12-31', $profile->effective_to->toDateString());
        $this->assertSame(['payable'], $profile->accounts()->pluck('role')->all());
        $this->assertSame(1, $profile->rules()->count());
    }

    public function test_set_account_replaces_the_account_of_an_existing_role(): void {
        $profile = $this->draft();

        $this->service->setAccount($profile, AccountRole::Receivable, $this->expense->id);
        $this->service->setAccount($profile, AccountRole::Payable, $this->expense->id);

        $accounts = $profile->accounts()->pluck('account_id', 'role')->all();
        $this->assertSame($this->expense->id, $accounts['receivable']);
        $this->assertSame($this->expense->id, $accounts['payable']);
        $this->assertCount(3, $accounts);
    }

    public function test_delete_draft_removes_profile_accounts_and_rules(): void {
        $profile = $this->service->createDraft('Hapus', '2026-01-01', null, ['receivable' => $this->receivable->id], [
            ['role' => 'revenue', 'account_id' => $this->revenue->id],
        ]);

        $this->service->deleteDraft($profile);

        $this->assertSame(0, PostingProfile::query()->count());
        $this->assertSame(0, DB::table('posting_profile_accounts')->count());
        $this->assertSame(0, DB::table('posting_profile_rules')->count());
    }

    public function test_new_version_copies_accounts_and_rules_and_closes_the_previous_profile_on_activation(): void {
        $v1 = $this->service->createDraft('Profil', '2026-01-01', null, [
            'receivable' => $this->receivable->id,
            'revenue'    => $this->revenue->id,
        ], [
            ['role' => 'revenue', 'account_id' => $this->revenueReturn->id, 'document_type' => 'sales_invoice', 'variant' => 'return'],
            ['role' => 'expense', 'account_id' => $this->expense->id, 'is_stock_item' => false],
        ]);
        $this->service->activate($v1);

        $v2 = $this->service->createNewVersion($v1, '2026-07-01');

        $this->assertSame(PostingProfile::STATUS_DRAFT, $v2->status);
        $this->assertSame(2, $v2->version);
        $this->assertSame($v1->id, $v2->previous_profile_id);
        $this->assertEqualsCanonicalizing($v1->accounts()->pluck('account_id', 'role')->all(), $v2->accounts()->pluck('account_id', 'role')->all());
        $this->assertSame(2, $v2->rules()->count());
        $this->assertNotEquals($v1->rules()->pluck('id')->all(), $v2->rules()->pluck('id')->all(), 'Aturan disalin sebagai baris baru.');
        $copied = $v2->rules()->where('role', 'expense')->firstOrFail();
        $this->assertFalse($copied->is_stock_item);

        $this->service->activate($v2);

        $this->assertSame('2026-06-30', $v1->refresh()->effective_to->toDateString());
        $this->assertSame(PostingProfile::STATUS_ACTIVE, $v1->status, 'Versi lama tetap aktif untuk tanggal sebelum cutover.');
        $this->assertSame(PostingProfile::STATUS_ACTIVE, $v2->refresh()->status);
    }

    public function test_new_version_not_after_the_previous_one_cannot_replace_it(): void {
        $v1 = $this->service->activate($this->draft('2026-06-01', null, 'Profil'));
        $v2 = $this->service->createNewVersion($v1, '2026-01-01');

        $this->expectException(InvalidPostingProfileException::class);
        $this->service->activate($v2);
    }

    public function test_activation_of_a_copy_still_rejects_overlap_with_other_active_profiles(): void {
        $first = $this->service->activate($this->draft('2026-01-01', '2026-12-31', 'A'));
        $this->service->activate($this->draft('2027-01-01', '2027-12-31', 'B'));

        $copy = $this->service->createNewVersion($first, '2027-01-01');

        try {
            $this->service->activate($copy);
            $this->fail('Irisan dengan profil aktif lain harus ditolak.');
        } catch (InvalidPostingProfileException $e) {
            $this->assertStringContainsString('B', $e->getMessage());
        }
        $this->assertSame('2026-12-31', $first->effective_to->toDateString(), 'Transaksi digulung: profil lama tidak ditutup.');
    }

    public function test_new_version_ending_before_the_previous_profile_is_rejected_to_avoid_a_gap(): void {
        $v1 = $this->service->activate($this->draft('2026-01-01', null, 'P'));
        $v2 = $this->service->createNewVersion($v1, '2026-07-01', '2026-09-30');

        try {
            $this->service->activate($v2);
            $this->fail('Versi baru yang berakhir lebih awal dari profil lama menciptakan celah.');
        } catch (InvalidPostingProfileException $e) {
            $this->assertStringContainsString(__('finances/postingProfile.open_ended'), $e->getMessage());
        }
        $this->assertNull($v1->refresh()->effective_to, 'Profil lama tidak berubah.');
        $this->assertSame(PostingProfile::STATUS_DRAFT, $v2->refresh()->status);
    }

    public function test_new_version_ending_before_a_bounded_previous_profile_is_rejected_as_not_contiguous(): void {
        $v1    = $this->service->activate($this->draft('2026-01-01', '2026-12-31', 'P'));
        $short = $this->service->createNewVersion($v1, '2026-07-01', '2026-10-31');

        try {
            $this->service->activate($short);
            $this->fail('Versi yang tidak bersambung seharusnya ditolak.');
        } catch (InvalidPostingProfileException $e) {
            $this->assertSame(__('finances/postingProfile.errors.version_not_contiguous', ['from' => '2027-01-01']), $e->getMessage());
        }
        $this->assertSame('2026-12-31', $v1->refresh()->effective_to->toDateString());
    }

    public function test_new_version_ending_on_or_after_the_previous_end_is_accepted(): void {
        $v1   = $this->service->activate($this->draft('2026-01-01', '2026-12-31', 'P'));
        $same = $this->service->createNewVersion($v1, '2027-01-01', '2027-12-31');

        $this->service->activate($same);

        $this->assertSame('2026-12-31', $v1->refresh()->effective_to->toDateString());
    }

    public function test_new_version_cannot_start_on_or_before_the_previous_profile_start(): void {
        $v1 = $this->service->activate($this->draft('2026-06-01', null, 'P'));

        foreach (['2026-06-01', '2026-01-01'] as $from) {
            $copy = $this->service->createNewVersion($v1, $from);
            try {
                $this->service->activate($copy);
                $this->fail("Versi baru berawal {$from} harus ditolak.");
            } catch (InvalidPostingProfileException $e) {
                $this->assertStringContainsString('2026-06-01', $e->getMessage());
            }
            $this->service->deleteDraft($copy);
        }
        $this->assertNull($v1->refresh()->effective_to);
    }

    public function test_retire_only_applies_to_active_profiles(): void {
        $draft = $this->draft();

        try {
            $this->service->retire($draft);
            $this->fail('Draft tidak dapat dipensiunkan.');
        } catch (InvalidPostingProfileException) {
            // diharapkan
        }

        $active = $this->service->activate($draft);
        $this->assertSame(PostingProfile::STATUS_RETIRED, $this->service->retire($active)->status);
    }

    public function test_activate_and_retire_are_audited(): void {
        Event::fake([AuditableModelSaved::class]);

        $profile = $this->service->activate($this->draft());
        $this->service->retire($profile);

        Event::assertDispatched(AuditableModelSaved::class, fn (AuditableModelSaved $event) => $event->action === 'activated'
            && $event->dataBefore['status'] === 'draft' && $event->dataAfter['status'] === 'active');
        Event::assertDispatched(AuditableModelSaved::class, fn (AuditableModelSaved $event) => $event->action === 'retired');
    }

    public function test_activation_and_retirement_audit_actions_are_known_to_the_audit_log_listener(): void {
        $profile = $this->draft();
        $this->service->activate($profile);

        $this->assertDatabaseHas('logs', ['loggable_id' => $profile->id, 'action' => 'activated']);
    }

    public function test_draft_operations_are_audited_with_account_and_rule_snapshots(): void {
        Event::fake([AuditableModelSaved::class]);
        $profile = $this->draft();

        $this->service->setAccount($profile, 'payable', $this->expense->id);
        $this->service->addRule($profile, ['role' => 'revenue', 'account_id' => $this->revenueReturn->id, 'variant' => 'return']);
        $this->service->updateDraft($profile, ['name' => 'Baru'], ['payable' => $this->expense->id]);

        Event::assertDispatched(AuditableModelSaved::class, fn (AuditableModelSaved $e) => $e->action === 'updated'
            && ! isset($e->dataBefore['accounts']['payable']) && ($e->dataAfter['accounts']['payable'] ?? null) === $this->expense->id);
        Event::assertDispatched(AuditableModelSaved::class, fn (AuditableModelSaved $e) => $e->action === 'updated'
            && \count($e->dataBefore['rules'] ?? []) === 0 && \count($e->dataAfter['rules'] ?? []) === 1);
        Event::assertDispatched(AuditableModelSaved::class, fn (AuditableModelSaved $e) => $e->action === 'updated'
            && ($e->dataAfter['name'] ?? null) === 'Baru');

        $this->service->deleteDraft($profile);
        Event::assertDispatched(AuditableModelSaved::class, fn (AuditableModelSaved $e) => $e->action === 'deleted'
            && $e->dataBefore['name'] === 'Baru' && $e->dataAfter === []);
    }

    public function test_activation_audit_carries_mappings_and_closing_the_previous_profile_is_audited(): void {
        $v1 = $this->service->activate($this->draft('2026-01-01', null, 'P'));
        $v2 = $this->service->createNewVersion($v1, '2026-07-01');
        Event::fake([AuditableModelSaved::class]);

        $this->service->activate($v2);

        Event::assertDispatched(AuditableModelSaved::class, fn (AuditableModelSaved $e) => $e->action === 'activated'
            && $e->dataAfter['status'] === 'active' && \count($e->dataAfter['accounts']) === 2 && isset($e->dataAfter['rules']));
        Event::assertDispatched(AuditableModelSaved::class, fn (AuditableModelSaved $e) => $e->action === 'updated'
            && $e->model->is($v1) && $e->dataBefore['effective_to'] === null && $e->dataAfter['effective_to'] === '2026-06-30');
    }

    public function test_audit_log_rows_are_written_for_draft_edits(): void {
        $profile = $this->draft();
        $this->service->setAccount($profile, 'payable', $this->expense->id);

        $this->assertDatabaseHas('logs', ['loggable_id' => $profile->id, 'action' => 'updated']);
    }

    public function test_rule_priority_lengths_item_type_and_category_are_validated_with_domain_exceptions(): void {
        $profile         = $this->draft();
        $deletedCategory = $this->category();
        DB::table('categories')->where('id', $deletedCategory)->update(['deleted_at' => now()]);

        $cases = [
            ['priority' => -1],
            ['priority'         => 4294967296],
            ['role'             => str_repeat('x', 65)],
            ['item_type'        => str_repeat('x', 65)],
            ['item_type'        => 'barang-aneh'],
            ['item_category_id' => $deletedCategory],
        ];
        foreach ($cases as $invalid) {
            try {
                $this->service->addRule($profile, ['role' => 'revenue', 'account_id' => $this->revenue->id, ...$invalid]);
                $this->fail('Seharusnya ditolak: ' . json_encode($invalid));
            } catch (InvalidPostingRuleException) {
                // diharapkan (bukan QueryException)
            }
        }
        $this->assertSame(0, $profile->rules()->count());

        foreach (PostingProfileService::ITEM_TYPES as $i => $type) {
            $this->service->addRule($profile, ['role' => 'revenue', 'account_id' => $this->revenue->id, 'item_type' => $type, 'priority' => $i]);
        }
        $this->assertSame(3, $profile->rules()->count());
    }

    public function test_priority_accepts_the_unsigned_int_maximum(): void {
        $profile = $this->draft();
        $this->service->addRule($profile, ['role' => 'revenue', 'account_id' => $this->revenue->id, 'priority' => 4294967295]);

        $this->assertSame(4294967295, $profile->rules()->firstOrFail()->priority);
    }

    public function test_activation_rejects_a_rule_category_soft_deleted_since_drafting(): void {
        $profile  = $this->draft();
        $category = $this->category();
        $this->service->addRule($profile, ['role' => 'revenue', 'account_id' => $this->revenue->id, 'item_category_id' => $category]);
        DB::table('categories')->where('id', $category)->update(['deleted_at' => now()]);

        try {
            $this->service->activate($profile);
            $this->fail('Aktivasi seharusnya ditolak');
        } catch (InvalidPostingRuleException) {
            // diharapkan
        }
        $this->assertSame(PostingProfile::STATUS_DRAFT, $profile->refresh()->status);
    }

    public function test_initial_mapping_and_new_version_copies_are_audited_with_snapshots(): void {
        Event::fake([AuditableModelSaved::class]);

        $v1 = $this->draft();
        Event::assertDispatched(AuditableModelSaved::class, fn (AuditableModelSaved $e) => $e->action === 'updated'
            && $e->model->is($v1) && $e->dataAfter['accounts'] === [
                AccountRole::Receivable->value => $this->receivable->id,
                AccountRole::Revenue->value    => $this->revenue->id,
            ]);

        $this->service->addRule($v1, ['role' => 'revenue', 'account_id' => $this->revenueReturn->id, 'variant' => 'return']);
        $active = $this->service->activate($v1);
        $copy   = $this->service->createNewVersion($active, '2026-07-01');
        Event::assertDispatched(AuditableModelSaved::class, fn (AuditableModelSaved $e) => $e->action === 'updated'
            && $e->model->is($copy) && \count($e->dataAfter['accounts']) === 2 && \count($e->dataAfter['rules']) === 1);
    }

    public function test_retired_action_writes_a_log_row(): void {
        $profile = $this->service->activate($this->draft());
        $this->service->retire($profile);

        $this->assertDatabaseHas('logs', ['loggable_id' => $profile->id, 'action' => 'retired']);
        $this->assertDatabaseHas('logs', ['loggable_id' => $profile->id, 'action' => 'activated']);
    }

    public function test_new_version_must_start_the_day_after_a_bounded_previous_profile_ends(): void {
        $v1 = $this->service->activate($this->draft('2026-01-01', '2026-06-30', 'A'));

        $gap = $this->service->createNewVersion($v1, '2026-08-01');
        try {
            $this->service->activate($gap);
            $this->fail('Celah seharusnya ditolak');
        } catch (InvalidPostingProfileException) {
            // diharapkan
        }
        $this->assertSame(PostingProfile::STATUS_DRAFT, $gap->refresh()->status);

        $overlap = $this->service->createNewVersion($v1, '2026-06-01');
        try {
            $this->service->activate($overlap);
            $this->fail('Tumpang-tindih seharusnya ditolak');
        } catch (InvalidPostingProfileException) {
            // diharapkan
        }

        $next = $this->service->createNewVersion($v1, '2026-07-01');
        $this->assertSame(PostingProfile::STATUS_ACTIVE, $this->service->activate($next)->status);
        $this->assertSame('2026-06-30', $v1->refresh()->effective_to->toDateString());
    }

    public function test_retiring_a_successor_that_leaves_a_gap_succeeds_with_a_warning(): void {
        $v1 = $this->service->activate($this->draft('2026-01-01', '2026-06-30', 'A'));
        $v2 = $this->service->activate($this->service->createNewVersion($v1, '2026-07-01', '2026-12-31'));
        $v3 = $this->service->activate($this->service->createNewVersion($v2, '2027-01-01'));

        $result = $this->service->retireWithWarnings($v2);

        $this->assertSame(PostingProfile::STATUS_RETIRED, $result['profile']->status);
        $this->assertCount(1, $result['warnings']);
        $this->assertSame('2026-07-01', $result['warnings'][0]['from']);
        $this->assertSame('2026-12-31', $result['warnings'][0]['to']);
        $this->assertStringContainsString('2026-07-01', $result['warnings'][0]['message']);

        $clean = $this->service->retireWithWarnings($v3);
        $this->assertSame([['from' => '2027-01-01', 'to' => null]], array_map(fn (array $w) => ['from' => $w['from'], 'to' => $w['to']], $clean['warnings']));
    }

    public function test_profile_account_role_length_is_limited(): void {
        $this->expectException(InvalidPostingProfileException::class);

        $this->service->createDraft('X', '2026-01-01', null, [str_repeat('x', 65) => $this->receivable->id]);
    }

    public function test_item_type_domain_matches_the_inventory_source(): void {
        $this->assertSame(Category::TYPES, PostingProfileService::ITEM_TYPES);
    }

    public function test_copying_a_draft_is_rejected(): void {
        $draft = $this->draft();

        try {
            $this->service->createNewVersion($draft, '2026-07-01');
            $this->fail('Salin dari draft harus ditolak.');
        } catch (InvalidPostingProfileException $e) {
            $this->assertSame(__('finances/postingProfile.errors.copy_draft'), $e->getMessage());
        }

        $this->assertSame(1, PostingProfile::query()->count());
    }

    public function test_draft_referenced_by_a_newer_version_cannot_be_deleted(): void {
        // Salin dari draft ditolak (Q-P2-16), jadi rujukan dibuat langsung pada data (mis. sisa data lama).
        $v1 = $this->draft();
        $v2 = $this->draft('2026-07-01', null, 'V2');
        DB::table('posting_profiles')->where('id', $v2->id)->update(['previous_profile_id' => $v1->id]);

        try {
            $this->service->deleteDraft($v1);
            $this->fail('Draft yang dirujuk versi baru tidak boleh dihapus.');
        } catch (InvalidPostingProfileException $e) {
            $this->assertStringContainsString(__('finances/postingProfile.errors.delete_referenced'), $e->getMessage());
        }
        $this->assertTrue(PostingProfile::query()->whereKey($v1->id)->exists());

        $this->service->deleteDraft($v2);
        $this->service->deleteDraft($v1);
        $this->assertSame(0, PostingProfile::query()->count());
    }

    public function test_models_reject_mass_assignment_of_every_column(): void {
        $profile = $this->draft();

        $this->attemptFill($profile, ['name' => 'Hack', 'status' => 'active', 'version' => 9, 'previous_profile_id' => 'x', 'effective_from' => '2000-01-01', 'notes' => 'x']);
        $this->assertSame('Profil', $profile->name);
        $this->assertSame('draft', $profile->status);
        $this->assertSame(1, $profile->version);

        $account = $profile->accounts()->firstOrFail();
        $this->attemptFill($account, ['account_id' => $this->expense->id, 'posting_profile_id' => 'x', 'role' => 'hack']);
        $this->assertNotSame('hack', $account->role);
        $this->assertNotSame($this->expense->id, $account->account_id);

        $this->service->addRule($profile, ['role' => 'revenue', 'account_id' => $this->revenue->id]);
        $rule = $profile->rules()->firstOrFail();
        $this->attemptFill($rule, ['account_id' => $this->expense->id, 'role' => 'hack', 'priority' => 99]);
        $this->assertSame($this->revenue->id, $rule->account_id);
        $this->assertSame(0, $rule->priority);
    }

    public function test_only_draft_profiles_can_be_deleted_via_the_model_guard(): void {
        $draft  = $this->draft();
        $active = $this->service->activate($this->draft('2027-01-01', null, 'Lain'));

        $this->assertTrue($draft->canDelete());
        $this->assertFalse($active->canDelete());
    }

    public function test_rule_requires_non_group_enabled_account(): void {
        $profile = $this->draft();
        $group   = Account::create(['account_name' => 'Grup', 'account_number' => '4000', 'root_type' => 'income', 'report_type' => 'profit_and_loss', 'balance_type' => 'credit', 'is_group' => true]);

        $this->expectException(InvalidPostingRuleException::class);
        $this->service->addRule($profile, ['role' => 'revenue', 'account_id' => $group->id]);
    }

    public function test_rule_duplicate_conditions_are_rejected_even_with_null_conditions(): void {
        $profile = $this->draft();
        $this->service->addRule($profile, ['role' => 'expense', 'account_id' => $this->expense->id, 'is_stock_item' => false]);

        // Kombinasi kondisi identik (termasuk kolom NULL) ditolak walau indeks DB tidak menangkap NULL.
        try {
            $this->service->addRule($profile, ['role' => 'expense', 'account_id' => $this->revenue->id, 'is_stock_item' => false, 'priority' => 9]);
            $this->fail('Duplikat kondisi seharusnya ditolak.');
        } catch (InvalidPostingRuleException $e) {
            $this->assertStringContainsString('expense', $e->getMessage());
        }

        // Kombinasi berbeda, atau peran berbeda dengan kondisi sama, boleh.
        $this->service->addRule($profile, ['role' => 'expense', 'account_id' => $this->expense->id, 'is_stock_item' => true]);
        $this->service->addRule($profile, ['role' => 'expense', 'account_id' => $this->expense->id]);
        $this->service->addRule($profile, ['role' => 'revenue', 'account_id' => $this->revenue->id, 'is_stock_item' => false]);
        $this->assertSame(4, $profile->rules()->count());

        // Tanpa kondisi sama sekali juga tidak boleh ganda.
        $this->expectException(InvalidPostingRuleException::class);
        $this->service->addRule($profile, ['role' => 'expense', 'account_id' => $this->revenue->id]);
    }

    public function test_item_conditions_are_only_allowed_on_line_sensitive_roles(): void {
        $profile = $this->draft();

        foreach (['receivable', 'payable', 'cash_or_bank', 'tax_output', 'custom_role'] as $role) {
            foreach ([['is_stock_item' => false], ['item_type' => 'service'], ['item_category_id' => $this->category()]] as $condition) {
                try {
                    $this->service->addRule($profile, ['role' => $role, 'account_id' => $this->expense->id, ...$condition]);
                    $this->fail("Kondisi barang pada peran {$role} seharusnya ditolak.");
                } catch (InvalidPostingRuleException $e) {
                    $this->assertStringContainsString($role, $e->getMessage());
                }
            }
        }

        // Peran non-peka-barang tanpa kondisi barang boleh (jenis dokumen/varian saja).
        $rule = $this->service->addRule($profile, ['role' => 'receivable', 'account_id' => $this->receivable->id, 'document_type' => 'sales_invoice', 'variant' => 'return']);
        $this->assertInstanceOf(PostingProfileRule::class, $rule);

        // Peran peka-barang dengan kondisi barang boleh.
        $this->service->addRule($profile, ['role' => 'revenue', 'account_id' => $this->revenue->id, 'item_category_id' => $this->category(), 'item_type' => 'service', 'is_stock_item' => false]);
        $this->assertSame(2, $profile->rules()->count());
    }

    public function test_rule_rejects_unknown_document_type_variant_and_category(): void {
        $profile = $this->draft();

        foreach ([
            ['document_type' => 'kwitansi'],
            ['variant'          => 'refund'],
            ['item_category_id' => (string) Str::ulid()],
        ] as $invalid) {
            try {
                $this->service->addRule($profile, ['role' => 'revenue', 'account_id' => $this->revenue->id, ...$invalid]);
                $this->fail('Aturan tidak valid seharusnya ditolak: ' . json_encode($invalid));
            } catch (InvalidPostingRuleException) {
                // diharapkan
            }
        }

        $this->assertSame(0, $profile->rules()->count());
    }

    public function test_invalid_rules_roll_back_the_whole_draft_creation(): void {
        try {
            $this->service->createDraft('X', '2026-01-01', null, ['receivable' => $this->receivable->id], [
                ['role' => 'revenue', 'account_id' => $this->revenue->id],
                ['role' => 'revenue', 'account_id' => $this->revenueReturn->id],
            ]);
            $this->fail('Aturan duplikat seharusnya ditolak.');
        } catch (InvalidPostingRuleException) {
            // diharapkan
        }

        $this->assertSame(0, PostingProfile::query()->count());
    }
}
