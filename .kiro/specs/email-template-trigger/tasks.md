# Implementation Plan: Email Template Trigger

## Overview

Menambahkan tombol trigger manual "Kirim Email" di FormPage dokumen submitable, membuka dialog yang sepenuhnya editable (From Name, To/Cc/Bcc, Subject, Body, attachment) sebelum benar-benar mengirim. Backend menambah kolom `recipient_path` ke `email_templates`, endpoint `emailPreview`/`sendEmail` di base `Controller.php`, dan job baru `SendEmailWithPdfJob` yang menyatukan "generate PDF jika diminta dan belum ada" dengan "kirim email" dalam satu unit kerja queue — reuse pipeline `PrintTemplateRenderService`/`PdfExportService`/`PdfAttachmentService` dari proyek prasyarat (`print-pdf-server-render-autoattach`, sudah ter-rebase ke branch ini). Kegagalan generate PDF (kalau diminta) membatalkan seluruh job — email tidak terkirim, berbeda dari pola auto-attach-saat-approve yang selalu mentolerir kegagalan attachment. Frontend menambah komponen `EmailChipInput` (baru, chip-style multi-email) dan `EmailSendDialog`, diintegrasikan ke `FormPage.jsx` mengikuti pola tombol Print yang sudah ada. Backend dikerjakan dan diverifikasi dulu sebelum frontend, karena frontend bergantung pada kontrak response `emailPreview` dan payload `sendEmail`.

## Tasks

- [ ] 1. Kolom recipient_path dan picker-nya
  - [x] 1.1 Buat migration `add_recipient_path_to_email_templates_table`
    - Tambah kolom `recipient_path` string nullable setelah `body_json`
    - _Requirements: 1.1_

  - [x] 1.2 Tambah `recipient_path` ke `EmailTemplateRequest` (spec 1) dan `EmailTemplate::$guarded`/fillable behavior
    - Rule: `recipient_path` nullable string. Model pakai `$guarded = ['id']` (bukan `$fillable`), jadi `recipient_path` otomatis mass-assignable tanpa perubahan model
    - _Requirements: 1.1, 1.3_

  - [x] 1.3 Write feature test untuk recipient_path (extend `EmailTemplateCrudTest`)
    - Test: simpan EmailTemplate dengan `recipient_path` terisi → tersimpan benar; simpan tanpa `recipient_path` → tetap valid (opsional)
    - **Validates: Requirements 1.1, 1.3**
    - 10 passed (20 assertions) — seluruh `EmailTemplateCrudTest`, termasuk 2 test baru

- [x] 2. Checkpoint - Ensure recipient_path tests pass
  - `php artisan test --compact --filter=EmailTemplateCrudTest` → 10 passed.

