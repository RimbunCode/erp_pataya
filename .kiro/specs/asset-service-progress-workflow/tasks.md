# Implementation Plan: asset-service-progress-workflow

## Overview

Implementasi mengikuti urutan dependency dari `design.md`: enum+migration dulu, lalu model (sync mechanism inti), service layer, controller+routes, audit 5 consumer `FormStatus::APPROVED` (independen, bisa kapan saja setelah model layer selesai), lang keys, baru FE. Setiap task menyertakan test yang relevan dari section Testing Strategy `design.md` — tidak ada task test terpisah di akhir.

## Tasks

- [x] 1. Enum + Migrations
  - [x] 1.1 `app/Enums/FormStatus.php` — tambah `NEED_CONFIRMATION`, `WAITING_PARTS`
    - _Requirements: 1.1, 4.4_
  - [x] 1.2 Migration `add_start_date_to_asset_services_table`
    - _Requirements: 5.4_
  - [x] 1.3 Migration `replace_is_done_with_status_on_asset_service_activities_table` — tambah `status` nullable, drop `is_done`
    - _Requirements: 6.1, 6.3_

- [x] 2. Checkpoint — migration jalan (`php artisan migrate`), tidak ada error

- [x] 3. Model layer
  - [x] 3.1 `AssetService.php` — cast `start_date`, method `hasPassedApproval()`, redefinisi `isFullyChecked()` (baca `status` langsung), relasi `activities()` `orderBy('action_date')->orderBy('id')`
    - _Requirements: 5.5(cast), 6.4, 6.8, 8.6_
  - [x] 3.2 `AssetServiceActivity.php` — cast `status` (`FormStatusCast`), hapus cast `is_done`, `booted()` `static::saved()` recompute sync (requery `action_date DESC, id DESC`)
    - _Requirements: 6.2, 9.1_
    - **Bug ketemu & difix**: `orderBy()` Laravel ADD bukan REPLACE — `orderByDesc()` tanpa `reorder()` numpuk di atas default ASC relasi `activities()`, hasilnya kebalik. Fix: `reorder('action_date', 'desc')`. Pola sama juga di-terapkan preventif ke desain AC10 validator (task 7.1) dan `complete()` (task 5.4) di `design.md`.
  - [x] 3.3 Unit test `hasPassedApproval()` — semua kombinasi status
    - **Validates: Requirement 8.1-8.6**
  - [x] 3.4 Unit test `booted()` sync — kasus backdate INTI (activity A hari ini, lalu activity B kemarin disimpan setelahnya → status tetap ikut A; edit A ke besok → status ikut A lagi; tie-break `id`)
    - **Validates: Requirement 9.1, Correctness Property 1**

- [x] 4. Checkpoint — test model layer pass (14 test, 32 assertion, hijau)

- [x] 5. Service layer: `AssetServiceService.php`
  - [x] 5.1 `onApproved()` (2 titik: `submit()` cabang maintenance_task + `onApproved()` sendiri) — `FormStatus::APPROVED` → `FormStatus::NEED_CONFIRMATION`
    - _Requirements: 1.2_
  - [x] 5.2 `startWork()` + `hasStockAvailable()` (pakai `Stock.ready_quantity`, filter `is_stock_item`+`branch_id`)
    - _Requirements: 5.1, 5.2, 5.3, 9.3_
  - [x] 5.3 `markWaitingPartsForConsumedItems()`
    - _Requirements: 4.3, 4.4_
  - [x] 5.4 `complete()` — `completion_date` dari `action_date` activity `COMPLETED` (bukan `now()`)
    - _Requirements: 9.5_
  - [x] 5.5 Feature test `startWork()` — stok cukup 1 item → sukses (`start_date` terisi, activity `IN_PROGRESS` dibuat, status ikut); stok nihil → `LogicException`, no-op
    - **Validates: Requirement 5.1-5.4, 9.3, Correctness Property 3**
    - Bug ketemu & difix: `isFullyChecked()` baca `$this->status` in-memory (stale kalau sync terjadi via instance beda — aman di production krn 2 HTTP request terpisah, test butuh `->fresh()` eksplisit). `Stock::boot()` butuh `stock_queue` diisi.
  - [x] 5.6 Feature test `markWaitingPartsForConsumedItems()` — `NEED_CONFIRMATION` → `WAITING_PARTS`; status lain (mis. `IN_PROGRESS`) → tidak berubah
    - **Validates: Requirement 4.3, Correctness Property 5**
  - [x] 5.7 Feature test `complete()` — ditolak kalau `isFullyChecked()` false; sukses → `completion_date` SAMA DENGAN `action_date` activity (bukan waktu request)
    - **Validates: Requirement 9.5, 6.4, 7.3**

