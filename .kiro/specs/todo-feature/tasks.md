# Implementation Plan: ToDo Feature + "Assigned To" Sidebar Widget

## Overview

Bangun record ToDo polymorphic (`todos` table, model `Todo`) mengikuti pola `Log`/`Taggable`/`Fileable` yang sudah ada, dengan assignee (User ATAU Role) direpresentasikan lewat SATU database VIEW read-only `assignables` (`UNION` tabel `users`+`roles`) dan model `Assignable` — bukan tabel fisik duplikat, bukan polymorphic dual-morph. `todos.allocated_to_id` adalah FK biasa (tanpa constraint fisik) ke `assignables.id`, plus `allocated_to_type` sebagai cache cepat. Satu `LinkModel` (`AssignableLinkModel`) menangani pencarian/pemilihan User maupun Role sekaligus, label `":type : :name"`. Wiring assign/unassign generik ditambahkan ke base `Controller.php` + macro `Route::resourceDetail` (mengikuti pola `addTag`/`addFile`) sehingga otomatis aktif di semua modul tanpa kode per-modul. Modul CRUD standalone (`TodoController`, halaman `/todos`) dan widget sidebar `AssignedTo.jsx` sama-sama beroperasi di tabel `todos` yang sama — tidak ada dua sumber kebenaran. Notifikasi reuse infra existing (`NotifyUser`, `BufferedAttachmentService`), fan-out ke semua anggota role saat assign-ke-role. Aksi CRUD `Todo` (termasuk `index()`) tetap terbuka penuh untuk semua user (`$ignorePermission = true`, tidak ada 403 sama sekali) — filter "Assigned to Me"/"Assigned by Me" di halaman `/todos` HANYA query-param opsional (`?scope=mine|byMe`) yang siapa saja bebas pilih, BUKAN gate permission (revisi final dari draft awal yang sempat memakai `PermissionChecker`).

**Fix lintas-fitur ditemukan lewat ToDo (di luar scope asli spec ini, tapi ditangani di sini karena ditemukan saat implementasi)**: migrasi `notifications` table (dari fitur notifikasi sebelumnya, commit `13834ee`) memakai `$table->morphs('notifiable')` — default Laravel bikin `notifiable_id` bertipe `unsignedBigInteger`, padahal `User::id` di app ini ULID (string 26 karakter). Insert notifikasi manapun (bukan cuma ToDo) selalu truncated/gagal di database bertipe strict (MySQL). Migrasi baru `2026_07_19_000000_fix_notifications_notifiable_id_to_ulid.php` memperbaiki ini (`dropMorphs` + `ulidMorphs`). WAJIB dijalankan di staging/production sebelum fitur notifikasi apapun (termasuk ToDo) dipakai — tanpa ini, SEMUA notifikasi (bukan cuma ToDo) akan gagal insert.

**Catatan penting**: Task 1–14.1 di bawah awalnya diimplementasikan dengan schema single-target (`allocated_to_id` polos, FK langsung ke `users`). Setelah user menambahkan requirement assign-ke-Role + visibility scoping, lalu memutuskan arsitektur `Assignable` VIEW (bukan polymorphic dual-morph yang sempat didesain sebagai iterasi antara), schema awal TIDAK CUKUP dan harus di-refactor. Task-task yang sudah `[x]` dari implementasi pertama ditandai ulang `[ ]` di bawah pada task 18+ (refactor final), BUKAN dihapus dari histori — tandai `[x]` lagi hanya setelah refactor selesai dan test terkait pass dengan schema `Assignable` final. Task 18 di bawah adalah versi FINAL (menggantikan draft dual-morph sebelumnya yang tidak pernah dikerjakan).

## Tasks

