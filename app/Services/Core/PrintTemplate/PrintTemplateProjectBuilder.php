<?php

namespace App\Services\Core\PrintTemplate;

use DOMComment;
use DOMDocument;
use DOMElement;
use DOMNodeList;
use DOMText;

/**
 * Membangun struktur project JSON GrapesJS (`template`) dari pasangan `html`
 * dan `css` supaya template hasil seeder atau template tanpa project JSON
 * dapat langsung dibuka, ditampilkan penuh, dan diedit di Print Template Editor
 * tanpa merusak blok Handlebars (`{{#each}}`, `{{#if}}`, `{{#unless}}`) di dalam
 * tabel maupun kontainer.
 */
class PrintTemplateProjectBuilder {
    /** @var list<string> Elemen void HTML yang tidak memiliki child node. */
    private const VOID_TAGS = [
        'area',
        'base',
        'br',
        'col',
        'embed',
        'hr',
        'img',
        'input',
        'link',
        'meta',
        'param',
        'source',
        'track',
        'wbr',
    ];

    /** @var list<string> Tag inline murni yang boleh berada di dalam komponen bertipe `text`. */
    private const INLINE_TAGS = [
        'a',
        'abbr',
        'b',
        'br',
        'code',
        'em',
        'i',
        'mark',
        's',
        'small',
        'span',
        'strong',
        'sub',
        'sup',
        'u',
    ];

    /** @var list<string> Tag yang dapat diperlakukan sebagai komponen `text` bila hanya berisi teks/inline. */
    private const TEXT_CAPABLE_TAGS = [
        'div',
        'h1',
        'h2',
        'h3',
        'h4',
        'h5',
        'h6',
        'li',
        'p',
        'small',
        'span',
        'strong',
        'td',
        'th',
    ];

    /**
     * Bangun struktur project JSON GrapesJS lengkap dari `html` dan `css`.
     *
     * @return array<string, mixed>
     */
    public function build(string $html, ?string $css = ''): array {
        return [
            'pages' => [
                [
                    'id'     => 'main-page',
                    'type'   => 'main',
                    'frames' => [
                        [
                            'id'        => 'main-frame',
                            'component' => [
                                'type'     => 'wrapper',
                                'stylable' => [
                                    'background',
                                    'background-color',
                                    'background-image',
                                    'background-repeat',
                                    'background-attachment',
                                    'background-position',
                                    'background-size',
                                ],
                                'components' => $this->parseHtmlToComponents($html),
                            ],
                        ],
                    ],
                ],
            ],
            'assets'      => [],
            'styles'      => $this->parseCssToStyles($css ?? ''),
            'symbols'     => [],
            'dataSources' => [],
        ];
    }

    /**
     * Konversi string HTML dokumen (dengan atau tanpa pembungkus `<body>`)
     * menjadi daftar komponen GrapesJS.
     *
     * @return list<array<string, mixed>>
     */
    public function parseHtmlToComponents(string $html): array {
        $trimmed = trim($html);
        if ($trimmed === '') {
            return [];
        }

        // Ambil isi di dalam <body>...</body> bila ada.
        if (preg_match('/<body\b[^>]*>([\s\S]*?)<\/body>/i', $trimmed, $bodyMatch)) {
            $innerHtml = $bodyMatch[1];
        } else {
            $innerHtml = $trimmed;
        }

        $preprocessed = $this->replaceStructuralHandlebarsWithComments($innerHtml);

        $dom      = new DOMDocument('1.0', 'UTF-8');
        $Previous = libxml_use_internal_errors(true);
        $wrapped  = '<!DOCTYPE html><html><head><meta http-equiv="Content-Type" content="text/html; charset=utf-8"></head><body>'
            . $preprocessed
            . '</body></html>';

        $dom->loadHTML($wrapped, LIBXML_NOERROR | LIBXML_NOWARNING);
        libxml_clear_errors();
        libxml_use_internal_errors($Previous);

        $body = $dom->getElementsByTagName('body')->item(0);
        if (! $body) {
            return [];
        }

        return $this->convertChildNodes($body->childNodes, 'body');
    }

