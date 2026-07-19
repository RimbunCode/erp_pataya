# Design Document: ToDo Feature + "Assigned To" Sidebar Widget

## Overview

Fitur ToDo generik seperti ERPNext: assignment polymorphic tak terbatas ke model apapun (User, Ticket, PurchaseOrder, Branch, dst), multi-assignee per dokumen (satu row `todos` per pasangan dokumen-assignee), widget "Assigned To" di sidebar `FormPage`, dan modul CRUD standalone (`/todos`) untuk melihat semua tugas milik/dari user.

Dibangun di atas infrastruktur notifikasi yang sudah landing (`NotifyUser`, database+broadcast+mail channel, bell icon di navbar) — tidak ada infra notifikasi baru. Wiring assign/unassign generik di-attach ke base `Controller.php` mengikuti pola `addTag`/`addFile`/`addComment` yang sudah ada, sehingga otomatis aktif di semua modul `resourceDetail` tanpa kode per-modul.

Scope terkonfirmasi user:
1. Target polymorphic universal (unrestricted `morphTo`, bukan registry `ApprovalScheme` yang dibatasi).
2. Multi-user assignment, sidebar = list add/remove.
3. Notifikasi reuse infra existing, satu class baru `TodoAssignedNotification`.
4. Modul standalone `/todos` dibangun sekarang (Index/Form/Show).
5. Permission: `Todo` terbuka untuk semua user, tanpa gate role/permission pada model itu sendiri (CRUD action-level).
6. Assignee bisa berupa **User ATAU Role**. Assign ke Role berarti SEMUA user pemegang role itu "memiliki" ToDo tersebut.
7. **Visibility scoping di halaman Index (KEPUTUSAN FINAL)**: user TANPA permission `select` pada model `Todo` hanya melihat ToDo yang di-assign langsung ke dirinya ATAU ke salah satu role yang dia miliki (`Todo::assignedToMe($request->user())`). User DENGAN permission `select` melihat semua ToDo tanpa batasan. Dicek via `PermissionChecker::forUser($request)->can(Todo::class, Permission::Select)` di `TodoController::index()`. TIDAK ada tab/filter UI (`?scope=`) di frontend — scoping murni otomatis berdasar permission, bukan pilihan user.
8. **Arsitektur assignee: tabel/view khusus `Assignable`** (bukan polymorphic morph dual-target langsung ke `users`/`roles`). `assignables` adalah DATABASE VIEW (bukan tabel fisik) hasil `UNION ALL` dari `users` dan `roles` — otomatis selalu sinkron (view di-query ulang tiap SELECT, tidak ada snapshot yang bisa stale), read-only (tidak pernah ditulis langsung). `todos.allocated_to_id` menjadi **satu kolom FK biasa** (tanpa FK constraint fisik, karena target adalah view) ke `assignables.id`, DITAMBAH `todos.allocated_to_type` (`'user'`/`'role'`) yang tetap disimpan sebagai cache/index cepat (menghindari JOIN ke view di setiap query scope/visibility). Akses/pencarian assignee di frontend lewat SATU `LinkModel` yang menunjuk ke model `Assignable`, dengan `templateLink()` = `':type : :name'` (mis. tampil sebagai "user : John Doe" atau "role : Warehouse Staff").

---

## Architecture

```
Dua entry point, satu tabel dasar (sama seperti Tag/Taggable, File/Fileable):

┌─ Sidebar "Assigned To" (di FormPage manapun, mis. Ticket/PurchaseOrder) ─┐
│  AssignedTo.jsx ──(AssignableLinkModel: pilih user/role)──┐              │
│                 ──POST /{module}/{id}/assignee──► Controller::addAssignee │
│                 ──DELETE /{module}/assignee/{id}──► Controller::removeAssignee │
└────────────────────────────┬──────────────────────────────────────────┘
                              │ Todo::firstOrCreate([reference_type, reference_id, allocated_to_id])
                              ▼
┌─ Modul ToDo standalone (/todos) ─────────────────────────────────────────┐
│  Todos/Index.jsx (DataTable2, visibility-scoped)                         │
│  Todos/Form.jsx  ──POST/PUT /todos──► TodoController ──► TodoService     │
└────────────────────────────┬──────────────────────────────────────────┘
                              ▼
                    todos table (satu row per assignee per dokumen)
                    allocated_to_id ──► assignables VIEW (UNION users + roles)
                              │
                              ▼ (saat row baru dibuat)
                    TodoService::notifyAssignee()
                              │              (resolve allocated_to_type: user→1 user, role→semua anggota)
                              ▼
              NotifyUser::send($eachUser, new TodoAssignedNotification($todo))
                              │
                    ┌─────────┼─────────┐
                    ▼         ▼         ▼
                database  broadcast   mail
                (bell)    (Pusher)  (queued job)
```

