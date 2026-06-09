# Tasks

## Task 1: Setup Module Helpdesk — Model & Migration

- [ ] 1.1 Buat migration `create_tikets_table` (ulid PK, code, type, priority, subject, content, status, progress, assign_to_id, created_by_id, branch_id, start_date, due_date, end_date, timestamps, softDeletes)
- [ ] 1.2 Buat migration `create_tiket_responses_table` (ulid PK, tiket_id, user_id, assign_to_id, status, progress, content, end_date, timestamps, softDeletes)
- [ ] 1.3 Buat model `app/Models/Helpdesk/Tiket.php` (DataTable, HasUlids, SoftDeletes, $formComponent, $alias, $translateKey, $keyBreadcrumb, $configColumns, relations: assignTo, createdBy, branch, responses)
- [ ] 1.4 Buat model `app/Models/Helpdesk/TiketResponse.php` (HasUlids, SoftDeletes, relations: tiket, user, assignTo)
- [ ] 1.5 Jalankan `php artisan migrate`

**Files berubah:**
- `database/migrations/..._create_tikets_table.php` (create)
- `database/migrations/..._create_tiket_responses_table.php` (create)
- `app/Models/Helpdesk/Tiket.php` (create)
- `app/Models/Helpdesk/TiketResponse.php` (create)

---

## Task 2: Backend — Request, Service, Controller

- [ ] 2.1 Buat `app/Http/Requests/Helpdesk/TiketRequest.php` (extend BaseFormRequest, validasi semua field Tiket)
- [ ] 2.2 Buat `app/Http/Requests/Helpdesk/TiketResponseRequest.php` (validasi assign_to_id, status, progress, content, end_date)
- [ ] 2.3 Buat `app/Services/Helpdesk/TiketService.php` (method: create, update, markDone, updateTiket) — lihat `WorkOrderService` sebagai referensi
- [ ] 2.4 Buat `app/Http/Controllers/Helpdesk/TiketController.php` (index, store, show, update, destroy, markDone, updateTiket) — inject TiketService, extend Controller
- [ ] 2.5 Tambah route di `routes/web.php`:
  - `Route::resourceDetail('tiket', TiketController::class);`
  - `Route::put('/tikets/{tiket}/markDone', [TiketController::class, 'markDone'])->name('tikets.markDone');`
  - `Route::put('/tikets/{tiket}/updateTiket', [TiketController::class, 'updateTiket'])->name('tikets.updateTiket');`
- [ ] 2.6 Tambah FormatingSeries seed untuk Tiket (jika ada seeder, atau buat manual via tinker)

**Files berubah:**
- `app/Http/Requests/Helpdesk/TiketRequest.php` (create)
- `app/Http/Requests/Helpdesk/TiketResponseRequest.php` (create)
- `app/Services/Helpdesk/TiketService.php` (create)
- `app/Http/Controllers/Helpdesk/TiketController.php` (create)
- `routes/web.php` (modify)

---

## Task 3: i18n — File Translasi

- [ ] 3.1 Buat `lang/en/helpdesk/tiket.php` (semua keys: fields, type options, priority options, status options, actions, dialogs, responses)
- [ ] 3.2 Buat `lang/id/helpdesk/tiket.php` (terjemahan Bahasa Indonesia)

**Files berubah:**
- `lang/en/helpdesk/tiket.php` (create)
- `lang/id/helpdesk/tiket.php` (create)

---

## Task 4: Frontend — Index Page (DataTable2)

- [ ] 4.1 Buat `resources/js/Pages/Helpdesk/Tikets/Index.jsx`
  - Import DataTable2 dari `@/Pages/Core/DataTable2`
  - Kolom: code (link ke show), type (badge), subject, status (BadgeStatus), progress (%), priority, assign_to, start_date, due_date
  - Bulk delete support
- [ ] 4.2 Pastikan controller `index()` mengembalikan `Inertia::render('Helpdesk/Tikets/Index')`

**Files berubah:**
- `resources/js/Pages/Helpdesk/Tikets/Index.jsx` (create)

---

## Task 5: Frontend — Form Component

- [ ] 5.1 Buat `resources/js/Pages/Helpdesk/Tikets/Form.jsx`
  - Gunakan `useFormPage` untuk data, setData, disabled
  - Layout 2 kolom kiri-kanan:
    - Kiri: Type (Select), Priority (Select), Status (Select), Progress (Slider)
    - Kanan: Assign To (UserLinkModel), Start Date (DatetimePicker), Due Date (DatetimePicker), End Date (DatetimePicker)
  - Full width: Subject (FormInput/input), Content (TiptapEditor + image upload)
  - Gunakan `FormPageContent` untuk section grouping
  - Gunakan `FormInput` wrapper untuk setiap field

**Files berubah:**
- `resources/js/Pages/Helpdesk/Tikets/Form.jsx` (create)

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

## Task 7: Frontend — Show Page + TiketResponseList

- [ ] 7.1 Buat `resources/js/Pages/Helpdesk/Tikets/Show.jsx`
  - Wrap dengan `FormPage` (name="tiket", disabled saat status=done)
  - Render `<Form />`
  - `controls` callback: tampilkan [Mark Done] dan [Update Tiket] saat status != 'done'
  - State: `markDoneOpen`, `updateTiketOpen`, `loading`
  - Handler `handleMarkDone`: router.put ke `tikets.markDone`
  - Dialog Mark Done: konfirmasi sederhana
  - AlertDialog Update Tiket: form dengan Assign To + tombol "Assign to Creator" (muncul jika user != creator) + Status + Progress + End Date + TiptapEditor(content) + imageUploadUrl

- [ ] 7.2 Buat komponen `TiketResponseList` inline di Show.jsx (atau file terpisah jika kompleks):
  - Render list TiketResponse dari prop `tiket.responses`
  - Setiap item: avatar/nama user, tanggal, badge status, progress bar, content (rendered HTML), assignee
  - Urutkan terbaru di atas

**Files berubah:**
- `resources/js/Pages/Helpdesk/Tikets/Show.jsx` (create)

---

## Task 8: Permission Seeder

- [ ] 8.1 Buat/update permission seeder untuk menambah record:
  - `module` = 'Helpdesk', `name` = 'Tiket', `model` = 'App\Models\Helpdesk\Tiket'
  - `permissions` = `{ "select": true, "create": true, "read": true, "write": true, "delete": true }`
  - `is_submitable` = false
- [ ] 8.2 Jalankan seeder atau insert manual

**Files berubah:**
- Permission seeder file yang ada (modify)

---

## Task 9: Testing

- [ ] 9.1 Buat Feature test `tests/Feature/Helpdesk/TiketTest.php`:
  - Test create tiket (store)
  - Test update tiket
  - Test markDone (status=done, progress=100, end_date set)
  - Test updateTiket (response dibuat, tiket diupdate)
  - Test destroy
  - Test unauthorized access (403)
- [ ] 9.2 Jalankan `php artisan test --compact tests/Feature/Helpdesk/TiketTest.php`
- [ ] 9.3 Jalankan `vendor/bin/pint --dirty --format agent`

**Files berubah:**
- `tests/Feature/Helpdesk/TiketTest.php` (create)
