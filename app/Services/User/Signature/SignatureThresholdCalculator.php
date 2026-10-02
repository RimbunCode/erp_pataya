<?php

namespace App\Services\User\Signature;

/**
 * Aritmetika ambang adaptif untuk `SignatureImageService::removeBackground()`,
 * dipisah dari manipulasi GD karena murni operasi pada array angka dan layak
 * diuji terpisah (lihat design.md bagian 3, langkah 4).
 */
final class SignatureThresholdCalculator {
    private const BLOCK_SIZE = 32;

    /**
     * Konstanta k pada rumus `mean - k * stddev`. 0.6 dipilih sebagai titik
     * tengah yang lazim dipakai metode Sauvola/Niblack untuk dokumen: cukup
     * agresif memisahkan tinta dari kertas, tanpa memaksa blok kosong
     * (stddev kecil, seluruhnya kertas) ikut membelah noise-nya sendiri
     * menjadi "tinta" palsu.
     */
    private const K = 0.6;

    /**
     * Geometri horizontal hasil `horizontalGeometry()`, dikunci per
     * (jumlah blok, lebar).
     *
     * @var array<string, array<int, array{int, int, float}>>
     */
    private array $geometryCache = [];

    /**
     * Hitung peta ambang per blok dari peta kecerahan.
     *
     * Blok yang jatuh di tepi gambar (lebar/tinggi tidak habis dibagi
     * BLOCK_SIZE) tetap dihitung dari piksel yang tersisa di dalamnya --
     * tidak di-skip dan tidak diberi ukuran blok penuh secara artifisial.
     *
     * $luminance berindeks DATAR (`$y * $width + $x`), bukan dua dimensi:
     * untuk citra 4000x4000 array dua dimensi berarti 16 juta zval dalam
     * hashtable bersarang, ratusan megabyte dan lambat diakses. SplFixedArray
     * datar menyimpan nilainya berdampingan dan diakses lewat indeks integer
     * (lihat design.md bagian 3, "Batasan performa yang wajib dipatuhi").
     *
     * @param  \SplFixedArray<int>  $luminance  indeks `$y * $width + $x` => 0..255
     * @return array<int, array<int, float>> [blockY][blockX] => ambang
     */
    public function buildThresholdMap(\SplFixedArray $luminance, int $width, int $height): array {
        $blockCountX = (int) ceil($width / self::BLOCK_SIZE);
        $blockCountY = (int) ceil($height / self::BLOCK_SIZE);

        $map = [];

        for ($blockY = 0; $blockY < $blockCountY; $blockY++) {
            $map[$blockY] = [];

            for ($blockX = 0; $blockX < $blockCountX; $blockX++) {
                $startX = $blockX * self::BLOCK_SIZE;
                $startY = $blockY * self::BLOCK_SIZE;
                $endX   = min($startX + self::BLOCK_SIZE, $width);
                $endY   = min($startY + self::BLOCK_SIZE, $height);

                $map[$blockY][$blockX] = $this->blockThreshold($luminance, $width, $startX, $startY, $endX, $endY);
            }
        }

        return $map;
    }

    /**
     * Ambang untuk satu piksel, hasil interpolasi bilinear antar ambang
     * blok tetangga. Titik acuan tiap blok adalah pusatnya (bukan sudut
     * kiri-atas), sehingga interpolasi mulus melewati seluruh gambar
     * alih-alih terlihat sebagai kotak-kotak pada batas blok.
     *
     * @param  array<int, array<int, float>>  $map
     */
    public function thresholdAt(array $map, int $x, int $y): float {
        $blockCountY = \count($map);
        if ($blockCountY === 0) {
            return 0.0;
        }
        $blockCountX = \count($map[0]);
        if ($blockCountX === 0) {
            return 0.0;
        }

        // Posisi pixel dalam satuan "indeks blok", relatif ke pusat blok (0,0).
        $fx = ($x + 0.5) / self::BLOCK_SIZE - 0.5;
        $fy = ($y + 0.5) / self::BLOCK_SIZE - 0.5;

        $x0 = (int) floor($fx);
        $y0 = (int) floor($fy);
        $x1 = $x0 + 1;
        $y1 = $y0 + 1;

        $tx = $fx - $x0;
        $ty = $fy - $y0;

        $v00 = $this->thresholdOfBlock($map, $x0, $y0, $blockCountX, $blockCountY);
        $v10 = $this->thresholdOfBlock($map, $x1, $y0, $blockCountX, $blockCountY);
        $v01 = $this->thresholdOfBlock($map, $x0, $y1, $blockCountX, $blockCountY);
        $v11 = $this->thresholdOfBlock($map, $x1, $y1, $blockCountX, $blockCountY);

        $top    = $v00 + ($v10 - $v00) * $tx;
        $bottom = $v01 + ($v11 - $v01) * $tx;

        return $top + ($bottom - $top) * $ty;
    }

