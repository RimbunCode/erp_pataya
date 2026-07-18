# Design Document: Server-Side PDF Render + Auto-Attach

## Overview

Fitur lanjutan dari [[print-template-pdf-export]]: PDF hasil print template
secara otomatis tersimpan sebagai lampiran (`Fileable`) pada dokumen sumber
(Sales Order, Purchase Order, dll), dipicu di dua titik:

1. **Otomatis** — saat dokumen selesai melalui seluruh alur approval
   (`ApprovalInstanceController::approve()`, saat `$isApproved === true`).
2. **Manual** — saat user menekan tombol "Download PDF" di halaman print
   (`Core/Print.jsx`), selain tetap mengunduh file ke browser seperti
   sekarang.

Nama file lampiran diberi timestamp (`{doc-name}-{YmdHis}.pdf`) agar setiap
generate ulang tidak menimpa lampiran sebelumnya — riwayat PDF per dokumen
terjaga (mis. PDF sebelum vs sesudah revisi/amend).

## Constraint Kunci — Kenapa Ini Bukan Sekadar "Tambah Panggilan Fungsi"

Alur PDF export yang sudah ada (`PdfExportService`, spec
[[print-template-pdf-export]]) **sengaja** didesain agar HTML datang dari
client: browser merender `PrintPreview.jsx` (Handlebars compile +
`formatData()`) di dalam iframe, lalu `outerHTML`-nya di-POST ke server
untuk dikonversi jadi PDF. Desain ini dipilih waktu itu justru untuk
**menghindari** duplikasi logic render antara JS (preview) dan PHP (PDF).

Trigger approve terjadi di **backend murni** — `ApprovalInstanceController`
adalah controller biasa yang dieksekusi lewat HTTP request approve/reject,
tidak ada browser/iframe yang bisa dipanggil untuk merender HTML. Maka
auto-attach saat approve **mewajibkan** kemampuan merender print template
menjadi HTML sepenuhnya di server — tidak ada jalan lain tanpa
browser-in-the-loop (headless browser sudah ditolak di spec sebelumnya
karena shared hosting tidak punya Node/Chromium).

Ini artinya scope pekerjaan ini adalah **port penuh** dari:
- Handlebars template compilation (14 custom helper — lihat bawah)
- `formatData()` — switch-case formatting per tipe kolom (relation, date,
  time, datetime, boolean, formStatus, string+valueTrans/parse,
  currency/number)
- `resolveLabel()`, `convertTemplateLink()`, dan dependency turunannya

...dari JavaScript (`resources/js/lib/initHandlebar.js`,
`resources/js/Pages/Core/Components/PrintPreview.jsx`) ke PHP murni.

