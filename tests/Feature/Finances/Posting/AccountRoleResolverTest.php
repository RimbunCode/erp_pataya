<?php

namespace Tests\Feature\Finances\Posting;

use App\Enums\AccountRole;
use App\Enums\PostingDocumentType;
use App\Exceptions\Finances\UnresolvedAccountRoleException;
use App\Models\Finances\Account;
use App\Models\Finances\PostingProfile;
use App\Services\Finances\Posting\AccountRoleResolver;
use App\Services\Finances\Posting\Contexts\LineAttributes;
use App\Services\Finances\Posting\Contexts\PostingContext;
use App\Services\Finances\Posting\PostingProfileService;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Tests\Support\BuildsFinanceFixtures;
use Tests\TestCase;

/**
 * Finance Fase 2, Task 3.3-3.4: resolusi peran menjadi akun (Requirement 3). Urutan lapis master > aturan bersyarat >
 * default profil > legacy; P-3 deterministik; fallback legacy dapat dimatikan; akun group/nonaktif/terhapus ditolak;
 * profil efektif menurut tanggal; cache hidup per instance resolver.
 */
class AccountRoleResolverTest extends TestCase {
    use BuildsFinanceFixtures, RefreshDatabase;

    private PostingProfileService $profiles;
    private Account $legacyStock;
    private Account $profileStock;
    private Account $ruleStock;
    private Account $masterStock;

    protected function setUp(): void {
        parent::setUp();

        $this->setUpFinanceFixtures([PostingProfile::class]);
        $this->profiles     = app(PostingProfileService::class);
        $this->legacyStock  = $this->makeAccount('1241', 'Persediaan Legacy', 'asset', 'debit', 'stock');
        $this->profileStock = $this->makeAccount('1242', 'Persediaan Profil', 'asset', 'debit');
        $this->ruleStock    = $this->makeAccount('1243', 'Persediaan Aturan', 'asset', 'debit');
        $this->masterStock  = $this->makeAccount('1244', 'Persediaan Master', 'asset', 'debit');
    }

    private function resolver(): AccountRoleResolver {
        return app(AccountRoleResolver::class);
    }

    /**
     * @param  array<string, mixed>  $flags
     * @param  array<string, string>  $master
     */
    private function ctx(string $date = '2026-11-12 10:00:00', array $flags = [], array $master = [], PostingDocumentType $type = PostingDocumentType::DeliveryNote): PostingContext {
        return new PostingContext(
            documentType: $type,
            sourceType: 'delivery_note',
            sourceId: '01TESTSOURCE',
            transactionDate: CarbonImmutable::parse($date, 'UTC'),
            branchId: null,
            amounts: ['total' => 100],
            flags: $flags,
            masterAccounts: $master,
        );
    }

    /**
     * @param  array<string, string>  $accounts
     * @param  list<array<string, mixed>>  $rules
     */
    private function activeProfile(array $accounts, array $rules = [], string $from = '2026-01-01', ?string $to = null, string $name = 'Profil'): PostingProfile {
        return $this->profiles->activate($this->profiles->createDraft($name, $from, $to, $accounts, $rules));
    }

    public function test_master_account_beats_rules_profile_and_legacy(): void {
        $this->activeProfile(['cash_or_bank' => $this->profileStock->id, 'fixed_asset' => $this->profileStock->id], [['role' => 'cash_or_bank', 'account_id' => $this->ruleStock->id]]);

        foreach (['cash_or_bank', 'fixed_asset', 'accumulated_depreciation', 'depreciation_expense', 'capital_work_in_progress', 'gain_loss_disposal'] as $role) {
            $account = $this->resolver()->resolve($role, $this->ctx(master: [$role => $this->masterStock->id]));

            $this->assertSame($this->masterStock->id, $account->id, $role);
        }
    }

