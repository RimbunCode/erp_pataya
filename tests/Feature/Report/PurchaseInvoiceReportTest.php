<?php

namespace Tests\Feature\Report;

use App\Models\Core\FormatingSeries;
use App\Models\Finances\Account;
use App\Models\Finances\PurchaseInvoice;
use App\Models\Purchase\PurchaseOrder;
use App\Models\Report\PurchaseInvoiceReportRow;
use App\Models\User\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia;
use PHPUnit\Framework\Attributes\Test;
use Tests\Support\InsertsReportData;
use Tests\TestCase;

class PurchaseInvoiceReportTest extends TestCase {
    use InsertsReportData;
    use RefreshDatabase;

    private User $user;
    private Account $account;

    protected function setUp(): void {
        parent::setUp();

        foreach (Schema::getTables() as $tableInfo) {
            $table = $tableInfo['name'];
            if (! Schema::hasColumn($table, 'is_example')) {
                Schema::table($table, fn ($t) => $t->boolean('is_example')->default(false));
            }
        }

        // Kolom runtime dibentuk initPermissions(); view membaca purchase_orders.code juga.
        foreach ([User::class, FormatingSeries::class, Account::class, PurchaseOrder::class, PurchaseInvoice::class] as $model) {
            $model::initPermissions();
        }

        $this->withoutVite();

        $this->user    = User::factory()->create();
        $this->account = Account::create(['account_name' => 'Hutang', 'account_number' => '2100', 'root_type' => 'liability', 'report_type' => 'balance_sheet']);
        $this->withCookie('lang', 'id');
    }

    /**
     * Invoice pembelian lewat DB. Outstanding dihitung DB (amount - paid).
     */
    private function reportPurchaseInvoice(float $amount, float $paid, float $dpp = 0, float $ppn = 0, string $date = '2026-10-10 10:00:00'): string {
        $id = (string) Str::ulid();

        $this->reportInsertRow('purchase_invoices', [
            'id'                      => $id,
            'code'                    => 'PI-' . Str::upper(Str::random(8)),
            'supplier_invoice'        => 'INV-' . Str::upper(Str::random(6)),
            'date'                    => $date,
            'supplier_name'           => 'Supplier Uji',
            'credit_account_id'       => $this->account->id,
            'expanse_head_account_id' => $this->account->id,
            'amount'                  => $amount,
            'paid_amount'             => $paid,
            'discount_amount'         => 0,
            'tax_invoice_dpp_amount'  => $dpp,
            'tax_invoice_ppn_amount'  => $ppn,
            'exchange_rate'           => 1,
            'status'                  => '["draft"]',
            'submitted_format'        => 'PI',
            'created_by_id'           => $this->user->id,
            'created_at'              => now(),
            'updated_at'              => now(),
        ]);

        return $id;
    }

    /**
     * Payment Entry sisi bayar yang menunjuk invoice pembelian.
     */
    private function reportPayment(string $invoiceId, float $amount, string $date): void {
        $this->reportInsertRow('payment_entries', [
            'id'                   => (string) Str::ulid(),
            'code'                 => 'PE-' . Str::upper(Str::random(8)),
            'date'                 => $date,
            'payment_type'         => 'pay',
            'party_type'           => 'supplier',
            'paymentable_type'     => PurchaseInvoice::class,
            'paymentable_id'       => $invoiceId,
            'paid_amount'          => $amount,
            'base_paid_amount'     => $amount,
            'exchange_rate'        => 1,
            'account_paid_to_id'   => $this->account->id,
            'account_paid_from_id' => $this->account->id,
            'created_at'           => now(),
            'updated_at'           => now(),
        ]);
    }

    #[Test]
    public function kpi_cocok_dengan_hitungan_manual_seluruh_invoice(): void {
        $this->reportPurchaseInvoice(1000, 400, 900, 100);
        $this->reportPurchaseInvoice(500, 0);
        $this->reportPurchaseInvoice(200, 200);

        $response = $this->actingAs($this->user)->withModelAccess(PurchaseInvoice::class)->get(route('reports.purchaseInvoice'));

        $response->assertOk();
        $response->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Report/PurchaseInvoice')
            ->where('kpi.0.value', 3)
            ->where('kpi.2.value', 900)
            ->where('kpi.3.value', 100)
            ->where('kpi.4.value', 1100)
            ->where('consistency', null));
    }

    #[Test]
    public function sisa_hutang_cocok_dengan_outstanding_amount_tabel_invoice(): void {
        $this->reportPurchaseInvoice(1000, 400);
        $this->reportPurchaseInvoice(500, 100);

        // Hitungan manual atas tabel: (1000 - 400) + (500 - 100) = 1000.
        $manualOutstanding = (float) DB::table('purchase_invoices')->sum('outstanding_amount');

        $response = $this->actingAs($this->user)->withModelAccess(PurchaseInvoice::class)->get(route('reports.purchaseInvoice'));

        $response->assertOk();
        $props = $response->viewData('page')['props'];
        $this->assertEqualsWithDelta($manualOutstanding, $props['kpi'][4]['value'], 0.001);
        $this->assertEqualsWithDelta(1000.0, $props['kpi'][4]['value'], 0.001);
    }

    #[Test]
    public function total_pelunasan_menjumlahkan_payment_entry_terkait(): void {
        $invoiceId = $this->reportPurchaseInvoice(1000, 0);
        $this->reportPayment($invoiceId, 300, '2026-10-05 09:00:00');
        $this->reportPayment($invoiceId, 200, '2026-10-12 09:00:00');

        $row = PurchaseInvoiceReportRow::query()->whereKey($invoiceId)->firstOrFail();

        $this->assertSame(500.0, (float) $row->paid_total);
        $this->assertStringStartsWith('2026-10-12', (string) $row->last_payment_date);
    }

    #[Test]
    public function filter_status_pembayaran_menyaring_tabel_dan_kpi(): void {
        $this->reportPurchaseInvoice(1000, 400);
        $this->reportPurchaseInvoice(500, 0);
        $this->reportPurchaseInvoice(200, 200);

        $response = $this->actingAs($this->user)->withModelAccess(PurchaseInvoice::class)
            ->get(route('reports.purchaseInvoice', ['payment_status' => 'belum']));

        $response->assertOk();
        $response->assertInertia(fn (AssertableInertia $page) => $page
            ->where('kpi.0.value', 1)
            ->where('kpi.4.value', 500)
            ->where('consistency', null));
    }

    #[Test]
    public function populasi_kosong_menampilkan_kpi_nol_tanpa_error(): void {
        $response = $this->actingAs($this->user)->withModelAccess(PurchaseInvoice::class)->get(route('reports.purchaseInvoice'));

        $response->assertOk();
        $response->assertInertia(fn (AssertableInertia $page) => $page
            ->where('kpi.0.value', 0)
            ->where('kpi.4.value', 0));
    }

    #[Test]
    public function pengguna_tanpa_izin_finances_ditolak(): void {
        $this->reportPurchaseInvoice(1, 0);

        $this->actingAs($this->user)->get(route('reports.purchaseInvoice'))->assertForbidden();
    }
}
