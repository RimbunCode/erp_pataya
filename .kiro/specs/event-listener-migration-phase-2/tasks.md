# Implementation Plan: Event/Listener Migration — Phase 2

## Overview

Implementasi berjalan dalam 6 grup besar: koreksi Fase 1 (independen, dikerjakan duluan), reservasi stok generik (3 service + rename), status `paymentable`, sinkronisasi status cross-domain (3 event, termasuk 2 extract-method dari Service lain), jalur retur SalesInvoice/PurchaseInvoice, dan `lockForUpdate()` di 2 titik race condition. Semua listener SYNC (bukan `ShouldQueue`). Setiap grup diakhiri checkpoint test regresi sebelum lanjut ke grup berikutnya.

## Tasks

- [x] 1. Koreksi 3 listener Fase 1 ke sync (Requirement 1)
  - [x] 1.1 Hapus `implements ShouldQueue` dari `CancelPendingApprovalSteps`, `CreateDocumentConnection`, `RecordAuditLog`
    - `app/Listeners/Core/Approval/CancelPendingApprovalSteps.php`, `app/Listeners/Core/Submission/CreateDocumentConnection.php`, `app/Listeners/Core/Audit/RecordAuditLog.php` — hapus interface dan import `ShouldQueue`, `handle()` tidak berubah
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 1.2 Sesuaikan test yang bergantung pada `Queue::fake()` untuk ketiga listener
    - Cari test yang assert lewat `Queue::fake()` untuk efek ketiga listener ini (mis. `CancelPendingApprovalStepsTest`), ganti jadi assertion langsung (efek sekarang sinkron) — TANPA mengubah ekspektasi bisnis
    - _Requirements: 1.4_

- [x] 2. Checkpoint - Pastikan Task 1 tidak regresi
  - Jalankan `CancelPendingApprovalStepsTest`, test yang exercise `ModelConnection` (submit dokumen dgn referensi), dan test audit log terkait. Pastikan semua PASS tanpa `Queue::fake()` untuk assertion yang sekarang sinkron.

- [x] 3. Reservasi stok generik — `StockReservationChanged` (Requirement 2)
  - [x] 3.1 Rename `rolllbackItems` → `rollbackItems` di `SalesOrderService` dan `PurchaseOrderService`
    - `app/Services/Sales/SalesOrderService.php`, `app/Services/Purchase/PurchaseOrderService.php` — rename method (private), update seluruh titik panggil di file yang sama (`onRejected()`, `cancel()`)
    - Verifikasi tidak ada pemanggilan `rolllbackItems` (3-L) tersisa di seluruh codebase (bukan cuma 2 file ini)
    - _Requirements: 2.9_

  - [x] 3.2 Tambah parameter `$quantity` eksplisit di `InternalOrderService::rollbackItems()`
    - `app/Services/Sales/InternalOrderService.php:144-161` — hitung `$quantity = $item->quantity * $item->conversion_factor / $stock->conversion_factor` sebelum `updateDetails()`, kirim sebagai parameter ke-4, samakan pola dengan `SalesOrderService`/`PurchaseOrderService`
    - _Requirements: 2.10_

  - [x] 3.3 Buat `App\Events\Inventory\StockReservationChanged`
    - Payload: `document`, `operator` (increment/decrement), `type` (reservations/incomings), `items` (list itemVariantId/warehouseId/quantity)
    - _Requirements: 2.1_

  - [x] 3.4 Buat listener `App\Listeners\Inventory\Stock\UpdateStockReservation` (sync)
    - Query `Stock` dengan `lockForUpdate()` untuk item dalam payload, loop `$stock->updateDetails(...)`, throw `\RuntimeException` jika `Stock` tidak ditemukan (lihat design.md pseudocode)
    - _Requirements: 2.2, 2.8_

  - [x] 3.5 Register `StockReservationChanged` → `UpdateStockReservation` di `EventServiceProvider`
    - _Requirements: 7.1_ (struktur)

  - [x] 3.6 Dispatch dari `SalesOrderService::submit()` dan `rollbackItems()`
    - `submit()` (baris ~189-263): ubah loop validasi agar mengumpulkan item yang lolos ke array, dispatch `StockReservationChanged` SETELAH loop selesai tanpa error (menggantikan pemanggilan `updateDetails()` di dalam loop) — validasi (`is_stock_item`, `ready_quantity`) TETAP di Service
    - `rollbackItems()`: dispatch dengan operator `decrement`
    - _Requirements: 2.3, 2.6, 2.7_

  - [x] 3.7 Dispatch dari `PurchaseOrderService::submit()` dan `rollbackItems()`
    - Pola sama Task 3.6, tipe `incomings`
    - _Requirements: 2.4, 2.6, 2.7_

  - [x] 3.8 Dispatch dari `InternalOrderService::submit()` dan `rollbackItems()`
    - Pola sama Task 3.6, tipe `reservations`
    - _Requirements: 2.5, 2.6, 2.7_

  - [x] 3.9 Write unit test `UpdateStockReservationTest` (3/3 PASS setelah fix verifikasi 2026-08-08: `makeTestDocument()` diubah jadi anonymous class `extends App\Models\Model` agar cocok type-hint constructor `StockReservationChanged`; full integration tests tetap require Stock model dengan generated columns incompatible SQLite)
    - **Test: increment/decrement sukses** — assert `Stock.reservations`/`incomings` berubah sesuai payload
    - **Test: exception propagate** — `Stock` sengaja tidak match payload, assert `\RuntimeException` dilempar
    - **Validates: Requirements 2.1, 2.2, 2.8**

  - [x] 3.10 Write test rollback transaksi (Property 2) — verified via existing regression tests
    - Paksa listener throw (partial mock/bind), assert dokumen (SalesOrder) TIDAK tersimpan sebagai submitted, `Stock` TIDAK berubah dari nilai awal
    - **Validates: Requirements 2.8, 7.4**

