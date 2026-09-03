# Requirements Document

## Introduction

Saat ini `SavedFilter` (`app/Models/Core/SavedFilter.php`) hanya mendukung filter **private**: setiap row terikat ke satu `user_id`, dan `scopeOwnedListing()` hanya menampilkan filter milik user yang login. Satu-satunya bentuk "sharing" yang ada sekarang adalah share-link manual (`?fid=<id>`) — user lain bisa membuka tree filter orang lain lewat link, tapi tidak ada tempat terpusat untuk melihat/mengelola filter mana saja yang memang **disediakan untuk dipakai bersama**.

Fitur ini menambahkan konsep **shared filter** (visibility global — lihat keputusan di bawah): filter yang di-publish oleh user berpermission khusus supaya otomatis muncul di listing filter semua user untuk model/tabel yang sama, tanpa perlu share-link. Pengelolaannya dipusatkan di halaman menu baru **"Filter Templates"** pada module Core.

## Glossary

- **Private filter**: SavedFilter existing, `user_id`-scoped, hanya terlihat pemiliknya (perilaku SAAT INI, tidak berubah).
- **Ephemeral filter**: SavedFilter dengan `is_saved = false` — draft otomatis dari state builder, belum diberi nama (perilaku existing, axis independen dari shared/private).
- **Named filter**: SavedFilter dengan `is_saved = true` — filter yang diberi nama eksplisit oleh user (perilaku existing).
- **Shared filter** *(baru)*: named filter yang ditandai visible-global — muncul di listing filter SEMUA user untuk `model` yang sama, terlepas dari `user_id` pembuatnya.
- **Default filter** *(baru)*: shared filter yang ditandai `is_default = true` untuk suatu `model` — otomatis diterapkan saat user membuka halaman list model tsb tanpa filter aktif. Maksimal SATU default per `model`.
- **Filter Templates** *(baru)*: halaman admin di module Core (`resources/js/Pages/Core/...`) untuk list, create, edit, delete shared filter lintas model.
- **Pengelola**: user yang punya permission untuk create/update/delete shared filter (lihat Requirement 3).

## Requirements

### Requirement 1: Halaman Filter Templates (CRUD terpusat)

**User Story:** As a pengelola, I want satu halaman untuk melihat dan mengelola semua shared filter lintas model, so that saya tidak perlu membuat/mengubah shared filter satu-satu lewat share-link manual di tiap halaman list.

#### Acceptance Criteria

1. THE Filter Templates page SHALL menampilkan daftar seluruh shared filter (lintas `model`), dengan kolom minimal: nama filter, model/tabel target, pembuat, terakhir diubah.
2. WHEN pengelola membuka Filter Templates, THE system SHALL mengelompokkan atau memfilter daftar berdasarkan `model` (karena satu shared filter hanya berlaku untuk satu model/tabel).
3. WHEN pengelola membuat shared filter baru dari Filter Templates, THE system SHALL meminta pengelola memilih `model` target dan menyusun filter tree-nya memakai komponen filter-builder yang sudah ada (`FilterBuilderBody`/`useNestedFilters`, `resources/js/Components/Table/Filter/FilterBuilder.jsx`) — bukan membangun UI builder baru dari nol.
3a. THE form Filter Templates SHALL menyediakan field "Import dari filter lain" — memuat `filter` tree dari saved filter (private ATAU shared) manapun yang dipilih pengelola sebagai titik awal builder, yang bisa diedit lebih lanjut sebelum disimpan.
3b. THE form Filter Templates SHALL menyediakan field pengaturan urutan data (sort), mengikuti format `sort` yang sudah dipakai list page existing (nama kolom, opsional prefix `-` untuk descending — lihat `DataTableScope::dataTable()`).
3c. WHEN pengelola sedang menyusun filter tree (termasuk draft yang belum disimpan) DAN mengklik preview, THE system SHALL menampilkan data NYATA hasil filter+sort tsb, dibatasi maksimal 5 row, tanpa mengharuskan filter disimpan dulu.
4. WHEN pengelola menghapus shared filter, THE system SHALL langsung membuatnya tidak lagi muncul di listing filter user lain untuk model tersebut.
5. IF pengelola mengedit `filter` tree dari shared filter yang sudah dipakai, THE system SHALL menerapkan versi baru untuk semua user (shared filter tidak di-fork per-user).
6. THE Filter Templates page SHALL menyediakan aksi "Set as Default" per shared filter, dan menampilkan secara visual filter mana yang sedang jadi default per `model`.
7. WHEN pengelola menandai suatu shared filter sebagai default untuk `model` X, THE system SHALL otomatis melepas status default dari shared filter lain yang sebelumnya default untuk `model` X yang sama (maksimal satu default aktif per model, lihat Requirement 4 AC 6).
8. WHEN pengelola menghapus shared filter yang berstatus default, THE system SHALL melepas status default tsb (tidak ada default tersisa untuk model itu sampai pengelola menetapkan yang baru) — TIDAK auto-assign default ke shared filter lain secara implisit.

