<?php

namespace Tests\Feature\Report;

use App\Models\Inventory\StockLedgerEntry;
use App\Models\User\User;
use App\Services\Report\ReportCatalog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use PHPUnit\Framework\Attributes\Test;
use Tests\Support\InsertsReportData;
use Tests\TestCase;

class ReportExportRecountTest extends TestCase {
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

        $this->withoutVite();

        $this->user = User::factory()->create();
        $this->withCookie('lang', 'id');
    }

    /**
     * Sesi dengan izin select pada Stock, dan izin administratif User.manage_roles bila $admin.
     */
    private function withStockSession(bool $admin): static {
        $permissions = [
            StockLedgerEntry::class => [
                0 => [
                    ['model' => StockLedgerEntry::class, 'level' => 0, 'only_creator' => false, 'permissions' => ['select' => true, 'read' => true]],
                ],
            ],
        ];

        if ($admin) {
            $permissions[User::class] = [
                0 => [
                    ['model' => User::class, 'level' => 0, 'only_creator' => false, 'permissions' => ['select' => true, 'manage_roles' => true]],
                ],
            ];
        }

        return $this->withSession([
            'permissions'         => $permissions,
            'permissions_version' => '0|0|0|0',
            'currentBranch'       => null,
        ]);
    }

    /**
     * Baris CSV sebagai array sel, dimulai dari header tabel ("Tanggal") sampai akhir berkas.
     *
     * @return list<list<string>>
     */
    private function csvTableRows(string $content): array {
        $lines = array_values(array_filter(explode("\n", ltrim($content, "\xEF\xBB\xBF"))));
        $rows  = array_map('str_getcsv', $lines);

        $headerIndex = null;
        foreach ($rows as $index => $row) {
            if (($row[0] ?? null) === __('report.columns.transaction_date')) {
                $headerIndex = $index;
                break;
            }
        }

        $this->assertNotNull($headerIndex, 'Header tabel tidak ditemukan dalam CSV.');

        return array_values(array_filter(array_slice($rows, $headerIndex + 1), fn ($row) => trim(implode('', $row)) !== ''));
    }

    #[Test]
    public function csv_memuat_judul_filter_kpi_dan_seluruh_baris_hasil_filter(): void {
        $warehouseA = $this->reportWarehouse();
        $warehouseB = $this->reportWarehouse();
        $this->reportLedgerEntry(['warehouse_id' => $warehouseA, 'quantity_change' => 10]);
        $this->reportLedgerEntry(['warehouse_id' => $warehouseA, 'quantity_change' => -4]);
        $this->reportLedgerEntry(['warehouse_id' => $warehouseA, 'quantity_change' => -3]);
        $this->reportLedgerEntry(['warehouse_id' => $warehouseB, 'quantity_change' => 99]);

        $response = $this->actingAs($this->user)->withStockSession(admin: false)
            ->get(route('reports.export', ['report' => 'stock_mutation', 'format' => 'csv', 'warehouse_id' => $warehouseA]));

        $response->assertOk();
        $response->assertHeader('Content-Type', 'text/csv; charset=UTF-8');

        $content = $response->getContent();

        // Judul, filter aktif, dan KPI ada di atas header (Req 7.3 dan 7.6).
        $this->assertStringContainsString('Mutasi Stock', $content);
        $this->assertStringContainsString('Gudang: ' . $warehouseA, $content);
        $this->assertStringContainsString('Total Transaksi', $content);

        // Seluruh baris hasil filter (3), bukan baris gudang lain (Req 7.2).
        $this->assertCount(3, $this->csvTableRows($content));
    }

    #[Test]
    public function pdf_berupa_berkas_pdf(): void {
        $this->reportLedgerEntry(['quantity_change' => 1]);

        $response = $this->actingAs($this->user)->withStockSession(admin: false)
            ->get(route('reports.export', ['report' => 'stock_mutation', 'format' => 'pdf']));

        $response->assertOk();
        $response->assertHeader('Content-Type', 'application/pdf');
        $this->assertStringStartsWith('%PDF', $response->getContent());
    }

    #[Test]
    public function format_tidak_dikenal_menghasilkan_404(): void {
        $this->actingAs($this->user)->withStockSession(admin: false)
            ->get('/reports/export/stock_mutation/xlsx')
            ->assertNotFound();
    }

    #[Test]
    public function export_tanpa_izin_modul_sumber_ditolak(): void {
        $this->actingAs($this->user)
            ->get(route('reports.export', ['report' => 'stock_mutation', 'format' => 'csv']))
            ->assertForbidden();
    }

    #[Test]
    public function hitung_ulang_ditolak_untuk_pengguna_tanpa_izin_administratif(): void {
        $this->actingAs($this->user)->withStockSession(admin: false)
            ->get(route('reports.recount', ['report' => 'stock_mutation']))
            ->assertForbidden();
    }

    #[Test]
    public function hitung_ulang_admin_sama_dengan_kpi_dan_jumlah_baris(): void {
        $warehouse = $this->reportWarehouse();
        $this->reportLedgerEntry(['warehouse_id' => $warehouse, 'quantity_change' => 10]);
        $this->reportLedgerEntry(['warehouse_id' => $warehouse, 'quantity_change' => -4]);
        $this->reportLedgerEntry(['warehouse_id' => $warehouse, 'quantity_change' => -3]);

        // Hitung ulang di aplikasi harus sama dengan KPI yang dihitung SQL (Req 5.6 dan 5.7).
        $response = $this->actingAs($this->user)->withStockSession(admin: true)
            ->get(route('reports.recount', ['report' => 'stock_mutation', 'warehouse_id' => $warehouse]), ['Accept' => 'application/json']);

        $response->assertOk();
        $response->assertJsonPath('rowCount', 3);
        $response->assertJsonPath('values.total_transaction', 3);
        $response->assertJsonPath('values.total_in', 10);
        $response->assertJsonPath('values.total_out', 7);
    }

    #[Test]
    public function katalog_mencakup_sembilan_laporan(): void {
        $keys = array_keys(app(ReportCatalog::class)->all());

        $this->assertCount(9, $keys);
        $this->assertSame(
            ['stock_balance', 'stock_mutation', 'sales', 'purchase', 'sales_invoice', 'purchase_invoice', 'work_order_monitoring', 'sparepart_usage', 'team_activity'],
            $keys,
        );
    }
}
