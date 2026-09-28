<?php

namespace App\Services\User\Signature;

use App\Exceptions\User\SignatureProcessingException;

/**
 * Ubah byte gambar tanda tangan apa pun (JPEG/PNG/WebP/GIF/BMP, hasil upload
 * atau kertas discan) menjadi PNG transparan berisi goresan tanda tangan
 * saja. Lihat design.md bagian 3 untuk rincian tiap langkah.
 *
 * Menerima dan mengembalikan byte string (bukan UploadedFile/path) supaya
 * dapat diuji dengan fixture gambar di memori, tanpa Storage::fake(), tanpa
 * HTTP request, tanpa database (NFR4).
 */
class SignatureImageService {
    /**
     * Dimensi kerja maksimum. Gambar yang lebih besar di-downscale
     * proporsional sebelum diproses (FR2).
     *
     * FR2 menerima masukan sampai 4000x4000, tetapi memprosesnya pada
     * ukuran itu tidak mungkin memenuhi NFR2: tiap lintasan piksel penuh
     * atas citra 4000x4000 memakan sekitar 25 detik di PHP (terukur), dan
     * pipeline ini butuh empat lintasan. Optimasi mikro tidak menutup
     * selisih 60x terhadap anggaran 3 detik; biayanya melekat pada
     * pemanggilan imagecolorat() 16 juta kali.
     *
     * Menurunkan dimensi kerja tidak menurunkan kualitas hasil, karena
     * keluaran akhir dibatasi MAX_OUTPUT_HEIGHT (200 px): memproses pada
     * 4000 px lalu mengecilkan ke 200 px membuang 400x pekerjaan untuk
     * detail yang dibuang di langkah terakhir. Pada 400 px, goresan tanda
     * tangan masih dua kali tinggi keluaran akhir, sehingga ambang adaptif
     * bekerja sama baiknya.
     *
     * Nilai ini dipilih dari pengukuran, bukan dikira-kira. Waktu proses
     * sebuah masukan 4000x4000 pada mesin pengembangan: 800 px sekitar 8
     * detik, 600 px sekitar 3 detik, 400 px sekitar 1,2 detik. Hanya yang
     * terakhir memberi margin nyaman terhadap anggaran 3 detik NFR2 pada
     * mesin yang lebih lambat.
     */
    private const MAX_INPUT_DIMENSION = 400;

    /**
     * Tinggi keluaran maksimum setelah trim (FR5). Tidak pernah memperbesar.
     */
    private const MAX_OUTPUT_HEIGHT = 200;

    /**
     * Ambang alpha (0-127, skala GD) yang dianggap "opak" saat trim dan
     * perhitungan rasio piksel tinta.
     */
    private const OPAQUE_ALPHA_THRESHOLD = 127;

    /**
     * Rasio piksel opak di atas ini dianggap gambar terlalu gelap (FR5).
     */
    private const TOO_DARK_RATIO = 0.9;

    /**
     * Kecerahan di bawah nilai ini selalu dianggap tinta, berapa pun ambang
     * adaptif lokalnya.
     *
     * Ambang adaptif (mean - k*stddev) tidak terdefinisi dengan baik pada
     * bidang seragam: stddev nol membuat ambang persis sama dengan nilai
     * piksel, sehingga `lum < threshold` selalu salah dan SELURUH bidang
     * jadi transparan. Untuk kertas putih polos itu benar; untuk foto yang
     * seluruhnya gelap itu keliru, dan pemeriksaan imageTooDark() di
     * langkah berikutnya tidak pernah kebagian piksel untuk dihitung.
     *
     * Batas absolut ini yang membedakan keduanya. Nilainya jauh di bawah
     * kertas ternaungi paling gelap sekalipun, jadi tidak mengganggu
     * perilaku adaptif pada foto dengan pencahayaan tidak rata.
     */
    private const ABSOLUTE_INK_LUMINANCE = 60;

    /**
     * @throws SignatureProcessingException Bila gambar tidak dapat dibaca,
     *                                      kosong, atau terlalu gelap.
     */
    public function process(string $imageBytes): string {
        $image = $this->decode($imageBytes);
        $image = $this->downscaleIfOversized($image);

        if (! $this->hasAlphaChannel($image)) {
            $image = $this->removeBackground($image);
        }

        // assertMeaningful() SEBELUM trim(), bukan sesudah -- lihat catatan
        // panjang di method itu. Urutan ini mudah terbalik dan akibatnya
        // adalah menolak justru tanda tangan yang paling bersih.
        $this->assertMeaningful($image);
        $image = $this->trim($image);
        $image = $this->normalizeHeight($image);

        return $this->encodePng($image);
    }