### Prinsip kunci: single source of truth

Assign dari sidebar = create `Todo` row secara praktis, scoped ke `reference_type`/`reference_id` = dokumen yang sedang dibuka. Baik aksi sidebar generik maupun halaman CRUD standalone beroperasi di tabel/model `Todo` yang sama — tidak ada duplikasi data atau dua sumber kebenaran.

### Create-mode buffering (assign saat dokumen baru dibuat)

Mengikuti pola `BufferedAttachmentService` yang sudah ada (dari spec `formpagedialog-sidebar`, `app/Services/Core/BufferedAttachmentService.php`) — di-extend dengan step `attachAssignees` yang membaca `buffered_assignees` dari request dan berjalan lewat hook `static::created()` trait `DataTable`.

---

## Components and Interfaces

### Database

**View baru `assignables`** (BUKAN tabel fisik) — `database/migrations/<timestamp>_create_assignables_view.php`, dibuat via raw SQL `DB::statement()` karena Laravel tidak punya schema builder untuk view:

```php
public function up(): void {
    DB::statement("
        CREATE VIEW assignables AS
        SELECT id, 'user' AS type, name FROM users WHERE deleted_at IS NULL
        UNION ALL
        SELECT id, 'role' AS type, name FROM roles WHERE deleted_at IS NULL
    ");
}

public function down(): void {
    DB::statement('DROP VIEW IF EXISTS assignables');
}
```

Karena `UNION ALL`, view ini otomatis read-only di semua driver DB yang dipakai project (MySQL, SQLite untuk test) — cocok karena `Assignable` memang hanya dibaca lewat `LinkModel`, tidak pernah ditulis langsung. Selalu sinkron by construction (di-query ulang tiap SELECT, tidak ada snapshot yang bisa stale) — tidak perlu event listener/sync command apapun.

**Migrasi `todos`** `database/migrations/2026_07_18_000001_create_todos_table.php` — mengikuti gaya `logs`/`fileables` untuk `reference` (ulid PK, `nullableUlidMorphs`). Assignee sekarang **satu FK biasa** ke `assignables.id` (TANPA FK constraint fisik — target adalah view, bukan tabel, dan FK ke view tidak didukung DB manapun), ditambah `allocated_to_type` sebagai cache cepat:

```php
Schema::create('todos', function (Blueprint $table) {
    $table->ulid('id')->primary();
    $table->nullableUlidMorphs('reference'); // model APAPUN, morphTo tak terbatas seperti Log::loggable — nullable karena ToDo standalone boleh tanpa reference (lihat Requirement 4.4)
    $table->ulid('allocated_to_id'); // FK ke assignables.id — TANPA foreign key constraint (target view, bukan tabel)
    $table->string('allocated_to_type'); // 'user' | 'role' — cache dari Assignable.type, dipakai untuk query cepat tanpa JOIN ke view
    $table->foreignUlid('assigned_by_id')->nullable()->references('id')->on('users')->nullOnDelete();
    $table->text('description')->nullable();
    $table->string('priority')->default('medium'); // low, medium, high
    $table->string('status')->default('open'); // open, closed, canceled
    $table->date('date')->nullable();
    $table->dateTime('due_date')->nullable();
    $table->timestamps();
    $table->softDeletes();

    $table->unique(['reference_type', 'reference_id', 'allocated_to_id', 'deleted_at'], 'todos_reference_assignee_unique');
});
```

Catatan desain:

- Migrasi `assignables` view HARUS jalan SEBELUM migrasi `todos` (urutan timestamp) — tidak ada dependency FK fisik, tapi urutan logis tetap penting untuk keterbacaan/konsistensi (view harus "ada" secara konsep sebelum tabel yang mereferensikannya, meski secara teknis SQLite/MySQL tidak memvalidasi ini tanpa FK constraint).
- `allocated_to_id` bisa berasal dari `users.id` ATAU `roles.id` (dua ruang ULID yang berbeda tapi sama-sama valid ULID) — `allocated_to_type` WAJIB selalu diisi bersamaan supaya query tahu tabel asal mana yang harus di-JOIN saat butuh detail lengkap (mis. `email` User yang tidak ada di view `assignables`).
- Unique constraint kembali ke bentuk sederhana `[reference_type, reference_id, allocated_to_id, deleted_at]` (satu kolom assignee, bukan pasangan morph) — karena `allocated_to_id` sekarang cukup unik lintas User dan Role (ULID praktis tidak pernah collide antar tabel berbeda).
- Tidak ada `code` (bukan genre dokumen submitable) dan tidak ada `branch_id` (record cross-cutting ringan, mirip `Tag`/`Log`, bukan `Ticket`).

**Factory** `database/factories/Core/TodoFactory.php` — standar, `reference_type/id` default ke `User`, `allocated_to_type` default `'user'`, `allocated_to_id` via `User::factory()`, `assigned_by_id` via `User::factory()`.

### Backend — Model Assignable (baru)

`app/Models/User/Assignable.php` (atau `App\Models\Core\Assignable` — ikuti konvensi domain `User`, karena isinya representasi User+Role) — model READ-ONLY di atas view `assignables`:

```php
class Assignable extends Model {
    protected $table = 'assignables';
    public $timestamps = false;
    public $incrementing = false;
    protected $keyType = 'string';

    public static function templateLink() {
        return ':type : :name';
    }
}
```

TIDAK pakai trait `DataTable` (sesuai keputusan user — model ini murni untuk `LinkModel`, tidak butuh halaman list/CRUD/permission sendiri). TIDAK ada `HasFactory` (tidak pernah di-`create()` langsung — datanya selalu berasal dari `users`/`roles`). `$incrementing = false` + `$keyType = 'string'` karena PK adalah ULID (string), bukan auto-increment integer, mengikuti konvensi ULID di seluruh app meski model ini tidak pakai `HasUlids` (tidak pernah generate ID baru sendiri).

### Backend — Model Todo

`app/Models/Core/Todo.php` — mirror `Ticket.php` tapi polymorphic untuk `reference`, pakai `DataTable, HasFactory, HasUlids, SoftDeletes`. Relasi: `reference()` morphTo, `allocatedTo()` belongsTo `Assignable::class` (FK `allocated_to_id`, TANPA constraint DB tapi tetap relasi Eloquent biasa karena `Assignable` adalah model normal di atas view), `assignedBy()` belongsTo `User`.

Method baru `allocatedUsers(): Collection` — resolve assignee jadi user-user nyata untuk keperluan notifikasi dan visibility scoping:

```php
public function allocatedUsers(): Collection {
    if ($this->allocated_to_type === 'role') {
        return User::whereHas('roles', fn ($q) => $q->where('roles.id', $this->allocated_to_id))->get();
    }

    $user = User::find($this->allocated_to_id);

    return $user ? collect([$user]) : collect();
}
```

Null-safe: assignee User yang sudah dihapus, atau Role tanpa anggota (atau sudah dihapus), keduanya resolve ke collection kosong — tidak pernah crash.

Scope `scopeAssignedToMe($query, User $user)` — cover assign-langsung-ke-user MAUPUN assign-ke-role-yang-dimiliki-user:

```php
public function scopeAssignedToMe($query, User $user) {
    $roleIds = $user->roles()->pluck('roles.id');

    return $query->where(function ($q) use ($user, $roleIds) {
        $q->where(['allocated_to_type' => 'user', 'allocated_to_id' => $user->id])
          ->orWhere(function ($q2) use ($roleIds) {
              $q2->where('allocated_to_type', 'role')->whereIn('allocated_to_id', $roleIds);
          });
    });
}
```

Scope `scopeAssignedByMe($query, string $userId)` — tidak berubah (`assigned_by_id` selalu User tunggal).

