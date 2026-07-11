<?php

namespace Tests\Feature\Core\PrintTemplate;

use App\Models\Core\PrintTemplate;
use App\Services\Core\PrintTemplate\PdfExportService;
use Illuminate\Support\Facades\Log;
use Tests\TestCase;

class PdfExportServiceTest extends TestCase {
    protected function makeTemplate(): PrintTemplate {
        $template                = new PrintTemplate;
        $template->paper         = 'A4';
        $template->orientation   = 'portrait';
        $template->unit          = 'cm';
        $template->width         = 21;
        $template->height        = 29.7;
        $template->margin_top    = 1;
        $template->margin_bottom = 1;
        $template->margin_left   = 1;
        $template->margin_right  = 1;

        return $template;
    }

    /**
     * Test fallback to dompdf when the configured wkhtmltopdf binary path does not exist.
     *
     * **Validates: Requirements 2.1, 2.2, 2.3**
     */
    public function test_falls_back_to_dompdf_when_binary_missing(): void {
        config(['pdf.wkhtmltopdf_binary' => storage_path('app/bin/does-not-exist-binary')]);
        Log::spy();

        $service = new PdfExportService;
        $pdf     = $service->generate('<html><body><h1>Hello</h1></body></html>', $this->makeTemplate());

        $this->assertStringStartsWith('%PDF-', $pdf);
        Log::shouldHaveReceived('warning')->once();
    }

    /**
     * Test fallback to dompdf when the wkhtmltopdf binary path is empty/unset.
     *
     * **Validates: Requirements 2.1, 2.2, 2.3**
     */
    public function test_falls_back_to_dompdf_when_binary_path_empty(): void {
        config(['pdf.wkhtmltopdf_binary' => '']);

        $service = new PdfExportService;
        $pdf     = $service->generate('<html><body><p>Test</p></body></html>', $this->makeTemplate());

        $this->assertStringStartsWith('%PDF-', $pdf);
    }

    /**
     * Test that remote/internal URLs are stripped from src/href before the
     * HTML reaches the PDF engine, preventing SSRF via attacker-controlled
     * resource URLs (e.g. cloud metadata endpoints, internal services).
     *
     * **Validates: Requirements 3.4**
     */
    public function test_sanitizes_remote_urls_to_prevent_ssrf(): void {
        config(['app.url' => 'https://erp.example.com']);

        $service  = new PdfExportService;
        $sanitize = new \ReflectionMethod($service, 'sanitizeRemoteUrls');
        $html     = '<html><body>'
            . '<img src="http://169.254.169.254/latest/meta-data/" id="attack">'
            . '<img src="http://internal-service.local/secret" id="internal">'
            . '<img src="https://erp.example.com/storage/logo.png" id="same-origin">'
            . '<img src="data:image/png;base64,aGVsbG8=" id="inline">'
            . '<img src="/storage/relative-logo.png" id="relative">'
            . '</body></html>';

        $result = $sanitize->invoke($service, $html);

        $this->assertStringNotContainsString('169.254.169.254', $result);
        $this->assertStringNotContainsString('internal-service.local', $result);
        $this->assertStringContainsString('https://erp.example.com/storage/logo.png', $result);
        $this->assertStringContainsString('data:image/png;base64,aGVsbG8=', $result);
        $this->assertStringContainsString('/storage/relative-logo.png', $result);
    }

    /**
     * Test that remote URLs hidden inside CSS (background: url(...), inline
     * style attributes, and @import) are also stripped, not just DOM
     * src/href attributes — closing the bypass an attacker could otherwise
     * use to trigger the same SSRF via CSS instead of markup.
     *
     * **Validates: Requirements 3.4**
     */
    public function test_sanitizes_remote_urls_inside_css(): void {
        config(['app.url' => 'https://erp.example.com']);

        $service  = new PdfExportService;
        $sanitize = new \ReflectionMethod($service, 'sanitizeRemoteUrls');
        $html     = '<html><head><style>'
            . '.attack { background: url(http://169.254.169.254/latest/meta-data/) }'
            . '@import url("http://internal-service.local/evil.css");'
            . '.ok { background: url(https://erp.example.com/storage/bg.png) }'
            . '</style></head><body>'
            . '<div style="background-image:url(http://internal-service.local/secret.png)" id="inline-attack"></div>'
            . '<div style="color:red" id="inline-safe"></div>'
            . '<video poster="http://169.254.169.254/poster.jpg" id="video-attack"></video>'
            . '<img srcset="http://internal-service.local/a.png 1x" id="srcset-attack">'
            . '</body></html>';

        $result = $sanitize->invoke($service, $html);

        $this->assertStringNotContainsString('169.254.169.254', $result);
        $this->assertStringNotContainsString('internal-service.local', $result);
        $this->assertStringContainsString('https://erp.example.com/storage/bg.png', $result);
        $this->assertStringContainsString('color:red', $result);
    }
}
