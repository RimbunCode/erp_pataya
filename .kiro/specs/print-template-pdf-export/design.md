# Design Document: Print Template PDF Export

## Overview

Menambahkan kemampuan export dokumen print (halaman `Core/Print`) menjadi file
PDF yang di-generate di server, ditujukan untuk deployment di shared hosting
tanpa akses root, tanpa Node.js/Chromium, tapi dengan `exec()`/`proc_open()`
aktif.

Engine utama: **wkhtmltopdf** (static binary, dipanggil via `exec`/`Symfony
Process`) — dipilih karena CSS support (QtWebKit) jauh lebih dekat ke hasil
preview browser dibanding dompdf, dan sudah dikonfirmasi kompatibel dengan
environment target (x86_64, glibc 2.34, `exec` aktif).

**Fallback: dompdf** (`barryvdh/laravel-dompdf`) — pure-PHP, dipakai otomatis
kalau binary wkhtmltopdf tidak ditemukan/gagal dieksekusi (mis. provider
mencabut `exec()` di kemudian hari, atau shared library yang dibutuhkan
wkhtmltopdf hilang setelah upgrade OS oleh provider).

## Constraints (hasil investigasi)

- Server target: cPanel shared hosting, user `ptpsn`, `x86_64`, glibc 2.34.
- `exec`, `proc_open`, `shell_exec` tidak di-disable (`disable_functions` kosong).
- Tidak ada Node/npx/Chromium di server → Browsershot/Puppeteer tidak viable.
- Tidak ada akses root → binary wkhtmltopdf harus static build, di-upload
  manual ke direktori yang bisa dieksekusi user aplikasi (mis.
  `storage/app/bin/wkhtmltopdf` di dalam project, bukan `/home/ptpsn/bin/`
  supaya ikut ter-deploy/ter-version lewat repo atau deployment script, dan
  permission-nya terkontrol Laravel).
- wkhtmltopdf project sudah discontinued (tidak ada patch keamanan baru) —
  risiko diterima sesuai keputusan user, dengan dompdf sebagai fallback.

## Architecture

```
[Browser: Core/Print.jsx]
   │  user klik "Download PDF"
   │  (iframe PrintPreview sudah render HTML+CSS lengkap via Handlebars)
   ▼
[Client] ambil ref.current.contentDocument.documentElement.outerHTML
   │  POST { html, printTemplateId, docId } → /{model}/print/{printTemplate}/pdf
   ▼
[PrintPdfController@export]
   │  1. Authorize: reuse permission check yang sama dengan route print (guard 'print')
   │  2. Validate: html required string, batasi ukuran (mis. max 2MB)
   │  3. Sanitize: strip <script>, disable remote resource loading berbahaya
   ▼
[PdfExportService]
   │  coba wkhtmltopdf dulu →
   │     - tulis HTML ke temp file (storage/app/tmp)
   │     - Symfony Process: exec binary + args (page size, margin, orientation
   │       dari template->paper/orientation/margin_*)
   │     - baca stdout / output file PDF
   │  kalau exception / binary not found / exit code != 0 →
   │     - fallback: Dompdf::loadHTML($html)->output()
   ▼
[Response] PDF stream, Content-Disposition: attachment, filename dari
   docInfo/template name
```

## Components and Interfaces

### 1. Binary wkhtmltopdf
- Lokasi: `storage/app/bin/wkhtmltopdf` (di luar `public/`, tidak
  web-accessible; permission `chmod +x` saat deploy).
- Config path via `.env`: `WKHTMLTOPDF_BINARY_PATH`, default ke lokasi di atas.
- Tidak ditambahkan ke composer — binary di-download manual sekali dan
  di-commit ke repo (atau disiapkan lewat deployment script), karena tidak
  ada package manager PHP untuk binary.

