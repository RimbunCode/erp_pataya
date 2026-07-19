# Implementation Plan: Email Template

## Overview

Implementasi mengikuti pola `PrintTemplate` untuk struktur data/CRUD/permission, dengan dua bagian baru: render service server-side (`Blade::render()`) dan konversi merge-tag TipTap→Blade di frontend. Backend dan frontend dikerjakan berurutan (backend dulu supaya endpoint `fields` tersedia untuk frontend), lalu disatukan lewat halaman Form/Show dan diverifikasi end-to-end via Test Send.

## Tasks

- [x] 1. Migration dan Model EmailTemplate
  - [x] 1.1 Buat migration `create_email_templates_table`
    - Kolom sesuai Data Models design.md: `id` ulid, `name`, `permission_id`, `model`, `name_model`, `is_default`, `subject`, `body_html`, `body_json`, `default_language`, timestamps, softDeletes
    - Unique `(name, deleted_at)`, index `(model, is_default)`
    - _Requirements: 1.1, 1.4_

  - [x] 1.2 Buat model `App\Models\Core\EmailTemplate`
    - Traits `DataTable, HasUlids, SoftDeletes`, casts (`body_json` → array, `is_default` → boolean)
    - Relasi `permission()` belongsTo `Permission`
    - `boot()` hook: auto-promote default jika template pertama untuk `model`, auto-demote sibling saat default baru di-set (salin logic dari `PrintTemplate::boot()`)
    - _Requirements: 1.5, 1.6_

  - [x] 1.3 Write feature test untuk model behavior (EmailTemplateDefaultEnforcementTest)
    - **Property: satu default per model selalu tepat 1 row `is_default=true` untuk `model` yang sama**
    - Test: simpan template pertama → otomatis default; simpan template kedua dengan `is_default=true` → yang pertama otomatis `false`
    - **Validates: Requirements 1.5, 1.6**
    - Catatan: kolom `is_example` (global scope `HasExampleData` via trait `DataTable`) di-inject manual di `setUp()` test, bukan di migration — mengikuti pola project (`SavedFilterTest.php`), kolom itu normalnya ditambah dynamic oleh `initPermissions()` di production.

- [x] 2. Checkpoint - Ensure migration & model tests pass
  - `php artisan test --compact --filter=EmailTemplateDefaultEnforcementTest` → 4 passed (6 assertions).

- [x] 3. Request validation dan permission
  - [x] 3.1 Buat `App\Http\Requests\Core\EmailTemplateRequest`
    - Rules: `name` required+unique (ignore current via `{$this->id}`, exclude soft-deleted via `,id,deleted_at,NULL`), `permission.model` required string (bukan `model` flat — mengikuti pola nested `permission.*` PrintTemplateRequest, di-flatten ke kolom `model`/`permission_id`/`name_model` di controller), `subject` required string max:255, `body_html` required string, `body_json` nullable array, `is_default` boolean
    - _Requirements: 1.2, 1.3_

  - [x] 3.2 Write feature test untuk validasi (EmailTemplateValidationTest)
    - Test: `name` duplikat ditolak; `permission.model`/`subject`/`body_html` kosong ditolak; `name` milik record soft-deleted tidak dianggap duplikat
    - **Validates: Requirements 1.2, 1.3**
    - 7 passed (12 assertions). Catatan: rule `unique:...` string bawaan Laravel query langsung ke DB (tidak lewat Eloquent SoftDeletes scope) — tanpa parameter `deleted_at,NULL` eksplisit, soft-deleted row tetap terhitung duplikat. Fixed di rule ini; PrintTemplateRequest sibling punya potensi bug sama tapi di luar scope spec ini.

