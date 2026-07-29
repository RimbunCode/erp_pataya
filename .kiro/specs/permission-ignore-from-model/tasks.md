# Implementation Plan: Pindah ignorePermission ke Model + Kolom DB

## Overview

Pindahkan source-of-truth flag `ignorePermission` dari property controller (`TicketController`, `TodoController`, `ChangelogController`) ke kolom baru `ignore_permission` di tabel `permissions`, dibaca via static property model (`static::$ignorePermission`) yang otomatis ke-seed lewat `initPermissions()`. Titik eksekusi gate 403 tetap di `Controller::__construct()` — hanya sumber nilainya berubah. FE menerima daftar model bypass lewat prop Inertia baru `ignorePermissionModels`, dipakai untuk memperbaiki `checkPermission()` secara terpusat (tombol create/delete/submit/write dll tidak lagi hilang untuk model bypass — termasuk memperbaiki bug pre-existing di halaman ToDo Show). Sekaligus menutup gap keamanan ToDo: tambah row-level check manual di `show/update/destroy` (self-access selalu lolos, akses ke ToDo orang lain butuh permission eksplisit). Terakhir, model dengan `ignore_permission=true` dikecualikan dari picker "Add Rule" di halaman Role & Permission settings.

**Catatan implementasi — Changelog di luar scope**: `Changelog` model TIDAK memakai trait `DataTable` (extends `Illuminate\Database\Eloquent\Model` langsung, bukan `App\Models\Model`), sehingga tidak pernah terdaftar di tabel `permissions` dan tidak punya method `ignoresPermission()`. Keputusan: `ChangelogController` TETAP memakai property `$ignorePermission` miliknya sendiri (tidak diubah), sama seperti `NotificationController`/`ApprovalInstanceController`/`SetupUserController`. `Controller::__construct()` menggunakan `method_exists($this->model, 'ignoresPermission')` (bukan `isset($this->model)`) untuk fallback yang aman — mencegah fatal error saat model tanpa trait `DataTable` diteruskan ke constructor.

**Bug tambahan ditemukan & diperbaiki (di luar scope awal, tapi terhubung langsung)**: `TicketController::destroy()` dan `TodoController::destroy()` membuka `DB::beginTransaction()` tanpa try/catch — model event `deleting` (trait `LinkModel`) melempar `ValidationException` saat `canDelete === false`, menyebabkan transaction tidak pernah di-rollback/commit ("nyangkut" terbuka, error "cannot start a transaction within a transaction" di request/test berikutnya). Kedua method ini sudah diperbaiki dengan try/catch + rollback + rethrow. **34 controller lain** dengan pola identik (`SalesOrderController`, `PurchaseOrderController`, `UserController`, `ItemController`, dll) TIDAK diperbaiki — di luar scope spec ini, dicatat sebagai temuan terpisah untuk spec/bugfix lain.

## Tasks

- [x] 1. Database — migrasi kolom `ignore_permission`
  - [x] 1.1 Buat migrasi `database/migrations/2026_07_28_090104_add_ignore_permission_to_permissions_table.php`
    - `up()`: tambah `$table->boolean('ignore_permission')->default(false)->after('allow_only_creator');`
    - `down()`: `dropColumn('ignore_permission')`
    - _Requirements: 1.1_

  - [x] 1.2 Jalankan `php artisan migrate` dan verifikasi kolom muncul di tabel `permissions`
    - _Requirements: 1.1_

- [x] 2. Checkpoint — migrasi berhasil, `php artisan migrate:status` dikonfirmasi `Ran`

- [x] 3. Backend — model `Permission` dan trait `DataTable`
  - [x] 3.1 Tambah `'ignore_permission' => 'boolean'` ke `$casts` di `app/Models/User/Permission.php` (+ `configColumns['ignore_permission']['linkable']=true`)
    - _Requirements: 1.2_

  - [x] 3.2 Di `app/Traits/DataTable.php::initPermissions()`, tambah `'ignore_permission' => (static::$ignorePermission ?? false)` ke array `updateOrCreate()`
    - _Requirements: 1.3, 1.4_

  - [x] 3.3 Tambah static method `ignoresPermission(): bool` di `app/Traits/DataTable.php`
    - _Requirements: 2.5_

- [x] 4. Checkpoint — tidak ada test seeder existing yang perlu dijalankan (di-skip, tidak ada file test terkait)

- [x] 5. Backend — pindahkan flag dari controller ke model
  - [x] 5.1 `Ticket::$ignorePermission = true`; hapus property dari `TicketController`
    - _Requirements: 2.1, 2.3_

  - [x] 5.2 `Todo::$ignorePermission = true`; hapus property dari `TodoController`
    - _Requirements: 2.2, 2.4_

  - [x] 5.3 **Diputuskan keluar scope** — Changelog tidak pakai trait `DataTable`, `ChangelogController` tetap pakai property `$ignorePermission` sendiri (lihat catatan implementasi di atas)
    - _Requirements: 2.1 (dikecualikan, lihat catatan)_

  - [x] 5.4 `Controller::__construct()` diubah jadi `method_exists($this->model, 'ignoresPermission') ? $this->model::ignoresPermission() : $this->ignorePermission` (bukan `isset()` seperti draft awal — lihat catatan implementasi)
    - _Requirements: 2.5, 2.6, 2.7_

  - [x] 5.5 `php artisan db:seed --class=PermissionSeeder` dijalankan, kolom `ignore_permission` terverifikasi `true` untuk Ticket & Todo
    - _Requirements: 1.3_

