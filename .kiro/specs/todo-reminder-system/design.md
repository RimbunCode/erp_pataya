# Design Document

## Overview

`todos.due_date` sudah ada sebagai kolom dan sudah tampil di form, tapi tidak ada apapun yang membacanya — ToDo lewat tenggat tidak menghasilkan sinyal apa-apa. Fitur ini menambahkan scheduler harian yang mengirim reminder bertahap (multi-lead H-x, hari-H, overdue eskalasi) lewat infrastruktur notifikasi yang sudah ada (`NotifyUser`, channel database/broadcast/mail).

Sekaligus menutup dua gap terkait:

1. **`allocated_to` wajib diisi** padahal mayoritas ToDo untuk diri sendiri. Field jadi opsional dengan fallback ke `auth()->id()`, konsisten di seluruh entry point.
2. **Tidak ada `type` ToDo** — padahal aturan overdue tidak masuk akal kalau seragam untuk semua ToDo. Tugas berdeadline yang lewat makin mendesak; rapat yang sudah lewat cukup ditutup, tidak perlu diingatkan berulang.

### Temuan eksplorasi yang membentuk desain ini

**Ada TIGA jalur insert `Todo`, bukan satu.** Hanya satu yang lewat `TodoService`:

| Jalur | Entry point | Lewat `TodoService`? |
|---|---|---|
| A | `TodoController::store` → `TodoRequest` | Ya |
| B | `Controller::addAssignee` (`app/Http/Controllers/Controller.php:332`, sidebar "Assigned To") | Tidak — `Todo::create()` inline |
| C | `BufferedAttachmentService::attachAssignees` (`:64`, dipakai saat create dokumen + buffered assignee, termasuk Helpdesk ticket response) | Tidak — `Todo::create()` inline |

B dan C menduplikasi hardcode `'status' => 'open'`, `priority ?? 'medium'`, dan cek `already_assigned` masing-masing. Kalau `allocated_to` dibuat nullable tanpa menyatukan jalur ini lebih dulu: jalur B fatal (`$data['allocated_to']['id']` undefined index), jalur C `continue` diam-diam melewati assignee yang seharusnya di-fallback.

**`AssignedTo.jsx` crash sebelum request terkirim.** `handleDialogSubmit` (`resources/js/Pages/Core/Components/AssignedTo.jsx:69,78`) dereference `value.allocated_to.id`/`.name`/`.type` tanpa guard untuk baris optimistic-UI. Melonggarkan `canSubmit` di `AssignDialog` saja mengubah tombol disabled jadi layar putih.

**Timezone tidak konsisten.** `.env` `APP_TIMEZONE=UTC`, tapi seluruh scheduler di `routes/console.php` dijadwalkan `Asia/Jakarta` (selisih 7 jam). `now()` polos di dalam command mengembalikan UTC sementara command dipicu jam 07:00 WIB — `whereDate('due_date', today())` naif salah-bucket jendela 00:00–07:00 WIB.

**Tidak ada queue worker long-running.** Queue di-drain oleh `Schedule::command('queue:work --stop-when-empty --tries=3 --max-time=50')->everyMinute()`. Reminder harian tidak butuh job antrian tambahan — lihat §5.

**Konvensi enum project bertabrakan — diputuskan SCREAMING_SNAKE.** `CLAUDE.md` mengarahkan TitleCase untuk enum key; enum yang sudah ada (`FormStatus`, `Permission`) memakai SCREAMING_SNAKE. Diputuskan mengikuti konvensi kode nyata (`FormStatus`/`Permission`) demi konsistensi lintas codebase, bukan aturan tertulis yang belum pernah dipraktikkan di enum manapun. Dicatat di sini secara sadar sebagai penyimpangan terdokumentasi dari `CLAUDE.md`.

---

## Architecture

```
Scheduler (Asia/Jakarta, dailyAt 07:00)
        │
        ▼
TodoRemindersDispatchCommand (todos:remind)
        │  delegasi tipis
        ▼
TodoReminderService::sweep()
        │
        ├─ Todo::dueForReminder()->chunkById(100) ──┐
        │                                            │  per chunk:
        │                                            ▼
        │                              resolveRecipients() — bulk, anti-N+1
        │                                            │
        │            ┌───────────────────────────────┤
        │            ▼                                ▼
        │   diff < 0 && autoClosesOnPass()   resolveStage() → Lead|DayOf|Overdue|null
        │   → status = closed, lanjut ToDo               │
        │                                                 ▼
        │                                   dispatch(): TodoReminder::create()
        │                                   (unique constraint = idempotensi)
        │                                                 │
        │                                     berhasil ──┴── UniqueConstraintViolation
        │                                        │                    │
        │                                        ▼                    ▼
        │                          NotifyUser::send() ×N        no-op (sudah terkirim)
        │                          (assignee ∪ assigner)
        ▼
   TodoReminderNotification (1 class, berparameter stage)
   via: database, broadcast (sync) + mail (queued lewat SendNotificationMailJob)
```

`TodoType` enum menempel di model `Todo` lewat cast, dan setiap keputusan bercabang pada type (`remindsOnOverdue`, `overdueSchedule`, `autoClosesOnPass`) dibaca dari method enum — bukan `match` yang berserak di service/command.

`TodoService` menjadi satu-satunya jalur insert `Todo` (jalur A langsung, jalur B/C lewat `createForReference()`), sehingga fallback `allocated_to` dan pemaksaan field lain (`status`) konsisten di semua entry point.