**Risiko yang diterima secara sadar**: dua implementasi paralel (JS untuk
preview browser, PHP untuk render server saat approve) akan cenderung
divergen dari waktu ke waktu — bug fix atau fitur baru di satu sisi tidak
otomatis tercermin di sisi lain kecuali secara disiplin di-port ulang setiap
kali. Ini adalah trade-off yang sudah pernah dibahas dan sebelumnya dihindari
(lihat [[print-template-pdf-export]] design.md bagian "Alternatives
Considered"), namun sekarang tidak terhindarkan karena kebutuhan trigger
otomatis di backend.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Trigger 1: Approve (backend murni, tanpa browser)             │
│                                                                 │
│ ApprovalInstanceController::approve()                         │
│   $isApproved === true                                        │
│   ↓                                                            │
│ PrintDocumentPdfAttachService::attachFromApproval($approval)  │
│   1. Resolve model dokumen + PrintTemplate default            │
│   2. PrintTemplateRenderService::render($doc, $template)      │
│      → HTML lengkap (PHP-side Handlebars + formatData)        │
│   3. PdfExportService::generate($html, $template)  (existing) │
│   4. simpan ke storage + Fileable::create(...)                 │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Trigger 2: Manual "Download PDF" (browser tetap terlibat)      │
│                                                                 │
│ Core/Print.jsx → handleDownloadPdf()                           │
│   HTML dari iframe (client-rendered, seperti sekarang)         │
│   ↓ POST /{model}/print/{printTemplate}/pdf                    │
│ Controller::printPdf()                                         │
│   1. PdfExportService::generate($html, $template)  (existing) │
│   2. simpan ke storage + Fileable::create(...)  ← BARU         │
│   3. return response($pdf, ...)  (tetap download ke browser)  │
└─────────────────────────────────────────────────────────────┘
```

Kedua trigger berujung pada langkah "simpan + attach" yang sama — diekstrak
jadi satu helper bersama agar tidak duplikasi:

```php
App\Services\Core\PrintTemplate\PdfAttachmentService::attach(
    string $pdfBytes,
    Model $document,
    ?string $userId = null,
): File
```

## Components and Interfaces

### 1. `App\Services\Core\PrintTemplate\PrintTemplateRenderService` (BARU)

Port dari `PrintPreview.jsx` + `initHandlebar.js`. Tanggung jawab: terima
model dokumen + `PrintTemplate`, kembalikan HTML lengkap — setara dengan
apa yang saat ini dihasilkan `PrintPreview.jsx` di browser.

```php
class PrintTemplateRenderService
{
    public function render(Model $doc, PrintTemplate $template, array $columns): string;

    protected function formatData(array $data, array $columns, array $opts): array; // port formatData()
    protected function compileHandlebars(string $template, array $context): string; // via lightncandy
}
```

- **Handlebars engine**: `zordius/lightncandy` (compiler Handlebars→PHP,
  paling matang di ekosistem PHP). Custom helper diregistrasi via API
  `helpers` milik lightncandy — satu per satu, port manual dari
  `initHandlebar.js`:
  - `relation` → port `convertTemplateLink()`
  - `label` → port `resolveLabel()` + `_resolveFieldPath()`
  - `trans`, `companyDetail`, `each` (custom override), `infoColumns`
  - `formatDate`, `formatCurrency`, `formatNumber`, `uppercase`
  - `multiply`, `subtract`, `add`, `divide`
- **`formatData()`**: port 1:1 dari switch-case di `PrintPreview.jsx`
  (`relation`, `relations`, `date/time/datetime`, `boolean`, `formStatus`,
  `string` dengan `valueTrans`/`parse`, `currency/number` dengan
  `resolveCurrencySymbol()` + `formatNumber()` PHP-side).
- **Currency symbol resolution**: `resolveCurrencySymbol()` dan
  `collectCurrencyCodes()` dari `PrintPreview.jsx` perlu versi PHP — di JS
  ini fetch async (`getCurrencyConfig`); di PHP harus jadi query sinkron ke
  tabel currency.
- Letter head (`template.letter_head`) di-render dengan cara sama seperti
  dokumen utama — dua pemanggilan `compileHandlebars()` digabung, sama
  seperti `html = letterHeadHtml + mainHtml` di `PrintPreview.jsx`.

### 2. `App\Services\Core\PrintTemplate\PdfAttachmentService` (BARU)

```php
class PdfAttachmentService
{
    public function attach(string $pdfBytes, Model $document, PrintTemplate $template): File;
}
```

- Simpan `$pdfBytes` via `Storage::put()` ke disk `files` (path sama dengan
  yang dipakai `File::uploadFile()`, mis. `files/{uuid}.pdf`).
- `File::create([...])` manual (bukan `uploadFile()`, karena itu hanya
  menerima `UploadedFile` dari request) — isi `name`, `path`, `extension`
  ('pdf'), `mime_type` ('application/pdf'), `user_id` (approver atau user
  yang klik download; untuk trigger approve pakai `Auth::user()->id`),
  `is_public` (default false).
- **Nama file dengan timestamp**: `"{$documentLabel}-" . now()->format('YmdHis') . '.pdf'`
  — mencegah overwrite; setiap generate ulang jadi record `File` baru,
  bukan update record lama.
- `Fileable::create(['fileable_id' => $document->id, 'fileable_type' =>
  get_class($document), 'file_id' => $file->id])`.

### 3. Integrasi di `ApprovalInstanceController::approve()`

Di dalam blok `if ($isApproved)` (Controller.php sekitar baris 238-249),
setelah `$approval->save()` dan `DB::commit()` (attachment adalah efek
samping non-transaksional — kegagalan generate PDF tidak boleh membatalkan
approval yang sudah tercatat):

```php
if ($isApproved) {
    $approval->fill(['status' => FormStatus::APPROVED]);
    $approval->save();
    DB::commit();

    $this->attachGeneratedPdf($approval); // BARU, try-catch + log, tidak melempar ke caller

    return $this->callWithRouteModels(...);
}
```

`attachGeneratedPdf()` resolve model dokumen dari `$approval->options`
(pola sama seperti resolusi `$controller`/`parameters` yang sudah ada),
ambil `PrintTemplate` default untuk model tsb, render, generate PDF, attach.
Dibungkus try-catch luas + `Log::error()` — kegagalan PDF generation tidak
boleh membuat approval gagal/rollback, karena dari sudut pandang bisnis
approval sudah sah terjadi terlepas dari berhasil-tidaknya lampiran PDF.

### 4. Integrasi di `Controller::printPdf()` (MODIFIKASI, existing)

Setelah `PdfExportService::generate()` menghasilkan `$pdf`, sebelum
`return response(...)`:

```php
app(PdfAttachmentService::class)->attach($pdf, $data, $printTemplate);

return response($pdf, 200, [...]); // tetap seperti sekarang
```

Tidak mengubah kontrak endpoint — response ke browser tetap PDF stream
untuk diunduh; attach adalah efek samping tambahan.

## Data Flow Detail (Trigger Approve)

1. User klik "Approve" di UI approval → `ApprovalInstanceController::approve()`.
2. Jika ini step approval terakhir (`$isApproved`), approval status jadi
   `APPROVED`, transaksi di-commit.
3. `attachGeneratedPdf($approval)`:
   a. Resolve `$documentModel` dari `$approval->options['parameters']`.
   b. Query `PrintTemplate::where('model', get_class($documentModel))->where('is_default', true)->first()`.
   c. Jika tidak ada template default → skip attach, log info (bukan error
      — dokumen tanpa print template dikonfigurasi adalah kondisi valid).
   d. `PrintTemplateRenderService::render($documentModel, $template, $columns)` → HTML.
   e. `PdfExportService::generate($html, $template)` → PDF bytes (reuse
      service yang sudah ada, termasuk sanitasi SSRF yang sudah dibangun).
   f. `PdfAttachmentService::attach($pdf, $documentModel, $template)`.
4. Response approve tetap seperti sekarang (`callWithRouteModels` →
   redirect/back) — attach tidak mempengaruhi response ke user.

## Security

- HTML yang dirender di titik approve **sepenuhnya server-generated** dari
  data model + template tersimpan — bukan dari input client saat request
  approve, sehingga tidak membawa risiko SSRF baru dari user di titik ini.
  Namun `PrintTemplate.html`/`css`/`letter_head` sendiri adalah konten yang
  disimpan admin lewat editor print template — bila kelak editor
  mengizinkan sembarang HTML/CSS dari role non-trusted, sanitasi yang sama
  (`PdfExportService::sanitizeRemoteUrls()`) tetap berlaku karena dipanggil
  di dalam `generate()`.
- Trigger manual (`printPdf()`) sudah punya proteksi permission `'print'`
  yang sama; attach tidak menambah permission baru — siapa pun yang boleh
  generate PDF dari dokumen tsb otomatis boleh attach-nya (bukan permission
  terpisah).
- File PDF hasil attach disimpan `is_public = false` secara default —
  mengikuti kontrol akses file existing (`Fileable`/`File` model), tidak
  otomatis bisa diakses publik.

## Alternatives Considered

- **Headless browser (Browsershot/Puppeteer) untuk render saat approve**:
  ditolak — alasan sama seperti spec sebelumnya, shared hosting tidak
  punya Node/Chromium dan tidak bisa install (no root).
  [[print-template-pdf-export]]
- **Attach hanya manual, skip trigger approve**: lebih sederhana (tidak
  perlu port Handlebars sama sekali — cukup modifikasi `printPdf()` untuk
  juga attach), tapi tidak memenuhi kebutuhan eksplisit user bahwa PDF
  harus otomatis ter-attach saat dokumen approve.
- **Event Laravel (`DocumentApproved`) alih-alih pemanggilan langsung**:
  dipertimbangkan untuk kerapian arsitektur, namun project ini **tidak
  punya sistem Event/Listener sama sekali** (dikonfirmasi lewat investigasi
  — `app/Events`, `app/Listeners` kosong). Menambahkan event system baru
  untuk satu fitur ini dianggap scope creep di luar kebutuhan; pemanggilan
  langsung `attachGeneratedPdf()` di `approve()` konsisten dengan pola
  `callWithRouteModels()` yang sudah dipakai project untuk hal serupa.

## Keputusan yang Sudah Dikonfirmasi

- **Dokumen tanpa `PrintTemplate` default**: skip attach secara diam-diam,
  log info (bukan error) — konsisten dengan behavior `Controller::print()`
  existing yang juga toleran terhadap `printTemplate` null.
- **Strategi testing untuk `PrintTemplateRenderService`**: unit test
  per-sisi (PHP-only), **bukan** parity test formal terhadap render JS.
  Setiap helper Handlebars hasil port (`formatCurrency`, `formatDate`,
  `formatNumber`, dst) dan `formatData()` diuji dengan assert terhadap
  nilai ekspektasi yang diketahui benar (mis. `formatCurrency(1000000,
  'IDR')` → `"Rp 1.000.000,00"`), sama seperti pola unit test JS yang
  sudah ada untuk fungsi setara di frontend — bukan dengan menjalankan
  browser headless dan membandingkan output byte-demi-byte terhadap PHP.
  Alasan: parity test formal butuh browser di CI (kembali ke masalah
  ketiadaan Node/Chromium yang sudah jadi constraint utama spec ini) dan
  HTML dari dua engine nyaris tidak akan byte-identik (perbedaan
  normalisasi whitespace/atribut), sehingga assertion-nya sendiri akan
  rapuh dan mahal dirawat. Risiko divergensi JS vs PHP dari waktu ke waktu
  **diterima secara sadar** (lihat bagian Overview) — dimitigasi lewat
  disiplin at commit-time (PR yang mengubah satu sisi memicu review manual
  sisi lain), bukan lewat automated cross-check.
