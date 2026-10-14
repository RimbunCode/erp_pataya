<?php

namespace App\Services\Core\PrintTemplate;

use App\Models\Core\PrintTemplate;

/**
 * Menjaga markup GrapeJS tetap valid saat root body disuntikkan ke dokumen lain.
 */
class PrintTemplateSourceScoper {
    public const LETTER_HEAD_SCOPE = '.pt-scope--letterhead';
    public const TEMPLATE_SCOPE    = '.pt-scope--template';

    public function scopeHtml(?string $source, string $scope): string {
        $source ??= '';

        if (! preg_match('/<body\b([^>]*)>/i', $source, $opening) || ! preg_match('/<\/body\s*>/i', $source)) {
            return $source;
        }

        $attributes = $this->withScopeClass($opening[1], $scope);

        $html = (string) preg_replace('/<body\b[^>]*>/i', '<section' . $attributes . '>', $source, 1);

        return (string) preg_replace('/<\/body\s*>(?![\s\S]*<\/body\s*>)/i', '</section>', $html, 1);
    }

    public function scopeCss(?string $source, string $scope): string {
        return $this->scopeCssBlock($source ?? '', $scope);
    }

    /**
     * CSS layout halaman. Aturan `.pt-scope` (font) HARUS dipasang SETELAH CSS
     * template ter-scope: spesifisitasnya sama (0,1,0) dengan `.pt-scope--template`
     * sehingga urutan yang menentukan. Margin tetap di `body`: milik halaman.
     * Kembaran PHP dari `buildPrintLayoutCss` di printTemplateRender.js.
     */
    public function layoutCss(PrintTemplate $template): string {
        $unit       = $template->unit ?? 'cm';
        $fontFamily = $this->safeFontFamily($template->font_family);
        $margins    = sprintf('%s%s %s%s %s%s %s%s', $template->margin_top ?? 0, $unit, $template->margin_right ?? 0, $unit, $template->margin_bottom ?? 0, $unit, $template->margin_left ?? 0, $unit);
        $pageNumber = $this->pageNumberCss($template);
        $pageSize   = sprintf('%s%s %s%s', $template->width, $unit, $template->height, $unit);

        return <<<CSS
.gjs-static-html-wrapper { border: none !important; border-radius: 0 !important; padding: 0 !important; }
.gjs-static-html-wrapper::before { content: none !important; display: none !important; }
body { font-family: {$fontFamily}; margin: {$margins}; }
.pt-scope { font-family: {$fontFamily}; }
@media print {
  @page { size: {$pageSize}; margin: {$margins}; {$pageNumber} }
  body { margin: 0; }
}
CSS;
    }

    private function withScopeClass(string $attributes, string $scope): string {
        $className = 'pt-scope ' . ltrim($scope, '.');

        if (preg_match('/\sclass\s*=\s*(["\'])(.*?)\1/i', $attributes, $match)) {
            return (string) preg_replace('/\sclass\s*=\s*(["\'])(.*?)\1/i', ' class="' . trim($match[2] . ' ' . $className) . '"', $attributes, 1);
        }

        return $attributes . ' class="' . $className . '"';
    }

    private function scopeCssBlock(string $source, string $scope): string {
        $output = '';
        $offset = 0;

        while ($offset < strlen($source)) {
            $open = strpos($source, '{', $offset);
            if ($open === false) {
                return $output . substr($source, $offset);
            }

            $close = $this->findMatchingBrace($source, $open);
            if ($close === null) {
                return $output . substr($source, $offset);
            }

            $prelude  = substr($source, $offset, $open - $offset);
            $content  = substr($source, $open + 1, $close - $open - 1);
            $isAtRule = str_starts_with(ltrim($prelude), '@');
            $isNested = preg_match('/^\s*@(media|supports|layer|container|document)\b/i', $prelude) === 1;
            $output .= ($isAtRule ? $prelude : $this->scopeSelectorList($prelude, $scope)) . '{' . ($isNested ? $this->scopeCssBlock($content, $scope) : $content) . '}';
            $offset = $close + 1;
        }

        return $output;
    }

    private function findMatchingBrace(string $source, int $open): ?int {
        $depth = 1;
        $quote = null;

        for ($index = $open + 1; $index < strlen($source); $index++) {
            $character = $source[$index];
            if ($quote !== null) {
                if ($character === '\\') {
                    $index++;
                } elseif ($character === $quote) {
                    $quote = null;
                }

                continue;
            }

            if ($character === '"' || $character === "'") {
                $quote = $character;
            } elseif ($character === '{') {
                $depth++;
            } elseif ($character === '}' && --$depth === 0) {
                return $index;
            }
        }

        return null;
    }

    private function scopeSelectorList(string $selectors, string $scope): string {
        return implode(',', array_map(function (string $selector) use ($scope): string {
            $trimmed = trim($selector);
            if ($trimmed === '') {
                return $selector;
            }

            $scoped = $this->replaceBodySelector($trimmed, $scope);

            return str_contains($scoped, $scope) ? $scoped : $scope . ' ' . $scoped;
        }, explode(',', $selectors)));
    }

    private function replaceBodySelector(string $selector, string $scope): string {
        $output       = '';
        $bracketDepth = 0;
        $quote        = null;

        for ($index = 0; $index < strlen($selector); $index++) {
            $character = $selector[$index];
            if (substr($selector, $index, 2) === '/*') {
                $end = strpos($selector, '*/', $index + 2);
                if ($end === false) {
                    return $output . substr($selector, $index);
                }

                $output .= substr($selector, $index, $end - $index + 2);
                $index = $end + 1;

                continue;
            }
            if ($quote !== null) {
                $output .= $character;
                if ($character === '\\') {
                    $output .= $selector[++$index] ?? '';
                } elseif ($character === $quote) {
                    $quote = null;
                }

                continue;
            }

            $token  = substr($selector, $index, 4);
            $before = $index > 0 ? $selector[$index - 1] : '';
            $after  = $selector[$index + 4] ?? '';
            if ($bracketDepth === 0 && strcasecmp($token, 'body') === 0 && ! preg_match('/[\w.#-]/', $before) && ! preg_match('/[\w-]/', $after)) {
                $output .= $scope;
                $index += 3;

                continue;
            }

            if ($character === '"' || $character === "'") {
                $quote = $character;
            } elseif ($character === '[') {
                $bracketDepth++;
            } elseif ($character === ']') {
                $bracketDepth--;
            }

            $output .= $character;
        }

        return $output;
    }

    private function safeFontFamily(?string $fontFamily): string {
        $fontFamily = trim((string) $fontFamily);
        if ($fontFamily === '' || ! preg_match('/^[\pL\pN\s,\-]+$/u', $fontFamily)) {
            return 'sans-serif';
        }

        return "'" . str_replace("'", "\\'", $fontFamily) . "', sans-serif";
    }

    private function pageNumberCss(PrintTemplate $template): string {
        if (! $template->page_number || $template->page_number === 'hide') {
            return '';
        }

        $format = str_replace([':page', ':total'], ["'counter(page)'", "'counter(pages)'"], $template->page_number_format ?? ':page / :total');

        return '@' . str_replace('_', '-', $template->page_number) . " { content: '{$format}'; font-size: 10pt; }";
    }
}
