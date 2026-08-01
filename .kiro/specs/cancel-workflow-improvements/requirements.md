# Requirements Document

## Introduction

Alur cancel dokumen submitable (SalesOrder, PurchaseOrder, DeliveryNote, dll — semua model yang memakai trait `Submitable`) saat ini punya beberapa gap:

1. Tidak ada mekanisme dinamis untuk menentukan kapan sebuah dokumen boleh dibatalkan (`cancel`) — beda dengan pola `canDelete` yang sudah ada dan bisa di-override per-model.
2. `{Model}Service::cancel()` mengubah status dokumen menjadi `CANCELED` dan rollback data terkait (mis. reservasi stok), tapi tidak pernah menyentuh `ApprovalInstanceStep` yang masih berstatus `PENDING`/`WAITING` — step tersebut nyangkut selamanya walau dokumen induknya sudah dibatalkan (lihat [[project_cascade_cancel_approval_gap]]).
3. Tiap `{Model}Controller::cancel()` mengulang pola delegasi manual ke Service tanpa kontrak/guard yang seragam.

Spec ini merapikan seluruh alur cancel: siapa yang boleh melihat/memicu cancel, kapan diizinkan, apa yang terjadi secara otomatis (cascade ke approval), dan bagaimana kontrak Controller↔Service distandardisasi.

## Glossary

- **Submitable**: trait (`App\Traits\Submitable`) yang dipakai model dokumen transaksional (SalesOrder, PurchaseOrder, DeliveryNote, SalesInvoice, dll). Menyediakan lifecycle status (`DRAFT`, `NEED_APPROVAL`, `APPROVED`, `CANCELED`, dst) dan relasi `approvalable` ke `ApprovalInstance`.
- **ApprovalInstance / ApprovalInstanceStep**: record approval workflow yang dibuat saat dokumen submit dan butuh persetujuan berjenjang. Tiap step punya status sendiri (`WAITING`, `PENDING`, `APPROVED`, `REJECTED`, `SKIPPED`, dan setelah spec ini: `CANCELED`).
- **canCancel**: computed attribute baru (pola sama seperti `canDelete` di `LinkModel.php`) yang menentukan apakah tombol/aksi cancel boleh dijalankan pada instance dokumen tertentu.
- **DocumentCanceled**: event Laravel baru (`App\Events\Core\DocumentCanceled`) yang di-dispatch setelah dokumen submitable berhasil berubah status menjadi `CANCELED`.
- **Struktur folder Event/Listener `{Domain}/{Feature}`**: keputusan user, berlaku lintas layer app (bukan cuma Event/Listener — lihat `CLAUDE.md` project). Domain konsisten dengan `app/Services/{Domain}/`, `app/Models/{Domain}/`: `Core`, `Sales`, `Purchase`, `Inventory`, `Finances`, `Service`, `Helpdesk`, `User`. Folder `{Feature}` nested dipicu JUMLAH FILE saling terkait untuk satu fitur (nyata >1 file, ATAU 1 file yang diprediksi akan tumbuh menampung file pendamping ke depan) — BUKAN sekadar "file ini spesifik ke satu fitur atau tidak". Fitur yang hanya butuh 1 file, walau spesifik, tetap flat `{Domain}/` tanpa nested.

## Requirements

### Requirement 1: Cancel hanya berlaku untuk model Submitable

**User Story:** As a developer, I want mekanisme cancel (permission, computed attribute, route) hanya aktif untuk model yang memakai trait Submitable, so that model non-transaksional tidak punya kontrak cancel yang tidak relevan.

#### Acceptance Criteria

1. THE `canCancel` computed attribute SHALL didefinisikan di trait `Submitable`, bukan di base `Model` atau `LinkModel`.
2. THE sistem SHALL tidak mendaftarkan route/permission `cancel` untuk model yang tidak memakai trait `Submitable`.
3. WHEN model memakai `Submitable` tapi tidak mengimplementasikan method `canCancel()` custom, THE sistem SHALL menggunakan baseline default (lihat Requirement 3).

### Requirement 2: Tombol cancel hanya muncul jika user punya permission DAN canCancel bernilai true

**User Story:** As a user, I want tombol Cancel hanya muncul jika saya punya permission `cancel` DAN dokumennya memang boleh dibatalkan, so that saya tidak melihat aksi yang akan ditolak backend atau tidak relevan secara bisnis.

#### Acceptance Criteria

