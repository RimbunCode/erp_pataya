# Requirements Document

## Introduction

Business logic di aplikasi ini saat ini banyak menumpuk side-effect (notifikasi, audit log, job dispatch, mutasi cross-domain kecil) langsung di dalam Controller, Service, dan Model boot hook. Pola ini menyulitkan maintenance — logic yang sama (audit log) diduplikasi di 15+ file, dan perubahan pada satu side-effect berisiko menyentuh core logic yang tidak terkait.

Migrasi ini memindahkan side-effect tersebut ke pola Event/Listener Laravel, mengikuti precedent yang sudah ada di `App\Events\Core\DocumentCanceled` + `App\Listeners\Core\Approval\CancelPendingApprovalSteps` (didispatch dari `Submitable::bootSubmitable()`). Migrasi tersebut sendiri baru **partial** — dua blok notifikasi di trait yang sama masih inline, jadi salah satu tujuan fase ini adalah menyelesaikannya.

Ini adalah **Fase 1** dari rencana migrasi 3 fase (lihat memory `project_event_listener_migration_phases.md` untuk fase 2 dan 3). Fase 1 mencakup kandidat dengan effort kecil–sedang yang tidak terikat pada transaksi database yang harus commit bersamaan — semua listener di fase ini aman dijalankan sebagai queued job (`ShouldQueue`), karena murni reaktif (notifikasi, log, job dispatch) tanpa dependency balik ke core write.

**Motivasi**: scalability (hilangkan duplikasi 15+ file), maintainability (satu listener satu tanggung jawab), dan kesiapan migrasi ke microservice ke depan (listener `ShouldQueue` adalah titik natural untuk diganti dari queue worker in-process ke message broker tanpa mengubah kontrak event).

## Glossary

- **Side-effect**: aksi reaktif yang terjadi sebagai respons terhadap suatu state change (mis. dokumen disubmit, status berubah), bukan bagian dari core write data itu sendiri.
- **Event**: kelas yang merepresentasikan "sesuatu telah terjadi" (`Illuminate\Foundation\Events\Dispatchable`), didispatch via `event()` atau `Model::dispatchesEvents`.
- **Listener**: kelas yang bereaksi terhadap satu Event, berisi satu side-effect.
- **ShouldQueue**: interface Laravel yang membuat listener dijalankan async lewat queue worker, bukan sync di request thread yang sama.
- **Submitable**: trait (`App\Traits\Submitable`) yang dipakai model dokumen (SalesOrder, PurchaseOrder, dll — ~13 model) untuk lifecycle status (draft/submitted/canceled).
- **DataTable**: trait (`App\Traits\DataTable`) yang dipakai hampir seluruh model (~60 model, termasuk yang non-submitable seperti User, Customer, Item, Role) untuk fungsi tabel data + audit log (`logFor*()`). `Submitable` selalu memakai `DataTable`, tapi tidak sebaliknya — audit log created/updated harus bekerja untuk SEMUA model `DataTable`, bukan hanya yang `Submitable`.
- **Cross-domain mutation**: satu domain (mis. Finances) langsung menulis ke model milik domain lain (mis. Sales) tanpa lewat event.

## Requirements

### Requirement 1: Audit log generik via Event/Listener

**User Story:** As a developer, I want seluruh audit log (`logForCreated`, `logForUpdated`, `logForDeleted`, `logForCancelled`, `logForSubmitted`, `logForAmended`) terpicu otomatis lewat event, so that saya tidak perlu memanggilnya manual di setiap service/controller dan tidak ada risiko duplikasi atau lupa panggil.

Catatan scope: `logForRestore()` TIDAK termasuk — sudah ditangani spec `global-log-viewer` (selesai) dan hanya dipanggil dari test saat ini, bukan alur produksi aktif.

#### Acceptance Criteria

