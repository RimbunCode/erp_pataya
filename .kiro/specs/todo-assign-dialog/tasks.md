# Implementation Plan: Dialog Assign untuk Widget "Assigned To"

## Overview

Ganti alur inline-picker widget sidebar `AssignedTo.jsx` dengan dialog modal (`AssignDialog.jsx`) berisi field ToDo lengkap (assignee, priority, date, due_date, description — tanpa status). Reuse field lewat ekstraksi `AssignedToFields.jsx` dari `Todos/Form.jsx`. Backend: `Controller::addAssignee` diganti dari `firstOrCreate` jadi cek-`exists()`-lalu-`create()` eksplisit (tolak assign ganda ke assignee yang sudah punya `Todo` row, status apapun, belum soft-deleted). Sidebar tampilkan semua status dengan indikator visual; tombol hapus hanya untuk status `open`. `TodoController::create()` default-kan assignee ke user login.

## Tasks

- [x] 1. Backend — persiapan field dan validasi
  - [x] 1.1 Tambah rule `date`/`due_date` (nullable, date) ke `app/Http/Requests/Core/AssigneeRequest.php`
    - _Requirements: 1.1_
  - [x] 1.2 Tambah key lang `core.todo.errors.already_assigned` di `lang/en/core/todo.php` dan `lang/id/core/todo.php`
    - _Requirements: 9.2_

- [ ] 2. Checkpoint - `php artisan test --compact tests/Feature/Core/AssignedToSidebarTest.php` masih pass (belum ada perubahan logic, hanya validasi rule baru)

- [x] 3. Backend — ganti `firstOrCreate` jadi cek-`exists()`-lalu-`create()` di `Controller::addAssignee`
  - [x] 3.1 Ubah `app/Http/Controllers/Controller.php::addAssignee` sesuai §6 design.md — guard `Todo::where(...)->exists()` (tanpa `withTrashed()`), lempar `ValidationException` kalau sudah ada, baru `Todo::create()` dengan `date`/`due_date` ditambahkan ke payload
    - Hapus pembungkus `if ($todo->wasRecentlyCreated)` (tidak perlu lagi — `create()` baru selalu baru)
    - _Requirements: 9.2, 9.3, 9.4_
  - [x] 3.2 Update `tests/Feature/Core/AssignedToSidebarTest.php`:
    - Rename `test_assigning_duplicate_user_is_idempotent`/`test_assigning_duplicate_role_is_idempotent` jadi `test_assigning_duplicate_active_*_is_rejected` (perilaku POST kedua berubah dari no-op-sukses jadi ditolak, bukan lagi "idempotent")
    - Tambah `test_assigning_to_closed_assignee_is_still_rejected` — assert perilaku sama untuk status `closed`
    - Tambah `test_assigning_to_previously_removed_assignee_creates_new_row` — assignee yang `Todo`-nya sudah soft-deleted, assign ulang berhasil bikin row baru
    - Tambah `test_assign_stores_date_and_due_date` + `test_assign_rejects_due_date_before_date`
    - _Requirements: 9.2, 9.3, 9.4_

- [ ] 4. Checkpoint - `php artisan test --compact tests/Feature/Core/AssignedToSidebarTest.php` pass semua (termasuk test baru task 3.2)

- [x] 5. Backend — `showDetail()` tampilkan semua status + `allocated_to_id`
  - [x] 5.1 Ubah `app/Traits/DataTable.php::showDetail()` sesuai §8 design.md — hapus `->where('status', 'open')`, tambah `'status'` dan `'allocated_to_id'` ke payload `map()`
    - _Requirements: 5.1, 5.2, 9.1_
  - [x] 5.2 Tambah `test_show_detail_assignees_include_all_statuses_with_allocated_to_id` di `AssignedToSidebarTest.php` — resolve `Inertia::getShared('assignees')()` langsung (tidak ada preseden test HTTP untuk deferred prop di codebase ini), assert row status `open` DAN `closed` sama-sama muncul, assert field `allocated_to_id` ada di payload
    - _Requirements: 5.1_

- [ ] 6. Checkpoint - test terkait `showDetail()`/assignees pass

- [x] 7. Backend — `BufferedAttachmentService::attachAssignees` terima field baru
  - [x] 7.1 Ubah `app/Services/Core/BufferedAttachmentService.php::attachAssignees` — tambah `priority`/`date`/`due_date`/`description` dari item buffer ke `values` `firstOrCreate`; baca `allocated_to_id` dengan fallback ke `id` (shape lama) supaya tidak breaking test existing (§7 design.md)
    - _Requirements: 2.3_
  - [x] 7.2 Tambah `test_attaches_buffered_assignees_with_priority_date_due_date_description` di `BufferedAttachmentServiceTest.php` (shape baru `allocated_to_id`) — assert `priority`/`date`/`due_date`/`description` ikut tersimpan dari buffer; test lama (shape `id`) dibiarkan sebagai regresi guard fallback
    - _Requirements: 2.3_

- [ ] 8. Checkpoint - `php artisan test --compact tests/Feature/Core/BufferedAttachmentServiceTest.php` pass

- [x] 9. Backend — default assignee saat create ToDo standalone
  - [x] 9.1 Ubah `app/Http/Controllers/Core/TodoController.php::create()` sesuai §9 design.md — kirim prop `defaultData.allocated_to` berisi user login
    - _Requirements: 8.1, 8.2, 8.3_
  - [x] 9.2 Tambah `test_create_page_defaults_assignee_to_logged_in_user` di `tests/Feature/Core/TodoTest.php` — `assertInertia` cek `defaultData.allocated_to.id`/`type`
    - _Requirements: 8.1_

