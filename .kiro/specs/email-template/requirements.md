# Requirements Document

## Introduction

Aplikasi saat ini punya `PrintTemplate` yang memungkinkan setiap Model submitable (SalesOrder, Invoice, dll) memiliki satu atau lebih template cetak yang dikelola user via editor visual (GrapeJS), dengan merge-tag di-resolve client-side (Handlebars.js) saat preview/print.

Fitur ini menambahkan `EmailTemplate` dengan pola serupa: setiap Model bisa punya lebih dari satu template email, dikelola lewat editor rich-text (TipTap, bukan GrapeJS — email tidak butuh layout bebas seperti cetak), dan mendukung merge-tag lewat mention-picker.

Beda krusial dari PrintTemplate: email dikirim ke penerima yang tidak membuka aplikasi ini, sehingga rendering merge-tag **tidak bisa** dilakukan client-side. Body dan subject di-compile server-side memakai Blade (`Blade::render()`), bukan Handlebars.js.

Scope dokumen ini (spec 1 dari 3):
- CRUD EmailTemplate + asosiasi ke Model (pola sama seperti PrintTemplate: kolom `model` berisi FQCN, dicocokkan ke `Permission::model`)
- Editor TipTap untuk body + input mention untuk subject
- Konversi merge-tag (mention node) menjadi token Blade saat serialisasi
- Rendering server-side (compile Blade + eager-load relasi otomatis)
- Test Send: kirim email hasil compile ke alamat user yang sedang login, untuk validasi template

Di luar scope dokumen ini (menyusul di spec terpisah):
- Tombol trigger manual di FormPage (seperti tombol Print, bisa multi-opsi)
- Attachment dari file lain, hasil PDF dari PrintTemplate
- Trigger otomatis berbasis event (approval/reject, notifikasi role tertentu)
- Template untuk email sistem (reset password, invite user, verifikasi email)

## Glossary

- **EmailTemplate**: record yang menyimpan definisi satu template email (subject, body, target Model) — analog dengan `PrintTemplate`.
- **Merge-tag**: placeholder yang diganti dengan data nyata saat email dikirim, contoh `{{ $doc->number }}`. Di editor direpresentasikan sebagai mention node/chip, disimpan sebagai token Blade.
- **Target Model**: kelas Eloquent (FQCN) yang menjadi sumber data EmailTemplate, disimpan di kolom `model`, dicocokkan terhadap `Permission::model` — bukan relasi polymorphic.
- **Default Template**: satu EmailTemplate per Model yang ditandai `is_default = true`; dipakai ketika pengirim tidak memilih template secara eksplisit (dipakai nanti oleh spec trigger).
- **Test Send**: aksi mengirim email hasil compile template (dengan data contoh) ke alamat email user yang sedang login, tanpa mempengaruhi data produksi.
- **Data contoh (example data)**: data dummy/sample dari Model target dipakai untuk preview/test send, dihasilkan lewat mekanisme sejenis `ExampleDataService` milik PrintTemplate.

## Requirements

### Requirement 1: EmailTemplate CRUD dan asosiasi Model

**User Story:** As an admin/user dengan permission terkait, I want membuat, melihat, mengubah, dan menghapus EmailTemplate yang terasosiasi ke sebuah Model, so that setiap dokumen bisa punya satu atau lebih template email siap pakai.

#### Acceptance Criteria

1. THE system SHALL menyediakan CRUD (index, create, store, show, update, destroy) untuk EmailTemplate mengikuti pola `resourceDetail` yang dipakai PrintTemplate.
2. WHEN user menyimpan EmailTemplate baru, THE system SHALL mewajibkan field `name`, `model`, `subject`, dan `body_html`/`body_json`.
3. THE system SHALL menolak `name` yang duplikat di antara EmailTemplate yang belum dihapus (unique ignoring soft-deleted).
4. THE system SHALL mengizinkan lebih dari satu EmailTemplate untuk `model` yang sama.
5. WHEN user menandai sebuah EmailTemplate sebagai `is_default`, THE system SHALL otomatis menonaktifkan status default pada EmailTemplate lain dengan `model` yang sama (pola `boot()` hook seperti PrintTemplate).
6. IF sebuah Model belum punya EmailTemplate sama sekali dan user menyimpan EmailTemplate pertama untuk Model tersebut, THEN THE system SHALL menjadikannya default secara otomatis.
7. THE system SHALL menerapkan permission/otorisasi yang sama seperti EmailTemplate mengikuti pola `enforcePermission` PrintTemplate (mengikuti permission resource EmailTemplate sendiri, bukan permission Model target).

### Requirement 2: Editor body (TipTap) dan subject dengan dukungan merge-tag

