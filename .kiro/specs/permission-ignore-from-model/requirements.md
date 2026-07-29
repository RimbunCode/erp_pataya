# Requirements Document

## Introduction

Flag `ignorePermission` (mengecualikan controller dari gate 403 permission standar) saat ini adalah property yang di-hardcode di masing-masing controller (`TicketController`, `TodoController`, `ChangelogController`). Nilainya tidak terlihat oleh frontend — FE hanya menerima prop `permissions` (hasil resolve role permission per user), sehingga tidak ada cara untuk membedakan "model ini memang sengaja tanpa gate permission" dari "user ini kebetulan tidak punya permission apapun".

Perubahan ini memindahkan source-of-truth flag tersebut ke kolom baru `ignore_permission` pada tabel `permissions` (dibaca lewat model, bukan lagi property controller), dan mengekspos daftar model yang bypass ke FE lewat prop Inertia baru. Titik eksekusi gate (constructor `Controller.php`) tidak berubah — hanya sumber nilainya.

Sekaligus menutup gap keamanan pada ToDo: saat ini `TodoController` bypass gate 403 sepenuhnya tanpa row-level check, sehingga user manapun yang tahu ID sebuah ToDo bisa mengakses/mengubah/menghapus ToDo milik orang lain tanpa permission apapun.

Riset lanjutan menemukan dampak ke frontend: `checkPermission()` (`resources/js/lib/utils.js`) me-return `allowed: false` ketika `permissions[model]` tidak ada — dan model bypass memang tidak pernah punya entry di situ. Ini membuat tombol aksi (create/delete/submit/write/dll) di `DataTable2`, `FormPage`, dan `LinkModel` ikut hilang untuk model bypass, meski backend mengizinkan aksinya tanpa gate. Sebagian sudah ditambal manual (`forceCanCreate` di `DataTable2`), sebagian belum (delete-row-action di `DataTable2`, semua tombol aksi di `FormPage` — termasuk bug pre-existing yang sudah ada hari ini di halaman ToDo Show). Perubahan ini juga memperbaiki akar masalah tsb secara terpusat.

## Glossary

- **ignore_permission**: kolom boolean baru di tabel `permissions` (master, satu baris per model) yang menandai bahwa model tersebut tidak melalui gate 403 CRUD standar di `Controller::__construct()`.
- **ignorePermissionModels**: prop Inertia baru (`string[]`, daftar FQCN model) yang di-share ke FE lewat `AppMiddleware`, berisi semua model dengan `ignore_permission = true`.
- **Self-access (ToDo)**: kondisi di mana user login adalah salah satu assignee ToDo (`allocatedUsers()` mencakup dirinya, langsung atau lewat role) atau pembuat assignment (`assigned_by_id` = dirinya).
- **Permission eksplisit**: izin yang diberikan lewat halaman Role & Permission settings (`role_permissions`), dicek via `PermissionChecker::can()`.
- **canDelete**: property model-level (`Ticket::$canDelete = false`, `Todo::$canDelete = true`) yang menandai apakah fitur delete didukung sama sekali untuk model tersebut — independen dari permission, TIDAK terpengaruh perubahan ini.

## Requirements

### Requirement 1: Kolom `ignore_permission` di tabel `permissions`

**User Story:** As a developer yang mengatur permission model, I want kolom `ignore_permission` tersimpan di tabel `permissions` per model, so that status "model ini bypass gate permission" adalah data, bukan hardcode tersebar di banyak controller.

#### Acceptance Criteria

1. THE tabel `permissions` SHALL memiliki kolom baru `ignore_permission` (boolean, default `false`).
2. THE method `Permission` model SHALL meng-cast kolom `ignore_permission` sebagai boolean.
3. WHEN `initPermissions()` (trait `DataTable`) dijalankan untuk sebuah model, THE sistem SHALL menulis nilai `static::$ignorePermission ?? false` milik model tersebut ke kolom `ignore_permission`.
4. THE proses ini SHALL berjalan otomatis lewat `PermissionSeeder` yang sudah ada, tanpa perubahan pada `PermissionSeeder.php` itu sendiri.

### Requirement 2: Model sebagai source-of-truth, bukan controller

**User Story:** As a developer, I want menentukan bypass permission di model, so that satu deklarasi berlaku konsisten baik untuk gate backend maupun exposure ke FE.

#### Acceptance Criteria