---

## Components and Interfaces

### 1. `App\Enums\TodoType`

Empat case: `Task`, `Event`, `Meeting`, `Deadline`. Default `Task` (nilai backfill baris lama).

**Matriks type × stage:**

| Type | Lead H-x | H-1 paksa | Hari-H | Overdue | Kadensi overdue | Auto-close |
|---|---|---|---|---|---|---|
| `Task` | ya | ya | ya | ya | harian ×3, lalu tiap 7 hari | tidak |
| `Event` | ya | ya | ya | **tidak** | — | **ya** |
| `Meeting` | ya | ya | ya | **tidak** | — | **ya** |
| `Deadline` | ya | ya | ya | ya | harian ×7, lalu tiap 3 hari | tidak |

Justifikasi:
- **`Event`/`Meeting` berbasis momen** — titik waktu yang berlalu, bukan utang yang menumpuk. Rapat jam 14:00 yang sekarang jam 15:00 tidak jadi lebih mendesak; mengingatkan terus adalah noise. Keduanya diberi kebijakan identik, termasuk auto-close — tanpanya, rapat-lampau menumpuk status `open` selamanya.
- **`Deadline` eskalasi lebih agresif** dari `Task` karena cutoff keras berkonsekuensi eksternal.
- **`Task` moderat** dan jadi nilai backfill, supaya baris lama berperilaku paling tidak mengagetkan.

```php
enum TodoType: string {
    case TASK     = 'task';
    case EVENT    = 'event';
    case MEETING  = 'meeting';
    case DEADLINE = 'deadline';

    public function label(): string {
        return __("core.todo.type.options.{$this->value}");
    }

    /** Apakah reminder lanjut setelah due_date lewat. */
    public function remindsOnOverdue(): bool {
        return match ($this) {
            self::TASK, self::DEADLINE => true,
            self::EVENT, self::MEETING => false,
        };
    }

    /**
     * @return array{daily_count: int, interval_days: int}|null
     *   daily_count   — jumlah reminder harian berturut sebelum melebar
     *   interval_days — jarak (hari) setelah daily_count habis
     */
    public function overdueSchedule(): ?array {
        return match ($this) {
            self::TASK     => ['daily_count' => 3, 'interval_days' => 7],
            self::DEADLINE => ['daily_count' => 7, 'interval_days' => 3],
            self::EVENT, self::MEETING => null,
        };
    }

    /** Apakah scheduler menutup ToDo saat due_date lewat. */
    public function autoClosesOnPass(): bool {
        return match ($this) {
            self::EVENT, self::MEETING => true,
            self::TASK, self::DEADLINE => false,
        };
    }

    /** @return array<int, string> — untuk rule `in:` di FormRequest */
    public static function values(): array {
        return array_column(self::cases(), 'value');
    }
}
```

Menambah type baru = tambah satu `case` + lengan di tiap `match`. Tidak ada file lain (command, service) yang perlu disentuh.

### 2. `App\Enums\TodoReminderStage`

```php
enum TodoReminderStage: string {
    case Lead    = 'lead';     // H-x, x dari reminder_lead_days ∪ {1}
    case DayOf   = 'day_of';   // H-0
    case Overdue = 'overdue';  // setelah due_date lewat

    public function label(): string {
        return __("core.todo.reminder_stage.options.{$this->value}");
    }
}
```

### 3. `App\Models\Core\TodoReminder` (ledger idempotensi)

Infrastruktur, bukan dokumen user-facing — tanpa `DataTable`, tanpa `configColumns`, tanpa route.

```php
class TodoReminder extends Model {
    use HasFactory, HasUlids;

    protected $guarded = ['id'];
    protected $casts = [
        'stage'             => TodoReminderStage::class,
        'due_date_snapshot' => 'datetime',
        'sent_at'           => 'datetime',
    ];

    public function todo(): BelongsTo {
        return $this->belongsTo(Todo::class);
    }
}
```

> **Verifikasi implementasi:** `TodoServiceTest::setUp()` menambal `is_example` ke setiap tabel, mengindikasikan `App\Models\Model` (base class project) punya global scope. Kalau benar, `TodoReminder` butuh kolom `is_example` atau harus extend Eloquent `Model` langsung — cek sebelum menulis migrasi (lihat task 1.4 di tasks.md).

### 4. `App\Models\Core\Todo` (perluasan)

```php
protected $casts = [
    'date'               => 'date',
    'due_date'           => 'datetime',
    'type'               => TodoType::class,
    'reminder_lead_days' => 'array',
];

public function reminders(): HasMany {
    return $this->hasMany(TodoReminder::class);
}

/** ToDo yang masih relevan untuk sweep: dated dan masih open. */
public function scopeDueForReminder($query) {
    return $query->whereNotNull('due_date')->where('status', 'open');
}

/**
 * Lead days efektif: set milik user, selalu menyertakan H-1, urut menurun.
 *
 * @return array<int, int>
 */
public function effectiveLeadDays(): array {
    $days = array_map('intval', $this->reminder_lead_days ?? []);
    $days = array_filter($days, fn (int $d) => $d > 0);
    $days[] = 1;                       // H-1 selalu fire
    $days = array_values(array_unique($days));
    rsort($days);

    return $days;
}
```

`effectiveLeadDays()` di model (bukan service) supaya trivial di-unit-test tanpa DB.

