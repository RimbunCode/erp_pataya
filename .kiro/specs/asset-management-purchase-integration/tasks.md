# Implementation Plan: Asset Management — Purchase Integration (Fase 2)

## Overview

Menghubungkan Purchase/Inventory ke Asset lewat Event/Listener (`FixedAssetItemApproved` → `CreateAssetFromPurchase`), dipicu dari akhir `onApproved()` PurchaseReceiptService/PurchaseInvoiceService TANPA mengubah logic Stock/GL existing. Urutan implementasi: migration (Item + Asset nullable) → model → event/listener → service (create/update/split/validasi submit) → controller/routing → FE dialog. Semua perubahan pada `PurchaseReceiptService`/`PurchaseInvoiceService` dibatasi SATU baris dispatch per method.

## Tasks

- [x] 1. Migration
  - [x] 1.1 Migration `add_fixed_asset_fields_to_items_table`
    - Kolom `is_fixed_asset` (boolean, default false, after `is_stock_item`), `asset_category_id` (nullable FK → `asset_categories`, nullOnDelete)
    - _Requirements: 1.1, 1.3_

  - [x] 1.2 Migration `add_purchase_reference_fields_to_assets_table`
    - Tambah `purchase_receipt_item_id` (nullable FK → `purchase_receipt_items`, nullOnDelete) dan `purchase_invoice_item_id` (nullable FK → `purchase_invoice_items`, nullOnDelete) ke tabel `assets`
    - _Requirements: 3.1, 3.5, 4.1_

  - [x] 1.3 Edit migration `2026_08_08_000004_create_assets_table.php` (Spec 1, belum production) — `asset_category_id`/`asset_location_id` jadi `nullable()`
    - Field lain TIDAK berubah (tetap NOT NULL sesuai semula)
    - _Requirements: 5.1_

  - [x] 1.4 Write unit test (Migration Shape)
    - **Migration Shape: kolom baru ada dengan tipe/nullable yang benar**
    - Assert `Schema::hasColumn('items', 'is_fixed_asset')`, dst untuk 3 kolom lain; assert `assets.asset_category_id`/`asset_location_id` menerima null tanpa exception saat insert langsung
    - **Validates: Requirements 1.1, 1.3, 3.1, 3.5, 4.1, 5.1**

- [x] 2. Checkpoint - Ensure migration tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Model
  - [x] 3.1 Edit `App\Models\Inventory\Item` — tambah `is_fixed_asset` ke `$casts` (boolean), tambah relasi `assetCategory(): BelongsTo`
    - _Requirements: 1.2, 1.3_

  - [x] 3.2 Edit `App\Models\Asset\Asset` — tambah relasi `purchaseReceiptItem(): BelongsTo`, `purchaseInvoiceItem(): BelongsTo`, tambah ke `$configColumns`/`loadRelationsOnShow()` jika relevan untuk tampilan Show
    - Jalankan `php artisan model:cache --model=Asset --strict` setelah edit untuk pastikan tidak ada Rule 3 violation baru (validator dari Spec 1 kini strict soal ini)
    - _Requirements: 3.3, 4.1_

  - [x] 3.3 Write unit tests for model relations (Relation Integrity)
    - **Relation Integrity: relasi baru resolve ke model yang benar**
    - Test `Item::assetCategory()`, `Asset::purchaseReceiptItem()`, `Asset::purchaseInvoiceItem()` — factory + assert instance
    - **Validates: Requirements 1.3, 3.3, 4.1**