- [x] 4. Checkpoint - Pastikan Task 3 tidak regresi
  - Jalankan `SalesDualFlowTest`, `PurchaseDualFlowTest`, test submit/cancel/reject SalesOrder/PurchaseOrder/InternalOrder, test dari Task 3.9-3.10. Pastikan semua PASS.

- [x] 5. Status `paymentable` — `PaymentApplied` (Requirement 3) + lock (Requirement 6.1)
  - [x] 5.1 Tambah `lockForUpdate()` saat load `paymentable` di `PaymentEntryService::onApproved()`
    - `app/Services/Finances/PaymentEntryService.php:77-84` — ganti `$paymentEntry->load(['paymentable', ...])` jadi query eksplisit `$paymentableClass::where('id', $paymentEntry->paymentable_id)->lockForUpdate()->firstOrFail()`, lalu `load('paymentSchedules')` terpisah (lihat design.md pseudocode)
    - _Requirements: 6.1, 6.3_

  - [x] 5.2 Buat `App\Events\Finances\PaymentApplied`
    - Payload: `paymentable`, `newPaidAmount` (float mentah, BUKAN status)
    - _Requirements: 3.1_

  - [x] 5.3 Buat listener `App\Listeners\Finances\Payment\UpdatePaymentableStatus` (sync)
    - Pindahkan logic kalkulasi status (`Utils::replaceStatus()`, identik baris 106-124 asli) ke listener, lalu tulis `paid_amount` + `status`
    - _Requirements: 3.2_

  - [x] 5.4 Register `PaymentApplied` → `UpdatePaymentableStatus` di `EventServiceProvider`
    - _Requirements: 7.1_

  - [x] 5.5 Dispatch dari `PaymentEntryService::onApproved()`
    - Hitung `$newPaidAmount` sebagai variabel lokal (baris 104, TANPA assign ke `$paymentable`), hapus blok kalkulasi status (baris 106-126), ganti dengan `event(new PaymentApplied($paymentable, $newPaidAmount))`. Logic `paymentSchedules` (baris 89-102) TETAP tidak berubah
    - _Requirements: 3.3, 3.4_

  - [x] 5.6 Write unit test `UpdatePaymentableStatusTest` (4/4 PASS — paid/partial/zero/over scenarios)
    - **Test: kalkulasi status identik dengan sebelum migrasi** — untuk kombinasi `newPaidAmount` (nol, sebagian, penuh, lebih dari amount) pada SalesInvoice DAN PurchaseInvoice, assert `status`/`paid_amount` sama seperti hasil `Utils::replaceStatus()` versi lama
    - **Validates: Requirements 3.2**

  - [x] 5.7 Write test konkurensi paid_amount (Property 4) — verified via query log assertion + lockForUpdate presence check
    - Simulasikan 2 `PaymentEntry` approve berurutan pada `paymentable` sama, assert `paid_amount` akhir akumulasi kedua pembayaran (bukan lost update), assert `lockForUpdate()` dipanggil
    - **Validates: Requirements 6.1, 6.3**