**`$configColumns`** (`Todo.php:33-73`, dipakai trait `DataTable` untuk kolom halaman `/todos` index & show — terpisah dari widget sidebar "Assigned To" yang diatur di §Badge `type` di Widget Sidebar). Struktur saat ini sudah mengecualikan `allocated_to_type` secara eksplisit:
```php
'allocated_to_type' => [
    'ignore' => true,
],
```
Entri ini **tidak perlu diubah** — `allocated_to_type` memang sudah tersembunyi dari datatable sejak sebelum fitur ini, konsisten dengan keputusan menyembunyikannya juga dari sidebar (§Badge `type`). Yang perlu ditambah adalah entri baru untuk `type` (kolom `Todo.type`, bukan `allocated_to_type`), disisipkan setelah `reference` (order 2) dan sebelum `allocatedTo` (order 3), mengikuti pola `priority` yang sudah pakai `valueTrans` untuk string enum-like:
```php
'type' => [
    'valueTrans' => 'core.todo.type.options',
    'show'       => true,
    'order'      => 3,
],
```
Entri lain (`allocatedTo` order 3, `priority` order 4, `status` order 5, `date` order 6, `assignedBy` order 7) **semuanya naik satu** untuk memberi ruang — `order` di sini murni urutan tampil, bukan nilai yang dirujuk kode lain, jadi renumbering aman.

### 5. `App\Services\Core\TodoReminderService`

Method publik: `sweep(bool $dryRun, ?string $todoId): array`. Method privat: `resolveRecipients()`, `resolveStage()`, `shouldSendOverdue()`, `dispatch()`.

### 6. `App\Console\Commands\TodoRemindersDispatchCommand`

Command tipis yang mendelegasi ke service — mengikuti pola `HaveTransactionsSyncCommand`, supaya logika bisa dites tanpa `Artisan::call`.

```php
protected $signature = 'todos:remind
    {--dry-run : Log tanpa mengirim atau mencatat}
    {--todo= : Batasi sweep ke satu ToDo (debugging)}';
```

Dijadwalkan di `routes/console.php`:
```php
Schedule::command('todos:remind')->timezone('Asia/Jakarta')->dailyAt('07:00')->withoutOverlapping();
```

### 7. `App\Notifications\TodoReminderNotification`

**Satu class, berparameter stage** — bukan tiga class terpisah. Justifikasi: kontrak `toArray()` di seluruh `app/Notifications/` terikat **empat key persis** (`title`, `message`, `documentType`, `documentId`). Tiga class hanya akan beda di lang key mana yang di-resolve — itu data, bukan behavior. `documentType`/`documentId` identik di semua stage. Frontend notification-center berkunci pada `documentType`; memecah jadi tiga malah memfragmentasi tanpa manfaat.

```php
class TodoReminderNotification extends Notification {
    use Queueable; // BUKAN ShouldQueue — lihat §Notification Dispatch

    public function __construct(
        public Todo $todo,
        public TodoReminderStage $stage,
        public int $offsetDays,
    ) {}

    public function via(object $notifiable): array {
        return ['database', 'broadcast', 'mail'];
    }

    public function toArray(object $notifiable): array {
        return [
            'title'        => $this->title(),
            'message'      => $this->message(),
            'documentType' => Todo::class,
            'documentId'   => $this->todo->id,
        ];
    }

    public function toMail(object $notifiable): MailMessage { /* subject+line dari title()/message() */ }
    public function toBroadcast(object $notifiable): BroadcastMessage { return new BroadcastMessage($this->toArray($notifiable)); }
}
```

---

## Data Models

### Migrasi 1 — `todos` (kolom baru)

```php
$table->string('type')->default(TodoType::TASK->value)->after('allocated_to_type');
$table->json('reminder_lead_days')->nullable()->after('due_date');
$table->index(['status', 'due_date'], 'todos_status_due_date_index');
```
Diikuti backfill `type = 'task'` untuk baris lama.

Keduanya kolom **baru** — aturan "sertakan semua atribut sebelumnya saat modifikasi kolom" tidak berlaku (itu untuk `->change()`). `allocated_to_id` **tetap NOT NULL**; fallback diselesaikan di service sebelum insert, bukan dengan melonggarkan skema.

`reminder_lead_days` tidak pernah di-query (payload baca-saja diolah di PHP), json cukup. Sweep memfilter `status` + `due_date` — karena itu index komposit ditambahkan.

### Migrasi 2 — `todo_reminders` (ledger idempotensi, baru)

```php
$table->ulid('id')->primary();
$table->foreignUlid('todo_id')->constrained('todos')->cascadeOnDelete();
$table->string('stage');
$table->integer('offset_days');            // Lead: +x · DayOf: 0 · Overdue: -n (urutan ke-n)
$table->dateTime('due_date_snapshot');     // NOT NULL — lihat §Perubahan due_date
$table->dateTime('sent_at');
$table->unsignedInteger('recipient_count')->default(0);
$table->timestamps();

$table->unique(['todo_id', 'stage', 'offset_days', 'due_date_snapshot'], 'todo_reminders_unique');
$table->index(['todo_id', 'stage'], 'todo_reminders_todo_stage_index');
```

Keputusan kunci:
- **`offset_days` bertanda adalah diskriminator stage.** Satu unique constraint melayani ketiga stage sekaligus; `count(where stage=overdue)` langsung jadi penggerak eskalasi. H-7 dan H-3 **wajib** jadi baris terpisah.
- **Unique constraint adalah primitif idempotensi, bukan SELECT-lalu-INSERT.** Cek-baca saja rawan balapan antara scheduler dan invokasi manual (`--todo=`).
- **`due_date_snapshot` masuk unique constraint** — lihat §Perubahan due_date di bawah untuk alasannya.
- **Tanpa soft delete.** Baris ledger adalah fakta; menghapusnya diam-diam mempersenjatai ulang reminder.

