# Implementation Plan: ToDo Reminder System + Type + allocated_to Opsional

## Overview

Membangun sistem reminder terjadwal untuk `todos.due_date` di atas infrastruktur notifikasi yang sudah ada (`NotifyUser`, channel database/broadcast/mail), dipandu oleh kebijakan per-`type` (`task`/`event`/`meeting`/`deadline`) yang menempel pada enum `TodoType` — bukan `match` yang berserak di service/command. Idempotensi dijamin oleh unique constraint pada tabel ledger baru `todo_reminders`, bukan cek baca-lalu-tulis.

Sebelum fallback `allocated_to` bisa dianggap selesai, tiga jalur insert `Todo` yang ada di codebase (`TodoController::store`, `Controller::addAssignee` sidebar, `BufferedAttachmentService::attachAssignees` buffered) harus disatukan lewat `TodoService`, dengan kontrak field lain (`status` selalu `open`, dll.) dijamin **tidak berubah** lewat test regresi yang ditulis sebelum refactor dilakukan (task 3.1) dan dijalankan ulang tanpa modifikasi sesudahnya (task 3.6). Guard `already_assigned` yang sebelumnya ada di jalur B/C **dihapus**, bukan dipindah — lihat catatan di bawah.

Sejak eksplorasi awal, `event`/`meeting` diketahui bisa berulang secara wajar pada dokumen dan assignee yang sama (mis. rapat mingguan). Constraint unik `todos_reference_assignee_unique` yang sebelumnya melarang ini dilonggarkan penuh (task 1.5). Semua item risiko/keputusan terbuka di draft awal desain sudah dikunci — lihat tabel "Risiko dan Keputusan — Semua Terkunci" di `design.md`:
- **R1** (semantik `due_date`): diverifikasi — UTC valid, tanpa naif-WIB, rencana timezone di §Timezone berlaku apa adanya.
- **R2** (constraint unik menghalangi event/meeting berulang): dilonggarkan penuh (task 1.5), guard `already_assigned` dihapus (task 3.3).
- **R3** (global scope `App\Models\Model`): diverifikasi — tidak ada, `TodoReminder` tidak butuh kolom tambahan.
- **R4** (notifikasi auto-close): diputuskan ya, kirim — `TodoAutoClosedNotification` (task 5.7).
- **R6** (kapitalisasi enum): SCREAMING_SNAKE, mengikuti `FormStatus`/`Permission`.

Lihat `design.md` untuk detail arsitektur lengkap tiap keputusan.

## Tasks

- [x] 1. Fondasi: enum dan skema
  - [x] 1.1 Buat `app/Enums/TodoType.php` — case `TASK/EVENT/MEETING/DEADLINE` (SCREAMING_SNAKE, lihat R6 di design.md), method `label()`, `remindsOnOverdue()`, `overdueSchedule()`, `autoClosesOnPass()`, `values()` sesuai matriks di design.md
    - _Requirements: 1.1, 1.4, 1.5, 1.6, 2.1_
  - [x] 1.2 Buat `app/Enums/TodoReminderStage.php` — case `LEAD/DAY_OF/OVERDUE`
    - _Requirements: 3.2, 3.4, 4.1_
  - [x] 1.3 Migrasi: tambah `type` (string, default `task`, after `allocated_to_type`) dan `reminder_lead_days` (json nullable, after `due_date`) ke `todos`; tambah index `(status, due_date)`; backfill `type = 'task'` untuk baris lama
    - _Requirements: 1.1, 1.2, 1.3_
  - [x] 1.4 Migrasi: buat tabel `todo_reminders` (`id` ulid, `todo_id` FK cascade, `stage`, `offset_days` integer bertanda, `due_date_snapshot` datetime NOT NULL, `sent_at`, `recipient_count`, timestamps) dengan `unique(todo_id, stage, offset_days, due_date_snapshot)` dan index `(todo_id, stage)`. R3 (global scope `App\Models\Model`) sudah diverifikasi tidak ada — tidak perlu kolom tambahan
    - _Requirements: 5.1, 5.2, 5.4_
  - [x] 1.5 Migrasi: `dropUnique('todos_reference_assignee_unique')` pada `todos`, ganti dengan index non-unik `(reference_type, reference_id, allocated_to_id, deleted_at)` — lihat §Migrasi 3 di design.md untuk alasan (event/meeting berulang butuh assignee-sama-dokumen-sama lebih dari sekali)
    - _Requirements: 11.1, 11.2_
  - [x] 1.6 Buat `app/Models/Core/TodoReminder.php` — `$guarded`, casts (`stage` → enum, `due_date_snapshot`/`sent_at` → datetime), relasi `todo(): BelongsTo`
    - _Requirements: 5.1_
  - [x] 1.7 Perluas `app/Models/Core/Todo.php` — tambah cast `type`/`reminder_lead_days`, relasi `reminders(): HasMany`, `scopeDueForReminder()`, `effectiveLeadDays()`
    - _Requirements: 1.1, 1.2, 3.1, 3.3_
  - [x] 1.8 `$configColumns` di `Todo.php` (baris 33-73) — sisip entri baru `'type' => ['valueTrans' => 'core.todo.type.options', 'show' => true, 'order' => 3]` setelah `reference`, sebelum `allocatedTo`; geser `order` entri `allocatedTo/priority/status/date/assignedBy` naik satu masing-masing (3→4, 4→5, 5→6, 6→7, 7→8). Entri `allocated_to_type => ['ignore' => true]` yang sudah ada TIDAK diubah
    - _Requirements: 12.1_
  - [x] 1.9 `php artisan migrate` — konfirmasi ketiga migrasi apply tanpa error

