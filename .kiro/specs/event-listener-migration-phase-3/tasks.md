# Implementation Plan: Event/Listener Migration — Phase 3

## Overview

Implementasi berjalan dalam 8 grup: perbaikan race condition (independen, dikerjakan duluan), kolom `transaction_date` (independen), fondasi `GlPostingStatus` (model+tabel+enum, prasyarat grup GL), halaman monitoring, lalu 3 grup migrasi GL per-service (`PurchaseReceipt`/`DeliveryNote`/`PurchaseInvoice`) yang masing-masing memakai fondasi grup sebelumnya. Semua listener GL di grup migrasi WAJIB `ShouldQueue` — satu-satunya kategori listener async di seluruh codebase. Setiap grup diakhiri checkpoint test regresi.

## Tasks

- [ ] 1. Perbaikan race condition — lockForUpdate() (Requirement 1)
  - [ ] 1.1 Lock `PurchaseOrderItem` saat baca `billed_quantity` di `PurchaseReceiptService::onApproved()`
    - `app/Services/Purchase/PurchaseReceiptService.php` — verifikasi ulang baris persis (baseline audit: ~230), ganti akses `$poItem` supaya di-query dengan `lockForUpdate()` sebelum percabangan ALUR-1/ALUR-2
    - _Requirements: 1.1_

  - [ ] 1.2 Lock `PurchaseInvoiceItem` di `findInvoiceItemsForPoItem()`
    - `app/Services/Purchase/PurchaseReceiptService.php` (baseline: method di baris ~414-426) — tambah `lockForUpdate()` pada query yang dipakai kalkulasi `$availableQty` (ALUR-2)
    - _Requirements: 1.2_

  - [ ] 1.3 Lock `returnAgainstItem` (PurchaseReceiptItem) di jalur retur PurchaseReceipt
    - `app/Services/Purchase/PurchaseReceiptService.php` (baseline: ~206) — query ulang `$item->returnAgainstItem` dengan `lockForUpdate()` sebelum `increment('returned_quantity', ...)`, karena nilai lama dibaca in-memory (bukan atomic increment murni)
    - _Requirements: 1.3_

  - [ ] 1.4 Lock `StockLedgerEntry` pending di `PurchaseInvoiceService::updatePendingSLEs()`
    - `app/Services/Finances/PurchaseInvoiceService.php` (baseline: ~399-406) — tambah `lockForUpdate()` pada query SLE pending yang di-split/dikonsumsi FIFO
    - Verifikasi method ini selalu dipanggil di dalam transaksi aktif caller (`onApproved()`) — tidak membuka transaksi baru sendiri
    - _Requirements: 1.4, 1.8_

  - [ ] 1.5 Lock `$debitAccount`/`$creditAccount` di blok GL Expense/Credit `PurchaseInvoiceService`
    - `app/Services/Finances/PurchaseInvoiceService.php` (baseline: ~330-344) — tambah `lockForUpdate()`, konsisten dengan blok GL Stock/SRNB yang sudah terkunci
    - _Requirements: 1.5_

  - [ ] 1.6 Lock `$returnAgainst` (PurchaseInvoice asal) di jalur retur PurchaseInvoice
    - `app/Services/Finances/PurchaseInvoiceService.php` (baseline: ~354-373) — query ulang `$returnAgainst` dengan `lockForUpdate()` sebelum kalkulasi status retur
    - _Requirements: 1.6_

  - [ ] 1.7 Lock `returnAgainstItem` (DeliveryNoteItem) di jalur retur non-rental DeliveryNote
    - `app/Services/Inventory/DeliveryNoteService.php` (baseline: ~272-274) — query ulang `$item->returnAgainstItem` dengan `lockForUpdate()` sebelum baca-modifikasi-tulis `returned_quantity`
    - _Requirements: 1.7_

  - [ ] 1.8 Write test concurrency untuk titik lock baru (Property 6)
    - **Test: 2 approval paralel PurchaseReceipt terhadap PurchaseOrderItem sama** — assert `billed_quantity`/`received_quantity` akhir konsisten (bukan lost-update), assert `lockForUpdate()` dipanggil
    - **Test: 2 approval paralel PurchaseInvoice terhadap PurchaseInvoiceItem/StockLedgerEntry sama** — assert `allocated_qty` dan SLE split konsisten
    - **Validates: Requirements 1.1-1.7**