- [x] 1. Database — migrasi dan factory (schema awal, single-target — akan di-refactor task 18)
  - [x] 1.1 Buat migrasi `database/migrations/2026_07_18_000001_create_todos_table.php` (schema lama, single-target `allocated_to_id`)
    - _Requirements: (superseded, lihat task 18.1)_

  - [x] 1.2 Buat factory `database/factories/Core/TodoFactory.php` (schema lama)
    - _Requirements: (superseded, lihat task 18.1)_

- [x] 2. Checkpoint - Migrasi awal berhasil (schema lama, akan di-refactor)

- [x] 3. Model dan Request classes (schema awal, single-target — akan di-refactor task 18)
  - [x] 3.1 Buat `app/Models/Core/Todo.php` (schema lama, `allocatedTo()` belongsTo User polos)
    - _Requirements: (superseded, lihat task 18.2)_

  - [x] 3.2 Buat `app/Http/Requests/Core/AssigneeRequest.php` (schema lama, `allocated_to.id` tanpa `type`)
    - _Requirements: (superseded, lihat task 18.3)_

  - [x] 3.3 Buat `app/Http/Requests/Core/TodoRequest.php` (schema lama)
    - _Requirements: (superseded, lihat task 18.3)_

- [x] 4. Checkpoint - Model dan request classes awal tidak ada syntax error

- [x] 5. Notifikasi (dasar — fan-out per-role ditambahkan task 18.5)
  - [x] 5.1 Buat `app/Notifications/TodoAssignedNotification.php`
    - Mirror `ApprovalPendingNotification.php`: constructor-promoted `public Todo $todo`, `use Queueable`
    - `via()` return `['database', 'broadcast', 'mail']`
    - `toArray()`/`toMail()` pakai `documentLabel()` helper (`reference?->code ?? reference?->name ?? description`), `documentType` = `Todo::class`, `documentId` = `$this->todo->id` (SELALU mengarah ke Todo sendiri, bukan reference)
    - `toBroadcast()` reuse `toArray()`
    - _Requirements: 5.1, 5.4, 5.6_

  - [x] 5.2 Tambah key `todo_assigned` di `lang/en/notification.php` dan `lang/id/notification.php`
    - `title` + `message` dengan placeholder `:assigner`/`:document`
    - _Requirements: 5.1_

  - [x] 5.3 Tambah `DOCUMENT_TYPE_ROUTE_MAP['App\Models\Core\Todo'] = 'todos'` di `resources/js/Components/Navbar/Notifications.jsx`
    - _Requirements: 5.4_

- [x] 6. Service layer (dasar — fan-out per-role ditambahkan task 18.5)
  - [x] 6.1 Buat `app/Services/Core/TodoService.php` (schema lama, `notifyAssignee` kirim ke satu `allocatedTo` User)
    - _Requirements: (superseded sebagian, lihat task 18.5)_

  - [x] 6.2 Write feature test untuk `TodoService::notifyAssignee` (Self-Notification Guard)
    - **Self-Notification Guard: assign ke diri sendiri tidak memicu notifikasi, assign ke orang lain memicu notifikasi database+broadcast+mail**
    - _Requirements: 5.1, 5.3_ (test ini perlu di-update ulang di task 18.8 untuk cover kasus role)

- [x] 7. Checkpoint - Test TodoService awal pass (schema lama)

- [x] 8. Wiring sidebar generik (base Controller + routes) — payload `allocated_to` akan berubah bentuk di task 18.3/18.4
  - [x] 8.1 Tambah method `addAssignee`/`removeAssignee` di `app/Http/Controllers/Controller.php` (schema lama)
    - _Requirements: (superseded sebagian, lihat task 18.4)_

  - [x] 8.2 Tambah `addAssignee`/`removeAssignee` ke match arm permission `'read'` di constructor `Controller.php`
    - _Requirements: 1.9, 6.2_ (tidak berubah oleh refactor)

  - [x] 8.3 Tambah dua route di macro `Route::resourceDetail` (`routes/web.php`)
    - `Route::post("/{{$name}}/assignee", 'addAssignee')->name("$uri.addAssignee")`
    - `Route::delete("/{{$name}}/assignee/{id}", 'removeAssignee')->name("$uri.removeAssignee")`
    - _Requirements: 1.8_ (tidak berubah oleh refactor)

  - [x] 8.4 Write feature test `tests/Feature/Core/AssignedToSidebarTest.php` (Sidebar Generic Assignment, schema lama)
    - _Requirements: (perlu ditambah test assign-ke-Role di task 18.8)_