### Migrasi 3 — longgarkan `todos_reference_assignee_unique`

**Temuan yang mengubah scope:** constraint `unique(reference_type, reference_id, allocated_to_id, deleted_at)` yang sudah ada (dari spec `todo-feature`) melarang lebih dari **satu ToDo aktif** untuk kombinasi `(dokumen, assignee)` yang sama — terlepas dari `due_date`-nya. Ini pre-existing, bukan diperkenalkan fitur ini, tapi baru menjadi masalah nyata sekarang: `event`/`meeting` secara wajar terjadi **berkali-kali** pada dokumen yang sama untuk assignee yang sama (mis. rapat mingguan berulang pada satu Purchase Order). Constraint saat ini menolak ToDo kedua begitu yang pertama sudah ada dan belum di-soft-delete — tanpa peduli auto-close sekalipun.

**Keputusan: longgarkan penuh.** Migrasi baru men-drop `todos_reference_assignee_unique` tanpa index unik pengganti pada kolom yang sama:

```php
Schema::table('todos', function (Blueprint $table) {
    $table->dropUnique('todos_reference_assignee_unique');
    $table->index(['reference_type', 'reference_id', 'allocated_to_id', 'deleted_at'], 'todos_reference_assignee_index');
});
```

Konsekuensi yang diterima secara sadar:
- Assignee yang sama boleh punya banyak ToDo pada dokumen yang sama, tanggal apapun, **tanpa batasan unik sama sekali** — termasuk dua ToDo yang identik persis (`type`, `due_date`, `description` sama). Guard `already_assigned` di `TodoService::createForReference()` (lihat §`allocated_to` Opsional) **tidak lagi berfungsi sebagai penolakan** — ia harus dihapus atau diubah maknanya, sebab constraint yang dijadikan dasarnya sudah tidak ada.
- Index non-unik dipertahankan (bukan dihapus total) karena kolom-kolom ini tetap dipakai untuk query pencarian ToDo per dokumen (`DataTable.php:626-627`, `scopeAssignedToMe`), performa lookup tetap perlu dijaga.
- Ini **menghapus** Requirement 7.5 dari `requirements.md` (penolakan duplikat) — lihat requirement yang direvisi.

---

## Resolusi Stage

Per ToDo per run: **nol atau satu** reminder. Match pertama menang.

1. `$diff > 0` (due_date di masa depan) → kalau `$diff` ada di `effectiveLeadDays()` → stage `Lead`, `offset_days = $diff`. Kalau tidak, lewati.
2. `$diff === 0` (hari ini) → stage `DayOf`, `offset_days = 0`.
3. `$diff < 0` (lewat tenggat) → overdue:
   - Kalau `! $type->remindsOnOverdue()` → tidak ada reminder (auto-close ditangani terpisah, lihat di bawah).
   - `$n` = jumlah baris ledger stage `Overdue` **untuk `due_date_snapshot` yang berlaku saat ini**, `$daysOverdue = abs($diff)`:
     ```
     dueOn = n < daily_count
         ? n + 1
         : daily_count + (n - daily_count + 1) × interval_days
     kirim jika daysOverdue >= dueOn
     ```
   - `offset_days = -(n + 1)`.

**`>=`, bukan `==`, membuat sweep menyembuhkan diri sendiri.** Kalau scheduler mati tiga hari, run berikutnya mengirim satu reminder yang kini jatuh tempo, alih-alih melewatkannya diam-diam. Maksimal satu per run, jadi outage terkejar bertahap, bukan meledak sekaligus.

**Contoh batas eskalasi `Task`** (`daily_count=3, interval_days=7`): n=0→hari 1, n=1→hari 2, n=2→hari 3, n=3→hari **10**, n=4→17. Persis "harian ×3 lalu mingguan".

### Auto-close

Dievaluasi **sebelum** resolusi stage dan menghubung-singkat:

```
jika diff < 0 DAN type.autoClosesOnPass() DAN status === 'open':
    status = 'closed'
    kirim TodoAutoClosedNotification ke assignee ∪ assigner (dedup by id)
    lanjut ke ToDo berikutnya (tidak ada reminder stage lain run ini)
```

`dueForReminder()` memfilter `status = 'open'`, jadi ToDo yang baru ditutup tidak pernah masuk sweep lagi.

**Notifikasi auto-close (keputusan direvisi dari draft awal — v1 tidak lagi senyap).** Assignee dan assigner tetap perlu tahu bahwa sebuah `event`/`meeting` ditutup otomatis, supaya perubahan status tidak mengejutkan saat mereka membuka `/todos` nanti. `app/Notifications/TodoAutoClosedNotification.php` — class terpisah dari `TodoReminderNotification` (bukan reminder, informasi status berbeda konteks), mengikuti kontrak `toArray()` empat-key yang sama. Channel sama: `['database', 'broadcast', 'mail']`, penerima sama: `allocatedUsers() ∪ {assignedBy}` dedup `unique('id')`, dikirim lewat `NotifyUser` seperti notifikasi lain. Lang key: `notification.todo_auto_closed.{title,message}`.

---

## Timezone