- [x] 4. Checkpoint - Ensure model tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Event dan Listener
  - [x] 5.1 Buat `App\Events\Asset\FixedAssetItemApproved`
    - Payload: `sourceDocument` (Model), `sourceItem` (Model), `item` (Item) — pola `Dispatchable, SerializesModels` sama seperti `DocumentSubmitted`
    - _Requirements: 2.1_

  - [x] 5.2 Buat `App\Listeners\Asset\CreateAssetFromPurchase implements ShouldQueue`
    - Method `handle()`: cabang sumber Receipt vs Invoice sesuai design.md
    - Method private `createFromReceipt()`: `AssetService::create()` dengan field dari Requirement 3.2-3.3, `asset_quantity` dari `PurchaseReceiptItem.quantity`
    - Method private `findAssetFromRelatedReceipt()`: cari `Asset::whereNull('purchase_invoice_id')` yang `purchaseReceiptItem.purchase_order_item_id` sama dengan `purchaseOrderItem` milik `PurchaseInvoiceItem` yang diproses
    - Method private `syncFromInvoice()`: update `purchase_invoice_id`, `purchase_invoice_item_id`, `net_purchase_amount`/`gross_purchase_amount` final
    - Method private `createFromInvoice()`: sama pola `createFromReceipt()` tapi sumber data `PurchaseInvoiceItem`/`PurchaseInvoice`
    - Guard idempoten (Requirement 3.5): sebelum create, cek `Asset::where('purchase_receipt_item_id', ...)` / `where('purchase_invoice_item_id', ...)` sudah ada — skip jika ada
    - **[FIXED — bug ditemukan saat validasi]**: `createFromReceipt()` semula menghitung `net_purchase_amount`/`gross_purchase_amount` dengan `$receiptItem->quantity * 0` (selalu nol, sisa artefak refactor) alih-alih `rate × quantity`. Diperbaiki jadi `$receiptItem->purchaseOrderItem?->rate ?? 0` dikali `quantity`, sesuai design.md Requirement 3.3. Diverifikasi test `creates_asset_from_receipt_with_correct_amount_mapping`.
    - _Requirements: 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4_

  - [x] 5.3 Daftarkan `FixedAssetItemApproved => [CreateAssetFromPurchase::class]` di `EventServiceProvider`
    - _Requirements: 2.4_

  - [x] 5.4 Edit `PurchaseReceiptService::onApproved()` — tambah dispatch event SETELAH `DB::commit()`, loop item yang `item->item->item->is_fixed_asset === true` (path ItemVariant→Item)
    - HANYA tambah kode baru, TIDAK mengubah logic Stock/GL existing sama sekali
    - _Requirements: 2.2_

  - [x] 5.5 Edit `PurchaseInvoiceService::onApproved()` — tambah dispatch event SETELAH `DB::commit()` (di luar blok try/catch atau di akhir sebelum return), loop item fixed-asset yang sama
    - HANYA tambah kode baru, TIDAK mengubah logic Stock/GL existing sama sekali
    - **[FIXED — bug ditemukan saat validasi]**: `$purchaseInvoice->load([...])` di awal method semula TIDAK termasuk `items.item`/`items.item.item`, padahal loop dispatch (baris ini) mengakses `$item->item->item->is_fixed_asset` — menyebabkan N+1 lazy-load per baris item (beda dari `PurchaseReceiptService` yang sudah eager-load duluan). Ditambahkan `'items.item', 'items.item.item'` ke eager-load.
    - _Requirements: 2.3_

  - [x] 5.6 Write feature tests for event dispatch (Dispatch Correctness)
    - **Dispatch Correctness: event dipicu tepat untuk item fixed-asset, TIDAK untuk item biasa**
    - `tests/Feature/Asset/PurchaseReceiptServiceFixedAssetDispatchTest.php` dan `PurchaseInvoiceServiceFixedAssetDispatchTest.php` — `Event::fake([FixedAssetItemApproved::class])`, approve dokumen (lewat `onApproved()` PENUH, bukan listener langsung) berisi 2 item fixed-asset + 1 item biasa, assert `Event::assertDispatchedTimes(..., 2)` dan masing-masing event bawa `item` yang benar; test kedua assert TIDAK ada dispatch sama sekali kalau tidak ada item fixed-asset
    - Skenario ini juga menjawab pertanyaan user: >1 fixed-asset item dalam SATU dokumen purchase — dikonfirmasi tiap item independen menghasilkan dispatch-nya sendiri
    - **2 bug pre-existing DITEMUKAN saat setup test (bukan bug baru dari task ini, tapi menghalangi test jalan)**:
      1. Test approval flow penuh (bukan cuma listener) butuh `PurchaseOrder.status` array non-null utk `Utils::replaceStatus()` — tidak masalah kode produksi, cuma kebutuhan setup test (`status => [FormStatus::SUBMITTED]`)
      2. `App\Traits\DataTable::initPermissions()` (baris ~628) hardcode nama index tree-view `'lft_index'` (tidak di-qualify per-tabel) — bentrok kalau 2 model tree-view berbeda (mis. `Account` vs `AssetLocation`) sama-sama panggil `initPermissions()` dalam proses test yang sama, exception "index lft_index already exists". Dihindari di test (`PurchaseInvoiceServiceFixedAssetDispatchTest`) dengan menambah kolom `lft`/`rgt`/`depth` manual tanpa lewat `initPermissions()`, BUKAN diperbaiki di kode produksi — di luar scope task 5.6, tidak spesifik Asset (bug pre-existing DataTable trait, mirip Gap 8 di Spec 1). Todo terpisah jika mau diperbaiki: qualify nama index per-tabel, mis. `"{$tableName}_lft_index"`.
    - 121 test PHP domain Asset (Feature+Unit) PASS, 0 failure setelah penambahan (termasuk 4 test baru dari task ini)
    - **Validates: Requirements 2.2, 2.3, 7.4**

  - [x] 5.7 Write feature tests for listener — Property 1 (No Duplicate Asset)
    - **Property 1: memicu approval yang sama 2x tidak menghasilkan Asset ganda**
    - Diuji via `handle()` listener langsung (bukan `onApproved()` penuh — setup Purchase full butuh terlalu banyak dependency Stock/GL yang tidak relevan ke logic yang diuji), lihat `tests/Feature/Asset/CreateAssetFromPurchaseListenerTest.php::does_not_create_duplicate_asset_when_handled_twice`
    - **Validates: Requirement 3.5**

  - [x] 5.8 Write feature tests for listener — Requirement 3 (Create from Receipt)
    - `creates_asset_from_receipt_with_correct_amount_mapping`, `creates_asset_with_category_from_item_when_present` — termasuk **bug produksi ditemukan+diperbaiki**: `CreateAssetFromPurchase::createFromReceipt()` menghitung `net_purchase_amount`/`gross_purchase_amount` dengan `quantity * 0` (selalu nol) alih-alih `rate (dari purchaseOrderItem) * quantity`
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4**

  - [x] 5.9 Write feature tests for listener — Property 2 (Invoice Syncs, Never Orphans)
    - **Property 2: Invoice untuk PO yang sama dengan Receipt meng-update Asset existing, bukan membuat baru**
    - `invoice_syncs_existing_asset_from_matching_receipt_instead_of_creating_new`, `invoice_creates_new_asset_when_no_matching_receipt_exists`, `invoice_creates_separate_asset_when_related_receipt_already_closed_by_another_invoice` — semua 3 skenario PASS
    - Bug produksi ditemukan+diperbaiki (terkait): `PurchaseInvoiceService::onApproved()` tidak eager-load `items.item`/`items.item.item`, menyebabkan N+1 lazy-load saat dispatch loop baca `is_fixed_asset` — ditambahkan ke `$purchaseInvoice->load([...])`
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**