- [x] 9. Checkpoint - Test sidebar generic assignment awal pass (schema lama)

- [x] 10. Modul CRUD standalone (backend) — `index()` akan ditambah visibility scoping di task 18.6
  - [x] 10.1 Buat `app/Http/Controllers/Core/TodoController.php` (schema lama, `index()` tanpa visibility scoping)
    - _Requirements: (superseded sebagian, lihat task 18.6)_

  - [x] 10.2 Registrasi route `Route::resourceDetail('todo', TodoController::class)` di `routes/web.php`
    - _Requirements: 4.1_ (tidak berubah oleh refactor)

  - [x] 10.3 Jalankan `php artisan db:seed --class=PermissionSeeder` agar `Todo` terdaftar di tabel `permissions`
    - Catatan: `composer dump-autoload` HARUS dijalankan dulu sebelum seeder ini jika model `Todo` baru saja dibuat — classmap composer perlu di-refresh agar auto-discovery menemukan model baru. Sudah dijalankan sekali; verifikasi ulang setelah refactor task 18 selesai (model tetap `Todo`, tidak perlu re-seed kecuali struktur permission berubah).
    - _Requirements: 6.1_

  - [x] 10.4 Write feature test `tests/Feature/Core/TodoTest.php` (Standalone CRUD, schema lama)
    - Catatan: test `test_index_filters_assigned_to_me`/`test_index_filters_assigned_by_me` yang ada saat ini HANYA assert `assertOk()` (tidak assert isi row) karena keputusan tab UI di-drop — perlu ditulis ulang di task 18.9 untuk assert visibility scoping yang benar (bukan filter tab).
    - _Requirements: (perlu ditulis ulang di task 18.9)_

- [x] 11. Checkpoint - Test TodoTest awal pass (schema lama)

- [x] 12. Create-mode buffering (assign saat dokumen baru dibuat) — payload buffer akan berubah bentuk di task 18.7
  - [x] 12.1 Extend `app/Services/Core/BufferedAttachmentService.php` — tambah method `attachAssignees` (schema lama)
    - _Requirements: (superseded sebagian, lihat task 18.7)_

  - [x] 12.2 Update guard di `App\Traits\DataTable::bootDataTable()` `static::created()` closure
    - Tambah `buffered_assignees` ke daftar `hasAny([...])` yang di-cek
    - _Requirements: 3.1, 3.2_ (tidak berubah oleh refactor)

  - [x] 12.3 Tambah `$skipAttachmentOnCreate = true` pada model `Todo`
    - _Requirements: 3.3_ (tidak berubah oleh refactor)

  - [x] 12.4 Write feature test untuk create-mode buffering (Buffered Assignee Attach, schema lama)
    - _Requirements: (perlu ditambah test buffer role di task 18.9)_

- [x] 13. Checkpoint - Test buffering awal pass (schema lama)

- [x] 14. Frontend — widget sidebar
  - [x] 14.1 Tambah deferred prop `assignees` di `App\Traits\DataTable::showDetail()` (schema lama, query `where('status', 'open')` + `with('allocatedTo:...')` ke User polos)
    - _Requirements: (superseded sebagian, lihat task 18.10 — query perlu resolve relasi ke `Assignable`, bukan `User` langsung)_

  - [x] 14.2 Buat `resources/js/Pages/Core/Components/AssignedTo.jsx` (versi awal, picker `UserLinkModel`-only)
    - _Requirements: (perlu diganti ke `AssignableLinkModel` di task 18.11)_

  - [x] 14.3 Wire `AssignedTo` ke `SidebarChildren` di `resources/js/Pages/Core/FormPage.jsx` (baris ~1558-1569)
    - Tambah sebagai item pertama dalam `<ul>`, sebelum `Attachments`/`Tags`; tambah import
    - _Requirements: 1.1_