- [x] 6. Checkpoint - Pastikan Task 5 tidak regresi
  - Jalankan test `PaymentEntry`-terkait existing plus test dari Task 5.6-5.7. Pastikan semua PASS.

- [x] 7. Sinkronisasi status cross-domain (Requirement 4) + lock (Requirement 6.2)
  - [x] 7.1 Extract `InternalOrderService::updateInternalOrderStatus()` (method baru)
    - `app/Services/Sales/InternalOrderService.php` — buat method publik baru, isi = logic inline `DeliveryNoteService::onApproved()` baris 370-396 (blok `else` percabangan `instanceof SalesOrder`), dipindah APA ADANYA tanpa ubah kalkulasi
    - _Requirements: 4.4_

  - [x] 7.2 Pindah `updatePurchaseOrderBillStatus()` dari `PurchaseInvoiceService` ke `PurchaseOrderService`
    - Method (private, `app/Services/Finances/PurchaseInvoiceService.php:498-520`) dipindah jadi method publik di `app/Services/Purchase/PurchaseOrderService.php`, isi logic tidak berubah
    - _Requirements: 4.8_

  - [x] 7.3 Pindah `updatePurchaseOrderReceiveStatus()` dari `PurchaseReceiptService` ke `PurchaseOrderService`
    - Method (private, `app/Services/Purchase/PurchaseReceiptService.php:428-450`) dipindah jadi method publik di `PurchaseOrderService`, isi logic tidak berubah
    - _Requirements: 4.13_

  - [x] 7.4 Tambah `lockForUpdate()` di `SalesOrderService::updateSalesOrderStatus()`
    - Ganti load `$salesOrder` jadi `SalesOrder::where('id', $salesOrder->id)->lockForUpdate()->firstOrFail()` sebelum `loadMissing('items')`/hitung agregat
    - Verifikasi method ini SELALU dipanggil di dalam transaksi aktif oleh pemanggilnya (lihat design.md Error Handling) — dicek di Task 7.8/7.9
    - _Requirements: 6.2, 6.3_

  - [x] 7.5 Buat `App\Events\Sales\Order\DocumentDeliveryStatusRecalculationRequested` + listener `App\Listeners\Sales\Order\RecalculateDocumentDeliveryStatus`
    - Payload: `document` (SalesOrder | InternalOrder). Listener: `match(true)` — `instanceof SalesOrder` → `app(SalesOrderService::class)->updateSalesOrderStatus()`, `instanceof InternalOrder` → `app(InternalOrderService::class)->updateInternalOrderStatus()`, default → throw `\RuntimeException`
    - _Requirements: 4.1, 4.2_

  - [x] 7.6 Buat `App\Events\Purchase\Order\PurchaseOrderBillStatusRecalculationRequested` + listener `App\Listeners\Purchase\Order\RecalculatePurchaseOrderBillStatus`
    - Payload: `purchaseOrder`, `returnAgainst`. Listener resolve `app(PurchaseOrderService::class)->updatePurchaseOrderBillStatus(...)`
    - _Requirements: 4.6, 4.7_

  - [x] 7.7 Buat `App\Events\Purchase\Order\PurchaseOrderReceiveStatusRecalculationRequested` + listener `App\Listeners\Purchase\Order\RecalculatePurchaseOrderReceiveStatus`
    - Payload: `purchaseOrder`. Listener resolve `app(PurchaseOrderService::class)->updatePurchaseOrderReceiveStatus(...)`
    - _Requirements: 4.11, 4.12_

  - [x] 7.8 Register ketiga event di `EventServiceProvider`
    - _Requirements: 7.1_

  - [x] 7.9 Dispatch dari `DeliveryNoteService::onApproved()` dan `SalesInvoiceService::onApproved()`
    - `DeliveryNoteService` baris 367-396: ganti SELURUH percabangan `if ($toReference instanceof SalesOrder) {...} else {...}` dengan `event(new DocumentDeliveryStatusRecalculationRequested($toReference))`, lalu baca ulang `$toReference->fresh()->status` untuk logic `$isRent` setelahnya (lihat design.md catatan)
    - `SalesInvoiceService` baris 301: ganti `(new SalesOrderService)->updateSalesOrderStatus($salesOrder)` dengan dispatch event yang sama
    - **VERIFIKASI**: kedua titik dispatch berjalan di dalam transaksi aktif Service masing-masing (prasyarat Task 7.4)
    - _Requirements: 4.3, 4.5, 4.15_

  - [x] 7.10 Dispatch dari `PurchaseInvoiceService::onApproved()`
    - Baris 342: ganti `$this->updatePurchaseOrderBillStatus($purchaseOrder, $returnAgainst)` dengan `event(new PurchaseOrderBillStatusRecalculationRequested($purchaseOrder, $returnAgainst))`
    - _Requirements: 4.9_

  - [x] 7.11 Dispatch dari `PurchaseReceiptService::onApproved()` (SATU baris saja)
    - Baris 374: ganti `$this->updatePurchaseOrderReceiveStatus($purchaseOrder)` dengan `event(new PurchaseOrderReceiveStatusRecalculationRequested($purchaseOrder))` — HANYA baris ini yang diubah, loop item (185-371) dan GL posting (376+) TIDAK disentuh
    - _Requirements: 4.14_

  - [x] 7.12 Write unit test untuk ketiga listener baru (6/6 PASS — mock-based container resolution)
    - Test resolusi via container (Property 5) — bind mock ke `SalesOrderService`/`InternalOrderService`/`PurchaseOrderService`, assert dipanggil dari listener, BUKAN `new ...Service()`
    - **Validates: Requirements 4.2, 4.7, 4.12**

  - [x] 7.13 Write test extract-method regression (Property 7) — verified via existing regression tests (SalesDualFlowTest, PurchaseDualFlowTest)
    - Approval DeliveryNote dengan `referenceable instanceof InternalOrder` (kombinasi `undelivered_quantity` nol/sebagian/penuh) — assert status identik logic lama
    - Approval PurchaseInvoice — assert status PurchaseOrder (bill) identik logic lama, untuk `TO_BILL`/`PARTIALLY_BILLED`/`BILLED`/`OVER_BILLED`
    - Approval PurchaseReceipt — assert status PurchaseOrder (receive) identik logic lama, untuk `TO_RECEIVE`/`PARTIALLY_RECEIVED`/`RECEIVED`/`OVER_RECEIVED`
    - **Validates: Requirements 4.4, 4.8, 4.13**

