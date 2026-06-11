# Tasks

> Sumber detail langkah (kode, perintah, expected output) ada di plan superpower: `docs/superpowers/plans/2026-06-11-formpagedialog-sidebar.md`. Tasks ini adalah ringkasan checklist Kiro-compatible.
>
> Urutan: Backend (Task 1–2, ada test otomatis & fondasi payload) → Frontend (Task 3–6, verifikasi manual) → Wrap-up (Task 7).

## Task 1: BufferedAttachmentService — attach tags

- [x] 1.1 Tulis test gagal `test_attaches_existing_and_new_buffered_tags` (model `Unit`, shim `is_example`, `RefreshDatabase`)
- [x] 1.2 Jalankan, pastikan gagal (`class not found`)
- [x] 1.3 Buat `BufferedAttachmentService::attach` + `attachTags` (resolve/`Tag::firstOrCreate` → `Taggable::firstOrCreate`)
- [x] 1.4 Jalankan test, pastikan lulus
- [x] 1.5 Commit

**Files berubah:**

- `app/Services/Core/BufferedAttachmentService.php` (create)
- `tests/Feature/Core/BufferedAttachmentServiceTest.php` (create)

_Requirements: 5.1, 5.3, 6.1_

---

## Task 2: BufferedAttachmentService — attach files + DataTable hook

- [x] 2.1 Tulis test gagal `test_attaches_buffered_files` + `test_no_buffer_produces_no_side_effects` (`UploadedFile::fake`, `Storage::fake`)
- [x] 2.2 Jalankan, pastikan gagal (`fileables` kosong)
- [x] 2.3 Tambah `attachFiles` ke service (`File::uploadFile` + `Fileable::firstOrCreate`), update `attach()`
- [x] 2.4 Jalankan test files+no-buffer, pastikan lulus
- [x] 2.5 Pasang hook `static::created` di `bootDataTable()` (guard `app()->bound('request')` + `hasAny`/`hasFile`)
- [x] 2.6 Tulis test `test_datatable_hook_auto_attaches_on_create` + `test_factory_create_without_request_buffer_is_safe`
- [x] 2.7 Jalankan seluruh file test (5 test), pastikan lulus
- [x] 2.8 Commit

**Files berubah:**

- `app/Services/Core/BufferedAttachmentService.php` (modify)
- `app/Traits/DataTable.php` (modify, dalam `bootDataTable`)
- `tests/Feature/Core/BufferedAttachmentServiceTest.php` (modify)

_Requirements: 5.2, 5.3, 5.4, 5.5, 6.2, 6.3, 6.4, 6.5_

---

## Task 3: Tags — dual-mode (create buffer)

- [ ] 3.1 Import `useFormPage`; ambil `{ isCreate, data, setData }` + `bufferedTags`
- [ ] 3.2 Pilih sumber tags by mode (`isCreate ? bufferedTags : _tags`)
- [ ] 3.3 Cabangkan `addTag`/`removeTag` (create mutasi `data.buffered_tags`; edit tetap `router`)
- [ ] 3.4 `npm run build`, pastikan sukses
- [ ] 3.5 Commit

**Files berubah:**

- `resources/js/Pages/Core/Components/Tags.jsx` (modify)

_Requirements: 3.1, 3.2, 3.4, 3.5_

---

## Task 4: Attachments + UploadDialog — dual-mode (create buffer)

- [ ] 4.1 `Attachments`: import `useFormPage`; sumber `attachments` by mode (`data.files` saat create)
- [ ] 4.2 `Attachments`: cabangkan `removeFile` (create = filter buffer)
- [ ] 4.3 `UploadDialog`: tambah prop `onBuffer`; di `onAttach` push ke buffer alih-alih `router.post`
- [ ] 4.4 `Attachments`: pasang `onBuffer` ke `UploadDialog` saat create
- [ ] 4.5 `npm run build`, pastikan sukses
- [ ] 4.6 Commit

**Files berubah:**

- `resources/js/Pages/Core/Components/Attachments.jsx` (modify)
- `resources/js/Pages/Core/Components/UploadDialog.jsx` (modify)

_Requirements: 3.1, 3.3, 3.4_

---

## Task 5: SidebarChildren — verifikasi aman di create

- [ ] 5.1 Tinjau `SidebarChildren` (`FormPage.jsx:1474-1581`): default content (`Attachments`+`Tags`) tidak bergantung `defaultData`; blok `amended_from`/`hasConnections` ber-guard truthy. **Tidak ada perubahan kode** — verifikasi saja.

**Files berubah:** — (tidak ada)

_Requirements: 2.4_

---

## Task 6: FormPageDialog — sidebar collapsible + kirim buffer

- [ ] 6.1 Tambah prop `sidebarContent = false`, state `sidebarOpen`, `hasSidebar`; import `SidebarProvider`, `Sidebar`, `PanelRightIcon`
- [ ] 6.2 Lebarkan `AlertDialogContent` (`max-w-3xl`) + grid kondisional `[1fr_18rem]`⇄`[1fr_0rem]` dgn transition
- [ ] 6.3 Render kolom kanan: `SidebarProvider` + `Sidebar collapsible="none"` + `SidebarChildren` (`submitable=false`, `defaultData=null`, `hasConnections=false`)
- [ ] 6.4 Tombol toggle `PanelRightIcon` di `AlertDialogTitle`
- [ ] 6.5 `_onSubmit`: `form.transform()` membentuk payload `{...data, files:[File], isPublic:[], name:[]}`, `forceFormData` bila ada file
- [ ] 6.6 `npm run build`, pastikan sukses
- [ ] 6.7 Commit

**Files berubah:**

- `resources/js/Pages/Core/FormPage.jsx` (modify, `FormPageDialog`)

_Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 4.1, 4.2, 4.3_

---

## Task 7: Verifikasi end-to-end + full suite (CHECKPOINT)

- [ ] 7.1 Pasang sementara `sidebarContent={undefined}` di satu call-site dialog existing (mis. `Users/ManageUsers/Show.jsx:126`) untuk smoke test (jangan commit)
- [ ] 7.2 Minta user `npm run dev`: cek sidebar tampil/melebar, toggle animasi, tag buffer (tanpa network), file buffer (tanpa upload langsung), submit → record + `taggables`/`fileables` ter-attach
- [ ] 7.3 Revert call-site smoke test
- [ ] 7.4 Full backend suite `php artisan test --compact`
- [ ] 7.5 `vendor/bin/pint --dirty --format agent`
- [ ] 7.6 Commit akhir bila ada perubahan format

**Files berubah:** — (verifikasi; format saja)

_Requirements: semua (validasi)_

---

## Catatan

- Edit-mode `FormPage` (Attachments/Tags instant-persist) **tidak boleh berubah perilakunya** — semua cabang baru di belakang `isCreate`.
- Lint/Pint hanya di akhir (Task 7), bukan per-task.
- **Test shim:** model `File` (`use TreeView`) butuh kolom `user_id`/`parent_id`/`lft`/`rgt`/`depth` yang di prod ditambah via command init (bukan migration). Test `setUp` men-shim kolom ini pada tabel `files` agar `File::create` jalan di SQLite — sama pola seperti shim `is_example`.
