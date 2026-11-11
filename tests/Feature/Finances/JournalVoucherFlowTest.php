<?php

namespace Tests\Feature\Finances;

use App\Enums\FormStatus;
use App\Enums\JournalStatus;
use App\Exceptions\Finances\ImmutableLedgerException;
use App\Http\Middleware\AppMiddleware;
use App\Http\Middleware\EnsureUserIsOnboarded;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\LanguageMiddleware;
use App\Models\Core\ApprovalInstance;
use App\Models\Core\ApprovalScheme;
use App\Models\Core\Branch;
use App\Models\Finances\Account;
use App\Models\Finances\FinanceSetting;
use App\Models\Finances\FiscalPeriod;
use App\Models\Finances\FiscalYear;
use App\Models\Finances\GeneralLedger;
use App\Models\Finances\Journal;
use App\Models\Finances\JournalVoucher;
use App\Models\User\Permission;
use App\Models\User\User;
use App\Services\Core\Setting\SettingsService;
use App\Services\Finances\JournalVoucherService;
use App\Services\Finances\Ledger\FiscalPeriodService;
use App\Services\Finances\Ledger\JournalReversalService;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\BuildsFinanceFixtures;
use Tests\TestCase;

/**
 * Finance Fase 1, Task 11.3 (Requirement 12): jurnal manual lewat dokumen `JournalVoucher` dengan approval. Voucher
 * baru memposting `Journal` saat disetujui (tepat sekali); sebelum itu, saat ditolak, atau saat dibatalkan sebelum
 * disetujui, tidak ada jurnal maupun baris GL.
 */
class JournalVoucherFlowTest extends TestCase {
    use BuildsFinanceFixtures, RefreshDatabase;

    private Account $cash;
    private Account $revenue;

    protected function setUp(): void {
        parent::setUp();

        $this->withoutMiddleware([AppMiddleware::class, EnsureUserIsOnboarded::class, HandleInertiaRequests::class, LanguageMiddleware::class]);
        $this->setUpFinanceFixtures([JournalVoucher::class, FiscalYear::class, FiscalPeriod::class]);
        $this->cash    = $this->makeAccount('1100', 'Kas', 'asset', 'debit', 'cash');
        $this->revenue = $this->makeAccount('4100', 'Pendapatan Lain', 'income', 'credit');
    }

    /**
     * @param  list<string>  $permissions
     * @return array<string, mixed>
     */
    private function permissionSession(array $permissions = ['select', 'read', 'create', 'write', 'submit', 'cancel', 'amend'], bool $onlyCreator = false, ?string $branchId = null): array {
        return [
            'permissions' => [
                JournalVoucher::class => [
                    0 => [['model' => JournalVoucher::class, 'level' => 0, 'only_creator' => $onlyCreator, 'permissions' => array_fill_keys($permissions, true)]],
                ],
            ],
            'permissions_version' => '0|0|0|0',
            'currentBranch'       => $branchId,
        ];
    }

    /**
     * Permintaan oleh pengguna tertentu dengan izin only_creator dan/atau cabang aktif tertentu.
     *
     * @param  list<string>  $permissions
     */
    private function httpAs(User $user, array $permissions, bool $onlyCreator = false, ?string $branchId = null): static {
        return $this->withSession($this->permissionSession($permissions, $onlyCreator, $branchId))
            ->withCookie('lang', 'en')
            ->actingAs($user);
    }

    private function http(?array $permissions = null): static {
        return $this->withSession($permissions === null ? $this->permissionSession() : $this->permissionSession($permissions))
            ->withCookie('lang', 'en')
            ->actingAs($this->user);
    }