### 2. `App\Services\Core\PrintTemplate\PdfExportService`
```php
class PdfExportService
{
    public function generate(string $html, PrintTemplate $template): string; // return raw PDF bytes

    protected function sanitizeRemoteUrls(string $html): string;
    protected function isAllowedResourceUrl(string $url, ?string $appHost): bool;
    protected function tryWkhtmltopdf(string $html, PrintTemplate $template): ?string;
    protected function fallbackDompdf(string $html, PrintTemplate $template): string;
}
```
- Map `template->paper/orientation/width/height/margin_*` ke argumen CLI
  wkhtmltopdf (`--page-size`, `--orientation`, `--margin-top`, dst) sekaligus
  jadi opsi dompdf (`Dompdf\Options` + `setPaper()`).
- Log (level `warning`) setiap kali fallback ke dompdf terpakai, supaya bisa
  dipantau kalau wkhtmltopdf berhenti berfungsi di server.
- **SSRF mitigation**: `generate()` memanggil `sanitizeRemoteUrls()` di awal,
  sebelum HTML diteruskan ke engine mana pun. Method ini parse HTML via
  `DOMDocument`, lalu strip URL yang tidak menunjuk ke `data:` URI atau ke
  host aplikasi sendiri (`config('app.url')`), dari:
  - Attribute `src/href/data/poster/formaction/background/xlink:href` pada
    tag `img/iframe/script/link/a/object/embed/source/video/audio/image/use`
    (`srcset` di-drop total, bukan di-parse, karena bisa berisi banyak URL).
  - CSS `url(...)` dan `@import` di dalam elemen `<style>` maupun attribute
    inline `style="..."` (`sanitizeCssUrls()`), lewat regex atas seluruh isi
    CSS — celah ini ditemukan oleh review keamanan lanjutan setelah versi
    pertama (yang hanya cek attribute DOM) diverifikasi bisa di-bypass lewat
    `style="background:url(...)"`.
  - Ini mencegah HTML yang dikirim client memaksa wkhtmltopdf/dompdf
    melakukan request keluar dari server (mis. ke cloud metadata endpoint
    `169.254.169.254` atau service internal) — karena HTML sepenuhnya
    client-controlled, engine PDF tidak boleh dipercaya untuk fetch resource
    sembarang. Wkhtmltopdf juga dijalankan dengan `--disable-javascript` dan
    `--disable-external-links` sebagai lapisan tambahan.
  - **Keterbatasan yang diterima**: ini adalah defense-in-depth di level
    parsing HTML/CSS, bukan enforcement di level jaringan (network
    namespace/egress firewall) yang idealnya jadi kontrol utama untuk SSRF.
    Isolasi jaringan semacam itu butuh akses infrastruktur (iptables,
    network namespace, proxy egress) yang **tidak tersedia di shared
    hosting cPanel tanpa root** — target deployment utama fitur ini. Risiko
    residual: whitelist attribute/tag ini bisa jadi tidak lengkap kalau ada
    vektor baru yang belum tercakup (mis. tag/attribute non-standar,
    parser CSS yang lebih kompleks dari sekadar regex `url(...)`).

### 3. Endpoint baru
- Route: `POST /{model}/print/{printTemplate}/pdf` → nama
  `"$uri.print.pdf"`, ditambahkan bersebelahan dengan route `print` yang
  sudah ada di `routes/web.php` (baris ~77).
- Controller: method baru `Controller::printPdf(Request $request, mixed $id,
  PrintTemplate $printTemplate)` di `app/Http/Controllers/Controller.php`
  (sibling dari method `print()` yang sudah ada), reuse permission key
  `'print'` yang sama (lihat `keyPermission` match di constructor).
- Request: `html` (string, required), dikirim dari client setelah iframe
  selesai render — **bukan** re-render ulang di server, supaya WYSIWYG dan
  tidak duplikasi logic `formatData`/Handlebars yang sudah ada di
  `PrintPreview.jsx`.
- Server tetap re-fetch `$data`/`$printTemplate` dari DB by ID (bukan percaya
  data dari client) untuk keperluan authorization dan penamaan file; hanya
  markup HTML yang dipercaya berasal dari client.

