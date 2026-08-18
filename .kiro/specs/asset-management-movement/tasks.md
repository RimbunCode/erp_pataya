# Implementation Plan: asset-management-movement

## Overview

Menambahkan `AssetMovement` (dokumen Submitable) + `AssetMovementItem` (child) untuk mencatat perpindahan Asset (transfer/issue/receipt/transfer_and_issue) dengan approval chain. Efek ke `Asset.asset_location_id`/`custodian_id`/`status` terjadi lewat Event/Listener SYNC (bukan queue — operasi ringan, tanpa GL) di dalam transaksi approval. Tidak ada model/migration baru di luar 2 model inti; tidak menyentuh AssetMaintenance/AssetRepair/Report/Rental (didefer spec lain).

## Tasks

- [x] 1. Enum `AssetMovementPurpose`
  - [x] 1.1 Buat `app/Enums/AssetMovementPurpose.php`
    - 4 case: `ISSUE`, `RECEIPT`, `TRANSFER`, `TRANSFER_AND_ISSUE`, string value snake_case
    - _Requirements: 1.1_

  - [x] 1.2 Verifikasi `FormStatus::ISSUED` eksis di `app/Enums/FormStatus.php`
    - Sudah dikonfirmasi eksis saat brainstorming (baris 55) — cek ulang sebelum lanjut, batalkan asumsi jika berubah
    - _Requirements: 3.3_

- [x] 2. Migration & Model `AssetMovement`
  - [x] 2.1 Migration `create_asset_movements_table`
    - Kolom: `code` (unique), `purpose`, `transaction_date`, `branch_id` (FK), `reference_type`/`reference_id` (nullable), field standar Submitable (`status` json, `submitted_at`, `canceled_at`, `amended_from_id`, `revision_number`, `created_by_id`, `additional_data`, timestamps, `deleted_at`)
    - _Requirements: 1.1_

  - [x] 2.2 Model `app/Models/Asset/AssetMovement.php`
    - Traits `DataTable, HasFactory, HasUlids, SoftDeletes, Submitable`; `$service = AssetMovementService::class`; `formComponent = 'Asset/Movements/Form'`; `translateKey = 'asset.movement'`; cast `purpose` ke `AssetMovementPurpose`, `transaction_date` ke `date`
    - Relasi `items(): HasMany`, `branch(): BelongsTo`
    - `configColumns` untuk DataTable (mengikuti pola `AssetValueAdjustment`)
    - _Requirements: 1.1, 1.3_

  - [x] 2.3 Factory `database/factories/Asset/AssetMovementFactory.php`
    - _Requirements: 1.1_

  - [x] 2.4 Write unit tests for `AssetMovement` (relasi & cast)
    - **Relation test: `items()` mengembalikan `HasMany` ke `AssetMovementItem`, `branch()` ke `Branch`**
    - **Cast test: `purpose` ter-cast ke enum `AssetMovementPurpose`**
    - **Validates: Requirements 1.1**

- [x] 3. Migration & Model `AssetMovementItem`
  - [x] 3.1 Migration `create_asset_movement_items_table`
    - Kolom: `asset_movement_id` (FK), `asset_id` (FK), `source_location_id`/`target_location_id` (FK nullable → asset_locations), `from_custodian_id`/`to_custodian_id` (FK nullable → users), timestamps
    - _Requirements: 1.2_

  - [x] 3.2 Model `app/Models/Asset/AssetMovementItem.php`
    - Relasi `assetMovement()`, `asset()`, `sourceLocation()`, `targetLocation()`, `fromCustodian()`, `toCustodian()` — semua `BelongsTo`
    - _Requirements: 1.2_

  - [x] 3.3 Factory `database/factories/Asset/AssetMovementItemFactory.php`
    - _Requirements: 1.2_

  - [x] 3.4 Write unit tests for `AssetMovementItem` (relasi)
    - **Relation test: keenam relasi BelongsTo mengembalikan model yang benar**
    - **Validates: Requirements 1.2**