- [ ] 3. Backend: Request, Controller, Job, Notification, Routes
  - [x] 3.1 Buat `App\Http\Requests\Core\EmailTemplateSendRequest`
    - Rules: `to` required+email, `cc`/`bcc` nullable array dengan `*` email, `from_name` nullable string, `subject`/`body` required string, `fileIds` nullable array dengan `*` exists:files,id, `include_pdf` nullable boolean
    - _Requirements: 3.4, 3.9, 4.4_

  - [x] 3.2 Tambah method `emailPreview()` dan `sendEmail()` di base `App\Http\Controllers\Controller`
    - `emailPreview()`: terima `?EmailTemplate $emailTemplate = null` (opsional, route model binding nullable). Compile via `EmailTemplateRenderService::render()` kalau `$emailTemplate` ada, else `['subject' => '', 'body' => '']`. Resolve `recipient` via `data_get($data, $emailTemplate->recipient_path)`, null-safe. Query `Fileable` existing dokumen (`is_generated_pdf` disertakan di tiap item), `hasGeneratedPdf`/`canOfferPdf` dihitung. `resolvedFields` — nilai aktual tiap kolom via `getColumns(2)` + `data_get()`, filter yang kosong.
    - `sendEmail()`: cuma dispatch `SendEmailWithPdfJob`, tidak memuat File/attachment di controller
    - Key permission `'emailPreview' => 'print'`, `'sendEmail' => 'print'` ditambah ke match statement `__construct()` (reuse key `print`, bukan key baru — konsisten `printPdf`)
    - _Requirements: 2.4, 2.5, 3.1, 3.2, 4.1, 4.3, 4.7, 5.1, 5.8_

  - [x] 3.3 Buat `App\Jobs\Core\SendEmailWithPdfJob`
    - Constructor terima primitif serializable: `modelClass`, `documentId`, `to`, `cc`, `bcc`, `subject`, `body`, `fileIds`, `includePdf`, `fromName` (bukan objek Model — `ShouldQueue` butuh payload serializable, resolve ulang model di `handle()`)
    - `handle()`: kalau `includePdf` true — cek `Fileable::where(...)->where('is_generated_pdf', true)->latest()->first()`; kalau ada, tambahkan `file_id`-nya ke daftar attachment; kalau tidak ada, cari `PrintTemplate::where('model', ...)->where('is_default', true)->firstOrFail()` (sengaja `firstOrFail`, bukan null-check manual — biar exception otomatis menggagalkan job), lalu `PrintTemplateRenderService::render()` → `PdfExportService::generate()` → `PdfAttachmentService::attach()`, tambahkan file barunya ke daftar attachment
    - **Sengaja TIDAK ada try-catch mengelilingi blok generate PDF** — exception harus menggagalkan job secara utuh (lihat Correctness Property 4 design.md)
    - Resolve seluruh `fileIds` (existing + PDF baru kalau ada) jadi array `{path, name}`, panggil `app(MailChannel::class)->send()` dengan notifiable anonim `{email: $to, cc: $cc, bcc: $bcc}` dan `EmailTemplateSendNotification`
    - `failed(Throwable $e)`: `Log::error()` dengan konteks lengkap (model, documentId, to, includePdf, pesan error)
    - _Requirements: 4.5, 4.6, 5.1, 5.5, 5.6, 5.7_

  - [x] 3.4 ~~Tambah method `sendEmail()`~~ — sudah dikerjakan bersamaan dengan 3.2 (satu perubahan atomik di `Controller.php`)
    - `sendEmail()` HANYA dispatch `SendEmailWithPdfJob::dispatch(...)`, tidak memuat File/attachment di controller. Return `back()->with('success', __('core.emailTemplate.send.queued'))`
    - _Requirements: 5.1, 5.8_

  - [x] 3.5 Buat `App\Notifications\EmailTemplateSendNotification`
    - Constructor: `subject`, `body`, `attachments = []`, `fromName = null`
    - `toMail()`: subject, view `mail.email-template` (reuse spec 1), `from()` custom kalau `$fromName` ada (alamat TETAP dari `config('mail.from.address')`, tidak pernah dari input), `cc()`/`bcc()` dari `$notifiable`, `attach()` tiap attachment
    - _Requirements: 5.3_

  - [x] 3.6 Daftarkan route di `routes/web.php` (macro `resourceDetail`, blok `$isSubmmitable`, sejajar `print`/`printPdf` — berlaku ke SEMUA model submitable, bukan spesifik EmailTemplate)
    - `GET /{plural}/{id}/email/{emailTemplate?}` → `emailPreview` (nama `{plural}.email.preview`)
    - `POST /{plural}/{id}/email` → `sendEmail` (nama `{plural}.email.send`)
    - Key permission sudah ditambah di task 3.2 (`'emailPreview' => 'print'`, `'sendEmail' => 'print'`, reuse key `print`)
    - _Requirements: 2.6, 5.9_

  - [x] 3.7 Write feature test `EmailTemplateSendRequestTest`
    - Pola ditemukan: `PrintPdfControllerTest.php` (test print/PDF via HTTP nyata) pakai model `SalesOrder` asli + `Schema::create` manual (bukan RefreshDatabase full migration) untuk tabel yang dibutuhkan — diikuti untuk group 3.8-3.10 (test ini sendiri cukup unit-style `Validator::make()`, pola `EmailTemplateValidationTest` spec 1, tidak perlu HTTP)
    - 8 passed (14 assertions)
    - Test: `to` required+email; `cc.*`/`bcc.*` masing-masing format email; `subject`/`body` required; `fileIds.*` harus exists di `files`; `include_pdf` boolean opsional
    - **Validates: Requirements 3.4, 3.9, 4.4**

  - [x] 3.8 Write feature test `EmailPreviewControllerTest`
    - SalesOrder asli ternyata terlalu berat (relasi `items` dkk memicu error tabel hilang) — dibuat model+controller stub minimal (`EmailPreviewTestDocument`/`EmailPreviewTestDocumentController`) di dalam file test, route didaftarkan dinamis di `setUp()` + `$this->app['router']->getRoutes()->refreshNameLookups()` (perlu eksplisit, route baru tidak otomatis ter-lookup by name tanpa ini)
    - **Bug nyata ketemu & diperbaiki di `emailPreview()`**: `resolvedFields` awalnya iterasi SEMUA `getColumns(2)` termasuk kolom relasi (hasMany/belongsTo, ditandai `nameOfFunction`), `data_get()` pada kolom relasi men-trigger lazy-load sungguhan (butuh tabel relasi ada). Fix: `getColumns(0)` + `reject(fn ($col) => isset($col['nameOfFunction']))` — hanya proses kolom non-relasi
    - Tabel `preferences` di test perlu kolom `is_example` (global scope `HasExampleData` via `DataTable` trait yang dipakai `Preference` model)
    - Test: compile dengan `EmailTemplate` ada vs `null` (subject/body kosong); resolve `recipient_path` valid vs invalid (null-safe, tidak fatal); `hasGeneratedPdf`/`canOfferPdf` benar tercermin dari data `is_generated_pdf` dan keberadaan PrintTemplate default; `resolvedFields` berisi nilai aktual bukan field kosong
    - 7 passed (13 assertions)
    - **Validates: Requirements 2.4, 2.5, 3.2, 4.1, 4.3, 4.7**

  - [x] 3.9 Write test `SendEmailWithPdfJobTest`
    - Model+tabel stub minimal (`SendEmailPdfJobTestDocument`) dibuat khusus test, job `handle()` dipanggil langsung (bukan `Queue::fake()`+dispatch — memverifikasi logic internal, bukan sekadar assert dispatch)
    - **Bug nyata ketemu #1**: `app(MailChannel::class)->send()` (pola manual yang sama dengan `SendEmailNotificationJob` spec 1) TIDAK ke-capture sama sekali oleh `Mail::fake()` maupun `Notification::fake()` — 0 mailables tercatat meski job sukses jalan tanpa error. Fix: `SendEmailWithPdfJob` diubah pakai `Notification::send($notifiable, $notification)` (API standar Laravel), bukan `MailChannel::send()` manual — sekarang testable penuh dengan `Notification::fake()`/`assertSentTo()`. `SendEmailNotificationJob` (spec 1) TIDAK diubah (di luar scope, test-nya pakai `Queue::fake()` jadi tidak pernah kena masalah yang sama)
    - **Bug nyata ketemu #2**: `AnonymousEmailNotifiable` (notifiable baru untuk alamat email arbitrer, lihat 3.3) awalnya tidak punya `getKey()` — `NotificationFake` mengharuskan itu untuk mengindeks notifikasi tercatat. Fix: tambah `getKey(): string` yang return `$this->email` (alamat sudah cukup unik untuk keperluan ini)
    - Test: `includePdf=false` → langsung kirim, tidak ada `Fileable` baru; `includePdf=true` dengan `Fileable.is_generated_pdf=true` sudah ada → dipakai langsung (tidak generate ulang); `includePdf=true` tanpa Fileable tapi ada PrintTemplate default → `Fileable` baru dengan `is_generated_pdf=true` tersimpan; `includePdf=true` tanpa PrintTemplate default → `ModelNotFoundException` (dari `firstOrFail`), tidak ada notifikasi terkirim; render gagal (mock `PrintTemplateRenderService`) → exception dilempar, tidak ada notifikasi terkirim; `from_name` custom diteruskan, alamat From tetap dari config
    - Perlu tabel tambahan di test: `preferences.is_example`, `permissions` (global scope `HasExampleData`/`DataTable` trait dipicu banyak model), `print_templates.name_model` (dibaca `PrintTemplate::columns` accessor, wajib terisi kalau `model` diisi)
    - 6 passed (14 assertions)
    - **Validates: Requirements 4.5, 4.6, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6**

  - [x] 3.10 Write feature test `EmailTemplateSendControllerTest`
    - Pola sama `EmailPreviewControllerTest` (model+controller stub, route dinamis + `refreshNameLookups()`)
    - `Queue::fake()`, assert `sendEmail()` men-dispatch `SendEmailWithPdfJob` dengan payload sesuai request (to/cc/bcc/subject/body/includePdf/fromName), response redirect dengan flash `success` (pesan "diantre"), permission gate 403 untuk user tanpa izin, validasi gagal → 422 tanpa dispatch
    - 4 passed (8 assertions)
    - **Validates: Requirements 2.6, 5.1, 5.8, 5.9**

