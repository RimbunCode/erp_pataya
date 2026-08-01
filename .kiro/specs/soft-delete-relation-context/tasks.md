# Implementation Plan: soft-delete-relation-context

## Overview

Tiga mekanisme independen (List, Show, Validasi) ditambah satu prasyarat wajib. Prasyarat (Task 1) harus selesai dan teruji lebih dulu — tanpa itu, `withTrashed()` di List/Show tetap percuma karena `deleted_at` sudah dibuang whitelist kolom sebelum sampai response. Task 2 (List), 3 (Show backend), dan 5 (Validasi) saling independen setelah prasyarat selesai. Task 4 (frontend) bergantung pada Task 3. Tidak ada perubahan definisi relasi di model manapun, tidak ada trait generik baru.

## Tasks

- [x] 1. Prasyarat — pastikan `deleted_at` tidak tersaring whitelist kolom
  - [x] 1.1 Tambah `forceSelect: true` pada metadata global `deleted_at`
    - Edit `app/Traits/LinkModel.php:78-80` (`initializeLinkModel()`) — tambah `'forceSelect' => true` di config `deleted_at`
    - _Requirements: 2.1, 2.2_
  - [x] 1.2 Hapus `ignore` pada `Assignable::$configColumns['deleted_at']`
    - Edit `app/Models/User/Assignable.php:13-17` — hapus key `deleted_at` dari `$configColumns` (atau set array kosong)
    - Jangan ubah `scopeLinkModel()` (baris 30-33) — filter `whereNull('deleted_at')` di situ tetap dipertahankan untuk dropdown pencarian assignee baru
    - _Requirements: 2.1, 2.2_
  - [x] 1.3 Audit model lain dengan pola `ignore` serupa pada `deleted_at`
    - Jalankan `grep -rn "'ignore'" app/Models` (atau setara), periksa tiap match apakah menyasar kolom `deleted_at`
    - Kalau ditemukan model lain, terapkan fix sama seperti 1.2 (hapus `ignore`, jangan sentuh scope pencarian jika ada)
    - Hasil: 0 match lain selain `Assignable` (sudah difix di 1.2) — tidak ada perubahan tambahan
    - _Requirements: 2.1, 2.2_
  - [x] 1.4 Write feature tests for prasyarat (Property 0)
    - **Property 0: `deleted_at` tidak pernah tersaring hilang oleh whitelist kolom, di jalur mana pun**
    - Test: hit endpoint `ModelController::__invoke()` (route `model`) untuk model ber-SoftDeletes TANPA mengirim `fields`, assert response mengandung key `deleted_at`
    - Test: `Assignable` lookup-by-id dengan assignee yang sudah soft-deleted — assert `deleted_at` terisi dan nama tetap resolve (regresi terhadap `scopeLinkModel()` yang tidak boleh ikut memblokir lookup-by-id)
    - **Validates: Requirements 2.1, 2.2**
    - File: `tests/Feature/Http/Controllers/ModelControllerSoftDeleteTest.php` (4 test, semua pass)
    - **Gap tambahan ditemukan & difix**: `ModelController.php:772` `$model::find($request->id)` polos, exclude soft-deleted by default (di luar whitelist kolom, ini SELECT-level lookup) — diubah jadi `$model::withTrashed()->find(...)` bila model ber-SoftDeletes. Di luar rencana Task 1 semula, ditambahkan setelah dikonfirmasi user.

- [x] 2. Checkpoint - Ensure prasyarat tests pass
  - 4/4 test pass.

- [x] 3. List/DataTable — withTrashed otomatis di macro `dataTable()`
  - [x] 3.1 Suntik `withTrashed()` pada eager-load macro `dataTable()`
    - Edit `app/Models/Scopes/DataTableScope.php`, titik sebelum `$query->with($withKeys)` — bungkus tiap closure relasi, cek `SoftDeletes` via `class_uses_recursive`, apply `withTrashed()` bila match
    - Ditambah: `relationDefinesOwnWithTrashed()` — deteksi via reflection source method relasi, skip suntikan macro kalau method sudah memanggil `withTrashed()` sendiri (mencegah macro menimpa override statis)
    - _Requirements: 1.1, 1.2, 1.3, 4.2, 4.3_
  - [x] 3.2 Write feature tests for List withTrashed (Property 1 & 4)
    - File: `tests/Feature/Models/Scopes/DataTableScopeSoftDeleteTest.php` (2 test, semua pass)
    - **Gap arsitektural ditemukan (pre-existing, di luar scope fix)**: `DataTableColumnSelector::resolveForSafe()` memanggil method relasi pada instance model KOSONG (query-planning-time) — constraint `withTrashed($this->status != 'draft')` yang bergantung row-state SELALU salah dievaluasi (`$this->status` selalu `null`) di jalur List. Detail lengkap: memory `project_softdelete_resolveforsafe_gap`.
    - **Keputusan user**: hapus `withTrashed($this->status != 'draft')` dari `PurchaseRequestItem::item()`/`unit()` (`app/Models/Purchase/PurchaseRequestItem.php:70-77`) — constraint itu sudah tidak pernah bekerja benar di List, macro global (3.1) sudah cukup. Test Property 4 disesuaikan: pakai `withTrashed(false)` statis (bukan bergantung row-state) sebagai skenario override yang valid diverifikasi.
    - **Validates: Requirements 1.1, 1.2, 1.3, 4.2, 4.3**

