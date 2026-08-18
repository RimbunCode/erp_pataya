# Implementation Plan: Asset Management — Depreciation

## Overview

Implementasi mengikuti alur schedule-then-post: migration+model dulu, lalu 4 strategy kalkulasi (diuji terisolasi tanpa DB), generator yang memanggil strategy saat Asset approved, lalu 3 titik posting GL (periodic/scrap/value-adjustment) — SEMUANYA reuse penuh infrastruktur `GlPostingStatus` (tabel, model, halaman monitoring) dari commit lokal `dev-rahmad-5` (migrasi Fase 3 event-listener "GL posting via queue"), yang SUDAH di-rebase ke branch ini. `AssetDepreciationSchedule`/`AssetValueAdjustment` TIDAK punya kolom `posted`/`journal_entry_id` sendiri — status posting sepenuhnya dilacak via `GlPostingStatus` (polymorphic). `AssetCategoryAccount`, `Asset` model dasar, `Submitable` trait, dan `GlPostingStatus` sendiri TIDAK berubah strukturnya — spec ini murni KONSUMEN infrastruktur itu, bukan pembuatnya.

**Prasyarat**: branch ini sudah di-rebase di atas `dev-rahmad-5` (dilakukan sebelum tasks.md ini ditulis) — `app/Models/Core/GlPostingStatus.php`, tabel `gl_posting_statuses`, kolom `transaction_date` di `general_ledgers`, dan halaman monitoring `Core/GlPostingStatuses/Index.jsx` semua SUDAH TERSEDIA di working tree. Jangan buat ulang salah satu dari ini.

## Tasks

- [x] 1. Migration — tabel baru & kolom tambahan
  - [x] 1.1 Buat migration `create_asset_depreciation_schedules_table`
    - Kolom: `id` (ulid), `asset_id` (FK restrictOnDelete), `schedule_date`, `depreciation_amount`, `accumulated_depreciation_amount`, `is_example`, timestamps, softDeletes. TIDAK ADA kolom `posted`/`journal_entry_id` (dilacak via `GlPostingStatus`, morphTo `referenceable`)
    - _Requirements: 1.6_

  - [x] 1.2 Buat migration `create_asset_value_adjustments_table`
    - Kolom: `code` unique, `asset_id`, `date`, `current_asset_value`, `new_asset_value`, `difference_account_id`, `branch_id`, field Submitable standar (`status` json, `submitted_at`, `canceled_at`, `amended_from_id`, `revision_number`, `created_by_id`, `additional_data`), `is_example`. TIDAK ADA `journal_entry_id`
    - _Requirements: 5.1_

  - [x] 1.3 Buat migration tambahan kolom `assets`: `depreciation_start_date` (date, nullable)
    - _Requirements: 1.1_

- [x] 2. Checkpoint - Ensure migrations run clean
  - 3 migration baru syntactically valid, dijalankan tanpa error di batch migrate (MySQL dev DB) sebelum menyentuh view pre-existing tak terkait. Test suite pakai SQLite `:memory:` (`phpunit.xml`) via `RefreshDatabase` per-test — divalidasi via task 3+ berikutnya.
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Model `AssetDepreciationSchedule`
  - [x] 3.1 Buat `app/Models/Asset/AssetDepreciationSchedule.php`
    - `DataTable, HasUlids, SoftDeletes`, casts, relasi `asset()` (BelongsTo), `glPostingStatus()` (MorphOne → `App\Models\Core\GlPostingStatus`). Catatan: `PurchaseReceipt`/`DeliveryNote`/`PurchaseInvoice` TIDAK punya relasi `glPostingStatus()` sendiri (Fase 3 query manual via where()) — ditulis dari Laravel `morphOne()` API standar
    - _Requirements: 1.6_

  - [x] 3.2 Tambah relasi `depreciationSchedules()` (HasMany) ke `Asset.php`
    - _Requirements: 1.1_

  - [x] 3.3 Write unit tests for `AssetDepreciationSchedule` (Model Relation Test)
    - **Relation test**: `asset()` dan `glPostingStatus()` resolve dengan benar
    - **Validates: Requirements 1.6**
    - 3/3 test PASS

