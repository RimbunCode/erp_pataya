# Requirements Document

## Introduction

Sistem approval saat ini menggunakan string-based dynamic dispatch (`app()->call("$controller@method")`) di dua titik: `Submitable::checkApproval()` memanggil balik `ApprovalInstanceController::checkApproval()`, dan `ApprovalInstanceController::callDocumentCallback()` memanggil balik method `onApproved()`/`onRejected()` di **Controller** dokumen (mis. `SalesOrderController::onApproved()`) berdasarkan nama class yang disimpan sebagai string di `ApprovalInstance->options['controller']`.

Pola ini bukan Laravel idiomatic: controller memanggil controller lain sebagai business logic layer, resolusi method berbasis string (bukan type-safe), dan `checkApproval()` bergantung pada `Route::getCurrentRoute()` untuk menyimpan konteks pemanggil — business logic yang bergantung pada HTTP route saat ini.

Migrasi ini menggantikan pola tersebut dengan resolusi eksplisit lewat property Model dan kontrak interface, tanpa mengubah perilaku fungsional approval workflow (urutan step, kondisi fully-approved/rejected, dsb).

**Ini adalah prasyarat untuk spec `event-listener-migration-phase-1`** (khususnya Requirement 2 — `ApprovalInstanceController::approve()`/`reject()`) — spec tersebut sudah didesain (`requirements.md`/`design.md` tersimpan) tapi **ditunda** sampai rewrite ini selesai, supaya Requirement 2 didesain mengikuti struktur approval yang baru, bukan struktur lama yang akan dibuang.

## Glossary

- **`checkApproval()`**: method di `Submitable` yang memulai proses approval — dipanggil dari 12 Service dokumen setelah `submit()`. Mengevaluasi apakah ada `ApprovalScheme` aktif; jika tidak ada, langsung dianggap fully-approved.
- **`callDocumentCallback()`**: method di `ApprovalInstanceController` yang memanggil balik `onApproved()`/`onRejected()` pada Controller dokumen setelah keputusan approval final.
- **`SubmitableService`**: interface baru — kontrak method yang harus dimiliki Service dokumen submitable (`submit`, `cancel`, `amend`, `onApproved`, `onRejected`), extends `CrudService`.
- **`CrudService`**: interface baru — kontrak dasar (`create`, `update`, `delete`) yang secara konseptual berlaku untuk semua Service yang punya operasi CRUD, tidak terbatas pada Service submitable.
- **`$service`**: property `protected static string $service` yang dideklarasikan di Model dokumen submitable, berisi FQCN Service yang menangani model tersebut (mis. `SalesOrder::$service = SalesOrderService::class`).
- **12 Service dokumen submitable**: Service yang saat ini memanggil `checkApproval()` (diverifikasi lewat grep `checkApproval(` di `app/Services/`) — `SalesOrderService`, `PurchaseOrderService`, `PurchaseRequestService`, `PurchaseReceiptService`, `PurchaseInvoiceService`, `SalesInvoiceService`, `PaymentEntryService`, `DeliveryNoteService`, `StockEntryService`, `InternalOrderService`, `WorkOrderService`, `QuotationService`.

## Requirements

### Requirement 1: Interface kontrak Service

**User Story:** As a developer, I want kontrak method standar untuk Service (CRUD dasar, dan tambahan untuk Service dokumen submitable), so that setiap Service dokumen punya bentuk yang predictable dan bisa diverifikasi lewat static analysis, bukan duck-typing/method_exists check.

#### Acceptance Criteria

1. THE sistem SHALL menyediakan interface `App\Contracts\CrudService` dengan method `create(array $data): Model`, `update(Model $model, array $data): Model`, dan `delete(Model $model): void`.
2. THE sistem SHALL menyediakan interface `App\Contracts\SubmitableService extends CrudService` dengan tambahan method `submit(Model $model): mixed`, `cancel(Model $model): mixed`, `amend(Model $model): mixed`, `onApproved(Model $model): mixed`, dan `onRejected(Model $model): mixed`.
3. THE sistem SHALL menyediakan default implementation untuk `delete()` (setara `$model->delete()`) dalam bentuk trait yang dapat dipakai Service manapun, sehingga Service yang tidak butuh logic delete khusus tidak perlu menulis ulang method ini.
4. WHERE 12 Service dokumen submitable teridentifikasi (lihat Glossary) saat ini TIDAK implement interface apapun untuk method `create`/`update`/`submit`/`cancel`/`amend`/`onApproved`/`onRejected`, THE migrasi SHALL membuat seluruh 12 Service tersebut implement `SubmitableService`, menyesuaikan signature method existing agar sesuai kontrak (tanpa mengubah isi/logic method).
5. THE migrasi TIDAK mencakup Service non-submitable (mis. `CustomerService`, `ItemServices`, `DashboardService`) — interface `CrudService` didesain agar Service tersebut BISA mengadopsinya di masa depan, tapi implementasi/migrasi Service tersebut di luar scope spec ini.

### Requirement 2: Resolusi Service dokumen eksplisit

**User Story:** As a developer, I want Model dokumen submitable mendeklarasikan Service-nya secara eksplisit, so that resolusi Service tidak lagi bergantung pada string nama Controller yang disimpan di database atau konvensi penamaan yang bisa meleset.

#### Acceptance Criteria

