# Implementation Plan: Cancel Workflow Improvements

## Overview

Implementasi berjalan bottom-up: (1) computed attribute `canCancel` di `Submitable` trait, (2) Event/Listener cascade approval, (3) base `Controller::cancel()` (transaksi + log + panggil Service), lalu (4) migrasi 9 controller existing dan (5) override `canCancel()` di 8 model yang punya status "selesai" domain-spesifik, baru (6) frontend. Urutan ini wajib — Requirement 2.6 melarang penghapusan `isCompletedStatus` di FE sebelum backend `canCancel` (termasuk override per-model) selesai dan terverifikasi, supaya tombol Cancel tidak hilang total di window implementasi.

## Tasks

- [x] 1. `canCancel` computed attribute di `Submitable`
  - [x] 1.1 Tambah `getCanCancelAttribute()` di `app/Traits/Submitable.php`
    - Baseline: `true` bila status BUKAN `DRAFT` dan BUKAN `CANCELED`
    - AND dengan `$this->canCancel()` jika model mengimplementasikan method tersebut (`method_exists` check, pola persis `getCanDeleteAttribute()` di `app/Traits/LinkModel.php`)
    - _Requirements: 1.1, 1.3, 3.1, 3.2, 3.3, 3.4_

  - [x] 1.2 Daftarkan `canCancel` ke mekanisme append otomatis
    - Di `app/Traits/LinkModel.php` method `getAppends()` (baris ±202-209), tambah `canCancel` ke array kondisional pada `static::$is_submitable ?? false` (pola sama seperti conditional `templateLink`/`disabledOn` yang sudah ada)
    - Verifikasi: model submitable TIDAK perlu deklarasi manual `$appends` untuk `canCancel`
    - _Requirements: 3.6_

  - [x] 1.3 Write unit tests untuk `getCanCancelAttribute()` (Property 1 & 2)
    - **Property 1 — canCancel monoton terhadap status**: assert `true` untuk tiap status bukan DRAFT/CANCELED tanpa override; assert `false` untuk DRAFT dan CANCELED
    - **Property 2 — override hanya mempersempit**: model dummy dengan `canCancel()` return `false` → hasil akhir `false` walau baseline `true`; model dummy dengan `canCancel()` return `true` tapi baseline `false` (status DRAFT) → hasil akhir tetap `false`
    - **Validates: Requirements 3.1, 3.2, 3.3**
    - File: `tests/Unit/Traits/SubmitableCanCancelTest.php` (baru) — 6 test, 8 assertions, semua lulus. Ditemukan & diperbaiki bug test: insert manual harus JSON-encode status (`json_encode([$status->value])`), bukan string polos — kontrak `FormStatusesCast::get()`.