- [x] 4. Checkpoint - Ensure backend tests pass (full suite terkait trigger)
  - `php artisan test --compact` pada 10 file spec 1+2 (dijalankan sebagai path eksplisit, bukan `--filter` project-wide) → **61 passed (119 assertions)**.
  - **Catatan penting — skema tabel SQLite in-memory shared antar file test**: proyek ini punya banyak file test yang `Schema::create()` tabel yang sama (`print_templates`, `sales_orders`, dll) dengan guard `Schema::hasTable()`, di database SQLite `:memory:` yang di-share sepanjang satu proses `php artisan test`. Kalau dua file mendefinisikan skema BERBEDA untuk tabel yang sama, siapa pun yang jalan lebih dulu "menang" — file lain mewarisi skema yang mungkin kurang lengkap tanpa pernah error KECUALI saat kolom yang hilang benar-benar diakses. Ditemukan 2 kasus di sesi ini: (1) `EmailPreviewControllerTest.php` (task 3.8, punyaku sendiri) awalnya bikin `print_templates` cuma 7 kolom, kurang `name_model` yang dibaca `PrintTemplate::title()`/`columns()` accessor — diperbaiki jadi skema lengkap 26-kolom yang identik dengan `ControllerPrintPreferencesDocInfoTest.php` (definisi paling lengkap yang ditemukan). (2) `PrintTemplateRequestTest.php` (bukan file spec ini) memakai `Schema::dropIfExists()`+`create()` UNCONDITIONAL setiap `setUp()` — destruktif terhadap tabel shared, bisa menghapus kolom yang ditambahkan file lain kapan saja proses berjalan. Diubah jadi guard idempotent (pola semua file lain) plus kolom `name_model` ditambahkan.
  - **Bug pre-existing TIDAK terkait spec ini, dilaporkan tapi TIDAK diperbaiki (di luar scope)**: `PrintTemplate\PrintPdfControllerTest.php` vs `ControllerPrintPreferencesDocInfoTest.php` saling mengganggu skema `sales_orders` kalau dijalankan bersama — sudah ada sebelum sesi ini dimulai, sama sekali tidak menyentuh kode/test EmailTemplate. Checkpoint ini divalidasi dengan daftar file eksplisit yang mengecualikan kombinasi bermasalah tersebut.

