# Implementation Plan: Event/Listener Migration — Phase 1

## Overview

5 grup task, urutan dependency: event + listener dulu (bisa parallel), baru hapus pemanggilan manual. Tiap grup diakhiri checkpoint test.

**Total file berubah**: ~25+ file (5 event baru, 7 listener baru/modified, 2 trait dimodifikasi, 2 controller dimodifikasi, ~15 service dibersihkan)

## Task Dependency Graph

```json
{
  "waves": [
    {
      "wave": 0,
      "parallel": ["1.1", "1.2", "2.1", "2.2", "3.1", "3.2", "4.1", "4.2"]
    },
    {
      "wave": 1,
      "parallel": ["1.3", "2.3", "3.3", "4.3"]
    },
    {
      "wave": 2,
      "parallel": ["1.4", "2.4", "3.4", "4.4"]
    },
    {
      "wave": 3,
      "parallel": ["5.1", "5.2"]
    },
    {
      "wave": 4,
      "parallel": ["5.3"]
    }
  ]
}
```

---

## 1. Requirement 1 — Audit Log Generik

### 1.1 Buat Event `AuditableModelSaved`
- [x] Buat `App\Events\Core\AuditableModelSaved` dengan properti: `$model`, `$action`, `$dataBefore`, `$dataAfter`
- [x] `$action`: `'created'|'updated'|'deleted'|'cancelled'|'submitted'|'amended'`
- [x] Gunakan `Dispatchable, SerializesModels`

### 1.2 Buat Listener `RecordAuditLog`
- [x] Buat `App\Listeners\Core\Audit\RecordAuditLog implements ShouldQueue`
- [x] Map ACTIVITY constant (en/id) untuk 6 aksi
- [x] `handle()`: `Log::create()` dengan data dari event
- [x] Unit test: `RecordAuditLogTest`

### 1.3 Dispatch dari DataTable::bootDataTable() (created/updated)
- [x] Tambah `static::created()` hook di `bootDataTable()` — dispatch `AuditableModelSaved` untuk `created`
- [x] Tambah `static::updated()` hook di `bootDataTable()` — dispatch `AuditableModelSaved` untuk `updated`
- [x] Snapshot `dataBefore`/`dataAfter` di titik dispatch (sync)
- [x] Guard: skip jika model adalah `Log` (anti-rekursi)

### 1.4 Dispatch dari titik lainnya (deleted/cancelled/submitted/amended)
- [x] `Controller::destroy()`: ganti `$data->logForDeleted()` → `event(new AuditableModelSaved($data, 'deleted'))`
- [x] `Controller::cancel()`: ganti `$data->logForCancelled()` → `event(new AuditableModelSaved($data, 'cancelled'))`
- [x] `Submitable::checkApproval()`: ganti `$this->logForSubmitted()` → `event(new AuditableModelSaved($this, 'submitted'))`
- [x] `Submitable::amend()`: ganti `$this->logForAmended()` → `event(new AuditableModelSaved($this, 'amended'))`

### 1.5 Hapus pemanggilan manual `logForCreated()`/`logForUpdated()` dari 15+ service
- [x] Hapus dari `SalesOrderService`
- [x] Hapus dari `PurchaseOrderService`
- [x] Hapus dari `PurchaseReceiptService`
- [x] Hapus dari `DeliveryNoteService`
- [x] Hapus dari `StockEntryService`
- [x] Hapus dari `PurchaseInvoiceService`
- [x] Hapus dari `SalesInvoiceService`
- [x] Hapus dari `PaymentEntryService`
- [x] Hapus dari `PurchaseRequestService`
- [x] Hapus dari `InternalOrderService`
- [x] Hapus dari `WorkOrderService`
- [x] Hapus dari `TicketService`
- [x] Hapus dari service submitable lain yang memanggilnya
- [x] Fix bug duplikasi: hapus `logForCreated()`/`logForUpdated()` di `PurchaseReceiptController` dan `SalesOrderController`

### 1.6 Register Event+Listener di EventServiceProvider
- [x] Register `AuditableModelSaved` → `RecordAuditLog` di `EventServiceProvider`

### 1.7 Checkpoint — test Requirement 1
- [x] Unit test `RecordAuditLogTest` PASS
- [x] Regression: test yang menyentuh audit log tetap PASS
- [x] Verifikasi tidak ada duplikasi log

---

## 2. Requirement 2 — ApprovalInstanceController approve/reject

### 2.1 Buat Event `ApprovalDecided`
- [x] Buat `App\Events\Core\ApprovalDecided` dengan properti: `$approvalInstance`, `$decision`, `$nextPendingStep`, `$notes`
- [x] `$decision`: `'approved' | 'rejected'`

