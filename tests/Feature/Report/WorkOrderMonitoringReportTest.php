<?php

namespace Tests\Feature\Report;

use App\Models\Asset\AssetService;
use App\Models\Core\FormatingSeries;
use App\Models\User\User;
use Database\Factories\Asset\AssetServiceFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Inertia\Testing\AssertableInertia;
use PHPUnit\Framework\Attributes\Test;
use Tests\Support\InsertsReportData;
use Tests\TestCase;

class WorkOrderMonitoringReportTest extends TestCase {
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

        foreach ([User::class, FormatingSeries::class, AssetService::class] as $model) {
            $model::initPermissions();
        }

        $this->withoutVite();

        $this->user = User::factory()->create();
        $this->withCookie('lang', 'id');
    }

    #[Test]
    public function kpi_menghitung_selesai_dan_berjalan_sesuai_hitungan_manual(): void {
        // Selesai: 2026-10-02 sampai 2026-10-06, lama 4 hari.
        AssetServiceFactory::new()->create([
            'failure_date'    => '2026-10-01 08:00:00',
            'start_date'      => '2026-10-02 00:00:00',
            'completion_date' => '2026-10-06 00:00:00',
        ]);
        // Berjalan: belum selesai, lama dihitung sampai sekarang.
        AssetServiceFactory::new()->create([
            'failure_date'    => '2026-10-03 08:00:00',
            'start_date'      => '2026-10-03 00:00:00',
            'completion_date' => null,
        ]);

        $response = $this->actingAs($this->user)->withModelAccess(AssetService::class)->get(route('reports.workOrder'));

        $response->assertOk();
        $response->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Report/WorkOrderMonitoring')
            ->where('kpi.0.value', 2)
            ->where('kpi.1.value', 1)
            ->where('kpi.2.value', 1)
            ->where('consistency', null));
    }

    #[Test]
    public function rata_rata_lama_pengerjaan_mengabaikan_yang_belum_dimulai(): void {
        // Selesai dalam 4 hari.
        AssetServiceFactory::new()->create([
            'failure_date'    => '2026-10-01 08:00:00',
            'start_date'      => '2026-10-02 00:00:00',
            'completion_date' => '2026-10-06 00:00:00',
        ]);
        // Belum dimulai: tidak punya start_date, harus diabaikan dari rata-rata.
        AssetServiceFactory::new()->create([
            'failure_date'    => '2026-10-04 08:00:00',
            'start_date'      => null,
            'completion_date' => null,
        ]);

        $response = $this->actingAs($this->user)->withModelAccess(AssetService::class)->get(route('reports.workOrder'));

        $response->assertInertia(fn (AssertableInertia $page) => $page
            ->where('kpi.0.value', 2)
            ->where('kpi.3.key', 'avg_days')
            ->where('kpi.3.value', 4));
    }

    #[Test]
    public function rata_rata_tidak_dikirim_bila_tidak_ada_pekerjaan_yang_dimulai(): void {
        AssetServiceFactory::new()->create(['failure_date' => '2026-10-04 08:00:00', 'start_date' => null]);

        $response = $this->actingAs($this->user)->withModelAccess(AssetService::class)->get(route('reports.workOrder'));

        $response->assertInertia(fn (AssertableInertia $page) => $page
            ->where('kpi.0.value', 1)
            ->has('kpi', 3));
    }

    #[Test]
    public function filter_status_menyaring_tabel_dan_kpi(): void {
        AssetServiceFactory::new()->create([
            'failure_date'    => '2026-10-01 08:00:00',
            'start_date'      => '2026-10-02 00:00:00',
            'completion_date' => '2026-10-06 00:00:00',
        ]);
        AssetServiceFactory::new()->create([
            'failure_date'    => '2026-10-03 08:00:00',
            'start_date'      => '2026-10-03 00:00:00',
            'completion_date' => null,
        ]);

        $response = $this->actingAs($this->user)->withModelAccess(AssetService::class)
            ->get(route('reports.workOrder', ['progress_status' => 'selesai']));

        $response->assertInertia(fn (AssertableInertia $page) => $page
            ->where('kpi.0.value', 1)
            ->where('kpi.1.value', 1)
            ->where('consistency', null));
    }

    #[Test]
    public function populasi_kosong_menampilkan_kpi_jumlah_nol_tanpa_error(): void {
        $response = $this->actingAs($this->user)->withModelAccess(AssetService::class)->get(route('reports.workOrder'));

        $response->assertOk();
        $response->assertInertia(fn (AssertableInertia $page) => $page
            ->where('kpi.0.value', 0)
            ->has('kpi', 3));
    }

    #[Test]
    public function pengguna_tanpa_izin_asset_service_ditolak(): void {
        AssetServiceFactory::new()->create(['failure_date' => '2026-10-01 08:00:00']);

        $this->actingAs($this->user)->get(route('reports.workOrder'))->assertForbidden();
    }
}