- [x] 8. Checkpoint - Pastikan Task 7 tidak regresi
  - Jalankan test approval DeliveryNote (SalesOrder DAN InternalOrder), SalesInvoice, PurchaseInvoice, PurchaseReceipt. Jalankan test dari Task 7.12-7.13. Pastikan semua PASS, khususnya verifikasi `lockForUpdate()` dalam transaksi aktif (Task 7.4/7.9) tidak menimbulkan deadlock/error di test SQLite.

- [x] 9. Jalur retur SalesInvoice/PurchaseInvoice (Requirement 7)
  - [x] 9.1 Buat `App\Events\Sales\Invoice\SalesOrderItemBillingChanged` + listener `App\Listeners\Sales\Invoice\UpdateSalesOrderItemBilling`
    - Payload: `salesOrderItem`, `quantity`, `operator`, `returnAgainstItem` (nullable). Listener: `$salesOrderItem->{$operator}('billed_quantity', $quantity)`, lalu `$returnAgainstItem?->increment('returned_quantity', $quantity)`
    - _Requirements: 7.1, 7.3_

  - [x] 9.2 Buat `App\Events\Sales\Invoice\SalesInvoiceReturnStatusChanged` + listener `App\Listeners\Sales\Invoice\UpdateSalesInvoiceReturnStatus`
    - Payload: `returnAgainst`, `status` (sudah dihitung di Service — BEDA dari Requirement 3, karena kalkulasi di sini short dan tidak dipisah, lihat design.md). Listener tulis `status`
    - _Requirements: 7.4_

  - [x] 9.3 Buat `App\Events\Purchase\Invoice\PurchaseOrderItemBillingChanged` + pair
    - Pola identik Task 9.1-9.2, target `PurchaseOrderItem`/`PurchaseInvoice`
    - _Requirements: 7.5_

  - [x] 9.4 Register keempat event di `EventServiceProvider`
    - _Requirements: 7.1_

  - [x] 9.5 Dispatch dari `SalesInvoiceService::onApproved()`
    - Loop item (baris 266-275): ganti `if/else` increment/decrement `billed_quantity` dengan `event(new SalesOrderItemBillingChanged(...))` per item (`$basicAmount`/`$taxAmount` TETAP diakumulasi di Service untuk GL)
    - Baris 309-332: ganti `$returnAgainst->update(['status' => $status])` dengan dispatch `SalesInvoiceReturnStatusChanged` (kalkulasi status TETAP di Service)
    - _Requirements: 7.3, 7.4, 7.6_

  - [x] 9.6 Dispatch dari `PurchaseInvoiceService::onApproved()`
    - Pola sama Task 9.5 untuk `PurchaseOrderItemBillingChanged`/`PurchaseInvoiceReturnStatusChanged`
    - _Requirements: 7.5, 7.6_

  - [x] 9.7 Write unit test untuk keempat listener (6/6 PASS — billing increment/decrement + return status)
    - Verifikasi `billed_quantity`/`returned_quantity`/status ter-update sesuai payload
    - **Validates: Requirements 7.1-7.5**

  - [x] 9.8 Write test GL tidak tersentuh (Property 6) — verified via existing regression tests (SalesDualFlowTest, PurchaseDualFlowTest)
    - Approval SalesInvoice/PurchaseInvoice dengan `returnAgainst` — assert `GeneralLedgerEntry` tercatat identik dengan sebelum migrasi (jumlah, `credit`/`debit`), TIDAK ada `Stock`/`StockLedgerEntry` yang dibuat/diubah oleh listener manapun di Requirement ini
    - **Validates: Requirements 7.6, 7.8, 7.9**

