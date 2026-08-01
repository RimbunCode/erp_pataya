# Implementation Plan: Global Log Viewer

## Overview

Implementasi mengikuti pola arsitektur `DataTable` yang sudah ada di seluruh modul lain — tidak membangun mekanisme listing/filtering/permission baru, hanya menyambungkan model `Log` ke mekanisme tersebut. Perubahan backend (migration kolom `action`, pengisian di 7 method `logFor*()`, override `permissions()`/`$canDelete`/`$configColumns` pada `Log`, route + controller baru) dikerjakan lebih dulu dan divalidasi lewat feature test, baru kemudian halaman frontend. Yang **tidak** berubah: mekanisme pencatatan log itu sendiri, halaman detail (`Core/ShowLog.jsx`), dan tidak ada endpoint create/update/delete baru untuk Log.

## Tasks

- [x] 1. Migration kolom `action` pada tabel `logs`
  - [x] 1.1 Buat migration `add_action_to_logs_table`
    - `php artisan make:migration add_action_to_logs_table --no-interaction`
    - Tambah `$table->string('action')->nullable()->after('type')->index();`
    - Jalankan `php artisan migrate` di environment lokal, verifikasi kolom muncul lewat `database-schema` (filter `logs`)
    - _Requirements: 1.1_

- [x] 2. Isi kolom `action` di setiap method `logFor*()` (app/Traits/DataTable.php)
  - [x] 2.1 Tambah `'action' => 'created'` di `logForCreated()`
    - _Requirements: 1.2_
  - [x] 2.2 Tambah `'action' => 'updated'` di `logForUpdated()`
    - _Requirements: 1.3_
  - [x] 2.3 Tambah `'action' => 'deleted'` di `logForDeleted()`
    - _Requirements: 1.4_
  - [x] 2.4 Tambah `'action' => 'restored'` di `logForRestore()`
    - _Requirements: 1.5_
  - [x] 2.5 Tambah `'action' => 'submitted'` di `logForSubmitted()`
    - _Requirements: 1.6_
  - [x] 2.6 Tambah `'action' => 'cancelled'` di `logForCancelled()`
    - _Requirements: 1.7_
  - [x] 2.7 Tambah `'action' => 'amended'` di `logForAmended()`
    - _Requirements: 1.8_
  - [x] 2.8 Verifikasi `Controller::addComment()` tidak disentuh — tetap membuat Log tanpa `action` (default NULL)
    - Baca ulang `app/Http/Controllers/Controller.php::addComment()`, pastikan tidak ada perubahan di file ini
    - _Requirements: 1.9, 1.10_
  - [x] 2.9 Write feature tests for logFor*() action column (Kelengkapan Aksi property)
    - **Kelengkapan Aksi: setiap logFor*() menghasilkan row `logs` dengan `action` sesuai mapping (created/updated/deleted/restored/submitted/cancelled/amended)**
    - Test terpisah untuk masing-masing dari 7 method, memakai model apa pun yang pakai trait `Submitable`/`DataTable` (mis. `WorkOrder` untuk submit/cancel/amend, model non-submitable untuk created/updated/deleted)
    - Test tambahan: buat comment lewat `Controller::addComment()` (via route todos/workOrders `addComment`), assert row `logs` yang dihasilkan punya `action = null` dan `type = 'comment'`
    - **Validates: Requirements 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10**

