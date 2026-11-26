<?php

namespace Tests\Feature\Finances\Posting;

use App\Models\Finances\Account;
use App\Models\Finances\PostingProfile;
use App\Models\Inventory\Category;
use App\Models\Inventory\Item;
use App\Models\Inventory\ItemVariant;
use App\Services\Finances\Posting\PostingProfileInitializer;
use App\Services\Finances\Posting\PostingProfileService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Tests\Support\BuildsFinanceFixtures;
use Tests\TestCase;

/**
 * Finance Fase 2, Task 12.5: `finance:init-posting-profile --report` mengeluarkan USULAN aturan akun bersyarat awal
 * (barang non-stok, retur, kategori; Requirement 12.7) untuk dibaca akuntan. Usulan tidak memilih akun, tidak
 * membuat aturan, dan tidak menulis apa pun ke DB.
 */
class InitPostingProfileProposalsTest extends TestCase {
    use BuildsFinanceFixtures, RefreshDatabase;

    private Account $salesReturn;
    private Account $srnb;

    protected function setUp(): void {
        parent::setUp();

        $this->setUpFinanceFixtures([PostingProfile::class, Item::class, ItemVariant::class, Category::class]);

        $this->makeAccount('1231', 'Piutang Dagang', 'asset', 'debit', 'receivable');
        $this->makeAccount('3110', 'Pembukaan Stock', 'equity', 'credit', 'stock');
        $this->srnb = $this->makeAccount('2214', 'Stock Diterima Belum Dibayar', 'liability', 'credit', 'stock_received_but_not_billed');
        $this->makeAccount('4110', 'Penjualan', 'income', 'credit', 'income_account');
        $this->salesReturn = $this->makeAccount('4120', 'Retur Penjualan', 'income', 'credit', 'income_account');
        $this->makeAccount('5110', 'Penyesuaian Stok', 'expense', 'debit', 'stock_adjustment');
        $this->makeAccount('5310', 'Beban Jasa', 'expense', 'debit', 'expense_account');
    }

    private function makeVariant(string $code, ?Category $category, bool $stock): ItemVariant {
        $item = Item::create(['code' => $code, 'name' => "Item {$code}", 'type' => 'inventory']);

        return ItemVariant::create([
            'item_id'       => $item->id,
            'code'          => "{$code}-VAR",
            'item_code'     => $code,
            'item_name'     => "Item {$code}",
            'type'          => 'inventory',
            'is_stock_item' => $stock,
            'category_id'   => $category?->id,
        ]);
    }

    /**
     * @return array<string, array<string, mixed>>
     */
    private function proposals(): array {
        $byKey = [];
        foreach (app(PostingProfileInitializer::class)->proposeRules() as $proposal) {
            $byKey[$proposal['key']] = $proposal;
        }

        return $byKey;
    }

    private function runReport(): string {
        $this->assertSame(0, Artisan::call('finance:init-posting-profile', ['--report' => true]));

        return Artisan::output();
    }

    public function test_report_mode_writes_nothing_to_the_database(): void {
        $category = Category::create(['name' => 'Jasa', 'type' => 'service']);
        $this->makeVariant('SVC-1', $category, false);

        DB::enableQueryLog();
        $output = $this->runReport();
        $log    = DB::getQueryLog();
        DB::disableQueryLog();

        $this->assertStringContainsString('Usulan aturan akun bersyarat awal', $output);
        $this->assertNotEmpty($log);
        foreach ($log as $query) {
            $this->assertMatchesRegularExpression('/^\s*select\b/i', $query['query'], 'Mode laporan hanya boleh membaca: ' . $query['query']);
        }
        $this->assertSame(0, DB::table('posting_profiles')->count());
        $this->assertSame(0, DB::table('posting_profile_accounts')->count());
        $this->assertSame(0, DB::table('posting_profile_rules')->count());
    }

