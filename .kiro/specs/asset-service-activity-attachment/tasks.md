# Implementation Plan: Attachment pada Log Aktivitas AssetService

## Overview

Tambah relasi `files()` di `AssetServiceActivity`, 2 route+method baru (`addActivityFile`/`removeActivityFile`) untuk attach/hapus immediate di mode edit, plus `BufferedAttachmentService::attach()` di `storeActivity` untuk mode create (buffer). Frontend: `ActivityFormDialog` dapat widget lampiran ala `Attachments.jsx` (create=buffer lokal, edit=langsung ke server), `ServiceActivityLog` dapat indikator jumlah lampiran per baris. Tidak ada migration baru (pivot `fileables`/`files` sudah generic).

## Tasks

- [x] 1. Backend — model & relasi
  - [x] 1.1 Tambah method `files()` (morphToMany ke `File` lewat `fileable`, filter `whereNull('fileables.deleted_at')`) di `app/Models/Asset/AssetServiceActivity.php`
    - _Requirements: 4.1_
  - [x] 1.2 Tambah `'activities.files'` ke array `loadRelationsOnShow()` di `app/Models/Asset/AssetService.php` (sejajar `'activities.pic'`)
    - _Requirements: 4.1_

- [x] 2. Backend — route & controller
  - [x] 2.1 Tambah 2 route baru di `routes/web.php` (persis di bawah `assetServices.activities.update`): `POST assetServices/activities/{activity}/file` → `addActivityFile`, `DELETE assetServices/activities/{activity}/file/{file}` → `removeActivityFile`
    - _Requirements: 2.1, 3.1_
  - [x] 2.2 Tambah method `addActivityFile(Request $request, AssetServiceActivity $activity)` di `AssetServiceController` — gate `assertApproved($activity->assetService)`, lalu `File::uploadFile($request, 'AssetServiceActivity', fn($file) => Fileable::firstOrCreate([...]))`
    - _Requirements: 2.1, 2.2, 2.4_
  - [x] 2.3 Tambah method `removeActivityFile(Request $request, AssetServiceActivity $activity, File $file)` — gate `assertApproved`, lalu `Fileable::where(...)->delete()` (soft-delete)
    - _Requirements: 3.1, 3.2, 3.4_
  - [x] 2.4 Ubah `storeActivity()` — tambah `BufferedAttachmentService::attach($activity, $request)` setelah `create()`. `updateActivity()` TIDAK diubah (lampiran activity existing lewat 2.2/2.3, bukan lewat update ini)
    - _Requirements: 1.2, 1.3, 1.4_
  - [x] 2.5 Write feature test `tests/Feature/Asset/AssetServiceActivityAttachmentTest.php`
    - **Test: attach saat create** — `storeActivity` dengan `filesId` → assert `Fileable` row `fileable_type=AssetServiceActivity::class`, `fileable_id` = id activity baru (bukan id AssetService)
    - **Test: create tanpa file** — `storeActivity` tanpa `filesId`/`files` → tidak ada `Fileable` baru, tidak ada exception
    - **Test: addActivityFile** — pada activity milik AssetService approved → `Fileable` baru dengan target activity yang benar
    - **Test: gating belum approved** — `addActivityFile`/`removeActivityFile` pada AssetService belum approved → exception (`asset/service.activity_requires_approval`)
    - **Test: removeActivityFile** — `Fileable` row ter-soft-delete, file lain pada activity yang sama tidak ikut terhapus
    - **Validates: Requirements 1.2, 1.3, 1.4, 2.2, 2.4, 3.1, 3.2, 3.4**

- [x] 3. Checkpoint — pastikan backend test hijau
  - Jalankan `php artisan test --compact tests/Feature/Asset/AssetServiceActivityAttachmentTest.php` dan test existing yang overlap (`AssetServiceActivityGatingTest.php`, `AssetServiceServiceTest.php`) — pastikan tidak ada regresi.
  - Hasil: 5 test baru pass (12 assertions) + 9 test existing pass (15 assertions), 0 regresi.

- [x] 4. Frontend — ActivityFormDialog (widget lampiran)
  - [x] 4.1 Tambah state `files` ke `form` (`useState`), turunan `isEdit = !!activity?.id`, dan `attachments = isEdit ? (activity?.files ?? []) : (form.files ?? [])`
    - _Requirements: 1.1, 2.3_
  - [x] 4.2 Pasang `UploadDialog` dengan cabang `isEdit` (create: `onBuffer` isi `form.files`; edit: `onBuffer=null` + `options.route = route('assetServices.activities.addFile', activity.id)`)
    - _Requirements: 1.1, 2.1_
  - [x] 4.3 Tambah `removeAttachment(fileId)` — create: filter `form.files` lokal; edit: `router.delete(route('assetServices.activities.removeFile', [activity.id, fileId]))`
    - _Requirements: 1.5, 3.1, 3.2_
  - [x] 4.4 Render daftar lampiran (ikon file + nama + link `files.preview` + tombol X), style mengikuti pola `Attachments.jsx`, dipasang di bawah field `is_done` sebelum footer
    - _Requirements: 1.1, 2.3_
  - [x] 4.5 Ubah `submit()` — tambah `filesId: form.files.map(f => f.id).filter(Boolean)` ke payload HANYA saat `!isEdit`
    - _Requirements: 1.2_