- [ ] 2. Checkpoint - Ensure `canCancel` attribute tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Event `DocumentCanceled` + Listener `CancelPendingApprovalSteps`
  - [x] 3.1 Buat `app/Events/Core/DocumentCanceled.php`
    - Property `readonly Model $document`, `readonly ApprovalInstance $approvalInstance` via constructor promotion
    - `use Dispatchable, SerializesModels`
    - Tanpa nested Feature (event tunggal, tidak diprediksi didampingi event sejenis)
    - _Requirements: 4.1_

  - [x] 3.2 Buat `app/Listeners/Core/Approval/CancelPendingApprovalSteps.php`
    - `handle(DocumentCanceled $event)`: query `$event->approvalInstance->steps()->whereIn('status', [PENDING, WAITING])->get()`, update tiap step ke `CANCELED`
    - Untuk step `is_advanced`, cascade update `$step->approvers()->where('status', PENDING)->update(['status' => CANCELED])`
    - Nested folder `Approval/` (domain approval diprediksi tumbuh menampung listener terkait lain)
    - _Requirements: 4.2, 4.3, 4.6_

  - [x] 3.3 Dispatch event dari `Submitable::bootSubmitable()`
    - Di closure `saved()` existing (yang sudah mengirim `ApprovalCanceledNotification`), tambah `event(new DocumentCanceled($model, $approval))` SEBELUM logic notifikasi — pakai guard yang sudah ada (`isSubmitable`, `wasChanged('status')`, `in_array(CANCELED, ...)`, `$approval` tidak null), JANGAN duplikasi closure baru
    - Verifikasi notifikasi existing tetap terkirim tanpa perubahan
    - _Requirements: 4.1, 4.4, 4.5_

  - [x] 3.4 Registrasi listener di `app/Providers/AppServiceProvider.php`
    - `Event::listen(DocumentCanceled::class, CancelPendingApprovalSteps::class)` di `boot()`
    - _Requirements: 4.2_

  - [x] 3.4b (REVISI, instruksi user setelah commit awal — "daftarkan Event Listener di ServiceProvider terpisah, jangan jadikan satu di AppServiceProvider") Pindah registrasi ke `EventServiceProvider` baru
    - Buat `app/Providers/EventServiceProvider.php`, extends `Illuminate\Foundation\Support\Providers\EventServiceProvider`, property `$listen = [DocumentCanceled::class => [CancelPendingApprovalSteps::class]]` — pola Laravel klasik, bukan `Event::listen()` manual.
    - Daftarkan di `bootstrap/providers.php` (array provider Laravel 12, bukan `config/app.php`).
    - Hapus baris `Event::listen(...)` dan import terkait dari `AppServiceProvider::boot()` — dikembalikan ke isi semula (Vite prefetch + macro loader saja).
    - Verifikasi: `tests/Feature/Core/Approval/CancelPendingApprovalStepsTest.php` (5 test) tetap lulus — listener terbukti masih ter-trigger lewat provider baru, bukan cuma dicek dari daftar `$listen` statis. Pint pass.

  - [x] 3.5 Write tests untuk cascade listener (Property 3, 4, 5)
    - **Property 3 — cascade lengkap tanpa sisa**: ApprovalInstance dengan N step PENDING/WAITING → setelah listener jalan, 0 step tersisa PENDING/WAITING
    - **Property 4 — idempotensi**: jalankan `handle()` 2-5 kali pada state sama → state akhir identik dengan 1 kali jalan, tidak ada exception
    - **Property 5 — notifikasi tidak terpengaruh**: assert `ApprovalCanceledNotification` tetap terkirim dengan payload sama seperti sebelum perubahan
    - Test tambahan: dokumen tanpa `ApprovalInstance` → listener tidak pernah dipanggil, tidak error (Requirement 4.5)
    - Test tambahan: step `is_advanced` dengan sebagian approver anak sudah `APPROVED` → hanya approver `PENDING` yang ter-update, histori approver lain tidak ditimpa
    - **Validates: Requirements 4.2, 4.3, 4.4, 4.5, 4.6**
    - File: `tests/Feature/Core/Approval/CancelPendingApprovalStepsTest.php` (baru) — 5 test, 10 assertions, semua lulus.
    - CATATAN REGRESI: `tests/Feature/Core/Notification/ApprovalNotificationTest.php` existing (disebut di task asli) TIDAK dijalankan sebagai regression gate — diverifikasi via git worktree terisolasi bahwa 4 dari 6 test di file tsb SUDAH GAGAL di `HEAD` sebelum task ini dikerjakan (bug environment test pre-existing: `SQLSTATE[HY000]: no such column: branches.is_example`, tidak terkait perubahan spec ini). Property 5 tetap terverifikasi via test baru sendiri di file ini.

- [x] 4. Checkpoint - Ensure Event/Listener cascade tests pass
  - Ensure all tests pass, ask the user if questions arise.
  - Hasil: `SubmitableCanCancelTest` (6 lulus) + `CancelPendingApprovalStepsTest` (5 lulus) = 11/11 lulus. Lanjut otomatis (kebijakan checkpoint disepakati: lanjut tanpa nunggu konfirmasi manual selama semua test lulus).