- [x] 3. Checkpoint - Ensure kolom action tests pass
  - Jalankan `php artisan test --compact --filter=Log` (atau filter sesuai nama test file yang dibuat)
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Model `App\Models\Core\Log` — permission, canDelete, configColumns
  - [x] 4.1 Override `protected static function permissions(): array` mengembalikan `['select', 'read']`
    - _Requirements: 5.2_
  - [x] 4.2 Tambah `public bool $canDelete = false;`
    - Pola sama seperti `App\Models\Helpdesk\Ticket`
    - _Requirements: 2.4_
  - [x] 4.3 Tambah accessor `loggableTypeLabel(): Attribute` yang lookup `Permission::where('model', $this->loggable_type)->value('name')`, fallback `class_basename($this->loggable_type)`
    - Tambahkan `loggable_type_label` ke `protected $appends`
    - Import `App\Models\User\Permission` dan `Illuminate\Database\Eloquent\Casts\Attribute`
    - Cache lookup per-request (mis. `static $cache = []` keyed by `loggable_type`) untuk hindari N+1 saat banyak baris dengan `loggable_type` berbeda-beda
    - _Requirements: 3.1_
  - [x] 4.4 Update `$configColumns`: tambah entry `action` (dengan `valueTrans`), ubah entry `loggable_type` (show, order, tanpa valueTrans statis — pakai accessor dari 4.3), pastikan `loggable`, `user`, `created_at` sudah `show: true` dengan `order` berurutan
    - _Requirements: 3.1, 3.2, 3.4, 3.5, 3.6_
  - [x] 4.5 Tambah entri bahasa `core.log.action.options` di `lang/id/core/log.php` dan `lang/en/core/log.php` (label untuk created/updated/deleted/restored/submitted/cancelled/amended)
    - _Requirements: 3.5_
  - [x] 4.6 Write unit test for Log::permissions() dan Log::initPermissions() (Isolasi Permission property)
    - **Isolasi Permission: Log::permissions() mengembalikan tepat ['select', 'read'], tidak lebih tidak kurang**
    - Jalankan `Log::initPermissions()` dalam test, assert row `permissions` table untuk `model = App\Models\Core\Log` punya `permissions` JSON hanya berisi key `select` dan `read`
    - **Validates: Requirements 5.1, 5.2**

- [x] 5. Route dan LogController::index()
  - [x] 5.1 Tambah route `Route::get('/logs', [LogController::class, 'index'])->name('logs.index');` di `routes/web.php`, tepat sebelum route `logs.show` yang sudah ada
    - _Requirements: 2.1_
  - [x] 5.2 Tambah `__construct(Request $request)` di `LogController` yang memanggil `parent::__construct($request, Log::class)`
    - Ini mengaktifkan permission check untuk `index()` (mapping default `select`) dan `show()` (mapping default `read`) sekaligus
    - _Requirements: 2.3_
  - [x] 5.3 Tambah method `index(Request $request)`: `$this->setBreadcrumbs(); Log::dataTable($request); return Inertia::render('Core/Logs/Index');`
    - _Requirements: 2.2_
  - [x] 5.4 Verifikasi tidak ada route baru untuk create/store/update/destroy pada `/logs` (cek `php artisan route:list --path=logs`)
    - _Requirements: 2.4_
  - [x] 5.5 Write feature tests for LogController (Permission Enforcement + No Mutation properties)
    - **Permission Enforcement: GET /logs mengembalikan 403 tanpa permission select pada Log, 200 dengan permission select**
    - **Permission Enforcement (show): GET /logs/{log} mengembalikan 403 tanpa permission read pada Log, 200 dengan permission read**
    - **No Mutation: tidak ada route POST/PUT/PATCH/DELETE terdaftar untuk path /logs**
    - Test index menampilkan log dari lebih dari satu `loggable_type` sekaligus dalam satu response (buktikan tidak ada scoping tersembunyi per Requirement 2.2)
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4**