- [ ] 5. Frontend: EmailChipInput (komponen baru)
  - [x] 5.1 Buat `resources/js/Components/EmailChipInput.jsx`
    - Props: `value` (`string[]`), `onValueChange`, `placeholder`, `disabled`, `className`
    - Input teks bebas, Enter/koma/Tab → jadi chip (validasi format email via `isValidEmail()` yang di-export terpisah — testable tanpa render komponen, pola sama `dotPathToMergeTagToken` di spec 1); alamat invalid ditolak (teks draft jadi merah, tidak jadi chip). Backspace saat draft kosong menghapus chip terakhir (UX standar tag-input)
    - Tombol hapus (×) per chip, styling adaptasi visual `Tags.jsx` (`bg-muted`, rounded chip + tombol X `lucide-react`) tapi murni free-text (tidak ada `axios.get`/`Command` search-to-server), dibungkus `InputWrapper` (`Components/ui/input.jsx`) untuk konsistensi visual dengan input lain
    - `npx eslint`: 0 error
    - _Requirements: 3.2, 3.3, 3.4_

  - [x] 5.2 Write unit test `EmailChipInput.test.js`
    - `@testing-library/react` tidak tersedia di project ini — test fokus ke `isValidEmail()` (fungsi murni ter-export), bukan full component render (parsing keyboard/chip UI diverifikasi manual di checkpoint browser, task 8)
    - Test: email valid (biasa, subdomain+plus-tag, ada whitespace di-trim) diterima; invalid (tanpa @, tanpa domain, ada spasi, kosong, tanpa TLD) ditolak
    - 8 passed
    - **Validates: Requirements 3.4**