`configColumns['status']` sengaja **tanpa** `valueTrans` (reuse namespace `status.*` bersama, sama seperti `PurchaseOrder`); `configColumns['priority']` pakai `valueTrans: 'core.todo.priority.options'` (module-scoped, karena tidak ada namespace priority bersama). `configColumns['allocatedTo']` menampilkan `Assignable` (relasi biasa, bukan morph) — `templateLink()` milik `Assignable` (`':type : :name'`) otomatis menghasilkan label yang jelas beda User vs Role tanpa perlu logic kondisional tambahan di frontend.

**Catatan keamanan relasi**: `configColumns['allocatedTo']` WAJIB set `'disabledNavigation' => true`. Alasan: `LinkModel::getRouteAttribute()` (base trait, `app/Traits/LinkModel.php:317-319`) otomatis meng-generate `route: "assignables.show"` untuk SEMUA relasi `BelongsTo` tanpa syarat apapun — termasuk ke `Assignable`, meski tidak ada `AssignableController`/route terdaftar untuk itu (`Assignable` sengaja read-only, tidak punya halaman show sendiri). Tanpa `disabledNavigation`, komponen tabel generik (`Table2.jsx`'s `Cell` renderer) akan mencoba `window.route('assignables.show', id)` saat user dengan permission `read` ke `Assignable` mengklik baris — dan `Ziggy` akan `throw` (route tidak terdaftar), meng-crash render. Saat ini "aman" secara kebetulan HANYA karena tidak ada seorang pun diberi permission `read` ke `Assignable` (`PermissionSeeder` melewatinya karena tidak pakai trait `DataTable`) — kalau suatu saat ada yang menambahkan row `RolePermission` manual untuk `Assignable::class`, celah ini langsung aktif. `disabledNavigation: true` menghilangkan ketergantungan pada kebetulan ini, sama seperti pola yang sudah dipakai `AssignableLinkModel.jsx` (`disabledNavigation` prop) untuk alasan yang sama persis.

### Backend — Wiring sidebar generik

**`app/Http/Controllers/Controller.php`** (extend, setelah `removeFile`) — tambah `addAssignee`/`removeAssignee`. Payload `allocated_to` sekarang berupa satu objek `Assignable` hasil pilih dari `AssignableLinkModel` (`{ id, type }`) — jauh lebih simpel dari desain dual-morph sebelumnya karena tidak perlu resolve FQCN target secara manual di controller:

```php
public function addAssignee(AssigneeRequest $request, $param) {
    $data = $request->validated();
    $todo = Todo::firstOrCreate([
        'reference_id'    => $param,
        'reference_type'  => $this->model,
        'allocated_to_id' => $data['allocated_to']['id'],
    ], [
        'allocated_to_type' => $data['allocated_to']['type'], // 'user' | 'role', langsung dari Assignable.type
        'assigned_by_id'    => $request->user()->id,
        'status'            => 'open',
        'priority'          => $data['priority'] ?? 'medium',
        'description'       => $data['description'] ?? null,
    ]);
    if ($todo->wasRecentlyCreated) {
        app(TodoService::class)->notifyAssignee($todo);
    }
    return back();
}

public function removeAssignee(Request $request, $param, Todo $id) {
    $id->delete();
    return back();
}
```

Permission: tambahkan `addAssignee`, `removeAssignee` ke match arm `'read'` yang sudah ada (baris ~152-158), sejajar `addTag`/`addFile`/`removeTag`/`removeFile` — siapapun dengan akses `read` ke dokumen target bisa assign/unassign.

**`routes/web.php`** — macro `Route::resourceDetail` (baris 66-103), tambah di dalam closure:

```php
Route::post("/{{$name}}/assignee", 'addAssignee')->name("$uri.addAssignee");
Route::delete("/{{$name}}/assignee/{id}", 'removeAssignee')->name("$uri.removeAssignee");
```

Otomatis aktif di semua modul `resourceDetail` — Ticket, PurchaseOrder, Branch, User, dst — tanpa kode per-modul.

**Request classes**: `app/Http/Requests/Core/AssigneeRequest.php` (quick-assign, reference implisit dari route param) dan `app/Http/Requests/Core/TodoRequest.php` (CRUD standalone, reference eksplisit) — dipisah karena bentuk berbeda. Keduanya extend `BaseFormRequest`. Validasi `allocated_to` — cukup `exists:assignables,id` (SATU rule, langsung ke view, tidak perlu percabangan `when()` seperti desain dual-morph sebelumnya):

```php
'allocated_to'      => ['required', 'array'],
'allocated_to.id'   => ['required', 'string', 'exists:assignables,id'],
'allocated_to.type' => ['required', 'string', 'in:user,role'],
```

### Backend — Modul standalone

**`app/Services/Core/TodoService.php`** — `create()`/`update()` standar + `notifyAssignee()` public sebagai **satu-satunya** titik dispatch notifikasi (dipanggil dari sidebar controller action DAN service ini). `notifyAssignee()` sekarang fan-out ke SEMUA user hasil `$todo->allocatedUsers()` (satu user jika `allocated_to_type === 'user'`, banyak user jika `'role'` — setiap user pemegang role dinotifikasi individual), dengan guard self-notification per-user (assign ke diri sendiri tidak memicu notif untuk user itu spesifik, tapi user lain dalam role yang sama tetap dinotifikasi).

**`app/Http/Controllers/Core/TodoController.php`** — CRUD standar, `protected bool $ignorePermission = true;` (bagian 10 desain permission — flag ini membebaskan aksi CRUD dari 403 base-permission-check, TAPI TIDAK membebaskan `index()` dari visibility scoping — dua mekanisme independen, lihat detail scoping di bawah).

**Visibility scoping di `index()`**: sebelum memanggil `Todo::dataTable($request)`, cek `PermissionChecker::forUser($request)->can(Todo::class, Permission::Select)`. Jika user PUNYA permission penuh, query tidak dibatasi (lihat semua ToDo). Jika TIDAK punya, terapkan `->assignedToMe($request->user())` (scope yang sudah meng-cover user langsung + role — lihat bagian Model di atas) sebelum `dataTable()` dipanggil:
```php
public function index(Request $request) {
    $this->setBreadcrumbs();

    $query = PermissionChecker::forUser($request)->can(Todo::class, Permission::Select)
        ? Todo::query()
        : Todo::assignedToMe($request->user());

    $query->dataTable($request);

    return Inertia::render('Core/Todos/Index');
}
```
`Todos/Index.jsx` TIDAK punya tab/filter UI — cuma wrapper trivial `<DataTable2 form={<Form/>} />`. Scoping murni ditentukan server berdasar permission user, bukan pilihan yang bisa di-toggle dari frontend.

**`routes/web.php`** — `Route::resourceDetail('todo', TodoController::class);` didaftarkan dekat modul Core lain (setelah `file`).

**Permission sync**: `database/seeders/PermissionSeeder.php` menelusuri classmap composer, auto-detect model dengan trait `DataTable`, panggil `initPermissions()` — `Todo` otomatis terdeteksi begitu file model dibuat.

### Backend — Notifikasi

`app/Notifications/TodoAssignedNotification.php` — mirror `ApprovalPendingNotification.php`, `via(): ['database', 'broadcast', 'mail']`. `documentType`/`documentId` di payload **selalu mengarah ke Todo itu sendiri** (bukan dokumen reference) — karena `DOCUMENT_TYPE_ROUTE_MAP` di frontend tidak feasible diisi untuk model apapun (unrestricted target), dan pola yang ada memang didesain incremental. `Todos/Show.jsx` menambahkan link "View Document" terpisah ke `reference` bila ada.

`resources/js/Components/Navbar/Notifications.jsx` — tambah `DOCUMENT_TYPE_ROUTE_MAP['App\Models\Core\Todo'] = 'todos'`.

`lang/en|id/notification.php` — tambah key `todo_assigned` (title + message dengan placeholder `:assigner`/`:document`).

### Frontend — Widget sidebar

**`resources/js/Pages/Users/ManageUsers/AssignableLinkModel.jsx`** (baru, mirror persis `UserLinkModel.jsx`) — wrapper `LinkModel` scoped `model="App\Models\User\Assignable"`. SATU picker untuk User dan Role sekaligus (bukan dua picker terpisah/toggle) — karena `Assignable` sudah menggabungkan keduanya lewat view, `LinkModel` biasa (search generik yang sudah ada) otomatis bisa cari lintas User dan Role tanpa kode tambahan. Hasil pilih membawa `{ id, type, name }` langsung dari kolom view (`type` = `'user'`/`'role'`), label tampil sebagai `":type : :name"` dari `Assignable::templateLink()` — mis. "user : John Doe" atau "role : Warehouse Staff" — sehingga dropdown pencarian sendiri sudah membedakan visual User vs Role tanpa UI kustom tambahan.

**`resources/js/Pages/Core/Components/AssignedTo.jsx`** (baru) — clone pola dual-mode `Tags.jsx` (create-buffer vs `usePage().props`) + rendering list-with-remove `Attachments.jsx`, tapi tambah via `AssignableLinkModel` (satu picker, bukan `UserLinkModel`). Prop deferred `assignees` baru (mirip `tags`/`attachments`), filter `status === 'open'` saja (assignment aktif; yang closed/canceled tetap terlihat di halaman standalone). Setiap item di list ditampilkan dengan label `":type : :name"` yang sama (konsisten dengan picker-nya) — item dengan `type === 'role'` boleh dapat ikon/badge kecil tambahan (opsional, kosmetik) tapi TIDAK butuh logic kondisional rendering terpisah karena label teks sudah menyebutkan tipe-nya secara eksplisit. Create-mode: buffer `data.buffered_assignees` (array `{ id, type, name }`), di-attach lewat `BufferedAttachmentService::attachAssignees()` setelah record baru dibuat (hook `static::created()`).

Wire ke `SidebarChildren` (`FormPage.jsx` baris 1558-1569) — `AssignedTo` ditambah sebagai item pertama, sebelum `Attachments`/`Tags`.

`App\Traits\DataTable::showDetail()` (baris 535-609) — tambah deferred prop `assignees`.

### Frontend — Modul standalone

`resources/js/Pages/Core/Todos/Index.jsx` — trivial wrapper `<DataTable2 form={<Form/>} />`, TANPA tab/top-bar kustom (keputusan: DataTable2 tidak punya passthrough query-param custom yang aman lintas sort/paginate — lihat Out of Scope). Filter "assigned by me"/status/priority/assignee reuse UI filter kolom generik `DataTable2` yang sudah ada. Visibility scoping (siapa yang boleh lihat ToDo siapa) ditangani sepenuhnya di backend (`TodoController::index`), bukan lewat UI filter — user tanpa permission modul Todo otomatis hanya menerima row miliknya dari server, tidak ada opsi UI untuk "lihat semua" yang bisa mereka toggle.

`resources/js/Pages/Core/Todos/Form.jsx` — field `allocated_to` (picker User-atau-Role, lihat `AssignedTo.jsx`, required), `description`, `priority`, `status`, `date`, `due_date`. Field `reference` **opsional**, dikosongkan di form standalone (ToDo standalone = tugas personal tanpa reference; ToDo ber-reference dibuat lewat sidebar widget). Generic any-model picker untuk reference di form standalone ditandai sebagai follow-up, bukan scope pass ini.

`resources/js/Pages/Core/Todos/Show.jsx` — `<FormPage>` standar + blok info referensi di sidebar/atas form bila `todo.reference` ada: menampilkan label dokumen (kode/nama reference, mis. "PO-2026-00042" atau "TCKT-00012") sebagai link yang mengarah ke halaman detail dokumen tersebut (`referenceRoute`). Jika `reference_type`/`reference_id` ada tapi record-nya sudah terhapus (`reference` null karena soft/hard delete), tampilkan indikator "Reference terhapus" alih-alih link mati.

`app/Http/Controllers/Core/TodoController::show` — payload tambahan `referenceLabel` (dihitung dari `$todo->reference?->code ?? $todo->reference?->name`, reuse logic yang sama dengan `TodoAssignedNotification::documentLabel()`) dan `referenceRoute` (`Str::plural($todo->reference->getNameClass()) . '.show'`, null jika reference tidak ada).

### i18n & theme

`lang/{en,id}/core/todo.php` (baru, mirror `lang/en/helpdesk/ticket.php`). Status **tidak** punya sub-array sendiri — reuse `lang/*/status.php` bersama, tambah key `open` (satu-satunya yang belum ada; `closed`/`canceled` — **ejaan satu-L**, dikonfirmasi dari `BadgeStatus.jsx` theme map — sudah ada). `resources/js/Components/BadgeStatus.jsx` tambah `open: "warning"` ke theme map.

---

## Data Models / Payload

```
assignables (VIEW, read-only, UNION users + roles):
  id, type (user|role), name

todos:
  id (ulid), reference_type, reference_id,
  allocated_to_id (FK ke assignables.id, tanpa constraint fisik),
  allocated_to_type (user|role, cache dari Assignable.type),
  assigned_by_id, description, priority (low|medium|high),
  status (open|closed|canceled), date, due_date, timestamps, deleted_at

AssigneeRequest (sidebar quick-assign):
  allocated_to: { id, type }, description?, priority?

TodoRequest (CRUD standalone):
  reference_type?, reference_id?, allocated_to: { id, type },
  description?, priority, status, date?, due_date?

buffered_assignees (create-mode buffer, frontend):
  [{ id, type, name }, ...]
```

---

## Error Handling

- **Idempotensi assign**: `firstOrCreate` dengan search array `[reference_id, reference_type, allocated_to_id]` (persis unique index) — assign ulang user/role yang sama menemukan row existing, tidak bentrok constraint.
- **Self-notification (per-user, bukan per-row)**: `TodoService::notifyAssignee()` iterasi `$todo->allocatedUsers()`, skip kirim notifikasi HANYA untuk user yang `id`-nya sama dengan `assigned_by_id` — user lain dalam role yang sama (jika assign-ke-role) tetap dinotifikasi normal.
- **Soft-delete aman**: unique index menyertakan `deleted_at`, sehingga re-assign setelah remove selalu membuat row baru yang valid.
- **Guard buffered-assign recursive**: `Todo` sendiri diberi `$skipAttachmentOnCreate = true` supaya tidak recurse ke `attachAssignees` saat pembuatan dirinya sendiri (opt-out generik yang sudah ada di `bootDataTable()`).
- **Permission dokumen target vs Todo**: assign/unassign via sidebar tetap digate `read` pada dokumen target (mis. Ticket) — bukan pada `Todo`. Aksi CRUD `Todo` sendiri tanpa gate 403 sama sekali (`$ignorePermission = true`), sesuai keputusan user.
- **Visibility scoping ≠ permission gate**: user tanpa permission `select` pada `Todo` TIDAK mendapat 403 saat akses `/todos` — mereka tetap bisa masuk, tapi query di-scope otomatis ke `assignedToMe()`. Ini best-effort row-level security di level query, bukan penolakan akses; jangan bingung dengan gate 403 standar.
- **Role di-assign lalu role dihapus**: `allocatedTo` (relasi `belongsTo(Assignable::class)`) akan resolve `null` jika baris `roles` yang mendasari view sudah dihapus (belum ada cascade karena `allocated_to_id` tanpa FK constraint fisik) — `allocatedUsers()` harus null-safe (return collection kosong bila role/user tidak ditemukan, bukan crash). Dicatat sebagai edge case yang test-nya perlu cover.
- **View `assignables` tidak sengaja ter-drop/ter-rename**: karena bukan tabel fisik biasa, migrasi rollback (`down()`) HARUS eksplisit `DROP VIEW IF EXISTS assignables` — lupa langkah ini akan meninggalkan view basi (menunjuk skema lama) setelah rollback+migrate ulang dengan skema `users`/`roles` yang berubah.

---

## Testing Strategy

- **Feature**: `tests/Feature/Core/TodoTest.php` — create/update/delete standalone, assign ke User, assign ke Role.
- **Feature**: `tests/Feature/Core/AssignedToSidebarTest.php` — diuji terhadap modul `resourceDetail` yang sudah ada (mis. `Ticket`) untuk membuktikan genericity: assign/unassign via sidebar tanpa kode per-modul (User dan Role), idempotensi assign duplikat, notifikasi terkirim (dan tidak terkirim saat assign ke diri sendiri).
- **Feature**: `tests/Feature/Core/TodoVisibilityScopeTest.php` — user tanpa permission `select` pada `Todo` hanya melihat ToDo miliknya (langsung + lewat role) di `/todos`; user DENGAN permission melihat semua; role dengan banyak anggota — semua anggota melihat ToDo yang di-assign ke role itu; role yang di-assign lalu dihapus tidak menyebabkan error di Index/notifikasi.
- **Unit**: `tests/Unit/Core/Notification/TodoAssignedNotificationTest.php` — ikuti konvensi existing (unit jika notifikasi lain punya unit test terpisah, feature-only jika tidak).
- **Unit/Feature**: `Todo::allocatedUsers()` — assign-ke-user return 1 user, assign-ke-role return semua user pemegang role (termasuk 0 user jika role kosong), assign-ke-role-yang-dihapus return collection kosong (null-safe).
- **Feature**: `tests/Feature/Core/AssignableViewTest.php` (baru) — `Assignable::all()`/`Assignable::find($userOrRoleId)` mengembalikan gabungan User+Role yang benar dengan `type` sesuai asal tabel; user/role baru yang dibuat SETELAH migrasi langsung muncul di query `Assignable` tanpa perlu sync manual (membuktikan view selalu live, bukan snapshot); user/role yang di-soft-delete tidak lagi muncul di `Assignable`.
- **Factory**: `database/factories/Core/TodoFactory.php` dibutuhkan untuk semua test di atas.
- **Manual**: assign user ke Ticket existing lewat sidebar, konfirmasi bell notifikasi (broadcast real-time) + halaman `/todos` menampilkan row baru. Assign Role ke Ticket, login sebagai anggota role tsb (tanpa permission Todo select), konfirmasi ToDo itu muncul di `/todos` miliknya (di-scope otomatis, bukan lihat semua).

---

## Out of Scope (YAGNI)

- Generic any-model `LinkModel`/picker untuk field `reference` di form ToDo standalone (assign ber-reference tetap lewat sidebar widget, bukan lewat form standalone).
- Assignee bisa close/cancel ToDo tanpa permission `write` sebagai aturan khusus — moot karena `Todo` memang sudah terbuka untuk semua user.
- Populate `DOCUMENT_TYPE_ROUTE_MAP` untuk setiap kemungkinan model reference — notifikasi selalu mengarah ke Todo itu sendiri, bukan ke dokumen reference secara langsung.
- Avatar-stack visual baru untuk sidebar widget — reuse pola list vertikal existing (`Attachments.jsx`) demi konsistensi UI, bukan pola baru.
- **Tab/top-bar kustom "assigned to me"/"assigned by me" di `Todos/Index.jsx`** — sengaja tidak dibuat. Visibility scoping ditangani sepenuhnya di backend (`TodoController::index()`, berdasar permission `select`) — tidak ada UI toggle yang bisa dipilih user, karena scoping memang bukan preferensi tampilan, melainkan kontrol siapa-lihat-apa. `Todos/Index.jsx` cuma wrapper trivial `<DataTable2 form={<Form/>} />`.
- Notifikasi real-time role-fanout tetap lewat channel per-user yang sudah ada (`App.Models.User.User.{id}`) — TIDAK ada channel baru per-role. Fan-out cukup dengan mengirim notifikasi individual ke tiap user anggota role, bukan broadcast ke channel role.
- **Mekanisme sync/cache tabel Assignable** — tidak dibutuhkan sama sekali karena `assignables` adalah database VIEW (bukan tabel fisik yang di-duplikasi). Tidak ada Eloquent model event listener, Artisan command, atau job terjadwal untuk "menyamakan" data — view selalu live dan konsisten dengan `users`/`roles` by construction. Ini sengaja dipilih user dibanding alternatif tabel fisik duplikat (yang butuh sync eksplisit dan berisiko stale).
- **`Assignable` sebagai model yang bisa di-`create()`/`update()`/`delete()`** — sengaja tidak dibangun (read-only by design, sesuai instruksi user). Perubahan assignee dilakukan lewat model asal (`User`/`Role`), bukan lewat `Assignable`.
