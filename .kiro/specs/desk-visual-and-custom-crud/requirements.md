# Requirements Document

## Introduction

Spec `desk-based-ui` sudah mengimplementasikan konsep Desk dasar (workspace grouping ala ERPNext): sidebar dinamis per-Desk, resolve desk aktif via cookie, dan grid `/desks` untuk switch antar Desk. Dua gap masih tersisa dari kebutuhan aslinya:

1. **Visual warna icon Desk** — saat ini hanya ada 1 kolom `color` (dipakai sebagai background), sehingga kontras teks/icon di atasnya tidak bisa dikontrol dan berpotensi tidak terbaca di kombinasi warna tertentu, terutama saat berpindah tema light/dark.
2. **Custom Desk belum bisa dikelola dari UI** — backend `store()` untuk custom desk sudah ada sejak spec sebelumnya, tapi tidak ada tombol/form untuk memicunya, dan tidak ada cara edit/hapus custom desk sama sekali. Sistem permission granular per-model (`Select/Read/Write/Create/Delete`) yang sudah dipakai resource lain di aplikasi juga belum diterapkan ke Desk — CRUD-nya masih pakai pengecekan permission manual ad-hoc di controller.

Spec ini menutup kedua gap tersebut, termasuk migrasi `DeskController` ke pola `Route::resourceDetail` yang sudah jadi standar resource lain di codebase, dan penggantian skema pivot ganda `desk_role`/`desk_user` menjadi satu skema polymorphic `desk_assignables` yang mendukung dua mode: desk personal (assignable tunggal implisit = pemilik) dan desk yang dibagikan ke banyak role/user.

## Glossary

- **Desk**: entitas workspace/grouping menu per domain kerja (mis. Sales, Purchase, Inventory), tiap Desk punya sidebar dan dashboard sendiri.
- **Desk System**: Desk bawaan aplikasi (10 desk per-domain dari seeder), tidak bisa dihapus, selalu tampil layout penuh.
- **Desk Custom**: Desk yang dibuat user (personal atau dibagikan), bisa diedit/dihapus oleh pemilik atau pemegang Permission Desk.
- **Desk personal**: Desk Custom yang hanya bisa diakses satu user (pembuatnya) — baik karena dibuat tanpa Permission Desk (selalu personal), maupun dibuat oleh pemegang Permission Desk yang memilih mode "personal saja".
- **Desk dibagikan (shared)**: Desk Custom yang assignable-nya lebih dari satu — bisa diakses banyak role/user, hanya bisa dibuat/diubah ke mode ini oleh pemegang Permission Desk.
- **Assignable**: baris di tabel `desk_assignables` yang menyatakan satu role atau satu user berhak mengakses sebuah Desk Custom (polymorphic: `assignable_type` = `role`/`user`).
- **Permission Desk**: permission granular (`Select/Read/Write/Create/Delete`) pada model `Desk`, dicek via `PermissionChecker` seperti model lain di aplikasi.
- **fullLayout**: mode tampilan halaman show Desk — `true` berarti sidebar aplikasi, BranchSwitcher, dan DeskSwitcher tampil normal (seperti halaman resource biasa); `false` berarti ketiganya disembunyikan (breadcrumb tetap tampil).
- **is_personal_only**: kolom boolean pada Desk yang secara eksplisit menandai apakah Desk tersebut dalam mode personal (assignable dipaksa tunggal = pemilik) atau mode dibagikan.

## Requirements

### Requirement 1: Warna icon Desk terpisah background/foreground

**User Story:** As a pengguna aplikasi, I want warna latar dan warna teks/icon Desk bisa diatur terpisah, so that kontras selalu terjaga dan tidak rusak saat aplikasi berpindah tema light/dark.

#### Acceptance Criteria

1. THE sistem SHALL menyimpan `background_color` dan `foreground_color` sebagai dua kolom terpisah pada tabel `desks`, menggantikan kolom `color` tunggal yang ada sebelumnya.
2. WHEN `background_color` dan `foreground_color` keduanya kosong (null) ATAU salah satu di antaranya kosong, THE sistem SHALL merender container icon Desk mengikuti gaya tema aplikasi yang sedang aktif (ikut light/dark mode) DAN menambahkan border pada container tersebut sebagai penanda visual.
3. WHEN `background_color` dan `foreground_color` keduanya terisi, THE sistem SHALL merender container icon Desk memakai kedua nilai tersebut secara literal (inline style) TANPA dipengaruhi tema light/dark yang sedang aktif.
4. THE sistem SHALL menerapkan aturan render pada AC 2 dan AC 3 di semua tempat yang menampilkan icon Desk, termasuk grid `/desks` dan halaman show Desk.
5. THE form create/edit Desk SHALL menyediakan field input untuk `background_color` dan `foreground_color`.
6. THE seeder Desk System SHALL mengisi `background_color` dan `foreground_color` untuk seluruh 10 Desk bawaan dengan pasangan warna yang kontras dan terbaca.

