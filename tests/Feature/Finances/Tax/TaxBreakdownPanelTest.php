<?php

namespace Tests\Feature\Finances\Tax;

use App\Models\Core\Branch;
use App\Models\Core\Country;
use App\Models\Finances\Account;
use App\Models\Finances\PostingProfile;
use App\Models\Finances\PurchaseInvoice;
use App\Models\Finances\SalesInvoice;
use App\Models\Finances\Tax;
use App\Models\Finances\TaxRuleVersion;
use App\Models\Sales\Customer;
use App\Models\Sales\SalesOrder;
use App\Services\Finances\SalesInvoiceService;
use App\Services\Finances\Tax\DocumentTaxSnapshot;
use App\Services\Finances\Tax\TaxBreakdownPanel;
use App\Services\Finances\Tax\TaxRuleVersionService;
use Database\Factories\Core\CountryFactory;
use Database\Factories\Inventory\ItemVariantFactory;
use Database\Factories\Sales\CustomerFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Support\BuildsFinanceFixtures;
use Tests\TestCase;

/**
 * Finance Fase 3, Task 8.2 (Requirement 5.5, 5.6, 10.2): data panel "Rincian Pajak". Angka berasal dari
 * `tax_breakdown` tersimpan (atau nilai item tersimpan untuk invoice tanpa snapshot); versi yang hilang dan
 * snapshot gagal tidak menimbulkan galat; tautan versi mengikuti izin pembaca.
 */
class TaxBreakdownPanelTest extends TestCase {
    use BuildsFinanceFixtures, RefreshDatabase;

    private Account $receivable;
    private Account $income;
    private Tax $tax;
    private TaxRuleVersion $version;

    protected function setUp(): void {
        parent::setUp();

        $this->setUpFinanceFixtures([PostingProfile::class, SalesInvoice::class, SalesOrder::class, PurchaseInvoice::class, Tax::class, TaxRuleVersion::class]);

        $this->receivable = $this->makeAccount('1200', 'Piutang Usaha', 'asset', 'debit', 'accounts_receivable');
        $this->income     = $this->makeAccount('4000', 'Penjualan', 'income', 'credit', 'sales');

        $this->tax     = Tax::query()->create(['name' => 'PPN 12%', 'rate' => 12, 'category' => Tax::CATEGORY_PPN_STANDARD]);
        $versions      = app(TaxRuleVersionService::class);
        $this->version = $versions->activate($versions->createDraft($this->tax, [
            'effective_from'  => '2026-01-01',
            'rate'            => 12,
            'dpp_numerator'   => 11,
            'dpp_denominator' => 12,
        ]));
    }

    private function permit(bool $tax, bool $versions): void {
        $grant = fn (string $model, bool $on): array => $on ? [$model => [0 => [['model' => $model, 'level' => 0, 'only_creator' => false, 'permissions' => ['read' => true]]]]] : [];

        $this->withSession([
            'permissions' => [...$grant(Tax::class, $tax), ...$grant(TaxRuleVersion::class, $versions)],
        ]);
    }

    private function invoice(bool $withTax = true): SalesInvoice {
        $country  = Country::query()->find('IDN') ?? CountryFactory::new()->create(['code' => 'IDN']);
        $customer = CustomerFactory::new()->create(['country_id' => $country->code]);
        $branch   = Branch::where('branchable_type', Customer::class)->where('branchable_id', $customer->id)->where('is_main_branch', true)->firstOrFail();

        return app(SalesInvoiceService::class)->create([
            'customer'        => ['id' => $customer->id],
            'customer_branch' => ['id' => $branch->id],
            'income_account'  => ['id' => $this->income->id],
            'debit_account'   => ['id' => $this->receivable->id],
            'branch'          => ['code' => 'HQ', 'name' => 'Head Office'],
            'date'            => '2026-03-10',
            'items'           => [[
                'id'       => (string) Str::ulid(),
                'item'     => ['id' => ItemVariantFactory::new()->create()->id],
                'unit'     => ['id' => null],
                'tax'      => ['id' => $withTax ? $this->tax->getKey() : null],
                'quantity' => 10,
                'price'    => 100000,
            ]],
        ]);
    }

    private function panel(SalesInvoice $invoice): array {
        return app(TaxBreakdownPanel::class)->build($invoice->refresh());
    }