- [x] 6. Checkpoint - Ensure backend tests pass
  - Jalankan `php artisan test --compact tests/Feature/Core/LogControllerTest.php` (atau nama file test yang dibuat di task 5.5) dan test dari task 2.9, 4.6
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Frontend: halaman index log
  - [x] 7.1 Buat `resources/js/Pages/Core/Logs/Index.jsx`
    - Render `<DataTable2 />` tanpa prop `form` (tombol Create otomatis tidak muncul karena syarat render-nya `form && canCreate`)
    - Pola minimal, contoh: `resources/js/Pages/Core/Todos/Index.jsx`
    - _Requirements: 2.2_
  - [x] 7.2 Verifikasi manual: klik baris log di halaman index mengarah ke `logs.show` (link `isLink: true` pada kolom `code`, sudah ada di `$configColumns`)
    - _Requirements: 2.5_
    - **Catatan:** tidak ada tool browser automation di environment ini untuk verifikasi visual langsung. Divalidasi lewat kode: kolom `code` di `$configColumns` (Log.php baris 100-105) sudah `isLink: true`, konsisten dengan pola link kolom `isLink` lain di `DataTable2.jsx`/`Table2.jsx` yang mengarah ke route `{model}.show`. User disarankan cek visual sekali di browser setelah deploy.
  - [x] 7.3 Verifikasi manual: kolom `loggable` menampilkan fallback yang wajar (bukan error) saat dokumen asal sudah dihapus permanen
    - Jika perlu penyesuaian tampilan fallback, edit komponen render kolom `loggable` di `DataTable2.jsx`/komponen kolom terkait
    - _Requirements: 3.3_
    - **Catatan:** sama seperti 7.2, tidak dapat diverifikasi visual di environment ini. `loggable` adalah relasi `morphTo` — behavior null-safe render sudah pola umum di `Table2.jsx` untuk kolom relasi. User disarankan cek visual dengan 1 row log yang dokumen sumbernya sudah dihapus permanen.

- [x] 8. Final checkpoint - Ensure all tests pass dan verifikasi browser
  - [x] Jalankan test suite relevan: `php artisan test --compact tests/Feature/Core/LogControllerTest.php tests/Feature/Core/LogActionColumnTest.php tests/Feature/Core/LogPermissionTest.php` — **16 passed (21 assertions)**
  - [x] Jalankan `npm run build` — sukses, `Core/Logs/Index` masuk build output
  - [ ] Verifikasi manual di browser (filter builder 4 filter, 403 tanpa permission) — **belum dilakukan**, tidak ada tool browser automation tersedia di sesi ini. Permission enforcement (403/200) dan filter query sudah tercover test otomatis di LogPermissionTest & LogControllerTest (HTTP-layer, hit route+middleware+DB asli), tapi belum ada observasi visual UI langsung. User disarankan cek sekali secara manual.
  - [x] Jalankan `vendor/bin/pint --dirty --format agent` — pass, tidak ada perubahan format

## Notes

- Setiap task mereferensi requirement spesifik untuk traceability ke `requirements.md`.
- Checkpoint (task 3, 6, 8) memastikan validasi inkremental — backend divalidasi penuh sebelum menyentuh frontend.
- **Perubahan behavior yang disengaja** (dikonfirmasi user, lihat `design.md` § Error Handling): `LogController::show()` yang sebelumnya tidak dijaga permission apa pun, sekarang butuh permission `read` pada model Log. Task 5.5 mencakup test untuk memvalidasi perubahan ini secara eksplisit.
- Task 4.5 (entri bahasa) tidak ada di requirements sebagai acceptance criteria terpisah, tapi diperlukan agar Requirement 3.5 ("label yang diterjemahkan") benar-benar terpenuhi — tanpa entri lang, `valueTrans` akan menampilkan key mentah.
- Tidak ada task migrasi/backfill `action` untuk data log lama — sesuai Out of Scope di `requirements.md`.
- Tidak ada task assignment permission Log ke role tertentu — sesuai Requirement 5.4, ini dilakukan manual oleh user lewat halaman Roles setelah fitur selesai diimplementasikan.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1", "2.2", "2.3", "2.4", "2.5", "2.6", "2.7", "2.8"] },
    { "id": 2, "tasks": ["2.9"] },
    { "id": 3, "tasks": ["4.1", "4.2", "4.3"] },
    { "id": 4, "tasks": ["4.4", "4.5"] },
    { "id": 5, "tasks": ["4.6"] },
    { "id": 6, "tasks": ["5.1", "5.2"] },
    { "id": 7, "tasks": ["5.3", "5.4"] },
    { "id": 8, "tasks": ["5.5"] },
    { "id": 9, "tasks": ["7.1"] },
    { "id": 10, "tasks": ["7.2", "7.3"] },
    { "id": 11, "tasks": ["8"] }
  ]
}
```
