# Implementation Plan: Print Template PDF Export

## Overview

Menambahkan `PdfExportService` (wkhtmltopdf via `Symfony\Process` + fallback
`dompdf`), satu endpoint baru `POST /{model}/print/{printTemplate}/pdf` di
`Controller::printPdf()` yang menerima HTML hasil render client, dan tombol
"Download PDF" di `Core/Print.jsx`. Tidak ada perubahan pada logic render
Handlebars/`formatData` yang sudah ada — HTML dikirim apa adanya dari iframe
yang sudah jadi.

## Tasks

- [x] 1. Dependency & konfigurasi dasar
  - [x] 1.1 Install `barryvdh/laravel-dompdf` via composer
    - `composer require barryvdh/laravel-dompdf`
    - Publish config jika diperlukan (`php artisan vendor:publish`)
    - _Requirements: 2.1, 2.2, 4.4_

  - [x] 1.2 Tambah konfigurasi `WKHTMLTOPDF_BINARY_PATH`
    - Tambah entry di `config/services.php` (atau file config baru
      `config/pdf.php`): `'wkhtmltopdf_binary' => env('WKHTMLTOPDF_BINARY_PATH', storage_path('app/bin/wkhtmltopdf'))`
    - Tambah contoh di `.env.example`
    - _Requirements: 4.3_

  - [x] 1.3 Siapkan direktori binary
    - Buat `storage/app/bin/.gitignore` (ignore binary itu sendiri, jangan
      commit binary besar ke git; catat instruksi download di README singkat
      dalam folder yang sama, `storage/app/bin/README.md`)
    - _Requirements: 4.2_

- [x] 2. `PdfExportService`
  - [x] 2.1 Buat `app/Services/Core/PrintTemplate/PdfExportService.php`
    - Method `generate(string $html, PrintTemplate $template): string`
    - Method `protected tryWkhtmltopdf(string $html, PrintTemplate $template): ?string`
      - Cek `file_exists` + `is_executable` path binary; return `null` kalau
        tidak ada (supaya langsung fallback tanpa exception)
      - Tulis `$html` ke temp file (`storage/app/tmp/{uuid}.html`), hapus
        setelah proses selesai (`finally`)
      - Build argumen CLI dari `template->paper/orientation/width/height/
        margin_top/bottom/left/right/unit`: `--page-width`, `--page-height`,
        `--margin-top`, dst (pakai satuan mm, konversi dari unit template)
      - Tambah flag `--disable-local-file-access`
      - Jalankan via `Symfony\Component\Process\Process`, timeout 30 detik
      - Return isi file PDF output jika exit code 0, else `null`
    - Method `protected fallbackDompdf(string $html, PrintTemplate $template): string`
      - `Dompdf\Options` dengan `setIsRemoteEnabled(false)`,
        `setIsHtml5ParserEnabled(true)`
      - `setPaper()` dari dimensi template (mm → pt/inch sesuai kebutuhan
        dompdf) dan orientation
      - Return `$dompdf->output()`
    - `generate()`: panggil `tryWkhtmltopdf()`, jika `null` → log warning
      (`Log::warning('PDF export fallback to dompdf', [...])`) lalu panggil
      `fallbackDompdf()`
    - _Requirements: 1.3, 2.1, 2.2, 2.3, 3.4, 4.1, 4.2, 4.3, 4.4_

  - [x] 2.2 Write unit tests for `PdfExportService` (Fallback behavior)
    - **Fallback: dompdf dipanggil otomatis ketika binary wkhtmltopdf tidak ada di path**
    - Test: set `WKHTMLTOPDF_BINARY_PATH` ke path yang tidak ada, panggil
      `generate()`, assert hasil adalah PDF valid (cek magic bytes `%PDF-`)
      dan tidak melempar exception
    - **Timeout/exit-code failure: proses wkhtmltopdf gagal tetap fallback ke dompdf**
    - Test: mock `Process` agar exit code != 0, assert fallback terpakai
    - **Validates: Requirements 2.1, 2.2, 2.3**