### Requirement 2: Permission Desk granular

**User Story:** As seorang administrator, I want akses kelola Desk diatur lewat sistem permission granular yang sama seperti resource lain, so that saya bisa memberi hak Create/Read/Write/Delete pada Desk secara konsisten dengan model lain di aplikasi.

#### Acceptance Criteria

1. THE sistem SHALL mendaftarkan model `Desk` ke sistem permission granular (`Select/Read/Write/Create/Delete`) melalui mekanisme auto-discovery yang sudah berlaku untuk model lain berbasis trait `DataTable`.
2. THE `DeskController` SHALL memakai `PermissionChecker` yang sama dengan resource lain untuk mengevaluasi hak akses tiap aksi CRUD, menggantikan pengecekan permission manual ad-hoc yang ada sebelumnya.

### Requirement 3: Migrasi DeskController ke pola resourceDetail

**User Story:** As seorang developer, I want DeskController mengikuti pola routing dan guard permission standar (`Route::resourceDetail`) yang sudah dipakai resource lain, so that struktur route dan permission-mapping-nya konsisten dan mudah dipelihara.

#### Acceptance Criteria

1. THE route Desk SHALL didaftarkan melalui macro `Route::resourceDetail('desk', DeskController::class)`, menggantikan route manual `desks.index`/`desks.store` yang ada sebelumnya.
2. THE `DeskController` SHALL extends base `Controller` dan menerima permission-mapping otomatis (`index→select, create/store→create, show→read, update→write, destroy→delete`).
3. WHEN method aksi adalah `index`, THE `DeskController` SHALL mem-bypass guard permission formal (lewat override `exceptPermission`) SEHINGGA setiap user terautentikasi tetap bisa mengakses `/desks` terlepas dari kepemilikan Permission Desk.
4. WHEN method aksi adalah `show`, `update`, atau `destroy` DAN Desk yang diakses bertipe Custom DAN `owner_id` Desk tersebut sama dengan user yang sedang login, THE `DeskController` SHALL mem-bypass guard permission formal untuk aksi tersebut.
5. IF kondisi AC 4 tidak terpenuhi, THEN THE `DeskController` SHALL memakai guard permission formal standar (`read`/`write`/`delete`) sesuai permission-mapping AC 2.
6. THE route `desk.switch` dan `desk.setDefault` SHALL tetap terdaftar sebagai route manual terpisah (bukan bagian dari `resourceDetail`).
7. THE route `desk.roles.store` SHALL dihapus dari `routes/web.php`.
8. WHEN user memanggil `index()`, THE `DeskController` SHALL mengembalikan seluruh Desk (tanpa filter kepemilikan) JIKA user memiliki Permission Desk `Select`, DAN SEBALIKNYA mengembalikan hanya Desk yang visible baginya (via `DeskResolverService::visibleDesksFor()`) jika tidak.

### Requirement 4: Skema desk_assignables menggantikan desk_role/desk_user

**User Story:** As seorang developer, I want satu skema assignable polymorphic yang mendukung baik desk personal maupun desk dibagikan, so that logika kepemilikan/visibilitas Desk Custom tidak lagi tersebar di dua tabel pivot terpisah.

#### Acceptance Criteria

1. THE sistem SHALL menyediakan tabel `desk_assignables` dengan kolom `desk_id`, `assignable_type` (`role` atau `user`), dan `assignable_id`, menggantikan tabel `desk_role` dan `desk_user`.
2. THE sistem SHALL menghapus model `DeskRole` dan `DeskUser` beserta migration pembuatnya.
3. THE `Desk` model SHALL menyediakan relasi `assignables()` yang menggantikan relasi `roles()` dan `users()` yang dihapus.
4. WHEN sebuah Desk dihapus (soft delete), THE sistem SHALL menghapus seluruh baris `desk_assignables` milik Desk tersebut melalui listener event yang sudah ada.
5. THE `DeskResolverService::visibleDesksFor()` SHALL mengembalikan Desk Custom yang assignable-nya cocok dengan salah satu role user YANG SEDANG LOGIN, ATAU assignable-nya adalah user tersebut secara langsung.

