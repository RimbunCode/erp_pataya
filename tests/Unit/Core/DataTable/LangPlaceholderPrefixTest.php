<?php

namespace Tests\Unit\Core\DataTable;

use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

/**
 * laravel-react-i18n mengganti placeholder BERURUTAN tanpa mengurutkan panjang,
 * jadi `:to` di `:to / :total` ikut memotong `:total` menjadi "3tal" (bug nyata
 * pager grup, ketahuan di browser -- test FE memock `t()` sehingga tak terlihat).
 * Guard: dalam SATU string, nama placeholder tak boleh berawalan nama lain.
 */
class LangPlaceholderPrefixTest extends TestCase {
    #[Test]
    public function datatable_lang_strings_have_no_prefix_colliding_placeholders(): void {
        $collisions = [];

        foreach (['id', 'en'] as $locale) {
            $lines = require \dirname(__DIR__, 4) . "/lang/{$locale}/core/datatable.php";

            foreach ($this->flatten($lines) as $key => $text) {
                \preg_match_all('/:([A-Za-z_]+)/', $text, $matches);
                $names = \array_unique($matches[1]);

                foreach ($names as $short) {
                    foreach ($names as $long) {
                        if ($short !== $long && \str_starts_with($long, $short)) {
                            $collisions[] = "{$locale}: {$key} -- ':{$short}' berawalan sama dgn ':{$long}'";
                        }
                    }
                }
            }
        }

        $this->assertSame([], $collisions, "Placeholder saling berawalan:\n" . \implode("\n", $collisions));
    }

    /**
     * @param  array<string, mixed>  $lines
     * @return array<string, string>
     */
    private function flatten(array $lines, string $prefix = ''): array {
        $flat = [];
        foreach ($lines as $key => $value) {
            $path = $prefix === '' ? (string) $key : "{$prefix}.{$key}";
            if (\is_array($value)) {
                $flat += $this->flatten($value, $path);
            } elseif (\is_string($value)) {
                $flat[$path] = $value;
            }
        }

        return $flat;
    }
}