- [ ] 2. Checkpoint - Pastikan Task 1 tidak regresi
  - Jalankan `PurchaseDualFlowTest`, `SalesDualFlowTest`, test approval PurchaseReceipt/PurchaseInvoice/DeliveryNote existing, test dari Task 1.8. Pastikan hasil kalkulasi/urutan operasi identik sebelum-sesudah (Property 6) — tidak ada perubahan ekspektasi test existing.

- [ ] 3. Kolom `transaction_date` (Requirement 2)
  - [ ] 3.1 Migration tambah `transaction_date` ke `general_ledgers` dan `stock_ledger_entries`
    - Kolom `dateTime`, `nullable()` dulu → backfill `UPDATE ... SET transaction_date = created_at` → `nullable(false)->change()` (pola aman untuk tabel berisi data)
    - Tambah `transaction_date` ke `$casts` model `GeneralLedger`/`StockLedgerEntry`
    - _Requirements: 2.1, 2.2_

  - [ ] 3.2 Audit query/laporan existing yang sort/filter `created_at` pada kedua tabel
    - Grep menyeluruh (`orderBy('created_at')`, `where('created_at', ...)`, report builder) yang menyentuh `general_ledgers`/`stock_ledger_entries` — ganti acuan ke `transaction_date`
    - _Requirements: 2.4_

  - [ ] 3.3 Write test migration backfill
    - **Test: backfill mengisi `transaction_date` = `created_at` untuk data existing** — seed data GL/SLE lama, jalankan migration, assert nilai sama persis (Property 1)
    - **Validates: Requirements 2.2**

- [ ] 4. Checkpoint - Pastikan Task 3 tidak regresi
  - Jalankan test dari Task 3.3, plus test laporan yang diaudit di Task 3.2 (jika ada test existing untuk laporan tersebut). Pastikan semua PASS.

- [ ] 5. Fondasi `GlPostingStatus` (Requirement 3)
  - [ ] 5.1 Migration `gl_posting_statuses`
    - `id` (ulid), `referenceable` (ulidMorphs), `status` (string, default 'pending'), `retry_count` (unsignedInteger default 0), `last_error` (text nullable), `posted_at` (datetime nullable), timestamps
    - _Requirements: 3.1_

  - [ ] 5.2 Buat enum `App\Enums\GlPostingStatus` (pending/posted/failed)
    - Pola sama `FormStatus` — native PHP backed enum dengan method `label()`
    - _Requirements: 3.1_

  - [ ] 5.3 Buat model `App\Models\Core\GlPostingStatus`
    - Relasi `referenceable()` (MorphTo), cast `status` ke enum, cast `posted_at` datetime, scope `pending()`/`failed()`
    - _Requirements: 3.6_

  - [ ] 5.4 Write unit test model `GlPostingStatus`
    - **Test: scope `pending()`/`failed()` filter benar** — seed baris dengan status campuran, assert scope hanya kembalikan yang sesuai
    - **Validates: Requirements 3.6**

- [ ] 6. Checkpoint - Pastikan Task 5 tidak regresi
  - Jalankan test dari Task 5.4. Pastikan migration jalan bersih di database test (SQLite).