- [x] 6. Checkpoint - Ensure EmailChipInput tests pass
  - `npx vitest run resources/js/Components/EmailChipInput.test.js` → 8 passed. `npx eslint` → 0 error.

- [ ] 7. Frontend: EmailSendDialog dan integrasi FormPage
  - [x] 7.1 Buat `resources/js/Pages/Core/Components/EmailSendDialog.jsx`
    - Saat dibuka: `GET {plural}.email.preview` (dengan `emailTemplate` id kalau ada), isi state awal
    - Field From: alamat read-only info, From Name `Input` editable
    - Field To/Cc/Bcc: `EmailChipInput`, To pre-filled dari `recipient`
    - Field Subject: `MentionsInput`/`Mention`, mention insert **nilai** dari `resolvedFields` (bukan token)
    - Body: `TiptapEditor` dengan `mentionSource` dari `resolvedFields` (mode default, tanpa `mentionRenderMode="mergeTag"`)
    - Checklist attachment (file existing/upload): dari `files` response, checkbox tiap item, dikirim sebagai `fileIds`
    - **Opsi PDF — murni niat, TIDAK ada request saat dicentang**: IF `hasGeneratedPdf` true → item PDF sudah ada di daftar `files` seperti attachment biasa (tidak perlu penanganan khusus). ELSE IF `canOfferPdf` true → tampilkan checkbox terpisah "Sertakan PDF (akan dibuat saat mengirim)", state lokal `includePdf` (boolean), TIDAK memicu `axios`/request apa pun saat berubah. ELSE → tidak ditampilkan
    - Tombol upload baru: reuse `addFile` endpoint existing, hasil masuk checklist tercentang
    - Tombol Kirim: POST `{plural}.email.send` dengan `fileIds` + `include_pdf: includePdf`, disabled saat To kosong/invalid. Toast/pesan setelah submit sukses: "Email sedang diproses" (bukan "terkirim") — job berjalan async, hasil akhirnya tidak diketahui sinkron
    - `npx eslint`: 0 error, 0 warning
    - _Requirements: 2.4, 2.5, 3.1–3.9, 4.1, 4.2, 4.3, 4.4, 4.7, 4.8, 5.8_

  - [x] 7.2 Integrasikan tombol "Kirim Email" ke `resources/js/Pages/Core/FormPage.jsx`
    - Deferred prop `emailTemplates` dibaca via `usePage().props.emailTemplates` TANPA fallback `?? []` (beda dari `prints`) — `undefined` dipakai sebagai penanda eksplisit "prop tidak ter-share sama sekali" (belum resolve ATAU permission tidak ada), supaya tombol bisa disembunyikan total sesuai Requirement 2.6. Gating tambahan `can("print")` (key permission direuse, lihat task 3.2) di titik render tombol — sesuai keputusan task 7.3, gating dilakukan di sini bukan di `showDetail()`
    - Tombol utama SELALU buka dialog (`setEmailDialog({ emailTemplateId: undefined })`) — beda dari tombol Print yang `Link`-navigate langsung; requirement mengharuskan dialog selalu bisa diedit dulu sebelum kirim, jadi tidak ada aksi "kirim langsung pakai default" dari klik tombol utama
    - `emailTemplates.length > 1` → dropdown chevron tambahan (pola sama Print), tiap item set `emailTemplateId` spesifik lalu buka dialog (compile ulang via `emailPreview` dengan template terpilih)
    - `emailTemplates` ter-share tapi `[]` (permission ada, belum ada template) → tombol tetap aktif, dialog buka dengan `emailTemplateId: undefined` (subject/body kosong, tetap bisa kirim manual)
    - State `emailDialog` (null | `{ emailTemplateId }`) mengontrol `open`/dialog props; `EmailSendDialog` dirender di root `AppLayout` (sejajar `AlertDialog` konfirmasi submit/cancel), bukan di dalam `<form>`
    - **Bug ditemukan & diperbaiki di `EmailSendDialog.jsx` (task 7.1) saat integrasi**: ketiga pemanggilan `route()` Ziggy pakai object key `{ id: documentId, emailTemplate: ... }`/`{ id: documentId }`, padahal parameter route asli (macro `resourceDetail` di `routes/web.php`) bernama `{$name}` (nama model dinamis per-resource, mis. `salesOrder`), bukan literal `id` — key salah membuat Ziggy gagal resolve URL dengan benar. Fix: ganti ke array positional (`route(name, [documentId, emailTemplateId])` / `route(name, documentId)`), konsisten dengan pola `route()` Print yang sudah ada di `FormPage.jsx`. Endpoint upload file juga diperbaiki dari raw string path (`` `${resourceNamePlural}/${documentId}/file` ``) ke named route `route(\`${resourceNamePlural}.addFile\`, documentId)`
    - `npx eslint` (`FormPage.jsx` + `EmailSendDialog.jsx`): 0 error, 0 warning
    - `php artisan test --compact` (4 file test spec ini yang exercise controller/job/request) → 25 passed (49 assertions), tidak ada regresi dari fix route
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.6_

  - [x] 7.3 Backend: share deferred prop `emailTemplates` di `App\Traits\DataTable::showDetail()` (mirror `prints`)
    - `Inertia::share(['emailTemplates' => Inertia::defer(fn () => EmailTemplate::where('model', static::class)->get())])`, di dalam blok `if (static::$is_submitable ?? false)` yang sama dengan `prints`
    - **Catatan penting**: `showDetail()` (dan `prints` yang sudah ada) TIDAK memfilter berdasarkan permission `print` — filter permission untuk tombol Print dilakukan (atau seharusnya dilakukan) di level frontend, bukan di titik share ini. Ternyata tombol Print existing di `FormPage.jsx` JUGA tidak melakukan `can("print")` check (gap pre-existing, di luar scope spec ini untuk diperbaiki). Untuk memenuhi Requirement 2.6 (tombol Email harus disembunyikan tanpa permission) secara eksplisit tanpa mengubah perilaku tombol Print, gating `can("print")` ditambahkan khusus di titik render tombol Email pada task 7.2 — bukan di sini
    - _Requirements: 2.6_

