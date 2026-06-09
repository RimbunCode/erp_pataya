# Design Document: Helpdesk Tiket

## Overview

Modul **Helpdesk** adalah modul baru yang terpisah dari Core, berisi entitas `Tiket` dan `TiketResponse`. Tiket bersifat non-submitable — status dikelola sendiri. Setiap pembaruan disimpan sebagai `TiketResponse` (history). TiptapEditor digunakan untuk field `content` dengan extension upload gambar langsung ke model `File`.

---

## Architecture

```
app/
  Http/Controllers/Helpdesk/
    TiketController.php           ← CRUD + markDone + updateTiket
  Http/Requests/Helpdesk/
    TiketRequest.php              ← validasi store/update
    TiketResponseRequest.php      ← validasi response (markDone & updateTiket)
  Models/Helpdesk/
    Tiket.php                     ← Model utama, DataTable trait
    TiketResponse.php             ← Model history response
  Services/Helpdesk/
    TiketService.php              ← business logic create/update/markDone/updateTiket

database/migrations/
  ..._create_tikets_table.php
  ..._create_tiket_responses_table.php

resources/js/Pages/Helpdesk/Tikets/
  Index.jsx                       ← DataTable2
  Show.jsx                        ← FormPage wrapper + action buttons
  Form.jsx                        ← Field-field tiket
  TiketLinkModel.jsx              ← LinkModel selector (untuk referensi lain)

lang/
  en/helpdesk/tiket.php
  id/helpdesk/tiket.php

routes/web.php                    ← tambah resourceDetail untuk tikets
```

---

## Database Schema

### Tabel `tikets`

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | ulid, PK | |
| `code` | string, unique | Auto-generate via FormatingSeries |
| `type` | string | bug_problem / task / question / other |
| `priority` | string | low / medium / high / critical |
| `subject` | string | Judul tiket |
| `content` | longText, nullable | Rich text (Tiptap JSON/HTML) |
| `status` | string, default=new | new / in_progress / on_hold / resolved / done |
| `progress` | tinyInteger, default=0 | 0–100 |
| `assign_to_id` | foreignUlid, nullable | FK ke users.id |
| `created_by_id` | foreignUlid | FK ke users.id |
| `branch_id` | foreignUlid, nullable | FK ke branches.id |
| `start_date` | datetime, nullable | Default = created_at |
| `due_date` | datetime, nullable | Target selesai |
| `end_date` | datetime, nullable | Tanggal selesai aktual (diisi saat Mark Done) |
| `timestamps` | | |
| `softDeletes` | | |

### Tabel `tiket_responses`

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | ulid, PK | |
| `tiket_id` | foreignUlid | FK ke tikets.id |
| `user_id` | foreignUlid | FK ke users.id (yang membuat response) |
| `assign_to_id` | foreignUlid, nullable | Assignee baru (jika berubah) |
| `status` | string | Status tiket saat response |
| `progress` | tinyInteger | Progress tiket saat response |
| `content` | longText, nullable | Rich text response |
| `end_date` | datetime, nullable | Diisi saat Mark Done |
| `timestamps` | | |
| `softDeletes` | | |

---

## Model Design

### `Tiket` Model

```php
class Tiket extends Model {
    use DataTable, HasUlids, SoftDeletes;

    public static $formComponent = 'Helpdesk/Tikets/Form';
    public static $alias = 'Tiket';
    public $translateKey = 'helpdesk.tiket';
    public $keyBreadcrumb = 'subject';

    protected array $configColumns = [
        'code'       => ['show' => true, 'order' => 0],
        'type'       => ['show' => true, 'order' => 1],
        'subject'    => ['show' => true, 'order' => 2],
        'status'     => ['show' => true, 'order' => 3],
        'progress'   => ['show' => true, 'order' => 4],
        'priority'   => ['show' => true, 'order' => 5],
        'assign_to'  => ['show' => true, 'order' => 6],
        'created_by' => ['show' => true, 'order' => 7],
        'start_date' => ['show' => false, 'order' => 8],
        'due_date'   => ['show' => false, 'order' => 9],
    ];

    // Relations
    public function assignTo(): BelongsTo   // → User
    public function createdBy(): BelongsTo  // → User
    public function branch(): BelongsTo     // → Branch
    public function responses(): HasMany    // → TiketResponse
}
```

### `TiketResponse` Model

```php
class TiketResponse extends Model {
    use HasUlids, SoftDeletes;

    // Relations
    public function tiket(): BelongsTo   // → Tiket
    public function user(): BelongsTo    // → User
    public function assignTo(): BelongsTo // → User
}
```

---

## Controller Design

### `TiketController`

```php
class TiketController extends Controller {
    public function __construct(Request $request, TiketService $service) {
        $this->service = $service;
        parent::__construct($request, Tiket::class);
    }

    public function index(Request $request)         // → DataTable + Inertia render
    public function store(TiketRequest $request)    // → service->create() + redirect show
    public function show(Tiket $tiket)              // → load responses + Inertia render
    public function update(TiketRequest $request, Tiket $tiket) // → service->update()
    public function destroy(Tiket $tiket)           // → delete + redirect index

    // Custom actions (PUT /tikets/{tiket}/markDone & /tikets/{tiket}/updateTiket)
    public function markDone(Tiket $tiket)                                      // → service->markDone()
    public function updateTiket(TiketResponseRequest $request, Tiket $tiket)    // → service->updateTiket()
}
```

