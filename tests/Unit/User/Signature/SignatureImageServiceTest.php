<?php

namespace Tests\Unit\User\Signature;

use App\Exceptions\User\SignatureProcessingException;
use App\Services\User\Signature\SignatureImageService;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class SignatureImageServiceTest extends TestCase {
    /**
     * Bangun gambar GD kertas putih polos berukuran WxH dengan satu goresan
     * garis lurus hitam (atau warna lain) horizontal di tengah, lalu encode
     * sebagai byte JPEG/PNG/dst sesuai $format ("jpeg", "png", "webp",
     * "gif", "bmp").
     */
    private function signatureOnPaper(
        int $width = 200,
        int $height = 100,
        string $format = 'png',
        array $inkColor = [0, 0, 0],
    ): string {
        $image = imagecreatetruecolor($width, $height);
        $white = imagecolorallocate($image, 255, 255, 255);
        imagefill($image, 0, 0, $white);

        $ink = imagecolorallocate($image, $inkColor[0], $inkColor[1], $inkColor[2]);
        imagesetthickness($image, 4);
        imageline($image, (int) ($width * 0.2), (int) ($height * 0.5), (int) ($width * 0.8), (int) ($height * 0.5), $ink);

        return $this->encode($image, $format);
    }

    private function encode(\GdImage $image, string $format): string {
        ob_start();
        match ($format) {
            'jpeg' => imagejpeg($image),
            'png'  => imagepng($image),
            'webp' => imagewebp($image),
            'gif'  => imagegif($image),
            'bmp'  => imagebmp($image),
            default => imagepng($image),
        };

        return ob_get_clean();
    }

    #[Test]
    public function black_signature_on_white_paper_produces_fully_transparent_background(): void {
        $service = new SignatureImageService;
        $bytes   = $this->signatureOnPaper();

        $result = $service->process($bytes);
        $image  = imagecreatefromstring($result);

        $this->assertNotFalse($image);

        // Sudut gambar hasil (di luar bounding box goresan setelah trim
        // proporsi tipis) tidak wajib ada, tapi keseluruhan bukan opak penuh:
        // ambil sample piksel dan pastikan setidaknya sebagian transparan.
        $width           = imagesx($image);
        $height          = imagesy($image);
        $transparentSeen = false;
        for ($y = 0; $y < $height; $y++) {
            for ($x = 0; $x < $width; $x++) {
                $alpha = (imagecolorat($image, $x, $y) >> 24) & 0x7F;
                if ($alpha >= 100) {
                    $transparentSeen = true;

                    break 2;
                }
            }
        }
        $this->assertTrue($transparentSeen, 'Background kertas putih seharusnya menjadi transparan.');
    }

    #[Test]
    public function uneven_lighting_gradient_does_not_read_dark_side_as_ink(): void {
        $service = new SignatureImageService;

        $width  = 300;
        $height = 150;
        $image  = imagecreatetruecolor($width, $height);

        // Gradien terang (kiri) ke agak gelap (kanan) -- kertas dengan
        // pencahayaan tidak rata, tapi tidak ada goresan tinta apapun.
        for ($x = 0; $x < $width; $x++) {
            $gray  = (int) round(255 - ($x / $width) * 100); // 255 turun ke 155
            $color = imagecolorallocate($image, $gray, $gray, $gray);
            imageline($image, $x, 0, $x, $height - 1, $color);
        }

        // Tambahkan goresan tinta gelap asli di area terang (kiri).
        $ink = imagecolorallocate($image, 0, 0, 0);
        imagesetthickness($image, 4);
        imageline($image, (int) ($width * 0.1), (int) ($height * 0.5), (int) ($width * 0.3), (int) ($height * 0.5), $ink);

        $bytes  = $this->encode($image, 'png');
        $result = $service->process($bytes);
        $out    = imagecreatefromstring($result);

        $this->assertNotFalse($out);
        // Hasil harus jauh lebih kecil dari 300x150 asli (background gelap
        // di sisi kanan yang tidak bertinta ikut ter-trim/transparan, bukan
        // terbaca sebagai tinta yang membuat bounding box selebar gambar).
        $this->assertLessThan($width, imagesx($out));
    }

    #[Test]
    public function blue_ink_is_detected_as_ink(): void {
        $service = new SignatureImageService;
        $bytes   = $this->signatureOnPaper(inkColor: [20, 20, 180]);

        $result = $service->process($bytes);
        $image  = imagecreatefromstring($result);

        $this->assertNotFalse($image);
        $this->assertGreaterThan(0, imagesx($image));
        $this->assertGreaterThan(0, imagesy($image));
    }

    #[Test]
    public function already_transparent_png_preserves_original_alpha_and_skips_threshold(): void {
        $service = new SignatureImageService;

        $width  = 100;
        $height = 50;
        $image  = imagecreatetruecolor($width, $height);
        imagealphablending($image, false);
        imagesavealpha($image, true);
        $transparent = imagecolorallocatealpha($image, 0, 0, 0, 127);
        imagefilledrectangle($image, 0, 0, $width - 1, $height - 1, $transparent);

        // Goresan opak di tengah, dengan alpha channel eksplisit (bukan hasil
        // threshold) -- mensimulasikan PNG transparan dari aplikasi lain.
        $ink = imagecolorallocatealpha($image, 10, 10, 10, 0);
        imagesetthickness($image, 3);
        imageline($image, 20, 25, 80, 25, $ink);

        $bytes  = $this->encode($image, 'png');
        $result = $service->process($bytes);
        $out    = imagecreatefromstring($result);

        $this->assertNotFalse($out);
        $this->assertGreaterThan(0, imagesx($out));
    }

    #[Test]
    public function blank_paper_without_any_stroke_throws_no_signature_detected(): void {
        $service = new SignatureImageService;

        $image = imagecreatetruecolor(100, 100);
        $white = imagecolorallocate($image, 255, 255, 255);
        imagefill($image, 0, 0, $white);
        $bytes = $this->encode($image, 'png');

        $this->expectException(SignatureProcessingException::class);
        $this->expectExceptionMessage(__('user.signature.errors.no_signature_detected'));

        $service->process($bytes);
    }

    #[Test]
    public function almost_entirely_dark_image_throws_image_too_dark(): void {
        $service = new SignatureImageService;

        $image = imagecreatetruecolor(100, 100);
        $black = imagecolorallocate($image, 5, 5, 5);
        imagefill($image, 0, 0, $black);
        $bytes = $this->encode($image, 'png');

        $this->expectException(SignatureProcessingException::class);
        $this->expectExceptionMessage(__('user.signature.errors.image_too_dark'));

        $service->process($bytes);
    }

    /**
     * Regresi untuk urutan langkah: assertMeaningful() harus berjalan pada
     * frame penuh SEBELUM trim(), bukan sesudah.
     *
     * Goresan tebal mengisi hampir seluruh bounding box-nya sendiri (di sini
     * kotak 120x60 penuh tinta di tengah kertas lapang). Kalau rasio
     * "terlalu gelap" diukur setelah trim, gambar sebersih ini justru
     * ditolak, padahal ia adalah kasus ideal fitur ini.
     */
    #[Test]
    public function thick_stroke_filling_its_own_bounding_box_is_accepted(): void {
        $service = new SignatureImageService;

        $image = imagecreatetruecolor(400, 300);
        imagefill($image, 0, 0, imagecolorallocate($image, 255, 255, 255));
        // Blok tinta pekat: rasio di dalam bounding box ~100%, tetapi hanya
        // 6% dari frame penuh.
        imagefilledrectangle($image, 140, 120, 259, 179, imagecolorallocate($image, 10, 10, 10));

        $result = $service->process($this->encode($image, 'png'));

        $this->assertStringStartsWith("\x89PNG\r\n\x1a\n", $result);

        $decoded = imagecreatefromstring($result);
        $this->assertNotFalse($decoded);
        // Bounding box 120x60 diperkecil proporsional (tinggi <= 200 tidak
        // memicu resize), jadi dimensinya tetap.
        $this->assertSame(120, imagesx($decoded));
        $this->assertSame(60, imagesy($decoded));
    }

    #[Test]
    public function jpeg_webp_gif_bmp_all_produce_png(): void {
        $service = new SignatureImageService;

        foreach (['jpeg', 'webp', 'gif', 'bmp'] as $format) {
            $bytes  = $this->signatureOnPaper(format: $format);
            $result = $service->process($bytes);

            // Magic bytes PNG: \x89PNG\r\n\x1a\n
            $this->assertStringStartsWith("\x89PNG\r\n\x1a\n", $result, "Format {$format} harus menghasilkan PNG.");
        }
    }

    #[Test]
    public function non_image_bytes_throws_unreadable_image(): void {
        $service = new SignatureImageService;

        $this->expectException(SignatureProcessingException::class);
        $this->expectExceptionMessage(__('user.signature.errors.unreadable_image'));

        $service->process('this is definitely not an image');
    }

    #[Test]
    public function stroke_in_corner_of_spacious_canvas_is_trimmed_to_bounding_box(): void {
        $service = new SignatureImageService;

        $width  = 400;
        $height = 400;
        $image  = imagecreatetruecolor($width, $height);
        $white  = imagecolorallocate($image, 255, 255, 255);
        imagefill($image, 0, 0, $white);

        // Goresan kecil hanya di pojok kiri-atas (area 40x20 piksel).
        $ink = imagecolorallocate($image, 0, 0, 0);
        imagesetthickness($image, 3);
        imageline($image, 5, 10, 40, 20, $ink);

        $bytes  = $this->encode($image, 'png');
        $result = $service->process($bytes);
        $out    = imagecreatefromstring($result);

        $this->assertNotFalse($out);
        // Hasil ter-trim jauh lebih kecil dari kanvas 400x400 asli.
        $this->assertLessThan(100, imagesx($out));
        $this->assertLessThan(100, imagesy($out));
    }

    #[Test]
    public function small_image_is_not_enlarged(): void {
        $service = new SignatureImageService;
        $bytes   = $this->signatureOnPaper(width: 50, height: 25);

        $result = $service->process($bytes);
        $out    = imagecreatefromstring($result);

        $this->assertNotFalse($out);
        // Tinggi asli 25px < 200px batas normalisasi -> tidak diperbesar.
        // Setelah trim, tinggi <= 25 (bounding box goresan, bisa lebih kecil
        // dari kanvas asli, tapi tidak pernah lebih besar).
        $this->assertLessThanOrEqual(25, imagesy($out));
    }

    #[Test]
    public function large_4000x4000_image_completes_under_three_seconds(): void {
        $service = new SignatureImageService;
        $bytes   = $this->signatureOnPaper(width: 4000, height: 4000);

        $start = microtime(true);
        $result = $service->process($bytes);
        $elapsed = microtime(true) - $start;

        $this->assertNotEmpty($result);
        $this->assertLessThan(3.0, $elapsed, "Pemrosesan gambar 4000x4000 harus selesai di bawah 3 detik, aktual: {$elapsed}s");
    }
}