- [x] 6. Checkpoint — test service layer pass (15 test, 34 assertion, hijau)

- [-] 7. Request + Controller + Routes
  - [x] 7.1 `AssetServiceActivityRequest.php` — rule `status` (`Rule::in` 5 nilai), `withValidator()` AC8 (batas bawah `action_date`) + AC10 (batas atas khusus `completed`)
    - _Requirements: 6.2, 9.8, 9.10_
  - [x] 7.2 `AssetServiceController.php` — `assertApproved()` delegasi `hasPassedApproval()`, `storeActivity()` tambah guard lock `COMPLETED` (AC9), `startWork()` endpoint baru, `show()` tambah `has_available_stock`+`has_passed_approval`, `stockAvailability()` endpoint baru, `enforcePermission()` tambah `startWork`
    - _Requirements: 5.1, 8.1, 9.9, 2.4_
  - [x] 7.3 `routes/web.php` — route `assetServices.startWork`, `assetServices.stockAvailability`
    - _Requirements: 5.2, 2.4_
  - [x] 7.4 Feature test `AssetServiceActivityRequest` — `action_date` sebelum activity pertama ditolak (AC8); `status=completed` dengan `action_date` <= activity terbesar ditolak (AC10)
    - **Validates: Requirement 9.8, 9.10**
  - [x] 7.5 Feature test `storeActivity` ditolak saat `AssetService.status` sudah `COMPLETED`
    - **Validates: Requirement 9.9**
  - [x] 7.6 Feature test `stockAvailability()` — item non-stock TIDAK muncul, `ready_quantity` dikembalikan (bukan `quantity`), difilter `branch_id`
    - **Validates: Requirement 2.4**
    - Bug ketemu & difix: `assertApproved()` lupa diganti (cuma tercatat di rencana, gak kena edit aktual) — masih literal `FormStatus::APPROVED`, bikin test `NEED_CONFIRMATION` gagal. `enforcePermission()` butuh `'stockAvailability' => 'read'` eksplisit (403 kalau diserahkan ke default parent).

- [x] 8. Checkpoint — test controller/request layer pass (6 test, 15 assertion, hijau)

- [-] 9. Audit consumer `FormStatus::APPROVED` (Requirement 8) — 4 titik lain, independen dari FE
  - [x] 9.1 `app/Http/Requests/Sales/SalesOrderRequest.php:124,136` — ganti `hasPassedApproval()`
    - _Requirements: 8.2_
  - [x] 9.2 `app/Http/Requests/Sales/InternalOrderRequest.php:136,148` — ganti `hasPassedApproval()`
    - _Requirements: 8.3_
  - [x] 9.3 Regression test — pastikan test existing `SalesOrderRequest`/`InternalOrderRequest` (spec `asset-service-billing`/`asset-service-internal-order`) TETAP hijau pasca refactor
    - **Validates: Requirement 8.2, 8.3 (regression)**
    - Bug ketemu & difix (di luar 2 file consumer): `AssetServiceActivityAttachmentTest.php` 2 titik POST ke `activities.store` belum kasih `status` (sekarang wajib) — `firstOrFail()` gagal krn activity gak pernah tercipta (validasi gagal duluan).
  - [x] 9.4 Cari & update test existing yang assert `$assetService->status` mengandung `FormStatus::APPROVED` pasca `onApproved()` (kemungkinan ada di `AssetServiceServiceTest.php`) — ganti assert jadi `NEED_CONFIRMATION`
    - **Validates: Requirement 1.2 (regression)**
    - Ketemu 1 lagi di luar `AssetServiceServiceTest.php`: `AssetMaintenanceServiceTest.php` (`create_task_generates_first_asset_service_auto_approved`).