### 4. Security
- Endpoint mewarisi permission gate yang sama dengan `print()` (guard
  `'print'`), jadi hanya user yang punya akses lihat dokumen tsb yang bisa
  generate PDF-nya.
- wkhtmltopdf dijalankan dengan flag `--disable-external-links
  --disable-javascript --no-images` **tidak** dipakai secara blanket (butuh
  gambar logo letterhead) — sebagai gantinya batasi lewat
  `--disable-local-file-access` agar tidak bisa baca file lokal server lewat
  `<img src="file://...">` yang disisipkan ke `html` oleh client.
- Dompdf: set `Options::setIsRemoteEnabled(false)` dan
  `setIsHtml5ParserEnabled(true)`; kalau butuh logo dari URL, whitelist domain
  tertentu saja (bukan enable remote penuh).
- Validasi ukuran payload `html` (mis. max 2–5 MB) untuk cegah DoS via body
  besar.
- Tidak expose path/isi command error mentah ke response client (log
  internal saja).

### 5. Frontend (`resources/js/Pages/Core/Print.jsx`)
- Tombol baru "Download PDF" di sebelah tombol "Print" existing (baris
  ~165-186).
- Handler: ambil `ref.current.contentDocument.documentElement.outerHTML`,
  kirim via `axios.post` (atau Inertia `router.post` dengan opsi non-Inertia
  response / `window.open` ke blob) ke route baru, terima response PDF
  sebagai blob, trigger download (`URL.createObjectURL` + anchor
  `download` attribute) — bukan Inertia visit, supaya response biner tidak
  diproses sebagai halaman Inertia.

## Data Flow Detail

1. User buka halaman print (`Core/Print.jsx`), `PrintPreview` render iframe
   seperti sekarang (tidak berubah).
2. User klik "Download PDF".
3. Client ambil HTML lengkap dari iframe (`outerHTML`, termasuk `<head>`
   dengan `<style>` dan link Bootstrap CDN yang sudah di-inject
   `PrintPreview.jsx`).
4. POST ke endpoint baru dengan `{ html }`.
5. Server jalankan `PdfExportService::generate()`:
   - Tulis HTML ke file temp.
   - Jalankan wkhtmltopdf via `Symfony\Component\Process\Process`, timeout
     wajar (mis. 30 detik), tangkap exit code.
   - Jika gagal → dompdf.
6. Return `response($pdfBytes, 200, ['Content-Type' => 'application/pdf',
   'Content-Disposition' => 'attachment; filename="..."'])`.

## Alternatives Considered

- **Browsershot/Puppeteer**: ditolak — server tidak punya Node/Chromium,
  tidak bisa diinstall (no root).
- **Server re-render HTML dari nol (port Handlebars+formatData ke PHP)**:
  ditolak untuk versi ini — effort besar, risiko divergensi hasil PDF vs
  preview browser. Bisa dipertimbangkan lagi kalau ke depan butuh generate
  PDF tanpa browser (mis. dari job terjadwal/email otomatis).
- **Dompdf sebagai engine utama**: ditolak sebagai primary — CSS
  support lemah untuk flexbox/grid yang dipakai template GrapesJS. Tetap
  dipakai sebagai fallback karena tidak butuh dependency eksternal.

## Open Questions / TODO

- [TODO: konfirmasi] Nama tombol & UX: PDF didownload langsung, atau dibuka
  tab baru dulu (preview) baru user save?
- [TODO: konfirmasi] Apakah perlu opsi "generate PDF" dari halaman lain
  (mis. tombol di `Show.jsx` / list dokumen), atau cukup dari halaman
  `Core/Print` saja untuk versi pertama?
- [TODO: konfirmasi] Sumber & lisensi binary wkhtmltopdf yang akan dipakai
  (official release `wkhtmltopdf/packaging` `0.12.6.1-2`, `generic-linux-
  amd64`), dan siapa yang bertanggung jawab upload/update binary ke server.
