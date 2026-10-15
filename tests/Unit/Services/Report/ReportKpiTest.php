<?php

namespace Tests\Unit\Services\Report;

use App\Services\Report\ReportKpi;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class ReportKpiTest extends TestCase {
    #[Test]
    public function test_menyimpan_dan_mengembalikan_nilai_kpi_dan_jumlah_baris(): void {
        $kpi = new ReportKpi(values: ['total_item' => 3, 'nilai_persediaan' => 1500.5], rowCount: 4);

        $this->assertSame(3, $kpi->values['total_item']);
        $this->assertSame(1500.5, $kpi->values['nilai_persediaan']);
        $this->assertSame(4, $kpi->rowCount);
    }

    #[Test]
    public function test_kpi_kosong_tetap_valid(): void {
        $kpi = new ReportKpi(values: [], rowCount: 0);

        $this->assertSame([], $kpi->values);
        $this->assertSame(0, $kpi->rowCount);
    }
}