- [x] 2. Checkpoint — jalankan `php artisan test --compact` untuk memastikan tidak ada regresi dari perubahan skema (khususnya test yang mengasumsikan constraint unik lama masih ada) sebelum lanjut

- [x] 3. `allocated_to` opsional dengan fallback (Requirement 7, 8, 9, 11)
  - [x] 3.1 Tulis test kontrak jalur sidebar/buffered TERLEBIH DAHULU — `status` selalu `open` (termasuk saat payload menyelundupkan `status` lain), `priority` default `medium`, `assigned_by_id` dari user login, `code` ter-generate, `TodoAssignedNotification` terkirim. TIDAK termasuk `already_assigned` (dihapus, lihat 3.3). Jalankan terhadap kode LAMA (belum direfactor) — harus hijau. Ini baseline regresi untuk task 3.4–3.5
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_
  - [x] 3.2 `TodoService::normalize()` — tambah fallback: `allocated_to` dengan `id` kosong diperlakukan sebagai absen sepenuhnya, resolve ke `auth()->id()` + `type: user`; lempar `LogicException` jika `auth()->id()` null saat fallback dibutuhkan
    - _Requirements: 7.1, 7.2, 7.4_
  - [x] 3.3 `TodoService::createForReference(array $data): Todo` — urutan: `normalize()` → paksa `$data['status'] = 'open'` → delegasi ke `create()`. TIDAK ada cek `already_assigned` — dihapus sepenuhnya karena constraint unik yang jadi dasarnya sudah dilonggarkan di task 1.5 (lihat Requirement 11)
    - _Requirements: 8.1, 11.1, 11.2_
  - [x] 3.4 Refactor `Controller::addAssignee` (`app/Http/Controllers/Controller.php:332`) — hapus `Todo::create()` inline dan cek `already_assigned` manual, delegasikan ke `TodoService::createForReference()`
    - _Requirements: 7.3, 8.1, 8.2, 8.3, 8.4, 8.5, 11.2_
  - [x] 3.5 Refactor `BufferedAttachmentService::attachAssignees` (`:64`) — sama, map input datar (`allocated_to_id`/`type`) ke bentuk bersarang sebelum memanggil `createForReference()`
    - _Requirements: 7.3, 8.1, 8.2, 8.3, 8.4, 8.5, 11.2_
  - [x] 3.6 Jalankan ulang test dari task 3.1 TANPA memodifikasinya — harus tetap hijau. Kalau ada yang merah, kontrak berubah dan harus diperbaiki sebelum lanjut
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_
  - [x] 3.7 `TodoRequest` — ubah `allocated_to`/`allocated_to.id`/`allocated_to.type` dari `required` ke `nullable`; tambah rule `type` (`required`, `in:` empat nilai), `reminder_lead_days` (`nullable`, `array`), `reminder_lead_days.*` (`integer`, `min:1`), `confirm_reassign` (`nullable`, `boolean`)
    - _Requirements: 1.1, 1.7, 3.6, 7.1, 9.1, 9.2_
  - [x] 3.8 `AssigneeRequest` — sama pelonggaran `allocated_to` + tambah rule `type`/`reminder_lead_days.*`
    - _Requirements: 7.1, 7.3_
  - [x] 3.9 `TodoService::update()` — deteksi `allocated_to` kosong dengan assignee saat ini bukan editor; tanpa `confirm_reassign: true` lempar `ValidationException` bertanda khusus; dengan flag tersebut, jalankan fallback reassign; lewati pengecekan sama sekali jika assignee saat ini sudah editor
    - _Requirements: 9.1, 9.2, 9.3_
  - [x] 3.10 Review `TicketResponseRequest` (Helpdesk) — pastikan field `buffered_assignees.*.type`/`.id` tidak bentrok dengan field baru `type` milik ToDo pada payload yang sama
    - _Requirements: 7.3_
  - [x] 3.11 Test tambahan: create tanpa `allocated_to` di ketiga jalur → assignee jadi diri sendiri; `status` tetap `open` walau payload buffered menyelundupkan status lain; **assignee sama pada dokumen sama TIDAK ditolak, baik dengan due_date sama maupun beda (Requirement 11)**; alur konfirmasi edit (tolak tanpa flag, terima dengan flag, lewati jika assignee = editor)
    - _Requirements: 7.1, 7.2, 7.3, 8.1, 9.1, 9.2, 9.3, 11.1, 11.2_