- [x] 10. Checkpoint — full backend test suite pass (jalan di background, `--parallel` krn suite serial OOM 128MB — lihat memory project)
  - Bug ketemu & difix (BUKAN bug spec ini, tapi nge-block full-suite checkpoint): `tests/Feature/Core/DashboardWidgetWidthMigrationTest.php` hardcode `--step` rollback count yang harus dihitung ulang tiap ada migration baru (sesuai komentar di file itu sendiri) — 2 migration baru spec ini (`add_start_date_to_asset_services_table`, `replace_is_done_with_status_on_asset_service_activities_table`) bikin count basi. Sempat salah hitung anchor (pakai migration width KEDUA, bukan pertama) sebelum ketemu angka benar `--step 17`. `tests/Feature/Asset` yang tadinya kelihatan "hang" di `--parallel` ternyata cuma lambat progresif (bukan hang) — re-run bersih: 143 test, 316 assertion, OK.

- [x] 11. Lang keys
  - [x] 11.1 `lang/id/asset/service.php` + `lang/en/asset/service.php` — `start_date`, `activity.status` (ganti `is_done`), `no_stock_available`, `activity_locked_after_completed`, `action_date_before_first`, `completed_action_date_must_be_latest` (`completion_date` sudah ada duluan)
    - _Requirements: 5.5, 9.7_
  - [x] 11.2 `lang/id/status.php` + `lang/en/status.php` — tambah key `need_confirmation`, `waiting_parts`
    - _Requirements: 1.1, 4.4_

- [x] 12. FE: `ActivityFormDialog` (dalam `ServiceActivityLog.jsx`)
  - [x] 12.1 Export `ActivityFormDialog` (named export) — dipakai `ConfirmWorkflowDialog.jsx`
    - _Requirements: (struktur file, Open Design Question §1 design.md)_
  - [x] 12.2 Hapus Checkbox `is_done`, ganti `Select` 5 opsi `status`; prefill `action_date`=`now()` (create); prefill `status` dari activity ber-`action_date` terbesar KECUALI prop `prefillStatus` di-pass (Hold=`on_hold`, Complete=`completed`)
    - _Requirements: 6.2, 6.5, 6.6, 3.1, 7.2_
  - [x] 12.3 Prop `onSavedCallback` opsional — dipanggil setelah submit sukses (dipakai tombol Complete → panggil `assetServices.complete`)
    - _Requirements: 7.3_
  - [x] 12.4 Update `ServiceActivityLog.rtl.test.jsx` (20 test, semua hijau) — mock `DatetimePicker` di-fix (Date object crash), `Select` distub native `<select>` pola `Form.rtl.test.jsx`

- [x] 13. FE: `ServiceActivityLog.jsx` (komponen utama)
  - [x] 13.1 Hapus `allDone`/`toggleDone`/`CompleteConfirmDialog`
    - _Requirements: 6.1 (konsekuensi drop is_done)_
  - [x] 13.2 Tombol "Complete" — kondisi baru (`activities.at(-1)`, tampil kecuali `completed`/kosong), buka `ActivityFormDialog` `prefillStatus="completed"` + `onSavedCallback`
    - _Requirements: 7.1, 7.2, 7.3_
  - [x] 13.3 Render badge `status` per activity (ganti Checkbox `is_done` di list)
    - _Requirements: 6.2_

- [x] 14. FE: Komponen baru — `ConfirmWorkflowDialog.jsx`
  - [x] 14.1 4 opsi: Hold (`ActivityFormDialog` `prefillStatus="on_hold"`), Create PR/PO (`<Link>` existing), Mulai Pekerjaan (`router.post` `startWork`, disembunyikan `!has_available_stock`)
    - _Requirements: 2.2, 3.1, 4.1, 5.1_

- [x]* 15. FE: Komponen baru — `StockAvailabilityCard.jsx`
  - [x]* 15.1 Render tabel item×gudang dari `GET assetServices/{id}/stockAvailability`
    - _Requirements: 2.3, 2.4_