- [x] 4. Checkpoint - Ensure List tests pass
  - 38/38 test pass (Task 1+3 gabungan + regresi test terkait lain: AssignableViewTest, ModelControllerFilterTest, DataTableAdaptiveFetchTest, ModelSelectDataTest).

- [x] 5. Show/Edit — withTrashed opt-in di `loadRelations()`
  - [x] 5.1 Tambah parameter `withTrashed` pada `loadRelations()`
    - Edit `app/Traits/DataTable.php:271` (koreksi lokasi dari design.md — `loadRelations()` ada di `DataTable.php`, bukan `LinkModel.php`) — tambah parameter `bool $withTrashed = false`; bila `true`, load tiap relasi dengan closure yang apply `withTrashed()` untuk model bertrait `SoftDeletes`
    - Ditambah: `relationDefinesOwnWithTrashed()` (private, instance method) — deteksi reflection sama pola Task 3.1, skip relasi yang sudah override `withTrashed()` sendiri
    - Default `false` — tidak mengubah perilaku pemanggilan `loadRelations()` existing di luar Show
    - _Requirements: 2.1, 4.3_
  - [x] 5.2 Aktifkan `withTrashed: true` di controller Show model prioritas
    - Diaktifkan di 4 controller: `AccountController.php:88`, `ItemController.php:99`, `PaymentEntryController.php:149`, `TodoController.php:84` — sesuai prioritas tinggi audit sebelumnya (Account/Item/PaymentEntry/Todo)
    - Catatan: masih ada ~43 pemanggilan `loadRelations()` lain di controller lain (grep `loadRelations()` di `app/Http/Controllers`) yang BELUM diaktifkan — di luar scope tasks ini, rollout bertahap terpisah bila diperlukan
    - _Requirements: 2.1_
  - [x] 5.3 Write feature tests for Show withTrashed (Property 2)
    - File: `tests/Feature/Traits/DataTableLoadRelationsSoftDeleteTest.php` (3 test, semua pass) — pakai `Category`/`Unit` (bukan lewat HTTP endpoint, langsung level model) karena lebih terarah dan tidak bergantung route/middleware
    - **Validates: Requirements 2.1, 2.2**

- [x] 6. Checkpoint - Ensure Show backend tests pass
  - 3/3 test pass.

- [x] 7. Frontend — badge peringatan dan wajib isi ulang di `LinkModel.jsx`
  - [x] 7.1 Render badge saat `value.deleted_at` terisi
    - Edit `resources/js/Components/LinkModel.jsx` — `isDeleted = !!option?.deleted_at`, render `<p>` warna warning setelah `</Popover>` (pola sama `InputError.jsx`, warna kuning bukan merah karena ini informasi bukan error validasi)
    - Key lang baru: `core.form.link_model_deleted` / `core.form.link_model_deleted_reselect_required` (`lang/en/core/form.php`, `lang/id/core/form.php`)
    - _Requirements: 2.3_
  - [x] 7.2 Tambah prop `requireReselectIfDeleted` dan blocking submit
    - Pendekatan yang dipilih: **auto-null on detect** (bukan biarkan tampil+badge) — begitu `requireReselectIfDeleted && isDeleted` terdeteksi (via `useEffect` + `reselectHandledRef` guard supaya cuma sekali), `setOption(null)` + `setSearch("")`. Field jadi kosong, otomatis invalid oleh validasi `required` yang sudah ada di FormRequest — tidak perlu API baru untuk expose validity state ke form parent
    - _Requirements: 2.4, 2.5_
  - [x] 7.3 Pasang `requireReselectIfDeleted` pada field master-data-operasional
    - Dipasang di `resources/js/Pages/Inventory/Items/FormDetail.jsx` — field `category` dan `default_unit` (Item tidak punya konsep draft/status dokumen — selalu "aktif", jadi prop ini selalu aktif tanpa syarat draft)
    - Wrapper `CategoryLinkModel.jsx`/`UnitLinkModel.jsx` meneruskan prop via `{...props}` — tidak perlu ubah wrapper
    - Catatan: baru 1 form (Item) yang dipasang — form Account/Customer/Supplier/Warehouse dkk BELUM, di luar scope tasks ini (rollout bertahap terpisah)
    - _Requirements: 2.6_
  - [ ]* 7.4 Manual/browser verification
    - Buka form Edit draft dengan relasi yang sengaja di-soft-delete lewat tinker/seeder test, verifikasi badge muncul dan submit ter-blokir sampai field diisi ulang; verifikasi juga dokumen non-draft/final TIDAK diblokir (hanya badge)
    - **Belum dikerjakan** — butuh dev server + browser interaktif berjalan, di luar kemampuan sesi otomatis ini. ESLint pass (0 error) untuk file yang diubah, tapi ini TIDAK membuktikan behavior UI benar
    - _Requirements: 2.5_