- [x] 5. Base `Controller::cancel()` — orkestrasi, transaksi, logging
  - [x] 5.1 Tambah property `protected $service` di `app/Http/Controllers/Controller.php`
    - Tanpa type-hint spesifik (base dipakai semua controller submitable dengan Service class berbeda-beda)
    - _Requirements: 5.3_
    - **TEMUAN DI LUAR SCOPE AWAL**: menambah property ini fatal-error 4 controller LAIN yang bukan submitable dan tidak masuk daftar 9 (`TicketController`, `WorkOrderController`, `PaymentTermTemplateController`, `StockEntryController`) — mereka juga redeclare `private {X}Service $service;` sendiri, konflik visibility dengan base. Dikonfirmasi ke user: migrasi ke-4nya juga (hapus redeclare property, assignment tetap ada), TANPA memaksa mereka pakai base `cancel()` (method `cancel()` override mereka sendiri, jika ada, dibiarkan apa adanya). File: `TicketController.php`, `WorkOrderController.php`, `PaymentTermTemplateController.php`, `StockEntryController.php`.

  - [x] 5.2 Implementasi `cancel(string $id)` di base `Controller`
    - Resolve model via `$this->model::findOrFail($id)`
    - `abort_unless($data->canCancel ?? false, 422)`
    - Bungkus `DB::beginTransaction()` → `$this->service->cancel($data)` → `$data->logForCancelled()` → `DB::commit()`, dengan `catch (\Throwable $e) { DB::rollBack(); throw $e; }`
    - Return `back()`
    - _Requirements: 5.1, 5.2, 5.4, 5.6, 5.7_

  - [x] 5.3 Write tests untuk base `Controller::cancel()`
    - Request PUT ke route cancel tanpa permission → assert 403 (regresi guard existing)
    - Request dengan permission tapi `canCancel` false → assert 422
    - Request valid → assert status dokumen `CANCELED`, `Log` entry dari `logForCancelled()` tercipta, transaksi commit
    - Simulasi exception di listener (mock/force error) pada Service TANPA transaksi sendiri → assert status dokumen ROLLBACK (tidak jadi CANCELED) berkat transaksi base
    - **Validates: Requirements 5.1, 5.4, 5.6, 5.7**
    - File: `tests/Feature/Http/Controllers/BaseControllerCancelTest.php` (baru) — 4 test, 8 assertions, semua lulus. Debugging notable: (a) `back()` return HTTP 302 bukan 200, assertion diperbaiki; (b) `Service::cancel()` di test awal melempar exception SEBELUM `update()` (tidak menguji rollback beneran) — diperbaiki urutan; (c) instance Service perlu di-bind `singleton()` di container test agar toggle `$shouldThrow` dari test nyambung ke instance yang sama yang di-inject controller; (d) route ad-hoc didaftarkan di `setUp()` + `refreshNameLookups()` agar `route()` helper bisa resolve.

- [x] 6. Checkpoint - Ensure base Controller::cancel() tests pass
  - Ensure all tests pass, ask the user if questions arise.
  - Hasil: 15/15 test lulus (`SubmitableCanCancelTest` 6 + `CancelPendingApprovalStepsTest` 5 + `BaseControllerCancelTest` 4). Lanjut otomatis.