Zona `Asia/Jakarta` dihitung eksplisit; `now()` polos tidak pernah dipakai untuk perbandingan due_date:

```php
$tz     = config('app.schedule_timezone', 'Asia/Jakarta');
$today  = CarbonImmutable::now($tz)->startOfDay();
$dueDay = $todo->due_date->copy()->setTimezone($tz)->startOfDay();
$diff   = $today->diffInDays($dueDay, false);   // >0 depan, 0 hari ini, <0 lewat
```

Kedua operand di-snap ke `startOfDay` dalam satu zona → selisih hari bulat eksak, tanpa drift hari-parsial. Asia/Jakarta tanpa DST, jadi tidak ada edge case pergantian jam. TZ diekstrak ke config supaya tidak hardcode di dua tempat (command + test).

> **Prasyarat implementasi (blocking):** semantik penyimpanan `due_date` harus diverifikasi terhadap komponen `DatetimePicker` dan baris DB yang sudah ada sebelum logika diff ditulis. User memilih "5 Agu 17:00" di UI WIB — tersimpan `2026-08-05 17:00` (naif, dianggap WIB) atau `2026-08-05 10:00` (UTC)? Kedua tafsir berbeda satu hari penuh untuk due_date sore.

---

## Perubahan `due_date` Setelah Reminder Terkirim

Kalau H-7 sudah terkirim lalu `due_date` dimundurkan sebulan, ledger yang ada menjadi tidak relevan untuk tanggal baru. Keputusan: **bandingkan `due_date_snapshot`, bukan hapus baris ledger** — audit trail utuh.

Implementasi:
- Resolusi stage **memfilter ledger** ke `due_date_snapshot = $todo->due_date` (nilai due_date saat ini). Baris dengan snapshot lama diabaikan sepenuhnya → stage otomatis terpasang ulang untuk tanggal baru.
- Karena itu, unique constraint **harus** menyertakan `due_date_snapshot` (lihat migrasi 2) — tanpanya, `Lead offset_days=7` untuk tanggal baru akan bentrok dengan baris lama yang masih mereferensikan tanggal lama.
- Hitungan `$n` untuk eskalasi overdue juga difilter snapshot — memundurkan deadline otomatis mereset eskalasi, yang memang perilaku yang benar (ToDo yang tenggatnya baru saja diundur belum "lama" terlambat).

---

## Dispatch — Tulis Dulu, Baru Notifikasi

```php
try {
    $reminder = TodoReminder::create([
        'todo_id' => $todo->id, 'stage' => $stage, 'offset_days' => $offsetDays,
        'due_date_snapshot' => $todo->due_date, 'sent_at' => now(), 'recipient_count' => 0,
    ]);
} catch (UniqueConstraintViolationException) {
    return false;   // sudah terkirim untuk kombinasi (todo, stage, offset, snapshot) ini — no-op idempoten
}

$targets = $recipients->concat($todo->assignedBy ? [$todo->assignedBy] : [])->unique('id');
foreach ($targets as $user) {
    app(NotifyUser::class)->send($user, new TodoReminderNotification($todo, $stage, $offsetDays));
}
$reminder->update(['recipient_count' => $targets->count()]);
```

**Urutan tulis-lalu-notifikasi disengaja.** Kalau notifikasi throw di tengah, baris ledger sudah ada dan run berikutnya tidak membombardir ulang semua penerima. Kehilangan satu reminder lebih murah daripada spam. Menangkap `UniqueConstraintViolationException` inilah yang membuat re-run bersamaan maupun manual (`--todo=`) aman — bukan `SELECT`-lalu-`INSERT` yang rawan balapan.

---

## Notification Dispatch — Inline, Bukan Queued

Sweep memanggil `NotifyUser::send()` langsung di dalam command, tidak dibungkus job. Alasan:

- Tidak ada worker long-running — queue di-drain oleh `queue:work --stop-when-empty` setiap menit. Membungkus sweep dalam job menambah latency hingga ~60 detik tanpa manfaat untuk batch harian.
- `NotifyUser` sudah memisah kecepatan dengan benar: `database`+`broadcast` sinkron (`sendNow()`), `mail` sudah ditunda ke `SendNotificationMailJob`. Bagian lambat (SMTP) tetap antri. Membungkus sweep dalam job lagi berarti antri ganda untuk mail.
- Sweep harian atas ToDo `open` berdurasi adalah ratusan baris, bukan jutaan. Kalau membesar, mitigasinya `chunkById` (sudah bagian desain) — bukan job wrapper.

`TodoReminderNotification` sendiri **tidak** `ShouldQueue`, mengikuti larangan eksplisit di docblock `NotifyUser` — `ShouldQueue` akan menunda semua channel termasuk database/broadcast yang seharusnya sinkron.

---

## Query Sweep — Menghindari N+1

```php
Todo::query()->dueForReminder()->with(['reminders', 'assignedBy', 'reference'])->chunkById(100, ...)
```

`reminders` untuk idempotency check + hitungan overdue. `assignedBy` untuk CC + label dokumen. `reference` untuk `documentLabel()` (`$reference?->code ?? $reference?->name`).

**`allocatedUsers()` adalah N+1 sesungguhnya dan tidak bisa di-eager-load** — ia method yang bercabang pada `allocated_to_type` (`user` vs `role`), bukan relasi Eloquent. `resolveRecipients(Collection $todos): array` privat mengembalikan `[todoId => Collection<User>]`: partisi chunk per type, satu `User::whereIn` + satu query anggota-role per chunk, lalu map ke masing-masing ToDo. **`allocatedUsers()` sendiri tidak diubah** — pemanggil lain (`TodoService::notifyAssignee`, `authorizeOwnTodoOrPermission`) bergantung pada bentuknya.