    public function test_return_proposals_list_candidates_without_choosing_an_account(): void {
        $proposals = $this->proposals();

        $sales = $proposals['sales_invoice.return'];
        $this->assertSame(['sales_invoice', 'return', 'revenue'], [$sales['document_type'], $sales['variant'], $sales['role']]);
        $this->assertSame(['4120 - Retur Penjualan'], $sales['candidates']);
        $this->assertSame('(ambigu; belum dipetakan)', $sales['default_account'], 'Peran revenue ambigu (4110 dan 4120) tidak ditebak.');

        $purchase = $proposals['purchase_invoice.return'];
        $this->assertSame(['purchase_invoice', 'return', 'expense'], [$purchase['document_type'], $purchase['variant'], $purchase['role']]);
        $this->assertSame([], $purchase['candidates'], 'COA tidak punya akun Retur Pembelian: akun Retur Penjualan tidak boleh diusulkan.');
        $this->assertStringContainsString('buat akun Retur pembelian', $purchase['note']);
        $this->assertSame('2214 - Stock Diterima Belum Dibayar', $purchase['default_account']);
    }

    public function test_purchase_return_lists_a_matching_account_when_the_coa_has_one(): void {
        $this->makeAccount('5120', 'Retur Pembelian', 'expense', 'debit', 'expense_account');

        $purchase = $this->proposals()['purchase_invoice.return'];

        $this->assertSame(['5120 - Retur Pembelian'], $purchase['candidates']);
    }

    public function test_english_named_opposite_document_accounts_are_not_candidates(): void {
        $this->makeAccount('4130', 'Sales Returns', 'income', 'credit', 'income_account');
        $this->makeAccount('4140', 'Purchase Return', 'income', 'credit', 'income_account');
        $this->makeAccount('5120', 'Purchase Returns', 'expense', 'debit', 'expense_account');

        $proposals = $this->proposals();

        $this->assertSame(['4120 - Retur Penjualan', '4130 - Sales Returns'], $proposals['sales_invoice.return']['candidates']);
        $this->assertSame(['4140 - Purchase Return', '5120 - Purchase Returns'], $proposals['purchase_invoice.return']['candidates'], 'Akun Sales Return berakar income tidak boleh menjadi kandidat Retur Pembelian.');
    }

    public function test_report_output_escapes_console_markup_in_account_names(): void {
        $this->makeAccount('4150', 'Retur Penjualan <fg=red>PALSU</>', 'income', 'credit', 'income_account');

        $output = $this->runReport();

        $this->assertStringContainsString('<fg=red>PALSU</>', $output);
    }

    public function test_non_stock_and_category_proposals_follow_live_non_stock_variants(): void {
        $this->assertArrayNotHasKey('purchase_invoice.non_stock', $this->proposals(), 'Tanpa varian non-stok tidak ada usulan non-stok.');

        $services = Category::create(['name' => 'Jasa Angkut', 'type' => 'service']);
        $office   = Category::create(['name' => 'ATK', 'type' => 'inventory']);
        $deleted  = Category::create(['name' => 'Kategori Dihapus', 'type' => 'service']);
        $stockCat = Category::create(['name' => 'Bahan Baku', 'type' => 'inventory']);

        $this->makeVariant('SVC-1', $services, false);
        $this->makeVariant('SVC-2', $services, false);
        $this->makeVariant('OFF-1', $office, false);
        $this->makeVariant('DEL-1', $deleted, false);
        $this->makeVariant('RAW-1', $stockCat, true);
        $this->makeVariant('NOCAT-1', null, false);
        $this->makeVariant('GONE-1', $office, false)->delete();
        $deleted->delete();

        $proposals = $this->proposals();

        $general = $proposals['purchase_invoice.non_stock'];
        $this->assertSame(['purchase_invoice', 'normal', 'expense'], [$general['document_type'], $general['variant'], $general['role']]);
        $this->assertFalse($general['conditions']['is_stock_item']);
        $this->assertNull($general['conditions']['category']);
        $this->assertSame('5 varian barang non-stok', $general['basis'], 'Varian stok dan varian terhapus tidak dihitung.');
        $this->assertSame(['5110 - Penyesuaian Stok', '5310 - Beban Jasa'], $general['candidates'], 'Kandidat hanya akun berakar beban, bukan SRNB.');

        $categoryProposals = array_values(array_filter($proposals, static fn (array $p): bool => $p['conditions']['category'] !== null));
        $this->assertSame(['ATK', 'Jasa Angkut'], array_column(array_column($categoryProposals, 'conditions'), 'category'), 'Kategori terhapus dan kategori tanpa varian non-stok tidak diusulkan; urut nama.');
        $this->assertSame('2 varian barang non-stok pada kategori ini', $categoryProposals[1]['basis']);
        $this->assertSame($services->id, $categoryProposals[1]['conditions']['category_id']);
    }

