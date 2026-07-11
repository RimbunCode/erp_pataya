<?php

namespace App\Services\Core\PrintTemplate;

use App\Models\Core\PrintTemplate;
use Dompdf\Dompdf;
use Dompdf\Options;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Symfony\Component\Process\Exception\ProcessFailedException;
use Symfony\Component\Process\Process;
use Throwable;

/**
 * Converts rendered print-template HTML into a PDF file.
 *
 * Primary engine is wkhtmltopdf (external binary via Symfony Process),
 * chosen for its closer CSS/flexbox fidelity to the browser preview.
 * Falls back to dompdf (pure PHP) whenever the binary is missing, not
 * executable, or the process fails/times out — so PDF export keeps
 * working even if a shared-hosting provider revokes exec() later.
 */
class PdfExportService {
    protected string $unit;

    /**
     * Generate a PDF from already-rendered HTML.
     *
     * @param  string  $html  Full HTML document (including <head>/<style>) as
     *                        produced by the print preview iframe.
     */
    public function generate(string $html, PrintTemplate $template): string {
        $html = $this->sanitizeRemoteUrls($html);

        $pdf = $this->tryWkhtmltopdf($html, $template);

        if ($pdf !== null) {
            return $pdf;
        }

        Log::warning('PDF export: wkhtmltopdf unavailable or failed, falling back to dompdf', [
            'print_template_id' => $template->id,
        ]);

        return $this->fallbackDompdf($html, $template);
    }

    /**
     * Tags whose URL-bearing attributes can trigger a resource fetch.
     */
    protected const URL_ATTRIBUTE_TAGS = [
        'img', 'iframe', 'script', 'link', 'a', 'object', 'embed',
        'source', 'video', 'audio', 'image', 'use',
    ];

    /**
     * Attributes that may carry a fetchable URL, across the tags above.
     */
    protected const URL_ATTRIBUTES = [
        'src', 'href', 'data', 'poster', 'formaction', 'background', 'xlink:href',
    ];

    /**
     * Strip any URL that resolves outside the app's own origin from the HTML.
     *
     * The incoming HTML is client-controlled (rendered by the browser, then
     * posted back as a raw string). Without this, an attacker could embed a
     * remote URL (e.g. `<img src="http://169.254.169.254/...">`, a CSS
     * `background: url(...)`, or an internal service address) and have the
     * PDF engine — which runs server-side with server-side network access —
     * fetch it (SSRF). Only `data:` URIs and URLs on the application's own
     * origin (where letter head logos / uploaded files are served from) are
     * allowed through.
     *
     * Covers both DOM attributes (src/href/data/poster/... across the tags
     * most likely to trigger a fetch) and CSS `url(...)`/`@import` inside
     * `<style>` elements and inline `style="..."` attributes — a plain
     * attribute whitelist alone misses those.
     */
    protected function sanitizeRemoteUrls(string $html): string {
        if (trim($html) === '') {
            return $html;
        }

        $appHost = parse_url((string) config('app.url'), PHP_URL_HOST);

        $dom = new \DOMDocument('1.0', 'UTF-8');
        libxml_use_internal_errors(true);
        $dom->loadHTML('<?xml encoding="UTF-8">' . $html, LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD);
        libxml_clear_errors();

        foreach (self::URL_ATTRIBUTE_TAGS as $tag) {
            foreach (iterator_to_array($dom->getElementsByTagName($tag)) as $node) {
                foreach (self::URL_ATTRIBUTES as $attribute) {
                    if (! $node->hasAttribute($attribute)) {
                        continue;
                    }

                    if ($this->isAllowedResourceUrl($node->getAttribute($attribute), $appHost)) {
                        continue;
                    }

                    $node->removeAttribute($attribute);
                }

                if ($node->hasAttribute('srcset')) {
                    $node->removeAttribute('srcset');
                }
            }
        }

        foreach (iterator_to_array($dom->getElementsByTagName('style')) as $node) {
            $node->textContent = $this->sanitizeCssUrls($node->textContent, $appHost);
        }

        $xpath = new \DOMXPath($dom);
        foreach (iterator_to_array($xpath->query('//*[@style]')) as $node) {
            if (! $node instanceof \DOMElement) {
                continue;
            }

            $node->setAttribute('style', $this->sanitizeCssUrls($node->getAttribute('style'), $appHost));
        }

        return $dom->saveHTML() ?: $html;
    }

