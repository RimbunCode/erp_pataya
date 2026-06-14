# Tasks

## Task 1: Setup Module Helpdesk — Model & Migration

- [ ] 1.1 Buat migration `create_tickets_table` (ulid PK, code, type, priority, subject, content, status, progress, assign_to_id, created_by_id, branch_id, start_date, due_date, end_date, timestamps, softDeletes)
- [ ] 1.2 Buat migration `create_ticket_responses_table` (ulid PK, ticket_id, user_id, assign_to_id, status, progress, content, end_date, timestamps, softDeletes)
- [ ] 1.3 Buat model `app/Models/Helpdesk/Ticket.php` (DataTable, HasUlids, SoftDeletes, $formComponent, $alias, $translateKey, $keyBreadcrumb, $configColumns, relations: assignTo, createdBy, branch, responses)
- [ ] 1.4 Buat model `app/Models/Helpdesk/TicketResponse.php` (HasUlids, SoftDeletes, relations: ticket, user, assignTo)
- [ ] 1.5 Jalankan `php artisan migrate`

**Files berubah:**

- `database/migrations/..._create_tickets_table.php` (create)
- `database/migrations/..._create_ticket_responses_table.php` (create)
- `app/Models/Helpdesk/Ticket.php` (create)
- `app/Models/Helpdesk/TicketResponse.php` (create)

---

## Task 2: Backend — Request, Service, Controller

- [ ] 2.1 Buat `app/Http/Requests/Helpdesk/TicketRequest.php` (extend BaseFormRequest, validasi semua field Ticket)
- [ ] 2.2 Buat `app/Http/Requests/Helpdesk/TicketResponseRequest.php` (validasi assign_to_id, status, progress, content, end_date)
- [ ] 2.3 Buat `app/Services/Helpdesk/TicketService.php` (method: create, update, markDone, updateTicket) — lihat `WorkOrderService` sebagai referensi
- [ ] 2.4 Buat `app/Http/Controllers/Helpdesk/TicketController.php` (index, store, show, update, destroy, markDone, updateTicket) — inject TicketService, extend Controller
- [ ] 2.5 Tambah route di `routes/web.php`:
  - `Route::resourceDetail('ticket', TicketController::class);`
  - `Route::put('/tickets/{ticket}/markDone', [TicketController::class, 'markDone'])->name('tickets.markDone');`
  - `Route::put('/tickets/{ticket}/updateTicket', [TicketController::class, 'updateTicket'])->name('tickets.updateTicket');`
- [ ] 2.6 Tambah FormatingSeries seed untuk Ticket (jika ada seeder, atau buat manual via tinker)

**Files berubah:**

- `app/Http/Requests/Helpdesk/TicketRequest.php` (create)
- `app/Http/Requests/Helpdesk/TicketResponseRequest.php` (create)
- `app/Services/Helpdesk/TicketService.php` (create)
- `app/Http/Controllers/Helpdesk/TicketController.php` (create)
- `routes/web.php` (modify)

---

## Task 3: i18n — File Translasi

- [ ] 3.1 Buat `lang/en/helpdesk/ticket.php` (semua keys: fields, type options, priority options, status options, actions, dialogs, responses)
- [ ] 3.2 Buat `lang/id/helpdesk/ticket.php` (terjemahan Bahasa Indonesia)

**Files berubah:**

- `lang/en/helpdesk/ticket.php` (create)
- `lang/id/helpdesk/ticket.php` (create)

---

## Task 4: Frontend — Index Page (DataTable2)

- [ ] 4.1 Buat `resources/js/Pages/Helpdesk/Tickets/Index.jsx`
  - Import DataTable2 dari `@/Pages/Core/DataTable2`
  - Kolom: code (link ke show), type (badge), subject, status (BadgeStatus), progress (%), priority, assign_to, start_date, due_date
  - Bulk delete support
- [ ] 4.2 Pastikan controller `index()` mengembalikan `Inertia::render('Helpdesk/Tickets/Index')`

**Files berubah:**

