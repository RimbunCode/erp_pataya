<?php

namespace Tests\Feature\Report;

use App\Models\Core\FormatingSeries;
use App\Models\Finances\Account;
use App\Models\Finances\SalesInvoice;
use App\Models\Report\SalesInvoiceReportRow;
use App\Models\Sales\SalesOrder;
use App\Models\User\User;
use Database\Factories\Finances\SalesInvoiceFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia;
use PHPUnit\Framework\Attributes\Test;
use Tests\Support\InsertsReportData;
use Tests\TestCase;

class SalesInvoiceReportTest extends TestCase {
    use InsertsReportData;
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void {
        parent::setUp();

        foreach (Schema::getTables() as $tableInfo) {
            $table = $tableInfo['name'];
            if (! Schema::hasColumn($table, 'is_example')) {
                Schema::table($table, fn ($t) => $t->boolean('is_example')->default(false));
            }
        }

        // SalesOrder ikut karena view report_sales_invoices membaca sales_orders.code (kolom runtime).
        foreach ([User::class, FormatingSeries::class, Account::class, SalesOrder::class, SalesInvoice::class] as $model) {
            $model::initPermissions();
        }

        $this->withoutVite();

        $this->user = User::factory()->create();
        $this->withCookie('lang', 'id');
    }

    /**
     * Invoice dengan total, pelunasan, dan kolom DPP/PPN. Outstanding dihitung DB (amount - paid).
     */
    private function reportSalesInvoice(float $amount, float $paid, float $dpp = 0, float $ppn = 0, string $date = '2026-10-10 10:00:00'): SalesInvoice {
        // Kolom DPP dan PPN NOT NULL di skema tes, jadi invoice tanpa data pajak diisi 0.
        return SalesInvoiceFactory::new()->create([
            'date'                   => $date,
            'amount'                 => $amount,
            'paid_amount'            => $paid,
            'tax_invoice_dpp_amount' => $dpp,
            'tax_invoice_ppn_amount' => $ppn,
        ]);
    }

    /**
     * Payment Entry yang menunjuk invoice penjualan (paymentable seperti PaymentEntryService).
     */
    private function reportReceipt(SalesInvoice $invoice, float $amount, string $date): void {
        $account = Account::create(['account_name' => 'Kas', 'account_number' => '1100', 'root_type' => 'asset', 'report_type' => 'balance_sheet']);

        $this->reportInsertRow('payment_entries', [
            'id'                   => (string) Str::ulid(),
            'code'                 => 'PE-' . Str::upper(Str::random(8)),
            'date'                 => $date,
            'payment_type'         => 'receive',
            'party_type'           => 'customer',
            'paymentable_type'     => SalesInvoice::class,
            'paymentable_id'       => $invoice->id,
            'paid_amount'          => $amount,
            'base_paid_amount'     => $amount,
            'exchange_rate'        => 1,
            'account_paid_to_id'   => $account->id,
            'account_paid_from_id' => $account->id,
            'created_at'           => now(),
            'updated_at'           => now(),
        ]);
    }

    #[Test]
    public function kpi_cocok_dengan_hitungan_manual_seluruh_invoice(): void {
        $this->reportSalesInvoice(1000, 400, 900, 100);
        $this->reportSalesInvoice(500, 0);
        $this->reportSalesInvoice(200, 200);

        $response = $this->actingAs($this->user)->withModelAccess(SalesInvoice::class)->get(route('reports.salesInvoice'));

        $response->assertOk();
        $response->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Report/SalesInvoice')
            ->where('kpi.0.value', 3)
            ->where('kpi.2.value', 1700)
            ->where('kpi.3.value', 100)
            ->where('kpi.4.value', 1100)
            ->where('consistency', null));
    }

    #[Test]
    public function sisa_piutang_cocok_dengan_outstanding_amount_tabel_invoice(): void {
        $this->reportSalesInvoice(1000, 400);
        $this->reportSalesInvoice(500, 100);

        // Hitungan manual atas tabel: (1000 - 400) + (500 - 100) = 1000.
        $manualOutstanding = (float) DB::table('sales_invoices')->sum('outstanding_amount');

        $response = $this->actingAs($this->user)->withModelAccess(SalesInvoice::class)->get(route('reports.salesInvoice'));

        $response->assertOk();
        $props = $response->viewData('page')['props'];
        $this->assertEqualsWithDelta($manualOutstanding, $props['kpi'][4]['value'], 0.001);
        $this->assertEqualsWithDelta(1000.0, $props['kpi'][4]['value'], 0.001);
    }

    #[Test]
    public function total_pelunasan_menjumlahkan_payment_entry_terkait(): void {
        $invoice = $this->reportSalesInvoice(1000, 0);
        $this->reportReceipt($invoice, 300, '2026-10-05 09:00:00');
        $this->reportReceipt($invoice, 200, '2026-10-12 09:00:00');

        $row = SalesInvoiceReportRow::query()->whereKey($invoice->id)->firstOrFail();

        $this->assertSame(500.0, (float) $row->paid_total);
        $this->assertStringStartsWith('2026-10-12', (string) $row->last_payment_date);
    }

    #[Test]
    public function filter_status_pembayaran_menyaring_tabel_dan_kpi(): void {
        $this->reportSalesInvoice(1000, 400);
        $this->reportSalesInvoice(500, 0);
        $this->reportSalesInvoice(200, 200);

        $response = $this->actingAs($this->user)->withModelAccess(SalesInvoice::class)
            ->get(route('reports.salesInvoice', ['payment_status' => 'lunas']));

        $response->assertOk();
        $response->assertInertia(fn (AssertableInertia $page) => $page
            ->where('kpi.0.value', 1)
            ->where('kpi.2.value', 200)
            ->where('consistency', null));
    }

    #[Test]
    public function populasi_kosong_menampilkan_kpi_nol_tanpa_error(): void {
        $response = $this->actingAs($this->user)->withModelAccess(SalesInvoice::class)->get(route('reports.salesInvoice'));

        $response->assertOk();
        $response->assertInertia(fn (AssertableInertia $page) => $page
            ->where('kpi.0.value', 0)
            ->where('kpi.4.value', 0));
    }

    #[Test]
    public function pengguna_tanpa_izin_finances_ditolak(): void {
        $this->reportSalesInvoice(1, 0);

        $this->actingAs($this->user)->get(route('reports.salesInvoice'))->assertForbidden();
    }
}