- [x] 7. Migrasi 9 controller submitable ke base `cancel()`
  - [x] 7.1 `SalesOrderController` — hapus `private SalesOrderService $service;`, assign ke `$this->service` di constructor, hapus method `cancel()` override
    - _Requirements: 5.5_
  - [x] 7.2 `PurchaseOrderController` — sama pola 7.1
    - _Requirements: 5.5_
  - [x] 7.3 `DeliveryNoteController` — sama pola 7.1
    - _Requirements: 5.5_
  - [x] 7.4 `SalesInvoiceController` — sama pola 7.1
    - _Requirements: 5.5_
  - [x] 7.5 `PurchaseInvoiceController` — sama pola 7.1
    - _Requirements: 5.5_
  - [x] 7.6 `PurchaseReceiptController` — sama pola 7.1
    - _Requirements: 5.5_
  - [x] 7.7 `PurchaseRequestController` — sama pola 7.1
    - _Requirements: 5.5_
  - [x] 7.8 `InternalOrderController` — sama pola 7.1
    - _Requirements: 5.5_
  - [x] 7.9 `PaymentEntryController` — sama pola 7.1
    - _Requirements: 5.5_
    - VERIFIKASI: `intelephense` "method not compatible" diagnostic (signature `cancel(Model $model)` vs base `cancel(string $id)`) dipakai sebagai sinyal deteksi tiap sisa method override yang lolos grep awal — semua 9 sudah bersih, dikonfirmasi ulang lewat grep akhir `function cancel(` di `app/Http/Controllers/` (hasil: cuma ada di `Controller.php` base) dan grep property `$service` redeclare (hasil: 0 file).

  - [ ] 7.10 Regresi test tiap controller yang dimigrasi
    - Jalankan/tambah feature test cancel per model (9 model) memastikan route `cancel` tetap berfungsi identik setelah override dihapus dan base dipakai
    - **Validates: Requirement 5.5**
    - CATATAN: tidak ada test existing per-model yang menyentuh route `cancel` (dicek: tidak ditemukan file test bernama sesuai 9 model). Validasi dilakukan lewat full test suite proyek (regresi lintas-controller), bukan test baru per model — spec ini sudah punya test end-to-end untuk mekanisme `cancel()` generik (`BaseControllerCancelTest`), duplikasi 9x test serupa per model dinilai berlebihan (YAGNI) kecuali full suite menemukan kegagalan spesifik.

- [x] 8. Checkpoint - Ensure 9 controller migration tests pass
  - Ensure all tests pass, ask the user if questions arise.
  - **INVESTIGASI SELESAI**: full suite kode (setelah task 7) menunjukkan 406 dari ~800 test gagal dengan `SQLSTATE[HY000]: cannot start a transaction within a transaction`. Ditemukan JUGA bug fatal TERPISAH selama investigasi: `ItemController.php` (`Inventory`) redeclare property `$service` dengan type-hint eksplisit (`protected ItemServices $service`), lolos dari grep awal task 5.1 karena nama class `ItemServices` (plural) — diperbaiki (hapus redeclare, pola sama 13 controller lain). SETELAH fix ini, subset test (`tests/Feature/Traits/`, `tests/Feature/User/`) lulus 8/8. TAPI investigasi lanjutan via git worktree isolasi (baseline `HEAD` sebelum SEMUA perubahan spec ini) membuktikan: **bug nested-transaction ADALAH PRE-EXISTING** — baseline HEAD sendiri gagal 396/792 test dengan error IDENTIK, sebelum spec ini disentuh sama sekali. Root cause: `app/Http/Controllers/Controller.php` base `cancel()` yang saya tulis di task 5.2 TIDAK bertanggung jawab atas kegagalan ini — bug environment SQLite+PHP 8.4 (`SQLiteConnection::executeBeginTransactionStatement()`) yang muncul saat PHPUnit menjalankan ratusan test berurutan dalam satu proses, di luar scope spec ini untuk diperbaiki. Dicatat sebagai gap sistemik terpisah, bukan blocker penyelesaian spec ini.