1. THE model `Ticket` SHALL men-declare `protected static bool $ignorePermission = true;`.
2. THE model `Todo` SHALL men-declare `protected static bool $ignorePermission = true;`.
3. THE `TicketController` SHALL TIDAK LAGI men-declare property `$ignorePermission` sendiri.
4. THE `TodoController` SHALL TIDAK LAGI men-declare property `$ignorePermission` sendiri.
5. THE `Controller::__construct()` SHALL membaca status bypass dari `$this->model::ignoresPermission()` (bukan lagi `$this->ignorePermission` milik controller) untuk controller yang memiliki `$this->model` ter-set.
6. IF sebuah controller tidak memiliki `$this->model` ter-set (mis. `NotificationController`, `ApprovalInstanceController`, `SetupUserController`), THEN THE sistem SHALL tetap menggunakan property `$this->ignorePermission` milik controller tersebut sebagai fallback (di luar scope perubahan ini).
7. Behavior gate 403 untuk semua controller SELAIN Ticket/Todo/Changelog SHALL TIDAK BERUBAH dibanding sebelum perubahan ini.

### Requirement 3: Expose daftar model bypass ke frontend

**User Story:** As a frontend developer, I want tahu model mana saja yang tidak melalui gate permission, so that UI (mis. halaman Role & Permission settings) bisa menampilkan indikator yang sesuai alih-alih menyiratkan seolah user tidak punya akses.

#### Acceptance Criteria

1. THE `AppMiddleware` SHALL men-share prop Inertia baru `ignorePermissionModels` berisi array FQCN semua model dengan `ignore_permission = true`.
2. THE penambahan prop ini SHALL TIDAK MENGUBAH struktur/kontrak prop `permissions` yang sudah ada.
3. THE fungsi `checkPermission()` (`resources/js/lib/utils.js`) SHALL menerima parameter tambahan `ignorePermissionModels` dan mengembalikan `{allowed: true, onlyCreator: false}` untuk model manapun yang ada di dalamnya, TANPA memeriksa isi `permissions[model]`.
4. THE hook `usePermission()` SHALL meneruskan `ignorePermissionModels` (dari `usePage().props`) ke `checkPermission()` secara otomatis, sehingga SEMUA pemanggil `can()`/`canGlobal()` (termasuk `DataTable2`, `FormPage`, `LinkModel`) konsisten tanpa perubahan di komponen masing-masing.
5. THE komponen `NavMain.jsx` (pemanggil `checkPermission()` langsung, bukan lewat hook) SHALL juga diteruskan `ignorePermissionModels` agar menu sidebar untuk model bypass tidak ikut hilang.

### Requirement 4: Tickets — bypass penuh tanpa batasan

**User Story:** As a pengguna, I want CRUD Ticket tanpa dibatasi permission apapun, so that semua user bisa membuat dan menindaklanjuti tiket tanpa hambatan administratif.

#### Acceptance Criteria

1. THE sistem SHALL mengizinkan SEMUA user yang sudah login melakukan create, read, update, dan delete pada Ticket tanpa gate permission.
2. Behavior ini SHALL identik dengan behavior sebelum perubahan (regresi: tidak ada perubahan akses).

### Requirement 5: ToDo — baca bebas untuk semua user, tulis/hapus dibatasi row-level

**User Story:** As a pengguna, I want melihat detail ToDo siapapun tanpa hambatan, tapi hanya bisa mengubah/menghapus ToDo yang ditugaskan ke saya atau yang saya buat sendiri (kecuali diberi izin eksplisit), so that transparansi tugas tim tetap terjaga tanpa membuka celah user mengubah/menghapus tugas orang lain secara sembarangan.

#### Acceptance Criteria

1. WHEN user manapun (assignee, assigner, atau bukan keduanya) mengakses (`show`) sebuah ToDo, THE sistem SHALL selalu mengizinkan akses baca — TIDAK ADA gate permission atau row-level check untuk aksi ini.
2. WHEN user mengubah (`update`) atau menghapus (`destroy`) sebuah ToDo, AND user tersebut adalah salah satu assignee ToDo itu (langsung, atau lewat keanggotaan role yang menjadi `allocated_to`) ATAU `assigned_by_id` ToDo itu adalah user tersebut, THEN THE sistem SHALL mengizinkan akses tanpa syarat permission tambahan.
3. WHEN user mengubah (`update`) atau menghapus (`destroy`) sebuah ToDo yang BUKAN miliknya (bukan assignee, bukan assigner), AND user tersebut TIDAK memiliki permission eksplisit (`write`/`delete` sesuai aksi) pada model `Todo` dari Role & Permission settings, THEN THE sistem SHALL mengembalikan 403.
4. WHEN user mengubah/menghapus ToDo yang bukan miliknya, AND user tersebut MEMILIKI permission eksplisit yang sesuai pada model `Todo`, THEN THE sistem SHALL mengizinkan akses.
5. THE behavior visibility scoping pada `index()` (`Todo::assignedToMe()` untuk user tanpa permission `select`) SHALL TIDAK BERUBAH oleh perubahan ini.
6. THE row-level check ini SHALL diimplementasikan secara eksplisit di `TodoController`, hanya pada `update()`/`destroy()` (bukan `show()`, bukan digeneralisasi ke trait/base `Controller` lain), karena field assignment ToDo (`allocated_to_id`/`assigned_by_id`) berbeda dari convention `created_by_id` yang dipakai model submitable lain.
7. WHEN user mengakses ToDo yang bukan miliknya dan tidak memiliki permission untuk update/destroy (kondisi kriteria 3), THE frontend TIDAK PERLU menyembunyikan tombol delete/save sebelum request dikirim — 403 dari server ditangani oleh error handler generic yang sudah ada (mis. toast error).