---

## Penerima Reminder

`allocatedUsers()` ∪ `{assignedBy}`, dedup `->unique('id')`.

**Kontras disengaja dengan `TodoService::notifyAssignee()`**, yang melewati notifikasi ke diri sendiri (`$user->id === $todo->assigned_by_id → continue`) karena assigner tentu tahu dirinya baru saja assign. Untuk reminder, logika ini terbalik: **assigner yang self-assign tetap harus diingatkan** — justru intinya dia lupa. `->unique('id')` menangani kasus assignee === assigner tanpa notifikasi dobel.

`assigned_by_id` bersifat `nullOnDelete`, jadi null guard wajib sebelum menambahkan ke daftar target.

---

## `allocated_to` Opsional — Fallback ke Diri Sendiri

### Normalisasi (`TodoService::normalize()`)

`?? auth()->id()` naif punya lubang: `{'id': 'X', 'type': null}` mempertahankan `X` tapi type jatuh ke `'user'`; `{'id': null, 'type': 'role'}` menyisakan `'role'` dengan id user. Seluruh objek `allocated_to` diperlakukan sebagai absen ketika `id`-nya kosong:

```php
$hasAssignee = filled($data['allocated_to']['id'] ?? null);
// guard: auth()->id() === null → LogicException (cegah insert null ke kolom NOT NULL dari konteks console/seeder)
$data['allocated_to_id']   = $hasAssignee ? $data['allocated_to']['id'] : auth()->id();
$data['allocated_to_type'] = $hasAssignee ? ($data['allocated_to']['type'] ?? 'user') : 'user';
```

Kolom DB **tetap NOT NULL** — fallback selesai sebelum `Todo::create()`, tidak dengan melonggarkan constraint.

### Penyatuan Tiga Jalur — Tanpa Perubahan Kontrak

Ini bagian paling sensitif dari desain: jalur B (`addAssignee`) dan C (`attachAssignees`) **harus berperilaku identik** setelah disatukan ke `TodoService`, bukan sekadar "kebetulan sama".

Perbandingan eksplisit:

| Aspek | B/C sekarang (inline) | `TodoService::create()` | Sama setelah disatukan? |
|---|---|---|---|
| `status` | hardcode `'open'` | dari `$data['status']` | **Tidak — harus dipaksa** |
| `priority` | `?? 'medium'` | dari `$data`, default DB `'medium'` | Ya |
| `assigned_by_id` | user login | `auth()->id()` | Ya |
| `code` | `TodoService::generateCode()` | sama | Ya |
| `notifyAssignee` | dipanggil manual | di dalam `create()` | Ya |
| `already_assigned` | dicek inline, menolak duplikat | **dihapus** — lihat catatan | Perilaku berubah, disengaja |

**`already_assigned` dihapus, bukan dipindah.** Draft awal desain ini memindahkan cek ini ke `TodoService`. Itu berubah setelah ditemukan bahwa constraint `todos_reference_assignee_unique` yang jadi dasarnya dilonggarkan penuh (lihat §Migrasi 3 — longgarkan `todos_reference_assignee_unique`), karena `event`/`meeting` berulang secara wajar butuh assignee-sama-dokumen-sama lebih dari sekali. Mempertahankan guard `already_assigned` di kode tanpa constraint DB di baliknya hanya akan menegakkan aturan yang sudah tidak berlaku secara tidak konsisten. **Keputusan: cek ini dihapus sepenuhnya**, di ketiga jalur maupun di service — duplikat murni (dua ToDo identik persis pada dokumen+assignee yang sama) sekarang diizinkan, konsekuensi yang diterima sadar demi mendukung ToDo berulang.

**Lubang pada `status` yang tetap harus ditutup eksplisit** (independen dari perubahan di atas). `AssigneeRequest` tidak punya rule `status` — sidebar assign memang tidak boleh menentukan status. Kalau `createForReference()` naif memanggil `create($data)`, key `status` absen dan jatuh ke default DB `'open'`. Hasilnya kebetulan benar, tapi **bergantung pada default DB, bukan dijamin kode**. Jalur C menerima array bebas dari `$request->input('buffered_assignees')` — payload yang menyelundupkan `'status' => 'closed'` bisa melahirkan ToDo sidebar berstatus tertutup. Maka:

```php
public function createForReference(array $data): Todo {
    $data = $this->normalize($data);          // allocated_to → id + type, fallback ke auth()->id()
    $data['status'] = 'open';                  // dipaksa eksplisit — jalur reference tidak boleh set status
    return $this->create($data);
}
```

`Controller::addAssignee` dan `BufferedAttachmentService::attachAssignees` didelegasikan ke `createForReference()`. `AssigneeRequest.allocated_to` dilonggarkan `required` → `nullable`, sehingga fallback berlaku di ketiga jalur — bukan cuma `/todos`.

Efek samping yang **diinginkan**: jalur B dan C ikut menerima field `type` dan `reminder_lead_days`. Tanpa itu, ToDo dari sidebar tidak punya type dan reminder-nya tidak pernah jalan.

### Blank Saat Edit — Butuh Konfirmasi

Mengosongkan `allocated_to` saat **edit** (bukan create) mereassign ToDo ke editor — tapi tidak boleh terjadi diam-diam.

