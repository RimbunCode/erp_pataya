<?php

namespace Tests\Feature\Core;

use App\Services\Core\PrintTemplate\PrintTemplateRenderService;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Paritas markup slot tanda tangan antara sisi server
 * (`PrintTemplateRenderService::buildSignatureHtml()`) dan sisi klien
 * (`resources/js/lib/signatureSlot.js`).
 *
 * Ekspektasi di berkas ini SENGAJA ditulis sebagai string penuh dan
 * digandakan persis di `signatureSlot.test.js`. Helper Handlebars di proyek
 * ini memang kembar di dua tempat (`relation`, `label`, `trans`, dan lainnya
 * sudah begitu sejak sebelum fitur ini), dan satu-satunya cara divergensi
 * ketahuan lebih dulu di CI daripada di PDF produksi adalah kedua sisi
 * mengunci markup yang sama.
 *
 * Kalau salah satu berubah, yang lain HARUS ikut diubah.
 */
class ApprovalSignatureHelperParityTest extends TestCase {
    private function build(array $signature, bool $showName = false, bool $showDate = false): string {
        $service = app(PrintTemplateRenderService::class);

        $method = new \ReflectionMethod($service, 'buildSignatureHtml');

        return $method->invoke($service, $signature, $showName, $showDate);
    }

    private function withImage(): array {
        return [
            'image'        => 'data:image/png;base64,AAA',
            'name'         => 'Budi',
            'date'         => '1 Januari 2026',
            'hasSignature' => true,
        ];
    }

    private function withoutImage(): array {
        return [
            'image'        => null,
            'name'         => 'Budi',
            'date'         => '1 Januari 2026',
            'hasSignature' => false,
        ];
    }

    #[Test]
    public function renders_image_only_without_options(): void {
        $this->assertSame(
            '<div class="approval-signature">'
                . '<img src="data:image/png;base64,AAA" alt="' . e(__('user.signature.preview_alt')) . '" style="max-height:58px;display:block;margin:0 auto;" />'
                . '</div>',
            $this->build($this->withImage()),
        );
    }

    #[Test]
    public function adds_name_and_date_when_requested(): void {
        $this->assertSame(
            '<div class="approval-signature">'
                . '<img src="data:image/png;base64,AAA" alt="' . e(__('user.signature.preview_alt')) . '" style="max-height:58px;display:block;margin:0 auto;" />'
                . '<span style="display:block;">Budi</span>'
                . '<span style="display:block;">1 Januari 2026</span>'
                . '</div>',
            $this->build($this->withImage(), showName: true, showDate: true),
        );
    }

    #[Test]
    public function falls_back_to_name_and_date_without_signature(): void {
        $this->assertSame(
            '<div class="approval-signature">'
                . '<span style="display:block;">Budi</span>'
                . '<span style="display:block;">1 Januari 2026</span>'
                . '</div>',
            $this->build($this->withoutImage()),
        );
    }

    #[Test]
    public function fallback_keeps_name_even_when_show_name_is_false(): void {
        $this->assertStringContainsString('Budi', $this->build($this->withoutImage(), showName: false));
    }

    #[Test]
    public function escapes_html_in_name(): void {
        $this->assertSame(
            '<div class="approval-signature">'
                . '<span style="display:block;">&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;</span>'
                . '</div>',
            $this->build([
                'image'        => null,
                'name'         => '<script>alert("x")</script>',
                'date'         => null,
                'hasSignature' => false,
            ]),
        );
    }

    /**
     * Helper sisi server TIDAK boleh mengembalikan markup yang lolos
     * escaping pada double-brace, karena lightncandy tidak punya padanan
     * SafeString. Template wajib memakai triple-brace, dan test ini
     * mengunci konsekuensinya supaya tidak ada yang "memperbaiki" dengan
     * menambahkan SafeString di sisi klien saja.
     */
    #[Test]
    public function server_helper_output_is_plain_html_string(): void {
        $this->assertIsString($this->build($this->withImage()));
    }

    /**
     * Data hasil `resolveCreatorSignature()` (role="creator"): bentuk sama,
     * tetapi `date` selalu null. Kasus-kasus di bawah digandakan persis di
     * `signatureSlot.test.js`.
     */
    private function creatorWithImage(): array {
        return [
            'image'        => 'data:image/png;base64,AAA',
            'name'         => 'Pembuat',
            'date'         => null,
            'hasSignature' => true,
        ];
    }

    private function creatorWithoutImage(): array {
        return [
            'image'        => null,
            'name'         => 'Pembuat',
            'date'         => null,
            'hasSignature' => false,
        ];
    }

    #[Test]
    public function creator_role_prints_image_and_name_without_date(): void {
        $this->assertSame(
            '<div class="approval-signature">'
                . '<img src="data:image/png;base64,AAA" alt="' . e(__('user.signature.preview_alt')) . '" style="max-height:58px;display:block;margin:0 auto;" />'
                . '<span style="display:block;">Pembuat</span>'
                . '</div>',
            $this->build($this->creatorWithImage(), showName: true, showDate: true),
        );
    }

    #[Test]
    public function creator_role_without_signature_falls_back_to_name_only(): void {
        $this->assertSame(
            '<div class="approval-signature">'
                . '<span style="display:block;">Pembuat</span>'
                . '</div>',
            $this->build($this->creatorWithoutImage(), showName: true, showDate: true),
        );
    }

    #[Test]
    public function creator_role_image_only_without_options(): void {
        $this->assertSame(
            '<div class="approval-signature">'
                . '<img src="data:image/png;base64,AAA" alt="' . e(__('user.signature.preview_alt')) . '" style="max-height:58px;display:block;margin:0 auto;" />'
                . '</div>',
            $this->build($this->creatorWithImage()),
        );
    }
}