### Requirement 5: Mode personal vs dibagikan pada Desk Custom

**User Story:** As pengguna tanpa Permission Desk, I want Desk Custom yang saya buat otomatis bersifat pribadi tanpa perlu mengatur siapa saja yang boleh mengaksesnya, so that saya tidak dibebani pengaturan yang tidak relevan untuk kebutuhan personal.

**User Story:** As pemegang Permission Desk, I want bisa memilih apakah Desk Custom yang saya buat bersifat personal (eksklusif untuk saya sendiri) atau dibagikan ke role/user tertentu, so that saya bisa membuat Desk pribadi maupun Desk tim sesuai kebutuhan.

#### Acceptance Criteria

1. THE tabel `desks` SHALL memiliki kolom `is_personal_only` (boolean, default `false`).
2. WHEN user TANPA Permission Desk `Create` membuat Desk Custom, THE sistem SHALL membuat tepat satu baris `desk_assignables` dengan `assignable_type='user'` dan `assignable_id` sama dengan user pembuat, DAN mengeset `is_personal_only=true`, TANPA menampilkan field assignable pada form.
3. THE form create/edit Desk Custom SHALL menampilkan toggle "Bagikan ke Role/User" HANYA JIKA user yang login memiliki Permission Desk `Create` (saat membuat) atau `Write` (saat mengedit).
4. WHEN toggle "Bagikan ke Role/User" tidak aktif (personal), THE sistem SHALL menyembunyikan field daftar assignable dari form DAN memperlakukan Desk tersebut sama seperti AC 2 (assignable tunggal = user yang login saat itu, `is_personal_only=true`).
5. WHEN toggle "Bagikan ke Role/User" aktif, THE form SHALL menampilkan tabel input untuk menambah/menghapus baris assignable (`assignable_type` dan `assignable`), DAN sistem SHALL mengeset `is_personal_only=false`.
6. WHEN Desk yang sebelumnya `is_personal_only=false` diubah menjadi `is_personal_only=true` melalui form edit, THE sistem SHALL menghapus seluruh baris `desk_assignables` milik Desk tersebut SEBELUM membuat satu baris baru dengan `assignable_type='user'` dan `assignable_id` sama dengan pemilik Desk.
7. THE toggle mode personal/dibagikan SHALL bisa diubah kapan saja melalui form edit, tidak terbatas hanya saat pembuatan Desk.

### Requirement 6: Layout halaman show Desk mengikuti mode akses

**User Story:** As pengguna yang membuka halaman detail Desk personal, I want halaman tersebut tampil ringkas tanpa elemen navigasi Desk lain, so that saya tidak bingung dengan konteks Desk lain yang tidak relevan untuk pengaturan personal.

#### Acceptance Criteria

1. WHEN Desk yang dibuka bertipe System, THE halaman show Desk SHALL menampilkan layout penuh (sidebar aplikasi, BranchSwitcher, DeskSwitcher semuanya tampil).
2. WHEN Desk yang dibuka bertipe Custom DAN `is_personal_only=false` DAN user yang login memiliki Permission Desk `Select`, THE halaman show Desk SHALL menampilkan layout penuh.
3. WHEN Desk yang dibuka bertipe Custom DAN (`is_personal_only=true` ATAU user yang login tidak memiliki Permission Desk `Select`), THE halaman show Desk SHALL menyembunyikan sidebar aplikasi, BranchSwitcher, dan DeskSwitcher.
4. THE breadcrumb SHALL tetap tampil pada halaman show Desk terlepas dari kondisi AC 1-3.
5. THE halaman show Desk SHALL dibangun di atas komponen `FormPage` yang sudah ada, bukan komponen baru dari nol.

### Requirement 7: Pengelolaan Desk Custom dari halaman /desks

**User Story:** As pengguna aplikasi, I want bisa membuat, mengedit, dan menghapus Desk Custom langsung dari halaman `/desks`, so that saya tidak perlu berpindah halaman untuk mengelola workspace pribadi saya.

#### Acceptance Criteria