1. WHEN model apapun yang memakai trait `DataTable` (bukan hanya model `Submitable`) berhasil dibuat (`created`), THE sistem SHALL mencatat audit log yang setara dengan `logForCreated()` saat ini, tanpa dipanggil manual dari Service/Controller.
2. WHEN model apapun yang memakai trait `DataTable` berhasil diperbarui (`updated`) dengan perubahan yang tercatat, THE sistem SHALL mencatat audit log yang setara dengan `logForUpdated()` saat ini, tanpa dipanggil manual dari Service/Controller.
3. WHEN model dihapus lewat `Controller::destroy()`, WHEN model dibatalkan lewat `Controller::cancel()`, WHEN dokumen disubmit lewat `Submitable::checkApproval()` (method ini pindah dari `ApprovalInstanceController` ke `Submitable` melalui spec prasyarat `approval-system-rewrite`), DAN WHEN dokumen di-amend lewat `Submitable::amend()`, THE sistem SHALL mencatat audit log yang setara dengan `logForDeleted()`, `logForCancelled()`, `logForSubmitted()`, dan `logForAmended()` masing-masing, tanpa dipanggil manual dari titik-titik tersebut. (Catatan: `cancelled`/`submitted`/`amended` secara alami hanya terjadi pada model `Submitable`, karena hanya model tersebut punya lifecycle status/approval — tapi `deleted` via `Controller::destroy()` berlaku untuk model manapun yang route-nya lewat base controller ini, submitable atau tidak.)
4. THE seluruh listener audit log (untuk aksi created, updated, deleted, cancelled, submitted, amended) SHALL diimplementasikan sebagai `ShouldQueue`.
5. WHERE `PurchaseReceiptController` dan `SalesOrderController` saat ini memanggil `logForCreated`/`logForUpdated` secara manual SETELAH Service juga memanggilnya (duplikasi log), THE migrasi SHALL menghilangkan panggilan manual di Controller tersebut sehingga log hanya tercatat sekali.
6. WHEN listener audit log dijalankan untuk aksi apapun, THE sistem SHALL menghasilkan isi log yang setara dengan implementasi method `logFor*()` terkait di `app/Traits/DataTable.php` saat ini — tidak ada regresi format atau isi data, termasuk untuk aksi `created`/`updated` yang menyertakan `data_before`/`data_after` maupun aksi `deleted`/`cancelled`/`submitted`/`amended` yang hanya menyertakan `activity` tanpa before/after data.
7. THE migrasi SHALL menghapus seluruh pemanggilan manual `logForCreated()`/`logForUpdated()` dari 15+ service yang teridentifikasi saat audit (SalesOrderService, PurchaseOrderService, PurchaseReceiptService, DeliveryNoteService, StockEntryService, PurchaseInvoiceService, SalesInvoiceService, PaymentEntryService, PurchaseRequestService, InternalOrderService, WorkOrderService, TicketService, dan service submitable lain yang memanggilnya), serta pemanggilan manual `logForDeleted()`/`logForCancelled()`/`logForSubmitted()`/`logForAmended()` dari `Controller.php` (base `destroy()`/`cancel()`), `Submitable::checkApproval()`, dan `Submitable::amend()`.

### Requirement 2: ApprovalInstanceController approve/reject via Event

**User Story:** As a developer, I want proses setelah keputusan approval (approve/reject) — job dispatch PDF dan notifikasi — dipicu lewat event, so that logic decision-making di controller terpisah dari efek sampingnya.

#### Acceptance Criteria

1. WHEN `ApprovalInstanceController::approve()` berhasil commit transaksi database, THE sistem SHALL dispatch event `ApprovalDecided` dengan payload approval instance dan keputusan (`approved`).
2. WHEN `ApprovalInstanceController::reject()` berhasil commit transaksi database, THE sistem SHALL dispatch event `ApprovalDecided` dengan payload approval instance dan keputusan (`rejected`).
3. WHEN event `ApprovalDecided` dengan keputusan `approved` diterima DAN approval instance sudah fully-approved (tidak ada step pending berikutnya), THE listener SHALL dispatch `AttachGeneratedPdfJob` yang setara dengan perilaku saat ini.
4. WHEN event `ApprovalDecided` diterima, THE listener SHALL mengirim `ApprovalDecidedNotification` ke pembuat dokumen (creator), berisi hasil keputusan (approved/rejected), setara dengan perilaku saat ini.
5. WHEN event `ApprovalDecided` dengan keputusan `approved` diterima DAN masih ada step approval berikutnya (`next pending`), THE listener SHALL mengirim `ApprovalPendingNotification` ke kandidat approver step berikutnya, setara dengan perilaku saat ini.
6. THE listener-listener untuk event `ApprovalDecided` SHALL diimplementasikan sebagai `ShouldQueue`.
7. THE migrasi SHALL menghapus pemanggilan langsung `AttachGeneratedPdfJob::dispatch()` dan `NotifyUser->send()` dari method `approve()`/`reject()` di `ApprovalInstanceController`, menggantinya dengan `event(new ApprovalDecided(...))`.
8. THE pemanggilan `$service->onApproved($document)`/`$service->onRejected($document)` (resolusi lewat `$document::$service`, hasil dari spec prasyarat `approval-system-rewrite`) SHALL TETAP sebagai pemanggilan method langsung setelah event `ApprovalDecided` di-dispatch — TIDAK dipindah ke Event/Listener, karena return value method tersebut dipakai sebagai response HTTP dan Laravel tidak menyediakan mekanisme resmi untuk mengambil return value dari listener.

### Requirement 3: Penyelesaian migrasi partial Submitable

**User Story:** As a developer, I want dua blok notifikasi yang masih inline di `Submitable::bootSubmitable()` dipindah ke listener, so that trait ini konsisten menggunakan pola event/listener yang sudah dimulai untuk `DocumentCanceled`.

#### Acceptance Criteria