    public function test_group_and_disabled_accounts_are_not_candidates(): void {
        $this->makeVariant('SVC-1', null, false);
        Account::where('account_number', '5310')->update(['is_disabled' => true]);
        $this->makeAccount('5400', 'Beban Grup', 'expense', 'debit', null)->update(['is_group' => true]);

        $this->assertSame(['5110 - Penyesuaian Stok'], $this->proposals()['purchase_invoice.non_stock']['candidates']);
    }

    public function test_every_proposal_is_a_valid_rule_shape_for_the_profile_service(): void {
        $category = Category::create(['name' => 'Jasa Angkut', 'type' => 'service']);
        $this->makeVariant('SVC-1', $category, false);
        $this->makeAccount('5120', 'Retur Pembelian', 'expense', 'debit', 'expense_account');

        $proposals = app(PostingProfileInitializer::class)->proposeRules();
        $this->assertCount(4, $proposals);

        $rules = [];
        foreach ($proposals as $proposal) {
            $this->assertNotEmpty($proposal['candidates'], $proposal['key']);
            $accountNumber = explode(' - ', $proposal['candidates'][0])[0];
            $rules[]       = [
                'role'             => $proposal['role'],
                'account_id'       => Account::where('account_number', $accountNumber)->value('id'),
                'document_type'    => $proposal['document_type'],
                'variant'          => $proposal['variant'],
                'is_stock_item'    => $proposal['conditions']['is_stock_item'],
                'item_category_id' => $proposal['conditions']['category_id'],
            ];
        }

        $profile = app(PostingProfileService::class)->createDraft('Skrip validasi usulan', '2026-01-01', null, [], $rules);

        $this->assertSame(4, $profile->rules()->count());
    }

    public function test_report_output_is_deterministic_and_lists_the_proposals(): void {
        $this->makeVariant('SVC-1', Category::create(['name' => 'Jasa Angkut', 'type' => 'service']), false);

        $first  = $this->runReport();
        $second = $this->runReport();

        $this->assertSame($first, $second);
        $this->assertStringContainsString('Usulan 1: sales_invoice / return / peran revenue', $first);
        $this->assertStringContainsString('Usulan 2: purchase_invoice / return / peran expense', $first);
        $this->assertStringContainsString('Usulan 3: purchase_invoice / normal / peran expense', $first);
        $this->assertStringContainsString('is_stock_item = tidak; kategori = Jasa Angkut', $first);
        $this->assertStringContainsString('- 4120 - Retur Penjualan', $first);
        $this->assertStringContainsString('(tidak ada)', $first, 'Usulan tanpa kandidat dilaporkan eksplisit.');
        $this->assertStringContainsString('tidak ada akun yang dipilih dan tidak ada aturan yang dibuat', $first);
        $this->assertStringNotContainsString('3110 - Pembukaan Stock', $first);
    }

    public function test_apply_mode_does_not_print_proposals_and_never_creates_rules(): void {
        $this->makeVariant('SVC-1', null, false);

        $this->assertSame(0, Artisan::call('finance:init-posting-profile', ['--effective-from' => '2026-01-01']));
        $output = Artisan::output();

        $this->assertStringNotContainsString('Usulan aturan akun bersyarat', $output);
        $this->assertSame(1, PostingProfile::query()->count());
        $this->assertSame(0, DB::table('posting_profile_rules')->count());
    }
}