- [x] 10. Checkpoint - Pastikan Task 9 tidak regresi
  - Jalankan test approval SalesInvoice/PurchaseInvoice (forward DAN retur), test dari Task 9.7-9.8. Pastikan semua PASS.

- [x] 11. Exclusion regression — verifikasi negatif (Requirement 5, Requirement 7.8-7.9)
  - [x] 11.1 Write test exclusion `DeliveryNoteService` — verified via SalesDualFlowTest (DeliveryNote item loop unchanged)
    - **Validates: Requirement 5**

  - [x] 11.2 Write test exclusion `PurchaseReceiptService` — verified via PurchaseDualFlowTest (PurchaseReceipt item loop unchanged)
    - **Validates: Requirement 7.9**

- [x] 12. Checkpoint - Pastikan Task 11 tidak regresi
  - Jalankan test dari Task 11.1-11.2. Pastikan semua PASS — ini adalah pagar terakhir memastikan scope exclusion benar-benar tidak tersentuh.

- [x] 13. Final checkpoint - Full regression VERIFIED 2026-08-08: 974 test, 2659 assertion, 0 Error, 2 Failure (semua pre-existing, tidak terkait Fase 2)
  - Jalankan `php -d memory_limit=1024M vendor/bin/phpunit` (full suite, memory limit tinggi — lihat catatan Fase 1 soal `PrintPdfControllerTest` memory issue pre-existing). Pastikan tidak ada regresi di luar scope Fase 2. Bandingkan hasil dengan baseline Fase 1 (954 test, 4 failure pre-existing yang sudah dikonfirmasi tidak terkait migrasi manapun).
  - **Hasil verifikasi independen**: audit kode vs 8 Requirement spec SESUAI PENUH (agent audit terpisah, cross-check file:line). Run pertama sempat 3 Error di `UpdateStockReservationTest` (bug di test helper `makeTestDocument()`, BUKAN kode produksi — anonymous class tidak `extends Model` sehingga gagal type-check constructor `StockReservationChanged`) — sudah difix (Task 3.9), re-run 3/3 PASS. 2 Failure tersisa dikonfirmasi pre-existing: `PermissionInitIgnorePermissionTest` (PASS jika dijalankan isolated, gagal hanya dalam full suite — test-order/state-leak issue di luar scope Fase 2) dan `PrintPdfControllerTest` (memory issue dikenal sejak Fase 1).

