# Requirements Document

## Introduction

Fitur ini menambahkan **sidebar sisi kanan** yang dapat dibuka/ditutup (collapsible) dan dapat dikustomisasi (customable) pada komponen `FormPageDialog` (`resources/js/Pages/Core/FormPage.jsx`). Kemampuan ini meniru sidebar yang sudah ada pada komponen `FormPage`, dengan me-**reuse `SidebarChildren` penuh** (termasuk `Attachments` & `Tags`).

Tantangan utama: `FormPageDialog` beroperasi di **mode CREATE** — record belum memiliki ID, sementara `Attachments`/`Tags` saat ini meng-persist langsung ke server lewat URL berbasis record (`/{id}/file`, `/{id}/tag`). Solusinya: data attachment/tag **dibuffer secara lokal** di form state saat create, lalu **otomatis ter-attach** ke record baru lewat hook Eloquent `created` pada trait `DataTable`.

## Glossary

| Istilah | Definisi |
| --- | --- |
| **FormPageDialog** | Komponen React modal (`AlertDialog`) untuk membuat record baru (mode create), di `FormPage.jsx` |
| **Sidebar** | Panel sisi kanan dialog yang menampung `SidebarChildren` |
| **SidebarChildren** | Komponen existing di `FormPage.jsx` yang merender `Attachments` + `Tags` (default), connections, dan amended_from |
| **Customable** | Prop `sidebarContent` bisa `false` (tanpa sidebar), `undefined` (default), function (extend default), atau element (replace) |
| **Buffer lokal** | Penyimpanan sementara tags/files di form state (`useDraftForm`) saat create, sebelum record tersimpan |
| **Dual-mode** | `Attachments`/`Tags` memilih perilaku berdasarkan `isCreate`: create=buffer, edit=instant-persist |
| **Auto-attach** | Proses backend menempelkan buffered tags/files ke record baru via hook `DataTable::created` |
| **Taggable / Fileable** | Tabel pivot polymorphic yang menghubungkan Tag/File ke record |

---

## Requirements

### Requirement 1: Sidebar collapsible pada FormPageDialog

**User Story:** As a user, I want a collapsible right sidebar inside the create dialog, so that I can manage attachments and tags without leaving the dialog.

#### Acceptance Criteria

1. THE `FormPageDialog` SHALL menerima prop `sidebarContent` dengan default `false`.
2. WHEN `sidebarContent !== false`, THE `FormPageDialog` SHALL merender sidebar di sisi kanan menggunakan komponen shadcn `Sidebar` dengan `collapsible="none"` di dalam grid dialog.
3. WHEN sidebar aktif, THE `FormPageDialog` SHALL menggunakan layout grid `[1fr_auto]` dan melebarkan dialog (`max-w-3xl`).
4. WHEN sidebar aktif, THE `FormPageDialog` SHALL menyediakan tombol toggle di header untuk membuka/menutup sidebar.
5. WHEN toggle ditekan, THE sidebar SHALL menyempit/melebar dengan animasi lebar (width-animate in-flow), bukan overlay.
6. WHEN `sidebarContent === false`, THE `FormPageDialog` SHALL tetap berlayout single-column seperti perilaku saat ini.

### Requirement 2: Customable sidebar content (tristate)

**User Story:** As a developer, I want to customize the dialog sidebar content, so that each form can show relevant panels.

#### Acceptance Criteria

1. WHEN `sidebarContent === undefined`, THE sidebar SHALL menampilkan default content (`Attachments` + `Tags`) lewat `SidebarChildren`.
2. WHEN `sidebarContent` berupa function, THE sidebar SHALL memanggilnya dengan default content sebagai argumen (extend pattern), mengikuti pola `SidebarChildren` existing.
3. WHEN `sidebarContent` berupa React element, THE sidebar SHALL merendernya sebagai pengganti default (replace).
4. THE blok `connections` dan `amended_from` di `SidebarChildren` SHALL di-skip saat create (karena membutuhkan record tersimpan).

### Requirement 3: Attachments & Tags dual-mode (CREATE buffer)

**User Story:** As a user, I want to add tags and files while creating a record, so that they are saved together when I submit.

#### Acceptance Criteria

1. THE `Tags` dan `Attachments` SHALL menentukan mode dari `useFormPage().isCreate`.
2. WHEN mode create, THE `Tags` SHALL membaca/menulis daftar tag dari/ke `data.buffered_tags` di form state (bukan `usePage().props` / `router`).
3. WHEN mode create, THE `Attachments` SHALL membaca/menulis daftar file dari/ke `data.files` di form state, dan `UploadDialog` SHALL mem-push File object ke buffer (bukan `router.post`).
4. WHEN mode edit, THE `Tags` dan `Attachments` SHALL mempertahankan perilaku instant-persist saat ini tanpa perubahan (zero-regression).
5. THE pencarian tag (`route("tags.index")` via axios) SHALL tetap berfungsi di kedua mode.

### Requirement 4: Submit mengirim buffer

**User Story:** As a user, I want submitting the create dialog to send buffered tags and files, so that the backend can persist them.

#### Acceptance Criteria

1. WHEN dialog di-submit, THE `FormPageDialog` SHALL mengirim `buffered_tags` sebagai bagian payload.
2. WHEN ada file di buffer, THE `FormPageDialog` SHALL mengirim payload sebagai FormData (`forceFormData`) dengan struktur `files[]`, `isPublic[]`, `name[]` sesuai yang dibaca `File::uploadFile`.
3. THE payload transform SHALL dilakukan dengan `form.transform()` tanpa memutasi `data` reaktif (agar File object tidak bocor ke draft localStorage).

### Requirement 5: Backend auto-attach via DataTable hook

**User Story:** As a developer, I want buffered tags/files to attach automatically on record creation, so that no per-controller store() change is needed.

#### Acceptance Criteria

1. THE service `BufferedAttachmentService::attach(Model, Request)` SHALL membuat `Taggable` untuk setiap `buffered_tags` (resolve id existing, atau `Tag::firstOrCreate` saat `isNew`/tanpa id).
2. THE service SHALL membuat `Fileable` untuk setiap file lewat `File::uploadFile`, mereuse pola `Controller::addFile`.
3. THE service SHALL idempoten (memakai `firstOrCreate` untuk pivot) agar tidak menduplikasi attachment.
4. THE trait `DataTable` SHALL memanggil service via hook `static::created` saat request memiliki buffer.
5. WHEN tidak ada HTTP request terikat ATAU request tidak memiliki `buffered_tags`/`buffered_files`/file `files`, THE hook SHALL tidak melakukan apa-apa (aman untuk seeder/factory/job).

### Requirement 6: Pengujian

**User Story:** As a maintainer, I want the backend covered by tests, so that auto-attach is verified.

#### Acceptance Criteria

1. THE test SHALL memverifikasi attach buffered tags (existing + new) menghasilkan baris `taggables` dengan `taggable_id` benar.
2. THE test SHALL memverifikasi attach buffered files menghasilkan baris `fileables`.
3. THE test SHALL memverifikasi store tanpa buffer tidak menimbulkan side-effect.
4. THE test SHALL memverifikasi hook `DataTable::created` auto-attach saat request global memiliki buffer.
5. THE test SHALL memverifikasi `Model::create` tanpa buffer (factory/seeder) aman (tidak error, tidak attach).