- [x] 3. Checkpoint - Ensure `PdfExportService` tests pass
  - Jalankan `php artisan test --compact --filter=PdfExportService`
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Endpoint & routing
  - [x] 4.1 Tambah route `POST /{model}/print/{printTemplate}/pdf`
    - Di `routes/web.php`, sebaris dengan route `print` yang sudah ada
      (dekat baris ~77): `Route::post("/{{$name}}/print/{printTemplate}/pdf", 'printPdf')->name("$uri.print.pdf");`
    - _Requirements: 1.2_

  - [x] 4.2 Tambah method `Controller::printPdf()`
    - Di `app/Http/Controllers/Controller.php`, sibling dari method `print()`
      yang sudah ada
    - Validasi request: `html` required string, `max:5120` (KB, ~5MB)
    - Reuse permission: tambahkan `'printPdf' => 'print'` ke match
      `$keyPermission` di constructor (baris ~140), supaya permission check
      generic di constructor otomatis berlaku untuk method baru ini
    - Re-fetch `$data = $this->model::find($id)` dan `$printTemplate` dari DB
      (bukan percaya body request) untuk keperluan penamaan file
      (`docInfo`/`translateKey`)
    - Panggil `app(PdfExportService::class)->generate($request->html, $printTemplate)`
    - Return `response($pdfBytes, 200, ['Content-Type' => 'application/pdf', 'Content-Disposition' => 'attachment; filename="' . $filename . '.pdf"'])`
    - _Requirements: 1.2, 1.3, 1.4, 3.1, 3.2, 3.5_

  - [x] 4.3 Write feature test for `printPdf` endpoint (Authorization & response)
    - **Authorization: user tanpa permission 'print' pada model ditolak (403)**
    - Test: hit endpoint tanpa permission yang sesuai, assert status 403
    - **Response: user dengan permission valid menerima PDF binary**
    - Test: hit endpoint dengan permission valid + html sample, assert
      `Content-Type: application/pdf` dan body diawali `%PDF-`
    - **Payload limit: html melebihi batas ukuran ditolak**
    - Test: kirim html > batas max, assert validation error (422)
    - **Validates: Requirements 3.1, 3.2, 3.3**

- [x] 5. Checkpoint - Ensure endpoint tests pass
  - Jalankan `php artisan test --compact --filter=PrintPdf`
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Frontend: tombol Download PDF
  - [x] 6.1 Tambah tombol "Download PDF" di `resources/js/Pages/Core/Print.jsx`
    - Tempatkan di sebelah tombol "Print" existing (baris ~165-186), pakai
      pola `Button` + `Tooltip` yang sama
    - Handler `onClick`: ambil
      `frame.current.contentDocument.documentElement.outerHTML`, POST via
      `axios.post(route('...print.pdf', [id, template.id]), { html }, { responseType: 'blob' })`
    - Terima response blob, buat `URL.createObjectURL`, trigger download via
      anchor sementara dengan atribut `download`, lalu revoke object URL
    - Tampilkan loading state pada tombol selama request berjalan
    - _Requirements: 1.1, 1.2, 1.4_

  - [x] 6.2 Tangani error response di frontend
    - Jika request gagal (403/422/500), tampilkan toast/alert error tanpa
      menampilkan detail teknis mentah ke user
    - _Requirements: 2.4, 3.2_

- [x] 7. Final checkpoint - Ensure all tests pass
  - Jalankan `php artisan test --compact` (seluruh suite terkait) dan pastikan
    tidak ada regresi
  - Tanyakan ke user apakah ingin menjalankan full test suite project
  - Ensure all tests pass, ask the user if questions arise.
  - **Hasil**: `PdfExportServiceTest` (2 lulus) dan `PrintPdfControllerTest`
    (3 lulus) — semua test baru untuk fitur ini lulus. Full suite proyek
    (di luar scope PDF export) punya 22 test gagal yang **sudah gagal di
    baseline `dev-rahmad-5` sebelum perubahan apa pun** (diverifikasi via
    `git stash` + re-run) — pre-existing, bukan regresi dari task ini.

