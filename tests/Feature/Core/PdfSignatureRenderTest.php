<?php

namespace Tests\Feature\Core;

use App\Services\Core\PrintTemplate\PdfExportService;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Mengunci perilaku `PdfExportService` yang dibutuhkan slot tanda tangan.
 *
 * Tanda tangan disisipkan sebagai data URI base64, bukan URL, karena
 * renderer PDF berjalan tanpa sesi login (FR7). Sanitizer sumber daya di
 * service itu saat ini sudah meloloskan skema `data:`, jadi tidak ada kode
 * yang perlu diubah. Yang perlu ada adalah test ini: tanpa pengunci,
 * pengetatan sanitizer di kemudian hari akan mematikan tanda tangan di PDF
 * secara diam-diam, dan gejalanya (gambar hilang) jauh dari penyebabnya.
 */
class PdfSignatureRenderTest extends TestCase {
    private function sanitize(string $html): string {
        $service = app(PdfExportService::class);
        $method  = new \ReflectionMethod($service, 'sanitizeRemoteUrls');

        return $method->invoke($service, $html);
    }

    private function isAllowed(string $url): bool {
        $service = app(PdfExportService::class);
        $method  = new \ReflectionMethod($service, 'isAllowedResourceUrl');

        return $method->invoke($service, $url, parse_url((string) config('app.url'), PHP_URL_HOST));
    }

    #[Test]
    public function data_uri_is_allowed_as_resource(): void {
        $this->assertTrue($this->isAllowed('data:image/png;base64,iVBORw0KGgo='));
    }

    #[Test]
    public function remote_url_is_still_rejected(): void {
        $this->assertFalse($this->isAllowed('https://example.invalid/signature.png'));
    }

    #[Test]
    public function signature_img_survives_sanitizer(): void {
        $html = '<div class="approval-signature">'
            . '<img src="data:image/png;base64,iVBORw0KGgo=" alt="ttd" style="max-height:80px;display:block;" />'
            . '</div>';

        $sanitized = $this->sanitize($html);

        $this->assertStringContainsString('data:image/png;base64,iVBORw0KGgo=', $sanitized);
        $this->assertStringContainsString('approval-signature', $sanitized);
    }

    #[Test]
    public function remote_img_is_stripped_while_signature_kept(): void {
        $html = '<div>'
            . '<img src="data:image/png;base64,iVBORw0KGgo=" alt="ttd" />'
            . '<img src="https://example.invalid/tracker.gif" alt="remote" />'
            . '</div>';

        $sanitized = $this->sanitize($html);

        $this->assertStringContainsString('data:image/png;base64,iVBORw0KGgo=', $sanitized);
        $this->assertStringNotContainsString('example.invalid', $sanitized);
    }

    /**
     * Keluaran `SignatureImageService` selalu PNG truecolor beralpha
     * (imagecreatetruecolor + imagesavealpha), bukan palette dengan indeks
     * transparan. Itu syarat dompdf menangani transparansi dengan benar
     * pada jalur fallback, jadi sifat itu dikunci di sini.
     */
    #[Test]
    public function processed_signature_png_is_truecolor_with_alpha(): void {
        // Silang, bukan garis lurus: bounding box garis lurus tebal padat
        // tinta seluruhnya, sehingga tidak menyisakan piksel transparan
        // untuk dibuktikan di sini.
        $source = imagecreatetruecolor(200, 200);
        imagefill($source, 0, 0, imagecolorallocate($source, 255, 255, 255));
        imagesetthickness($source, 6);
        $ink = imagecolorallocate($source, 0, 0, 0);
        imageline($source, 40, 40, 160, 160, $ink);
        imageline($source, 160, 40, 40, 160, $ink);

        ob_start();
        imagepng($source);
        $bytes = (string) ob_get_clean();

        $processed = app(\App\Services\User\Signature\SignatureImageService::class)->process($bytes);
        $decoded   = imagecreatefromstring($processed);

        $this->assertNotFalse($decoded);
        $this->assertTrue(imageistruecolor($decoded), 'PNG hasil harus truecolor, bukan palette.');

        // Ada piksel beralpha bermakna (bukan sekadar 0 atau 127 penuh
        // karena kanal alpha-nya dibuang).
        $hasAlpha = false;
        for ($y = 0, $h = imagesy($decoded); $y < $h && ! $hasAlpha; $y++) {
            for ($x = 0, $w = imagesx($decoded); $x < $w; $x++) {
                if (((imagecolorat($decoded, $x, $y) >> 24) & 0x7F) > 0) {
                    $hasAlpha = true;

                    break;
                }
            }
        }

        $this->assertTrue($hasAlpha, 'PNG hasil harus mempertahankan kanal alpha.');
    }
}