- [x] 8. Checkpoint - Ensure frontend behavior verified
  - ESLint pass. Manual browser verification (7.4) belum dikerjakan — lihat catatan di atas.

- [x] 9. Validasi submit — custom Rule `ExistsExcludingTrashed`
  - [x] 9.1 Buat `app/Rules/ExistsExcludingTrashed.php`
    - Implementasikan `ValidationRule` mengikuti struktur `app/Rules/FormatVariantValidation.php` — constructor `$table`, `$column = 'id'`; `validate()` query `DB::table($table)->where($column, $value)->whereNull('deleted_at')->exists()`
    - _Requirements: 3.1, 3.2_
  - [x] 9.2 Write unit tests for `ExistsExcludingTrashed`
    - File: `tests/Feature/Rules/ExistsExcludingTrashedTest.php` (3 test, semua pass)
    - **Validates: Requirements 3.1**
  - [x] 9.3 Audit seluruh FormRequest dengan rule `exists:table,column` ke model ber-SoftDeletes
    - Audit lengkap (bukan sampling) via agent: 108 baris match, 94 baris GANTI (termasuk 2 reklasifikasi manual: `AssigneeRequest.php:17`, `TodoRequest.php:19` — target view `assignables`), 12 baris JANGAN GANTI (semua `country.code`/`currency.code`, model tidak ber-SoftDeletes), 2 baris SUDAH BENAR (`TicketRequest.php:21`, `TicketResponseRequest.php:37` — sudah manual `Rule::exists()->whereNull('deleted_at')`)
    - _Requirements: 3.4_
  - [x] 9.4 Ganti `exists:table,column` menjadi `new ExistsExcludingTrashed(table)` pada FormRequest yang menyasar model ber-SoftDeletes
    - Dikerjakan bertahap per-modul (checkpoint tiap batch, sesuai keputusan user) — **31 file diubah, 94 baris pengganti total, cocok persis dengan estimasi audit Task 9.3**:
      - [x] Finances (7 file): `AccountRequest`, `PaymentMethodRequest`, `PaymentEntryRequest` (2 field kondisional partyable/paymentable via ternary Rule object), `PaymentTermTemplateRequest`, `Rules/PaymentSchedulesRules`, `SalesInvoiceRequest`, `PurchaseInvoiceRequest`
      - [x] Inventory (7 file): `ItemRequest`, `CategoryRequest`, `ItemVariantRequest`, `WarehouseRequest`, `ItemAlternativeRequest`, `StockEntryRequest`, `DeliveryNoteRequest`
      - [x] Purchase (4 file): `PurchaseOrderRequest`, `PurchaseReceiptRequest`, `PurchaseRequestRequest`, `SupplierRequest`
      - [x] Sales (2 file): `SalesOrderRequest`, `InternalOrderRequest` — `CustomerRequest` TIDAK diubah (semua field-nya `country.code`, JANGAN GANTI)
      - [x] Service (1 file): `WorkOrderRequest`
      - [x] User (2 file): `UserRequest`, `RoleRequest`
      - [x] Core (7 file): `ApprovalSchemeRequest`, `WidgetRequest`, `PrintTemplateRequest`, `DashboardRequest`, `DashboardWidgetOrderRequest`, `EmailTemplateSendRequest` — `BranchRequest` TIDAK diubah (semua field-nya `country.code`, JANGAN GANTI)
      - [x] Reklasifikasi manual (2 file): `AssigneeRequest.php`, `TodoRequest.php` (target view `assignables`, shorthand `exists:` tanpa whereNull sebelumnya — beda dari `TicketRequest`/`TicketResponseRequest` yang sudah benar manual dan TIDAK disentuh)
    - Field yang tabelnya TIDAK ber-SoftDeletes (`country.code`, `currency.code`) TIDAK diubah — dikonfirmasi di `AccountRequest`, `PurchaseOrderRequest`, `SalesInvoiceRequest`, `PurchaseInvoiceRequest`, `CustomerRequest`, `BranchRequest`, dll
    - _Requirements: 3.1, 3.2, 3.4_
  - [x] 9.5 Write feature tests for validasi submit (Property 3, level FormRequest)
    - File: `tests/Feature/Http/Requests/SoftDeleteExistsValidationTest.php` (4 test, semua pass) — representatif 3 modul (Finances/`AccountRequest`, Inventory/`ItemRequest`, Purchase/`PurchaseOrderRequest`)
    - Catatan teknis: `Account`/`Supplier` model pakai nested-set (kolom `lft`/`rgt`/`depth` di-generate Eloquent event, tidak ada di migration test-env) — test insert langsung via `DB::table()->insert()`, bypass Eloquent, karena yang diuji adalah rule validasi bukan perilaku model
    - **Validates: Requirements 3.1, 3.2, 3.4**