1. THE backend SHALL tetap melakukan enforcement permission `cancel` di `Controller.php` (sudah ada — `abort(403)` bila `modelPermissions['cancel']` tidak ada). Requirement ini TIDAK mengubah guard tersebut.
2. VERIFIED: tombol Cancel di `resources/js/Pages/Core/FormPage.jsx` (baris ±1154-1158) SUDAH memakai helper `can("cancel", ...)` untuk cek permission — infrastruktur permission frontend SUDAH ADA dan TIDAK perlu dibuat baru.
3. GAP (lama): kondisi render tombol Cancel SEBELUM spec ini adalah `!isCompletedStatus(defaultData?.status) && can("cancel", ...)` — BELUM membaca computed attribute `canCancel` (Requirement 3) sama sekali. Bandingkan dengan tombol Delete (baris ±1095) yang eksplisit mengecek `defaultData?.canDelete &&`.
4. THE kondisi render tombol Cancel SHALL diubah menjadi `defaultData?.canCancel && can("cancel", ...)` — helper `isCompletedStatus(...)` DIHAPUS dari kondisi ini (bukan ditambah di sampingnya). Alasan: `canCancel` (Requirement 3) sudah menjadi satu-satunya sumber kebenaran soal kapan cancel diizinkan; mempertahankan `isCompletedStatus` di frontend akan menciptakan DUA logic terpisah (FE vs BE) yang bisa divergen.
5. KONSEKUENSI: karena baseline `canCancel` (Requirement 3.1) TIDAK mengenal status domain-spesifik seperti `completed`/`done`/`delivered`/`billed` (status itu spesifik ke modul tertentu, mis. DeliveryNote/SalesInvoice — bukan bagian `FormStatus` generik dasar), tanggung jawab menge-exclude status tersebut BERPINDAH ke override `canCancel()` per-model (lihat Requirement 3.5). THE model yang memiliki status "selesai" domain-spesifik SHALL mengimplementasikan `canCancel()` sendiri untuk mengembalikan `false` pada status tersebut — kegagalan melakukan ini adalah regresi (tombol Cancel muncul untuk dokumen yang seharusnya sudah final).
6. DEPENDENSI URUTAN KERJA (wajib dipatuhi saat penyusunan `tasks.md`): penghapusan `isCompletedStatus` dari `resources/js/Pages/Core/FormPage.jsx` (definisi di `resources/js/lib/utils.js`, import, dan pemakaian) TIDAK BOLEH dieksekusi sebagai task yang berdiri sendiri sebelum backend `canCancel` (Requirement 3) tersedia dan ter-serialisasi ke response Inertia. Alasan: selama `canCancel` belum ada di payload backend, `defaultData?.canCancel` selalu `undefined` (falsy) di frontend — menghapus `isCompletedStatus` lebih dulu membuat tombol Cancel hilang total untuk SEMUA dokumen (bukan cuma yang berstatus selesai), sebuah regresi sementara yang lebih luas daripada gap yang sedang diperbaiki. THE task penghapusan `isCompletedStatus` SHALL berada di task yang sama atau task yang secara eksplisit di-urutkan SETELAH task backend `canCancel` (termasuk override per-model di Requirement 3.5) selesai dan terverifikasi.

### Requirement 3: Kondisi cancel dinamis (pola sama dengan canDelete)

**User Story:** As a developer, I want computed attribute `canCancel` dengan baseline default dan override opsional per-model, so that tiap model submitable bisa menambah aturan bisnis sendiri tanpa mengubah trait inti.

#### Acceptance Criteria

1. THE baseline `canCancel` SHALL bernilai `true` bila status dokumen BUKAN `DRAFT` dan BUKAN `CANCELED`.
2. WHEN model submitable mengimplementasikan method `canCancel()` sendiri, THE computed attribute `canCancel` SHALL bernilai baseline (Acceptance Criteria 1) DI-AND-kan dengan hasil `canCancel()` method tersebut — mengikuti pola persis `getCanDeleteAttribute()` di `app/Traits/LinkModel.php`.
3. WHEN model submitable TIDAK mengimplementasikan `canCancel()`, THE computed attribute SHALL bernilai baseline saja (Acceptance Criteria 1).
4. Keputusan desain (dikonfirmasi user): baseline global TIDAK diperluas untuk mengenali status domain-spesifik "selesai" (`completed`, `done`, `delivered`, `billed`, dan sejenisnya di modul lain). Baseline TETAP hanya cek `DRAFT`/`CANCELED` generik (Acceptance Criteria 1) — bukan diserahkan ke override per-model dari awal berarti baseline "salah aman" secara default; model dengan status selesai domain-spesifik WAJIB override, bukan opsional.
5. IF model submitable memiliki status "selesai" domain-spesifik (contoh: `DeliveryNote` dengan status `delivered`, `SalesInvoice`/`PurchaseInvoice` dengan status `billed`, model dengan status `completed`/`done`), THEN model tersebut SHALL mengimplementasikan `canCancel()` yang mengembalikan `false` untuk status-status tersebut — menggantikan fungsi `isCompletedStatus()` yang sebelumnya jadi satu-satunya guard di sisi frontend (lihat Requirement 2.5).
6. THE computed attribute `canCancel` SHALL otomatis terkirim ke frontend dalam serialisasi JSON (`toArray()`/`toJson()`) TANPA model submitable individual perlu mendeklarasikan `canCancel` secara manual di property `$appends` miliknya. Mekanisme injeksi mengikuti pola `LinkModel::getAppends()`/`getArrayableAppends()` (`app/Traits/LinkModel.php` baris 202-215): nama attribute ditambahkan secara kondisional (di sini: kondisional pada `static::$is_submitable ?? false`, karena `LinkModel` dipakai baik model submitable maupun bukan) ke dalam `$appends` tepat sebelum Eloquent memanggil `getArrayableAppends()` bawaan, sehingga tiap accessor ter-daftar otomatis saat serialisasi berjalan.