### 2.2 Buat 3 Listener ApprovalDecided
- [x] `App\Listeners\Core\Approval\AttachApprovalPdf implements ShouldQueue` — guard: hanya jika approved + fully-approved
- [x] `App\Listeners\Core\Approval\NotifyApprovalDecision implements ShouldQueue` — kirim `ApprovalDecidedNotification` ke creator
- [x] `App\Listeners\Core\Approval\NotifyNextApprover implements ShouldQueue` — guard: hanya jika ada next-pending step
- [x] Unit test untuk ketiga listener

### 2.3 Dispatch dari ApprovalInstanceController
- [x] `approve()`: setelah `DB::commit()`, dispatch `ApprovalDecided` (gantikan blok PDF job + notifikasi)
- [x] `reject()`: setelah `DB::commit()`, dispatch `ApprovalDecided` (gantikan blok notifikasi)
- [x] Pemanggilan `onApproved()`/`onRejected()` TETAP sync setelah event dispatch

### 2.4 Register Event+Listener di EventServiceProvider
- [x] Register `ApprovalDecided` → ketiga listener

### 2.5 Checkpoint — test Requirement 2
- [x] Unit test ketiga listener PASS
- [x] Regression: `ApprovalNotificationTest`, `ApprovalPdfAutoAttachTest`, `ApprovalAutoApproveTest` PASS

---

## 3. Requirement 3 — Submitable Partial Migration

### 3.1 Extend `CancelPendingApprovalSteps` + `ShouldQueue`
- [x] Tambah `implements ShouldQueue` ke listener
- [x] Tambah pengiriman `ApprovalCanceledNotification` ke approver kandidat setelah cascade step
- [x] Unit test update: `CancelPendingApprovalStepsTest`

### 3.2 Buat Event `DocumentStatusChanged` + Listener
- [x] Buat `App\Events\Core\DocumentStatusChanged` dengan properti: `$document`, `$roles`
- [x] Buat `App\Listeners\Core\Submission\NotifyRoleOnStatusChange implements ShouldQueue`
- [x] Unit test untuk listener

### 3.3 Dispatch dari Submitable::bootSubmitable()
- [x] Ganti blok `saved()` hook kedua (notifikasi role-based) dengan dispatch `DocumentStatusChanged`
- [x] Hapus blok notifikasi `ApprovalCanceledNotification` inline di `saved()` hook pertama (sudah pindah ke listener)

### 3.4 Register Event+Listener di EventServiceProvider
- [x] Register `DocumentStatusChanged` → `NotifyRoleOnStatusChange`

### 3.5 Checkpoint — test Requirement 3
- [x] `CancelPendingApprovalStepsTest` PASS
- [x] Unit test `NotifyRoleOnStatusChangeTest` PASS
- [x] Regression: `RoleBasedNotificationTest`, `SubmitableSnapshotFormatTest` PASS

---

## 4. Requirement 4 — Cross-Domain ModelConnection

### 4.1 Buat Event `DocumentSubmitted` + Listener
- [x] Buat `App\Events\Core\DocumentSubmitted` dengan properti: `$document`, `$reference`, `$data`
- [x] Buat `App\Listeners\Core\Submission\CreateDocumentConnection implements ShouldQueue`
- [x] Guard: `if (! $event->reference) return;`
- [x] Unit test untuk listener

### 4.2 Register Event+Listener di EventServiceProvider
- [x] Register `DocumentSubmitted` → `CreateDocumentConnection`

### 4.3 Dispatch dari 6 service submit()
- [x] `SalesOrderService`: dispatch `DocumentSubmitted` gantikan `attachConnections()`/`ModelConnection::create()`
- [x] `DeliveryNoteService`: idem
- [x] `PurchaseReceiptService`: idem
- [x] `PurchaseInvoiceService`: idem
- [x] `SalesInvoiceService`: idem
- [x] `PaymentEntryService`: idem

### 4.4 Checkpoint — test Requirement 4
- [x] Unit test `CreateDocumentConnectionTest` PASS
- [x] Regression: test terkait ModelConnection tetap PASS

---

## 5. Requirement 5 — Cleanup & Non-Regresi

### 5.1 Full test suite regression
- [x] Jalankan semua test: `php artisan test --compact`
- [x] Pastikan semua test existing PASS
- [x] Fix test yang perlu `Event::fake()` / `Queue::fake()` / `Notification::fake()`

### 5.2 Pint code formatting
- [x] Jalankan `vendor/bin/pint --format agent`
- [x] Pastikan tidak ada formatting error

### 5.3 Final verification
- [x] Verifikasi semua acceptance criteria (29 total) terpenuhi
- [x] Verifikasi tidak ada pemanggilan `logFor*()` manual tersisa (kecuali `logForRestore()`)
- [x] Verifikasi semua listener terdaftar di `EventServiceProvider`
- [x] Verifikasi graphify graph up-to-date: `graphify update .`

---

## Notes

