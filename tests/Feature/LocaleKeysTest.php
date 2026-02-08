<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\File;
use Tests\TestCase;

class LocaleKeysTest extends TestCase
{
    /**
     * Path ke direktori bahasa.
     */
    protected string $langPath;

    protected function setUp(): void
    {
        parent::setUp();
        $this->langPath = base_path('lang'); // Ubah sesuai struktur project jika berbeda
    }

    /** @test */
    public function all_locale_files_have_same_keys()
    {
        $locales = ['en', 'id']; // Sesuaikan dengan locale yang kamu miliki
        $baseLocale = $locales[0];

        $baseKeys = $this->getLocaleKeys($baseLocale);

        foreach ($locales as $locale) {
            if ($locale === $baseLocale) {
                continue;
            }

            $localeKeys = $this->getLocaleKeys($locale);

            $missingInLocale = array_diff_key($baseKeys, $localeKeys);
            $extraInLocale = array_diff_key($localeKeys, $baseKeys);

            $this->assertEmpty($missingInLocale, "Locale '$locale' missing keys: ".implode(', ', array_keys($missingInLocale)));
            $this->assertEmpty($extraInLocale, "Locale '$locale' has extra keys: ".implode(', ', array_keys($extraInLocale)));
        }
    }

    /**
     * Mengambil semua kunci dari file lokalisasi untuk suatu locale.
     */
    private function getLocaleKeys(string $locale, string $directory = ''): array
    {
        $path = $this->langPath.'/'.$locale.($directory ? "/$directory" : '');
        $keys = [];

        if (! File::exists($path)) {
            return [];
        }

        foreach (File::allFiles($path) as $file) {
            $relativePath = str_replace([$this->langPath.'/'.$locale.'/', '.php'], '', $file->getRealPath());
            $translations = require $file->getRealPath();
            $keys = array_merge($keys, $this->flattenArrayKeys($translations, $relativePath));
        }

        return $keys;
    }

    /**
     * Mengubah array bertingkat menjadi format key yang lebih mudah dibandingkan.
     */
    private function flattenArrayKeys(array $array, string $prefix = ''): array
    {
        $keys = [];

        foreach ($array as $key => $value) {
            $fullKey = $prefix ? "$prefix.$key" : $key;

            if (is_array($value)) {
                $keys = array_merge($keys, $this->flattenArrayKeys($value, $fullKey));
            } else {
                $keys[$fullKey] = true;
            }
        }

        return $keys;
    }
}