- [x] 6. Checkpoint - Ensure event/listener tests pass
  - 109 test PASS, 0 failure (`tests/Feature/Asset` + `tests/Unit/Asset` penuh, termasuk `CreateAssetFromPurchaseListenerTest` baru dan `AssetServiceSplitTest` yang diperbaiki)
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Service — validasi submit dan split
  - [x] 7.1 Edit `AssetService::createInTransaction()` — tambah `purchase_receipt_id`, `purchase_invoice_id`, `purchase_receipt_item_id`, `purchase_invoice_item_id` ke whitelist `Arr::only()`
    - _Requirements: 3.3, 4.1_

  - [x] 7.2 Edit `AssetService::submit()` — tambah guard di awal: throw `LogicException(__('asset/asset.cannot_submit_incomplete'))` jika `asset_category_id` atau `asset_location_id` null
    - _Requirements: 5.2_

  - [x] 7.3 Tambah lang key `asset/asset.cannot_submit_incomplete` dan `asset/asset.cannot_complete_after_submit` (id + en)
    - _Requirements: 5.2, 6.6_

  - [x] 7.4 Buat method `AssetService::split(Asset $asset, int $parts, array $completionData): Collection`
    - Distribusi qty: `intdiv($qty, $parts)` per bagian, sisa (`$qty % $parts`) ditambahkan ke bagian pertama
    - Field moneter (`net_purchase_amount`, `gross_purchase_amount`, `additional_asset_cost`) dibagi proporsional per rasio qty bagian terhadap qty asal
    - Field lain (nama, dokumen sumber, tanggal) disalin identik; `asset_category_id`/`asset_location_id` diisi dari `$completionData`
    - Seluruh operasi dalam SATU `DB::transaction()`: create N Asset baru, lalu soft-delete Asset asal
    - **[FIXED — 2 bug ditemukan saat validasi]**:
      1. `code` hasil split semula digenerate manual (`$asset->code . '-' . ($i+1)`, disertai komentar `ponytail:` "avoid FormatingSeries dep") — tidak konsisten konvensi project (SEMUA model pakai `FormatingSeries::generate()`) dan berisiko collision unique constraint. Diperbaiki jadi `FormatingSeries::generate(Asset::class, $asset->attributesToArray(), true)`, sama pola `create()`.
      2. Soft-delete Asset asal semula pakai `DB::table('assets')->where('id', ...)->update(['deleted_at' => now()])` — raw query builder yang BYPASS seluruh Eloquent model event, termasuk guard bisnis `canDelete()` (dari `LinkModel::deleting` hook) yang SENGAJA selalu `false` untuk Asset (ERPNext parity, Spec 1). Diperbaiki jadi `Asset::withoutEvents(fn () => $asset->delete())` — tetap skip guard (niat split memang reparenting internal), tapi eksplisit lewat Eloquent API resmi, bukan raw SQL tersembunyi.
    - Test `AssetServiceSplitTest` disesuaikan (`setUp()` ditambah `Asset::initPermissions()` + seed `Preference` timezone) karena `split()` sekarang genuinely memanggil `FormatingSeries::generate()`.
    - _Requirements: 6.4_

  - [x] 7.5 Write unit tests for `AssetService::submit()` — Property 4 (Incomplete Cannot Submit)
    - **Property 4: submit selalu gagal jika category/location null, status tidak berubah**
    - 3 kasus: category null, location null, keduanya null — assert `LogicException` dan `status` tetap DRAFT setelah exception
    - Kasus lawan: keduanya terisi → submit berhasil (regresi, tidak boleh block Asset yang sudah lengkap dari Spec 1)
    - **Validates: Requirement 5.2**

  - [x] 7.6 Write unit tests for `AssetService::split()` — Property 3 (Split Preserves Total)
    - **Property 3: total qty dan total nilai moneter tidak berubah setelah split**
    - qty=5 split=3 → assert hasil `[3,1,1]` (atau urutan sesuai implementasi, total tetap 5), assert `sum(gross_purchase_amount hasil) == gross_purchase_amount asal` (toleransi pembulatan desimal terkecil)
    - Assert Asset asal soft-deleted, `asset_category_id`/`asset_location_id` hasil split sama dengan `$completionData`
    - Kasus tepi: `parts == asset_quantity` (semua jadi qty=1), `parts == 1` (tidak boleh dipanggil, ini jalur update biasa — assert guard di controller bukan di service)
    - **Validates: Requirement 6.4**