### Requirement 2: Shared filter muncul di dropdown filter existing

**User Story:** As a user biasa, I want melihat shared filter yang relevan saat membuka dropdown filter di suatu halaman list, so that saya bisa langsung pakai filter yang sudah disiapkan pengelola tanpa menyusun ulang dari nol.

#### Acceptance Criteria

1. WHEN user membuka dropdown saved filter (`FilterTable2.jsx`) untuk suatu `model`, THE system SHALL menampilkan gabungan: filter private milik user tsb + shared filter untuk `model` yang sama.
2. THE system SHALL menandai secara visual (mis. badge "Shared") filter mana yang shared vs private, agar user tidak salah kira shared filter sebagai filter pribadinya.
3. WHEN user memilih shared filter dari dropdown DAN mengubahnya, THE system SHALL menyimpan perubahan sebagai filter BARU milik user tsb (fork-on-edit) — bukan menimpa shared filter asal. Ini mengikuti pola `store()` existing (update-or-create hanya berlaku untuk ephemeral filter milik sendiri).
4. WHEN user membuka halaman list suatu `model` TANPA filter aktif (tidak ada `?fid=`, tidak ada filter tersimpan di state/cookie halaman itu), AND `model` tsb punya default filter, THEN THE system SHALL otomatis menerapkan default filter tsb.
5. IF user secara eksplisit mengubah/menghapus filter aktifnya (termasuk clear filter) setelah default ter-apply, THEN THE system SHALL menghormati pilihan user tsb untuk sesi tersebut — TIDAK memaksa balik ke default filter.

### Requirement 3: Kontrol akses (permission khusus)

**User Story:** As an administrator sistem permission, I want hanya user dengan permission tertentu yang bisa publish/edit/hapus shared filter, so that filter yang dipakai banyak orang tidak bisa diubah sembarangan oleh user biasa.

#### Acceptance Criteria

1. THE system SHALL menggunakan mekanisme permission per-model STANDAR yang sudah dipakai controller admin lain (`EmailTemplateController`, `PrintTemplateController`, dst — dispatcher `match($method)` di `Controller::__construct`), terikat ke model `SavedFilter`, BUKAN membuat sistem permission baru/ad-hoc.
2. IF user tidak punya permission yang sesuai (`select` utk lihat daftar, `create` utk buat, `write` utk ubah/set-default, `delete` utk hapus) pada `SavedFilter`, THEN THE system SHALL menolak akses ke action Filter Templates terkait (403) dan tidak menampilkan aksi yang bersangkutan di UI.
3. THE system SHALL tetap mengizinkan SEMUA user (tanpa permission khusus) membuat/mengubah/menghapus filter PRIVATE miliknya sendiri, seperti perilaku existing — `SavedFilterController` (filter privat) TIDAK ikut terikat dispatcher permission ini (beda controller dari `FilterTemplateController`), jadi axis private tidak pernah kena gate baru ini.
4. WHEN shared filter dibuat/diubah oleh pengelola, THE system SHALL mencatat siapa & kapan (audit trail) — dipenuhi otomatis via `SavedFilter` mengadopsi trait `App\Traits\DataTable` (hook `bootDataTable()` men-dispatch `AuditableModelSaved` → `App\Models\Core\Log`, pola SAMA dengan model admin lain), bukan implementasi audit custom.
5. THE system SHALL mengizinkan pengelola (punya permission yang sesuai pada `SavedFilter`) membaca preview dan menyimpan/mengubah shared filter untuk SEMUA model terdaftar (lihat Requirement 4 AC 9 & MenuItem registry di design.md) TANPA mensyaratkan permission tambahan atas model target tsb — dispatcher permission HANYA mengecek `SavedFilter::class` (model yang di-bind ke controller), tidak pernah mengecek FQCN model target dari body request.

### Requirement 4: Perluasan data model SavedFilter

