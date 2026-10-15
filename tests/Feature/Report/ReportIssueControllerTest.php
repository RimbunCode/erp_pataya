<?php

namespace Tests\Feature\Report;

use App\Models\Core\FormatingSeries;
use App\Models\Helpdesk\Ticket;
use App\Models\User\Role;
use App\Models\User\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class ReportIssueControllerTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        foreach (Schema::getTables() as $tableInfo) {
            $table = $tableInfo['name'];
            if (! Schema::hasColumn($table, 'is_example')) {
                Schema::table($table, fn ($t) => $t->boolean('is_example')->default(false));
            }
        }

        if (! FormatingSeries::where('model', Ticket::class)->exists()) {
            FormatingSeries::create([
                'model'  => Ticket::class,
                'name'   => 'Ticket',
                'format' => '#@[yy]/@[iiii]',
                'logs'   => ['iy' => []],
            ]);
        }

        config(['report.issue_role' => 'IT']);
        Role::create(['name' => 'IT', 'description' => 'Tim IT', 'is_disabled' => false]);
        Notification::fake();

        // Middleware LanguageMiddleware mengalihkan ke /lang bila cookie bahasa belum ada.
        $this->withCookie('lang', 'id');
    }

    public function test_pengguna_biasa_dapat_melaporkan_masalah(): void {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->post(route('reports.issues.store'), [
            'report'     => 'Stok Persediaan',
            'kpi_rows'   => 7,
            'table_rows' => 5,
            'filter'     => ['Gudang' => 'Gudang A'],
            'url'        => 'https://erp.test/reports/stock-balance',
        ]);

        $response->assertSessionHas('reportIssueTicket');
        $this->assertDatabaseCount('tickets', 1);
        $this->assertDatabaseHas('tickets', ['type' => 'bug_problem', 'priority' => 'high', 'assign_to_type' => 'role']);
    }

    public function test_validasi_menolak_jumlah_baris_tidak_valid(): void {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->post(route('reports.issues.store'), [
            'report'     => 'Stok Persediaan',
            'kpi_rows'   => 'banyak',
            'table_rows' => -1,
            'url'        => 'https://erp.test/reports/stock-balance',
        ]);

        $response->assertSessionHasErrors(['kpi_rows', 'table_rows']);
        $this->assertDatabaseCount('tickets', 0);
    }

    public function test_validasi_menolak_nama_laporan_karangan(): void {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->post(route('reports.issues.store'), [
            'report'     => 'Laporan Karangan Sendiri',
            'kpi_rows'   => 7,
            'table_rows' => 5,
            'url'        => 'https://erp.test/reports/stock-balance',
        ]);

        $response->assertSessionHasErrors(['report']);
        $this->assertDatabaseCount('tickets', 0);
    }

    public function test_validasi_menolak_label_filter_di_luar_daftar(): void {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->post(route('reports.issues.store'), [
            'report'     => 'Stok Persediaan',
            'kpi_rows'   => 7,
            'table_rows' => 5,
            'filter'     => ['Disetujui oleh' => 'Direktur'],
            'url'        => 'https://erp.test/reports/stock-balance',
        ]);

        $response->assertSessionHasErrors(['filter']);
        $this->assertDatabaseCount('tickets', 0);
    }

    public function test_label_filter_bawaan_yang_mengandung_spasi_tetap_diterima(): void {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->post(route('reports.issues.store'), [
            'report'     => 'Stok Persediaan',
            'kpi_rows'   => 7,
            'table_rows' => 5,
            'filter'     => ['Tanggal dari' => '2026-01-01', 'Gudang' => 'Gudang A'],
            'url'        => 'https://erp.test/reports/stock-balance',
        ]);

        $response->assertSessionHasNoErrors();
        $this->assertDatabaseCount('tickets', 1);
    }

    public function test_validasi_menolak_url_bukan_http(): void {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->post(route('reports.issues.store'), [
            'report'     => 'Stok Persediaan',
            'kpi_rows'   => 7,
            'table_rows' => 5,
            'url'        => 'javascript:alert(1)',
        ]);

        $response->assertSessionHasErrors(['url']);
        $this->assertDatabaseCount('tickets', 0);
    }

    public function test_tamu_tidak_bisa_melaporkan_masalah(): void {
        $response = $this->post(route('reports.issues.store'), [
            'report'     => 'Stok Persediaan',
            'kpi_rows'   => 1,
            'table_rows' => 0,
            'url'        => 'https://erp.test/reports/stock-balance',
        ]);

        $response->assertRedirect(route('login'));
        $this->assertDatabaseCount('tickets', 0);
    }
}
