# Design Document: Pindah ignorePermission ke Model + Kolom DB

## Overview

Flag `ignorePermission` (nama asli di kode: `ignorePermission`, singular) saat ini adalah property `protected bool` yang di-declare/override langsung di masing-masing subclass `Controller` (`TicketController`, `TodoController`, `ChangelogController`, `NotificationController`, `ApprovalInstanceController`, `SetupUserController`). Base `Controller::__construct()` cuma cek `$this->ignorePermission` (satu titik, `Controller.php:127`) untuk skip seluruh gate 403 CRUD standar.

Masalah: nilai flag ini tidak terlihat oleh FE. FE hanya menerima prop `permissions` (map hasil resolve `role_permissions` per user, lihat `AppMiddleware::resolvePermissionsFor()`) — tidak ada cara FE tahu bahwa model tertentu memang sengaja dirancang tanpa gate permission (vs. user yang kebetulan tidak punya permission apapun).

Scope terkonfirmasi user:

1. Source-of-truth flag pindah dari property controller ke **kolom baru `ignore_permission` di tabel `permissions`** (tabel master, 1 row per model — sama pola dengan kolom existing `is_submitable`, `allow_only_creator`).
2. Model men-declare lewat static property (pola sama seperti `static::$is_submitable`), otomatis ke-seed ke kolom DB lewat `initPermissions()` (dipanggil `PermissionSeeder`) — tanpa perlu ubah `PermissionSeeder.php`.
3. `Controller::__construct()` **tetap** melakukan pengecekan gate (titik eksekusi tidak pindah) — hanya sumber nilainya yang berubah, dari property controller sendiri menjadi baca dari model.
4. FE menerima flag ini lewat prop Inertia baru **`ignorePermissionModels: string[]`** (list FQCN model yang bypass) — terpisah dari struktur `permissions` existing (yang asalnya dari `role_permissions`, bukan dari tabel master `permissions`), supaya tidak mengubah kontrak `checkPermission()`/`usePermission()` yang sudah dipakai banyak tempat (NavMain, Role Form, dst).
5. **Tickets**: bypass penuh (`ignore_permission = true`) — semua user CRUD tanpa batasan, sama seperti sekarang.
6. **ToDo**: bypass CRUD gate 403 standar tetap true (`ignore_permission = true`, seperti sekarang). `show()` (baca) **selalu terbuka untuk siapapun** — tidak ada gate atau row-level check sama sekali (keputusan user: transparansi tugas tim lebih diutamakan daripada privasi ToDo individual). TAPI `update()`/`destroy()` (tulis/hapus) tetap ditambah **row-level check manual**: diizinkan kalau todo milik sendiri (assignee atau `assigned_by_id` = user login), atau kalau user punya permission eksplisit (`PermissionChecker::can(Todo::class, action)`) dari Role & Permission settings. Kalau bukan keduanya → `abort(403)`. Ini menutup gap keamanan yang ditemukan riset (saat ini siapapun yang tahu ID Todo bisa mengubah/menghapus Todo orang lain tanpa permission apapun) sambil tetap membuka akses baca untuk semua.

## Architecture

```text
Sebelum:
┌─ TicketController ─────────┐   ┌─ TodoController ────────────┐
│ protected $ignorePermission │   │ protected $ignorePermission │
│   = true;  (hardcoded)      │   │   = true;  (hardcoded)      │
└──────────┬──────────────────┘   └──────────┬───────────────────┘
           │                                 │
           ▼                                 ▼
      Controller::__construct()
      if (!$this->ignorePermission) { ...gate 403... }


Sesudah:
┌─ permissions table (DB) ────────────────┐
│ model: Ticket::class                    │
│ ignore_permission: true                 │◄── initPermissions() seed dari
├──────────────────────────────────────────   static::$ignorePermission di model
│ model: Todo::class                      │
│ ignore_permission: true                 │
└──────────┬───────────────────────────────┘
           │ (nilai statis di model, tidak query DB tiap request)
           ▼
      Controller::__construct()
      if (!$this->model::ignoresPermission()) { ...gate 403... }   ◄── baca dari model, bukan property sendiri
           │
           ▼ (khusus TodoController)
      show(): selalu diizinkan, tanpa gate/check apapun
      update()/destroy(): cek row-level manual
      isOwn(todo, user) || PermissionChecker::can(...)
      else abort(403)

      AppMiddleware::handle()
      Inertia::share(['ignorePermissionModels' => [...FQCN yg ignore_permission=true]])
           │
           ▼
      FE: usePermission(model) baca ignorePermissionModels, expose isIgnored
```

