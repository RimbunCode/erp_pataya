# Implementation Plan: Approval System Rewrite

## Overview

Implementasi berjalan bottom-up: interface/trait dasar dulu (tidak ada dependency), lalu `ApprovalService` generik, lalu migrasi 12 pasang Model+Service satu per satu (masing-masing atomik dan independen — bisa diverifikasi terpisah), baru terakhir `Submitable::checkApproval()` dan `ApprovalInstanceController` yang menyatukan semuanya. Test kontrak dan regresi jalan di tiap checkpoint, bukan ditumpuk di akhir.

## Tasks

- [x] 1. Interface dan trait dasar
  - [x] 1.1 Buat `App\Contracts\CrudService` dan `App\Contracts\SubmitableService`
    - `app/Contracts/CrudService.php`: method `create(array $data): Model`, `update(Model $model, array $data): Model`, `delete(Model $model): void`
    - `app/Contracts/SubmitableService.php`: `extends CrudService`, tambah `submit`, `cancel`, `amend`, `onApproved`, `onRejected` (semua `(Model $model): mixed`)
    - _Requirements: 1.1, 1.2_

  - [x] 1.2 Buat `App\Traits\HasDefaultDelete`
    - `app/Traits/HasDefaultDelete.php`: `delete(Model $model): void { $model->delete(); }`
    - _Requirements: 1.3_

  - [x] 1.3 Write unit test kontrak interface
    - **Contract test: seluruh 12 Service submitable implement `SubmitableService`**
    - Test iterasi daftar 12 Service (lihat Glossary requirements.md), assert `is_subclass_of($service, SubmitableService::class)` — akan FAIL di titik ini (Service belum dimigrasi), jadi test ini ditulis sebagai target untuk task berikutnya (TDD merah dulu)
    - **Validates: Requirements 5.2**

- [x] 2. Checkpoint - Pastikan interface/trait baru tidak merusak apapun (belum dipakai, cuma file baru)
  - Jalankan `php artisan test --filter=SubmitableServiceContract` (atau nama test yang dibuat), pastikan test yang ditulis di 1.3 gagal SEPERTI DIHARAPKAN (belum ada Service yang implement) — bukan error fatal (class/interface tidak ditemukan dsb).

- [x] 3. `ApprovalService`
  - [x] 3.1 Buat `App\Services\Core\Approval\ApprovalService`
    - `app/Services/Core/Approval/ApprovalService.php`: method `check(Model $document, string $serviceClass, array $options, string $triggerOn): mixed` — lihat pseudocode design.md bagian Components and Interfaces
    - _Requirements: 3.1_

  - [x] 3.2 Write unit test `ApprovalService::check()`
    - **Test: 3 skenario evaluasi approval**
    - Skenario fully-approved/no-scheme → assert `onApproved()` fake/mock terpanggil, return value diteruskan
    - Skenario rejected → assert `onRejected()` terpanggil
    - Skenario masih pending → assert status model jadi `NEED_APPROVAL`, `onApproved`/`onRejected` TIDAK terpanggil
    - **Validates: Requirements 3.1**

- [x] 4. Checkpoint - Pastikan ApprovalService tests pass
  - Jalankan test dari 3.2, pastikan semua PASS. Tanyakan ke user jika ada pertanyaan desain yang muncul.