    public function test_master_accounts_for_non_master_roles_are_ignored_and_cannot_cut_the_profile(): void {
        $revenue = $this->makeAccount('4110', 'Penjualan Master', 'income', 'credit');
        $this->activeProfile(['revenue' => $this->profileStock->id, 'stock' => $this->profileStock->id]);
        Log::spy();

        $account = $this->resolver()->resolve(AccountRole::Revenue, $this->ctx(master: ['revenue' => $revenue->id, 'stock' => $this->masterStock->id]));

        $this->assertSame($this->profileStock->id, $account->id);
        $this->assertSame($this->profileStock->id, $this->resolver()->resolve('stock', $this->ctx(master: ['stock' => $this->masterStock->id]))->id);
        Log::shouldHaveReceived('warning')->with('posting.master_account_ignored', \Mockery::on(fn (array $c) => $c['role'] === 'revenue'))->once();
    }

    public function test_conditional_rule_beats_profile_default_and_legacy(): void {
        $this->activeProfile(['stock' => $this->profileStock->id], [['role' => 'stock', 'account_id' => $this->ruleStock->id]]);

        $this->assertSame($this->ruleStock->id, $this->resolver()->resolve(AccountRole::Stock, $this->ctx())->id);
    }

    public function test_profile_default_beats_legacy(): void {
        $this->activeProfile(['stock' => $this->profileStock->id]);

        $this->assertSame($this->profileStock->id, $this->resolver()->resolve(AccountRole::Stock, $this->ctx())->id);
    }

    public function test_legacy_fallback_is_used_last_and_logs_a_warning(): void {
        Log::spy();

        $account = $this->resolver()->resolve('stock', $this->ctx());

        $this->assertSame($this->legacyStock->id, $account->id);
        Log::shouldHaveReceived('warning')->once()->with('posting.legacy_account_fallback', \Mockery::on(
            fn (array $context) => $context['role'] === 'stock' && $context['document_type'] === 'delivery_note',
        ));
    }

    public function test_profile_without_the_role_falls_through_to_legacy(): void {
        $this->activeProfile(['receivable' => $this->profileStock->id]);

        $this->assertSame($this->legacyStock->id, $this->resolver()->resolve(AccountRole::Stock, $this->ctx())->id);
    }

    public function test_legacy_fallback_can_be_disabled_by_config(): void {
        config(['finance.posting.legacy_account_fallback' => false]);

        try {
            $this->resolver()->resolve(AccountRole::Stock, $this->ctx());
            $this->fail('Tanpa lapis lain dan legacy mati, peran tidak ter-resolve.');
        } catch (UnresolvedAccountRoleException $e) {
            $this->assertStringContainsString('stock', $e->getMessage());
            $this->assertStringContainsString('delivery_note', $e->getMessage());
            $this->assertStringContainsString('normal', $e->getMessage());
            $this->assertStringContainsString('2026-11-12', $e->getMessage());
            $this->assertSame('stock', $e->role);
            $this->assertNotEmpty($e->layers);
            $this->assertStringContainsString('legacy', strtolower($e->getMessage()));
        }
    }

    public function test_disabled_legacy_fallback_does_not_hide_profile_layers(): void {
        config(['finance.posting.legacy_account_fallback' => false]);
        $this->activeProfile(['stock' => $this->profileStock->id]);

        $this->assertSame($this->profileStock->id, $this->resolver()->resolve(AccountRole::Stock, $this->ctx())->id);
    }

    public function test_role_without_any_layer_is_unresolved_with_every_layer_listed(): void {
        $this->activeProfile(['receivable' => $this->profileStock->id], name: 'Profil Uji');

        try {
            $this->resolver()->resolve(AccountRole::CashOrBank, $this->ctx());
            $this->fail('cash_or_bank tanpa master harus gagal.');
        } catch (UnresolvedAccountRoleException $e) {
            $this->assertStringContainsString('Profil Uji', $e->getMessage(), 'Lapis profil disebut.');
            $this->assertGreaterThanOrEqual(4, count($e->layers));
        }
    }

    public function test_unknown_custom_role_without_layers_is_unresolved(): void {
        $this->expectException(UnresolvedAccountRoleException::class);

        $this->resolver()->resolve('peran_kustom', $this->ctx());
    }