### Prinsip kunci

- **Titik eksekusi tidak berubah**: `Controller::__construct()` tetap satu-satunya tempat gate 403 CRUD dicek. Yang berubah hanya sumber nilai boolean-nya.
- **Model sebagai source of truth**: tiap model men-declare `protected static bool $ignorePermission = true;` (default `false` kalau tidak di-declare, konsisten dengan pola `$is_submitable`/`$allow_only_creator`).
- **Tidak menyentuh struktur `permissions` existing**: prop Inertia baru ditambah terpisah, `checkPermission()`/`usePermission()` JS tidak berubah kontraknya.
- **ToDo tetap punya exception khusus**: bypass CRUD gate; `show()` selalu terbuka untuk siapapun (baca bebas); `update()`/`destroy()` ditambah row-level check manual, ditulis eksplisit di `TodoController` (tidak digeneralisasi ke trait/base Controller, sesuai keputusan — field assignment ToDo `allocated_to_id`/`assigned_by_id` berbeda dari convention `created_by_id` yang dipakai base Controller untuk model submitable lain).

## Components and Interfaces

### Database

**Migration baru** — `database/migrations/<timestamp>_add_ignore_permission_to_permissions_table.php`:

```php
public function up(): void {
    Schema::table('permissions', function (Blueprint $table) {
        $table->boolean('ignore_permission')->default(false)->after('allow_only_creator');
    });
}

public function down(): void {
    Schema::table('permissions', function (Blueprint $table) {
        $table->dropColumn('ignore_permission');
    });
}
```

### Backend

**`app/Models/User/Permission.php`** — tambah `ignore_permission` ke `casts()`:

```php
protected $casts = [
    'permissions'        => Json::class,
    'is_submitable'      => 'boolean',
    'allow_only_creator' => 'boolean',
    'ignore_permission'  => 'boolean',
];
```

**`app/Traits/DataTable.php`**:

- `initPermissions()` — tambah `'ignore_permission' => (static::$ignorePermission ?? false)` ke array `updateOrCreate()` (baris ~544-545, sejajar `is_submitable`/`allow_only_creator`).
- Tambah static helper baru:

  ```php
  public static function ignoresPermission(): bool {
      return (bool) (static::$ignorePermission ?? false);
  }
  ```

  Dipanggil langsung dari model class (tidak query DB tiap request — nilai statis, konsisten dengan cara `$is_submitable` dipakai sebagai compile-time flag, bukan runtime DB read).

**Model yang di-set `ignore_permission = true`** (pindah dari controller ke model):

- `app/Models/Helpdesk/Ticket.php` → `protected static bool $ignorePermission = true;`
- `app/Models/Core/Todo.php` → `protected static bool $ignorePermission = true;`
- `app/Models/Core/Changelog.php` → `protected static bool $ignorePermission = true;`

> Catatan: `NotificationController`, `ApprovalInstanceController`, `SetupUserController` men-set `$ignorePermission = true` di constructor TANPA meneruskan model class ke `parent::__construct()` (lihat `Controller::__construct()` baris 114 `if (!$model) return;` — property `$this->model` tidak pernah ter-set untuk controller ini, karena constructor early-return sebelum baris assignment). Controller-controller ini **tidak punya model target** untuk digate sama sekali — bukan soal "ignore", tapi soal tidak ada model yang bisa dipetakan ke tabel `permissions`. Controller ini **di luar scope perubahan**, tetap pakai property `$ignorePermission` miliknya sendiri.

**`app/Http/Controllers/Controller.php`** — ubah baris 127. Karena `$this->model` bisa saja belum ter-set (controller tanpa model, lihat catatan di atas), pengecekan harus pakai `isset()` dulu — TIDAK bisa pakai `??` di antara method call dan property (`ignoresPermission()` return type `bool`, tidak pernah `null`, jadi `??` tidak akan pernah jatuh ke fallback):

```php
// sebelum
if (! $this->ignorePermission && ! $request->attributes->get('isApprovalCallback')) {

// sesudah
$ignorePermission = isset($this->model) ? $this->model::ignoresPermission() : $this->ignorePermission;
if (! $ignorePermission && ! $request->attributes->get('isApprovalCallback')) {
```

`$this->ignorePermission` (property, default `false`) dipertahankan sebagai fallback untuk controller tanpa model (Notification, ApprovalInstance, SetupUser) — properti tetap ada di base class, cuma tidak lagi di-override `true` di `TicketController`/`TodoController`/`ChangelogController` karena sumbernya sekarang dari model.