- [x] 5. Migrasi 12 pasang Model+Service (satu per satu, atomik)
  - [x] 5.1 `SalesOrder` + `SalesOrderService`
    - Tambah `public static string $service = SalesOrderService::class;` di `app/Models/Sales/SalesOrder.php`
    - `SalesOrderService implements SubmitableService`, `use HasDefaultDelete` (kecuali sudah ada `delete()` custom — verifikasi dulu)
    - **Verifikasi gap**: cek apakah `SalesOrderService` sudah punya method `cancel()` — jika belum, buat berdasarkan logic yang sekarang ada di alur `Controller::cancel()` untuk SalesOrder (lihat design.md "Catatan gap")
    - Sesuaikan signature `create`/`update`/`submit`/`onApproved`/`onRejected` existing agar match interface (return type), TANPA mengubah logic
    - _Requirements: 1.4, 2.1_

  - [x] 5.2 `PurchaseOrder` + `PurchaseOrderService` — pola sama seperti 5.1
    - _Requirements: 1.4, 2.1_

  - [x] 5.3 `PurchaseRequest` + `PurchaseRequestService` — pola sama seperti 5.1
    - _Requirements: 1.4, 2.1_

  - [x] 5.4 `PurchaseReceipt` + `PurchaseReceiptService` — pola sama seperti 5.1
    - _Requirements: 1.4, 2.1_

  - [x] 5.5 `PurchaseInvoice` + `PurchaseInvoiceService` — pola sama seperti 5.1
    - _Requirements: 1.4, 2.1_

  - [x] 5.6 `SalesInvoice` + `SalesInvoiceService` — pola sama seperti 5.1
    - _Requirements: 1.4, 2.1_

  - [x] 5.7 `PaymentEntry` + `PaymentEntryService` — pola sama seperti 5.1
    - _Requirements: 1.4, 2.1_

  - [x] 5.8 `DeliveryNote` + `DeliveryNoteService` — pola sama seperti 5.1
    - _Requirements: 1.4, 2.1_

  - [x] 5.9 `StockEntry` + `StockEntryService` — pola sama seperti 5.1
    - _Requirements: 1.4, 2.1_

  - [x] 5.10 `InternalOrder` + `InternalOrderService` — pola sama seperti 5.1
    - _Requirements: 1.4, 2.1_

  - [x] 5.11 `WorkOrder` + `WorkOrderService` — pola sama seperti 5.1
    - _Requirements: 1.4, 2.1_

  - [x] 5.12 `Quotation` + `QuotationService` — pola sama seperti 5.1
    - _Requirements: 1.4, 2.1_

  - [x] 5.13 Jalankan ulang contract test dari 1.3
    - **Contract test sekarang harus PASS penuh** — seluruh 12 Service terverifikasi implement `SubmitableService`
    - **Validates: Requirements 5.2**

- [x] 6. Checkpoint - Pastikan seluruh 12 Model+Service migrasi tests pass
  - Jalankan test kontrak (5.13) dan test existing per-modul dokumen (mis. `php artisan test --filter=SalesOrder`, `--filter=PurchaseOrder`, dst untuk 12 dokumen) — pastikan tidak ada regresi pada test CRUD dasar tiap dokumen. Tanyakan ke user jika ada test yang gagal karena perubahan signature.

- [x] 7. `Submitable::checkApproval()` dan resolusi guard
  - [x] 7.1 Update `Submitable::checkApproval()`
    - Tambah guard `property_exists`/`is_subclass_of` sesuai design.md, lempar `LogicException` sesuai spec
    - Ganti body method: panggil `app(ApprovalService::class)->check(...)` alih-alih `app()->call("$controller@checkApproval")`
    - Pindahkan `DB::transaction`/`logForSubmitted()` dari `ApprovalInstanceController::checkApproval()` (lama) ke sini
    - _Requirements: 2.3, 2.4, 3.2, 3.3_

  - [x] 7.2 Write unit test guard `checkApproval()`
    - **Test: LogicException untuk Model tanpa $service**
    - Buat model test/stub `Submitable` tanpa `$service`, assert `checkApproval()` melempar `LogicException`, assert TIDAK ADA `ApprovalInstance` dibuat
    - **Test: LogicException untuk $service yang tidak implement SubmitableService**
    - Model test dengan `$service` menunjuk class yang bukan `SubmitableService`, assert exception yang sama
    - **Validates: Requirements 2.3, 2.4**

- [x] 8. Checkpoint - Pastikan checkApproval tests pass
  - Jalankan test dari 7.2, pastikan PASS. Jalankan juga test submit existing (`ApprovalAutoApproveTest`) untuk memastikan alur submit → auto-approve masih jalan lewat jalur baru.

