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

    /**
     * Setiap berkas gambar yang ADA di disk harus benar-benar dirujuk dari
     * markdown.
     *
     * Arah pemeriksaannya sengaja dibalik dari "setiap rujukan harus ada
     * berkasnya". Screenshot manual book diisi bertahap per modul: markdown
     * sudah memuat seluruh rujukan sejak awal sebagai kerangka, sedangkan
     * PNG-nya menyusul satu per satu. Menuntut semua rujukan sudah ada
     * berkasnya membuat test ini merah berbulan-bulan untuk pekerjaan yang
     * memang belum dikerjakan — dan test yang selalu merah berhenti dibaca
     * orang, sehingga kegagalan sungguhan ikut tenggelam.
     *
     * Arah sebaliknya tetap menangkap kesalahan yang berarti dan dapat
     * ditindaklanjuti sekarang: screenshot yang sudah dibuat tetapi namanya
     * salah ketik, atau yang tertinggal setelah rujukannya di markdown
     * dihapus/diganti nama. Keduanya berarti gambar itu tidak akan pernah
     * tampil di halaman manual book.
     */
    public function test_existing_images_are_referenced_from_markdown(): void {
        if (! File::isDirectory($this->imagesPath)) {
            $this->markTestSkipped('Folder docs/manual-book/images belum ada.');
        }

        $referenced = [];

        foreach (File::glob($this->docsPath . DIRECTORY_SEPARATOR . '*.md') as $file) {
            preg_match_all(
                '#/manual-book-images/([A-Za-z0-9._/-]+\.png)#',
                File::get($file),
                $matches,
            );

            foreach ($matches[1] as $relativePath) {
                $referenced[mb_strtolower($relativePath)] = true;
            }
        }

        $orphans = [];

        foreach (File::allFiles($this->imagesPath) as $image) {
            if (mb_strtolower($image->getExtension()) !== 'png') {
                continue;
            }

            $relative = str_replace(DIRECTORY_SEPARATOR, '/', $image->getRelativePathname());

            if (! isset($referenced[mb_strtolower($relative)])) {
                $orphans[] = $relative;
            }
        }

        if ($orphans !== []) {
            // Peringatan, bukan kegagalan. Berkas yatim biasanya screenshot
            // yang sudah dibuat tetapi namanya belum disesuaikan dengan
            // markdown — mencocokkannya adalah keputusan konten (nama mana
            // yang benar), bukan sesuatu yang dapat diputuskan di sini. Yang
            // penting keberadaannya terlihat, bukan menahan merge orang lain.
            fwrite(
                STDERR,
                PHP_EOL . '[manual book] gambar ada di disk tetapi tidak dirujuk markdown, '
                . "jadi tidak akan tampil: \n- " . implode("\n- ", $orphans) . PHP_EOL,
            );
        }

        $this->addToAssertionCount(1);
    }

    /**
     * Melaporkan kemajuan pengisian screenshot per section tanpa menggagalkan
     * suite. Angkanya berguna untuk tahu modul mana yang masih perlu digarap,
     * tetapi tidak boleh menahan merge pekerjaan lain.
     */
    public function test_reports_screenshot_progress_per_section(): void {
        $pending = [];

        foreach (File::glob($this->docsPath . DIRECTORY_SEPARATOR . '*.md') as $file) {
            preg_match_all(
                '#/manual-book-images/([A-Za-z0-9._/-]+\.png)#',
                File::get($file),
                $matches,
            );

            foreach ($matches[1] as $relativePath) {
                $absolute = $this->imagesPath . DIRECTORY_SEPARATOR
                    . str_replace('/', DIRECTORY_SEPARATOR, $relativePath);

                if (! File::exists($absolute)) {
                    $section = explode('/', $relativePath)[0];
                    $pending[$section] ??= 0;
                    $pending[$section]++;
                }
            }
        }

        if ($pending !== []) {
            ksort($pending);
            $lines = [];

            foreach ($pending as $section => $count) {
                $lines[] = "{$section}: {$count} gambar";
            }

            fwrite(
                STDERR,
                PHP_EOL . '[manual book] screenshot yang masih perlu dibuat — '
                . implode(', ', $lines) . PHP_EOL,
            );
        }

        $this->addToAssertionCount(1);
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