**User Story:** As a user penyusun template, I want menulis body email dengan rich-text editor dan menyisipkan data dinamis dari Model target, so that email yang terkirim personalized tanpa perlu menulis kode.

#### Acceptance Criteria

1. THE system SHALL menyediakan editor body menggunakan `TiptapEditor` yang sudah ada di `resources/js/Components/TiptapEditor.jsx`.
2. THE system SHALL menyediakan input subject menggunakan `MentionsInput`/`Mention` dari `resources/js/Components/Mention.jsx` (plain-text, single line).
3. WHEN user mengetik trigger karakter mention (`@`) di body atau subject, THE system SHALL menampilkan daftar field yang tersedia dari Model target EmailTemplate yang sedang diedit.
4. THE system SHALL mengambil daftar field yang tersedia dari sebuah endpoint yang mengembalikan kolom dan relasi Model target (mengikuti pola `$this->model::getColumns(2)` milik PrintTemplate).
5. WHEN user memilih sebuah field dari daftar mention di body, THE system SHALL menyisipkannya sebagai mention node yang, saat diserialisasi ke HTML, menghasilkan token Blade valid (`{{ $doc->path->ke->field }}`) — bukan label teks biasa.
6. WHEN user memilih sebuah field dari daftar mention di subject, THE system SHALL menyisipkan token Blade yang setara ke dalam string subject.
7. THE system SHALL menyimpan body dalam dua bentuk: `body_html` (token Blade siap compile) dan `body_json` (struktur TipTap mentah untuk re-edit).
8. WHEN user membuka kembali EmailTemplate yang sudah ada, THE system SHALL merekonstruksi tampilan editor dari `body_json`, termasuk mention chip yang sudah tersimpan.

### Requirement 3: Rendering server-side

**User Story:** As the system, I want mengubah template (subject + body) menjadi HTML final berbasis data dokumen nyata, so that email yang dikirim ke penerima berisi data yang benar tanpa bergantung pada browser penerima.

#### Acceptance Criteria

1. THE system SHALL mengompilasi `subject` dan `body_html` memakai `Blade::render()` dengan data yang disediakan (`doc`, `docInfo`, `company` — prefix sama seperti `RelationTrackerService::DATA_PREFIXES` milik PrintTemplate).
2. WHEN sebuah template mereferensikan relasi Eloquent (mis. `$doc->customer->name`), THE system SHALL secara otomatis eager-load relasi tersebut sebelum compile, untuk menghindari N+1 query.
3. IF sebuah token merujuk relasi atau atribut yang sudah tidak ada pada Model (mis. kolom terhapus), THEN THE system SHALL mencatat warning ke log dan merender token tersebut sebagai string kosong, TANPA menggagalkan seluruh proses render.
4. THE system SHALL menyediakan hasil compile (subject string, body HTML string) melalui satu service (`EmailTemplateRenderService`) yang bisa dipanggil ulang oleh fitur trigger manual/otomatis di spec berikutnya.

### Requirement 4: Test Send

**User Story:** As a user penyusun template, I want mengirim email uji coba ke alamat saya sendiri, so that saya bisa memvalidasi hasil compile template sebelum dipakai untuk kirim sungguhan ke pelanggan/pihak lain.

#### Acceptance Criteria

1. WHEN user menekan aksi "Kirim Test" pada EmailTemplate yang sudah tersimpan, THE system SHALL menghasilkan data contoh dari Model target (mengikuti pola `ExampleDataService` milik PrintTemplate) dan me-render template menggunakan `EmailTemplateRenderService`.
2. THE system SHALL mengirim hasil render sebagai email ke alamat email user yang sedang login (bukan alamat sembarang).
3. THE system SHALL mengirim email test lewat queue yang sudah ada (`SendEmailNotificationJob` via koneksi `database`), bukan secara synchronous.
4. IF pengiriman gagal (error konfigurasi mail, dsb), THEN THE system SHALL menampilkan pesan error ke user melalui flash message Inertia, bukan gagal secara diam-diam.
5. THE system SHALL mewajibkan EmailTemplate sudah tersimpan (punya `id`) sebelum aksi Test Send bisa dijalankan — template yang belum disimpan tidak bisa di-test-send.

## Out of Scope

- Tombol trigger manual di FormPage dan opsi multi-template (spec berikutnya).
- Attachment file lain dan attachment hasil PDF dari PrintTemplate (spec berikutnya; fitur PDF sendiri belum tersedia).
- Trigger otomatis berbasis event dokumen (approve/reject, notifikasi role tertentu seperti Warehouse).
- Template untuk email sistem (reset password, invite user, verifikasi email).