1. THE 12 Model dokumen submitable yang berkorespondensi dengan 12 Service pada Requirement 1.4 SHALL mendeklarasikan property `protected static string $service` yang berisi FQCN Service masing-masing.
2. THE property `$service` SHALL TIDAK dideklarasikan di trait `Submitable` (karena PHP tidak mengizinkan override property static trait secara langsung di class yang memakainya) — setiap Model mendeklarasikan property ini secara independen.
3. IF suatu Model memanggil `checkApproval()` TANPA mendeklarasikan property `$service`, THEN THE sistem SHALL melempar `\LogicException` dengan pesan yang menyebutkan nama Model dan kebutuhan mendeklarasikan `$service`, dilempar pada saat `checkApproval()` dipanggil (fail-fast, bukan silent failure).
4. IF `$service` dideklarasikan tapi class yang dirujuk TIDAK implement `SubmitableService`, THEN THE sistem SHALL melempar `\LogicException` yang menyebutkan class tersebut tidak memenuhi kontrak, sebelum method apapun pada Service tersebut dipanggil.

### Requirement 3: ApprovalService generik menggantikan string dispatch

**User Story:** As a developer, I want proses evaluasi approval (`checkApproval`) ditangani oleh Service generik yang di-resolve lewat dependency injection biasa, so that tidak ada lagi pemanggilan `app()->call()` berbasis string maupun ketergantungan pada `Route::getCurrentRoute()`.

#### Acceptance Criteria

1. THE sistem SHALL menyediakan `App\Services\Core\Approval\ApprovalService` dengan method yang menerima Model dokumen dan mengembalikan hasil evaluasi approval (fully-approved → panggil `onApproved()`, rejected → panggil `onRejected()`, masih pending → update status `NEED_APPROVAL`).
2. WHEN `Submitable::checkApproval()` dipanggil, THE method tersebut SHALL memanggil `ApprovalService` lewat resolusi container (`app(ApprovalService::class)`), BUKAN `app()->call("$controller@method")`.
3. THE `checkApproval()` SHALL TIDAK lagi bergantung pada `Route::getCurrentRoute()` untuk menentukan controller/parameter pemanggil.
4. WHEN `ApprovalInstance` dibuat oleh alur baru, THE sistem SHALL TIDAK lagi menyimpan `controller`/`parameters` ke `ApprovalInstance->options` sebagai mekanisme resolusi (resolusi memakai `document::$service` lewat relasi `document` yang sudah ada).
5. THE kolom/field `options` pada `ApprovalInstance` SHALL TETAP ada di skema (tidak di-drop) untuk kompatibilitas data lama — data lama pada field ini menjadi tidak terpakai (dead data) dan TIDAK memerlukan migration data.

### Requirement 4: Resolusi onApproved/onRejected tanpa Controller callback

**User Story:** As a developer, I want `onApproved()`/`onRejected()` dipanggil langsung pada Service dokumen, so that Controller dokumen tidak lagi berperan sebagai business logic layer yang dipanggil balik oleh Controller lain.

#### Acceptance Criteria

1. WHEN `ApprovalInstanceController::approve()` mencapai kondisi fully-approved (setelah `DB::commit()`), THE sistem SHALL me-resolve Service lewat `$approval->document::$service` dan memanggil `onApproved($document)` secara langsung (pemanggilan method biasa, BUKAN lewat `event()`/listener), menggunakan return value method tersebut sebagai bagian dari response HTTP, setara dengan perilaku `callDocumentCallback()` saat ini.
2. WHEN `ApprovalInstanceController::reject()` mencapai kondisi rejected, THE sistem SHALL melakukan hal yang setara untuk `onRejected($document)`.
3. THE pemanggilan `onApproved()`/`onRejected()` SHALL TETAP sinkron (direct method call) karena return value-nya dipakai langsung untuk response HTTP — TIDAK dipindah ke pola Event/Listener, karena `event()` di Laravel tidak menyediakan mekanisme resmi untuk mengambil return value dari listener.
4. IF `onApproved()`/`onRejected()` melempar exception, THEN THE exception SHALL propagate apa adanya ke pemanggil (tidak ditangkap/di-suppress oleh `ApprovalService` atau `ApprovalInstanceController`) — perilaku ini setara dengan kondisi saat ini, dan `ApprovalInstance`/`ApprovalInstanceStep` yang sudah di-commit sebelumnya TETAP tersimpan sebagai APPROVED/REJECTED meskipun efek samping (`onApproved`) gagal.
5. THE Controller dokumen (mis. `SalesOrderController`) SHALL TIDAK LAGI diwajibkan memiliki method `onApproved()`/`onRejected()` — method tersebut sepenuhnya pindah ke Service.

### Requirement 5: Non-regresi dan verifikasi kontrak

**User Story:** As a developer, I want migrasi ini tidak mengubah perilaku approval yang sudah ada dan memberi jaminan bahwa seluruh Service submitable memenuhi kontrak barunya, so that migrasi ini aman diintegrasikan dan tidak diam-diam drift di kemudian hari.

#### Acceptance Criteria

1. THE migrasi SHALL memastikan seluruh feature test approval yang ada (`ApprovalNotificationTest`, `ApprovalPdfAutoAttachTest`, `ApprovalAutoApproveTest`, `CancelPendingApprovalStepsTest`, dan test submit/approve/reject per-modul dokumen) tetap PASS tanpa mengubah assertion perilaku bisnis.
2. THE migrasi SHALL menyertakan test kontrak (contract test) yang memverifikasi seluruh 12 Service dokumen submitable benar-benar implement interface `SubmitableService`.
3. THE migrasi SHALL menyertakan test yang memverifikasi `\LogicException` dilempar sesuai Requirement 2.3 dan 2.4 pada kondisi yang sesuai.
4. THE migrasi SHALL menyertakan test yang memverifikasi response HTTP `approve()`/`reject()` tetap mengarah ke tujuan yang sama (redirect/response) seperti sebelum migrasi, untuk minimal satu dokumen yang `onApproved()`-nya membuat resource baru (mis. alur yang menghasilkan dokumen turunan).
