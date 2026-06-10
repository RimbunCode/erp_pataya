# Design Document: Helpdesk Ticket

## Overview

Modul **Helpdesk** adalah modul baru yang terpisah dari Core, berisi entitas `Ticket` dan `TicketResponse`. Ticket bersifat non-submitable — status dikelola sendiri. Setiap pembaruan disimpan sebagai `TicketResponse` (history). TiptapEditor digunakan untuk field `content` dengan extension upload gambar langsung ke model `File`.

---

## Architecture

```
app/
  Http/Controllers/Helpdesk/
    TicketController.php           ← CRUD + markDone + updateTicket
  Http/Requests/Helpdesk/
    TicketRequest.php              ← validasi store/update
    TicketResponseRequest.php      ← validasi response (markDone & updateTicket)
  Models/Helpdesk/
    Ticket.php                     ← Model utama, DataTable trait
    TicketResponse.php             ← Model history response
  Services/Helpdesk/
    TicketService.php              ← business logic create/update/markDone/updateTicket

database/migrations/
  ..._create_tickets_table.php
  ..._create_ticket_responses_table.php

resources/js/Pages/Helpdesk/Tickets/
  Index.jsx                       ← DataTable2
  Show.jsx                        ← FormPage wrapper + action buttons
  Form.jsx                        ← Field-field ticket
  TicketLinkModel.jsx              ← LinkModel selector (untuk referensi lain)

lang/
  en/helpdesk/ticket.php
  id/helpdesk/ticket.php

routes/web.php                    ← tambah resourceDetail untuk tickets
```

---

## Database Schema

### Tabel `tickets`

| Kolom           | Tipe                   | Keterangan                                    |
| --------------- | ---------------------- | --------------------------------------------- |
| `id`            | ulid, PK               |                                               |
| `code`          | string, unique         | Auto-generate via FormatingSeries             |
| `type`          | string                 | bug_problem / task / question / other         |
| `priority`      | string                 | low / medium / high / critical                |
| `subject`       | string                 | Judul ticket                                  |
| `content`       | longText, nullable     | Rich text (Tiptap JSON/HTML)                  |
| `status`        | string, default=new    | new / in_progress / on_hold / resolved / done |
| `progress`      | tinyInteger, default=0 | 0–100                                         |
| `assign_to_id`  | foreignUlid, nullable  | FK ke users.id                                |
| `created_by_id` | foreignUlid            | FK ke users.id                                |
| `branch_id`     | foreignUlid, nullable  | FK ke branches.id                             |
| `start_date`    | datetime, nullable     | Default = created_at                          |
| `due_date`      | datetime, nullable     | Target selesai                                |
| `end_date`      | datetime, nullable     | Tanggal selesai aktual (diisi saat Mark Done) |
| `timestamps`    |                        |                                               |
| `softDeletes`   |                        |                                               |

### Tabel `ticket_responses`

| Kolom          | Tipe                  | Keterangan                             |
| -------------- | --------------------- | -------------------------------------- |
| `id`           | ulid, PK              |                                        |
| `ticket_id`    | foreignUlid           | FK ke tickets.id                       |
| `user_id`      | foreignUlid           | FK ke users.id (yang membuat response) |
| `assign_to_id` | foreignUlid, nullable | Assignee baru (jika berubah)           |
| `status`       | string                | Status ticket saat response            |
| `progress`     | tinyInteger           | Progress ticket saat response          |
| `content`      | longText, nullable    | Rich text response                     |
| `end_date`     | datetime, nullable    | Diisi saat Mark Done                   |
| `timestamps`   |                       |                                        |
| `softDeletes`  |                       |                                        |

---

## Model Design

### `Ticket` Model

```php
class Ticket extends Model {
    use DataTable, HasUlids, SoftDeletes;

    public static $formComponent = 'Helpdesk/Tickets/Form';
    public static $alias = 'Ticket';
    public $translateKey = 'helpdesk.ticket';
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
    public function responses(): HasMany    // → TicketResponse
}
```

