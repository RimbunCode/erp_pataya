<?php

namespace Tests\Feature\Finances\Posting;

use App\Enums\AccountRole;
use App\Models\Finances\Account;
use App\Models\Finances\FiscalYear;
use App\Models\Finances\PostingProfile;
use App\Services\Finances\Posting\PostingProfileInitializer;
use App\Services\Finances\Posting\PostingProfileService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Tests\Support\BuildsFinanceFixtures;
use Tests\TestCase;

/**
 * Finance Fase 2, Task 3.2: `finance:init-posting-profile` (Requirement 2.5). Membangkitkan profil awal dari COA,
 * melaporkan peran ambigu/hilang tanpa menebak, idempoten, dan `--report` tidak menulis apa pun.
 */
class InitPostingProfileCommandTest extends TestCase {
    use BuildsFinanceFixtures, RefreshDatabase;

    /** @var array<string, Account> */
    private array $accounts = [];

    protected function setUp(): void {
        parent::setUp();

        $this->setUpFinanceFixtures([PostingProfile::class]);

        $this->accounts['receivable'] = $this->makeAccount('1231', 'Piutang Dagang', 'asset', 'debit', 'receivable');
        $this->accounts['stock']      = $this->makeAccount('1241', 'Persediaan Barang', 'asset', 'debit', 'stock');
        // Pembuka stok pada ekuitas memiliki account_type `stock` tetapi bukan root `asset` (tidak menjadi kandidat).
        $this->makeAccount('3110', 'Pembukaan Stock', 'equity', 'credit', 'stock');
        $this->accounts['payable_a'] = $this->makeAccount('2211', 'Hutang Dagang DN', 'liability', 'credit', 'payable');
        $this->accounts['payable_b'] = $this->makeAccount('2212', 'Hutang Dagang LN', 'liability', 'credit', 'payable');
        $this->accounts['srnb']      = $this->makeAccount('2214', 'Stock Diterima Belum Dibayar', 'liability', 'credit', 'stock_received_but_not_billed');
        $this->accounts['income_a']  = $this->makeAccount('4110', 'Penjualan', 'income', 'credit', 'income_account');
        $this->accounts['income_b']  = $this->makeAccount('4120', 'Retur Penjualan', 'income', 'credit', 'income_account');
        $this->accounts['cogs']      = $this->makeAccount('4210', 'HPP', 'income', 'credit', 'cost_of_goods_sold');
        $this->accounts['adjust']    = $this->makeAccount('5110', 'Penyesuaian Stok', 'expense', 'debit', 'stock_adjustment');
    }

    /**
     * @param  array<string, mixed>  $options
     */
    private function runCommand(array $options = []): string {
        $this->assertSame(0, Artisan::call('finance:init-posting-profile', $options));

        return Artisan::output();
    }

    public function test_report_mode_lists_roles_and_writes_nothing(): void {
        $output = $this->runCommand(['--report' => true]);

        $this->assertSame(0, PostingProfile::query()->count());
        $this->assertSame(0, DB::table('posting_profile_accounts')->count());
        $this->assertStringContainsString('1231 - Piutang Dagang', $output, 'Peran ter-resolve dilaporkan.');
        $this->assertStringContainsString('2211 - Hutang Dagang DN', $output, 'Kandidat ambigu payable dilaporkan.');
        $this->assertStringContainsString('2212 - Hutang Dagang LN', $output);
        $this->assertStringContainsString('4120 - Retur Penjualan', $output, 'Kandidat ambigu revenue dilaporkan.');
        $this->assertStringContainsString('income/discount', $output, 'Peran tanpa akun (discount) dilaporkan.');
        $this->assertStringContainsString('cash_or_bank', $output, 'Peran akun master dilaporkan terpisah.');
        $this->assertStringNotContainsString('3110 - Pembukaan Stock', $output, 'Akun stock pada ekuitas bukan kandidat peran stock.');
    }

    public function test_analyze_classifies_roles_without_guessing(): void {
        $report = app(PostingProfileInitializer::class)->analyze();

        $this->assertSame($this->accounts['receivable']->id, $report['resolved']['receivable']['id']);
        $this->assertSame($this->accounts['stock']->id, $report['resolved']['stock']['id']);
        $this->assertSame($this->accounts['srnb']->id, $report['resolved']['stock_received_but_not_billed']['id']);
        $this->assertSame($this->accounts['srnb']->id, $report['resolved']['expense']['id'], 'expense mengikuti pasangan SRNB demi parity.');
        $this->assertSame($this->accounts['adjust']->id, $report['resolved']['stock_adjustment']['id']);
        $this->assertSame($this->accounts['cogs']->id, $report['resolved']['cost_of_goods_sold']['id']);

        $this->assertEqualsCanonicalizing(['payable', 'revenue'], array_keys($report['ambiguous']));
        $this->assertCount(2, $report['ambiguous']['payable']);
        $this->assertArrayNotHasKey('payable', $report['resolved']);
        $this->assertArrayNotHasKey('revenue', $report['resolved']);

        $this->assertEqualsCanonicalizing(['expense_included_in_valuation', 'discount'], array_keys($report['missing']));

        $this->assertContains('cash_or_bank', $report['master']);
        $this->assertContains('fixed_asset', $report['master']);
        $this->assertNotContains('receivable', $report['master']);
    }