1. THE halaman `/desks` SHALL menampilkan satu tile tambahan bergaya sama dengan tile Desk lain (`bg-muted`) sebagai tombol tambah Desk baru.
2. WHEN tombol tambah Desk diklik, THE sistem SHALL membuka dialog form yang mengirim data langsung ke endpoint store Desk, tanpa berpindah halaman.
3. THE field pada dialog tambah Desk untuk user TANPA Permission Desk `Create` SHALL terbatas pada: nama, icon, `background_color`, `foreground_color`, checkbox jadikan default, dan daftar MenuItem yang diaktifkan (hierarki maksimal 1 level, dengan opsi override icon per-assignment).
4. THE field pada dialog tambah Desk untuk user DENGAN Permission Desk `Create` SHALL mencakup seluruh field pada AC 3 ditambah toggle dan tabel assignable dari Requirement 5.
5. WHEN sebuah Desk Custom bertipe milik user yang sedang login (`owner_id` cocok) DAN user tersebut tidak memiliki Permission Desk, THE dropdown menu pada tile Desk tersebut SHALL menampilkan opsi "Edit" dan "Delete".
6. WHEN user memiliki Permission Desk `Write` dan/atau `Delete`, THE dropdown menu pada SEMUA tile Desk (System maupun Custom milik siapa pun) SHALL menampilkan opsi "Edit" dan/atau "Delete" sesuai permission yang dimiliki.
7. IF Desk bertipe System, THEN THE dropdown menu SHALL TIDAK menampilkan opsi "Delete" terlepas dari permission yang dimiliki user.

### Requirement 8: Bagikan ke semua user/role & nonaktifkan Desk

**User Story:** As pemegang Permission Desk, I want bisa membagikan sebuah Desk Custom ke SEMUA user tanpa memilih satu per satu, dan menonaktifkan sementara sebuah Desk tanpa menghapusnya, so that pengelolaan Desk untuk kebutuhan organisasi lebih fleksibel.

#### Acceptance Criteria

1. THE tabel `desks` SHALL memiliki kolom `is_shared_all` (boolean, default `false`).
2. THE form create/edit Desk Custom SHALL menampilkan checkbox "Bagikan ke semua User/Role" HANYA JIKA toggle "Bagikan ke Role/User" (Requirement 5) aktif.
3. WHEN checkbox "Bagikan ke semua User/Role" aktif, THE sistem SHALL menyembunyikan `NestedDeskAssignableFormTable` (baris assignable spesifik menjadi tidak relevan) DAN mengeset `is_shared_all=true`.
4. THE `DeskResolverService::visibleDesksFor()` SHALL mengembalikan Desk Custom manapun dengan `is_shared_all=true` untuk SEMUA user terautentikasi, terlepas dari baris `desk_assignables` yang ada.
5. THE tabel `desks` SHALL memiliki kolom `is_disabled` (boolean, default `false`).
6. THE form edit Desk (baik System maupun Custom, HANYA untuk pemegang Permission Desk `Write`) SHALL menampilkan checkbox "Nonaktifkan Desk".
7. WHEN sebuah Desk `is_disabled=true`, THE sistem SHALL mengecualikan Desk tersebut dari hasil `DeskResolverService::visibleDesksFor()` untuk SEMUA user (termasuk owner dan pemegang Permission Desk `Select`), KECUALI saat mengakses halaman edit Desk itu sendiri (`desks.show`/`desks.update`) oleh pemegang Permission Desk `Write`.
8. IF Desk aktif user (dari cookie/default) menjadi `is_disabled=true`, THEN THE sistem SHALL fallback ke urutan resolve Desk berikutnya (Requirement dari spec `desk-based-ui`, tidak berubah).

### Requirement 9: Perbaikan navigasi /desks & halaman show (revisi Requirement 6)

**User Story:** As pengguna aplikasi, I want tampilan `/desks` bersih tanpa elemen navigasi yang tumpang tindih, dan halaman show Desk konsisten tanpa sidebar untuk semua kondisi, so that pengalaman mengelola Desk lebih rapi dan dapat diprediksi.

#### Acceptance Criteria

