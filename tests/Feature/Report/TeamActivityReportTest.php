<?php

namespace Tests\Feature\Report;

use App\Models\Asset\AssetService;
use App\Models\Core\FormatingSeries;
use App\Models\Report\TeamActivityRow;
use App\Models\User\User;
use App\Services\Report\TeamActivity\TeamActivityFilter;
use App\Services\Report\TeamActivity\TeamActivityKpiBuilder;
use Database\Factories\Asset\AssetServiceFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia;
use PHPUnit\Framework\Attributes\Test;
use Tests\Support\InsertsReportData;
use Tests\TestCase;

class TeamActivityReportTest extends TestCase {
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

    /**
     * Satu aktivitas servis. PIC boleh null (aktivitas tanpa PIC).
     */
    private function reportActivity(string $serviceId, string $actionDate, ?string $picId): void {
        $this->reportInsertRow('asset_service_activities', [
            'id'               => (string) Str::ulid(),
            'asset_service_id' => $serviceId,
            'action_date'      => $actionDate,
            'pic_id'           => $picId,
            'description'      => 'Pengecekan',
            'status'           => 'selesai',
            'created_at'       => now(),
            'updated_at'       => now(),
        ]);
    }

    #[Test]
    public function kpi_cocok_dengan_hitungan_manual_termasuk_aktivitas_tanpa_pic(): void {
        $serviceA = AssetServiceFactory::new()->create()->id;
        $serviceB = AssetServiceFactory::new()->create()->id;
        $pic      = User::factory()->create()->id;

        $this->reportActivity($serviceA, '2026-10-03 09:00:00', $pic);
        $this->reportActivity($serviceA, '2026-10-04 09:00:00', $pic);
        $this->reportActivity($serviceB, '2026-10-05 09:00:00', null);

        $response = $this->actingAs($this->user)->withModelAccess(AssetService::class)->get(route('reports.teamActivity'));

        $response->assertOk();
        $response->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Report/TeamActivity')
            ->where('kpi.0.value', 3)
            ->where('kpi.1.value', 1)
            ->where('kpi.2.value', 2)
            ->where('consistency', null));
    }

    #[Test]
    public function aktivitas_tanpa_pic_tetap_tampil_dengan_penanda(): void {
        $service = AssetServiceFactory::new()->create()->id;
        $this->reportActivity($service, '2026-10-05 09:00:00', null);

        app()->setLocale('id');
        $row = TeamActivityRow::query()->firstOrFail();

        $this->assertNull($row->pic_name);
        $this->assertSame('Tanpa PIC', $row->pic_label);
    }

    #[Test]
    public function filter_pic_menyaring_tabel_dan_kpi_bersamaan(): void {
        $service = AssetServiceFactory::new()->create()->id;
        $picA    = User::factory()->create()->id;
        $picB    = User::factory()->create()->id;

        $this->reportActivity($service, '2026-10-03 09:00:00', $picA);
        $this->reportActivity($service, '2026-10-04 09:00:00', $picB);
        $this->reportActivity($service, '2026-10-05 09:00:00', null);

        $response = $this->actingAs($this->user)->withModelAccess(AssetService::class)
            ->get(route('reports.teamActivity', ['pic_id' => $picA]));

        $response->assertOk();
        $response->assertInertia(fn (AssertableInertia $page) => $page
            ->where('kpi.0.value', 1)
            ->where('kpi.1.value', 1)
            ->where('consistency', null));
    }

    #[Test]
    public function kpi_builder_menghitung_pic_dan_pekerjaan_unik(): void {
        $serviceA = AssetServiceFactory::new()->create()->id;
        $serviceB = AssetServiceFactory::new()->create()->id;
        $pic      = User::factory()->create()->id;

        $this->reportActivity($serviceA, '2026-10-03 09:00:00', $pic);
        $this->reportActivity($serviceA, '2026-10-04 09:00:00', $pic);
        $this->reportActivity($serviceB, '2026-10-05 09:00:00', $pic);

        $kpi = app(TeamActivityKpiBuilder::class)->build(TeamActivityFilter::fromValues([]));

        $this->assertSame(3, $kpi->rowCount);
        $this->assertSame(1, $kpi->values['total_pic']);
        $this->assertSame(2, $kpi->values['total_work']);
    }

    #[Test]
    public function populasi_kosong_menampilkan_kpi_nol_tanpa_error(): void {
        $response = $this->actingAs($this->user)->withModelAccess(AssetService::class)->get(route('reports.teamActivity'));

        $response->assertOk();
        $response->assertInertia(fn (AssertableInertia $page) => $page
            ->where('kpi.0.value', 0)
            ->where('kpi.2.value', 0));
    }

    #[Test]
    public function pengguna_tanpa_izin_asset_service_ditolak(): void {
        $this->reportActivity(AssetServiceFactory::new()->create()->id, '2026-10-05 09:00:00', null);

        $this->actingAs($this->user)->get(route('reports.teamActivity'))->assertForbidden();
    }
}