    private function approve(SalesInvoice $invoice, ?array $breakdown = null): void {
        DB::table('sales_invoices')->where('id', $invoice->id)->update([
            'submitted_at'  => now(),
            'tax_breakdown' => $breakdown === null ? null : json_encode($breakdown),
        ]);
    }

    public function test_models_declare_the_panel(): void {
        $this->assertTrue(SalesInvoice::hasTaxBreakdownPanel());
        $this->assertTrue(PurchaseInvoice::hasTaxBreakdownPanel());
        $this->assertFalse(Tax::hasTaxBreakdownPanel());
    }

    public function test_unapproved_invoice_shows_stored_item_values_as_pending(): void {
        $panel = $this->panel($this->invoice());

        $this->assertSame('pending', $panel['state']);
        $this->assertCount(1, $panel['rows']);
        $row = $panel['rows'][0];
        $this->assertSame(1, $row['line']);
        $this->assertSame('PPN 12%', $row['tax_name']);
        $this->assertSame('11/12', $row['dpp_factor']);
        $this->assertFalse($row['is_legacy']);
        $this->assertSame(['id' => $this->version->id, 'number' => 1, 'rounding_mode' => 'per_line', 'missing' => false], $row['version']);
        $this->assertSame('1000000.00', $row['base_amount']);
    }

    public function test_approved_invoice_with_snapshot_reads_the_stored_snapshot_without_recomputing(): void {
        $invoice = $this->invoice();
        $built   = app(DocumentTaxSnapshot::class)->build($invoice->items()->get(), $invoice->date, 2)->toArray();
        // Nilai snapshot sengaja berbeda dari hitungan engine: panel harus menampilkan apa yang tersimpan.
        $built['components'][0]['tax_amount'] = '999.00';
        $this->approve($invoice, $built);

        $panel = $this->panel($invoice);

        $this->assertSame('snapshot', $panel['state']);
        $this->assertSame('999.00', $panel['rows'][0]['tax_amount']);
        $this->assertSame([], $panel['warnings']);
        $this->assertNotNull($panel['totals']);
    }

    public function test_snapshot_failure_warning_is_reported_with_no_rows(): void {
        $invoice = $this->invoice();
        $this->approve($invoice, [
            'minor_unit'        => 2,
            'components'        => [],
            'total_additive'    => '0',
            'total_withholding' => '0',
            'explanation'       => [],
            'warnings'          => [DocumentTaxSnapshot::FAILURE_WARNING],
        ]);

        $panel = $this->panel($invoice);

        $this->assertSame('snapshot', $panel['state']);
        $this->assertSame(['snapshot_build_failed'], $panel['warnings']);
        $this->assertSame([], $panel['rows']);
        $this->assertNull($panel['totals']);
    }

    public function test_approved_invoice_without_snapshot_is_explained_as_legacy(): void {
        $invoice = $this->invoice();
        DB::table('sales_invoice_items')->where('sales_invoice_id', $invoice->id)->update(['tax_rule_version_id' => null]);
        $this->approve($invoice);

        $panel = $this->panel($invoice);

        $this->assertSame('legacy', $panel['state']);
        $this->assertTrue($panel['rows'][0]['is_legacy']);
        $this->assertNull($panel['rows'][0]['version']);
    }

    public function test_missing_version_is_marked_without_error(): void {
        $invoice                                   = $this->invoice();
        $built                                     = app(DocumentTaxSnapshot::class)->build($invoice->items()->get(), $invoice->date, 2)->toArray();
        $built['components'][0]['rule_version_id'] = (string) Str::ulid();
        $this->approve($invoice, $built);

        $panel = $this->panel($invoice);

        $this->assertSame('snapshot', $panel['state']);
        $this->assertTrue($panel['rows'][0]['version']['missing']);
        $this->assertNull($panel['rows'][0]['version']['number']);
        $this->assertFalse($panel['rows'][0]['is_legacy']);
    }

    public function test_invoice_without_taxed_lines_has_state_none(): void {
        $this->assertSame('none', $this->panel($this->invoice(withTax: false))['state']);
    }

    public function test_version_links_require_read_on_both_tax_and_rule_versions(): void {
        $invoice = $this->invoice();

        $this->permit(true, true);
        $this->assertTrue($this->panel($invoice)['can_view_versions']);

        $this->permit(true, false);
        $this->assertFalse($this->panel($invoice)['can_view_versions']);

        $this->permit(false, true);
        $this->assertFalse($this->panel($invoice)['can_view_versions']);
    }
}