    public function test_custom_role_is_resolved_from_the_profile(): void {
        $this->activeProfile(['peran_kustom' => $this->profileStock->id]);

        $this->assertSame($this->profileStock->id, $this->resolver()->resolve('peran_kustom', $this->ctx())->id);
    }

    public function test_group_disabled_and_deleted_accounts_are_rejected_in_every_layer(): void {
        $group = Account::create(['account_name' => 'Grup', 'account_number' => '1000', 'root_type' => 'asset', 'report_type' => 'balance_sheet', 'balance_type' => 'debit', 'is_group' => true]);

        // Lapis master.
        try {
            $this->resolver()->resolve(AccountRole::CashOrBank, $this->ctx(master: ['cash_or_bank' => $group->id]));
            $this->fail('Akun master group ditolak.');
        } catch (UnresolvedAccountRoleException $e) {
            $this->assertStringContainsString(__('finances/posting.account_problems.group'), $e->getMessage());
        }

        // Lapis legacy: akun legacy dinonaktifkan.
        $this->legacyStock->update(['is_disabled' => true]);
        try {
            $this->resolver()->resolve(AccountRole::Stock, $this->ctx());
            $this->fail('Akun legacy nonaktif ditolak.');
        } catch (UnresolvedAccountRoleException $e) {
            $this->assertStringContainsString(__('finances/posting.account_problems.disabled'), $e->getMessage());
        }

        // Lapis profil default: akun dinonaktifkan sesudah profil aktif.
        $this->activeProfile(['stock' => $this->profileStock->id]);
        $this->profileStock->update(['is_disabled' => true]);
        try {
            $this->resolver()->resolve(AccountRole::Stock, $this->ctx());
            $this->fail('Akun default profil nonaktif ditolak (tidak jatuh diam-diam ke legacy).');
        } catch (UnresolvedAccountRoleException $e) {
            $this->assertStringContainsString(__('finances/posting.account_problems.disabled'), $e->getMessage());
            $this->assertStringContainsString(__('finances/posting.layers.profile'), $e->getMessage());
        }

        // Akun terhapus dilaporkan sebagai terhapus, bukan "tidak ditemukan".
        $this->profileStock->update(['is_disabled' => false]);
        $this->profileStock->delete();
        try {
            $this->resolver()->resolve(AccountRole::Stock, $this->ctx());
            $this->fail('Akun terhapus ditolak.');
        } catch (UnresolvedAccountRoleException $e) {
            $this->assertStringContainsString(__('finances/posting.account_problems.deleted'), $e->getMessage());
        }
    }

    public function test_rule_account_that_became_unusable_is_rejected_with_rule_layer(): void {
        $this->activeProfile(['stock' => $this->profileStock->id], [['role' => 'stock', 'account_id' => $this->ruleStock->id]]);
        $this->ruleStock->update(['is_disabled' => true]);

        try {
            $this->resolver()->resolve(AccountRole::Stock, $this->ctx());
            $this->fail('Akun aturan nonaktif ditolak.');
        } catch (UnresolvedAccountRoleException $e) {
            $this->assertStringContainsString(__('finances/posting.layers.rules'), $e->getMessage());
        }
    }

    public function test_effective_profile_is_selected_by_transaction_date(): void {
        $old = $this->makeAccount('1245', 'Stok Lama', 'asset');
        $new = $this->makeAccount('1246', 'Stok Baru', 'asset');
        $this->activeProfile(['stock' => $old->id], from: '2026-01-01', to: '2026-06-30', name: 'Lama');
        $this->activeProfile(['stock' => $new->id], from: '2026-07-01', name: 'Baru');

        $resolver = $this->resolver();
        $this->assertSame($old->id, $resolver->resolve(AccountRole::Stock, $this->ctx('2026-03-15 08:00:00'))->id);
        $this->assertSame($new->id, $resolver->resolve(AccountRole::Stock, $this->ctx('2026-08-15 08:00:00'))->id);
        $this->assertSame($old->id, $resolver->resolve(AccountRole::Stock, $this->ctx('2026-06-30 08:00:00'))->id);
        $this->assertSame($new->id, $resolver->resolve(AccountRole::Stock, $this->ctx('2026-07-01 08:00:00'))->id);
        // Sebelum profil mana pun berlaku: jatuh ke legacy.
        $this->assertSame($this->legacyStock->id, $resolver->resolve(AccountRole::Stock, $this->ctx('2025-12-31 08:00:00'))->id);
    }