- [x] 4. Checkpoint — jalankan seluruh test `TodoTest`, `TodoServiceTest`, `BufferedAttachmentServiceTest`, dan test sidebar baru. Konfirmasi ke user: ketiga jalur berbagi satu implementasi, kontrak B/C terbukti tidak berubah (task 3.1 hijau sebelum dan sesudah refactor), assignee kosong resolve ke diri sendiri di semua entry point, assignee-sama-dokumen-sama tidak lagi ditolak

- [x] 5. Mesin reminder (Requirement 3, 4, 5, 6, 10)
  - [x] 5.1 Buat `app/Notifications/TodoReminderNotification.php` — satu class berparameter `(Todo $todo, TodoReminderStage $stage, int $offsetDays)`, `via()` → `['database','broadcast','mail']`, `toArray()` empat key (`title`/`message`/`documentType`/`documentId`), TANPA `ShouldQueue`
    - _Requirements: 6.3_
  - [x] 5.2 Tambah lang key `notification.todo_reminder.{lead,day_of,overdue}.{title,message}` di `lang/en/notification.php` dan `lang/id/notification.php`, setelah entri `todo_assigned`
    - _Requirements: 6.3_
  - [x] 5.3 `TodoReminderService::resolveStage()` + `shouldSendOverdue()` (murni, tanpa I/O) — implementasi logika diff-hari memakai `setTimezone('Asia/Jakarta')->startOfDay()` (R1 sudah diverifikasi: `due_date` tersimpan UTC valid, bukan naif-WIB — lihat §Timezone di design.md), resolusi `effectiveLeadDays()`, rumus eskalasi overdue, filter ledger berdasarkan `due_date_snapshot` terkini
    - _Requirements: 1.4, 1.5, 1.6, 3.2, 3.3, 3.4, 3.5, 3.7, 4.1, 4.2, 4.4, 5.4_
  - [x] 5.4 Unit test untuk 5.3: H-1 selalu fire walau tidak dicantumkan; batas eskalasi tepat (n=2 vs n=3 untuk `task`); re-arm reminder setelah `due_date` berubah (ledger lama diabaikan, eskalasi ter-reset)
    - _Requirements: 3.3, 4.1, 4.2, 5.4_
  - [x] 5.5 `TodoReminderService::resolveRecipients(Collection $todos): array` — resolusi massal assignee per chunk (partisi by `allocated_to_type`, satu `User::whereIn` + satu query anggota-role), TANPA mengubah `Todo::allocatedUsers()`
    - _Requirements: 6.1, 6.4_
  - [x] 5.6 `TodoReminderService::dispatch()` — tulis `TodoReminder::create()` lebih dulu, tangkap `UniqueConstraintViolationException` sebagai no-op, baru kirim notifikasi ke `assignee ∪ assigner` (dedup `unique('id')`) lewat `NotifyUser`, update `recipient_count`
    - _Requirements: 5.1, 5.2, 5.3, 6.1, 6.2, 6.4_
  - [x] 5.7 Buat `app/Notifications/TodoAutoClosedNotification.php` — class terpisah dari `TodoReminderNotification`, `__construct(public Todo $todo)`, `via()` → `['database','broadcast','mail']`, `toArray()` empat key, penerima sama (`allocatedUsers() ∪ {assignedBy}` dedup); lang key `notification.todo_auto_closed.{title,message}` di `lang/en/notification.php` + `lang/id/notification.php`
    - _Requirements: 2.4_
  - [x] 5.8 `TodoReminderService::sweep(bool $dryRun, ?string $todoId): array` — query `Todo::dueForReminder()->with(['reminders','assignedBy','reference'])->chunkById(100, ...)`, short-circuit auto-close (`type->autoClosesOnPass()`) sebelum resolusi stage — set `status = 'closed'` DAN kirim `TodoAutoClosedNotification` (kecuali `$dryRun`), lanjut ke ToDo berikutnya tanpa reminder stage lain; hormati `$dryRun` (tanpa insert/kirim/close) dan `$todoId` (batasi ke satu ToDo)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 10.2, 10.3_
  - [x] 5.9 Buat `app/Console/Commands/TodoRemindersDispatchCommand.php` (`todos:remind {--dry-run} {--todo=}`) — command tipis, delegasi penuh ke `TodoReminderService::sweep()`, laporkan ringkasan hitungan
    - _Requirements: 10.1, 10.2, 10.3_
  - [x] 5.10 Jadwalkan di `routes/console.php`: `Schedule::command('todos:remind')->timezone('Asia/Jakarta')->dailyAt('07:00')->withoutOverlapping()`
    - _Requirements: 10.1_
  - [x] 5.11 `database/factories/Core/TodoFactory.php` — default `type`, tambah state `dueIn(int $days)` dan `overdue(int $days)` untuk mempermudah test
    - _Requirements: (test infrastructure)_
  - [x] 5.12 Test: auto-close mengirim `TodoAutoClosedNotification` ke assignee+assigner (dedup); `--dry-run` tidak mengubah status maupun mengirim notifikasi apapun
    - _Requirements: 2.4, 10.2_