- [x] 4. Checkpoint - Ensure model & migration tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Event & Listener
  - [x] 5.1 Event `app/Events/Asset/AssetMovementApproved.php`
    - `Dispatchable`, `readonly AssetMovement $movement` di constructor
    - _Requirements: 3.1_

  - [x] 5.2 Listener `app/Listeners/Asset/Movement/UpdateAssetLocationFromMovement.php`
    - SYNC (bukan `ShouldQueue`) — lihat design.md Architecture
    - Loop `$event->movement->items`: update `asset_location_id` dari `target_location_id` (jika ada), `custodian_id` dari `to_custodian_id` (jika ada)
    - Purpose `ISSUE`/`TRANSFER_AND_ISSUE` → tambah `FormStatus::ISSUED` ke `Asset.status` (unique, tidak hapus status lain)
    - Purpose `RECEIPT` → hapus `FormStatus::ISSUED` dari `Asset.status` jika ada
    - _Requirements: 3.2, 3.3, 3.4_

  - [x] 5.3 Daftarkan listener di `app/Providers/EventServiceProvider.php`
    - `AssetMovementApproved::class => [UpdateAssetLocationFromMovement::class]`
    - _Requirements: 3.1_

  - [x] 5.4 Write unit tests for `UpdateAssetLocationFromMovement`
    - **Sync execution test: listener update Asset location/custodian dalam transaksi yang sama, tanpa queue**
    - **Purpose ISSUE/TRANSFER_AND_ISSUE test: `FormStatus::ISSUED` masuk ke `Asset.status`, status lain tidak hilang**
    - **Purpose RECEIPT test: `FormStatus::ISSUED` dihapus dari `Asset.status`**
    - **Purpose TRANSFER test: lokasi/custodian update, status tidak berubah**
    - **Multi-item test: 1 AssetMovement dengan >1 item, semua Asset ter-update**
    - **Validates: Requirements 3.2, 3.3, 3.4, 3.5**

- [x] 6. Service `AssetMovementService`
  - [x] 6.1 `app/Services/Asset/AssetMovementService.php implements SubmitableService`
    - `onApproved(Model $model)`: dispatch `AssetMovementApproved` (dalam transaksi `checkApproval()`, pola Spec 3)
    - Validasi Requirement 2 (lihat 6.2-6.3) dijalankan sebelum approval efektif — tentukan titik pasti: `beforeApproval()`/validasi FormRequest, sesuai kontrak `SubmitableService` yang sudah ada
    - _Requirements: 3.1_

  - [x] 6.2 Validasi konsistensi lokasi per purpose
    - `transfer`/`transfer_and_issue`: `source_location_id` DAN `target_location_id` wajib terisi di tiap item
    - `issue`: `target_location_id` wajib
    - `receipt`: `source_location_id` wajib
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 6.3 Validasi `source_location_id` match `Asset.asset_location_id` saat ini
    - Tolak submit dengan pesan error jelas jika berbeda
    - _Requirements: 2.4_

  - [x] 6.4 Validasi status Asset harus `ACTIVE` sebelum masuk item Movement
    - Tolak submit jika ada Asset berstatus lain, pesan error sebut kode Asset & status saat ini
    - _Requirements: 2.5_

  - [x] 6.5 Write feature tests for `AssetMovementService`
    - **Validation test: submit ditolak jika source_location_id tidak match Asset saat ini**
    - **Validation test: submit ditolak jika Asset bukan status ACTIVE**
    - **Validation test: submit ditolak jika field lokasi wajib kosong per purpose (4 kasus)**
    - **onApproved test: `AssetMovementApproved` dispatch dengan `Event::fake()`**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 3.1**

- [x] 7. Checkpoint - Ensure Event/Listener/Service tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Controller & Request
  - [x] 8.1 `App\Http\Requests\Asset\AssetMovementRequest`
    - Mengikuti pola `AssetValueAdjustmentRequest`
    - _Requirements: 1.1, 1.2_

  - [x] 8.2 `App\Http\Controllers\Asset\AssetMovementController`
    - CRUD+submit standar mengikuti pola `AssetValueAdjustmentController`
    - `create()`: cek `$request->query('asset_id')` → query `AssetMovement::whereHas('items', ...)` + `json_overlaps` status draft + `created_by_id` user saat ini → redirect ke `show` jika ketemu (adaptasi `QuotationController::create()` baris 39-46)
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 8.3 Route di `routes/web.php`
    - Resource route `asset-movements`, konsisten pola Asset lain
    - _Requirements: 5.1_

  - [x] 8.4 Write feature tests for `AssetMovementController::create()` redirect
    - **Redirect test: user sama, Asset sama, draft existing → redirect ke show draft**
    - **No-redirect test: user BEDA dengan draft existing Asset sama → form baru ditampilkan (Requirement 4.3)**
    - **No-redirect test: tidak ada draft existing → form baru ditampilkan**
    - Deviasi ditemukan saat implementasi: `json_overlaps` (MySQL-only) diganti filter PHP-side `in_array` — SQLite test suite tidak dukung fungsi itu, lihat catatan design.md
    - **Validates: Requirements 4.1, 4.2, 4.3**