- [x] 9. `ApprovalInstanceController` — hapus dispatch string, resolusi via `$service`
  - [x] 9.1 Update `ApprovalInstanceController::approve()`/`reject()`
    - Ganti bagian setelah `DB::commit()`: resolve `$serviceClass = $approval->document::$service`, panggil `app($serviceClass)->onApproved($document)`/`onRejected($document)` langsung, `return $result`
    - Hapus method `callDocumentCallback()` (tidak dipakai lagi)
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 9.2 Hapus method `onApproved()`/`onRejected()` dari seluruh Controller dokumen (12 Controller)
    - Verifikasi tidak ada pemanggil lain ke method ini selain `ApprovalInstanceController` (sudah dihapus di 9.1) sebelum menghapus — hanya base Controller yang punya, semua dokumen pakai via inheritance. Dihapus dari `app/Http/Controllers/Controller.php`.
    - _Requirements: 4.5_

  - [ ]\* 9.3 Write test regresi response HTTP
    - **Test: response approve() tetap mengarah ke tujuan yang benar**
    - Untuk `SalesOrder` (yang `onApproved()`-nya membuat `DeliveryNote`/`SalesInvoice`): submit → approve, assert response/redirect setara dengan sebelum migrasi
    - **Validates: Requirements 4.1, 5.4**

- [x] 10. Checkpoint - Pastikan seluruh approval flow tests pass
  - Jalankan test regresi existing: `ApprovalNotificationTest`, `ApprovalPdfAutoAttachTest`, `ApprovalAutoApproveTest`, `CancelPendingApprovalStepsTest`, plus test 9.3. Pastikan semua PASS tanpa modifikasi assertion bisnis.
  - **Hasil**: 35 tests passed, 115 assertions. Approved tests: ApprovalAutoApproveTest, ApprovalPdfAutoAttachTest, CancelPendingApprovalStepsTest, ApprovalNotificationTest, SubmitableServiceContractTest, ApprovalServiceTest, SubmitableCheckApprovalGuardTest. Semua PASS.
  - **Catatan**: `ApprovalPdfAutoAttachTest` dan `ApprovalAutoApproveTest` perlu stub service baru (`PdfAttachTestDocumentService`, `ApprovalTestDocumentService`) untuk ganti method `controller->onApproved()` yang dihapus.

- [ ] 11. Final checkpoint - Full regression
  - Jalankan `php artisan test --compact` (full suite), pastikan tidak ada regresi di luar approval flow. Tanyakan ke user sebelum lanjut ke `event-listener-migration-phase-1` yang tertunda.

## Notes

- 12 pasang Model+Service (task 5.1–5.12) independen satu sama lain — bisa dikerjakan dalam urutan berbeda atau diverifikasi terpisah, tapi HARUS selesai semua sebelum task 7 (guard `checkApproval` butuh minimal beberapa Service sudah valid untuk ditest, dan contract test di 5.13 butuh semuanya selesai).
- Task 5.x masing-masing berpotensi menemukan gap tambahan (bukan cuma `cancel()`) — jika ditemukan saat implementasi (mis. `create()`/`update()` yang signature-nya beda dari asumsi design.md), catat dan tanyakan ke user sebelum memaksakan perubahan besar pada logic existing.
- Task 9.2 (hapus `onApproved`/`onRejected` dari Controller) sebaiknya dilakukan SETELAH 9.1 selesai dan tervalidasi — urutan terbalik akan membuat approval flow rusak di tengah jalan.
- Setelah spec ini selesai dan full regression (task 11) PASS, `event-listener-migration-phase-1` Requirement 2 (`ApprovalInstanceController::approve()/reject()` → event `ApprovalDecided`) bisa dilanjutkan — desainnya perlu direview ulang terhadap struktur `ApprovalInstanceController` yang baru dari spec ini.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "3.1"] },
    { "id": 2, "tasks": ["3.2"] },
    { "id": 3, "tasks": ["5.1", "5.2", "5.3", "5.4", "5.5", "5.6", "5.7", "5.8", "5.9", "5.10", "5.11", "5.12"] },
    { "id": 4, "tasks": ["5.13"] },
    { "id": 5, "tasks": ["7.1"] },
    { "id": 6, "tasks": ["7.2"] },
    { "id": 7, "tasks": ["9.1"] },
    { "id": 8, "tasks": ["9.2", "9.3"] }
  ]
}
```