- [x] 4. Checkpoint - Ensure model tests pass
  - 3/3 PASS
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Strategy kalkulasi depresiasi (4 metode)
  - [x] 5.1 Buat `App\Services\Asset\Depreciation\DepreciationMethodContract` (interface)
    - Method `calculate(Asset $asset): array` — return array baris `{schedule_date, depreciation_amount, accumulated_depreciation_amount}`
    - _Requirements: 2.5_

  - [x] 5.2 Buat `App\Services\Asset\Depreciation\Methods\StraightLineDepreciationMethod`
    - Formula flat: `(total_asset_cost - expected_value_after_useful_life) / total_number_of_depreciations` per periode, basis mulai dari `opening_accumulated_depreciation`, clamp baris terakhir ke salvage floor
    - _Requirements: 2.1, 1.4, 1.5_

  - [x] 5.3 Buat `App\Services\Asset\Depreciation\Methods\DoubleDecliningBalanceDepreciationMethod`
    - Formula: `nilai_buku_awal_periode * (2 / total_number_of_depreciations)`, nilai buku menurun tiap iterasi, clamp salvage floor
    - _Requirements: 2.2, 1.4, 1.5_

  - [x] 5.4 Buat `App\Services\Asset\Depreciation\Methods\WrittenDownValueDepreciationMethod`
    - Formula: `nilai_buku_awal_periode * rate_of_depreciation`, clamp salvage floor
    - _Requirements: 2.3, 1.4, 1.5_

  - [x] 5.5 Buat `App\Services\Asset\Depreciation\Methods\ManualDepreciationMethod`
    - Return N baris dengan `depreciation_amount = 0` (placeholder, user isi manual sebelum posting)
    - _Requirements: 2.4_

  - [x] 5.6 Buat `App\Services\Asset\Depreciation\DepreciationMethodFactory`
    - `make(string $method): DepreciationMethodContract`
    - _Requirements: 2.5_

  - [x] 5.7 Write unit tests for 4 strategy (Depreciation Calculation Property)
    - **Straight Line test**: total akumulasi akhir = `total_asset_cost - expected_value_after_useful_life`, jumlah baris = `total_number_of_depreciations`
    - **Double Declining Balance test**: tiap periode amount menurun, tidak melebihi salvage floor
    - **Written Down Value test**: amount dari nilai buku sisa, tidak melebihi salvage floor
    - **Manual test**: seluruh baris `depreciation_amount = 0`
    - **Salvage floor property**: _for any_ kombinasi valid input, `SUM(depreciation_amount) + opening_accumulated_depreciation` tidak pernah melebihi depreciable base
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 1.4, 1.5**
    - Catatan: `total_asset_cost` adalah computed accessor (bukan kolom fisik) — test set `gross_purchase_amount` langsung. 10/10 test PASS termasuk factory.

- [x] 6. Checkpoint - Ensure strategy tests pass
  - 10/10 PASS
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Generator schedule & integrasi `AssetService::onApproved()`
  - [x] 7.1 Buat `App\Services\Asset\Depreciation\DepreciationScheduleGenerator`
    - `generate(Asset $asset): void` — pilih strategy, hitung baris, `AssetDepreciationSchedule::insert()` bulk. TIDAK membuat `GlPostingStatus` di sini (baru dibuat saat command posting jalan). Throw `LogicException` jika `total_number_of_depreciations` kosong/0
    - _Requirements: 1.1, 1.2, 1.3, 1.5_

  - [x] 7.2 Update `AssetService::onApproved()` — panggil generator jika `calculate_depreciation === true`
    - _Requirements: 1.1, 1.2_

  - [x] 7.3 Write feature tests for schedule generation (Generation on Approval Test)
    - **Generation test**: submit Asset dengan `calculate_depreciation=true` menghasilkan N baris schedule, TIDAK ADA `GlPostingStatus` yang dibuat di titik ini
    - **No-generation test**: `calculate_depreciation=false` tidak menghasilkan baris apapun
    - **Existing asset test**: `asset_type != existing_asset` mulai dari `opening_accumulated_depreciation`
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.5, 1.6**
    - 4/4 test PASS