- [x] 15. Frontend — modul standalone
  - [x] 15.1 Buat `resources/js/Pages/Core/Todos/Index.jsx`
    - Wrapper trivial `<DataTable2 form={<Form/>} />`, TANPA tab/top-bar kustom scope (keputusan: di-drop, lihat `design.md` § Out of Scope — DataTable2 reset query param custom saat sort/paginate). Filter "assigned by me"/assignee reuse UI filter kolom generik `DataTable2`.
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 15.2 Buat `resources/js/Pages/Core/Todos/Form.jsx`
    - Field: `allocated_to` (picker User-atau-Role, lihat task 18.10, required), `description`, `priority` (Select low/medium/high), `status` (Select open/closed/canceled, label dari `status.*` i18n bersama), `date`, `due_date`
    - Field `reference` tidak ditampilkan (out of scope — lihat design.md)
    - _Requirements: 4.4, 7.1, 7.3_

  - [x] 15.3 Buat `resources/js/Pages/Core/Todos/Show.jsx`
    - `<FormPage isCreate={!todo} name="todo"><Form/></FormPage>` + blok info referensi: tampilkan `referenceLabel` (kode/nama dokumen) sebagai link ke `referenceRoute` jika keduanya ada
    - Jika `todo.reference_type`/`reference_id` terisi tapi `referenceRoute`/`referenceLabel` null (dokumen sudah terhapus), tampilkan indikator "Reference terhapus" alih-alih link mati
    - _Requirements: 4.5, 5.5, 5.6_

- [x] 16. i18n dan badge theme
  - [x] 16.1 Buat `lang/en/core/todo.php` dan `lang/id/core/todo.php`
    - Key: `new`, `title`, `add`, `name`, `edit`, `columns.*` (description, reference, allocated_to, priority, status, date, due_date, assigned_by), `priority.options.*` (low, medium, high)
    - TIDAK ada `status.options` (reuse `status.*` bersama)
    - _Requirements: 7.1, 7.3_

  - [x] 16.2 Tambah `core.form.assigned_to` di `lang/en/core/form.php` dan `lang/id/core/form.php`
    - Paralel dengan key `attachments`/`tags` existing
    - _Requirements: 1.1_

  - [x] 16.3 Tambah key `open` di `lang/en/status.php` dan `lang/id/status.php`
    - Jangan tambahkan varian `cancelled` (double-L) — pakai `canceled` (single-L) yang sudah ada
    - _Requirements: 7.1, 7.2_

  - [x] 16.4 Tambah `open: "warning"` ke theme map `resources/js/Components/BadgeStatus.jsx`
    - `closed`/`canceled` sudah ada, jangan duplikasi
    - _Requirements: 7.1, 7.2_

- [x] 17. Checkpoint - i18n dan badge lengkap, tidak dijalankan sebagai final (lihat task 19 untuk final checkpoint, setelah task 18 refactor selesai)