- [x] 4. Render Service
  - [x] 4.1 Buat `App\Services\Core\EmailTemplate\EmailTemplateRenderService`
    - Method `render(EmailTemplate $emailTemplate, Model $doc): array{subject: string, body: string}`
    - `extractRelationPaths()` — regex scan token Blade `{{ $doc->a->b->c }}` (bukan Handlebars) di subject+body_html, kembalikan daftar path relasi unik
    - Reuse `RelationTrackerService::validateRelations()` existing (generic terhadap sintaks token) untuk validasi path terhadap relasi Model asli, lalu eager-load via `loadMissing()`
    - `safeBladeRender()` — coba `Blade::render()` penuh dulu; kalau exception, fallback `renderWithBlankFallback()` scan token satu-satu, buang yang gagal render individual, render ulang sisanya
    - `resolveCompanyDetails()` — pola `Preference::withoutGlobalScope(HIDE_PRIVATE_KEYS_SCOPE)->get(['key','value'])->mapWithKeys(...)`, sama seperti `CompanyController::index()` (bukan service `PreferenceService` seperti asumsi awal design.md — itu tidak ada di codebase)
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 4.2 Write unit test untuk EmailTemplateRenderService (EmailTemplateRenderServiceTest)
    - **Property: render tidak pernah melempar exception, selalu mengembalikan string (Correctness Property 4)**
    - Test: token atribut langsung; token relasi nested 2 level (`$doc->customer->address->city`) via model stub (`RenderTestDocument`/`RenderTestCustomer`/`RenderTestAddress`, pola `SecLookupRecord`); token relasi tidak ada → hasil blank tanpa fatal; query count eager-load ≤3 (2 loadMissing + 1 resolveCompanyDetails, bukan N+1)
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
    - 4 passed (9 assertions)

- [x] 5. Checkpoint - Ensure render service tests pass
  - `php artisan test --compact tests/Feature/Core/EmailTemplateRenderServiceTest.php` → 4 passed.

