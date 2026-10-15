<?php

namespace Tests\Unit\Services\Report;

use App\Services\Report\ReportConsistencyChecker;
use App\Services\Report\ReportKpi;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class ReportConsistencyCheckerTest extends TestCase {
    private ReportConsistencyChecker $checker;

    protected function setUp(): void {
        parent::setUp();

        $this->checker = new ReportConsistencyChecker;
    }

    #[Test]
    public function test_jumlah_sama_menghasilkan_null(): void {
        Log::spy();

        $result = $this->checker->check('Stok Persediaan', new ReportKpi([], 5), 5, [], Request::create('/reports/stock-balance'));

        $this->assertNull($result);
        Log::shouldNotHaveReceived('warning');
    }

    #[Test]
    public function test_selisih_nyata_terdeteksi_dan_dicatat_ke_log(): void {
        Log::spy();

        $filter = ['Gudang' => 'Gudang A'];
        $result = $this->checker->check('Stok Persediaan', new ReportKpi([], 7), 5, $filter, Request::create('/reports/stock-balance'));

        $this->assertSame([
            'reportName' => 'Stok Persediaan',
            'kpiRows'    => 7,
            'tableRows'  => 5,
            'filter'     => $filter,
        ], $result);

        Log::shouldHaveReceived('warning')->once();
    }

    #[Test]
    public function test_dilewati_saat_filter_lanjutan_datatable_aktif(): void {
        Log::spy();

        foreach (['fid' => '01HX', 'filter' => '{"op":"and"}', 'search' => 'abc'] as $key => $value) {
            $request = Request::create('/reports/stock-balance', 'GET', [$key => $value]);

            $this->assertNull(
                $this->checker->check('Stok Persediaan', new ReportKpi([], 9), 2, [], $request),
                "Pemeriksaan seharusnya dilewati saat `{$key}` aktif.",
            );
        }

        Log::shouldNotHaveReceived('warning');
    }

    #[Test]
    public function test_dilewati_di_production(): void {
        Log::spy();
        $this->app['env'] = 'production';

        $result = $this->checker->check('Stok Persediaan', new ReportKpi([], 9), 2, [], Request::create('/reports/stock-balance'));

        $this->assertNull($result);
        Log::shouldNotHaveReceived('warning');
    }
}