### Requirement 6: Role & Permission settings — picker rule baru mengecualikan model bypass TOTAL saja (bukan semua ignore_permission)

**User Story:** As an admin yang mengatur Role & Permission, I want model yang bypass TOTAL (tidak pernah butuh row_permissions sama sekali, seperti Ticket) tidak muncul saat memilih model untuk rule baru, so that saya tidak membuat rule yang tidak akan pernah berefek — tapi model yang tetap punya jalur permission eksplisit (seperti Todo, untuk akses non-owner) TETAP bisa diatur.

**Catatan penting (revisi setelah temuan)**: `ignore_permission = true` TIDAK berarti "model ini tidak pernah butuh entry apapun di `role_permissions`". Untuk `Todo`, gate CRUD standar di-bypass, TAPI `authorizeOwnTodoOrPermission()` tetap membaca `role_permissions` lewat `PermissionChecker::can()` untuk kasus non-owner (Requirement 5.4). Kalau `Todo` di-exclude dari picker, admin tidak akan pernah bisa memberi permission eksplisit tsb — jalur itu jadi mati. Karena itu exclusion HARUS granular per konteks pemakaian, bukan berdasarkan kolom `ignore_permission` semata.

#### Acceptance Criteria

1. THE picker model di `FormNewRule.jsx` (dialog "Add Rule") SHALL mengecualikan model `Ticket` dan `Changelog` (bypass total tanpa jalur permission eksplisit apapun) dari daftar pilihan.
2. THE picker model di `FormNewRule.jsx` SHALL TIDAK mengecualikan `Todo` — model ini tetap harus bisa dipilih untuk diberi rule, karena rule tsb dipakai jalur `authorizeOwnTodoOrPermission()` (akses non-owner).
3. Pengecualian ini SHALL diterapkan lewat parameter `filters` yang dikirim `FormNewRule.jsx` ke endpoint pencarian model, berupa daftar FQCN eksplisit (`filters: {model: {notIn: ['App\\Models\\Helpdesk\\Ticket', 'App\\Models\\Core\\Changelog']}}`) — BUKAN filter berdasarkan kolom `ignore_permission` (karena `Todo` juga `ignore_permission=true`, filter berbasis kolom itu akan ikut meng-exclude `Todo`), dan BUKAN scope backend permanen di `Permission` model — supaya pemanggil `PermissionLinkModel` lain (mis. `EmailTemplate/Form.jsx`, `DeliveryNotes/Form.jsx`, `ApprovalScheme/Form.jsx`) yang TIDAK PERLU exclude apapun tetap menampilkan semua model termasuk Ticket/Todo/Changelog.
4. Rule yang SUDAH ADA sebelumnya untuk model manapun SHALL TIDAK dihapus otomatis — hanya penambahan rule BARU di picker yang dipengaruhi filter ini.
5. Tampilan daftar rule existing di `Roles/Form.jsx` SHALL TIDAK BERUBAH (tidak ada badge/disabled state tambahan — di luar scope).

## Out of Scope

- Controller `NotificationController`, `ApprovalInstanceController`, `SetupUserController` — tetap pakai property `$ignorePermission` di controller (tidak memiliki model target untuk digate).
- Perubahan struktur tabel `role_permissions` — flag `ignore_permission` murni per-model (tabel `permissions`), bukan per-role.
- Generalisasi row-level self-access check ke model/fitur lain di luar ToDo.
- Frontend self-access check tambahan di halaman ToDo Show (mis. sembunyikan tombol kalau bukan milik sendiri) — 403 dari backend cukup ditangani error handler generic.
- Badge/indikator visual "model ini bypass gate" pada baris rule existing di `Roles/Form.jsx` — hanya picker rule baru yang difilter (Requirement 6).
- Perubahan pada `canDelete` (property model-level, mekanisme independen dari permission).
- Kolom/flag tambahan untuk membedakan "bypass total" vs "bypass gate tapi tetap punya jalur permission eksplisit" secara otomatis di backend — exclusion cukup diatur manual lewat `filters` di picker (Requirement 6.3), tidak perlu kolom DB baru.