- [x] 6. Controller, Routes, Notification
  - [x] 6.1 Buat `App\Http\Controllers\Core\EmailTemplateController`
    - `parent::__construct($request, EmailTemplate::class)`, inject `EmailTemplateRenderService`
    - `index`, `create`, `store`, `show`, `update`, `destroy` — pola `resourceDetail`/Inertia render `Core/EmailTemplate/Index` dan `Core/EmailTemplate/Show`; `store`/`update` flatten `data.permission.{id,model,name}` → `permission_id`/`model`/`name_model` (pola PrintTemplateController, bukan field `model` flat)
    - _Requirements: 1.1, 1.7_

  - [x] 6.2 Tambah method `fields(Request $request)` di EmailTemplateController
    - Validasi `model` required string, resolve field list via `$modelClass::getColumns(2)` (statis, method `LinkModel` trait)
    - _Requirements: 2.3, 2.4_

  - [x] 6.3 Buat `App\Notifications\EmailTemplateTestNotification`
    - `extends Notification` langsung (bukan `BaseNotification` — scaffold itu `use SoftDeletes` di kelas non-Eloquent, dead code, tidak diwarisi)
    - `toMail()` pakai `MailMessage::view('mail.email-template', ['body' => ...])` — view baru `resources/views/mail/email-template.blade.php` (`{!! $body !!}` apa adanya). `MyMailMessage` tidak dipakai: dia menargetkan `mail.base-mail` yang **belum pernah dibuat** di codebase (view file tidak ada), dan strukturnya (intro/outro lines) tidak cocok untuk body HTML utuh hasil compile Blade
    - _Requirements: 4.1, 4.2_

  - [x] 6.4 Tambah method `testSend(EmailTemplate $emailTemplate)` di EmailTemplateController
    - Data contoh diambil via `$modelClass::exampleData()->first()` (scope Eloquent dari `HasExampleData`), **bukan** `ExampleDataService::getExampleData()` — service itu ternyata gagal mendeteksi kolom `is_example` untuk model yang pakai `$guarded` (mayoritas model project, termasuk `SalesOrder` asli, karena `getFillable()` return kosong pada mode guarded). Bug pre-existing di luar scope spec ini, dihindari dengan query scope langsung
    - Render via `EmailTemplateRenderService`, dispatch `SendEmailNotificationJob::dispatch(auth()->user(), new EmailTemplateTestNotification(...))`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 6.5 Daftarkan routes di `routes/web.php`
    - `GET /emailTemplates/fields` didaftarkan **sebelum** `Route::resourceDetail('emailTemplate', ...)` — urutan penting karena `resourceDetail` mendaftarkan `GET /emailTemplates/{emailTemplate}` (show) yang kalau didaftarkan lebih dulu akan meng-intercept request ke `/fields` (menganggap "fields" sebagai id)
    - `POST /emailTemplates/{emailTemplate}/test-send` → `testSend` (nama `emailTemplates.testSend`)
    - _Requirements: 1.1, 2.3, 4.1_

  - [x] 6.6 Write feature test CRUD + permission (EmailTemplateCrudTest)
    - Test: index/create/show/update/destroy via HTTP (pola `CurrencyControllerTest`), 403 untuk user tanpa permission, `is_default` tersimpan
    - **Validates: Requirements 1.1, 1.7**
    - 8 passed (16 assertions)

  - [x] 6.7 Write feature test Test Send (EmailTemplateTestSendTest)
    - `Queue::fake()`, assert `SendEmailNotificationJob` di-dispatch; model stub test wajib pakai trait `DataTable` (bukan cuma `HasUlids`) supaya scope `exampleData()` tersedia
    - Test: tanpa model → alert error; tanpa data contoh → alert error; template tidak ada → 404
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**
    - 4 passed (7 assertions)

  - [x] 6.8 Security fix pasca automated review — 2 temuan
    - **[CRITICAL] SSTI/RCE**: `EmailTemplateRenderService` awalnya pakai `Blade::render()` untuk compile subject/body — mengeksekusi `@php`/`<?php` sebagai kode PHP sungguhan di server SETIAP kali email dikirim (beda dari PrintTemplate yang Handlebars-nya client-side, blast radius cuma browser penulis sendiri). Diganti total ke **whitelist token substitution**: `TOKEN_PATTERN` regex `{{ $doc->a->b->c }}`/`{{ $docInfo->x }}`/`{{ $company->x }}`, resolve via `data_get()` (dot-notation, tidak pernah eksekusi kode), escape via `e()`. Apa pun di luar pola (directive, pemanggilan fungsi, tag PHP) dibiarkan literal, tidak pernah masuk compiler PHP
    - **[MEDIUM] Unvalidated class → arbitrary static call**: `EmailTemplateController::fields()` menerima `model` dari request lalu langsung `$modelClass::getColumns(2)` setelah cuma `class_exists()` — bisa dipanggil dengan FQCN class apa pun yang exist (bocorkan skema kolom model di luar EmailTemplate). Fix: tambah cek `Permission::where('model', $modelClass)->exists()` sebelum panggil `getColumns()`
    - `design.md` diperbarui (Overview, pseudocode Render Service, Correctness Properties, Error Handling, Testing Strategy) mencerminkan pendekatan whitelist substitution — bukan lagi `Blade::render()`
    - Test baru: `test_php_directive_in_body_is_not_executed`, `test_function_call_expression_is_not_substituted`, `test_rendered_value_is_html_escaped` di `EmailTemplateRenderServiceTest`
    - Full suite setelah fix: 30 passed (58 assertions)
    - _Requirements: 3.1–3.4 (render), tidak ada requirement eksplisit untuk fields() allowlist — celah ditemukan di luar acceptance criteria awal, ditambal sebagai defense-in-depth_

- [x] 7. Checkpoint - Ensure backend tests pass (full backend test suite untuk EmailTemplate)
  - `php artisan test --compact --filter=EmailTemplate` → seluruh test EmailTemplate pass (lihat rekap di bawah).