**`TicketController.php`** — hapus `protected bool $ignorePermission = true;` (baris 16). Behavior tidak berubah (Ticket model yang declare, hasil akhir sama: bypass penuh).

**`TodoController.php`** — hapus `protected bool $ignorePermission = true;` (baris 17). Tambah row-level check eksplisit HANYA di `update()` dan `destroy()` — `show()` TIDAK dipanggilkan check ini sama sekali (baca selalu bebas untuk siapapun):

```php
private function authorizeOwnTodoOrPermission(Todo $todo, Permission $action): void {
    $user = request()->user();
    $isOwn = $todo->allocatedUsers()->contains('id', $user->id)
        || $todo->assigned_by_id === $user->id;

    if ($isOwn) {
        return;
    }

    if (PermissionChecker::forUser(request())->can(Todo::class, $action)) {
        return;
    }

    abort(403);
}
```

Dipanggil di awal `update()` (dengan `Permission::Write`) dan `destroy()` (dengan `Permission::Delete`) sebelum operasi lanjut. `show()` tetap tanpa panggilan ini — akses baca ToDo tidak pernah di-gate, terlepas dari kepemilikan atau permission.

### Frontend

**Masalah tambahan ditemukan riset**: `checkPermission()` (`resources/js/lib/utils.js:501-522`) me-return `{allowed: false}` kalau `permissions[model]` tidak ada — dan model bypass (Ticket/Todo/Changelog) memang TIDAK PERNAH punya entry di `permissions` (bukan soal role, tapi soal model itu sendiri tidak digate). Semua konsumen hook ini (`DataTable2` tombol create/delete-row, `FormPage` tombol print/delete/submit/amend/cancel/write/save, `LinkModel` nav & tombol tambah inline) ikut ter-dampak — tombol-tombol tsb hilang untuk model bypass meski backend mengizinkan aksi tanpa gate. Ada workaround parsial existing (`forceCanCreate` prop di `DataTable2`, dipasang manual di `Tickets/Index.jsx`/`Todos/Index.jsx`) yang menutup SATU celah (tombol create) tapi bukan yang lain (delete-row di `DataTable2`, dan seluruh tombol aksi di `FormPage` — termasuk bug pre-existing di `Todos/Show.jsx`: tombol Save/Delete Todo kemungkinan besar sudah tidak pernah muncul hari ini, independen dari perubahan spec ini, karena akar masalah yang sama).

**Keputusan**: perbaikan dilakukan TERPUSAT di `checkPermission()` — bukan menambah prop override baru di tiap komponen (`forceCanDelete`, dst). Kalau `model` ada di `ignorePermissionModels`, fungsi langsung return `allowed: true` tanpa melihat isi `permissions[model]` sama sekali. Ini otomatis memperbaiki SEMUA titik pemanggil sekaligus (termasuk bug ToDo Show yang sudah ada), tanpa menyentuh `DataTable2`/`FormPage`/`LinkModel` satu per satu.

**`app/Http/Middleware/AppMiddleware.php`** — tambah share prop baru di `handle()`:

```php
Inertia::share([
    'permissions'            => $permissions,
    'ignorePermissionModels' => Permission::where('ignore_permission', true)->pluck('model'),
    'branchSettings'         => [...],
]);
```

Query ini ringan (tabel `permissions` kecil, jumlah model terbatas) — bisa di-cache bareng `permissions_version` kalau perlu dioptimasi lebih lanjut, tapi untuk scope ini query langsung tiap request cukup (tidak prematur optimize).

**`resources/js/lib/utils.js::checkPermission()`** — tambah parameter `ignorePermissionModels` (default `[]`), cek di awal fungsi sebelum baca `permissions[model]`:

```js
export function checkPermission(permissions, model, action, level = 0, ignorePermissionModels = []) {
  if (ignorePermissionModels.includes(model)) {
    return { allowed: true, onlyCreator: false };
  }
  const modelPermissions = permissions[model];
  // ...sisanya tidak berubah
}
```

**`resources/js/Hooks/usePermission.jsx`** — baca `ignorePermissionModels` dari `usePage().props`, teruskan ke `checkPermission()`:

```jsx
const { permissions, auth, ignorePermissionModels = [] } = usePage().props;
const can = (action, options) =>
  checkPermission(permissions, model, action, options?.level, ignorePermissionModels).allowed;
```

**`resources/js/Components/Sidebar/NavMain.jsx`** — pemanggilan `checkPermission()` langsung (bukan via hook) juga perlu diteruskan `ignorePermissionModels` dari `usePage().props`, supaya menu sidebar Ticket/Todo (kalau terdaftar dengan `model` key) tidak ikut hilang oleh masalah yang sama.