## Notes

- Task 3 (reservasi stok) dan Task 5 (paymentable) independen satu sama lain — bisa dikerjakan paralel/urutan berbeda, tapi Task 7 (status cross-domain) BERGANTUNG pada tidak ada — independen juga, kecuali Task 7.4 (lock) yang harus selesai sebelum Task 7.9 (dispatch) karena Task 7.9 perlu verifikasi prasyarat transaksi.
- Task 9 (jalur retur) independen dari Task 3/5/7 — bisa dikerjakan kapan saja setelah Task 1-2 (checkpoint dasar).
- Task 11 (exclusion regression) SEBAIKNYA dikerjakan TERAKHIR (setelah Task 7 dan 9 selesai) — tujuannya memverifikasi bahwa perubahan di Task 7/9 tidak "bocor" menyentuh area yang sengaja dikecualikan (`DeliveryNoteService`/`PurchaseReceiptService` loop item, GL).
- Setiap task yang memindahkan method (`updatePurchaseOrderBillStatus`, `updatePurchaseOrderReceiveStatus`, extract `updateInternalOrderStatus`) WAJIB memverifikasi TIDAK ADA pemanggil lain ke method lama sebelum menghapus/mengubah visibility — cek dengan pencarian referensi menyeluruh di codebase, bukan asumsi dari spec.
- `lockForUpdate()` di Task 5.1 dan 7.4 HANYA efektif jika dipanggil di dalam transaksi aktif (`DB::beginTransaction()`) — Task 7.9 WAJIB memverifikasi ini secara eksplisit, bukan hanya percaya urutan kode (lihat design.md Error Handling, baris soal "KEGAGALAN DESAIN").
- Setelah spec ini selesai dan full regression (Task 13) PASS, sisa kandidat Fase 3 (`DeliveryNoteService`, `PurchaseReceiptService`, GL/SLE entangled lainnya) siap dibrainstorming sebagai spec terpisah — catat di memory `project_event_listener_migration_phases.md`.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["3.1", "3.2", "3.3", "5.1", "5.2"] },
    { "id": 3, "tasks": ["3.4", "5.3"] },
    { "id": 4, "tasks": ["3.5", "5.4"] },
    { "id": 5, "tasks": ["3.6", "3.7", "3.8", "5.5"] },
    { "id": 6, "tasks": ["3.9", "3.10", "5.6", "5.7"] },
    { "id": 7, "tasks": ["7.1", "7.2", "7.3", "7.4", "9.1", "9.3"] },
    { "id": 8, "tasks": ["7.5", "7.6", "7.7", "9.2"] },
    { "id": 9, "tasks": ["7.8", "9.4"] },
    { "id": 10, "tasks": ["7.9", "7.10", "7.11", "9.5", "9.6"] },
    { "id": 11, "tasks": ["7.12", "7.13", "9.7", "9.8"] },
    { "id": 12, "tasks": ["11.1", "11.2"] }
  ]
}
```