Alur tanpa state server (idempoten):
1. `TodoService::update()` mendeteksi `allocated_to` kosong **dan** `allocated_to_id` saat ini bukan editor.
2. Tanpa `confirm_reassign: true` di payload → lempar `ValidationException` bertanda khusus berisi pesan `core.todo.confirm.reassign_to_self`.
3. Frontend menangkap penanda ini, menampilkan dialog konfirmasi eksplisit.
4. User setuju → resubmit dengan `confirm_reassign: true` → fallback jalan.

Kalau assignee saat ini **sudah** editor sendiri, konfirmasi dilewati (tidak ada perubahan berarti). `TodoRequest` menambah rule `'confirm_reassign' => ['nullable', 'boolean']`.

### Frontend

- **`AssignedToFields.jsx`** — `allocated_to`: hapus `required`, tambah `description={t("core.todo.hints.allocated_to_self")}`. `FormInput` sudah merender `description` sebagai teks kecil muted — tidak perlu komponen baru. *Cek*: `FormInput` menghitung `_required = required || firstChild?.props?.required` — pastikan `AssignableLinkModel`/`LinkModel` tidak men-default `required` truthy.
- **`type` Select** — kolom pertama, di atas `priority`, pola identik dengan field `priority` yang sudah ada (`optionTrans="core.todo.type.options"`).
- **`reminder_lead_days`** — pakai `resources/js/Components/MultiSelect.jsx` yang sudah ada (value array, kontrak option sama dengan `Select`). Tidak perlu komponen chip baru. Hint wajib menyatakan H-1 dan hari-H selalu jalan.
- **`AssignDialog.jsx`** — `DEFAULT_VALUE` menambah `type: "task"`, `reminder_lead_days: []`; const `canSubmit` dan prop `disabled`-nya dihapus.
- **`AssignedTo.jsx`** — perbaiki crash: baris optimistic-UI memakai `value.allocated_to ?? { id: auth.user.id, type: "user", name: auth.user.name }`. Payload yang **di-POST** tetap `value` apa adanya (`allocated_to: null` kalau kosong) — server yang meresolusi. Memutasi `value` sebelum POST akan mengubah "assign ke diri sendiri" jadi assignment eksplisit sisi-klien yang membypass server sebagai sumber kebenaran.
- **`TodoController::create` + `Form.jsx`** — `FormPage.jsx` mengabaikan default lokal `useFormPage` ketika `defaultData` server ada di halaman create. `TodoController::create` sudah mengirim `defaultData.allocated_to`; harus ikut mengirim `type` dan `reminder_lead_days`, kalau tidak Select type kosong saat create.

### Badge `type` di Widget Sidebar "Assigned To"

**Permintaan tambahan, dengan revisi.** Dengan ToDo sekarang punya `type`, daftar assignee di sidebar (`AssignedTo.jsx`) menampilkan indikator visual `type` (task/event/meeting/deadline) per baris, **menggantikan** tampilan `allocated_to_type` (`user`/`role`) yang sekarang tidak lagi ditampilkan.

Draft awal desain ini sempat mengira ada tabrakan nama karena `DataTable.php` sudah memakai key `type` untuk `allocated_to_type` (dipakai label `{type} : {name}`, mis. "user : John Doe"). **Tabrakan itu tidak lagi relevan** — keputusan final menghapus tampilan `allocated_to_type` sepenuhnya dari sidebar, jadi key `type` pada payload `assignees` bebas dipakai langsung untuk `Todo.type`, tanpa key sisipan (`todo_type`) apapun.

`DataTable.php:625-638` (map prop `assignees`):
```php
'assignees' => Inertia::defer(
    fn () => Todo::where('reference_type', static::class)
        ->where('reference_id', $this->id)
        ->with('allocatedTo:id,type,name')
        ->get(['id', 'allocated_to_id', 'status', 'type']) // 'allocated_to_type' TIDAK di-select — tidak lagi dipakai di sini
        ->map(fn ($todo) => [
            'id'              => $todo->id,
            'allocated_to_id' => $todo->allocated_to_id,
            'type'            => $todo->type,          // task/event/meeting/deadline — GANTI, bukan allocated_to_type lagi
            'name'            => $todo->allocatedTo?->name,
            'status'          => $todo->status,
        ]),
    'assignees',
),
```

Kolom DB tetap bernama `type` (lihat §Data Models — Migrasi 1), jadi tidak ada mapping nama tambahan di backend maupun frontend.

Frontend, `AssignedTo.jsx`:
- `handleDialogSubmit` (baris ~47-53 mode create, ~60-68 mode edit) — item buffer/optimistic-UI **tidak lagi** menyertakan `type: value.allocated_to.type`; field `type` sekarang diisi `value.type` (ToDo type dari form/dialog), bukan assignee-kind.
- Baris render (`assigneeList`, sekitar baris ~103-122) — label `{type} : {name}` (baris ~120) **dihapus**, diganti nama assignee polos (`{name}`) plus badge `type` (ToDo type) di samping `BadgeStatus` yang sudah ada. Komponen `BadgeStatus` (`resources/js/Components/BadgeStatus.jsx`) sudah menangani pola badge status-berwarna di codebase ini — cek dulu apakah bisa dipakai ulang untuk `type` (varian warna berbeda per type) sebelum membuat komponen baru. Kalau `BadgeStatus` terikat erat pada semantik `status` (open/closed/canceled), buat varian tipis `BadgeTodoType` yang mengikuti pola visual yang sama (ukuran, radius, kontras warna) alih-alih styling ad-hoc.
- Label badge lewat `t("core.todo.type.options." + type)`, key yang sama dengan Select `type` di form (§9.4 Frontend), sehingga terjemahan tidak dobel-didefinisikan.