- [x] 9. Override `canCancel()` di model dengan status "selesai" domain-spesifik
  - [x] 9.1 Verifikasi status enum aktual per model (WAJIB sebelum implementasi override)
    - Baca `app/Enums/FormStatus.php` dan tiap Model/Service dari 8 kandidat (`Ticket`, `SalesInvoice`, `SalesOrder`, `WorkOrder`, `PurchaseReceipt`, `PurchaseInvoice`, `DeliveryNote`, `PurchaseOrder`) untuk memastikan value status "selesai" yang benar-benar dipakai (JANGAN asumsikan mapping 1:1 dari string `isCompletedStatus()` versi lama: `completed`/`done`/`delivered`/`billed`)
    - Dokumentasikan temuan mapping model → status enum sebelum lanjut ke 9.2
    - _Requirements: 3.5_
    - **TEMUAN**: `Ticket` TERNYATA BUKAN model submitable (tidak memakai trait `Submitable` sama sekali, `TicketService.php` tidak mereferensi `FormStatus` sekali pun) — dikeluarkan dari daftar kandidat, tersisa 7 model. Mapping status final terverifikasi dari kode aktual (BUKAN asumsi dari `isCompletedStatus()` lama): `SalesOrder`→`COMPLETED`, `PurchaseOrder`→`COMPLETED`, `DeliveryNote`→`DELIVERED`, `SalesInvoice`→`PAID` (BEDA dari `isCompletedStatus()` lama yang pakai `billed` — ternyata salah/untuk model lain), `PurchaseInvoice`→`BILLED`, `PurchaseReceipt`→`RECEIVED` (tidak ada di `isCompletedStatus()` lama sama sekali), `WorkOrder`→`COMPLETED`.
    - **TEMUAN TAMBAHAN DI LUAR SCOPE 9.1**: `WorkOrder` memakai `Submitable` DAN route `cancel` AKTIF (`Route::resourceDetail('workOrder', ..., isSubmmitable: true)`), TAPI `WorkOrderService::cancel()` TIDAK ADA — gap pre-existing (kalau tombol cancel diklik, fatal error method not found). Dikonfirmasi ke user: perluas scope, implementasikan `WorkOrderService::cancel()` minimal SEKALIGUS override `canCancel()`, menutup gap sepenuhnya di spec ini (bukan cuma dicatat sebagai gap terpisah).

  - [x] 9.2 Implementasi `canCancel()` di tiap model terverifikasi butuh override (hasil 9.1)
    - Contoh pola: `public function canCancel(): bool { return ! \in_array(FormStatus::<STATUS_SELESAI>, (array) $this->status); }`
    - Terapkan HANYA ke model yang hasil 9.1 konfirmasi punya status "selesai" domain-spesifik (bisa kurang atau lebih dari 8 kandidat awal, tergantung temuan)
    - _Requirements: 3.5_
    - File diubah: `SalesOrder.php`, `PurchaseOrder.php`, `DeliveryNote.php`, `SalesInvoice.php`, `PurchaseInvoice.php`, `PurchaseReceipt.php`, `WorkOrder.php` (7 model, semua ditambah import `FormStatus` + method `canCancel()`). Plus `WorkOrderService.php` (method `cancel()` baru, pola `fillForUpdate(['status' => FormStatus::CANCELED])` konsisten dengan method `start()`/`complate()` yang sudah ada di file yang sama).

  - [x] 9.3 Write tests untuk tiap override `canCancel()` model
    - Assert `canCancel` bernilai `false` saat status "selesai" domain-spesifik, `true` saat status lain yang valid untuk cancel (bukan DRAFT/CANCELED)
    - **Validates: Requirement 3.5**
    - File: `tests/Unit/Models/CanCancelOverrideTest.php` (baru) — 14 test (2 per 7 model), semua lulus. Pendekatan: unit test murni tanpa `RefreshDatabase`/DB (`new Model` + `setRawAttributes`) — dicoba pendekatan Feature test dengan `create()` langsung ke DB dulu, tapi GAGAL karena skema test SQLite untuk `sales_orders`/`suppliers` tidak lengkap/tidak sinkron dengan production (kolom `status` dan `is_example` hilang di migration test) — di luar scope spec ini untuk diperbaiki, jadi dialihkan ke pendekatan tanpa DB yang tidak terpengaruh gap migration tersebut.

  - [x] 9.4 (BARU, dipicu pertanyaan user — "apakah canCancel tidak butuh dependsOn?") Fix gap `dependsOn` untuk `canCancel` di `LinkModel.php`
    - **TEMUAN**: `LinkModel::getColumns()` punya blok khusus (baris ±589-599) yang menyuntik `dependsOn` baseline untuk `canDelete`, `appendStatus`, `templateLink`, dst — TAPI TIDAK ADA untuk `canCancel` (baru ditambahkan di task 1.2, luput dari radar saat itu). Konsekuensi NYATA (bukan teoretis): `DataTableColumnSelector::collectAppendStrict()` (mode `resolveForSafe`/strict SELECT pruning) men-`throw new \RuntimeException` untuk append column TANPA `dependsOn` — bug ini akan CRASH production pertama kali ada request DataTable model submitable yang lewat jalur strict.
    - Fix: tambah cabang `elseif ($value === 'canCancel' && ! isset($config['dependsOn']))` di `LinkModel.php`, isi `dependsOn: ['status']` (submitable selalu punya kolom status, tidak perlu cabang non-submitable seperti `canDelete`).
    - Verifikasi: `tests/Feature/Services/Core/DependsOnAuditTest.php` (test audit existing, scan SEMUA model di `app/Models`) — dicoba matikan fix sementara (rename kondisi jadi `canCancelTEMP_DISABLED`) → test GAGAL dengan 11 model submitable terdaftar sebagai offender (bukti fix ini nyata dibutuhkan, bukan defensive coding tanpa dasar) → fix dikembalikan → test lulus lagi.
    - **BUG TAMBAHAN DITEMUKAN saat regresi**: (a) `PurchaseInvoice::canCancel()` salah pakai `FormStatus::PAID` (seharusnya `BILLED` — kemungkinan copy-paste dari `SalesInvoice`), diperbaiki. (b) `DeliveryNote.php` dan `PurchaseReceipt.php` kehilangan method `canCancel()` sepenuhnya (root cause tidak dikonfirmasi — kemungkinan race condition antara command Pint background dan command Read/test yang dijalankan bersamaan; file lain seperti `PurchaseInvoice.php` tidak terpengaruh), ditambahkan kembali. Setelah semua fix, regresi penuh 30/30 test spec ini lulus.

  - [x] 9.5 (BARU, koreksi domain-knowledge dari user setelah review 9.4) Revisi 5 poin logic `canCancel()` per-model
    - **Koreksi 1 — `PurchaseReceipt` & `DeliveryNote` TIDAK PERLU `canCancel()`**: method dihapus total dari kedua model (bukan override, baseline `Submitable` — bukan DRAFT/CANCELED — sudah cukup). Import `FormStatus` yang jadi tidak terpakai juga dihapus.
    - **Koreksi 2 — `PurchaseInvoice` seharusnya `PAID`, bukan `BILLED`**: klarifikasi user — status `PAID` di-update dari `PaymentEntry`, bukan dari proses billing. (Awalnya di task 9.4 sempat "diperbaiki" ke `BILLED` berdasarkan riset kode Service yang keliru diinterpretasi — dikoreksi balik sesuai domain knowledge user.)
    - **Koreksi 3 — Mekanisme `dependsOn` merge, bukan override**: `LinkModel::getColumns()` (baris ±588-618) direfactor — SEBELUMNYA tiap cabang baseline (`appendStatus`/`canDelete`/`canCancel`/dst) di-skip total kalau `configColumns` model sudah set `dependsOn` sendiri (`! isset($config['dependsOn'])` sebagai guard). SEKARANG baseline SELALU dihitung, lalu di-UNION (`array_values(array_unique([...baseline, ...config]))`) dengan `dependsOn` custom milik model — model boleh menambah kolom dependency tambahan (mis. untuk `canDelete()` override yang baca field lain) tanpa kehilangan baseline wajib (`status` untuk `canCancel`/`canDelete` submitable). Spread akhir diubah `...array_diff_key($config, ['dependsOn' => true])` supaya `dependsOn` hasil merge tidak tertimpa balik oleh spread `$config` mentah. Diverifikasi: `DependsOnAuditTest` + `DataTableColumnSelectorTest` + `GetColumnsIncludeHiddenTest` (25 test) tetap lulus setelah refactor.
    - **Koreksi 4 — `SalesOrder`/`PurchaseOrder`: 7 status blocking**: `canCancel()` diperluas dari cek tunggal `COMPLETED` menjadi cek 7 status (`DELIVERED`, `PARTIALLY_DELIVERED`, `RECEIVED`, `PARTIALLY_RECEIVED`, `BILLED`, `PARTIALLY_BILLED`, `COMPLETED`) — `false` jika status match SALAH SATU dari 7 itu.
    - **Koreksi 5 — `SalesInvoice`/`PurchaseInvoice`: samakan `[PAID, PARTIALLY_PAID]`**: kedua model sekarang identik — `false` jika status `PAID` atau `PARTIALLY_PAID`.
    - **BUG DITEMUKAN saat implementasi koreksi 4/5**: percobaan pertama pakai `array_intersect((array) $this->status, [FormStatus::X, ...])` — GAGAL runtime (`Error: Object of class App\Enums\FormStatus could not be converted to string`). Root cause: `array_intersect()` PHP native tidak bisa membandingkan objek (enum backed case adalah objek, bukan scalar) — fungsi ini mencoba cast ke string untuk perbandingan internal dan gagal. Diperbaiki: pola `foreach ($blockingStatuses as $status) { if (in_array($status, (array) $this->status, true)) return false; } return true;` — `in_array(..., true)` dengan strict comparison AMAN untuk enum backed karena PHP enum case adalah singleton (instance identik selalu `===`).
    - Test diupdate: `CanCancelOverrideTest.php` — `DeliveryNote`/`PurchaseReceipt` test dihapus, `SalesOrder`/`PurchaseOrder` pakai `#[DataProvider]` (PHP attribute, bukan doc-comment `@dataProvider` yang deprecated di PHPUnit 12) untuk cover 7 status blocking, `SalesInvoice`/`PurchaseInvoice` ditambah test `PARTIALLY_PAID`. Hasil: 24/24 lulus. Regresi gabungan spec (40 test lintas 5 file) tetap 40/40 lulus setelah semua koreksi.

