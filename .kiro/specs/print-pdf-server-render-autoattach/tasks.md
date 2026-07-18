# Implementation Plan: Server-Side PDF Render + Auto-Attach

## Overview

Port render Handlebars + `formatData()` dari JS ke PHP
(`PrintTemplateRenderService`, helper-helper baru di `app/Services/Handlebar/`
— melengkapi `LabelHelperService` yang sudah ada tapi belum dipakai), lalu
sambungkan ke `PdfExportService` yang sudah ada untuk hasilkan PDF, dan
simpan sebagai lampiran (`PdfAttachmentService`) di dua titik: otomatis saat
`ApprovalInstanceController::approve()` mencapai status APPROVED, dan
manual di `Controller::printPdf()` yang sudah ada. Tidak ada perubahan pada
`PdfExportService`/`PrintPreview.jsx`/alur download manual existing selain
menambah langkah attach di akhir.

## Tasks

- [ ] 1. `zordius/lightncandy` + fondasi render service
  - [x] 1.1 Install `zordius/lightncandy` via composer
    - `composer require zordius/lightncandy`
    - _Requirements: 4.1_

  - [-] 1.2 Buat `App\Services\Core\PrintTemplate\PrintTemplateRenderService`
    - Method `render(Model $doc, PrintTemplate $template, array $columns): string`
    - Method `protected compileHandlebars(string $templateSource, array $context): string`
      menggunakan `LightnCandy::compile()` + `helpers` option untuk register
      semua helper (task 2)
    - Struktur mengikuti alur `PrintPreview.jsx`: kalau
      `!$template->is_letter_head && $template->letter_head`, render letter
      head dulu (html diganti `body`→`div`, css juga), lalu render dokumen
      utama (`body`→`main`), gabungkan
    - _Requirements: 4.1, 4.4_

- [x] 2. Port Handlebars helper ke `app/Services/Handlebar/`
  - [x] 2.1 Buat `RelationLinkHelperService` — port `convertTemplateLink()`
    - **Hasil investigasi**: `Utils::convertTemplateLink()` (`app/Utils.php:77`)
      sudah merupakan port lengkap dari fungsi JS yang sama — tidak perlu
      service baru, `PrintTemplateRenderService` reuse langsung
      `Utils::convertTemplateLink()` sebagai implementasi helper `relation`
    - _Requirements: 4.2_

  - [x] 2.2 Sambungkan `LabelHelperService` yang sudah ada (existing, belum
        dipakai) ke helper Handlebars `label`
    - `LabelHelperService::getLabel()` sudah port `resolveLabel()` +
      `_resolveFieldPath()`, diregistrasi sebagai helper Handlebars `label`
      di `PrintTemplateRenderService::helpers()` — tidak perlu port ulang
    - **Verifikasi**: `LabelHelperServiceTest.php` existing (14 test) sudah
      cover nested path, `nameOfFunction` (relasi), dan fallback formatting
      underscore/hyphen — cukup solid, tidak perlu test tambahan di level ini
    - _Requirements: 4.2_

  - [x] 2.3 Buat `FormatHelperService` — port `formatDate`, `formatCurrency`,
        `formatNumber`, `uppercase`
    - `formatDate`: pakai `Carbon`/`\DateTime`, mapping token `DD/MM/YYYY`
      sama seperti versi JS (`YYYY→Y`, `DD→d`, dst — sesuaikan ke token PHP
      `date()`/Carbon format)
    - `formatCurrency`, `formatNumber`: reuse logic pemisah ribuan/desimal
      gaya Indonesia (groupSeparator `.`, decimalSeparator `,`) — cek
      apakah ada helper PHP existing untuk format angka yang bisa dipakai
      ulang sebelum tulis baru
    - `CURRENCY_SYMBOLS` fallback table — copy tabel yang sama dari
      `initHandlebar.js`
    - _Requirements: 4.2, 4.3_

  - [x] 2.4 Buat `ArithmeticHelperService` — port `multiply`, `subtract`,
        `add`, `divide`
    - Port langsung (logic sederhana, coercion string→float, guard
      NaN/pembagian nol persis seperti versi JS)
    - _Requirements: 4.2_

  - [x] 2.5 Port helper sisa: `trans`, `companyDetail`, `each` (override),
        `infoColumns`
    - `trans`, `companyDetail`, `infoColumns` → diimplementasikan inline di
      `PrintTemplateRenderService::helpers()`
    - **Keputusan desain — `each` TIDAK di-override**: lightncandy compile
      `{{#each}}` sebagai block construct built-in, bukan helper biasa yang
      bisa ditimpa lewat array `helpers` (beda dari Handlebars.js JS yang
      mengizinkan override). Alih-alih override, `idx` (1-based) di-inject
      langsung ke tiap item array di dalam `formatData()` (task 4), sehingga
      template yang pakai `{{this.idx}}` di dalam `{{#each}}` tetap berfungsi
      tanpa bergantung pada override helper yang berisiko silent-fail.
    - _Requirements: 4.2_

  - [x] 2.6 Write unit tests for helper Handlebars (Format & Arithmetic)
    - **formatCurrency: format angka Indonesia dengan symbol currency**
    - Test: `formatCurrency(1000000, 'IDR')` → `"Rp 1.000.000,00"`,
      currency tidak dikenal → fallback ke kode sebagai symbol
    - **formatDate: konversi token format JS-style ke output benar**
    - Test: `formatDate('2026-01-15', 'DD/MM/YYYY')` → `"15/01/2026"`
    - **Arithmetic: multiply/subtract/add/divide dengan guard edge case**
    - Test: pembagian oleh nol → `0`, input non-numeric → fallback sesuai
      spek helper JS
    - **Validates: Requirements 4.2, 4.3**