### `TicketResponse` Model

```php
class TicketResponse extends Model {
    use HasUlids, SoftDeletes;

    // Relations
    public function ticket(): BelongsTo   // → Ticket
    public function user(): BelongsTo    // → User
    public function assignTo(): BelongsTo // → User
}
```

---

## Controller Design

### `TicketController`

```php
class TicketController extends Controller {
    public function __construct(Request $request, TicketService $service) {
        $this->service = $service;
        parent::__construct($request, Ticket::class);
    }

    public function index(Request $request)         // → DataTable + Inertia render
    public function store(TicketRequest $request)    // → service->create() + redirect show
    public function show(Ticket $ticket)              // → load responses + Inertia render
    public function update(TicketRequest $request, Ticket $ticket) // → service->update()
    public function destroy(Ticket $ticket)           // → delete + redirect index

    // Custom actions (PUT /tickets/{ticket}/markDone & /tickets/{ticket}/updateTicket)
    public function markDone(Ticket $ticket)                                      // → service->markDone()
    public function updateTicket(TicketResponseRequest $request, Ticket $ticket)    // → service->updateTicket()
}
```

### Custom Routes

```php
Route::resourceDetail('ticket', TicketController::class);
// Tambahan manual:
Route::put('/tickets/{ticket}/markDone', [TicketController::class, 'markDone'])->name('tickets.markDone');
Route::put('/tickets/{ticket}/updateTicket', [TicketController::class, 'updateTicket'])->name('tickets.updateTicket');
```

---

## Service Design

### `TicketService`

```php
class TicketService {
    public function create(array $data): Ticket {
        // FormatingSeries::generate(Ticket::class, $data)
        // $ticket = Ticket::create($data)
        // $ticket->logForCreated()
        // return $ticket
    }

    public function update(Ticket $ticket, array $data): Ticket {
        // $ticket->update($data)
        // $ticket->logForUpdated()
        // return $ticket
    }

    public function markDone(Ticket $ticket): Ticket {
        // $ticket->update(['status'=>'done','progress'=>100,'end_date'=>now()])
        // TicketResponse::create([..., 'status'=>'done', 'progress'=>100, 'end_date'=>now()])
        // $ticket->logForUpdated()
        // return $ticket
    }

    public function updateTicket(Ticket $ticket, array $data): TicketResponse {
        // $ticket->update(['assign_to_id'=>..., 'status'=>..., 'progress'=>...])
        // $response = TicketResponse::create([...])
        // $ticket->logForUpdated()
        // return $response
    }
}
```

---

## Frontend Design

### Layout Form (Show/Form)

```
┌─────────────────────────────────────────────────────┐
│  FormPage (name="ticket", title=subject)             │
│  controls: [Mark Done] [Update Ticket]               │
├──────────────────────┬──────────────────────────────┤
│  Informasi Ticket     │  Assignment & Timeline        │
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
│  [TicketResponseList]                                │
└─────────────────────────────────────────────────────┘
```

### AlertDialog Update Ticket

```
┌─────────────────────────────────────────────────────┐
│  Update Ticket                                       │
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

Tambahkan `Image` extension dari `@tiptap/extension-image` ke `TiptapEditor` dengan custom `addCommands` untuk upload gambar via POST ke `/tickets/{id}/file`. Response URL langsung diinsert ke editor.

---

## i18n Key Structure

```php
// lang/en/helpdesk/ticket.php
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
        'update_ticket'      => 'Update Ticket',
        'assign_to_creator' => 'Assign to Creator',
    ],
    'mark_done_dialog' => [
        'title'       => 'Mark as Done',
        'description' => 'This will set status to Done, progress to 100%, and record the completion date.',
        'confirm'     => 'Mark Done',
    ],
    'update_dialog' => [
        'title'       => 'Update Ticket',
        'description' => 'Add an update or reply to this ticket.',
        'confirm'     => 'Save Update',
    ],
    'responses' => [
        'title'  => 'Response History',
        'empty'  => 'No responses yet.',
    ],
];
```