- [x] 5. Frontend — indikator lampiran di daftar Activity
  - [x] 5.1 Di `ServiceActivityLog` (list activity), tambah ikon+jumlah lampiran per baris kalau `activity.files?.length > 0`
    - _Requirements: 4.2, 4.3_

- [x] 6. Frontend — test
  - [x] 6.1 Update/tambah case di `resources/js/Pages/Asset/Services/ServiceActivityLog.rtl.test.jsx`
    - **Test: mode create buffer** — pilih file (mock `onBuffer`), assert `filesId` masuk payload `router.post` saat Simpan
    - **Test: mode edit immediate add** — assert `UploadDialog` menerima `options.route` mengarah ke `assetServices.activities.addFile` dengan id activity yang benar
    - **Test: mode edit immediate remove** — klik X pada file existing, assert `router.delete` dipanggil ke `assetServices.activities.removeFile` dengan id activity+file yang benar
    - **Test: indikator list** — activity dengan `files.length > 0` menampilkan indikator, activity tanpa file tidak
    - **Validates: Requirements 1.1, 1.5, 2.1, 2.3, 3.1, 4.2, 4.3**

- [x] 7. Checkpoint — pastikan frontend test hijau
  - Jalankan `npx vitest run resources/js/Pages/Asset/Services` — pastikan semua pass, termasuk `Form.rtl.test.jsx`/`Show.rtl.test.jsx` existing (tidak regresi).
  - Hasil: 6 file test, 69 test pass, 0 regresi.

- [x] 8. Pengujian visual manual (browser)
  - [x] 8.1 `npm run build` (BUKAN `npm run dev`)
    - ✅ Buka AssetService approved (DRAFT/0001) → buka activity existing → attach file via UploadDialog (simulasi file select) → Fileable tercipta dengan fileable_type=AssetServiceActivity, fileable_id=activity.id (diverifikasi query DB langsung).
    - ✅ Lampiran muncul di dialog SETELAH ditunggu (Inertia back() reload) — TANPA reload manual/tutup dialog.
    - ✅ Hapus lampiran (klik X) → hilang seketika dari dialog DAN dari indikator list, tanpa perlu Simpan.
    - ✅ Indikator jumlah lampiran ("📎 1") muncul di baris Log Aktivitas, hilang lagi setelah dihapus.
    - Skip: kasus AssetService belum approved — sudah dicover PHPUnit (`test_add_and_remove_activity_file_rejected_when_service_not_approved`), tidak direproduksi ulang di browser (butuh setup data tambahan, low marginal value).
    - Catatan environment: `php artisan serve` butuh flag `--no-reload` di sini (lihat memory reference), port default 8000 kena masalah lain (proses orphan) jadi dipakai port 9234 + APP_URL disesuaikan sementara untuk sesi testing ini.

- [x] 9. Final checkpoint — pastikan semua test (BE+FE) hijau, tidak ada regresi
  - Jalankan ulang test dari task 3 dan 7 sekali lagi setelah semua perubahan selesai. Baru setelah ini jalankan `vendor/bin/pint --dirty --format agent` (bukan sebelumnya).
  - Hasil: BE 14 pass (27 assertions), FE 69 pass, Pint pass, ESLint pass. Spec SELESAI.

## Notes

- Tidak ada migration baru — `fileables`/`files` sudah generic.
- `updateActivity()` (field action_date/pic/description/is_done) sengaja TIDAK disentuh untuk urusan file — attach/hapus lampiran activity existing lewat endpoint sendiri (2.2/2.3), independen dari tombol Simpan field lain.
- Batas ukuran/jumlah file: default `File::uploadFile()`, tidak ada validasi tambahan (keputusan user).
- Pint/lint HANYA dijalankan di task 9, setelah semua task lain selesai.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1", "2.2", "2.3", "2.4"] },
    { "id": 2, "tasks": ["2.5"] },
    { "id": 3, "tasks": ["3"] },
    { "id": 4, "tasks": ["4.1", "4.2", "4.3", "4.4", "4.5", "5.1"] },
    { "id": 5, "tasks": ["6.1"] },
    { "id": 6, "tasks": ["7"] },
    { "id": 7, "tasks": ["8.1"] },
    { "id": 8, "tasks": ["9"] }
  ]
}
```