    /**
     * Strip disallowed `url(...)` references (and `@import` targets) from a
     * block of CSS, e.g. from a `<style>` element or an inline `style=`
     * attribute. Anything not resolving to `data:` or the app's own origin
     * is dropped rather than rewritten, since the surrounding declaration is
     * not needed for layout to still render sensibly.
     */
    protected function sanitizeCssUrls(string $css, ?string $appHost): string {
        return preg_replace_callback(
            '/url\(\s*[\'"]?([^\'")]+)[\'"]?\s*\)/i',
            function (array $matches) use ($appHost) {
                return $this->isAllowedResourceUrl(trim($matches[1]), $appHost)
                    ? $matches[0]
                    : 'url()';
            },
            $css,
        ) ?? $css;
    }

    /**
     * Determine whether a resource URL is safe to let the PDF engine fetch:
     * inline `data:` URIs, or absolute/relative URLs resolving to this
     * application's own host.
     */
    protected function isAllowedResourceUrl(string $url, ?string $appHost): bool {
        $url = trim($url);

        if ($url === '') {
            return true;
        }

        if (str_starts_with(strtolower($url), 'data:')) {
            return true;
        }

        // Relative URLs (no scheme/host) resolve against this app's own origin.
        $host = parse_url($url, PHP_URL_HOST);
        if ($host === null) {
            return ! str_starts_with(strtolower(ltrim($url)), 'javascript:');
        }

        return $appHost !== null && strcasecmp($host, $appHost) === 0;
    }

    /**
     * Attempt conversion via the wkhtmltopdf binary.
     *
     * @return string|null Raw PDF bytes, or null if the binary is unusable
     *                     or the process did not succeed (caller should
     *                     fall back to dompdf).
     */
    protected function tryWkhtmltopdf(string $html, PrintTemplate $template): ?string {
        $binary = config('pdf.wkhtmltopdf_binary');

        if (! is_string($binary) || $binary === '' || ! is_file($binary) || ! is_executable($binary)) {
            return null;
        }

        $htmlPath = storage_path('app/tmp/' . Str::uuid() . '.html');
        $pdfPath  = storage_path('app/tmp/' . Str::uuid() . '.pdf');

        file_put_contents($htmlPath, $html);

        try {
            $process = new Process([
                $binary,
                '--disable-local-file-access',
                '--disable-javascript',
                '--disable-external-links',
                '--page-width', $this->toMillimeters($template->width, $template), 'mm',
                '--page-height', $this->toMillimeters($template->height, $template), 'mm',
                '--margin-top', $this->toMillimeters($template->margin_top, $template), 'mm',
                '--margin-bottom', $this->toMillimeters($template->margin_bottom, $template), 'mm',
                '--margin-left', $this->toMillimeters($template->margin_left, $template), 'mm',
                '--margin-right', $this->toMillimeters($template->margin_right, $template), 'mm',
                $htmlPath,
                $pdfPath,
            ]);
            $process->setTimeout((int) config('pdf.wkhtmltopdf_timeout', 30));
            $process->run();

            if (! $process->isSuccessful() || ! is_file($pdfPath)) {
                return null;
            }

            return file_get_contents($pdfPath) ?: null;
        } catch (ProcessFailedException|Throwable) {
            return null;
        } finally {
            @unlink($htmlPath);
            @unlink($pdfPath);
        }
    }

    /**
     * Fallback conversion via dompdf (pure PHP, no external process).
     */
    protected function fallbackDompdf(string $html, PrintTemplate $template): string {
        $options = new Options;
        $options->setIsRemoteEnabled(false);
        $options->setIsHtml5ParserEnabled(true);

        $dompdf = new Dompdf($options);
        $dompdf->loadHtml($html);
        $dompdf->setPaper(
            [0, 0, $this->toPoints($template->width, $template), $this->toPoints($template->height, $template)],
        );
        $dompdf->render();

        return $dompdf->output();
    }

    /**
     * Convert a template dimension (stored in the template's own unit) to millimeters.
     */
    protected function toMillimeters(?float $value, PrintTemplate $template): string {
        $factor = match ($template->unit) {
            'in'    => 25.4,
            'cm'    => 10,
            default => 1,
        };

        return (string) round(($value ?? 0) * $factor, 2);
    }

    /**
     * Convert a template dimension (stored in the template's own unit) to points (1/72 inch).
     */
    protected function toPoints(?float $value, PrintTemplate $template): float {
        $mm = (float) $this->toMillimeters($value, $template);

        return $mm * 72 / 25.4;
    }
}