    public function test_effective_date_uses_the_company_business_day(): void {
        $this->activeProfile(['stock' => $this->profileStock->id], from: '2026-07-01');

        // 18.00 UTC 30 Juni = 01.00 WIB 1 Juli (zona perusahaan default Asia/Jakarta, Q-P1-5).
        $this->assertSame($this->profileStock->id, $this->resolver()->resolve(AccountRole::Stock, $this->ctx('2026-06-30 18:00:00'))->id);
        $this->assertSame($this->legacyStock->id, $this->resolver()->resolve(AccountRole::Stock, $this->ctx('2026-06-30 16:00:00'))->id);
    }

    public function test_retired_and_draft_profiles_are_not_used(): void {
        $retired = $this->activeProfile(['stock' => $this->profileStock->id]);
        $this->profiles->retire($retired);
        $this->profiles->createDraft('Draft', '2026-01-01', null, ['stock' => $this->ruleStock->id]);

        $this->assertSame($this->legacyStock->id, $this->resolver()->resolve(AccountRole::Stock, $this->ctx())->id);
    }

    public function test_return_context_uses_return_rule_or_falls_back_to_the_normal_account(): void {
        $returns = $this->makeAccount('1247', 'Retur', 'asset');
        $this->activeProfile(['stock' => $this->profileStock->id], [
            ['role' => 'stock', 'account_id' => $returns->id, 'variant' => 'return', 'document_type' => 'delivery_note'],
        ]);

        $this->assertSame($returns->id, $this->resolver()->resolve(AccountRole::Stock, $this->ctx(flags: ['is_return' => true]))->id);
        $this->assertSame($this->profileStock->id, $this->resolver()->resolve(AccountRole::Stock, $this->ctx())->id);
        // Retur dokumen jenis lain tanpa aturan khusus = akun normal (P-11).
        $this->assertSame($this->profileStock->id, $this->resolver()->resolve(AccountRole::Stock, $this->ctx(flags: ['is_return' => true], type: PostingDocumentType::PurchaseReceipt))->id);
    }

    public function test_line_sensitive_rules_depend_on_line_attributes(): void {
        $nonStock = $this->makeAccount('5211', 'Beban Non Stok', 'expense');
        $general  = $this->makeAccount('5212', 'Beban Umum', 'expense');
        $this->activeProfile(['expense' => $general->id], [
            ['role' => 'expense', 'account_id' => $nonStock->id, 'is_stock_item' => false],
        ]);
        $ctx      = $this->ctx(type: PostingDocumentType::PurchaseInvoice);
        $resolver = $this->resolver();

        $this->assertSame($nonStock->id, $resolver->resolve(AccountRole::Expense, $ctx, new LineAttributes(['amount' => 1], isStockItem: false))->id);
        $this->assertSame($general->id, $resolver->resolve(AccountRole::Expense, $ctx, new LineAttributes(['amount' => 1], isStockItem: true))->id);
        $this->assertSame($general->id, $resolver->resolve(AccountRole::Expense, $ctx, null)->id, 'Tanpa baris, aturan berkondisi barang tidak cocok.');
    }

    public function test_resolution_is_deterministic_across_instances(): void {
        $this->activeProfile(['stock' => $this->profileStock->id], [['role' => 'stock', 'account_id' => $this->ruleStock->id, 'is_stock_item' => true]]);
        $line = new LineAttributes(['amount' => 1], isStockItem: true);

        $ids = [];
        for ($i = 0; $i < 4; $i++) {
            $ids[] = $this->resolver()->resolve(AccountRole::Stock, $this->ctx(), $line)->id;
        }

        $this->assertCount(1, array_unique($ids));
        $this->assertSame($this->ruleStock->id, $ids[0]);
    }