    /**
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    private function payload(array $overrides = []): array {
        return [
            'date'        => '2026-11-10 09:00:00',
            'description' => 'Koreksi saldo kas',
            'items'       => [
                ['id' => 'row-1', 'account' => ['id' => $this->cash->id], 'debit' => 150000.5, 'credit' => null, 'description' => 'Kas masuk'],
                ['id' => 'row-2', 'account' => ['id' => $this->revenue->id], 'debit' => null, 'credit' => 150000.5, 'description' => null],
            ],
            ...$overrides,
        ];
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    private function storeVoucher(array $overrides = []): JournalVoucher {
        $this->http()->postJson(route('journalVouchers.store'), $this->payload($overrides))->assertRedirect();

        return JournalVoucher::query()->latest('created_at')->latest('id')->firstOrFail();
    }

    private function submit(JournalVoucher $voucher): void {
        $this->http()->put(route('journalVouchers.submit', $voucher))->assertRedirect();
    }

    private function createApprovalScheme(User $approver): ApprovalScheme {
        $permission = Permission::query()->where('model', JournalVoucher::class)->firstOrFail();
        $scheme     = ApprovalScheme::create([
            'name'          => 'Journal Voucher Approval',
            'permission_id' => $permission->id,
            'name_model'    => 'Journal Voucher',
            'model'         => JournalVoucher::class,
            'is_active'     => true,
            'trigger_on'    => 'submit',
        ]);
        $scheme->steps()->create([
            'sequence'          => 0,
            'approver_type'     => 'user',
            'approverable_type' => User::class,
            'approverable_id'   => $approver->id,
        ]);

        return $scheme;
    }

    private function decide(JournalVoucher $voucher, User $approver, string $decision): void {
        $approval = ApprovalInstance::query()
            ->where('document_type', JournalVoucher::class)
            ->where('document_id', $voucher->id)
            ->firstOrFail();

        $this->actingAs($approver)
            ->post(route('approvalInstances.decision', $approval->steps()->firstOrFail()), ['decision' => $decision])
            ->assertRedirect();
    }

    private function journalCount(): int {
        return Journal::query()->count();
    }

    private function enforceFiscalPeriods(): void {
        app(SettingsService::class)->update(FinanceSetting::class, ['enforce_fiscal_period' => true]);
    }

    private function assertNoLedgerEffect(): void {
        $this->assertSame(0, $this->journalCount(), 'Tidak boleh ada Journal.');
        $this->assertSame(0, GeneralLedger::query()->withTrashed()->count(), 'Tidak boleh ada baris GL.');
    }

    public function test_store_creates_a_draft_voucher_with_items_and_no_ledger_effect(): void {
        $voucher = $this->storeVoucher();

        $this->assertSame([FormStatus::DRAFT], $voucher->status);
        $this->assertStringStartsWith('JVC-', $voucher->code);
        $this->assertSame($this->user->id, $voucher->created_by_id);
        $this->assertCount(2, $voucher->items);
        $this->assertSame([1, 2], $voucher->items->pluck('line_no')->all());
        $this->assertEquals(150000.5, $voucher->items[0]->debit);
        $this->assertEquals(150000.5, $voucher->items[1]->credit);
        $this->assertNoLedgerEffect();
    }

    public function test_unbalanced_voucher_is_rejected(): void {
        $items              = $this->payload()['items'];
        $items[1]['credit'] = 100000;

        $this->http()->postJson(route('journalVouchers.store'), $this->payload(['items' => $items]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['items']);

        $this->assertSame(0, JournalVoucher::query()->count());
    }

    public function test_balance_is_checked_in_base_currency_minor_units(): void {
        // 100.004 dan 100.00 sama-sama menjadi 10000 minor unit (2 desimal): seimbang.
        $items = [
            ['account' => ['id' => $this->cash->id], 'debit' => 100.004, 'credit' => 0],
            ['account' => ['id' => $this->revenue->id], 'debit' => 0, 'credit' => 100.00],
        ];
        $this->http()->postJson(route('journalVouchers.store'), $this->payload(['items' => $items]))->assertRedirect();

        // 100.005 menjadi 10001 (HALF_UP) sedangkan 100.00 menjadi 10000: tidak seimbang.
        $items[0]['debit'] = 100.005;
        $this->http()->postJson(route('journalVouchers.store'), $this->payload(['items' => $items]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['items']);

        $this->assertSame(1, JournalVoucher::query()->count());
    }

    public function test_voucher_needs_at_least_two_lines_with_exactly_one_side_each(): void {
        $this->http()->postJson(route('journalVouchers.store'), $this->payload(['items' => [
            ['account' => ['id' => $this->cash->id], 'debit' => 100, 'credit' => 0],
        ]]))->assertUnprocessable()->assertJsonValidationErrors(['items']);

        $this->http()->postJson(route('journalVouchers.store'), $this->payload(['items' => [
            ['account' => ['id' => $this->cash->id], 'debit' => 100, 'credit' => 100],
            ['account' => ['id' => $this->revenue->id], 'debit' => 0, 'credit' => 0],
        ]]))->assertUnprocessable()->assertJsonValidationErrors(['items']);

        $this->assertSame(0, JournalVoucher::query()->count());
    }

    public function test_group_and_disabled_accounts_are_rejected(): void {
        $group    = Account::create(['account_name' => 'Induk', 'account_number' => '1000', 'root_type' => 'asset', 'report_type' => 'balance_sheet', 'balance_type' => 'debit', 'is_group' => true]);
        $disabled = $this->makeAccount('1300', 'Nonaktif');
        $disabled->forceFill(['is_disabled' => true])->save();

        foreach ([$group, $disabled] as $account) {
            $items                     = $this->payload()['items'];
            $items[0]['account']['id'] = $account->id;

            $this->http()->postJson(route('journalVouchers.store'), $this->payload(['items' => $items]))
                ->assertUnprocessable()
                ->assertJsonValidationErrors(['items.0.account.id']);
        }
    }

    public function test_closed_period_is_rejected_when_enforcement_is_on(): void {
        $periods = app(FiscalPeriodService::class);
        $periods->generateYear(2026);
        $periods->close($periods->resolve(CarbonImmutable::parse('2026-11-10 09:00:00')));
        $this->enforceFiscalPeriods();

        $this->http()->postJson(route('journalVouchers.store'), $this->payload())
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['date']);

        // Periode terbuka diterima.
        $this->http()->postJson(route('journalVouchers.store'), $this->payload(['date' => '2026-10-10 09:00:00']))->assertRedirect();
        $this->assertSame(1, JournalVoucher::query()->count());
    }

    public function test_store_requires_the_create_permission(): void {
        $this->http(['select', 'read'])->postJson(route('journalVouchers.store'), $this->payload())->assertForbidden();
        $this->assertSame(0, JournalVoucher::query()->count());

        $this->http(['create'])->postJson(route('journalVouchers.store'), $this->payload())->assertRedirect();
        $this->assertSame(1, JournalVoucher::query()->count());
    }

    public function test_submit_without_an_approval_scheme_posts_exactly_one_journal(): void {
        $voucher = $this->storeVoucher();
        $this->submit($voucher);

        $voucher->refresh();
        $this->assertSame([FormStatus::SUBMITTED], $voucher->status);
        $this->assertNotNull($voucher->submitted_at);

        $journal = Journal::query()->sole();
        $this->assertSame(JournalStatus::Posted->value, $journal->status);
        $this->assertSame(JournalVoucher::class, $journal->source_type);
        $this->assertSame($voucher->id, $journal->source_id);
        $this->assertSame(JournalVoucher::class . ":{$voucher->id}:default", $journal->posting_key);
        $this->assertSame('Koreksi saldo kas', $journal->description);
        $this->assertEqualsWithDelta(150000.5, (float) $journal->total_debit, 0.0001);

        $lines = $journal->lines;
        $this->assertCount(2, $lines);
        $this->assertSame([$this->cash->id, $this->revenue->id], $lines->pluck('account_id')->all());
        $this->assertEquals([150000.5, 0.0], [$lines[0]->debit, $lines[0]->credit]);
        $this->assertEquals([0.0, 150000.5], [$lines[1]->debit, $lines[1]->credit]);
        $this->assertSame(['Kas masuk', 'Koreksi saldo kas'], $lines->pluck('description')->all());
        $this->assertSame([JournalVoucher::class], $lines->pluck('referenceable_type')->unique()->all());
        $this->assertSame([$voucher->id], $lines->pluck('referenceable_id')->unique()->all());
    }

    public function test_approval_posts_exactly_once_even_when_approved_is_triggered_again(): void {
        $voucher = $this->storeVoucher();
        $this->submit($voucher);
        $this->assertSame(1, $this->journalCount());

        // Pemicu ulang (retry atau klik ganda) tidak memposting lagi: pengaman status.
        $service = app(JournalVoucherService::class);
        $service->onApproved($voucher->fresh());
        $service->onApproved($voucher->fresh());

        $this->assertSame(1, $this->journalCount());
        $this->assertSame(2, GeneralLedger::query()->count());

        // Submit ulang atas voucher yang sudah diajukan ditolak.
        $this->http()->put(route('journalVouchers.submit', $voucher))->assertSessionHasErrors('status');
        $this->assertSame(1, $this->journalCount());
    }

    public function test_manual_approval_posts_only_on_final_approval(): void {
        $approver = User::factory()->create();
        $this->createApprovalScheme($approver);
        $voucher = $this->storeVoucher();

        $this->submit($voucher);

        $this->assertContains(FormStatus::NEED_APPROVAL, $voucher->fresh()->status);
        $this->assertNoLedgerEffect();

        $this->decide($voucher, $approver, 'approve');

        $this->assertSame([FormStatus::SUBMITTED], $voucher->fresh()->status);
        $this->assertSame(1, $this->journalCount());
        $this->assertSame($voucher->id, Journal::query()->sole()->source_id);
    }

    public function test_rejected_voucher_never_posts(): void {
        $approver = User::factory()->create();
        $this->createApprovalScheme($approver);
        $voucher = $this->storeVoucher();
        $this->submit($voucher);

        $this->decide($voucher, $approver, 'reject');

        $this->assertContains(FormStatus::REJECTED, $voucher->fresh()->status);
        $this->assertNoLedgerEffect();
    }

    public function test_canceled_before_approval_never_posts_even_if_approved_afterwards(): void {
        $approver = User::factory()->create();
        $this->createApprovalScheme($approver);
        $voucher = $this->storeVoucher();
        $this->submit($voucher);

        $this->http()->put(route('journalVouchers.cancel', $voucher))->assertRedirect();
        $this->assertContains(FormStatus::CANCELED, $voucher->fresh()->status);
        $this->assertNoLedgerEffect();

        // Keputusan approver yang masih tertunda tidak memposting voucher yang sudah dibatalkan.
        app(JournalVoucherService::class)->onApproved($voucher->fresh());
        $this->assertNoLedgerEffect();
        $this->assertContains(FormStatus::CANCELED, $voucher->fresh()->status);
    }

    public function test_cancel_after_posting_voids_the_journal_and_its_lines(): void {
        $voucher = $this->storeVoucher();
        $this->submit($voucher);
        $journal = Journal::query()->sole();

        $this->http()->put(route('journalVouchers.cancel', $voucher))->assertRedirect();

        $this->assertContains(FormStatus::CANCELED, $voucher->fresh()->status);
        $this->assertSame(JournalStatus::Voided->value, $journal->fresh()->status);
        $this->assertSame(0, GeneralLedger::query()->count());
        $this->assertSame(2, GeneralLedger::query()->onlyTrashed()->count());
    }

    public function test_posted_journal_can_be_reversed_and_is_immutable(): void {
        $voucher = $this->storeVoucher();
        $this->submit($voucher);
        $journal = Journal::query()->sole();

        try {
            $journal->update(['description' => 'diubah']);
            $this->fail('Journal hasil voucher harus immutable.');
        } catch (ImmutableLedgerException) {
            $this->addToAssertionCount(1);
        }

        try {
            GeneralLedger::query()->where('journal_id', $journal->id)->firstOrFail()->update(['debit' => 1]);
            $this->fail('Baris GL hasil voucher harus immutable.');
        } catch (ImmutableLedgerException) {
            $this->addToAssertionCount(1);
        }

        $reversal = app(JournalReversalService::class)->reverse($journal, null, 'Salah akun');

        $this->assertSame(JournalStatus::Reversed->value, $journal->fresh()->status);
        $this->assertSame($journal->id, $reversal->reverses_journal_id);
        $this->assertSame(JournalVoucher::class, $reversal->source_type);
        $this->assertSame($voucher->id, $reversal->source_id);
        $this->assertSame(2, $this->journalCount());
    }

    public function test_voucher_cannot_be_edited_after_it_is_submitted(): void {
        $voucher = $this->storeVoucher();
        $this->submit($voucher);

        $this->http()->putJson(route('journalVouchers.update', $voucher), $this->payload(['description' => 'diubah']))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['status']);

        $this->assertSame('Koreksi saldo kas', $voucher->fresh()->description);
    }

    public function test_draft_voucher_can_be_edited_and_items_are_replaced(): void {
        $voucher = $this->storeVoucher();
        $first   = $voucher->items->first();

        $items = [
            ['id' => $first->id, 'account' => ['id' => $this->cash->id], 'debit' => 200, 'credit' => 0],
            ['id' => 'baru', 'account' => ['id' => $this->revenue->id], 'debit' => 0, 'credit' => 200],
        ];
        $this->http()->putJson(route('journalVouchers.update', $voucher), $this->payload(['description' => 'Revisi', 'items' => $items]))
            ->assertRedirect();

        $voucher->refresh();
        $this->assertSame('Revisi', $voucher->description);
        $this->assertCount(2, $voucher->items);
        $this->assertSame($first->id, $voucher->items[0]->id);
        $this->assertEquals(200, $voucher->items[0]->debit);
        $this->assertNoLedgerEffect();
    }

    public function test_submit_rejects_a_voucher_that_can_no_longer_be_posted(): void {
        $voucher = $this->storeVoucher();
        $this->cash->forceFill(['is_disabled' => true])->save();

        $this->http()->put(route('journalVouchers.submit', $voucher))->assertSessionHasErrors('items');

        $this->assertSame([FormStatus::DRAFT], $voucher->fresh()->status);
        $this->assertNoLedgerEffect();
    }

    public function test_approval_is_rolled_back_when_the_period_was_closed_after_submit(): void {
        $approver = User::factory()->create();
        $this->createApprovalScheme($approver);
        $periods = app(FiscalPeriodService::class);
        $periods->generateYear(2026);
        $voucher = $this->storeVoucher();
        $this->enforceFiscalPeriods();
        $this->submit($voucher);

        $periods->close($periods->resolve(CarbonImmutable::parse('2026-11-10 09:00:00')));

        $approval = ApprovalInstance::query()->where('document_id', $voucher->id)->firstOrFail();
        $this->actingAs($approver)
            ->post(route('approvalInstances.decision', $approval->steps()->firstOrFail()), ['decision' => 'approve']);

        // Posting ditolak oleh JournalService: tidak ada jurnal dan voucher tetap menunggu (Requirement 6).
        $this->assertNoLedgerEffect();
        $this->assertContains(FormStatus::NEED_APPROVAL, $voucher->fresh()->status);
    }

    public function test_reject_does_not_overwrite_a_canceled_voucher(): void {
        $approver = User::factory()->create();
        $this->createApprovalScheme($approver);
        $voucher = $this->storeVoucher();
        $this->submit($voucher);
        $this->http()->put(route('journalVouchers.cancel', $voucher))->assertRedirect();

        app(JournalVoucherService::class)->onRejected($voucher->fresh());

        $this->assertSame([FormStatus::CANCELED], $voucher->fresh()->status);
        $this->assertNoLedgerEffect();
    }

    public function test_reject_still_applies_to_a_voucher_waiting_for_approval(): void {
        $approver = User::factory()->create();
        $this->createApprovalScheme($approver);
        $voucher = $this->storeVoucher();
        $this->submit($voucher);

        app(JournalVoucherService::class)->onRejected($voucher->fresh());

        $this->assertSame([FormStatus::REJECTED], $voucher->fresh()->status);
    }

    public function test_amount_precision_and_range_are_limited(): void {
        foreach ([100.00001, 1e16] as $amount) {
            $items              = $this->payload()['items'];
            $items[0]['debit']  = $amount;
            $items[1]['credit'] = $amount;

            $this->http()->postJson(route('journalVouchers.store'), $this->payload(['items' => $items]))
                ->assertUnprocessable()
                ->assertJsonValidationErrors(['items.0.debit']);
        }

        // Empat desimal (batas decimal(20,4)) diterima.
        $items              = $this->payload()['items'];
        $items[0]['debit']  = 1234567.1234;
        $items[1]['credit'] = 1234567.1234;
        $this->http()->postJson(route('journalVouchers.store'), $this->payload(['items' => $items]))->assertRedirect();
        $this->assertSame(1, JournalVoucher::query()->count());
    }

    public function test_date_with_offset_is_normalized_to_the_app_timezone(): void {
        $voucher = $this->storeVoucher(['date' => '2026-11-10T23:30:00+07:00']);

        $this->assertSame('2026-11-10 16:30:00', $voucher->date->format('Y-m-d H:i:s'));

        $this->submit($voucher);
        $this->assertSame('2026-11-10 16:30:00', Journal::query()->sole()->transaction_date->format('Y-m-d H:i:s'));
    }

    public function test_only_creator_permission_blocks_other_users_from_write_submit_and_cancel(): void {
        $voucher     = $this->storeVoucher();
        $other       = User::factory()->create();
        $permissions = ['select', 'read', 'write', 'submit', 'cancel'];

        $this->httpAs($other, $permissions, onlyCreator: true)
            ->putJson(route('journalVouchers.update', $voucher), $this->payload(['description' => 'diubah orang lain']))->assertForbidden();
        $this->httpAs($other, $permissions, onlyCreator: true)
            ->put(route('journalVouchers.submit', $voucher))->assertForbidden();
        $this->httpAs($other, $permissions, onlyCreator: true)
            ->put(route('journalVouchers.cancel', $voucher))->assertForbidden();

        $this->assertSame([FormStatus::DRAFT], $voucher->fresh()->status);
        $this->assertSame('Koreksi saldo kas', $voucher->fresh()->description);
        $this->assertNoLedgerEffect();

        // Pembuatnya sendiri tetap boleh.
        $this->httpAs($this->user, $permissions, onlyCreator: true)
            ->put(route('journalVouchers.submit', $voucher))->assertRedirect();
        $this->assertSame(1, $this->journalCount());
    }

    public function test_voucher_of_another_branch_is_not_reachable(): void {
        $branchB     = Branch::create(['name' => 'Cabang B', 'code' => 'BB']);
        $permissions = ['select', 'read', 'create', 'write', 'submit', 'cancel'];

        $this->httpAs($this->user, $permissions, branchId: $this->branch->id)
            ->postJson(route('journalVouchers.store'), $this->payload())->assertRedirect();
        $voucher = JournalVoucher::query()->withoutGlobalScopes()->sole();
        $this->assertSame($this->branch->id, $voucher->branch_id);

        $this->httpAs($this->user, $permissions, branchId: $branchB->id)->get(route('journalVouchers.show', $voucher->id))->assertNotFound();
        $this->httpAs($this->user, $permissions, branchId: $branchB->id)->putJson(route('journalVouchers.update', $voucher->id), $this->payload(['description' => 'x']))->assertNotFound();
        $this->httpAs($this->user, $permissions, branchId: $branchB->id)->put(route('journalVouchers.submit', $voucher->id))->assertNotFound();
        $this->httpAs($this->user, $permissions, branchId: $branchB->id)->put(route('journalVouchers.cancel', $voucher->id))->assertNotFound();

        $this->assertNoLedgerEffect();
        $this->assertSame('Koreksi saldo kas', JournalVoucher::query()->withoutGlobalScopes()->sole()->description);
    }

    public function test_item_ids_from_another_voucher_are_ignored_on_update(): void {
        $first   = $this->storeVoucher();
        $second  = $this->storeVoucher(['description' => 'Voucher lain']);
        $foreign = $second->items->first();

        $items = [
            ['id' => $foreign->id, 'account' => ['id' => $this->cash->id], 'debit' => 10, 'credit' => 0],
            ['id' => 'baru', 'account' => ['id' => $this->revenue->id], 'debit' => 0, 'credit' => 10],
        ];
        $this->http()->putJson(route('journalVouchers.update', $first), $this->payload(['items' => $items]))->assertRedirect();

        $second->refresh();
        $this->assertCount(2, $second->items);
        $this->assertEquals(150000.5, $second->items->first()->debit);
        $this->assertSame($second->id, $second->items->first()->journal_voucher_id);
        $this->assertCount(2, $first->fresh()->items);
        $this->assertNotContains($foreign->id, $first->fresh()->items->pluck('id')->all());
    }

    public function test_amend_is_refused_unless_the_voucher_is_canceled_or_rejected(): void {
        $draft = $this->storeVoucher();
        $this->http()->put(route('journalVouchers.amend', $draft))->assertStatus(422);

        $posted = $this->storeVoucher();
        $this->submit($posted);
        $journalsBefore = Journal::query()->count();
        $this->http()->put(route('journalVouchers.amend', $posted))->assertStatus(422);

        $this->assertSame(0, JournalVoucher::query()->whereNotNull('amended_from_id')->count());
        $this->assertSame($journalsBefore, Journal::query()->count());
    }

    public function test_amend_after_cancel_creates_a_new_draft_without_ledger_effect(): void {
        $voucher = $this->storeVoucher();
        $this->submit($voucher);
        $this->http()->put(route('journalVouchers.cancel', $voucher))->assertRedirect();
        $journalsBefore = Journal::query()->count();
        $linesBefore    = GeneralLedger::query()->withTrashed()->count();

        $this->http()->put(route('journalVouchers.amend', $voucher))->assertRedirect();

        $amended = JournalVoucher::query()->where('amended_from_id', $voucher->id)->sole();
        $this->assertSame([FormStatus::DRAFT], $amended->status);
        $this->assertNotSame($voucher->id, $amended->id);
        $this->assertCount(2, $amended->items);
        $this->assertSame($journalsBefore, Journal::query()->count());
        $this->assertSame($linesBefore, GeneralLedger::query()->withTrashed()->count());
        $this->assertSame(JournalStatus::Voided->value, Journal::query()->sole()->status);
    }
}
