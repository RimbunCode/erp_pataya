<?php

namespace App\Services\Core\DataTable\Template;

/**
 * Mengekstrak path kolom/relasi yang dirujuk sebuah template tampilan
 * (`template` kolom, `templateLink()`, `mobileTemplate()`).
 *
 * Satu sumber kebenaran untuk `DataTableColumnSelector::templateLinkPlaceholders()`
 * dan `LinkModel::computeColumnsFlat()` (hasilnya di-union ke `dependsOn`).
 * Pure PHP: tanpa akses DB/model, aman dipanggil dari unit test.
 */
final class TemplateDependencyExtractor {
    /** Tag semantik yang atributnya merujuk relasi (`tag => atribut`). */
    public const RELATION_ATTRS = ['nav-link' => 'to', 'chips' => 'of'];

    /** Tag semantik yang atributnya merujuk field (`tag => atribut`). */
    public const FIELD_ATTRS = ['when' => 'field'];

    /**
     * Placeholder: `:name{:alias}` | `:a.b.c`, akhiran formatter `|fmt` opsional
     * (menempel tanpa spasi, sehingga tidak bentrok dengan pemisah ternary ` | `).
     */
    private const PLACEHOLDER_RE = '/:((\w[\w]+\{:[\w.]+\})|(\w[\w.]+))(\|\w+)?/';

    /**
     * Path kolom/relasi yang dirujuk template (dot-notation, tanpa formatter/alias),
     * unik & terurut. Sumber: placeholder teks, placeholder di nilai atribut,
     * atribut relasi (`to`/`of`), atribut field (`when`), dan cabang ternary
     * (kondisi + kedua cabang muncul sebagai token `:x` terpisah).
     *
     * Nilai atribut `class` tidak dipindai untuk varian Tailwind (`hover:bg-red-500`
     * bukan placeholder `:bg`); placeholder yang berdiri sendiri (didahului spasi)
     * di dalam `class` tetap dikenali.
     *
     * @return list<string>
     */
    public static function extract(?string $template): array {
        if (! is_string($template) || $template === '') {
            return [];
        }

        $out = [];

        if (preg_match_all(self::PLACEHOLDER_RE, self::withoutTailwindVariants($template), $matches)) {
            foreach ($matches[0] as $raw) {
                $path = self::stripFormatter($raw);
                if ($path !== '') {
                    $out[] = $path;
                }
            }
        }

        foreach ([...self::RELATION_ATTRS, ...self::FIELD_ATTRS] as $tag => $attr) {
            foreach (self::attributeValues($template, $tag, $attr) as $value) {
                $out[] = $value;
            }
        }

        $out = array_values(array_unique($out));
        sort($out, SORT_STRING);

        return $out;
    }

    /**
     * Formatter (`|fmt`) yang dipakai placeholder di template, unik & terurut.
     * Dipakai validator untuk melaporkan formatter yang tidak dikenal.
     *
     * @return list<string>
     */
    public static function formatters(?string $template): array {
        if (! is_string($template) || $template === '') {
            return [];
        }

        $out = [];
        if (preg_match_all(self::PLACEHOLDER_RE, self::withoutTailwindVariants($template), $matches)) {
            foreach ($matches[4] as $formatter) {
                if ($formatter !== '') {
                    $out[] = ltrim($formatter, '|');
                }
            }
        }

        $out = array_values(array_unique($out));
        sort($out, SORT_STRING);

        return $out;
    }

    /**
     * Placeholder tanpa formatter & alias: `:created_at|datetime` → `created_at`,
     * `:name{:title}` → `name`. Awalan `:` dibuang bila ada.
     */
    public static function stripFormatter(string $placeholder): string {
        $path = ltrim($placeholder, ':');
        $path = (string) preg_replace('/\{:.*?\}/', '', $path);
        $path = (string) preg_replace('/\|\w+$/', '', $path);

        return $path;
    }

    /**
     * Nilai atribut `$attr` pada semua tag `<$tag ...>` di template, hanya yang
     * berupa path (`[\w.]+`, awalan `:` opsional).
     *
     * @return list<string>
     */
    private static function attributeValues(string $template, string $tag, string $attr): array {
        $values = [];
        $tagRe  = '/<' . preg_quote($tag, '/') . '(?=[\s\/>])([^>]*)>/i';
        $attrRe = '/(?<![\w-])' . preg_quote($attr, '/') . '\s*=\s*(?:"([^"]*)"|\'([^\']*)\')/i';

        if (! preg_match_all($tagRe, $template, $tags)) {
            return [];
        }
        foreach ($tags[1] as $attrs) {
            if (! preg_match($attrRe, $attrs, $m)) {
                continue;
            }
            $value = ltrim(trim($m[1] !== '' ? $m[1] : ($m[2] ?? '')), ':');
            if ($value !== '' && preg_match('/^\w[\w.]*$/', $value) === 1) {
                $values[] = $value;
            }
        }

        return $values;
    }

    /**
     * Buang titik dua milik varian Tailwind di dalam nilai atribut `class`
     * (`md:flex`, `hover:bg-red-500`): titik dua yang menempel pada karakter
     * non-spasi sebelumnya.
     */
    private static function withoutTailwindVariants(string $template): string {
        return (string) preg_replace_callback(
            '/(\sclass\s*=\s*)("[^"]*"|\'[^\']*\')/i',
            fn (array $m): string => $m[1] . preg_replace('/(?<=\S):/', '', $m[2]),
            $template,
        );
    }
}