- [x] 6. Checkpoint — `TicketTest.php` + `TodoTest.php` pass, tidak ada regresi

- [x] 7. Backend — row-level check ToDo (menutup gap keamanan)
  - [x] 7.1 `authorizeOwnTodoOrPermission(Todo $todo, Permission $action): void` ditambahkan di `TodoController`
    - _Requirements: 5.2, 5.3, 5.6_

  - [x] 7.2 **Revisi (2026-07-29)**: `show()` TIDAK memanggil check ini — baca ToDo selalu terbuka untuk siapapun, tanpa gate/row-level check
    - _Requirements: 5.1_

  - [x] 7.3 Dipanggil di `update()` dengan `Permission::Write`
    - _Requirements: 5.2, 5.3, 5.4_

  - [x] 7.4 Dipanggil di `destroy()` dengan `Permission::Delete` (+ fix try/catch transaction, lihat catatan implementasi)
    - _Requirements: 5.2, 5.3, 5.4_

  - [x] 7.5 `index()` (`Todo::assignedToMe()`) tidak diubah — diverifikasi lewat test existing yang tetap pass
    - _Requirements: 5.5_

- [x] 8. Checkpoint — `TodoTest.php` pass sebelum test baru ditambah

- [x] 9. Test — feature test ToDo row-level access
  - [x] 9.1 `test_owner_can_access_own_todo_without_any_permission` + `test_any_user_can_view_todo_regardless_of_ownership`
    - _Requirements: 5.1_

  - [x] 9.2 `test_non_owner_without_permission_gets_403_on_update_and_destroy`
    - _Requirements: 5.2, 5.3_

  - [x] 9.3 `test_non_owner_with_explicit_permission_can_update_todo`
    - _Requirements: 5.4_

  - [x] 9.4 `test_user_without_any_permission_can_still_crud_ticket`
    - _Requirements: 4.1, 4.2_

  - [x] 9.5 `PermissionInitIgnorePermissionTest` (2 test: Ticket/Todo `ignore_permission=true`, model lain default `false`)
    - _Requirements: 1.3_

- [x] 10. Checkpoint — `TodoTest.php` (19 test) + `TicketTest.php` pass semua, tidak ada residual transaction error

- [x] 11. Frontend — expose `ignorePermissionModels` dan fix terpusat `checkPermission()`
  - [x] 11.1 Share prop `ignorePermissionModels` di `AppMiddleware::handle()`
    - _Requirements: 3.1, 3.2_

  - [x] 11.2 `checkPermission()` di `resources/js/lib/utils.js` — parameter baru `ignorePermissionModels`, short-circuit `{allowed:true, onlyCreator:false}`
    - _Requirements: 3.3_

  - [x] 11.3 `usePermission.jsx` — baca `ignorePermissionModels` dari `usePage().props`, teruskan ke `checkPermission()`
    - _Requirements: 3.4_

  - [x] 11.4 `NavMain.jsx` — kedua pemanggilan `checkPermission()` langsung diteruskan `ignorePermissionModels`
    - _Requirements: 3.5_

- [ ] 12. Checkpoint — verifikasi manual di browser (tombol Save/Delete ToDo Show) BELUM dilakukan; tidak ada test JS existing untuk `usePermission` di repo ini

- [x] 13. Backend/Frontend — exclude model bypass TOTAL dari picker `FormNewRule` (direvisi 2x, lihat catatan)
  - [x] 13.1 **Percobaan 1 (dibatalkan)**: `Permission::scopeLinkModel()` — filter `ignore_permission=false` otomatis di SEMUA pemanggilan `LinkModel` model `Permission`. **Salah scope** — `PermissionLinkModel` dipakai di banyak halaman lain (`EmailTemplate/Form.jsx`, `DeliveryNotes/Form.jsx`, `ApprovalScheme/Form.jsx`, dll) yang tidak boleh ikut ter-filter. Dihapus dari `Permission.php`.
    - _Requirements: (superseded, lihat 13.3)_

  - [x] 13.2 **Percobaan 2 (dibatalkan)**: filter FE `filters={{ ignore_permission: false }}` khusus `FormNewRule.jsx`. **Masih salah** — `Todo` juga `ignore_permission=true`, jadi ikut ter-exclude padahal `Todo` butuh tetap tampil (rule permission-nya dipakai `authorizeOwnTodoOrPermission()` untuk kasus non-owner).
    - _Requirements: (superseded, lihat 13.3)_

  - [x] 13.3 **Solusi final**: filter FE `filters={{ model: { notIn: ["App\\Models\\Helpdesk\\Ticket", "App\\Models\\Core\\Changelog"] } }}` di `FormNewRule.jsx` — daftar FQCN eksplisit (bukan berdasar kolom `ignore_permission`), memakai mekanisme `filters`/`applyLinkModelFilters()` yang sudah ada, konsisten pola `notIn` existing (`AssignedToFields.jsx`)
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 13.4 Filter hanya di level request FE, tidak menyentuh data `role_permissions` atau model `Permission` backend
    - _Requirements: 6.4, 6.5_

  - [x] 13.5 `PermissionLinkModelFieldsTest::test_form_new_rule_filter_excludes_ticket_and_changelog_but_keeps_todo` — assert Ticket & Changelog ter-exclude, Todo TETAP muncul
    - _Requirements: 6.1, 6.2_

- [x] 14. Checkpoint — full test suite (`php artisan test --compact`) dijalankan; lint/Pint final menyusul setelah hasil dikonfirmasi