    /**
     * Konversi string CSS menjadi array rule `styles` untuk CssComposer GrapesJS.
     *
     * Menggunakan `selectorsAdd` supaya seluruh selector kompleks (termasuk
     * `body .items-table th`, `.quotation-doc .items-table td`, pseudo-selector,
     * dan selector koma) tetap aktif di kanvas iframe sekaligus ikut diekspor
     * utuh oleh `editor.getCss({ component })` saat disimpan.
     *
     * @return list<array{selectors: list<string>, selectorsAdd: string, style: array<string, string>}>
     */
    public function parseCssToStyles(string $css): array {
        $cleaned = (string) preg_replace('/\/\*[\s\S]*?\*\//', '', $css);
        if (trim($cleaned) === '') {
            return [];
        }

        $styles = [];
        if (! preg_match_all('/([^{]+)\{([^}]*)\}/s', $cleaned, $matches, PREG_SET_ORDER)) {
            return [];
        }

        foreach ($matches as $match) {
            $selectorsText = trim((string) preg_replace('/\s+/', ' ', $match[1]));
            $declarations  = $this->parseInlineStyle($match[2]);

            if ($selectorsText === '' || $declarations === []) {
                continue;
            }

            $styles[] = [
                'selectors'    => [],
                'selectorsAdd' => $selectorsText,
                'style'        => $declarations,
            ];
        }

        return $styles;
    }

    /**
     * Ganti tag blok Handlebars (`{{#each ...}}`, `{{#if ...}}`, `{{#unless ...}}`,
     * `{{else}}`, `{{/each}}`, `{{/if}}`, `{{/unless}}`) yang membungkus elemen
     * HTML menjadi komentar DOM `<!--GJS_HB:base64-->` agar tidak di-foster-parent
     * keluar dari `<table>`/`<tbody>` oleh parser HTML.
     *
     * Blok Handlebars murni inline yang tidak mengandung tag HTML `<...>` di
     * dalamnya (misalnya `<td>{{#if (eq doc.is_rent 1)}}Sewa{{else}}Jual{{/if}}</td>`)
     * dibiarkan sebagai teks biasa di dalam `textnode`.
     */
    private function replaceStructuralHandlebarsWithComments(string $html): string {
        $pattern = '/\{\{(?:#(?:each|if|unless)\b[^}]*|else|\/(?:each|if|unless))\}\}/';
        if (! preg_match_all($pattern, $html, $matches, PREG_OFFSET_CAPTURE)) {
            return $html;
        }

        /** @var list<array{tag: string, pos: int, len: int, elses: list<array{tag: string, pos: int, len: int}>}> $stack */
        $stack = [];
        /** @var list<array{tag: string, pos: int, len: int}> $replacements */
        $replacements = [];

        foreach ($matches[0] as [$tag, $pos]) {
            $pos = (int) $pos;
            $len = strlen($tag);

            if (str_starts_with($tag, '{{#')) {
                $stack[] = [
                    'tag'   => $tag,
                    'pos'   => $pos,
                    'len'   => $len,
                    'elses' => [],
                ];

                continue;
            }

            if ($tag === '{{else}}') {
                if ($stack !== []) {
                    $topIndex                    = count($stack) - 1;
                    $stack[$topIndex]['elses'][] = [
                        'tag' => $tag,
                        'pos' => $pos,
                        'len' => $len,
                    ];
                }

                continue;
            }

            if (str_starts_with($tag, '{{/') && $stack !== []) {
                $frame      = array_pop($stack);
                $innerStart = $frame['pos'] + $frame['len'];
                $innerBody  = substr($html, $innerStart, $pos - $innerStart);

                // Jika isi blok memuat tag HTML (`<tag` atau `</tag` atau `<!--`),
                // jadikan pembuka, else, dan penutupnya sebagai komponen html-comment.
                if (preg_match('/<[a-zA-Z\/!]/', $innerBody) === 1) {
                    $replacements[] = [
                        'tag' => $frame['tag'],
                        'pos' => $frame['pos'],
                        'len' => $frame['len'],
                    ];
                    foreach ($frame['elses'] as $elseToken) {
                        $replacements[] = $elseToken;
                    }
                    $replacements[] = [
                        'tag' => $tag,
                        'pos' => $pos,
                        'len' => $len,
                    ];
                }
            }
        }

        if ($replacements === []) {
            return $html;
        }

        usort($replacements, static fn (array $a, array $b): int => $b['pos'] <=> $a['pos']);

        $result = $html;
        foreach ($replacements as $item) {
            $comment = '<!--GJS_HB:' . base64_encode($item['tag']) . '-->';
            $result  = substr_replace($result, $comment, $item['pos'], $item['len']);
        }

        return $result;
    }