    /**
     * Langkah 1 — decode. `imagecreatefromstring()` mendeteksi format dari
     * magic bytes (bukan ekstensi nama berkas maupun Content-Type klien),
     * inilah validasi berbasis-isi yang diminta FR2.
     */
    private function decode(string $imageBytes): \GdImage {
        // @ karena imagecreatefromstring() memancarkan E_WARNING untuk byte
        // yang bukan gambar valid -- kegagalannya sudah ditangkap lewat nilai
        // balik false di bawah, warning PHP-nya sendiri tidak dibutuhkan.
        $image = @imagecreatefromstring($imageBytes);

        if ($image === false) {
            throw SignatureProcessingException::unreadableImage();
        }

        // GIF dan PNG-8 di-decode sebagai citra PALETTE, dan pada citra
        // palette imagecolorat() mengembalikan INDEKS palette, bukan nilai
        // RGB. Kertas putih bisa berindeks 1, yang kalau diperlakukan
        // sebagai RGB terbaca hampir hitam -- seluruh gambar lalu dianggap
        // tinta dan ditolak imageTooDark(). Konversi di sini membuat
        // seluruh langkah berikutnya boleh mengandaikan RGB.
        if (! imageistruecolor($image)) {
            imagepalettetotruecolor($image);
        }

        return $image;
    }

    /**
     * Langkah 2 — downscale proporsional bila sisi mana pun melebihi
     * MAX_INPUT_DIMENSION (FR2). Membatasi jumlah piksel DI SINI, sebelum
     * lintasan piksel mana pun berjalan, adalah satu-satunya hal yang
     * membuat NFR2 tercapai: imagescale() berjalan di C dan biayanya
     * sepersekian detik, sedangkan tiap lintasan PHP atas citra penuh
     * memakan puluhan detik.
     */
    private function downscaleIfOversized(\GdImage $image): \GdImage {
        $width  = imagesx($image);
        $height = imagesy($image);

        if ($width <= self::MAX_INPUT_DIMENSION && $height <= self::MAX_INPUT_DIMENSION) {
            return $image;
        }

        if ($width >= $height) {
            $newWidth  = self::MAX_INPUT_DIMENSION;
            $newHeight = (int) round($height * (self::MAX_INPUT_DIMENSION / $width));
        } else {
            $newHeight = self::MAX_INPUT_DIMENSION;
            $newWidth  = (int) round($width * (self::MAX_INPUT_DIMENSION / $height));
        }

        $scaled = imagescale($image, max(1, $newWidth), max(1, $newHeight));

        if ($scaled === false) {
            return $image;
        }

        return $scaled;
    }