**Tidak perlu** expose `isIgnored` terpisah — cukup ubah `checkPermission()` di akarnya, semua `can()`/`canGlobal()` otomatis konsisten.

**Cakupan yang TIDAK berubah**: property `canDelete` (`Ticket::$canDelete = false`, `Todo::$canDelete = true` — flag model-level "apakah fitur delete didukung sama sekali", independen dari permission) tetap dicek terpisah dan tidak disentuh (`FormPage.jsx:1095` `defaultData?.canDelete`, `DataTable2.jsx:193` `props.dataRow.canDelete`). Kedua mekanisme (`canDelete` dan `can("delete")`) tetap harus sama-sama `true` agar tombol delete muncul — perbaikan `checkPermission()` di atas hanya membuat `can("delete")` konsisten untuk model bypass, tidak mengubah `canDelete`.

### Role & Permission Settings — exclude model bypass TOTAL dari picker (revisi)

**Draft awal SALAH, dua kali**:

1. Percobaan pertama menambahkan `Permission::scopeLinkModel()` yang otomatis dipanggil `ModelController` untuk SEMUA pencarian model `Permission` — keliru karena `PermissionLinkModel` dipakai di banyak tempat lain (`EmailTemplate/Form.jsx`, `DeliveryNotes/Form.jsx`, `ApprovalScheme/Form.jsx`, `Widget/Form.jsx`, filter table) yang TIDAK PERLU exclude model apapun — konteksnya beda (memilih model target dokumen, bukan mengatur permission rule). Filter backend permanen jadi mempengaruhi semua pemakai itu tanpa sengaja. **`scopeLinkModel()` sudah dihapus dari `Permission.php`.**
2. Percobaan kedua memindahkan filter ke FE (`filters={{ ignore_permission: false }}` khusus di `FormNewRule.jsx`) — masih keliru, karena `ignore_permission = true` TIDAK berarti model itu tidak pernah butuh entry di `role_permissions`. `Todo` bypass gate CRUD standar, TAPI `authorizeOwnTodoOrPermission()` tetap membaca `role_permissions` lewat `PermissionChecker::can()` untuk kasus non-owner (Requirement 5.4). Filter berbasis kolom `ignore_permission` ikut meng-exclude `Todo` juga (karena kolomnya sama-sama `true`) — mematikan satu-satunya jalur admin memberi permission eksplisit ke Todo.

**Solusi final**: exclude berdasarkan **daftar FQCN eksplisit** (`model.notIn`), bukan kolom `ignore_permission` — karena tidak ada korelasi otomatis antara "model bypass gate" dan "model tidak butuh entry `role_permissions` sama sekali". Hanya `Ticket` dan `Changelog` yang benar-benar bypass TOTAL tanpa jalur permission apapun; `Todo` TETAP tampil di picker karena butuh diatur untuk kasus non-owner. Filter diterapkan di level FE, spesifik ke `FormNewRule.jsx` saja, lewat mekanisme `filters` prop yang sudah ada di `LinkModel`/`ModelController` (`applyLinkModelFilters()`, `ModelController.php:731`):

```jsx
// resources/js/Pages/Users/Roles/FormNewRule.jsx
<PermissionLinkModel
  required={false}
  placeholder={t("user.role.columns.model.placeholder")}
  filters={{
    model: {
      notIn: ["App\\Models\\Helpdesk\\Ticket", "App\\Models\\Core\\Changelog"],
    },
  }}
  value={rule.model}
  onValueChange={...}
/>
```

Shape `{ notIn: [...] }` mengikuti pola existing di codebase (mis. `AssignedToFields.jsx:37` `{ id: { notIn: excludeAssigneeIds } }`), diproses `LinkModelFilterConverter`/`FilterEvaluator` jadi `whereNotIn('model', [...])`. Filter ini HANYA berlaku untuk request yang eksplisit mengirimnya — pemanggil `PermissionLinkModel` lain yang tidak mengirim `filters.model.notIn` tetap menampilkan semua model termasuk Ticket/Todo/Changelog.

**Trade-off yang diterima**: daftar FQCN di-hardcode di `FormNewRule.jsx` — kalau ada model baru di masa depan yang bypass TOTAL tanpa jalur permission apapun (serupa Ticket), daftar ini perlu diupdate manual. Tidak ada mekanisme otomatis (kolom DB) yang membedakan "bypass total" vs "bypass gate tapi tetap punya jalur permission eksplisit" — dianggap cukup untuk 2 model yang ada sekarang, sesuai keputusan user (di luar scope menambah kolom baru).