    /**
     * Konversi daftar node anak DOM menjadi daftar komponen GrapesJS.
     *
     * @return list<array<string, mixed>>
     */
    private function convertChildNodes(DOMNodeList $nodes, string $parentTag): array {
        $components     = [];
        $hasElementNode = false;

        foreach ($nodes as $node) {
            if ($node instanceof DOMElement || $node instanceof DOMComment) {
                $hasElementNode = true;
                break;
            }
        }

        foreach ($nodes as $node) {
            if ($node instanceof DOMComment) {
                $data = trim($node->data);
                if (str_starts_with($data, 'GJS_HB:')) {
                    $decoded = base64_decode(substr($data, 7), true);
                    if ($decoded !== false && $decoded !== '') {
                        $components[] = [
                            'type'       => 'html-comment',
                            'attributes' => [
                                'text'  => $decoded,
                                'class' => 'gjs-html-comment',
                            ],
                        ];
                    }
                }

                continue;
            }

            if ($node instanceof DOMText) {
                $text = $node->wholeText;
                if (trim($text) === '') {
                    // Pertahankan satu spasi antar elemen inline di dalam konteks teks.
                    if ($hasElementNode && in_array($parentTag, self::TEXT_CAPABLE_TAGS, true) && $text !== '' && ! str_contains($text, "\n")) {
                        $components[] = [
                            'type'    => 'textnode',
                            'content' => ' ',
                        ];
                    }

                    continue;
                }

                // Jika parent punya elemen anak (mixed content), rapikan newline indentasi.
                if ($hasElementNode) {
                    $text = (string) preg_replace('/\s*\n\s*/', ' ', $text);
                }

                $components[] = [
                    'type'    => 'textnode',
                    'content' => $text,
                ];

                continue;
            }

            if ($node instanceof DOMElement) {
                $components[] = $this->convertElement($node);
            }
        }

        return $components;
    }

    /**
     * Konversi satu `DOMElement` menjadi komponen GrapesJS.
     *
     * @return array<string, mixed>
     */
    private function convertElement(DOMElement $element): array {
        $tagName    = strtolower($element->tagName);
        $classes    = [];
        $attributes = [];
        $inlineCss  = [];

        if ($element->hasAttributes()) {
            foreach ($element->attributes as $attr) {
                $name  = $attr->name;
                $value = $attr->value;

                if ($name === 'class') {
                    $classes = array_values(array_filter(
                        preg_split('/\s+/', trim($value)) ?: [],
                        static fn (string $c): bool => $c !== '',
                    ));
                } elseif ($name === 'style') {
                    $inlineCss = $this->parseInlineStyle($value);
                } else {
                    $attributes[$name] = $value;
                }
            }
        }

        // Komponen khusus: slot tanda tangan approvalSignature.
        if (
            ($attributes['data-gjs-type'] ?? null) === 'approvalSignature'
            || in_array('gjs-signature-wrapper', $classes, true)
        ) {
            return $this->buildApprovalSignatureComponent($element, $attributes, $inlineCss);
        }

        if (in_array($tagName, self::VOID_TAGS, true)) {
            $comp = ['tagName' => $tagName];
            if ($classes !== []) {
                $comp['classes'] = $classes;
            }
            if ($attributes !== []) {
                $comp['attributes'] = $attributes;
            }
            if ($inlineCss !== []) {
                $comp['style'] = $inlineCss;
            }

            return $comp;
        }

        $children = $this->convertChildNodes($element->childNodes, $tagName);
        $type     = $this->resolveComponentType($tagName, $classes, $children);

        $comp = [
            'type'    => $type,
            'tagName' => $tagName,
        ];

        if ($classes !== []) {
            $comp['classes'] = $classes;
        }
        if ($attributes !== []) {
            $comp['attributes'] = $attributes;
        }
        if ($inlineCss !== []) {
            $comp['style'] = $inlineCss;
        }
        if ($children !== []) {
            $comp['components'] = $children;
        }

        return $comp;
    }