- [x] 18. **Refactor schema: model `Assignable` (view User+Role) + visibility scoping**
  - [x] 18.1 Buat migrasi `database/migrations/<timestamp>_create_assignables_view.php`
    - `up()`: `DB::statement("CREATE VIEW assignables AS SELECT id, 'user' AS type, name FROM users WHERE deleted_at IS NULL UNION ALL SELECT id, 'role' AS type, name FROM roles WHERE deleted_at IS NULL")`
    - `down()`: `DB::statement('DROP VIEW IF EXISTS assignables')`
    - Timestamp migrasi ini HARUS sebelum migrasi `todos` (`2026_07_18_000001_...`) secara logis — cek urutan; boleh pakai timestamp lebih awal atau edit migrasi `todos` supaya jalan setelahnya
    - _Requirements: 1.3 (Assignable digunakan sebagai sumber picker)_

  - [x] 18.2 Buat model `app/Models/User/Assignable.php`
    - `protected $table = 'assignables'`, `public $timestamps = false`, `public $incrementing = false`, `protected $keyType = 'string'`
    - TIDAK pakai trait `DataTable` (sesuai instruksi user — model ini bukan modul CRUD, murni utk LinkModel)
    - TIDAK ada `HasFactory`/`create()` (view read-only, tidak pernah ditulis langsung)
    - `public static function templateLink() { return ':type : :name'; }`
    - _Requirements: 1.3_

  - [x] 18.3 Buat `resources/js/Pages/Users/ManageUsers/AssignableLinkModel.jsx`
    - Mirror persis `UserLinkModel.jsx` — wrapper `LinkModel` dengan `model="App\Models\User\Assignable"`
    - _Requirements: 1.3_

  - [x] 18.4 Ubah migrasi `todos` (`database/migrations/2026_07_18_000001_create_todos_table.php`) — karena masih tahap development (belum ada data produksi/belum di-share), edit LANGSUNG migrasi ini (bukan migrasi tambahan) lalu `migrate:fresh`
    - Kolom assignee jadi: `$table->ulid('allocated_to_id');` (FK biasa ke `assignables.id`, TANPA `->references()->on()` — target adalah view) + `$table->string('allocated_to_type');` (cache `'user'`/`'role'`)
    - Unique index kembali ke bentuk sederhana: `['reference_type', 'reference_id', 'allocated_to_id', 'deleted_at']` bernama `todos_reference_assignee_unique`
    - Update `database/factories/Core/TodoFactory.php`: `allocated_to_type` default `'user'`, `allocated_to_id` via `User::factory()`
    - _Requirements: 2.1, 2.3_

  - [x] 18.5 Update `app/Models/Core/Todo.php`
    - Ganti relasi `allocatedTo(): BelongsTo` dari `User::class` → `Assignable::class` (tetap `belongsTo`, FK `allocated_to_id`, TANPA morphTo — jauh lebih simpel dari desain dual-morph sebelumnya)
    - Tambah method `allocatedUsers(): Collection`:
      ```php
      public function allocatedUsers(): Collection {
          if ($this->allocated_to_type === 'role') {
              return User::whereHas('roles', fn ($q) => $q->where('roles.id', $this->allocated_to_id))->get();
          }
          $user = User::find($this->allocated_to_id);
          return $user ? collect([$user]) : collect();
      }
      ```
    - Update `scopeAssignedToMe($query, User $user)` — cover assign-langsung-ke-user ATAU assign-ke-role-yang-dimiliki-user (lihat query contoh di `design.md` § Backend — Model Todo)
    - Update `$configColumns['allocatedTo']` (tetap key ini, relasi biasa bukan morph) — `templateLink()` milik `Assignable` otomatis membedakan label User vs Role
    - _Requirements: 1.4, 1.5, 8.1_

  - [x] 18.6 Update `app/Http/Requests/Core/AssigneeRequest.php` dan `app/Http/Requests/Core/TodoRequest.php`
    - `allocated_to.id` → `['required', 'string', 'exists:assignables,id']` (SATU rule, tidak perlu percabangan `when()` seperti draft dual-morph sebelumnya)
    - `allocated_to.type` → `['required', 'string', 'in:user,role']`
    - _Requirements: 1.4, 1.5_

  - [x] 18.7 Update `Controller::addAssignee` (`app/Http/Controllers/Controller.php`)
    - `firstOrCreate` search array cukup `['reference_id' => $param, 'reference_type' => $this->model, 'allocated_to_id' => $data['allocated_to']['id']]`; create array tambah `'allocated_to_type' => $data['allocated_to']['type']`
    - TIDAK perlu import `Role`/resolve FQCN manual (beda dari draft dual-morph sebelumnya) — `type` sudah datang langsung dari payload `Assignable`
    - _Requirements: 1.4, 1.5, 1.6_

  - [x] 18.8 Update `app/Services/Core/TodoService.php`
    - `notifyAssignee(Todo $todo): void` — ganti dari single `$todo->allocatedTo` (User) jadi iterasi `$todo->allocatedUsers()`; skip HANYA user yang `id === $todo->assigned_by_id` (bukan skip semua jika salah satu match)
    - `normalize(array $data): array` — mapping `allocated_to.id`/`allocated_to.type` → `allocated_to_id`/`allocated_to_type` (rename langsung, tidak perlu resolve FQCN)
    - _Requirements: 5.1, 5.2, 5.3, 5.7_

  - [x] 18.9 Update `app/Http/Controllers/Core/TodoController.php`
    - `index()`: cek `PermissionChecker::forUser($request)->can(Todo::class, Permission::SELECT)` — jika true, `Todo::query()`; jika false, `Todo::assignedToMe($request->user())`; baru panggil `->dataTable($request)`. HAPUS logic `scope` query-param lama (tab di-drop)
    - Import `App\Services\Core\PermissionChecker` dan `App\Enums\Permission`
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 18.10 Update `App\Traits\DataTable::showDetail()` (deferred prop `assignees`) dan `App\Services\Core\BufferedAttachmentService::attachAssignees()`
    - `showDetail()`: query `Todo::where(...)->where('status', 'open')->with('allocatedTo')`, map ke `{ id, allocated_to_id, type: allocated_to_type, name: allocatedTo?->name }`
    - `attachAssignees()`: baca `buffered_assignees` berbentuk `[{ id, type, name }, ...]`, `firstOrCreate` pakai `allocated_to_id`/`allocated_to_type`
    - _Requirements: 1.8, 3.1, 3.2, 8.5_

  - [x] 18.11 Update `resources/js/Pages/Core/Components/AssignedTo.jsx` — ganti `UserLinkModel` → `AssignableLinkModel` (task 18.3)
    - SATU picker (bukan toggle dua picker) — `AssignableLinkModel` sudah mencari User+Role sekaligus
    - Hasil pilih `{ id, type, name }` dari `Assignable`, langsung dipakai apa adanya (tidak perlu normalisasi manual)
    - List item render label `":type : :name"` (konsisten dengan picker) — badge/ikon role bersifat kosmetik opsional, BUKAN wajib (beda dari draft dual-morph sebelumnya yang mensyaratkan styling kondisional)
    - _Requirements: 1.2, 1.3, 1.8_

  - [x] 18.12 Update test yang sudah ada agar sesuai schema `Assignable` DAN tambah test kasus Role + view
    - Buat `tests/Feature/Core/AssignableViewTest.php` (baru): `Assignable::all()`/`find()` gabungkan User+Role dengan `type` benar; user/role baru langsung muncul tanpa sync manual; user/role ter-soft-delete tidak muncul
    - `tests/Feature/Core/TodoServiceTest.php`: tambah `test_notify_assignee_fans_out_to_all_role_members`, `test_notify_assignee_to_role_skips_only_the_assigner_not_other_members`
    - `tests/Feature/Core/AssignedToSidebarTest.php`: update payload existing ke bentuk `{ id, type: 'user' }`; tambah `test_can_assign_role_to_any_document_via_sidebar`, `test_assigning_duplicate_role_is_idempotent`
    - _Requirements: 1.4, 1.5, 5.2, 5.3_

  - [x] 18.13 Tulis ulang test visibility scoping DAN buffering role
    - Buat `tests/Feature/Core/TodoVisibilityScopeTest.php` (baru): user tanpa permission `select` pada `Todo` hanya lihat ToDo miliknya (langsung + lewat role) di `/todos`; user DENGAN permission lihat semua; role dengan banyak anggota — semua anggota lihat ToDo yang di-assign ke role; role yang di-assign lalu dihapus tidak error
    - Update `tests/Feature/Core/TodoTest.php`: ganti `test_index_filters_assigned_to_me`/`test_index_filters_assigned_by_me` (yang saat ini cuma `assertOk()`) jadi assert isi row yang benar sesuai scope; tambah test create/update Todo dengan assignee Role
    - Update `tests/Feature/Core/BufferedAttachmentServiceTest.php`: tambah test buffer assignee berupa Role
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [x] 19. Final checkpoint - Jalankan full test suite (`php artisan test --compact`), pastikan semua pass (termasuk seluruh test task 18). Jalankan `npm run build` untuk memastikan frontend ter-compile tanpa error. Setelah itu, jalankan `vendor/bin/pint --dirty --format agent` untuk formatting PHP.
  - Semua 32 test ToDo pass. `npm run build` sukses (setelah `npm install` untuk sync `node_modules` yang tertinggal dari fitur notifikasi sebelumnya — tidak terkait ToDo). Pint sudah jalan dan format ulang file yang di-­touch. Full suite proyek (684 test) punya 15 kegagalan pre-existing tak terkait (kolom `is_example` hilang di beberapa test lama yang tak pernah saya sentuh) + fragility lintas-test SQLite `:memory:` saat dijalankan sekaligus (transaksi bersarang) — keduanya dikonfirmasi bukan regresi dari perubahan ToDo (`git status` bersih untuk file test yang gagal, dan test yang sama pass saat dijalankan terisolasi).