- [x] 10. Final checkpoint - Ensure all tests pass
  - **62/62 test relevan spec ini lolos** (172 assertion) — `ModelControllerSoftDeleteTest`, `DataTableScopeSoftDeleteTest`, `DataTableLoadRelationsSoftDeleteTest`, `ExistsExcludingTrashedTest`, `SoftDeleteExistsValidationTest`, `TodoTest`, `AssignableViewTest`, `ModelControllerFilterTest`, `DataTableAdaptiveFetchTest`, `ModelSelectDataTest`.
  - `vendor/bin/pint --dirty --format agent`: pass, 0 masalah.
  - ESLint (`LinkModel.jsx`, `FormDetail.jsx`): 0 error.
  - **Full test suite project** (790+ test, di luar file yang disentuh spec): 412 gagal — TAPI seluruhnya **bug pre-existing**, bukan regresi dari spec ini:
    - 362 dari 412 adalah efek domino satu error transaksi SQLite (`cannot start a transaction within a transaction`) yang dipicu bug tak terkait di `RelationTrackerServiceTest`/`ExampleDataServiceTest` (parsing `product` relation di template PrintTemplate).
    - 50 sisanya independen (`CommandSearchFeatureTest`, `PrintTemplate*Test`, `ItemUomBackendSyncTest`, `LocaleKeysTest`, `SubmitableSnapshotFormatTest`, `HasExampleDataTest`) — dikonfirmasi via `git status` bahwa TIDAK ADA file terkait yang tersentuh perubahan sesi ini (kecuali `PrintTemplateRequest.php`, yang diverifikasi tidak menyentuh field yang diuji test-test tersebut).
    - Detail lengkap: memory `project_pretest_bugs_dev_rahmad_5` (dibuat setelah checkpoint ini).
  - Manual/browser verification frontend (Task 7.4): **belum dikerjakan** — butuh dev server + browser interaktif, di luar kemampuan sesi ini.

## Notes

- Task 1 (prasyarat) memblokir efektivitas Task 3 dan 5 — tanpa `forceSelect: true`, `withTrashed()` di List/Show tetap tidak terlihat di response karena `deleted_at` sudah tersaring whitelist kolom lebih dulu.
- Task 3, 5, 9 saling independen setelah Task 1-2 selesai — bisa dikerjakan dalam urutan berbeda bila diperlukan, tapi tasks.md ini urutkan List → Show → Frontend → Validasi karena Frontend (Task 7) bergantung pada Show (Task 5).
- Task 9.3 (audit FormRequest) sengaja dipisah dari 9.4 (penerapan) — supaya daftar lengkap file yang terdampak bisa direview dulu sebelum diedit massal, menghindari over-apply ke field yang tabelnya bukan ber-SoftDeletes (lihat Error Handling di design.md).
- `*Item.php` lain (`PurchaseOrderItem`, `SalesOrderItem`, dst) yang berstruktur relasi paralel dengan `PurchaseRequestItem` TIDAK di-migrasi ke pola `withTrashed($this->status != 'draft')` dalam scope tasks ini — Task 3.1 sudah menutupi kebutuhan List-nya lewat macro global; kebutuhan Show/validasi kondisional per-model itu tetap backlog terpisah sesuai keputusan audit sebelumnya (di luar scope spec ini).

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["1.4"] },
    { "id": 2, "tasks": ["3.1", "5.1", "9.1"] },
    { "id": 3, "tasks": ["3.2", "5.2", "9.2"] },
    { "id": 4, "tasks": ["5.3", "9.3"] },
    { "id": 5, "tasks": ["7.1", "9.4"] },
    { "id": 6, "tasks": ["7.2", "9.5"] },
    { "id": 7, "tasks": ["7.3"] },
    { "id": 8, "tasks": ["7.4"] }
  ]
}
```