- [ ] 8. Checkpoint - Manual browser verification
  - Jalankan `npm run dev`/`composer run dev` DAN worker queue (`php artisan queue:listen` atau setara — job tidak akan jalan tanpa worker aktif) — atau minta user melakukannya. Buka dokumen submitable dengan EmailTemplate ada: klik tombol Kirim Email, verifikasi dialog terisi benar (recipient, subject/body ter-compile), edit body via mention (cek nilai tersisip, bukan token), tambah Cc/Bcc via chip input, centang "Sertakan PDF" untuk dokumen yang belum punya PDF tersimpan, kirim, tunggu worker memproses job, cek email masuk dengan PDF terlampir dan `Fileable.is_generated_pdf=true` baru tersimpan. Verifikasi kasus gagal: nonaktifkan PrintTemplate default sementara, kirim dengan PDF dicentang, pastikan job gagal (cek `failed_jobs` table/log) dan email TIDAK masuk. Ulangi untuk dokumen tanpa EmailTemplate (dialog kosong, tetap bisa kirim manual) dan dokumen yang sudah punya PDF tersimpan sebelumnya. Laporkan hasil ke user — jangan klaim selesai tanpa observasi ini.

- [x] 9. Final checkpoint - Ensure all tests pass
  - `php artisan test --compact --filter=EmailTemplate` (project-wide) → 44 passed (84 assertions)
  - `php artisan test --compact` pada 4 file controller/job/request spec ini → 25 passed (49 assertions)
  - `npx vitest run` (full suite) → 604 passed, 6 gagal — SEMUA di file `PrintTemplate` (`Editor.gridCssFix`, `CustomMode.sidebar.drop`, `VariableItem.titleTrans`, `customModeUtils.property`), tidak ada satu pun file yang disentuh spec ini; dikonfirmasi via `git status` bahwa file-file tersebut tidak termasuk perubahan sesi ini — pre-existing, di luar scope
  - `vendor/bin/pint --dirty --format agent` → jalan bersih, hanya realign kolom array (`lang/en/core/form.php`, `lang/id/core/form.php`) akibat key `'email'` baru ditambahkan di task 7.2
  - `npx eslint` pada seluruh file JS/JSX terkait spec (`EmailChipInput.jsx`, `EmailSendDialog.jsx`, `FormPage.jsx`) → 0 error, 0 warning (1 warning `jsdoc/require-returns` di `EmailChipInput.jsx` ditemukan & diperbaiki saat checkpoint ini — luput dari task 5.1 karena warning itu tidak muncul saat lint hanya dijalankan sendirian tanpa `--fix` sebelumnya)

