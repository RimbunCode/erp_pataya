<?php

namespace Tests\Feature\Core;

use App\Services\Core\ManualBookService;
use Illuminate\Support\Facades\File;
use Tests\TestCase;

/**
 * Menjaga konsistensi gambar/screenshot Manual Book: setiap gambar yang dirujuk
 * dari file markdown benar-benar ada di disk pada path yang tepat, penamaan
 * folder section konsisten (huruf kecil), dan file panduan penulisan tidak
 * ikut terdaftar sebagai section yang dirender.
 */
class ManualBookImageTest extends TestCase {
    private string $docsPath;
    private string $imagesPath;

    protected function setUp(): void {
        parent::setUp();

        $this->docsPath   = config('manual_book.docs_path');
        $this->imagesPath = $this->docsPath . DIRECTORY_SEPARATOR . 'images';
    }

    public function test_penjualan_section_renders_img_with_absolute_manual_book_path(): void {
        $rendered = (new ManualBookService)->renderSection('sales');

        $this->assertNotNull($rendered);
        $this->assertStringContainsString(
            '<img src="/manual-book-images/penjualan/',
            $rendered['content_html'],
            'Section penjualan seharusnya memuat minimal satu <img> dengan path absolut manual-book-images.',
        );
    }

    public function test_readme_penulisan_is_not_registered_as_section(): void {
        $sources = collect(config('manual_book.sections'))
            ->pluck('source')
            ->all();

        $this->assertNotContains(
            'README-penulisan.md',
            $sources,
            'README-penulisan.md tidak boleh terdaftar sebagai source section (tidak dirender ke halaman).',
        );

        $service = new ManualBookService;
        $this->assertNull($service->renderSection('readme-penulisan'));
        $this->assertNull($service->renderSection('README-penulisan'));
    }

    public function test_all_referenced_images_exist_on_disk(): void {
        $markdownFiles = File::glob($this->docsPath . DIRECTORY_SEPARATOR . '*.md');
        $missing       = [];

        foreach ($markdownFiles as $file) {
            $content = File::get($file);
            $name    = basename($file);

            preg_match_all(
                '#/manual-book-images/([A-Za-z0-9._/-]+\.png)#',
                $content,
                $matches,
            );

            foreach ($matches[1] as $relativePath) {
                $absolute = $this->imagesPath . DIRECTORY_SEPARATOR
                    . str_replace('/', DIRECTORY_SEPARATOR, $relativePath);

                if (! File::exists($absolute)) {
                    $missing[] = "{$name} merujuk /manual-book-images/{$relativePath} yang tidak ada di disk.";
                }
            }
        }

        $this->assertSame([], $missing, implode("\n", $missing));
    }

    public function test_image_section_folders_are_lowercase(): void {
        if (! File::isDirectory($this->imagesPath)) {
            $this->markTestSkipped('Folder docs/manual-book/images belum ada.');
        }

        $offenders = collect(File::directories($this->imagesPath))
            ->map(fn (string $dir) => basename($dir))
            ->filter(fn (string $name) => $name !== mb_strtolower($name))
            ->values()
            ->all();

        $this->assertSame(
            [],
            $offenders,
            'Nama subfolder gambar harus huruf kecil: ' . implode(', ', $offenders),
        );
    }
}