- `resources/js/Pages/Helpdesk/Tickets/Index.jsx` (create)

---

## Task 5: Frontend — Form Component

- [ ] 5.1 Buat `resources/js/Pages/Helpdesk/Tickets/Form.jsx`
  - Gunakan `useFormPage` untuk data, setData, disabled
  - Layout 2 kolom kiri-kanan:
    - Kiri: Type (Select), Priority (Select), Status (Select), Progress (Slider)
    - Kanan: Assign To (UserLinkModel), Start Date (DatetimePicker), Due Date (DatetimePicker), End Date (DatetimePicker)
  - Full width: Subject (FormInput/input), Content (TiptapEditor + image upload)
  - Gunakan `FormPageContent` untuk section grouping
  - Gunakan `FormInput` wrapper untuk setiap field

**Files berubah:**

- `resources/js/Pages/Helpdesk/Tickets/Form.jsx` (create)

---

## Task 6: TiptapEditor — Image Upload Extension

- [ ] 6.1 Modifikasi `resources/js/Components/TiptapEditor.jsx`:
  - Tambah prop `imageUploadUrl` (opsional, jika ada maka enable image upload)
  - Tambah `@tiptap/extension-image` ke extensions array
  - Tambah toolbar button "Insert Image" yang trigger file input `<input type="file" accept="image/*">`
  - WHEN file dipilih: POST multipart ke `imageUploadUrl`, response JSON `{url: "..."}`, lalu insert image ke editor
  - Jika tidak ada `imageUploadUrl`, toolbar image tetap ada tapi insert by URL saja

**Files berubah:**

- `resources/js/Components/TiptapEditor.jsx` (modify)

---

## Task 7: Frontend — Show Page + TicketResponseList

- [ ] 7.1 Buat `resources/js/Pages/Helpdesk/Tickets/Show.jsx`
  - Wrap dengan `FormPage` (name="ticket", disabled saat status=done)
  - Render `<Form />`
  - `controls` callback: tampilkan [Mark Done] dan [Update Ticket] saat status != 'done'
  - State: `markDoneOpen`, `updateTicketOpen`, `loading`
  - Handler `handleMarkDone`: router.put ke `tickets.markDone`
  - Dialog Mark Done: konfirmasi sederhana
  - AlertDialog Update Ticket: form dengan Assign To + tombol "Assign to Creator" (muncul jika user != creator) + Status + Progress + End Date + TiptapEditor(content) + imageUploadUrl

- [ ] 7.2 Buat komponen `TicketResponseList` inline di Show.jsx (atau file terpisah jika kompleks):
  - Render list TicketResponse dari prop `ticket.responses`
  - Setiap item: avatar/nama user, tanggal, badge status, progress bar, content (rendered HTML), assignee
  - Urutkan terbaru di atas

**Files berubah:**

- `resources/js/Pages/Helpdesk/Tickets/Show.jsx` (create)

---

## Task 8: Permission Seeder

- [ ] 8.1 Buat/update permission seeder untuk menambah record:
  - `module` = 'Helpdesk', `name` = 'Ticket', `model` = 'App\Models\Helpdesk\Ticket'
  - `permissions` = `{ "select": true, "create": true, "read": true, "write": true, "delete": true }`
  - `is_submitable` = false
- [ ] 8.2 Jalankan seeder atau insert manual

**Files berubah:**

- Permission seeder file yang ada (modify)

---

## Task 9: Testing

- [ ] 9.1 Buat Feature test `tests/Feature/Helpdesk/TicketTest.php`:
  - Test create ticket (store)
  - Test update ticket
  - Test markDone (status=done, progress=100, end_date set)
  - Test updateTicket (response dibuat, ticket diupdate)
  - Test destroy
  - Test unauthorized access (403)
- [ ] 9.2 Jalankan `php artisan test --compact tests/Feature/Helpdesk/TicketTest.php`
- [ ] 9.3 Jalankan `vendor/bin/pint --dirty --format agent`

**Files berubah:**

- `tests/Feature/Helpdesk/TicketTest.php` (create)
