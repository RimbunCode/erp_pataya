<?php

namespace Tests\Feature\Report;

use App\Models\Report\StockMutationRow;
use App\Services\Report\ReportTimeSeries;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use PHPUnit\Framework\Attributes\Test;
use Tests\Support\InsertsReportData;
use Tests\TestCase;

class ReportTimeSeriesTest extends TestCase {
    use InsertsReportData;
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();

        foreach (Schema::getTables() as $tableInfo) {
            $table = $tableInfo['name'];
            if (! Schema::hasColumn($table, 'is_example')) {
                Schema::table($table, fn ($t) => $t->boolean('is_example')->default(false));
            }
        }
    }

    #[Test]
    public function nilai_diagregasi_per_tanggal_sesuai_baris_yang_difilter(): void {
        $warehouse = $this->reportWarehouse();
        $this->reportLedgerEntry(['warehouse_id' => $warehouse, 'transaction_date' => '2026-10-01 08:00:00', 'quantity_change' => 2]);
        $this->reportLedgerEntry(['warehouse_id' => $warehouse, 'transaction_date' => '2026-10-01 17:00:00', 'quantity_change' => 3]);
        $this->reportLedgerEntry(['warehouse_id' => $warehouse, 'transaction_date' => '2026-10-02 09:00:00', 'quantity_change' => 5]);

        $series = app(ReportTimeSeries::class)->build(
            StockMutationRow::query(),
            'transaction_date',
            'quantity_change',
        );

        $this->assertSame([
            ['date' => '2026-10-01', 'value' => 5.0],
            ['date' => '2026-10-02', 'value' => 5.0],
        ], $series);
    }

    #[Test]
    public function rentang_tanpa_data_menghasilkan_deret_kosong_tanpa_error(): void {
        $series = app(ReportTimeSeries::class)->build(
            StockMutationRow::query()->where('transaction_date', '>=', '2030-01-01'),
            'transaction_date',
            'quantity_change',
        );

        $this->assertSame([], $series);
    }
}