- [x] 16. FE: `Show.jsx` + `Form.jsx` + helper
  - [x] 16.1 `resources/js/Pages/Asset/Services/statusUtils.js` (baru) — `hasPassedApproval(status)`
    - _Requirements: 8.4, 8.5_
    - Bug ketemu & difix (di KEDUA sisi PHP+JS): `hasPassedApproval([])` (status kosong) balikin `true` (vacuous truth via `array_intersect`/`.some()` di array kosong) — harusnya `false`. Ketauan dari test existing `Form.rtl.test.jsx` (`status: []`).
  - [x] 16.2 `Show.jsx` — tombol "Confirm" (buka `ConfirmWorkflowDialog`), render `start_date`/`completion_date` conditional, ganti `isApproved` literal → `hasPassedApproval`
    - _Requirements: 2.1, 5.5, 9.7, 8.4_
    - Bug ketemu & difix: `controls()` awalnya manggil `canGlobal()` unconditional (regresi dari short-circuit original `!canRequestPurchase` → return null duluan) — ketauan dari test existing `Show.rtl.test.jsx` yang assert `canGlobalMock` tidak dipanggil.
  - [x] 16.3 `Form.jsx` — ganti `isApproved` literal → `hasPassedApproval(data?.status)`, tambah field `start_date`/`completion_date` conditional (pakai `Input readOnly`, bukan `DatetimePicker` — konsisten pola `assetMaintenanceTask` field di file yang sama)
    - _Requirements: 8.5, 5.5, 9.7_

- [x] 17. Checkpoint — FE unit/rtl test + backend full suite
  - BE: Unit 588 test, Feature (Sales/Purchase/Inventory/Finances/Core/Asset) semua OK — total termasuk fix task 10 di atas.
  - FE: `npm run test -- --run` — 408 test file passed (408), 4934 test passed (4934), 0 gagal.

- [x] 18. Final checkpoint — full test suite (BE+FE) + pengujian visual (browser)
  - Visual (browser, production build via `npm run build` + `php artisan serve --no-reload` port 8011): halaman Show AssetService — badge "Perlu Konfirmasi" + tombol "Confirm" tampil (Req 2 AC1); `ConfirmWorkflowDialog` 4 opsi render benar, "Mulai Pekerjaan" tersembunyi krn `has_available_stock=false` (Req 5 AC2); "Lihat Stok" nested dialog tampil empty-state benar; "Tahan (Hold)" buka `ActivityFormDialog` dgn prefill `action_date=now()` + `status=on_hold` (Req 3, 6.6); Log Aktivitas + tombol "Tandai Servis Selesai"/"Tambah Aktivitas" render. Data test (`asset_services` 1 row) di-set sementara ke `need_confirmation` via tinker lalu dikembalikan ke `approved` setelah selesai — tidak mengubah data dev permanen.

## Notes

- **Req 9 AC6 SENGAJA di luar scope** (keputusan user eksplisit "diabaikan sementara") — jangan buat task untuk menutup gap `isFullyChecked()` bisa di-bypass dialog biasa.
- Task 15 ditandai optional (`*`) — `StockAvailabilityCard` secara teknis bisa di-defer (cuma tombol "lihat stok" di dalam `ConfirmWorkflowDialog`) tanpa memblok requirement lain; `has_available_stock` (gate tombol "Mulai pekerjaan") tidak bergantung padanya.
- Pint/ESLint HANYA dijalankan setelah SEMUA task selesai, sesuai `CLAUDE.md`.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["3.1", "3.2", "3.3", "3.4"] },
    { "id": 2, "tasks": ["5.1", "5.2", "5.3", "5.4", "5.5", "5.6", "5.7"] },
    { "id": 3, "tasks": ["7.1", "7.2", "7.3", "7.4", "7.5", "7.6"] },
    { "id": 4, "tasks": ["9.1", "9.2", "9.3", "9.4", "11.1", "11.2"] },
    { "id": 5, "tasks": ["12.1", "12.2", "12.3"] },
    { "id": 6, "tasks": ["13.1", "13.2", "13.3", "14.1", "15.1", "16.1", "16.2", "16.3"] },
    { "id": 7, "tasks": ["18"] }
  ]
}
```