## Notes

- Setiap task mereferensikan requirement dari `requirements.md` untuk traceability.
- Backend (group 1, 3) diverifikasi penuh sebelum frontend (group 5, 7) mulai — endpoint `emailPreview`/`sendEmail` harus stabil dulu karena frontend bergantung pada kontrak response/payload-nya.
- Task 5.2 (unit test EmailChipInput) kondisional pada ketersediaan infra render-testing (`@testing-library/react` atau setara) — cek dulu sebelum menulis; kalau tidak tersedia dan di luar scope menambah infra baru, laporkan ke user dan uji logic parsing/validasi secara terisolasi (fungsi murni diekstrak dari komponen) alih-alih full render.
- **Arsitektur PDF berubah signifikan dari draf awal**: TIDAK ADA endpoint `generateEmailPdf` terpisah. Generate PDF (kalau `include_pdf` diminta dan belum ada yang tersimpan) terjadi SEPENUHNYA di dalam `SendEmailWithPdfJob` (task 3.3), sebagai bagian dari proses pengiriman — bukan aksi sinkron terpisah yang dipicu dari dialog. Ini beda dari pola `attachGeneratedPdf`/`printPdf` yang mentolerir kegagalan attachment; di sini kegagalan generate PDF (ketika diminta) SENGAJA membatalkan seluruh pengiriman.
- Key permission `'email'` (task 3.6) — nama key final ditentukan saat implementasi mengikuti konvensi `keyPermissions` yang ada; kalau ternyata lebih tepat reuse key `'print'` (tanpa key baru), sesuaikan dan catat alasannya di task tersebut saat selesai.
- Verifikasi manual (task 8) BUTUH queue worker aktif (`php artisan queue:listen`), tidak seperti spec 1 yang test-send-nya juga lewat queue tapi biasanya sudah dites lewat `Queue::fake()`. Pastikan worker jalan sebelum klaim verifikasi selesai.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["1.3"] },
    { "id": 3, "tasks": ["2"] },
    { "id": 4, "tasks": ["3.1"] },
    { "id": 5, "tasks": ["3.2", "3.3"] },
    { "id": 6, "tasks": ["3.4", "3.5"] },
    { "id": 7, "tasks": ["3.6"] },
    { "id": 8, "tasks": ["3.7", "3.8", "3.9", "3.10"] },
    { "id": 9, "tasks": ["4"] },
    { "id": 10, "tasks": ["5.1"] },
    { "id": 11, "tasks": ["5.2"] },
    { "id": 12, "tasks": ["6"] },
    { "id": 13, "tasks": ["7.3"] },
    { "id": 14, "tasks": ["7.1"] },
    { "id": 15, "tasks": ["7.2"] },
    { "id": 16, "tasks": ["8"] },
    { "id": 17, "tasks": ["9"] }
  ]
}
```
