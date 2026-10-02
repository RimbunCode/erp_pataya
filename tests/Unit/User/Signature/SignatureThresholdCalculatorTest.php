<?php

namespace Tests\Unit\User\Signature;

use App\Services\User\Signature\SignatureThresholdCalculator;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class SignatureThresholdCalculatorTest extends TestCase {
    /**
     * Peta kecerahan berindeks datar (`$y * $width + $x`), bentuk yang
     * diterima buildThresholdMap().
     *
     * @param  int  $value  Kecerahan seragam untuk seluruh piksel.
     * @return \SplFixedArray<int>
     */
    private function uniformLuminance(int $width, int $height, int $value): \SplFixedArray {
        $luminance = new \SplFixedArray($width * $height);

        for ($i = 0, $total = $width * $height; $i < $total; $i++) {
            $luminance[$i] = $value;
        }

        return $luminance;
    }

    #[Test]
    public function threshold_map_on_uniform_input_has_zero_stddev_and_equals_mean(): void {
        $calculator = new SignatureThresholdCalculator;
        $luminance  = $this->uniformLuminance(64, 64, 200);

        $map = $calculator->buildThresholdMap($luminance, 64, 64);

        // 64x64 dengan blok 32px => 2x2 blok.
        $this->assertCount(2, $map);
        $this->assertCount(2, $map[0]);

        foreach ($map as $row) {
            foreach ($row as $threshold) {
                // stddev = 0 pada input seragam -> threshold = mean persis.
                $this->assertEqualsWithDelta(200.0, $threshold, 0.001);
            }
        }
    }

    #[Test]
    public function threshold_map_block_count_matches_ceil_division_for_non_multiple_dimensions(): void {
        $calculator = new SignatureThresholdCalculator;
        $luminance  = $this->uniformLuminance(50, 40, 100);

        $map = $calculator->buildThresholdMap($luminance, 50, 40);

        // ceil(50/32) = 2, ceil(40/32) = 2.
        $this->assertCount(2, $map);
        $this->assertCount(2, $map[0]);
    }

    #[Test]
    public function threshold_at_center_of_block_returns_that_blocks_threshold(): void {
        $calculator = new SignatureThresholdCalculator;
        // Peta manual: blok kiri ambang rendah, blok kanan ambang tinggi.
        $map = [
            [10.0, 200.0],
        ];

        // Pusat kontinu blok (0,0) ada di x=15.5 (rata-rata piksel 0..31);
        // piksel diskret terdekat (15 atau 16) berjarak <=0.5 blok-space dari
        // pusat itu sendiri, jadi hasilnya sangat dekat ke ambang blok itu.
        $atLeftCenter = $calculator->thresholdAt($map, 15, 16);
        $this->assertEqualsWithDelta(10.0, $atLeftCenter, 5.0);

        // Pusat kontinu blok (1,0) ada di x=47.5.
        $atRightCenter = $calculator->thresholdAt($map, 47, 16);
        $this->assertEqualsWithDelta(200.0, $atRightCenter, 5.0);
    }

    #[Test]
    public function threshold_at_interpolates_between_two_block_thresholds(): void {
        $calculator = new SignatureThresholdCalculator;
        $map        = [
            [0.0, 100.0],
        ];

        // Titik tepat di tengah antara pusat blok (0,0) dan (1,0):
        // pusat blok 0 di x=15.5, pusat blok 1 di x=47.5, titik tengah x=31.5
        // -> dibulatkan ke piksel 32 (deviasi kecil, ditoleransi delta).
        $midpoint = $calculator->thresholdAt($map, 32, 16);

        $this->assertEqualsWithDelta(50.0, $midpoint, 2.0);
        $this->assertGreaterThan(0.0, $midpoint);
        $this->assertLessThan(100.0, $midpoint);
    }

    #[Test]
    public function threshold_at_edge_clamps_to_nearest_block_when_neighbor_is_missing(): void {
        $calculator = new SignatureThresholdCalculator;
        $map        = [
            [30.0, 90.0],
            [60.0, 120.0],
        ];

        // Titik jauh di luar pusat blok kiri-atas (0,0), ke arah sudut kiri-atas
        // gambar (x=0, y=0) -- blok tetangga kiri/atas tidak ada, harus
        // di-clamp ke blok (0,0) itu sendiri, bukan error atau NaN.
        $atCorner = $calculator->thresholdAt($map, 0, 0);

        $this->assertIsFloat($atCorner);
        $this->assertEqualsWithDelta(30.0, $atCorner, 0.001);
    }

    #[Test]
    public function threshold_map_handles_single_block_image(): void {
        $calculator = new SignatureThresholdCalculator;
        $luminance  = $this->uniformLuminance(10, 10, 50);

        $map = $calculator->buildThresholdMap($luminance, 10, 10);

        $this->assertCount(1, $map);
        $this->assertCount(1, $map[0]);
        $this->assertEqualsWithDelta(50.0, $map[0][0], 0.001);

        // thresholdAt di manapun pada gambar 1-blok harus tetap sama.
        $this->assertEqualsWithDelta(50.0, $calculator->thresholdAt($map, 5, 5), 0.001);
        $this->assertEqualsWithDelta(50.0, $calculator->thresholdAt($map, 0, 9), 0.001);
    }

    /**
     * thresholdRow() adalah jalur cepat yang dipakai removeBackground();
     * thresholdAt() jalur acuan yang mudah dibaca. Keduanya HARUS memberi
     * hasil sama -- test ini yang mencegah optimasi per-baris diam-diam
     * mengubah hasil threshold.
     */
    #[Test]
    public function threshold_row_matches_threshold_at_for_every_pixel(): void {
        $calculator = new SignatureThresholdCalculator;

        // Peta tidak seragam di kedua sumbu, supaya komponen horizontal DAN
        // vertikal interpolasi sama-sama teruji.
        $map = [
            [10.0, 200.0, 80.0],
            [150.0, 30.0, 220.0],
            [90.0, 120.0, 45.0],
        ];

        $width = 96;

        foreach ([0, 1, 16, 31, 32, 47, 64, 95] as $y) {
            $row = $calculator->thresholdRow($map, $y, $width);

            for ($x = 0; $x < $width; $x++) {
                $this->assertEqualsWithDelta(
                    $calculator->thresholdAt($map, $x, $y),
                    $row[$x],
                    0.0001,
                    "thresholdRow menyimpang dari thresholdAt di (x={$x}, y={$y})",
                );
            }
        }
    }

    #[Test]
    public function threshold_row_on_empty_map_returns_zeros(): void {
        $calculator = new SignatureThresholdCalculator;

        $row = $calculator->thresholdRow([], 0, 4);

        $this->assertCount(4, $row);
        foreach ($row as $value) {
            $this->assertSame(0.0, $value);
        }
    }
}