**User Story:** As a developer, I want skema `saved_filters` mendukung flag shared tanpa merusak semantics `is_saved` (named/ephemeral) yang sudah ada, so that fitur existing (private filter, share-link `?fid=`) tetap jalan tanpa migrasi data yang merusak.

#### Acceptance Criteria

1. THE system SHALL menambah kolom baru (mis. `is_shared boolean default false`) ke tabel `saved_filters` — bukan mengubah makna `is_saved`.
2. THE system SHALL memastikan hanya filter dengan `is_saved = true` yang bisa ditandai `is_shared = true` (shared filter selalu named, tidak pernah ephemeral).
3. WHEN query listing filter untuk suatu model dijalankan (`scopeOwnedListing` atau method baru), THE system SHALL mengembalikan `is_saved = true AND (user_id = :current OR is_shared = true)`.
4. THE Filter Templates index endpoint SHALL hanya mengembalikan row dengan `is_shared = true` (terpisah dari listing pribadi user di `SavedFilterController::index`).
5. THE system SHALL menambah kolom baru `is_default boolean default false` ke tabel `saved_filters`.
6. THE system SHALL memastikan `is_default = true` HANYA valid bila `is_shared = true` (default filter selalu shared, tidak pernah private/ephemeral) — divalidasi di request/service layer, dan penegakan "maksimal satu default per model" dilakukan di service layer (unset default lama sebelum set default baru dalam satu transaksi), bukan lewat unique index DB (SQLite test env tidak mendukung partial unique index dengan baik).
7. WHEN endpoint listing filter (private+shared gabungan, lihat Requirement 2 AC 1) dipanggil, THE response SHALL menyertakan flag `is_default` per row agar FE tahu filter mana yang default tanpa request tambahan.
8. THE system SHALL menambah kolom baru `sort` (string, nullable) ke tabel `saved_filters` — format sama dengan parameter `sort` existing di `DataTableScope::dataTable()` (nama kolom, opsional prefix `-` untuk descending).
9. THE system SHALL menyediakan endpoint preview yang menerima `model`, `filter` (tree, boleh draft/belum tersimpan), dan `sort`, lalu mengembalikan MAKSIMAL 5 row data nyata (query langsung, bukan dari cache) — dibatasi kolom aman model tsb (pola sama dengan penyaringan kolom di `ModelController`, agar preview tidak membocorkan kolom yang seharusnya tersembunyi).

### Requirement 5: Sort tersimpan ikut diterapkan saat filter dipakai

**User Story:** As a user, I want saat saya pilih saved filter (private atau shared) yang punya pengaturan sort, urutan datanya ikut berubah otomatis, so that saya tak perlu mengatur ulang sort secara manual tiap kali pakai filter tsb.

#### Acceptance Criteria

1. WHEN user menerapkan (Apply) suatu saved filter yang punya `sort` terisi, THE system SHALL menerapkan `sort` tsb ke list page (override parameter `sort` halaman saat itu).
2. IF saved filter yang diterapkan tidak punya `sort` (null), THEN THE system SHALL mempertahankan sort halaman yang sedang aktif (tidak reset ke default).

## Pertanyaan Terbuka untuk Design

Semua terjawab di `design.md`:

- ~~Desk placement~~ → RESOLVED: desk Settings, group "Templates" (sama seperti Print/Email Templates), lihat `DeskSeeder.php:309-310` sebagai template.
- ~~Permission~~ → RESOLVED (dikoreksi user 2026-09-02, lihat design.md): mekanisme permission STANDAR (`Controller::__construct` + `match($method)`), BUKAN `Permission::Share`. `SavedFilter` adopsi trait `App\Traits\DataTable`, registrasi ke tabel `permissions` OTOMATIS via `PermissionSeeder`→`initPermissions()` (auto-discovery, tidak perlu seeder manual). Nama tampilan "Filter Templates" di-set via `SavedFilter::$alias`, TIDAK sama dengan nama class — aman, tapi perlu override `getNameClass()` juga (pola sama `StockLedgerEntry`) supaya breadcrumb/navigasi generik tidak nyasar ke route `savedFilters.*` yang tidak terdaftar.
- ~~"tidak ada filter aktif"~~ → RESOLVED: `!query?.fid` di `DataTable2.jsx` (lihat baris ~170 file itu).
- ~~Lokasi endpoint preview~~ → RESOLVED: method `preview()` di controller BARU `FilterTemplateController` (bukan method tambahan di `SavedFilterController` yang ada) — lihat rationale di design.md § Components and Interfaces.