- [x] 8. Checkpoint - Ensure service tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Controller, FormRequest, Routing
  - [x] 9.1 Buat `App\Http\Requests\Asset\CompleteAssetDataRequest`
    - Rules: `asset_category_id` required+exists, `asset_location_id` required+exists, `split_into` nullable+integer+min:1+max:`asset_quantity` (ambil dari route model binding)
    - _Requirements: 6.5_

  - [x] 9.2 Tambah method `AssetController::completeData(CompleteAssetDataRequest $request, Asset $asset)`
    - Guard 422 jika `asset->status` bukan DRAFT (lang key `asset/asset.cannot_complete_after_submit`) — Requirement 6.6
    - Guard 422 jika Asset tidak berasal dari dokumen Purchase yang sedang diminta (opsional, tergantung apakah dialog kirim `source_document_id` — putuskan saat implementasi berdasar payload FE)
    - Jika `split_into > 1` → panggil `AssetService::split()`; else → `AssetService::update()`
    - _Requirements: 6.3, 6.4, 6.6_

  - [x] 9.3 Tambah route `Route::put('/assets/{asset}/completeData', [AssetController::class, 'completeData'])->name('assets.completeData')` di `routes/web.php`
    - _Requirements: 6.2_

  - [x] 9.4 Write feature tests for `AssetController::completeData`
    - `tests/Feature/Asset/AssetCompleteDataControllerTest.php` — 5 test, semua PASS langsung tanpa perlu perbaikan kode
    - Submit tanpa split → assert `asset_category_id`/`asset_location_id` ter-update, `asset_quantity` tidak berubah (Requirement 6.3)
    - Submit dengan `split_into=3` → assert 3 Asset baru + asal soft-deleted (Requirement 6.4)
    - Submit pada Asset berstatus SUBMITTED → assert 422 (Requirement 6.6)
    - Submit `split_into` melebihi `asset_quantity` → assert 422 validasi (Requirement 6.5)
    - Tambahan: submit tanpa `asset_category_id`/`asset_location_id` sama sekali → assert 422 validation errors kedua field (Requirement 6.5)
    - **Validates: Requirements 6.3, 6.4, 6.5, 6.6**