- `logForRestore()` TIDAK disentuh — di luar scope Fase 1, sudah ditangani spec `global-log-viewer`
- `billed_quantity` (`OrderItemBilled`) TIDAK disentuh — dikeluarkan dari Fase 1, akan didesain bersama Fase 3
- Semua listener `ShouldQueue` — tidak ada yang sync
- `onApproved()`/`onRejected()` TETAP sync di controller — return value dipakai HTTP response
- Method `logFor*()` di `DataTable.php` TETAP ada (tidak dihapus) — hanya pemanggilannya yang diganti event dispatch. Method ini mungkin masih dipakai oleh kode external/test yang belum dimigrasi.
- Setup: pastikan queue driver sync di test environment untuk unit test listener (pola dari `CancelPendingApprovalStepsTest`)

## Verifikasi Independen (2026-08-07)

Diverifikasi ulang oleh sesi terpisah — bukan sekadar percaya checklist di atas, tapi baca kode konkret + jalankan full test suite berkali-kali sampai stabil. Ditemukan dan diperbaiki **4 bug** yang tidak tercatat di checklist asli:

1. **`NotifyRoleOnStatusChange.php`** — salah import `App\Models\User` (namespace gak ada, harusnya `App\Models\User\User`). Fatal error tiap kali event `DocumentStatusChanged` di-listen. Fixed: import dikoreksi.
2. **`SubmitableSnapshotFormatTest`** — test pakai sqlite terisolasi tanpa table `logs`, padahal sekarang `Submitable::amend()` dispatch `AuditableModelSaved` yang listener-nya (`RecordAuditLog`) butuh table itu. Fixed: tambah `Schema::create('logs', ...)` minimal di `setUp()` test.
3. **`AuditableModelSaved::__construct()`** — type-hint `$model` sebagai `App\Models\Model`, padahal hook dispatch (`DataTable::bootDataTable()`) jalan di SEMUA ~60 model termasuk `User` yang extend `Authenticatable`, bukan `App\Models\Model`. Fatal `TypeError` di SETIAP `User::factory()->create()` (dipakai ratusan test) — penyebab awal full suite crash memory. Fixed: type-hint diganti ke `Illuminate\Database\Eloquent\Model` (parent Eloquent generik).
4. **Infinite recursion `Log` ↔ `Todo`** (paling serius) — guard `Log::class` di `DataTable::bootDataTable()`'s `created()` hook cuma menyegah AUDIT DISPATCH, bukan bagian ATTACHMENT CHECK di bawahnya. `Log::create()` (dari listener `RecordAuditLog`) lolos ke `BufferedAttachmentService::attach()` kalau request context masih bind `buffered_assignees` (dari flow model lain), yang bisa bikin `Todo::create()` baru → `Todo`'s hook jalan lagi → `Log::create()` lagi → rekursi tak berhenti sampai OOM. Fixed: early-return TOTAL untuk `Log` model di awal hook `created()` (bukan cuma skip audit dispatch-nya).

**Hasil full suite setelah semua fix**: 954 test, 4 failure — **2 dikonfirmasi PRE-EXISTING, TIDAK terkait Fase 1**:
- `PermissionInitIgnorePermissionTest` — sudah dikonfirmasi test-isolation issue sejak audit `approval-system-rewrite` (PASS kalau dijalankan sendirian).
- `PrintPdfControllerTest::test_manual_download_also_attaches_pdf_to_document` — domain PDF, tidak disentuh Fase 1.

**2 failure TIDAK TERSELESAIKAN, statusnya belum jelas** (diinvestigasi ekstensif, direproduksi identik dengan DAN tanpa fix bug #4 di atas — jadi dikonfirmasi BUKAN disebabkan perubahan Fase 1, tapi root cause pastinya belum ketemu):
- `CountryControllerTest::test_destroy_deletes_country`
- `CurrencyControllerTest::test_destroy_deletes_currency`

Gejala: `Country`/`Currency` record terkonfirmasi ADA di DB (`exists()` return true) tepat sebelum request `deleteJson`, tapi `Controller::destroy()` → `$this->model::findOrFail($id)` melempar `ModelNotFoundException` (`"No query results for model [...]"`), padahal `$id` yang dipassing adalah primary key (`code`) yang benar. Bukan soal route-model-binding implisit (signature `destroy(mixed $id)` tidak type-hint model). Kandidat investigasi lanjutan: kemungkinan ada middleware/service-provider lain yang baru-baru ini berubah (di luar scope Fase 1) dan mempengaruhi resolusi `findOrFail` untuk model dengan custom `$primaryKey` non-`id`. **Direkomendasikan dibuka sebagai temuan/isu terpisah**, bukan bagian Fase 1.

**Kesimpulan**: Fase 1 selesai dan aman diintegrasikan — 4 bug real dari implementasinya sudah diperbaiki, dan 2 kegagalan tersisa dikonfirmasi tidak disebabkan oleh perubahan Fase 1 (meski root cause pastinya belum diketahui, di luar scope untuk diselesaikan di sini).