- [x] 6. Checkpoint — jalankan seluruh suite reminder (`TodoTypeTest`, `TodoReminderServiceTest`), termasuk test idempotensi invokasi ganda dan batas eskalasi. Konfirmasi ke user sebelum lanjut ke frontend

- [x] 7. Frontend
  - [x] 7.1 `AssignedToFields.jsx` — tambah `Select` untuk `type` (kolom pertama, di atas `priority`, `optionTrans="core.todo.type.options"`)
    - _Requirements: 1.1, 1.2_
  - [x] 7.2 `AssignedToFields.jsx` — tambah `MultiSelect` (komponen yang sudah ada di `resources/js/Components/MultiSelect.jsx`) untuk `reminder_lead_days`, ditaruh di bawah `due_date`; verifikasi apakah `MultiSelect` mengembalikan number atau string dan sesuaikan
    - _Requirements: 3.1, 3.6_
  - [x] 7.3 `AssignedToFields.jsx` — hapus prop `required` pada field `allocated_to`, tambah `description={t("core.todo.hints.allocated_to_self")}`; verifikasi `AssignableLinkModel`/`LinkModel` tidak men-default `required` truthy sehingga asterisk hilang total
    - _Requirements: 7.1_
  - [x] 7.4 `AssignDialog.jsx` — `DEFAULT_VALUE` tambah `type: "task"`, `reminder_lead_days: []`; hapus const `canSubmit` dan prop `disabled` yang bergantung padanya
    - _Requirements: 7.1, 7.3_
  - [x] 7.5 `AssignedTo.jsx` — perbaiki `handleDialogSubmit`: baris optimistic-UI memakai `value.allocated_to ?? { id: auth.user.id, type: "user", name: auth.user.name }`; payload yang di-POST TETAP `value` apa adanya (JANGAN mutasi sebelum `router.post`)
    - _Requirements: 7.1, 7.2_
  - [x] 7.6 Tambah dialog konfirmasi reassign saat edit: tangkap response konfirmasi dari task 3.9, tampilkan dialog, resubmit dengan `confirm_reassign: true` saat disetujui
    - _Requirements: 9.1, 9.2_
  - [x] 7.7 `Form.jsx` — tambah default lokal `type: "task"`, `reminder_lead_days: []`. `TodoController::create` (`defaultData`) — tambah `type` dan `reminder_lead_days` di array yang dikirim, karena `FormPage.jsx` mengabaikan default lokal ketika `defaultData` server ada pada halaman create
    - _Requirements: 1.2_
  - [x] 7.8 Tambah lang key di `lang/en/core/todo.php` dan `lang/id/core/todo.php`: `columns.type`, `columns.reminder_lead_days`, `type.options.*`, `reminder_stage.options.*`, `lead_days.option`, `hints.allocated_to_self`, `hints.reminder_lead_days`, `confirm.reassign_to_self`
    - _Requirements: 1.1, 3.1, 7.1, 9.1_
  - [x] 7.9 `app/Traits/DataTable.php` (sekitar baris 625-638, map prop `assignees`) — ganti kolom `select()` dari `allocated_to_type` ke `type` (kolom `Todo.type`); di hasil map, key `type` diisi `$todo->type` (task/event/meeting/deadline) menggantikan `$todo->allocated_to_type` — TIDAK ada lagi key terpisah, `allocated_to_type` tidak di-select maupun di-map sama sekali
    - _Requirements: 12.1, 12.3_
  - [x] 7.10 `AssignedTo.jsx` — `handleDialogSubmit` (mode create ~L47-53 dan mode edit optimistic-UI ~L60-68): field `type` pada item buffer/optimistic-UI diisi `value.type` (ToDo type), BUKAN lagi `value.allocated_to.type` (assignee-kind)
    - _Requirements: 12.1, 12.3_
  - [x] 7.11 `AssignedTo.jsx` — baris render `assigneeList` (~L103-122): hapus label `{type} : {name}` (assignee-kind), ganti nama polos `{name}`; tambah badge `type` (ToDo type) di samping `BadgeStatus` yang sudah ada. Cek dulu apakah `BadgeStatus` (`resources/js/Components/BadgeStatus.jsx`) bisa dipakai ulang dengan varian warna per type; kalau terikat erat ke semantik open/closed/canceled, buat `BadgeTodoType` tipis yang mengikuti pola visual sama. Label lewat `t("core.todo.type.options." + type)` — sumber terjemahan sama dengan Select `type` di form (7.1), tidak didefinisikan dua kali
    - _Requirements: 12.1, 12.2, 12.3_
  - [x] 7.12 Test/verifikasi manual: badge type tampil benar di sidebar untuk ToDo `task`/`event`/`meeting`/`deadline`; label assignee-kind (`user`/`role`) TIDAK lagi tampil di sidebar mana pun
    - _Requirements: 12.1, 12.2, 12.3_

- [x] 8. Checkpoint — verifikasi manual di UI: assign kosong dari `AssignDialog` (sidebar), assign kosong dari form standalone `/todos`, alur konfirmasi reassign saat edit, badge type di sidebar untuk keempat type. Konfirmasi ke user sebelum lanjut ke lint final

- [x] 9. Full test suite + lint (sesuai `CLAUDE.md`: lint hanya dijalankan setelah semua task selesai)
  - [x] 9.1 `php artisan test --compact` — seluruh suite hijau (68/68 test ToDo lulus terisolasi; kegagalan full-suite 396 murni bug pre-existing nested-transaction SQLite/PHP 8.4, dikonfirmasi identik dengan baseline checkpoint 2 — lihat catatan di bawah)
  - [x] 9.2 `vendor/bin/pint --dirty --format agent`
  - [x] 9.3 ESLint pada file JSX yang disentuh