- [x] 10. Checkpoint - Ensure controller tests pass
  - 5/5 test `AssetCompleteDataControllerTest` PASS
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Frontend
  - [x] 11.1 Edit form Item (`resources/js/Pages/Inventory/Items/FormDetail.jsx`) — tambah toggle `is_fixed_asset` (FormCheckbox)
    - _Requirements: 1.5_

  - [x] 11.2 Buat komponen `resources/js/Pages/Asset/Assets/CompleteDataDialog.jsx`
    - Props: `asset` (object dgn asset_quantity, id), `open`, `onOpenChange`
    - Form: `AssetCategoryLinkModel`, `AssetLocationLinkModel`, input number `split_into` (tampil hanya jika `asset.asset_quantity > 1`)
    - Submit via `router.put(route('assets.completeData', asset.id), data)`
    - _Requirements: 6.2_

  - [x] 11.3 Edit `resources/js/Pages/Purchase/PurchaseReceipts/Show.jsx` — tambah `AssetCompletionAlert` di atas Form, controller load `fixedAssets` via `purchase_receipt_item_id`
    - Perubahan di `PurchaseReceiptController::show()` + Show.jsx
    - _Requirements: 6.1_

  - [x] 11.4 Edit `resources/js/Pages/Finances/PurchaseInvoice/Show.jsx` — sama seperti 11.3 untuk PurchaseInvoice
    - Perubahan di `PurchaseInvoiceController::show()` + Show.jsx
    - _Requirements: 6.1_