- [x] 3. Checkpoint - Ensure helper Handlebars tests pass
  - Jalankan `php artisan test --compact --filter=HelperService`
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Port `formatData()` ke PHP
  - [x] 4.1 Tambah method `formatData()` di `PrintTemplateRenderService`
    - Port switch-case dari `PrintPreview.jsx`: `relation`, `relations`,
      `date`/`time`/`datetime` (pakai locale dari `opts.lang`), `boolean`
      (render `<input type='checkbox'>`), `formStatus` (translate via
      `status.{value}`), `string` (dengan `valueTrans`/`parse`),
      `currency`/`number` (dengan `resolveCurrencySymbol()`)
    - _Requirements: 4.3_

  - [x] 4.2 Port `resolveCurrencySymbol()` + `collectCurrencyCodes()` (sinkron)
    - Diimplementasikan sebagai `resolveCurrencySymbol()` +
      `resolveCurrencySymbols()` di `PrintTemplateRenderService` — query
      sinkron `Currency::whereIn('code', ...)->pluck('symbol', 'code')`
      (model `Currency` existing, primary key `code`, kolom `symbol`
      langsung tersedia — tidak perlu service tambahan)
    - _Requirements: 4.3_

  - [x] 4.3 Write unit tests for `formatData()` per tipe kolom
    - **Setiap tipe kolom (date/currency/number/boolean/formStatus/string)
      menghasilkan format yang sesuai ekspektasi**
    - Test: satu kasus representatif per tipe kolom, assert output string
      sesuai contoh manual yang diketahui benar
    - **Validates: Requirements 4.3**

- [x] 5. Checkpoint - Ensure `formatData()` + render service tests pass
  - Jalankan `php artisan test --compact --filter=PrintTemplateRenderService`
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. `PdfAttachmentService`
  - [x] 6.1 Buat `App\Services\Core\PrintTemplate\PdfAttachmentService`
    - **Catatan revisi**: signature final `attach(string $pdfBytes, Model
      $document, ?string $userId = null): File` — parameter `PrintTemplate
      $template` yang ada di design.md awal dihapus karena tidak ada logic
      yang membutuhkannya (nama file cukup dari `$document`); design.md
      diperbarui agar konsisten
    - Method `attach(string $pdfBytes, Model $document, PrintTemplate $template, ?int $userId = null): File`
    - `Storage::put()` ke disk yang sama dipakai `File::uploadFile()`
      (cek `filesystems.php` disk mana yang dipakai `$file->store('files')`)
    - `File::create([...])` manual — `name` pakai format
      `"{$documentLabel}-" . now()->format('YmdHis')`, `extension` = 'pdf',
      `mime_type` = 'application/pdf', `is_public` = false
    - `Fileable::create(['fileable_id' => $document->id, 'fileable_type' => get_class($document), 'file_id' => $file->id])`
    - _Requirements: 1.3, 2.1, 2.2, 3.1, 3.2_

  - [x] 6.2 Write feature test for `PdfAttachmentService`
    - **Catatan skema (dikoreksi setelah investigasi lebih lanjut)**: tabel
      `files` di migration (`2025_01_30_134342_create_files_table.php`)
      tidak memiliki kolom `lft/rgt/depth/parent_id` — kolom ini dibuat
      **dinamis di production** via `DataTable::initPermissions()` (dipicu
      oleh `TreeView::$is_tree_view = true`, dijalankan lewat
      `PermissionSeeder`/command init model, pola yang sama dipakai test
      lain seperti `BufferedAttachmentServiceTest`), bukan lewat migration
      statis — jadi ini BUKAN bug, hanya konvensi project. Kolom
      `created_by_id` (dipakai `PdfAttachmentService`) memang berasal dari
      migration asli dan sudah benar. Terpisah dari itu:
      `File::uploadFile()` existing menulis ke `'user_id'` yang tampak tidak
      cocok dengan kolom `created_by_id` di migration — kemungkinan
      inkonsistensi pre-existing di luar scope spec ini, tidak diperbaiki
      di sini.
    - **Fix nama file anti-collision**: format nama file diubah dari
      `{label}-{YmdHis}` (presisi detik) menjadi `{label}-{YmdHis_u}`
      (dengan microsecond) — dua PDF yang di-generate untuk dokumen sama
      dalam detik yang sama (mis. approve lalu langsung download manual)
      sebelumnya bisa menghasilkan nama file identik meski record berbeda.
    - **attach() membuat record File + Fileable baru setiap dipanggil**
    - Test: panggil `attach()` dua kali untuk dokumen sama, assert 2 record
      `File` berbeda (nama beda karena timestamp) + 2 record `Fileable`
      (tidak menimpa)
    - **Validates: Requirements 3.1, 3.2**