## Notes

- Setiap task mereferensi requirement spesifik di `requirements.md` untuk traceability.
- Checkpoint memastikan validasi inkremental — jangan lanjut ke group berikutnya sebelum checkpoint sebelumnya pass.
- Task 8 (wiring generik) HARUS selesai sebelum task 10 (`TodoController`) didaftarkan via `Route::resourceDetail`, karena route macro yang sama dipakai keduanya.
- Task 12 (buffering) bergantung pada `BufferedAttachmentService` yang sudah ada dari spec `formpagedialog-sidebar` — bukan file baru, hanya di-extend.
- Field `reference` di form ToDo standalone sengaja tidak dibangun (lihat `design.md` § Out of Scope) — assign ber-reference hanya lewat sidebar widget.
- Task 18 (refactor `Assignable` view + Role + visibility scoping) HARUS dikerjakan SETELAH task 1–14.1 selesai (sudah), dan SEBELUM task 14.3–16 dikerjakan (agar frontend langsung dibangun di atas schema final, bukan schema lama yang akan berubah lagi) — lihat urutan di Task Dependency Graph. Task 18.1 (migrasi view) HARUS selesai sebelum 18.4 (migrasi `todos` yang mereferensikannya secara logis).
- Lint/Pint HANYA dijalankan di task 19 (akhir), bukan per task, sesuai konvensi project.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["18.1"] },
    { "id": 1, "tasks": ["18.2"] },
    { "id": 2, "tasks": ["18.3", "18.4"] },
    { "id": 3, "tasks": ["18.5"] },
    { "id": 4, "tasks": ["18.6", "18.7"] },
    { "id": 5, "tasks": ["18.8", "18.9", "18.10"] },
    { "id": 6, "tasks": ["18.11"] },
    { "id": 7, "tasks": ["18.12", "18.13"] },
    { "id": 8, "tasks": ["14.3"] },
    { "id": 9, "tasks": ["15.1", "15.2", "15.3"] },
    { "id": 10, "tasks": ["16.1", "16.2", "16.3", "16.4"] },
    { "id": 11, "tasks": ["19"] }
  ]
}
```