- [x] 8. Merge-tag extension (frontend)
  - [x] 8.1 ~~Buat `resources/js/Components/TiptapMergeTagExtension.js`~~ → diarahkan ulang: extend `TiptapEditor.jsx` shared, bukan file terpisah
    - Riset menunjukkan `TiptapEditor.jsx` **sudah** punya `Mention` extension built-in (dipakai `Comments.jsx` untuk @user, render hardcode jadi `@Label`). Tiptap tidak bisa punya 2 extension bernama `mention` di satu editor — file `TiptapMergeTagExtension.js` terpisah akan konflik nama, bukan solusi yang valid
    - Fix: tambah prop `mentionRenderMode` (default `'label'`, opsi baru `'mergeTag'`) ke `TiptapEditor.jsx`. Saat `'mergeTag'`, `renderHTML` mention node mengembalikan `["span", {"data-type":"mention","data-merge-tag":node.attrs.id}, dotPathToMergeTagToken(node.attrs.id)]` — helper `dotPathToMergeTagToken(id)` konversi dot-path (`doc.customer.name`) ke token `{{ $doc->customer->name }}`. `Comments.jsx` tidak berubah (mode default tetap `'label'`)
    - _Requirements: 2.5, 2.6_

  - [x] 8.2 Write unit test untuk dotPathToMergeTagToken (vitest tersedia — `npm test` → `vitest run`)
    - Fungsi di-export dari `TiptapEditor.jsx` agar testable tanpa me-render seluruh editor Tiptap (pola sama `NumberInput/fetchExchangeRate.test.js` — helper murni diuji terpisah dari komponen)
    - **Property: setiap dot-path menghasilkan token arrow-path yang setara secara 1:1**
    - Test: `TiptapEditor.mergeTag.test.js` — path 1 segmen (atribut langsung), 2 segmen, nested 3+ segmen, prefix `docInfo`/`company`
    - **Validates: Requirements 2.5**
    - 5 passed

- [x] 9. Halaman React EmailTemplate
  - [x] 9.1 Buat `resources/js/Pages/Core/EmailTemplate/Index.jsx`
    - Wrapper `DataTable2` + `form={<Form />}`, identik pola `PrintTemplate/Index.jsx`
    - _Requirements: 1.1_

  - [x] 9.2 Buat `resources/js/Pages/Core/EmailTemplate/Form.jsx`
    - Field `name`, `PermissionLinkModel` (**tanpa** filter `is_submitable` — beda dari PrintTemplate, EmailTemplate boleh target model apa pun yang punya `Permission`), switch `is_default`
    - Subject: `MentionsInput`/`Mention` (`Components/Mention.jsx`, pola nyata diambil dari `FormatingSeries/Show.jsx`) — markup `"{{ $__id__ }}"`, sumber data `fetchFields()` mengembalikan `id` **arrow-final** (`doc->name`) karena markup react-mentions substitusi literal, tidak lewat transform tambahan
    - Body: `TiptapEditor` prop baru `mentionRenderMode="mergeTag"` (lihat 8.1) — sumber data `mentionSourceForBody()` mengembalikan `id` **dot-path** (`doc.name`), dikonversi ke token arrow oleh `dotPathToMergeTagToken()` di titik `renderHTML`. Subject dan body sengaja pakai representasi `id` berbeda karena titik konversinya beda (react-mentions vs Tiptap extension)
    - Kedua sumber data reuse satu `fetchFieldColumns()` (single HTTP call ke `emailTemplates.fields`), dipetakan dua cara berbeda
    - Field `body_json`/`body_html` disinkron dari `onValueChange` TiptapEditor langsung ke `setData` (pola sama `Comments.jsx`, tanpa perlu `editorRef.getHTML()` manual karena callback sudah menyediakan `html`)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_

  - [x] 9.3 Tambah tombol "Kirim Test" di Form.jsx
    - POST `emailTemplates.testSend`, disabled jika template belum tersimpan (`data.id` null), toast hasil via `gooeyToast` (dipakai `Comments.jsx`, bukan `lib/inertiaToast.jsx` — itu untuk flash message otomatis dari Inertia response, bukan trigger manual di `onSuccess`)
    - _Requirements: 4.1, 4.5_

  - [x] 9.4 Buat `resources/js/Pages/Core/EmailTemplate/Show.jsx`
    - Shell tipis `FormPage` + `<Form />`, identik pola `PrintTemplate/Show.jsx` (tanpa tombol `controls` tambahan — PrintTemplate punya tombol "Open Editor" ke GrapeJS, EmailTemplate tidak butuh karena editor menyatu di Form)
    - _Requirements: 1.1_
    - `npx eslint` pada seluruh file baru/diubah (Form.jsx, Index.jsx, Show.jsx, TiptapEditor.jsx, TiptapEditor.mergeTag.test.js): 0 error, 0 warning setelah fix