- [x] 7. Checkpoint - Ensure `PdfAttachmentService` tests pass
  - Jalankan `php artisan test --compact --filter=PdfAttachmentService`
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Integrasi trigger approve
  - [x] 8.1 Tambah method `attachGeneratedPdf()` di `ApprovalInstanceController`
    - Ditambah juga `resolveDocumentModel()` (helper baru) — resolve model
      dokumen dari `onApproved` method signature target controller via
      reflection, mereplikasi cara `callWithRouteModels()` sudah resolve
      parameter, tanpa memanggil `onApproved` itu sendiri (dipanggil
      terpisah setelahnya seperti alur asli)
    - Resolve `$documentModel` dari `$approval->options['parameters']`
      (pola sama seperti resolusi controller/parameters existing)
    - Query `PrintTemplate::where('model', get_class($documentModel))->where('is_default', true)->first()`
    - IF null → `Log::info(...)`, return tanpa attach
    - ELSE → `PrintTemplateRenderService::render()` →
      `PdfExportService::generate()` → `PdfAttachmentService::attach()`
    - Bungkus seluruh proses dalam try-catch luas, `Log::error()` pada
      exception apa pun, TIDAK melempar ulang (tidak boleh mengganggu
      response approve)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x] 8.2 Panggil `attachGeneratedPdf()` di `approve()` setelah `DB::commit()`
    - Di blok `if ($isApproved)`, setelah `$approval->save(); DB::commit();`
      dan sebelum `return $this->callWithRouteModels(...)`
    - _Requirements: 1.6_

  - [x] 8.3 Write feature test for auto-attach saat approval selesai
    - **Bug kritis ditemukan & diperbaiki**: `PrintTemplateRenderService::compileHandlebars()`
      memanggil `eval('?>' . $phpCode)` — prefix `?>` tanpa `<?php` di
      depannya salah untuk `eval()` (yang sudah otomatis dalam mode PHP;
      `?>` di situ justru membuat sisanya dibaca sebagai HTML literal),
      sehingga `$renderer` SELALU `null` dan setiap render selalu gagal
      diam-diam (tertangkap oleh try-catch luas di `attachGeneratedPdf()`,
      hanya terlihat di log). Diperbaiki jadi `eval($phpCode)` langsung +
      guard `is_callable($renderer)`. Bug ini tidak terdeteksi oleh test
      task 1-5 karena semuanya menguji `formatData()` lewat reflection,
      tidak pernah benar-benar memanggil `compileHandlebars()`/`render()`
      end-to-end — baru ketahuan lewat test approval ini yang pertama kali
      mengeksekusi jalur render lengkap.
    - Skema test `files` disesuaikan: karena test ini pakai `RefreshDatabase`
      (menjalankan migration asli), tabel `files` sudah ada sebelum
      `setUp()` custom berjalan — perlu `Schema::table()` untuk menambah
      kolom yang kurang, bukan `Schema::create()` yang di-skip diam-diam
      karena tabel sudah ada.
    - **Approval mencapai APPROVED → PDF ter-attach ke dokumen**
    - Test: setup `ApprovalInstance` dengan 1 step, approve, assert ada
      record `Fileable` baru untuk dokumen terkait dengan `File` bertipe
      `application/pdf`
    - **Approval gagal generate PDF → approval tetap APPROVED (tidak rollback)**
    - Test: mock `PdfExportService`/`PrintTemplateRenderService` agar
      melempar exception, assert `ApprovalInstance` tetap berstatus
      APPROVED (tidak ter-rollback) meski attach gagal
    - **Dokumen tanpa PrintTemplate default → approval selesai tanpa attach, tanpa error**
    - Test: approve dokumen dari model tanpa `PrintTemplate`, assert
      approval tetap APPROVED, tidak ada `Fileable` baru, tidak ada
      exception yang menggagalkan request
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6**