### Requirement 4: Cascade update ApprovalInstanceStep saat dokumen dibatalkan

**User Story:** As an approver, I want step approval yang masih berjalan otomatis ditandai batal ketika dokumen dibatalkan, so that saya tidak lagi melihat dokumen yang sudah batal di daftar "perlu ditinjau".

#### Acceptance Criteria

1. WHEN status dokumen submitable berubah menjadi `CANCELED` (event `saved` pada trait `Submitable`, titik yang sama dengan notifikasi `ApprovalCanceledNotification` yang sudah ada), THE sistem SHALL men-dispatch event `App\Events\Core\DocumentCanceled` membawa referensi dokumen dan `ApprovalInstance` terkait. Path `Core/` (tanpa nested Feature) karena event ini SATU file tunggal, tidak diprediksi akan didampingi event sejenis lain (lihat Glossary).
2. THE sistem SHALL menyediakan listener terpisah `App\Listeners\Core\Approval\CancelPendingApprovalSteps` (bukan menambah logic ke closure `saved()` yang sudah ada) yang menangani event `DocumentCanceled` dan mengubah SEMUA `ApprovalInstanceStep` dengan status `PENDING` atau `WAITING` milik `ApprovalInstance` tersebut menjadi status `CANCELED`. Path nested `Core/Approval/` (BEDA dari path Event yang tidak nested) karena domain approval punya banyak aksi/listener terkait (approve, reject, pending, cancel) yang diprediksi tumbuh menampung listener approval lain ke depan — bukan sekadar karena "spesifik ke approval".
3. THE listener SHALL berjalan idempoten — jika dipanggil dua kali untuk dokumen yang sama (mis. event ter-retry), tidak ada step yang sudah diproses berubah lagi atau error.
4. THE notifikasi `ApprovalCanceledNotification` yang sudah ada SHALL tetap terkirim seperti sebelumnya — event/listener baru ini adalah TAMBAHAN, bukan pengganti.
5. WHEN dokumen tidak punya `ApprovalInstance` (belum pernah masuk approval workflow), THE listener SHALL tidak melakukan apa-apa (no-op), tidak error.
6. IF `ApprovalInstanceStep` yang di-cascade adalah step `is_advanced` (multi-approver) dengan child `approvers` yang masih `PENDING`, THEN THE listener SHALL juga meng-update status child approvers tersebut menjadi `CANCELED` — konsisten dengan pola `recordApproverChildDecision()` di `ApprovalInstanceController.php` yang selalu sinkron antara step induk dan approver anak.

### Requirement 5: Kontrak Controller::cancel() dengan default + override rollback di Service

**User Story:** As a developer, I want base `Controller::cancel()` menyediakan orkestrasi standar (guard permission + guard canCancel + panggil Service + dispatch event), so that tiap Controller model submitable tidak perlu mengulang boilerplate yang sama.

#### Acceptance Criteria