    public function test_creates_a_draft_profile_with_only_unambiguous_roles(): void {
        $output = $this->runCommand(['--effective-from' => '2026-01-01']);

        $profile = PostingProfile::query()->where('name', PostingProfileInitializer::PROFILE_NAME)->firstOrFail();
        $this->assertSame(PostingProfile::STATUS_DRAFT, $profile->status);
        $this->assertSame(1, $profile->version);
        $this->assertSame('2026-01-01', $profile->effective_from->toDateString());
        $this->assertNull($profile->effective_to);

        $mapped = $profile->accounts()->pluck('account_id', 'role')->all();
        $this->assertSame($this->accounts['receivable']->id, $mapped['receivable']);
        $this->assertSame($this->accounts['stock']->id, $mapped['stock']);
        $this->assertSame($this->accounts['srnb']->id, $mapped['expense']);
        $this->assertArrayNotHasKey('payable', $mapped, 'Peran ambigu tidak ditebak.');
        $this->assertArrayNotHasKey('revenue', $mapped, 'Peran ambigu tidak ditebak.');
        $this->assertArrayNotHasKey('discount', $mapped);
        $this->assertArrayNotHasKey('cash_or_bank', $mapped);
        $this->assertSame(0, $profile->rules()->count(), 'Tidak ada aturan bersyarat yang dibuat otomatis (Requirement 12.7).');
        $this->assertStringContainsString('Tinjau', $output);
    }

    public function test_is_idempotent(): void {
        $this->runCommand(['--effective-from' => '2026-01-01']);
        $first = PostingProfile::query()->firstOrFail()->accounts()->pluck('account_id', 'role')->all();

        $output = $this->runCommand();

        $this->assertSame(1, PostingProfile::query()->count());
        $this->assertSame($first, PostingProfile::query()->firstOrFail()->accounts()->pluck('account_id', 'role')->all());
        $this->assertSame(\count($first), DB::table('posting_profile_accounts')->count());
        $this->assertStringContainsString('tidak ada perubahan', $output);
    }

    public function test_rerun_completes_newly_resolvable_roles_without_overwriting_existing_mappings(): void {
        $this->runCommand(['--effective-from' => '2026-01-01']);
        $profile     = PostingProfile::query()->firstOrFail();
        $stockBefore = $profile->accounts()->where('role', 'stock')->value('account_id');

        // Akuntan melengkapi COA: diskon kini ada, dan muncul akun `stock` kedua (peran stock jadi ambigu).
        $discount = $this->makeAccount('4130', 'Potongan Penjualan', 'income', 'credit', 'discount');
        $this->makeAccount('1242', 'Persediaan Kedua', 'asset', 'debit', 'stock');

        $output = $this->runCommand();

        $this->assertSame(1, PostingProfile::query()->count());
        $mapped = $profile->accounts()->pluck('account_id', 'role')->all();
        $this->assertSame($discount->id, $mapped['discount']);
        $this->assertSame($stockBefore, $mapped['stock'], 'Pemetaan yang sudah ada tidak ditimpa.');
        $this->assertStringContainsString('discount', $output);
    }

    public function test_does_not_touch_a_profile_that_is_no_longer_draft(): void {
        $this->runCommand(['--effective-from' => '2026-01-01']);
        $profile = PostingProfile::query()->firstOrFail();
        app(PostingProfileService::class)->activate($profile);
        $count = $profile->accounts()->count();

        $this->makeAccount('4130', 'Potongan Penjualan', 'income', 'credit', 'discount');
        $output = $this->runCommand();

        $this->assertSame($count, $profile->accounts()->count());
        $this->assertSame(1, PostingProfile::query()->count());
        $this->assertStringContainsString('active', $output);
    }

    public function test_group_disabled_and_deleted_accounts_are_not_candidates(): void {
        $this->accounts['stock']->update(['is_disabled' => true]);
        $this->accounts['receivable']->delete();

        $report = app(PostingProfileInitializer::class)->analyze();

        $this->assertArrayHasKey('stock', $report['missing']);
        $this->assertArrayHasKey('receivable', $report['missing']);
    }

    public function test_default_effective_date_is_the_start_of_the_oldest_fiscal_year(): void {
        FiscalYear::forceCreate(['name' => '2024', 'start_date' => '2024-01-01', 'end_date' => '2024-12-31', 'status' => 'open']);
        FiscalYear::forceCreate(['name' => '2025', 'start_date' => '2025-01-01', 'end_date' => '2025-12-31', 'status' => 'open']);

        $this->runCommand();

        $this->assertSame('2024-01-01', PostingProfile::query()->firstOrFail()->effective_from->toDateString());
    }

    public function test_every_role_with_a_legacy_pair_is_classified(): void {
        $report = app(PostingProfileInitializer::class)->analyze();

        $classified = array_merge(array_keys($report['resolved']), array_keys($report['ambiguous']), array_keys($report['missing']), $report['master']);

        $this->assertEqualsCanonicalizing(AccountRole::values(), $classified);
    }
}