1. THE halaman `/desks` SHALL TIDAK menampilkan breadcrumb apa pun (baik breadcrumb Home maupun breadcrumb dari `Inertia::share('breadcrumbs')`).
2. Requirement 6 AC 1-2 DIHAPUS DAN DIGANTI: THE halaman show Desk SHALL SELALU menyembunyikan sidebar aplikasi, BranchSwitcher, dan DeskSwitcher, UNTUK SEMUA tipe dan kondisi Desk (System, Custom shared, Custom personal), TANPA pengecualian.
3. THE halaman show Desk SHALL menampilkan breadcrumb dengan urutan "Home > Desks > [Nama Desk]" — item "Desks" TIDAK dapat diklik dan tidak boleh berupa key terjemahan mentah (harus label yang terbaca).
4. THE halaman `/desks` SHALL menampilkan toggle "Mode Edit" — saat aktif, tile "Tambah Desk" ditampilkan DAN tile Desk existing menjadi dapat diurutkan ulang (drag and drop); saat tidak aktif, tile "Tambah Desk" disembunyikan dan drag-reorder dinonaktifkan.
5. THE tabel `desks` SHALL memiliki kolom `order` (integer, default `0`) untuk menyimpan urutan tampil.
6. WHEN urutan Desk diubah lewat drag and drop dalam mode edit, THE sistem SHALL menyimpan urutan baru ke server SEGERA (tanpa perlu tombol simpan terpisah), dibatasi hanya pada Desk yang visible bagi user tersebut.
7. THE grid `/desks` SHALL diurutkan berdasarkan kolom `order` secara ascending.
8. THE tile "Tambah Desk" SHALL memiliki container TANPA warna latar (`bg-muted` dihapus dari container), dengan border icon berbentuk garis putus-putus (dashed), dan icon "+" di dalamnya memiliki warna latar (`bg-muted`) — konsisten dengan gaya visual icon Desk lain yang memiliki background.
6b. Requirement 9 AC 6 direvisi: WHEN urutan Desk diubah lewat drag and drop dalam mode edit, THE sistem SHALL menyimpan urutan baru HANYA saat mode edit diakhiri (klik "Selesai"), BUKAN setiap kali satu aksi drag selesai — mencegah request berlebih saat user melakukan banyak drag berturut-turut.

### Requirement 10: Sembunyikan Desk per-preferensi user (revisi urutan Requirement 9)

**User Story:** As pengguna aplikasi, I want menyembunyikan Desk tertentu dari grid `/desks` milik saya sendiri tanpa mempengaruhi tampilan user lain, so that saya bisa menyesuaikan workspace yang relevan untuk saya secara personal.

#### Acceptance Criteria

1. THE sistem SHALL menyediakan tabel `desk_user_preferences` dengan kolom `user_id`, `desk_id`, `order` (nullable), `is_hidden` (boolean, default `false`) — menyimpan preferensi urutan DAN visibilitas Desk secara PER-USER (bukan global).
2. Requirement 9 AC 5 direvisi: THE kolom `desks.order` SHALL tetap ada sebagai urutan DEFAULT/fallback — dipakai untuk Desk yang belum memiliki baris `desk_user_preferences` bagi user yang sedang login.
3. WHEN sebuah Desk memiliki baris `desk_user_preferences` untuk user yang sedang login, THE urutan tampil Desk tersebut bagi user itu SHALL mengikuti `desk_user_preferences.order`, MENGABAIKAN `desks.order`.
4. THE halaman `/desks` dalam mode edit SHALL menampilkan dua area terpisah dalam grid: area "tampil" (Desk yang `is_hidden=false` atau belum punya preferensi) di bagian atas, dan area "tersembunyi" (Desk dengan `is_hidden=true`) di bagian bawah.
5. WHEN Desk di-drag dari area "tampil" ke area "tersembunyi" (atau sebaliknya) dalam mode edit, THE sistem SHALL memperbarui `is_hidden` pada `desk_user_preferences` milik user yang sedang login untuk Desk tersebut.
6. THE tile Desk dalam mode edit SHALL menampilkan tombol "X" di pojok (selain grip handle drag) sebagai cara alternatif memindahkan Desk ke area tersembunyi tanpa drag and drop.
7. THE tile Desk dalam area tersembunyi (mode edit) SHALL menampilkan tombol untuk mengembalikan Desk ke area tampil (mis. icon "+" atau serupa), sebagai alternatif drag and drop.
8. THE `DeskController::index()` (non-mode-edit, tampilan normal) SHALL TIDAK menyertakan Desk dengan `is_hidden=true` (preferensi user yang sedang login) dalam grid yang ditampilkan.
9. THE `DeskController::reorder()` SHALL diperluas untuk menerima dan menyimpan `is_hidden` per Desk, bukan hanya urutan — operasi `upsert` ke `desk_user_preferences` berdasarkan `(user_id, desk_id)`.
10. Preferensi `desk_user_preferences` SHALL TIDAK mempengaruhi `DeskResolverService::visibleDesksFor()` (dipakai resolusi desk aktif/switch/sidebar) — Desk yang disembunyikan di grid `/desks` tetap bisa di-switch/diakses via mekanisme lain (mis. link langsung, MenuItem), hanya TIDAK muncul di grid.