- [x] 8. Checkpoint - Ensure generator tests pass
  - 4/4 PASS
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Event/Listener posting berkala & command terjadwal (reuse GlPostingStatus)
  - [x] 9.1 Buat `App\Events\Asset\AssetDepreciationDue`
    - Bawa `readonly AssetDepreciationSchedule $schedule` dan `readonly \DateTimeInterface $transactionDate` — pola PERSIS `PurchaseReceiptGeneralLedgerPostingRequested`
    - _Requirements: 3.2_

  - [x] 9.2 Buat `App\Listeners\Asset\Depreciation\PostDepreciationEntry`
    - `implements ShouldQueue`, `$tries = 3`, `$backoff = [10, 30, 60]`. `handle()`: `DB::transaction()`, resolve akun via `$asset->branch()?->id` (CATATAN: `Asset::branch()` metode biasa BUKAN relasi Eloquent — akses via method call, BUKAN property `$asset->branch`, kalau tidak Laravel magic __get lempar LogicException "must return a relationship instance"), throw jika akun tidak ada, GL sepasang, update `GlPostingStatus` → posted, cek fully-depreciated
    - _Requirements: 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

  - [x] 9.3 Daftarkan `AssetDepreciationDue::class => [PostDepreciationEntry::class]` di `EventServiceProvider::$listen`
    - _Requirements: 3.2_

  - [x] 9.4 Buat `App\Console\Commands\Asset\PostAssetDepreciationCommand`
    - _Requirements: 3.1, 3.8_

  - [x] 9.5 Daftarkan schedule di `routes/console.php`
    - _Requirements: 3.1_

  - [x] 9.6 Tambah cabang `AssetDepreciationSchedule::class` ke `resolveRetryEvent()` di `GlPostingStatusController`
    - _Requirements: 3.4_

  - [x] 9.7 Write feature tests for posting (Posting Idempotency & Balance Test)
    - 5 test listener (`PostDepreciationEntryTest`) + 4 test command (`PostAssetDepreciationCommandTest`) — semua PASS
    - Catatan implementasi: `RefreshDatabase` tidak isolasi bersih antar test method dalam class yang listener-nya sendiri buka `DB::transaction()` — `FormatingSeries::create()` di `setUp()` collide unique constraint pada test ke-2+. Fix: `firstOrCreate()` bukan `create()`
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8**

- [x] 10. Checkpoint - Ensure posting & command tests pass
  - 9/9 PASS
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Write-off saat scrap (Event/Listener, reuse GlPostingStatus)
  - [x] 11.1 Tambah `Asset::bookValue()` accessor
    - _Requirements: 4.2_

  - [x] 11.2 Buat `App\Events\Asset\AssetScrapped`
    - _Requirements: 4.2_

  - [x] 11.3 Buat `App\Listeners\Asset\Depreciation\PostScrapWriteOff`
    - _Requirements: 4.2, 4.3_

  - [x] 11.4 Daftarkan `AssetScrapped::class => [PostScrapWriteOff::class]` di `EventServiceProvider::$listen`
    - _Requirements: 4.2_

  - [x] 11.5 Update `Asset::scrap()` — hapus baris schedule belum-posted, JIKA `is_depreciable && bookValue() > 0`: `GlPostingStatus` pending + dispatch `AssetScrapped`
    - _Requirements: 4.1, 4.2, 4.4_

  - [x] 11.6 Tambah cabang `Asset::class` ke `resolveRetryEvent()`
    - _Requirements: 4.2_

  - [x] 11.7 Write feature tests for scrap write-off (Scrap Write-off Test)
    - 4/4 test PASS, tidak ada regresi di `AssetTest.php` (23/23 tetap PASS)
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**

- [x] 12. Checkpoint - Ensure scrap write-off tests pass
  - 4/4 PASS, 0 regresi
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Model, Service & Event/Listener `AssetValueAdjustment`
  - [x] 13.1 Buat `app/Models/Asset/AssetValueAdjustment.php`
    - _Requirements: 5.1_

  - [x] 13.2 Buat `App\Events\Asset\AssetValueAdjustmentApproved`
    - _Requirements: 5.2_

  - [x] 13.3 Buat `App\Listeners\Asset\Depreciation\PostValueAdjustmentEntry`
    - _Requirements: 5.2, 5.3_

  - [x] 13.4 Daftarkan `AssetValueAdjustmentApproved::class => [PostValueAdjustmentEntry::class]` di `EventServiceProvider::$listen`
    - _Requirements: 5.2_

  - [x] 13.5 Buat `App\Services\Asset\AssetValueAdjustmentService implements SubmitableService`
    - _Requirements: 5.2, 5.3_

  - [x] 13.6 Buat `App\Http\Controllers\Asset\AssetValueAdjustmentController` + FormRequest
    - _Requirements: 5.1_

  - [x] 13.7 Daftarkan route `assetValueAdjustments` di `routes/web.php`
    - _Requirements: 5.1_

  - [x] 13.8 Tambah cabang `AssetValueAdjustment::class` ke `resolveRetryEvent()`
    - _Requirements: 5.2_

  - [x] 13.9 Write feature tests for AssetValueAdjustment (Adjustment Submit Test)
    - 3 test PASS (2 service-level + 1 listener-level GL posting)
    - **Validates: Requirements 5.1, 5.2, 5.3**