    /**
     * Bangun komponen `approvalSignature` dengan atribut trait (`role`, `showName`, `showDate`)
     * sekaligus atribut `data-*` agar kompatibel saat diedit maupun diserialisasi ulang.
     *
     * @param  array<string, string>  $attributes
     * @param  array<string, string>  $inlineCss
     * @return array<string, mixed>
     */
    private function buildApprovalSignatureComponent(DOMElement $element, array $attributes, array $inlineCss): array {
        $innerText = $element->textContent ?? '';

        $role = ($attributes['role'] ?? $attributes['data-role'] ?? null) === 'creator'
            || preg_match('/role\s*=\s*["\']creator["\']/', $innerText) === 1
            ? 'creator'
            : 'approver';

        $showName = ($attributes['showName'] ?? $attributes['data-show-name'] ?? null) === 'true'
            || preg_match('/showName\s*=\s*true/', $innerText) === 1;

        $showDate = ($attributes['showDate'] ?? $attributes['data-show-date'] ?? null) === 'true'
            || preg_match('/showDate\s*=\s*true/', $innerText) === 1;

        $sigAttributes = [
            'class'         => 'gjs-signature-wrapper',
            'data-gjs-type' => 'approvalSignature',
            'role'          => $role,
            'showName'      => $showName ? 'true' : 'false',
            'showDate'      => $showDate ? 'true' : 'false',
        ];

        if ($showName) {
            $sigAttributes['data-show-name'] = 'true';
        }
        if ($showDate) {
            $sigAttributes['data-show-date'] = 'true';
        }
        if ($role === 'creator') {
            $sigAttributes['data-role'] = 'creator';
        }

        $comp = [
            'type'       => 'approvalSignature',
            'tagName'    => 'div',
            'classes'    => ['gjs-signature-wrapper'],
            'attributes' => $sigAttributes,
        ];

        if ($inlineCss !== []) {
            $comp['style'] = $inlineCss;
        }

        return $comp;
    }

    /**
     * Tentukan `type` komponen GrapesJS (`text`, `gjsGrid`, `gjsSubGrid`, atau `default`).
     *
     * @param  list<string>  $classes
     * @param  list<array<string, mixed>>  $children
     */
    private function resolveComponentType(string $tagName, array $classes, array $children): string {
        if (in_array('gjs-grid', $classes, true)) {
            return 'gjsGrid';
        }
        if (in_array('gjs-subgrid', $classes, true)) {
            return 'gjsSubGrid';
        }

        if (! in_array($tagName, self::TEXT_CAPABLE_TAGS, true) || $children === []) {
            return 'default';
        }

        foreach ($children as $child) {
            $childType = $child['type'] ?? 'default';
            if ($childType === 'textnode') {
                continue;
            }
            if ($childType === 'html-comment' || $childType === 'approvalSignature') {
                return 'default';
            }

            $childTag = $child['tagName'] ?? '';
            if (! in_array($childTag, self::INLINE_TAGS, true)) {
                return 'default';
            }
        }

        return 'text';
    }

    /**
     * Urai deklarasi CSS (`prop: value; ...`) menjadi associative array.
     *
     * @return array<string, string>
     */
    private function parseInlineStyle(string $declarations): array {
        $result = [];
        foreach (explode(';', $declarations) as $part) {
            $part = trim($part);
            if ($part === '' || ! str_contains($part, ':')) {
                continue;
            }

            [$prop, $val] = explode(':', $part, 2);
            $prop         = trim($prop);
            $val          = trim($val);

            if ($prop !== '' && $val !== '') {
                $result[$prop] = $val;
            }
        }

        return $result;
    }
}