    public function test_ambiguous_legacy_pair_fails_closed_without_choosing(): void {
        $this->makeAccount('2211', 'Hutang A', 'liability', 'credit', 'payable');
        $this->makeAccount('2212', 'Hutang B', 'liability', 'credit', 'payable');
        Log::spy();

        try {
            $this->resolver()->resolve(AccountRole::Payable, $this->ctx());
            $this->fail('Pasangan legacy ambigu harus gagal tertutup.');
        } catch (UnresolvedAccountRoleException $e) {
            $this->assertSame('payable', $e->role);
            $this->assertStringContainsString('payable', $e->getMessage());
            $this->assertStringContainsString('2', $e->getMessage(), 'Jumlah kandidat disebut.');
            $this->assertStringContainsString('liability/payable', $e->getMessage());
        }

        Log::shouldHaveReceived('warning')->with('posting.legacy_account_ambiguous', \Mockery::on(
            fn (array $context) => $context['role'] === 'payable' && $context['candidates'] === 2,
        ))->once();
    }

    public function test_ambiguous_legacy_role_is_resolved_once_it_is_mapped_in_the_profile(): void {
        $this->makeAccount('2211', 'Hutang A', 'liability', 'credit', 'payable');
        $mapped = $this->makeAccount('2212', 'Hutang B', 'liability', 'credit', 'payable');
        $this->activeProfile(['payable' => $mapped->id]);

        $this->assertSame($mapped->id, $this->resolver()->resolve(AccountRole::Payable, $this->ctx())->id);
    }

    public function test_single_legacy_candidate_still_resolves(): void {
        $only = $this->makeAccount('2211', 'Hutang A', 'liability', 'credit', 'payable');

        $this->assertSame($only->id, $this->resolver()->resolve(AccountRole::Payable, $this->ctx())->id);
    }

    public function test_cache_avoids_repeated_queries_within_an_instance(): void {
        $this->activeProfile(['stock' => $this->profileStock->id]);
        $resolver = $this->resolver();
        $ctx      = $this->ctx();

        $resolver->resolve(AccountRole::Stock, $ctx);

        DB::enableQueryLog();
        $resolver->resolve(AccountRole::Stock, $ctx);
        $queries = DB::getQueryLog();
        DB::disableQueryLog();

        $this->assertSame([], $queries, 'Peran yang sama pada konteks setara tidak boleh query ulang.');
    }

    public function test_cache_does_not_cross_resolver_instances(): void {
        $this->activeProfile(['stock' => $this->profileStock->id]);

        $first = $this->resolver();
        $this->assertSame($this->profileStock->id, $first->resolve(AccountRole::Stock, $this->ctx())->id);

        // Konfigurasi berubah di antara dua job: instance baru membaca keadaan terkini, instance lama tetap memori jobnya.
        DB::table('posting_profile_accounts')->update(['account_id' => $this->ruleStock->id]);

        $this->assertSame($this->ruleStock->id, $this->resolver()->resolve(AccountRole::Stock, $this->ctx())->id);
        $this->assertSame($this->profileStock->id, $first->resolve(AccountRole::Stock, $this->ctx())->id);
        $this->assertNotSame($first, $this->resolver());
    }

    public function test_cache_key_distinguishes_variant_and_document_type(): void {
        $returns = $this->makeAccount('1247', 'Retur', 'asset');
        $this->activeProfile(['stock' => $this->profileStock->id], [
            ['role' => 'stock', 'account_id' => $returns->id, 'variant' => 'return'],
        ]);
        $resolver = $this->resolver();

        $this->assertSame($this->profileStock->id, $resolver->resolve(AccountRole::Stock, $this->ctx())->id);
        $this->assertSame($returns->id, $resolver->resolve(AccountRole::Stock, $this->ctx(flags: ['is_return' => true]))->id);
    }
}