    /**
     * Langkah 3 — deteksi alpha channel. Gambar yang sudah punya alpha
     * bermakna (PNG transparan hasil aplikasi lain, atau hasil canvas FE)
     * melewati threshold (FR4): menerapkan threshold padanya akan membaca
     * area transparan sebagai hitam pekat dan menghasilkan blok tinta palsu.
     *
     * Sampling ber-step, bukan pemindaian penuh: satu piksel semi-transparan
     * saja sudah cukup membuktikan gambar punya alpha bermakna, dan
     * memindai seluruh piksel untuk pertanyaan ya/tidak ini memboroskan
     * waktu yang sama besarnya dengan threshold itu sendiri.
     */
    private function hasAlphaChannel(\GdImage $image): bool {
        if (! imageistruecolor($image)) {
            return imagecolortransparent($image) >= 0;
        }

        $width  = imagesx($image);
        $height = imagesy($image);
        $step   = max(1, (int) (min($width, $height) / 50));

        for ($y = 0; $y < $height; $y += $step) {
            for ($x = 0; $x < $width; $x += $step) {
                $alpha = (imagecolorat($image, $x, $y) >> 24) & 0x7F;
                if ($alpha > 0) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Langkah 4 — adaptive threshold (FR4). Piksel di bawah ambang lokalnya
     * dianggap tinta dan dipertahankan (warna aslinya, bukan dipaksa
     * hitam); piksel di atas ambang dijadikan transparan penuh. Piksel
     * tinta diberi alpha bergradasi sebanding jaraknya dari ambang, supaya
     * tepi goresan halus tanpa anti-aliasing terpisah.
     */
    private function removeBackground(\GdImage $image): \GdImage {
        $width  = imagesx($image);
        $height = imagesy($image);

        // SplFixedArray berindeks datar, bukan array PHP dua dimensi: untuk
        // 4000x4000 array bersarang berarti 16 juta zval dalam hashtable,
        // ratusan megabyte dan lambat diakses. Lihat design.md bagian 3,
        // "Batasan performa yang wajib dipatuhi".
        $luminance = new \SplFixedArray($width * $height);

        $index = 0;
        for ($y = 0; $y < $height; $y++) {
            for ($x = 0; $x < $width; $x++) {
                $rgb = imagecolorat($image, $x, $y);
                // Rec. 601 luma -- konsisten dengan cara umum menghitung
                // kecerahan yang dipersepsikan mata dari komponen RGB.
                $luminance[$index++] = (int) (
                    0.299 * (($rgb >> 16) & 0xFF)
                    + 0.587 * (($rgb >> 8) & 0xFF)
                    + 0.114 * ($rgb & 0xFF)
                );
            }
        }

        $calculator   = new SignatureThresholdCalculator;
        $thresholdMap = $calculator->buildThresholdMap($luminance, $width, $height);

        $output = imagecreatetruecolor($width, $height);
        imagealphablending($output, false);
        imagesavealpha($output, true);

        // 0x7F000000 = alpha 127 (transparan penuh) dengan RGB nol. Warna
        // ber-alpha pada citra truecolor hanyalah bilangan bulat, jadi
        // disusun langsung alih-alih lewat imagecolorallocatealpha().
        imagefilledrectangle($output, 0, 0, $width - 1, $height - 1, 0x7F000000);

        $index = 0;
        for ($y = 0; $y < $height; $y++) {
            // Ambang dihitung per BARIS, bukan per piksel: interpolasi
            // bilinear punya komponen vertikal yang sama untuk seluruh baris,
            // dan memanggil thresholdAt() 16 juta kali membuang waktu pada
            // perhitungan yang berulang identik.
            $thresholdRow = $calculator->thresholdRow($thresholdMap, $y, $width);

            for ($x = 0; $x < $width; $x++) {
                $lum       = $luminance[$index++];
                $threshold = $thresholdRow[$x];

                $isInk = $lum < self::ABSOLUTE_INK_LUMINANCE
                    || ($threshold > 0 && $lum < $threshold);

                if (! $isInk) {
                    continue;
                }

                // GD alpha: 0 = opak, 127 = transparan penuh -- kebalikan
                // dari intuisi "0..255 opak" pada format lain. Piksel jauh
                // di bawah ambang (rasio kecil) jadi hampir opak (alpha
                // GD kecil); piksel dekat ambang jadi hampir transparan.
                //
                // Piksel yang lolos lewat batas absolut memakai batas itu
                // sebagai pembagi bila ambang lokalnya tidak terpakai,
                // sehingga tetap dapat alpha bergradasi alih-alih opak
                // mendadak.
                $divisor = $threshold > $lum ? $threshold : self::ABSOLUTE_INK_LUMINANCE;
                $alpha   = (int) (127 * ($lum / $divisor));

                // imagecolorallocatealpha() SENGAJA tidak dipakai di sini:
                // pada citra truecolor ia tetap menjalankan pencarian
                // internal tiap panggilan, dan pada 16 juta piksel biaya itu
                // mendominasi seluruh pipeline (terukur: 7 menit vs detik).
                imagesetpixel(
                    $output,
                    $x,
                    $y,
                    ($alpha << 24) | (imagecolorat($image, $x, $y) & 0xFFFFFF),
                );
            }
        }

        return $output;
    }

    /**
     * Langkah 6 — trim. Buang baris/kolom terluar yang sepenuhnya
     * transparan, crop ke bounding box goresan (FR5). Tanpa ini, TTD yang
     * difoto dari jauh tampil sangat kecil di dalam slot yang lapang.
     *
     * Dijalankan SETELAH assertMeaningful(), sehingga dijamin ada piksel
     * opak dan bounding box selalu ketemu.
     */
    private function trim(\GdImage $image): \GdImage {
        $width  = imagesx($image);
        $height = imagesy($image);

        $minX = $width;
        $minY = $height;
        $maxX = -1;
        $maxY = -1;

        for ($y = 0; $y < $height; $y++) {
            $rowHasInk = false;

            for ($x = 0; $x < $width; $x++) {
                if ((imagecolorat($image, $x, $y) >> 24) >= self::OPAQUE_ALPHA_THRESHOLD) {
                    continue;
                }

                $rowHasInk = true;

                if ($x < $minX) {
                    $minX = $x;
                }
                if ($x > $maxX) {
                    $maxX = $x;
                }
            }

            // minY/maxY cukup ditetapkan sekali per baris, bukan per piksel:
            // baris yang memuat tinta pasti berada di dalam bounding box.
            if ($rowHasInk) {
                if ($y < $minY) {
                    $minY = $y;
                }
                $maxY = $y;
            }
        }

        if ($maxX < $minX || $maxY < $minY) {
            // Tidak terjangkau dalam alur normal: assertMeaningful() sudah
            // melempar noSignatureDetected() untuk gambar tanpa piksel opak.
            // Dipertahankan agar trim() tetap aman bila dipanggil terpisah.
            return $image;
        }

        $trimmedWidth  = $maxX - $minX + 1;
        $trimmedHeight = $maxY - $minY + 1;

        $trimmed = imagecreatetruecolor($trimmedWidth, $trimmedHeight);
        imagealphablending($trimmed, false);
        imagesavealpha($trimmed, true);

        // Alpha blending HARUS mati di sumber juga, bukan cuma di tujuan:
        // dengan blending aktif imagecopy() meng-KOMPOSIT piksel sumber di
        // atas tujuan, sehingga piksel transparan ikut menyatu jadi opak
        // dan seluruh hasil trim kehilangan transparansinya.
        imagealphablending($image, false);
        imagecopy($trimmed, $image, 0, 0, $minX, $minY, $trimmedWidth, $trimmedHeight);

        return $trimmed;
    }

    /**
     * Langkah 5 — validasi hasil (FR5). Rasio dihitung pada FRAME PENUH,
     * SEBELUM trim. Urutan ini penting dan mudah dibalik.
     *
     * Bounding box hasil trim menurut definisinya rapat terhadap goresan:
     * tidak ada baris atau kolom terluar yang kosong, karena itulah yang
     * baru saja dibuang. Tanda tangan bergaris tebal wajar mengisi jauh di
     * atas TOO_DARK_RATIO kotaknya sendiri, sehingga mengukur di sana
     * menolak justru gambar yang paling bersih.
     *
     * Yang hendak ditangkap pemeriksaan ini adalah foto gelap dan gambar
     * terbalik (tinta dan kertas tertukar), dan ciri keduanya adalah tinta
     * memenuhi seluruh frame asli. Rasio pada frame penuh mengukur persis itu.
     *
     * @throws SignatureProcessingException
     */
    private function assertMeaningful(\GdImage $image): void {
        $width  = imagesx($image);
        $height = imagesy($image);
        $total  = $width * $height;

        $opaqueCount = 0;
        for ($y = 0; $y < $height; $y++) {
            for ($x = 0; $x < $width; $x++) {
                if ((imagecolorat($image, $x, $y) >> 24) < self::OPAQUE_ALPHA_THRESHOLD) {
                    $opaqueCount++;
                }
            }
        }

        if ($opaqueCount === 0) {
            throw SignatureProcessingException::noSignatureDetected();
        }

        if ($opaqueCount / $total > self::TOO_DARK_RATIO) {
            throw SignatureProcessingException::imageTooDark();
        }
    }

    /**
     * Langkah 7 — perkecil ke tinggi maksimum MAX_OUTPUT_HEIGHT, tanpa
     * pernah memperbesar gambar yang sudah lebih kecil dari itu (FR5).
     */
    private function normalizeHeight(\GdImage $image): \GdImage {
        $width  = imagesx($image);
        $height = imagesy($image);

        if ($height <= self::MAX_OUTPUT_HEIGHT) {
            return $image;
        }

        $newHeight = self::MAX_OUTPUT_HEIGHT;
        $newWidth  = max(1, (int) round($width * (self::MAX_OUTPUT_HEIGHT / $height)));

        imagealphablending($image, false);
        imagesavealpha($image, true);

        $scaled = imagescale($image, $newWidth, $newHeight);

        if ($scaled === false) {
            return $image;
        }

        imagealphablending($scaled, false);
        imagesavealpha($scaled, true);

        return $scaled;
    }

    /**
     * Langkah 8 — encode PNG. `imagesavealpha($image, true)` WAJIB dipanggil
     * sebelum `imagepng()`: bila lupa, alpha channel dibuang diam-diam TANPA
     * error dan seluruh pekerjaan threshold sebelumnya jadi sia-sia.
     */
    private function encodePng(\GdImage $image): string {
        imagesavealpha($image, true);

        ob_start();
        imagepng($image);
        $bytes = ob_get_clean();

        return $bytes === false ? '' : $bytes;
    }
}