- [x] 9. Checkpoint - Ensure controller tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. FE — Pages
  - [x] 10.1 `resources/js/Pages/Asset/Movements/Form.jsx`
    - Header: `purpose` (select), `transaction_date`, `branch_id`
    - Child items: `asset_id` (AssetLinkModel), `source_location_id`/`target_location_id` (AssetLocationLinkModel), `from_custodian_id`/`to_custodian_id` (UserLinkModel) — field visible/required kondisional per `purpose` terpilih
    - Catatan: `branch_id` tidak ditaruh di Form karena pola existing (`AssetValueAdjustments/Form.jsx`) juga tidak expose `branch_id` manual di FE — diisi implisit/nullable, konsisten
    - _Requirements: 5.1_

  - [x] 10.2 `resources/js/Pages/Asset/Movements/Show.jsx`
    - Detail + aksi submit/approve/cancel, mengikuti pola `AssetValueAdjustments/Show.jsx`
    - _Requirements: 5.1_

  - [x] 10.3 `resources/js/Pages/Asset/Movements/Index.jsx`
    - DataTable list, mengikuti pola `AssetValueAdjustments/Index.jsx`
    - _Requirements: 5.1_

  - [x] 10.4 Tambah item navigasi "Asset Movements" ke `resources/js/Components/Sidebar/AppSidebar.jsx`
    - Masuk grup sidebar "Assets" yang sudah ada
    - _Requirements: 5.3_

- [x] 11. Lang
  - [x] 11.1 `lang/en/asset/movement.php` dan `lang/id/asset/movement.php`
    - Label field, pesan error validasi (Requirement 2), pesan redirect (jika ada UI feedback)
    - Ditulis lebih awal (sebelum task 6) karena dibutuhkan `AssetMovementService` untuk pesan error validasi
    - _Requirements: 5.2_

  - [x] 11.2 Write test parity lang (extend `AssetTranslationParityTest` data provider)
    - **Parity test: `movement.php` EN/ID punya key yang sama**
    - **Validates: Requirements 5.2**

- [x] 12. Final checkpoint - Ensure all tests pass
  - Domain Asset: 180/180 pass (387 assertions)
  - Full project suite: 1197 test, 3184 assertions, 4 failure — SAMA PERSIS dengan 4 failure pre-existing yang sudah didokumentasikan sejak Spec 3 (EmailTemplateRenderServiceTest, PrintPdfControllerTest, TodoReminderServiceTest, UserShowOtherUserTest), semuanya di luar domain Asset — TIDAK ADA REGRESI
  - `artisan test --compact` gagal karena memory exhaustion di Renderer.php pada suite besar (issue infra pre-existing, bukan disebabkan spec ini) — workaround: `vendor/bin/phpunit` langsung
  - Pint: 5 file diformat ulang (class_definition, braces_position, dst), tes Asset domain di-re-run pasca-Pint, tetap 180/180 pass
  - ESLint: 0 issue di 4 file JS baru/berubah (`Form.jsx`, `Show.jsx`, `Index.jsx`, `AppSidebar.jsx`)
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Listener `UpdateAssetLocationFromMovement` SENGAJA sync (bukan `ShouldQueue`) — beda dari pola Spec 3 karena operasi ringan tanpa GL, lihat design.md Architecture untuk rasionalisasi lengkap. Jangan default ke queue tanpa evaluasi ulang karakteristik listener.
- Tidak ada `GlPostingStatus` di spec ini — AssetMovement bukan transaksi akuntansi.
- Redirect-to-draft (task 8.2, 8.4) diadaptasi dari `QuotationController::create()` — pola sudah ada di codebase, BUKAN mekanisme baru, cuma level query beda (child `items` via `whereHas`, bukan `referenceable_type/id` header).
- Formatter/linter (Pint, ESLint) HANYA dijalankan setelah task 12 selesai, sesuai aturan project.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1", "3.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "3.2", "3.3"] },
    { "id": 3, "tasks": ["2.4", "3.4"] },
    { "id": 4, "tasks": ["4"] },
    { "id": 5, "tasks": ["5.1"] },
    { "id": 6, "tasks": ["5.2", "6.1"] },
    { "id": 7, "tasks": ["5.3", "6.2", "6.3", "6.4"] },
    { "id": 8, "tasks": ["5.4", "6.5"] },
    { "id": 9, "tasks": ["7"] },
    { "id": 10, "tasks": ["8.1"] },
    { "id": 11, "tasks": ["8.2"] },
    { "id": 12, "tasks": ["8.3", "8.4"] },
    { "id": 13, "tasks": ["9"] },
    { "id": 14, "tasks": ["10.1", "11.1"] },
    { "id": 15, "tasks": ["10.2", "10.3", "10.4", "11.2"] },
    { "id": 16, "tasks": ["12"] }
  ]
}
```