- [ ] 7. Halaman monitoring GL posting (Requirement 4)
  - [ ] 7.1 Buat `GlPostingStatusController` (index + retry)
    - `index()`: `GlPostingStatus::dataTable()` filter `status IN (pending, failed)`, render `Inertia::render('Core/GlPostingStatuses/Index')`
    - `retry()`: `abort_unless(status === failed, 422)`, reset `status = pending`, `retry_count = 0`, dispatch ulang event sesuai tipe `referenceable` (method `resolveRetryEvent()` — `match(true)` instanceof PurchaseReceipt/DeliveryNote/PurchaseInvoice, `default => throw`)
    - _Requirements: 4.1, 4.4, 4.5_

  - [ ] 7.2 Tambah route + permission
    - Route `index`/`retry` di grup route Core, permission mengikuti pola existing modul Finance/Accounting
    - _Requirements: 4.3_

  - [ ] 7.3 Buat halaman React `Core/GlPostingStatuses/Index.jsx`
    - Tabel: tipe dokumen, kode dokumen (link ke detail), status (badge), retry_count, last_error, created_at. Tombol "Retry" HANYA muncul di baris `status = failed`
    - _Requirements: 4.1, 4.2, 4.5_

  - [ ] 7.4 Write feature test `GlPostingStatusController`
    - **Test: index menampilkan hanya pending/failed** — seed campuran status, assert `posted` tidak muncul
    - **Test: retry pada baris failed** — assert status reset ke pending, event ter-dispatch ulang (`Event::fake()`)
    - **Test: retry pada baris pending ditolak (422)**
    - **Validates: Requirements 4.1, 4.4, 4.5**

- [ ] 8. Checkpoint - Pastikan Task 7 tidak regresi
  - Jalankan test dari Task 7.4. Pastikan permission gate bekerja (user tanpa akses ditolak).

- [ ] 9. Migrasi GL `PurchaseReceiptService` via queued Job (Requirement 5)
  - [ ] 9.1 Buat event `App\Events\Purchase\PurchaseReceiptGeneralLedgerPostingRequested`
    - Payload: `purchaseReceipt`, `totalRatesForGL` (float), `isReturn` (bool), `transactionDate` (DateTimeInterface)
    - _Requirements: 5.1_

  - [ ] 9.2 Buat listener `App\Listeners\Purchase\Ledger\PostPurchaseReceiptGeneralLedger` (ShouldQueue)
    - `handle()`: buka `DB::transaction()` baru, resolve `$debitAccount`/`$creditAccount` dengan `lockForUpdate()`, buat 2 `GeneralLedgerEntry` identik formula lama (baseline: `PurchaseReceiptService.php:377-407`) + `transaction_date`, update `GlPostingStatus` terkait jadi `posted`
    - `failed()`: update `GlPostingStatus` jadi `failed`, `retry_count++`, `last_error` diisi
    - _Requirements: 5.2, 5.4_

  - [ ] 9.3 Register event di `EventServiceProvider`
    - _Requirements: 3.1 (struktur)_

  - [ ] 9.4 Dispatch dari `PurchaseReceiptService::onApproved()`
    - Verifikasi ulang baris persis (baseline: `L377-407`) — di dalam kondisi `$returnAgainst || $totalRatesForGL > 0`, SEBELUM `DB::commit()`: buat baris `GlPostingStatus` (pending), dispatch event, HAPUS blok pembuatan `GeneralLedgerEntry` inline lama
    - _Requirements: 5.1, 3.2_

  - [ ] 9.5 Write unit test `PostPurchaseReceiptGeneralLedgerTest`
    - **Test: Job sukses membuat 2 GL entry identik formula lama** — untuk kasus normal DAN retur, assert debit/credit/akun sama persis baseline pre-migrasi
    - **Test: Job gagal → `GlPostingStatus` jadi failed** — paksa exception (mock Account tidak ketemu), assert status + `last_error`
    - **Validates: Requirements 5.2, 5.4, Property 3, Property 4**

  - [ ] 9.6 Write test exclusion — kondisi GL tidak berubah
    - **Test: kondisi `$returnAgainst || $totalRatesForGL > 0` tetap sama** — kasus di mana tidak ada GL dibuat (ALUR-1 murni tanpa retur) assert TIDAK ADA `GlPostingStatus`/event dibuat
    - **Validates: Requirements 5.3**