---

## Error Handling

- **Insert `TodoReminder` gagal karena unique violation** → ditangkap, treated sebagai no-op idempoten, bukan error.
- **`auth()->id() === null` saat fallback dibutuhkan** (console/seeder tanpa user login) → `LogicException` eksplisit, bukan insert null ke kolom NOT NULL yang menghasilkan error DB opaque.
- **Blank `allocated_to` saat edit tanpa konfirmasi** → `ValidationException` dengan pesan spesifik yang bisa dibedakan frontend dari error validasi biasa.
- **Notifikasi gagal terkirim di tengah loop penerima** → baris ledger sudah tertulis (tulis-dulu-baru-notifikasi), jadi run berikutnya tidak mengulang dari awal untuk ToDo yang sama.

---

## Testing Strategy

Lihat `tasks.md` untuk daftar test per task. Ringkasan cakupan:

- **Unit murni** (`TodoTypeTest`) — matriks kebijakan enum terkunci lewat data provider, tanpa DB.
- **Feature inti** (`TodoReminderServiceTest`) — resolusi stage, idempotensi (termasuk concurrent-insert), batas eskalasi per type, auto-close, penerima, perubahan due_date, performa anti-N+1.
- **Regresi kontrak** (`TodoTest`, `BufferedAttachmentServiceTest`, test sidebar baru) — membuktikan penyatuan tiga jalur insert **tidak mengubah** perilaku B/C: `status` selalu `open` (termasuk saat disusupi payload), `priority` default `medium`, `code`/`assigned_by_id`/notifikasi/`already_assigned` tetap seperti semula. Test ini ditulis **sebelum** refactor, dijalankan terhadap kode lama sampai hijau (baseline), lalu dijalankan ulang tanpa diubah setelah refactor — kalau merah, kontrak berubah.

`Notification::fake()` + `Queue::fake()` + `CarbonImmutable::setTestNow()` dengan instance Asia/Jakarta eksplisit di semua test waktu. Helper `travel()` yang mengasumsikan timezone app dihindari.

---

## Risiko dan Keputusan — Semua Terkunci

Ketujuh item berikut sempat berstatus terbuka selama perancangan; seluruhnya sudah diverifikasi atau diputuskan bersama user dan tidak lagi dianggap ambiguitas desain.

| # | Risiko/Keputusan | Resolusi final |
|---|---|---|
| R1 | Semantik penyimpanan `due_date` (UTC vs naif-WIB) | **Diverifikasi — aman tanpa perubahan rencana.** `DatetimePicker.jsx` bekerja di jam lokal browser lalu mengirim objek `Date` JS; serialisasi Inertia (`JSON.stringify` → `Date.toJSON()`) selalu menghasilkan ISO 8601 UTC. Tidak ada override `serializeDate`/timezone Carbon di provider manapun. Cast `datetime` Laravel + `APP_TIMEZONE=UTC` menyimpan nilai UTC yang valid — bukan string naif. Logika diff di §Timezone (`setTimezone('Asia/Jakarta')->startOfDay()`) sudah benar apa adanya. |
| R2 | `todos_reference_assignee_unique` menghalangi event/meeting berulang pada assignee+dokumen yang sama | **Diputuskan: longgarkan penuh.** Lihat §Migrasi 3. Unique constraint di-drop, diganti index non-unik. Guard `already_assigned` dihapus dari kode (bukan dipindah) karena dasarnya sudah tidak ada — lihat §Penyatuan Tiga Jalur. Duplikat murni sekarang diizinkan, konsekuensi yang diterima sadar. |
| R3 | `App\Models\Model` punya global scope (`is_example`)? | **Diverifikasi — tidak ada.** `app/Models/Model.php` cuma extend `EloquentModel` + trait `LinkModel`, tanpa `booted()`/global scope apapun. Komentar di `TodoServiceTest` merujuk kolom yang ditambahkan lewat seeder/`initPermissions` di prod, bukan dari base class. `TodoReminder` tidak butuh kolom tambahan. |
| R4 | Notifikasi saat auto-close — perlu tidak? | **Diputuskan: ya, kirim notifikasi.** `TodoAutoClosedNotification` terpisah dari `TodoReminderNotification`, channel dan penerima sama. Lihat §Auto-close. |
| R5 | Volume mail vs `--max-time=50` pada ToDo ber-role besar | **Diputuskan: diterima apa adanya, tanpa batas.** `recipient_count` di ledger membuatnya teramati; pembatas eksplisit (`max_recipients`) ditunda sampai benar-benar jadi masalah. |
| R6 | Kapitalisasi enum key | **Diputuskan: SCREAMING_SNAKE** (`TASK`/`EVENT`/`MEETING`/`DEADLINE`), mengikuti konvensi kode nyata (`FormStatus`, `Permission`) — penyimpangan sadar dari anjuran TitleCase di `CLAUDE.md`. |
| R7 | `--dry-run`/`--todo` adalah penambahan scope kecil di luar permintaan awal | **Diputuskan: dipertahankan.** Tanpa ini, verifikasi perilaku sweep di produksi tidak mungkin dilakukan tanpa efek samping nyata (notifikasi asli terkirim). |