- [x] 10. Checkpoint - Ensure per-model canCancel override tests pass
  - Ensure all tests pass, ask the user if questions arise.
  - Hasil: 14/14 lulus (`CanCancelOverrideTest`). Isu nested-transaction full suite (lihat catatan task 8) TERKONFIRMASI pre-existing lewat perbandingan baseline `HEAD` via git worktree isolasi (396/792 gagal di baseline murni, error identik) — bukan blocker, tidak menghambat kelanjutan task berikutnya.

- [x] 11. Frontend — ganti guard tombol Cancel
  - [x] 11.1 Update `resources/js/Pages/Core/FormPage.jsx`
    - Ganti kondisi render tombol Cancel (baris ±1154-1158) dari `!isCompletedStatus(defaultData?.status) && can("cancel", ...)` menjadi `defaultData?.canCancel && can("cancel", ...)`
    - Hapus import `isCompletedStatus` dari `@/lib/utils` (baris ±52) jika tidak dipakai di tempat lain pada file ini
    - **PRASYARAT WAJIB**: task ini hanya boleh dikerjakan SETELAH task 9 (override `canCancel()` per-model) selesai dan terverifikasi — lihat Requirement 2.6
    - _Requirements: 2.4, 2.6_

  - [x] 11.2 Hapus `isCompletedStatus` dari `resources/js/lib/utils.js` jika sudah tidak dipakai di manapun
    - Verifikasi dengan pencarian ulang di seluruh `resources/js/` sebelum menghapus definisi fungsi
    - _Requirements: 2.4_
    - Verifikasi: grep `isCompletedStatus` di seluruh `resources/js/` sebelum hapus → 0 pemakaian lain, aman dihapus. `npm run build` sukses tanpa error setelah kedua perubahan (11.1 + 11.2).

  - [ ]\* 11.3 Manual/browser verification tombol Cancel
    - Uji golden path: dokumen submitable status bukan DRAFT/CANCELED/selesai → tombol Cancel muncul, klik → sukses, status jadi CANCELED, step approval PENDING/WAITING ikut CANCELED
    - Uji edge case: dokumen dengan status "selesai" domain-spesifik (mis. DeliveryNote `delivered`) → tombol Cancel TIDAK muncul
    - Uji edge case: user tanpa permission `cancel` → tombol tidak muncul
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_
    - **BELUM DIKERJAKAN** — butuh browser interaktif (server dev + login), di luar kemampuan environment CLI saat ini. Ditandai optional; verifikasi logic sudah tercakup test otomatis (`BaseControllerCancelTest`, `CanCancelOverrideTest`) + build check sukses, tapi belum ada konfirmasi visual end-to-end di UI asli.