1. THE base `Controller` class SHALL menyediakan method `cancel(string $id)` default yang: (a) resolve model dari `$id`, (b) abort bila `canCancel` bernilai `false`, (c) memanggil method `cancel()` pada Service milik model tersebut, (d) mengembalikan response standar (`back()`).
2. THE rollback logic spesifik per-model (mis. `rolllbackItems()` di `SalesOrderService`) SHALL tetap berada di layer Service, BUKAN dipindahkan ke Controller — Controller anak TIDAK perlu override method `cancel()` untuk kebutuhan rollback.
3. THE base `Controller` SHALL mendeklarasikan property `protected $service` — pola IDENTIK dengan `protected string $model` yang sudah ada di base class saat ini (dideklarasikan di base, diisi oleh controller anak). Base `Controller::cancel()` mengakses Service lewat `$this->service->cancel($data)` secara langsung, TANPA resolusi string FQCN dari konvensi penamaan (pendekatan konvensi-namespace sempat dipertimbangkan lalu DITOLAK — lihat catatan desain di `design.md` Komponen #5 — karena base class sudah punya cara yang benar dan sudah ada precedent-nya lewat `$this->model`, sehingga menebak nama class dari string adalah workaround yang tidak diperlukan).
4. WHEN sebuah model submitable TIDAK punya kebutuhan rollback khusus, THE Service model tersebut SHALL tetap wajib mengimplementasikan method `cancel()` (minimal update status ke `CANCELED`) — tidak ada default silent di Controller yang langsung `update(['status' => CANCELED])` tanpa lewat Service, untuk menjaga satu jalur eksekusi (Controller selalu lewat Service, tidak ada dua jalur berbeda).
5. THE 9 controller submitable existing (SalesOrderController, PurchaseOrderController, DeliveryNoteController, SalesInvoiceController, PurchaseInvoiceController, PurchaseReceiptController, PurchaseRequestController, InternalOrderController, PaymentEntryController) SHALL di-refactor pada spec ini: (a) hapus redeclare property Service milik sendiri (mis. `private SalesOrderService $service;`), (b) assign ke property `$service` milik base di constructor, (c) hapus method `cancel()` override milik sendiri agar otomatis memakai base. Bukan hanya berlaku untuk controller baru ke depan.
6. TEMUAN (dipicu pertanyaan user saat review — "apakah alur ini masih memungkinkan pakai DB transaction dengan event listener, atau listener jalan di polling mandiri?"): investigasi kode menunjukkan HANYA 4 dari 9 `{Model}Service::cancel()` (`SalesOrderService`, `InternalOrderService`, `StockEntryService`, `PurchaseOrderService`) yang membungkus `DB::beginTransaction()`/`commit()`; 5 lainnya (`SalesInvoiceService`, `PurchaseInvoiceService`, `DeliveryNoteService`, `PurchaseRequestService`, `PaymentEntryService`) TIDAK ber-transaksi sama sekali. Karena listener `CancelPendingApprovalSteps` (Requirement 4) berjalan SINKRON dalam call stack yang sama dan otomatis ikut transaksi manapun yang sedang terbuka (event `saved` terpicu SAAT `update()` dipanggil, bukan setelah commit), 5 Service yang tidak ber-transaksi berisiko menyisakan status dokumen `CANCELED` permanen tanpa rollback jika listener gagal. THE base `Controller::cancel()` SHALL membungkus pemanggilan `$this->service->cancel($data)` dalam `DB::beginTransaction()`/`DB::commit()` (dengan `DB::rollBack()` pada exception) — transaksi menjadi tanggung jawab layer orkestrasi (Controller), BUKAN diduplikasi manual ke 5 Service yang belum memilikinya. 4 Service yang SUDAH memiliki `DB::beginTransaction()`/`commit()` sendiri TIDAK WAJIB diubah — Laravel mendukung nested transaction secara aman (transaction-level counter), sehingga transaksi Service yang sudah ada otomatis ter-nest di dalam transaksi base tanpa konflik.
7. TEMUAN TAMBAHAN (dipicu instruksi user — "tambahkan pencatatan ke log, cek apakah ada method logForCanceled pada DataTable trait"): method `logForCancelled()` (ejaan persis di kode: double-L) SUDAH ADA di `app/Traits/DataTable.php` (baris 198-211) dengan implementasi lengkap (pola identik `logForCreated()`/`logForSubmitted()`/`logForDeleted()`), TETAPI TIDAK PERNAH dipanggil di manapun pada codebase saat ini. THE base `Controller::cancel()` SHALL memanggil `$data->logForCancelled()` setelah `$this->service->cancel($data)` berhasil, DI DALAM transaksi yang sama (Acceptance Criteria 6) — konsisten dengan pola `logForDeleted()` yang dipanggil sebelum `DB::commit()` di `SalesOrderController::destroy()`.

## Out of Scope

- Perubahan pada mekanisme `amend()`, `submit()`, `onApproved()`/`onRejected()` — spec ini murni tentang alur `cancel()`.
- Perubahan UI/komponen listing approval (`ApprovalInstanceIndex`) untuk memfilter berdasarkan status dokumen induk — cascade update status step (Requirement 4) menyelesaikan ini di level data, bukan di level query listing.
- Migrasi data historis: step approval yang SUDAH nyangkut di status lama akibat dokumen yang dibatalkan SEBELUM spec ini diimplementasikan. Perlu didiskusikan terpisah apakah butuh data-fix/migration.