    /**
     * Ambang untuk SATU BARIS penuh sekaligus, hasilnya identik dengan
     * memanggil `thresholdAt()` pada tiap x di baris itu.
     *
     * Inilah yang dipakai `removeBackground()` dalam loop piksel, bukan
     * `thresholdAt()` per piksel. Interpolasi bilinear melibatkan beberapa
     * perkalian dan empat pembacaan peta; pada 16 juta piksel biayanya
     * nyata. Di sini komponen vertikal (`$ty` dan pasangan baris blok)
     * dihitung SEKALI per baris, lalu hanya interpolasi horizontal yang
     * berjalan per piksel (lihat design.md bagian 3).
     *
     * @param  array<int, array<int, float>>  $map
     * @return \SplFixedArray<float> indeks x => ambang
     */
    public function thresholdRow(array $map, int $y, int $width): array {
        $blockCountY = \count($map);
        if ($blockCountY === 0 || \count($map[0]) === 0) {
            return array_fill(0, $width, 0.0);
        }

        $fy = ($y + 0.5) / self::BLOCK_SIZE - 0.5;
        $y0 = (int) floor($fy);
        $ty = $fy - $y0;

        $rowTop    = $map[max(0, min($y0, $blockCountY - 1))];
        $rowBottom = $map[max(0, min($y0 + 1, $blockCountY - 1))];

        // Geometri horizontal (blok kiri/kanan dan bobot interpolasi tiap x)
        // hanya bergantung pada x dan lebar gambar, jadi identik untuk SEMUA
        // baris. Menghitungnya sekali lalu memakainya ulang menghapus
        // floor(), pembagian, dan clamp dari jalur terpanas -- pada citra
        // 800x800 itu 640 ribu pemanggilan floor() yang tidak perlu.
        $geometry = $this->horizontalGeometry(\count($map[0]), $width);

        $row = [];
        foreach ($geometry as $x => [$left, $right, $tx]) {
            $topLeft    = $rowTop[$left];
            $bottomLeft = $rowBottom[$left];
            $top        = $topLeft + ($rowTop[$right] - $topLeft) * $tx;
            $bottom     = $bottomLeft + ($rowBottom[$right] - $bottomLeft) * $tx;
            $row[$x]    = $top + ($bottom - $top) * $ty;
        }

        return $row;
    }

    /**
     * Cache geometri horizontal per (jumlah blok, lebar). Dibuat sekali per
     * gambar, dipakai ulang oleh tiap baris.
     *
     * @return array<int, array{int, int, float}> x => [blokKiri, blokKanan, bobot]
     */
    private function horizontalGeometry(int $blockCountX, int $width): array {
        $cacheKey = $blockCountX . ':' . $width;

        if (isset($this->geometryCache[$cacheKey])) {
            return $this->geometryCache[$cacheKey];
        }

        $lastBlockX = $blockCountX - 1;
        $geometry   = [];

        for ($x = 0; $x < $width; $x++) {
            $fx = ($x + 0.5) / self::BLOCK_SIZE - 0.5;
            $x0 = (int) floor($fx);

            $geometry[$x] = [
                $x0 < 0 ? 0 : ($x0 > $lastBlockX ? $lastBlockX : $x0),
                ($x0 + 1) < 0 ? 0 : (($x0 + 1) > $lastBlockX ? $lastBlockX : $x0 + 1),
                $fx - $x0,
            ];
        }

        // Satu entri saja: pemakaian nyata memproses satu gambar per
        // instance, jadi cache tidak perlu tumbuh.
        $this->geometryCache = [$cacheKey => $geometry];

        return $geometry;
    }

    /**
     * Nilai ambang blok pada koordinat (blockX, blockY), dengan koordinat
     * di luar batas peta di-clamp ke blok tepi terdekat -- ini yang membuat
     * interpolasi tetap terdefinisi pada baris/kolom blok pertama dan
     * terakhir, tempat blok "tetangga" di satu sisi tidak ada.
     *
     * @param  array<int, array<int, float>>  $map
     */
    private function thresholdOfBlock(array $map, int $blockX, int $blockY, int $blockCountX, int $blockCountY): float {
        $blockX = max(0, min($blockX, $blockCountX - 1));
        $blockY = max(0, min($blockY, $blockCountY - 1));

        return $map[$blockY][$blockX];
    }

    /**
     * Ambang satu blok: mean - k * stddev dari kecerahan piksel di dalamnya.
     *
     * Mean dan stddev dihitung dalam SATU lintasan lewat jumlah kuadrat
     * (`E[x^2] - E[x]^2`), bukan dua lintasan terpisah. Dipanggil sekali per
     * blok dan tiap blok berisi sampai 1024 piksel, jadi menghemat separuh
     * pembacaan di sini berarti menghemat separuh pembacaan seluruh gambar.
     *
     * @param  \SplFixedArray<int>  $luminance
     */
    private function blockThreshold(\SplFixedArray $luminance, int $width, int $startX, int $startY, int $endX, int $endY): float {
        $sum        = 0.0;
        $sumSquares = 0.0;
        $count      = 0;

        for ($y = $startY; $y < $endY; $y++) {
            $rowOffset = $y * $width;
            for ($x = $startX; $x < $endX; $x++) {
                $value = $luminance[$rowOffset + $x];
                $sum += $value;
                $sumSquares += $value * $value;
                $count++;
            }
        }

        if ($count === 0) {
            return 0.0;
        }

        $mean = $sum / $count;

        // Varians bisa jadi negatif tipis karena galat pembulatan float saat
        // seluruh piksel blok bernilai sama (stddev sebenarnya nol); max(0)
        // mencegah sqrt() menghasilkan NAN yang lalu merambat ke ambang.
        $variance = max(0.0, $sumSquares / $count - $mean * $mean);
        $stddev   = sqrt($variance);

        return $mean - self::K * $stddev;
    }
}