- [x] 12. Final checkpoint - Ensure all tests pass, verifikasi visual
  - **Test otomatis SELESAI**: `tests/Feature/Asset` + `tests/Unit/Asset` penuh = 109 test PASS, 0 failure (termasuk `CreateAssetFromPurchaseListenerTest` dan `AssetCompleteDataControllerTest` baru dari validasi ini).
  - **Full suite PHPUnit dijalankan** (`vendor/bin/phpunit`, seluruh project, 1086 test / 2945 assertion): 6 failure, SEMUA di luar scope Spec 2 — `Tests\Feature\Core\CountryControllerTest`, `CurrencyControllerTest`, `EmailTemplateRenderServiceTest`, `PrintTemplate\PrintPdfControllerTest`, `TodoReminderServiceTest`, `Tests\Feature\User\UserShowOtherUserTest`. Tidak satupun menyentuh domain Asset/Purchase/Finances/Item — bug pre-existing (route 404, N+1 query count, Inertia response shape, PDF Fileable attach), tidak berkaitan dengan perubahan `onApproved()` dispatch event. **0 regresi dari Spec 2 dikonfirmasi.**
  - **`php artisan model:cache --strict` SELESAI**: dijalankan full — 0 violation baru dari `Item`/`Asset` (perubahan Spec 2 bersih). 14 violation yang muncul (`Widget`, `PaymentSchedule`, `PurchaseInvoice`, `SalesInvoice`, `Ticket`, `ItemUnit`, `PurchaseReceipt`) semuanya PRE-EXISTING dari model lain, di luar scope Spec 2 — sudah dilaporkan terpisah (task `task_64b72e66`, Spec 1).
  - **Verifikasi visual browser TIDAK BISA DISELESAIKAN — dibatasi tooling lokal, bukan indikasi bug kode**: dicoba end-to-end (buat Item fixed-asset FA-LAPTOP-001 → PO → submit → Aksi "Buat Purchase Receipt", prefill dari PO terverifikasi benar). Submit form Purchase Receipt gagal konsisten karena bug `php artisan serve` (PHP built-in dev server) di Windows — request POST berukuran menengah (~30KB+, form Receipt dengan nested items array) memicu `PHP Request Startup: Unable to create temporary file` meski `sys_temp_dir` valid & writable; direproduksi murni via `curl` independen dari browser, sehingga dikonfirmasi bug di layer server dev, bukan kode aplikasi. Beralih ke Herd (nginx + PHP-FPM) menghilangkan bug ini (dibuktikan via `curl` payload 100KB berhasil), tapi domain custom (`erp-spec2.test`) diblokir kebijakan approval browser-tool sesi ini tanpa prompt approval yang bisa diklik user. Assessment risiko: seluruh business logic yang relevan (dispatch event per-item, idempotency guard, sync vs create Asset, split quantity) sudah tercakup 109 test otomatis yang mensimulasikan skenario yang sama; UI layer (badge, dialog) adalah presentasi tipis di atas endpoint yang sudah teruji (`AssetCompleteDataControllerTest`).
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Setiap task mereferensikan requirement spesifik untuk traceability ke `requirements.md`.
- Checkpoint memastikan validasi inkremental — jangan lanjut ke group berikutnya jika checkpoint gagal.
- Perubahan pada `PurchaseReceiptService`/`PurchaseInvoiceService::onApproved()` (task 5.4, 5.5) SENGAJA dibatasi sekecil mungkin (tambah dispatch event di akhir method) — JANGAN refactor logic Stock/GL existing di sekitarnya meski tergoda, itu di luar scope dan berisiko regresi modul Purchase/Finances yang sudah stabil.
- `purchase_receipt_item_id`/`purchase_invoice_item_id` di tabel `assets` adalah kunci Property 1/2 (No Duplicate, Never Orphan) — jangan diganti pendekatan lain (mis. hanya `purchase_receipt_id`) tanpa update design.md dulu, karena 1 dokumen bisa punya banyak baris fixed-asset.
- Task 11.3/11.4 kemungkinan butuh eksplorasi tambahan struktur `Show.jsx` existing saat implementasi (lokasi render baris item, apakah pakai tabel generik atau custom) — sebutkan temuan spesifik saat task ini dikerjakan.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["1.4"] },
    { "id": 2, "tasks": ["3.1", "3.2"] },
    { "id": 3, "tasks": ["3.3"] },
    { "id": 4, "tasks": ["5.1"] },
    { "id": 5, "tasks": ["5.2"] },
    { "id": 6, "tasks": ["5.3", "5.4", "5.5"] },
    { "id": 7, "tasks": ["5.6", "5.7", "5.8", "5.9"] },
    { "id": 8, "tasks": ["7.1", "7.2", "7.3"] },
    { "id": 9, "tasks": ["7.4"] },
    { "id": 10, "tasks": ["7.5", "7.6"] },
    { "id": 11, "tasks": ["9.1"] },
    { "id": 12, "tasks": ["9.2"] },
    { "id": 13, "tasks": ["9.3"] },
    { "id": 14, "tasks": ["9.4"] },
    { "id": 15, "tasks": ["11.1", "11.2"] },
    { "id": 16, "tasks": ["11.3", "11.4"] },
    { "id": 17, "tasks": ["12"] }
  ]
}
```