- [ ] 10. Checkpoint - Pastikan Task 9 tidak regresi
  - Jalankan `PurchaseDualFlowTest`, test approval PurchaseReceipt existing, test dari Task 9.5-9.6. Pastikan semua PASS — bandingkan GL entry yang dihasilkan sebelum-sesudah migrasi (Property 3).

- [ ] 11. Migrasi GL `DeliveryNoteService` via queued Job (Requirement 6)
  - [ ] 11.1 Buat event `App\Events\Inventory\DeliveryNoteGeneralLedgerPostingRequested`
    - Payload: `deliveryNote`, `totalPicked` (float), `isReturn` (bool), `transactionDate`
    - _Requirements: 6.1_

  - [ ] 11.2 Buat listener `App\Listeners\Inventory\Ledger\PostDeliveryNoteGeneralLedger` (ShouldQueue)
    - Pola sama Task 9.2, formula GL identik baseline `DeliveryNoteService.php:379-404` (Stock vs COGS)
    - _Requirements: 6.2_

  - [ ] 11.3 Register event di `EventServiceProvider`
    - _Requirements: 3.1 (struktur)_

  - [ ] 11.4 Dispatch dari `DeliveryNoteService::onApproved()`
    - Verifikasi ulang baris persis (baseline: `L379-404`) — HANYA jika `$totalPicked > 0` (rental TETAP tidak menghasilkan `GlPostingStatus`/event apapun, sesuai perilaku existing), buat `GlPostingStatus` pending + dispatch event SEBELUM `DB::commit()`, hapus blok GL inline lama
    - _Requirements: 6.1, 3.2_

  - [ ] 11.5 Write unit test `PostDeliveryNoteGeneralLedgerTest`
    - **Test: Job sukses membuat 2 GL entry identik formula lama** — forward-pick DAN retur
    - **Test: rental TIDAK memicu GlPostingStatus/event sama sekali** — assert exclusion tetap berlaku
    - **Test: Job gagal → status failed**
    - **Validates: Requirements 6.1, 6.2, Property 3, Property 4**

- [ ] 12. Checkpoint - Pastikan Task 11 tidak regresi
  - Jalankan `SalesDualFlowTest`, test approval DeliveryNote (rental/retur/forward) existing, test dari Task 11.5. Pastikan semua PASS.

- [ ] 13. Migrasi GL `PurchaseInvoiceService` via queued Job (Requirement 7)
  - [ ] 13.1 Buat event `App\Events\Finances\PurchaseInvoiceGeneralLedgerPostingRequested`
    - Payload: `purchaseInvoice`, `totalStockGL` (float), `totalAmount` (float), `isReturn` (bool), `transactionDate` — membawa data untuk KEDUA blok GL (Stock/SRNB kondisional + Expense/Credit selalu) dalam 1 event
    - _Requirements: 7.1_

  - [ ] 13.2 Buat listener `App\Listeners\Finances\Ledger\PostPurchaseInvoiceGeneralLedger` (ShouldQueue)
    - `handle()`: buka transaksi baru, buat GL Stock/SRNB HANYA jika `$totalStockGL > 0` (identik baseline `L300-327`), buat GL Expense/Credit selalu (baseline `L330-344`), update `GlPostingStatus`
    - _Requirements: 7.2_

  - [ ] 13.3 Register event di `EventServiceProvider`
    - _Requirements: 3.1 (struktur)_

  - [ ] 13.4 Dispatch dari `PurchaseInvoiceService::onApproved()`
    - Verifikasi ulang baris persis (baseline: `L300-344`) — SATU dispatch menggantikan KEDUA blok GL lama, buat `GlPostingStatus` pending SEBELUM `DB::commit()`
    - _Requirements: 7.1, 3.2_

  - [ ] 13.5 Write unit test `PostPurchaseInvoiceGeneralLedgerTest`
    - **Test: Job sukses membuat GL entry identik formula lama** — kasus `$totalStockGL > 0` (2-4 entry) DAN `$totalStockGL == 0` (2 entry saja, Expense/Credit tetap jalan)
    - **Test: Job gagal → status failed**
    - **Validates: Requirements 7.1, 7.2, Property 3, Property 4**