### Custom Routes

```php
Route::resourceDetail('tiket', TiketController::class);
// Tambahan manual:
Route::put('/tikets/{tiket}/markDone', [TiketController::class, 'markDone'])->name('tikets.markDone');
Route::put('/tikets/{tiket}/updateTiket', [TiketController::class, 'updateTiket'])->name('tikets.updateTiket');
```

---

## Service Design

### `TiketService`

```php
class TiketService {
    public function create(array $data): Tiket {
        // FormatingSeries::generate(Tiket::class, $data)
        // $tiket = Tiket::create($data)
        // $tiket->logForCreated()
        // return $tiket
    }

    public function update(Tiket $tiket, array $data): Tiket {
        // $tiket->update($data)
        // $tiket->logForUpdated()
        // return $tiket
    }

    public function markDone(Tiket $tiket): Tiket {
        // $tiket->update(['status'=>'done','progress'=>100,'end_date'=>now()])
        // TiketResponse::create([..., 'status'=>'done', 'progress'=>100, 'end_date'=>now()])
        // $tiket->logForUpdated()
        // return $tiket
    }

    public function updateTiket(Tiket $tiket, array $data): TiketResponse {
        // $tiket->update(['assign_to_id'=>..., 'status'=>..., 'progress'=>...])
        // $response = TiketResponse::create([...])
        // $tiket->logForUpdated()
        // return $response
    }
}
```

---

## Frontend Design

### Layout Form (Show/Form)

```
┌─────────────────────────────────────────────────────┐
│  FormPage (name="tiket", title=subject)             │
│  controls: [Mark Done] [Update Tiket]               │
├──────────────────────┬──────────────────────────────┤
│  Informasi Tiket     │  Assignment & Timeline        │
│  ─────────────────   │  ──────────────────────────  │
│  Type     [select]   │  Assign To  [UserLinkModel]  │
│  Priority [select]   │  Start Date [DatetimePicker] │
│  Status   [select]   │  Due Date   [DatetimePicker] │
│  Progress [slider]   │  End Date   [DatetimePicker] │
├──────────────────────┴──────────────────────────────┤
│  Subject                                            │
│  [input text full width]                            │
├─────────────────────────────────────────────────────┤
│  Content                                            │
│  [TiptapEditor full width, dengan image upload]     │
├─────────────────────────────────────────────────────┤
│  Riwayat Response  (show only, di Show.jsx)         │
│  ─────────────────                                  │
│  [TiketResponseList]                                │
└─────────────────────────────────────────────────────┘
```

### AlertDialog Update Tiket

```
┌─────────────────────────────────────────────────────┐
│  Update Tiket                                       │
│  ─────────────────────────────────────────────────  │
│  Assign To  [UserLinkModel]  [Assign to Creator]   │
│             (tombol hanya muncul jika bukan creator)│
│  Status     [select]                               │
│  Progress   [slider 0-100]                         │
│  End Date   [DatetimePicker] (opsional)            │
│  Content    [TiptapEditor]                         │
│  ─────────────────────────────────────────────────  │
│                        [Batal]  [Simpan Update]    │
└─────────────────────────────────────────────────────┘
```

### TiptapEditor Image Upload Extension

Tambahkan `Image` extension dari `@tiptap/extension-image` ke `TiptapEditor` dengan custom `addCommands` untuk upload gambar via POST ke `/tikets/{id}/file`. Response URL langsung diinsert ke editor.

---

## i18n Key Structure

```php
// lang/en/helpdesk/tiket.php
return [
    'new'      => 'New Ticket',
    'fields'   => [
        'code'       => 'Code',
        'type'       => 'Type',
        'priority'   => 'Priority',
        'subject'    => 'Subject',
        'content'    => 'Content',
        'status'     => 'Status',
        'progress'   => 'Progress',
        'assign_to'  => 'Assign To',
        'start_date' => 'Start Date',
        'due_date'   => 'Due Date',
        'end_date'   => 'End Date',
    ],
    'type' => [
        'options' => [
            'bug_problem' => 'Bug / Problem',
            'task'        => 'Task',
            'question'    => 'Question',
            'other'       => 'Other',
        ],
    ],
    'priority' => [
        'options' => [
            'low'      => 'Low',
            'medium'   => 'Medium',
            'high'     => 'High',
            'critical' => 'Critical',
        ],
    ],
    'status' => [
        'options' => [
            'new'         => 'New',
            'in_progress' => 'In Progress',
            'on_hold'     => 'On Hold',
            'resolved'    => 'Resolved',
            'done'        => 'Done',
        ],
    ],
    'actions' => [
        'mark_done'         => 'Mark Done',
        'update_tiket'      => 'Update Tiket',
        'assign_to_creator' => 'Assign to Creator',
    ],
    'mark_done_dialog' => [
        'title'       => 'Mark as Done',
        'description' => 'This will set status to Done, progress to 100%, and record the completion date.',
        'confirm'     => 'Mark Done',
    ],
    'update_dialog' => [
        'title'       => 'Update Tiket',
        'description' => 'Add an update or reply to this ticket.',
        'confirm'     => 'Save Update',
    ],
    'responses' => [
        'title'  => 'Response History',
        'empty'  => 'No responses yet.',
    ],
];
```