- [x] 8. Security fix: SSRF di `PdfExportService` (temuan post-implementasi)
  - Background security review menemukan HTML dari client bisa berisi
    `<img src="http://169.254.169.254/...">` atau URL internal lain — karena
    engine PDF (wkhtmltopdf/dompdf) jalan server-side dengan akses jaringan
    server, ini SSRF: attacker bisa paksa server fetch cloud metadata
    endpoint atau service internal yang seharusnya tidak exposed.
  - Tambah `PdfExportService::sanitizeRemoteUrls()` — parse HTML via
    `DOMDocument`, strip `src`/`href` pada `img/iframe/script/link/a` yang
    bukan `data:` URI atau host aplikasi sendiri (`config('app.url')`).
    Dipanggil di awal `generate()`, sebelum HTML diteruskan ke engine mana
    pun (wkhtmltopdf maupun fallback dompdf).
  - Tambah flag `--disable-javascript` dan `--disable-external-links` ke
    proses wkhtmltopdf sebagai lapisan tambahan.
  - Test baru: `test_sanitizes_remote_urls_to_prevent_ssrf` — verifikasi URL
    internal/metadata endpoint di-strip, sementara same-origin/`data:`/
    relative URL (dipakai logo letter head) tetap lolos.
  - _Requirements: 3.4_

- [x] 9. Security fix lanjutan: SSRF via CSS bypass (temuan review kedua)
  - Review keamanan lanjutan menemukan `sanitizeRemoteUrls()` versi pertama
    hanya cek attribute `src`/`href` DOM — CSS `background: url(...)` di
    `<style>` atau inline `style="..."` lolos sepenuhnya, jadi bypass yang
    valid untuk SSRF yang sama.
  - Perluas `sanitizeRemoteUrls()`: tambah cakupan tag
    (`object/embed/source/video/audio/image/use`) dan attribute
    (`data/poster/formaction/background/xlink:href`), drop `srcset` total
    (bisa berisi banyak URL, tidak diparse satu-satu).
  - Tambah `sanitizeCssUrls()` — strip `url(...)`/`@import` di dalam elemen
    `<style>` dan attribute `style=` inline, dipanggil dari
    `sanitizeRemoteUrls()` untuk kedua sumber tersebut.
  - Dicatat sebagai keterbatasan yang diterima di `design.md`: ini
    defense-in-depth di level parsing, bukan enforcement jaringan (network
    namespace/egress firewall) — kontrol jaringan semacam itu butuh akses
    infrastruktur yang tidak tersedia di shared hosting cPanel tanpa root.
  - Test baru: `test_sanitizes_remote_urls_inside_css` — verifikasi CSS
    `url()`, `@import`, inline `style=`, `poster`, `srcset` semua ke-strip
    dengan benar tanpa merusak style yang aman (mis. `color:red`).
  - _Requirements: 3.4_

## Notes

- Lint/Pint (`vendor/bin/pint --dirty --format agent`) dan ESLint HANYA
  dijalankan setelah seluruh task di atas selesai — bukan per task.
- Binary wkhtmltopdf tidak di-commit ke git (ukuran besar, environment-
  specific) — proses upload manual ke `storage/app/bin/` di server adalah
  langkah operasional terpisah dari task ini, didokumentasikan di
  `storage/app/bin/README.md` (task 1.3).
- Task 2 dan Task 4 bisa dikerjakan paralel oleh dua orang berbeda karena
  tidak saling bergantung secara langsung (service vs endpoint bisa
  dikembangkan dengan interface yang sudah disepakati di design.md), tapi
  checkpoint 3 tetap harus lulus sebelum lanjut ke 4 dalam alur sekuensial
  solo.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2"] },
    { "id": 3, "tasks": ["4.1", "4.2"] },
    { "id": 4, "tasks": ["4.3"] },
    { "id": 5, "tasks": ["6.1"] },
    { "id": 6, "tasks": ["6.2"] }
  ]
}
```