1. WHEN event `DocumentCanceled` didispatch (perilaku dispatch tidak berubah — tetap di `bootSubmitable()` saat status berubah menjadi CANCELED), THE sistem SHALL mengirim `ApprovalCanceledNotification` ke kandidat approver dari step yang masih PENDING/WAITING via listener, BUKAN inline di trait.
2. THE notifikasi `ApprovalCanceledNotification` SHALL dipindahkan ke listener `CancelPendingApprovalSteps` yang sudah ada (menambahkan tanggung jawab notifikasi ke listener ini) ATAU listener baru terpisah yang di-attach ke event `DocumentCanceled` yang sama — pilihan final ditentukan saat design berdasarkan prinsip satu listener satu tanggung jawab.
3. WHEN model submitable berubah status DAN `notifyRolesOnStatus()` mengembalikan konfigurasi role untuk status tersebut, THE sistem SHALL dispatch event baru (`DocumentStatusChanged` atau nama setara) dari `bootSubmitable()`.
4. WHEN event dari kriteria 3.3 diterima, THE listener SHALL mengirim `DocumentSubmittedNotification` ke user dengan role yang dikonfigurasi, setara dengan perilaku saat ini.
5. THE listener-listener baru pada Requirement ini SHALL diimplementasikan sebagai `ShouldQueue`.
6. THE migrasi SHALL menghapus kedua blok `self::saved(function ($model) { ... })` yang berisi pemanggilan notifikasi inline di `Submitable::bootSubmitable()` (baris ~113-172 pada kondisi saat ini), menggantinya dengan dispatch event.
7. THE cascade update status step (`ApprovalInstanceStep` ke CANCELED) yang sudah ditangani `CancelPendingApprovalSteps` SHALL tetap berjalan tanpa perubahan perilaku.

### Requirement 4: Cross-domain mutation kecil via Event

**User Story:** As a developer, I want ModelConnection submit tracking dipicu lewat event, so that Service satu domain tidak perlu tahu detail mutasi domain lain secara langsung.

> **Catatan scope**: kriteria `billed_quantity` (`SalesInvoiceService`/`PurchaseInvoiceService::onApproved()`) DIKELUARKAN dari Fase 1. Method `onApproved()` pada kedua service ini adalah method yang sama yang tercatat sebagai kandidat Fase 3 (transaction-entangled dengan GL posting) di memory `project_event_listener_migration_phases.md` — memisah `billed_quantity`-nya saja ke Fase 1 akan memecah satu unit transaksi yang seharusnya didesain ulang sekaligus. `billed_quantity` akan dibahas bersama seluruh isi `onApproved()` tersebut saat Fase 3.

#### Acceptance Criteria

1. WHEN dokumen submitable (SalesOrder, DeliveryNote, PurchaseReceipt, PurchaseInvoice, SalesInvoice, PaymentEntry) berhasil disubmit, THE sistem SHALL tetap membuat `ModelConnection` cross-reference yang setara dengan perilaku saat ini, namun logic pembuatan `ModelConnection` SHALL dikonsolidasikan menjadi satu listener generik yang bereaksi terhadap event submit, menggantikan pemanggilan `ModelConnection::create()` yang saat ini berulang di 6+ tempat.
2. THE listener pada Requirement ini SHALL diimplementasikan sebagai `ShouldQueue`.

### Requirement 5: Struktur kode dan non-regresi

**User Story:** As a developer, I want event dan listener baru mengikuti konvensi struktur folder proyek dan tidak meregresi test yang ada, so that migrasi ini aman diintegrasikan dan mudah dirawat ke depan.

#### Acceptance Criteria

1. THE event baru SHALL ditempatkan di `App\Events\{Domain}\` sesuai domain pemicu (mis. `App\Events\Core\ApprovalDecided`).
2. THE listener baru SHALL ditempatkan di `App\Listeners\{Domain}\{Feature}\` mengikuti konvensi nested-folder proyek (nested karena domain approval/submission diprediksi bertambah listener terkait ke depan).
3. THE migrasi SHALL menyertakan unit test untuk setiap listener baru yang memverifikasi side-effect-nya secara terisolasi (event di-fake, listener dipanggil langsung, atau `Event::fake()` + assert dispatched).
4. THE migrasi SHALL memastikan seluruh feature test yang ada terkait approval, submit, cancel, dan notifikasi (mis. `ApprovalNotificationTest`, `ApprovalPdfAutoAttachTest`, `ApprovalAutoApproveTest`, test terkait `SubmitableSnapshotFormatTest`) tetap PASS tanpa modifikasi assertion perilaku (modifikasi mekanisme testing seperti `Event::fake()` diperbolehkan bila diperlukan).
5. WHERE test menguji efek langsung dari pemanggilan sync (mis. assert notifikasi terkirim segera setelah request), THE migrasi SHALL menyesuaikan test menggunakan `Queue::fake()`/`Event::fake()`/`Notification::fake()` sesuai kebutuhan, TANPA mengubah ekspektasi bisnis yang diuji.