Rule YANG SUDAH ADA sebelumnya (untuk model manapun) **tidak dihapus otomatis** oleh filter picker ini — hanya penambahan rule BARU yang terpengaruh. Baris rule existing di `Roles/Form.jsx` tetap tampil apa adanya (tidak diberi badge/disabled state — di luar scope, sesuai keputusan user).

## Data Models

Tidak ada perubahan tabel selain kolom baru `ignore_permission` (boolean, default `false`) di `permissions`. Tidak ada migration baru di `role_permissions` — flag ini murni per-model, bukan per-role.

## Correctness Properties

Property 1: Bypass model tidak pernah 403 lewat gate standar

_For any_ request ke `TicketController`/`TodoController`/`ChangelogController`, SELAMA `Permission::where('model', <model>)->value('ignore_permission') === true`, gate 403 di `Controller::__construct()` SHALL tidak pernah dieksekusi untuk request tersebut.

**Validates: Requirements 2.5, 4.1**

Property 2: Baca ToDo selalu terbuka untuk siapapun

_For any_ user U dan ToDo T (terlepas dari kepemilikan atau permission), `show` pada T oleh U SHALL selalu diizinkan.

**Validates: Requirements 5.1**

Property 3: Tulis/hapus ToDo milik sendiri selalu diizinkan

_For any_ user U dan ToDo T, IF U adalah salah satu assignee T (langsung atau lewat role) ATAU `T.assigned_by_id === U.id`, THEN `update`/`destroy` pada T oleh U SHALL selalu diizinkan, terlepas dari permission eksplisit U pada model `Todo`.

**Validates: Requirements 5.2**

Property 4: Tulis/hapus ToDo milik orang lain butuh permission eksplisit

_For any_ user U dan ToDo T dimana U BUKAN assignee dan BUKAN assigner T, `update`/`destroy` pada T oleh U SHALL diizinkan JIKA DAN HANYA JIKA `PermissionChecker::forUser(U)->can(Todo::class, <action sesuai method>)` bernilai `true`.

**Validates: Requirements 5.3, 5.4**

Property 5: Frontend tidak pernah menyembunyikan aksi untuk model bypass

_For any_ pemanggilan `checkPermission(permissions, model, action)` DIMANA `model` ada di `ignorePermissionModels`, hasil SHALL selalu `{allowed: true, onlyCreator: false}`, terlepas dari isi `permissions[model]` (termasuk ketika key tersebut tidak ada sama sekali).

**Validates: Requirements 3.3, 6.1**

## Error Handling

| Scenario                                                                            | Behavior                                                                                                |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| Controller tanpa `$this->model` ter-set (Notification, ApprovalInstance, SetupUser) | Fallback ke `$this->ignorePermission` milik controller, tidak memanggil `::ignoresPermission()` (menghindari error static call ke model yang tidak ada) |
| `TodoController::update/destroy` diakses user yang bukan assignee/assigner dan tidak punya permission eksplisit | `abort(403)`, konsisten dengan pola existing di `Controller::__construct()`. `show()` TIDAK terpengaruh — selalu 200. |
| Migration `down()` dijalankan                                                       | Drop kolom `ignore_permission`; aman karena kolom ini tidak menyimpan data transaksional yang perlu di-preserve |

## Testing Strategy

- **Feature test** `tests/Feature/Helpdesk/TicketTest.php` — pastikan user tanpa role/permission apapun tetap bisa CRUD Ticket penuh (regresi: behavior tidak berubah setelah pindah flag ke model).
- **Feature test** `tests/Feature/Core/TodoTest.php` — tambah case baru:
  - User B (bukan assignee/assigner, tanpa permission apapun) akses `show` Todo milik User A → tetap 200 (baca selalu bebas).
  - User A `update`/`destroy` Todo miliknya sendiri (assignee atau assigner = A) → berhasil, tanpa permission apapun.
  - User B (tanpa permission apapun) `update`/`destroy` Todo milik User A → 403.
  - User C (dengan permission `write`/`delete` eksplisit pada model Todo dari Role settings) `update` Todo milik User A → berhasil.
- **Test baru** — assert `Permission::where('model', Ticket::class)->value('ignore_permission') === true` dan sama untuk `Todo::class`, setelah `PermissionSeeder` dijalankan (test seeder behavior).
- **Test FE** (opsional, kalau ada test JS existing untuk `usePermission`) — assert `isIgnored` true untuk model yang ada di `ignorePermissionModels`.