- [x] 14. Checkpoint - Ensure AssetValueAdjustment backend tests pass
  - 3/3 PASS
  - Ensure all tests pass, ask the user if questions arise.

- [x] 15. Lang (i18n) untuk AssetValueAdjustment & pesan error terkait
  - [x] 15.1 Tambah `lang/{en,id}/asset/valueAdjustment.php` — field labels, status, pesan error
    - _Requirements: 5.1_

  - [x] 15.2 Write parity test (Lang Parity Test)
    - Extend `AssetTranslationParityTest` data provider (bukan file test baru) — 9/9 test PASS

- [x] 16. Halaman Inertia — AssetValueAdjustment (Requirement 7.2)
  - [x] 16.1 Buat `resources/js/Pages/Asset/ValueAdjustments/{Index,Form,Show}.jsx`
    - Dibuat juga `Asset/Assets/AssetLinkModel.jsx` baru (belum ada sebelumnya). Pola sama submittable existing (`Asset/Assets/{Index,Form,Show}.jsx`)
    - _Requirements: 5.1, 7.2_

  - [x] 16.2 Daftarkan menu "Asset Value Adjustments" ke sidebar (grup "Assets" existing dari Spec 1)
    - _Requirements: 7.2_

- [x] 17. Final checkpoint - Ensure all tests pass, verifikasi visual
  - **Full test suite domain Asset**: 164 test PASS, 0 failure
  - **Full test suite project**: 1171 test, 3139 assertion, 4 failure — SEMUA di luar scope Spec 3 (`EmailTemplateRenderServiceTest`, `PrintPdfControllerTest`, `TodoReminderServiceTest`, `UserShowOtherUserTest` — domain Core/User, pre-existing sejak sebelum Spec 3, sama seperti dicatat di Spec 2 task 12). **0 regresi dari Spec 3 dikonfirmasi.**
  - **Pint**: `vendor/bin/pint --dirty --format agent` → `{"result":"pass"}`, bersih
  - **ESLint**: dijalankan scoped ke file baru/berubah (`ValueAdjustments/*.jsx`, `AssetLinkModel.jsx`, `AppSidebar.jsx`) → 0 error/warning
  - Verifikasi manual/browser: TIDAK dilakukan sesi ini — konsisten keputusan Spec 2 (tooling browser lokal dibatasi, business logic sudah tercakup penuh oleh 164 test otomatis termasuk listener-level GL posting)
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Setiap task mereferensikan requirement spesifik untuk traceability ke `requirements.md`.
- **Reuse infrastruktur adalah prinsip inti spec ini** — sebelum menulis kode baru di task manapun yang menyentuh posting GL/tracking status, baca dulu implementasi existing yang setara dari Fase 3 (`app/Listeners/Purchase/Ledger/PostPurchaseReceiptGeneralLedger.php`, `app/Models/Core/GlPostingStatus.php`, `app/Http/Controllers/Core/GlPostingStatusController.php`) sebagai referensi PERSIS, bukan menebak pola dari file lain yang lebih lama (mis. `StockEntryService`, yang ditulis sebelum pola Event/Listener+GlPostingStatus ada).
- `AssetDepreciationSchedule` sengaja TIDAK diberi halaman Inertia sendiri (Requirement 7.1).
- Formatter/linter (`vendor/bin/pint`, `npm run lint`) HANYA dijalankan setelah seluruh task selesai (task 17 lulus).
- Task 5 (strategy kalkulasi) sengaja diuji unit murni tanpa DB dulu sebelum diintegrasikan.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["3.1", "3.2", "3.3"] },
    { "id": 2, "tasks": ["5.1", "5.2", "5.3", "5.4", "5.5", "5.6", "5.7"] },
    { "id": 3, "tasks": ["7.1", "7.2", "7.3"] },
    { "id": 4, "tasks": ["9.1", "9.2", "9.3", "9.4", "9.5", "9.6", "9.7"] },
    { "id": 5, "tasks": ["11.1", "11.2", "11.3", "11.4", "11.5", "11.6", "11.7"] },
    { "id": 6, "tasks": ["13.1", "13.2", "13.3", "13.4", "13.5", "13.6", "13.7", "13.8", "13.9"] },
    { "id": 7, "tasks": ["15.1", "15.2"] },
    { "id": 8, "tasks": ["16.1", "16.2"] },
    { "id": 9, "tasks": ["17"] }
  ]
}
```