- [x] 9. Checkpoint - Ensure approve auto-attach tests pass
  - Jalankan `php artisan test --compact --filter=ApprovalInstance`
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Integrasi trigger manual (`printPdf`)
  - [x] 10.1 Tambah panggilan `PdfAttachmentService::attach()` di
        `Controller::printPdf()`
    - **Catatan**: import `Illuminate\Support\Facades\Log` bentrok dengan
      `App\Models\Core\Log` yang sudah diimport di file yang sama — diberi
      alias `LogFacade` untuk menghindari konflik nama
    - Setelah `$pdf = app(PdfExportService::class)->generate(...)`, sebelum
      `return response($pdf, ...)`
    - Bungkus try-catch — kegagalan attach TIDAK boleh menggagalkan
      response download PDF ke browser (Requirement 2.3: kontrak response
      tidak berubah)
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 10.2 Update/tambah test di `PrintPdfControllerTest` untuk verifikasi attach
    - **Download manual PDF → PDF juga ter-attach ke dokumen**
    - Test: hit endpoint `printPdf`, assert response tetap PDF binary
      (kontrak tidak berubah) DAN ada record `Fileable` baru
    - **Validates: Requirements 2.1, 2.2, 2.3**

- [x] 11. Final checkpoint - Ensure all tests pass
  - **Hasil**: 53 test spec ini lulus (Handlebar helpers, PrintTemplateRenderService,
    PdfAttachmentService, PrintPdfControllerTest, ApprovalPdfAutoAttachTest).
    9 test approval existing (`ApprovalAutoApproveTest`) tetap lulus — tidak
    ada regresi ke alur approval yang sudah ada. Pint bersih (1 file test
    diformat ulang). Tidak ada perubahan file JS/JSX di spec ini, ESLint
    tidak relevan dijalankan.
  - Jalankan `php artisan test --compact` untuk seluruh suite terkait
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Lint/Pint dan ESLint HANYA dijalankan setelah seluruh task selesai.
- Task 2 (port helper) adalah task dengan risiko terbesar untuk effort
  meleset — 14 helper, beberapa (`formatDate` dengan token mapping,
  `formatCurrency`/`formatNumber` dengan locale ID) butuh perhatian detail
  agar output PHP match dengan ekspektasi yang selama ini dilihat user di
  preview browser.
- `LabelHelperService` (task 2.2) sudah ada di `app/Services/Handlebar/`
  tapi belum dipakai di mana pun — konfirmasi dulu isinya masih relevan
  (belum stale/berbeda dari `resolveLabel()` JS saat ini) sebelum
  langsung reuse.
- Task 8 dan Task 10 saling independen (approve vs manual download) dan
  bisa dikerjakan paralel setelah Task 1-7 (fondasi render + attach)
  selesai.
- Tidak ada task "parity test JS vs PHP" sesuai keputusan di design.md —
  strategi testing adalah unit test per-sisi.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["2.1", "2.2", "2.3", "2.4", "2.5"] },
    { "id": 3, "tasks": ["2.6"] },
    { "id": 4, "tasks": ["4.1"] },
    { "id": 5, "tasks": ["4.2"] },
    { "id": 6, "tasks": ["4.3"] },
    { "id": 7, "tasks": ["6.1"] },
    { "id": 8, "tasks": ["6.2"] },
    { "id": 9, "tasks": ["8.1", "10.1"] },
    { "id": 10, "tasks": ["8.2", "10.2"] },
    { "id": 11, "tasks": ["8.3"] }
  ]
}
```