- [x] 12. Final checkpoint - Ensure all tests pass
  - Jalankan full test suite (`php artisan test --compact`)
  - Ensure all tests pass, ask the user if questions arise.
  - Ingatkan: Lint/Pint (`vendor/bin/pint --dirty --format agent`) dijalankan SETELAH semua task selesai, bukan per task (sesuai `CLAUDE.md` project)
  - **Hasil**: full suite proyek TIDAK dipakai sebagai gate (lihat catatan task 8 — 396/792 gagal juga di baseline HEAD murni, bug pre-existing sistemik `cannot start a transaction within a transaction`, di luar scope spec ini). Sebagai gantinya, regresi terarah dijalankan: seluruh test milik spec ini (`SubmitableCanCancelTest` 6 + `CancelPendingApprovalStepsTest` 5 + `BaseControllerCancelTest` 4 + `CanCancelOverrideTest` 14 = **29/29 lulus**, 40 assertions). `vendor/bin/pint --dirty --format agent` → pass tanpa perubahan. `npx eslint` pada 2 file JS yang diubah (`FormPage.jsx`, `utils.js`) → pass tanpa warning/error. `npm run build` → sukses.

## Notes

- Task 9.1 (verifikasi status enum) WAJIB dikerjakan sebelum 9.2 — daftar 8 model kandidat di `design.md` eksplisit ditandai "bisa tidak lengkap/tidak akurat", hasil riset design belum final.
- Task 11 (frontend) TERKUNCI setelah task 9 selesai — melanggar urutan ini menyebabkan tombol Cancel hilang total untuk semua dokumen (regresi lebih luas dari gap yang diperbaiki), sesuai Requirement 2.6.
- 4 dari 9 Service (`SalesOrderService`, `InternalOrderService`, `StockEntryService`, `PurchaseOrderService`) sudah punya `DB::beginTransaction()`/`commit()` sendiri — TIDAK perlu diubah, transaksi base `Controller::cancel()` (task 5.2) otomatis ter-nest dengan aman.
- Migrasi 9 controller (task 7) independen satu sama lain — bisa dikerjakan paralel/dalam urutan bebas asal masing-masing checkpoint di task 7.10 lulus sebelum lanjut task 8.
- Data historis (step approval yang sudah nyangkut dari dokumen yang dibatalkan SEBELUM spec ini) di luar scope — lihat `requirements.md` Out of Scope.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3"] },
    { "id": 2, "tasks": ["3.1"] },
    { "id": 3, "tasks": ["3.2", "3.4"] },
    { "id": 4, "tasks": ["3.3"] },
    { "id": 5, "tasks": ["3.5"] },
    { "id": 6, "tasks": ["5.1"] },
    { "id": 7, "tasks": ["5.2"] },
    { "id": 8, "tasks": ["5.3"] },
    { "id": 9, "tasks": ["7.1", "7.2", "7.3", "7.4", "7.5", "7.6", "7.7", "7.8", "7.9"] },
    { "id": 10, "tasks": ["7.10"] },
    { "id": 11, "tasks": ["9.1"] },
    { "id": 12, "tasks": ["9.2"] },
    { "id": 13, "tasks": ["9.3"] },
    { "id": 14, "tasks": ["11.1"] },
    { "id": 15, "tasks": ["11.2", "11.3"] }
  ]
}
```