- [~] 10. Checkpoint - Manual browser verification
  - Setup selesai: `php artisan migrate` (tabel `email_templates` sudah ada di DB dev `erp`), `npm run build` sukses tanpa error (semua page EmailTemplate ter-bundle bersih, termasuk SSR).
  - **Verifikasi visual di browser BELUM dilakukan oleh AI** — sesuai keputusan user, akan diverifikasi manual: buka halaman EmailTemplate, buat template baru, pilih Model, insert mention di subject & body, simpan, buka lagi (verifikasi round-trip body_json→editor benar), klik Kirim Test, verifikasi email diterima (cek log driver / Mailtrap sesuai `.env`).
  - Jangan tandai `[x]` sampai user mengonfirmasi hasil verifikasi manual.

- [x] 11. Final checkpoint - Ensure all tests pass
  - `php artisan test --compact --filter=EmailTemplate` → 30 passed (58 assertions)
  - `npx vitest run` (merge-tag + regresi existing) → 72 passed (72 tests, 3 file), termasuk 5 test `dotPathToMergeTagToken` baru
  - `npx eslint` seluruh file JS/JSX baru+diubah → 0 error, 0 warning
  - `vendor/bin/pint --dirty --format agent` → dijalankan (fix formatting minor di 3 file test: `class_definition`, `ordered_imports`, spacing), lalu re-run kedua → `{"result":"pass"}` (idempotent, bersih)
  - Re-run test setelah Pint → masih 30 passed, tidak ada regresi dari auto-format

## Notes

- Setiap task mereferensikan requirement dari `requirements.md` untuk traceability.
- Backend dikerjakan dan diverifikasi penuh (checkpoint 7) sebelum frontend mulai — endpoint `fields`/`testSend` harus stabil dulu karena frontend bergantung padanya.
- Task 8.2 (unit test JS) bersifat kondisional — cek dulu apakah project sudah punya infra test JS (Jest/Vitest) sebelum menjalankan; jika belum ada, laporkan ke user dan skip tanpa membuat infra baru (di luar scope spec ini).
- Attachment, tombol trigger manual di FormPage, dan trigger otomatis berbasis event sengaja tidak ada di sini — lihat Out of Scope requirements.md.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["1.3"] },
    { "id": 3, "tasks": ["3.1"] },
    { "id": 4, "tasks": ["3.2", "4.1"] },
    { "id": 5, "tasks": ["4.2"] },
    { "id": 6, "tasks": ["6.1"] },
    { "id": 7, "tasks": ["6.2", "6.3"] },
    { "id": 8, "tasks": ["6.4"] },
    { "id": 9, "tasks": ["6.5"] },
    { "id": 10, "tasks": ["6.6", "6.7"] },
    { "id": 11, "tasks": ["8.1"] },
    { "id": 12, "tasks": ["8.2", "9.1"] },
    { "id": 13, "tasks": ["9.2"] },
    { "id": 14, "tasks": ["9.3", "9.4"] },
    { "id": 15, "tasks": ["10"] },
    { "id": 16, "tasks": ["11"] }
  ]
}
```