- [ ] 10. Checkpoint - `php artisan test --compact tests/Feature/Core/TodoTest.php` pass

- [x] 11. Frontend — ekstraksi `AssignedToFields.jsx`
  - [x] 11.1 Buat `resources/js/Pages/Core/Todos/AssignedToFields.jsx` — field assignee/priority/status/date/due_date/description, props `value`/`onChange`/`layout`/`excludeAssigneeIds`/`disableStatus` (§1 design.md, REVISI: status ikut diekstrak, bukan dikecualikan — lihat Requirement 3 revisi)
    - _Requirements: 7.1_
  - [x] 11.2 Refactor `resources/js/Pages/Core/Todos/Form.jsx` — pakai `<AssignedToFields value={data} onChange={setData} layout="grid" />` (tanpa `disableStatus`, default `false`) (§2 design.md)
    - _Requirements: 7.2, 7.4_
  - [x] 11.3 Verifikasi `AssignableLinkModel.jsx` sudah meneruskan prop tambahan lewat `{...props}` — konfirmasi: SUDAH ADA, tidak perlu perubahan, `filters` otomatis tembus ke `LinkModel`
    - _Requirements: 9.1_
  - [x] 11.4 `npm run build` sukses tanpa error

- [x] 12. Checkpoint - `npm run build` sukses (dikonfirmasi Task 11.4, ulang di Task 14/15) — manual smoke test halaman `/todos/create`/`/todos/{id}` digabung ke Task 16

- [x] 13. Frontend — `AssignDialog.jsx` baru
  - [x] 13.1 Buat `resources/js/Pages/Core/Components/AssignDialog.jsx` sesuai §3 design.md — state lokal, `AssignedToFields layout="stack" disableStatus`, prop `excludeAssigneeIds`
    - Tambah key lang `core.form.assign` (en/id)
    - _Requirements: 1.1, 1.2, 1.3, 1.6, 1.7, 3.1, 9.1_

- [x] 14. Checkpoint - `npm run build` sukses tanpa error

- [x] 15. Frontend — wiring `AssignedTo.jsx`
  - [x] 15.1 Tulis ulang `resources/js/Pages/Core/Components/AssignedTo.jsx` sesuai §4 design.md:
    - State `showPicker`/`pickerValue` diganti `dialogState`
    - Tombol `+` buka `AssignDialog` mode tambah baru (`setDialogState({})`)
    - Klik assignee row: `isCreate` → buka `AssignDialog` mode edit buffer (`setDialogState(item)`); else → `router.visit(route("todos.show", id))`
    - `activeAssigneeIds` dihitung dari `assignees.map((a) => a.allocated_to_id)`, dioper ke `AssignDialog`
    - `handleDialogSubmit` cabang `isCreate`: `bufferedAssignees.map(...)` kalau edit (match by `id`), `[...bufferedAssignees, {...}]` kalau baru — item baru sertakan `allocated_to_id` eksplisit dari `value.allocated_to.id`
    - `handleDialogSubmit` cabang edit-mode: `router.post` ke `addAssignee` dengan payload penuh dari dialog (`allocated_to`, `priority`, `date`, `due_date`, `description`)
    - Render row: tombol X hanya untuk `status !== "closed" && status !== "canceled"` (`canRemove`)
    - `<BadgeStatus status={status ?? "open"} />` ditambahkan tiap row, dibungkus `<button>` yang men-trigger `handleRowClick`
    - `ClickAwayListener` dihapus (dulu untuk `showPicker` custom) — shadcn `Dialog`/Radix sudah otomatis handle klik-di-luar
    - `npm run build` sukses
    - _Requirements: 1.4, 1.5, 2.1, 2.2, 4.1, 4.2, 4.3, 5.2, 5.3, 6.1, 6.2, 6.3_

- [x] 16. Checkpoint - verifikasi otomatis (SELESAI) + manual smoke test browser (TIDAK DIKERJAKAN, lihat catatan)
  - [x] `vendor/bin/pint --dirty --format agent` → `{"result":"pass"}`
  - [x] `npm run build` sukses (dijalankan berulang sepanjang task 11-15, konsisten sukses)
  - [x] Full test suite ToDo (`TodoTest`, `TodoServiceTest`, `TodoVisibilityScopeTest`, `AssignableViewTest`, `AssignedToSidebarTest`, `BufferedAttachmentServiceTest`) → 40/40 pass, 90 assertions
  - **TIDAK DIKERJAKAN — perlu verifikasi manual oleh user**: smoke test interaktif di browser (buka dialog, assign, klik row, cek badge status, cek picker exclude assignee aktif, cek default assignee `/todos/create`). Tidak ada tool kontrol browser (Playwright/Puppeteer) yang tersedia untuk sesi ini — hanya `laravel-boost browser-logs` (baca console log, bukan kontrol interaksi). Herd sudah serve project di `https://erp.test` (dikonfirmasi via `mcp__herd__get_site_information`, HTTP 302 saat dicek `curl`), siap untuk pengujian manual oleh user kapan saja.

- [x] 17. Update `.kiro/specs/todo-assign-dialog/tasks.md` — semua task ditandai `[x]` sesuai progres aktual