- [ ] 14. Checkpoint - Pastikan Task 13 tidak regresi
  - Jalankan `PurchaseDualFlowTest`, test approval PurchaseInvoice (ALUR-1/ALUR-2/retur) existing, test dari Task 13.5. Pastikan semua PASS.

- [ ] 15. Final checkpoint - Full regression + retry flow end-to-end
  - Jalankan `php -d memory_limit=1024M vendor/bin/phpunit` (full suite). Bandingkan dengan baseline Fase 2 (974 test, 0 Error, 2 Failure pre-existing).
  - Test tambahan end-to-end: approve PurchaseReceipt/DeliveryNote/PurchaseInvoice dengan queue `sync` driver di test env, assert GL entry akhir identik behavior lama; simulasikan Job gagal lalu retry via `GlPostingStatusController::retry()`, assert GL akhirnya tercatat benar setelah retry.

## Notes

- Task 1 (lockForUpdate) dan Task 3 (transaction_date) independen satu sama lain dan dari grup lain — bisa dikerjakan paralel/urutan berbeda.
- Task 5 (fondasi GlPostingStatus) WAJIB selesai sebelum Task 7, 9, 11, 13 (semua butuh model/tabel ini).
- Task 9, 11, 13 (3 migrasi service) independen satu sama lain — bisa paralel setelah Task 5-6 selesai. TIDAK bergantung pada Task 7 (halaman monitoring) — halaman monitoring butuh data dari Task 9/11/13 untuk terlihat berguna, tapi secara teknis bisa dibangun lebih dulu (tabel sudah ada dari Task 5).
- Task 3.2 (audit laporan existing) scope pastinya BARU diketahui saat implementasi (grep menyeluruh) — kalau ternyata ada banyak titik, pertimbangkan pecah jadi sub-task tambahan saat itu, jangan dipaksa 1 task kalau ternyata besar.
- Setiap task yang memindahkan blok GL (`PurchaseReceiptService`/`DeliveryNoteService`/`PurchaseInvoiceService` masing-masing) WAJIB memverifikasi baris persis di kode SAAT INI sebelum edit — baseline di spec ini snapshot 2026-08-08 dan Task 1 (lockForUpdate) mengubah baris-baris di file yang sama SEBELUM Task 9/11/13 jalan, jadi nomor baris akan bergeser.
- `lockForUpdate()` pada `Account` di dalam Job (Task 9.2/11.2/13.2) HANYA efektif SELAMA Job itu sendiri berjalan (mencegah race antar-Job) — window antara commit transaksi 1 dan Job mulai dieksekusi DITERIMA sebagai konsekuensi desain queue, dimitigasi `transaction_date` (Task 3) dan halaman monitoring (Task 7), BUKAN dicegah dengan lock tambahan (lihat design.md Requirement 5 Acceptance Criteria 4).
- Retry (Task 7.1) SEBAIKNYA re-query data terbaru dari dokumen sumber saat dispatch ulang, BUKAN replay payload event lama yang mungkin stale — lihat design.md Error Handling.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3", "1.4", "1.5", "1.6", "1.7", "3.1"] },
    { "id": 1, "tasks": ["1.8", "3.2"] },
    { "id": 2, "tasks": ["3.3"] },
    { "id": 3, "tasks": ["5.1", "5.2"] },
    { "id": 4, "tasks": ["5.3"] },
    { "id": 5, "tasks": ["5.4", "7.1", "9.1", "11.1", "13.1"] },
    { "id": 6, "tasks": ["7.2", "9.2", "11.2", "13.2"] },
    { "id": 7, "tasks": ["7.3", "9.3", "11.3", "13.3"] },
    { "id": 8, "tasks": ["7.4", "9.4", "11.4", "13.4"] },
    { "id": 9, "tasks": ["9.5", "9.6", "11.5", "13.5"] }
  ]
}
```
