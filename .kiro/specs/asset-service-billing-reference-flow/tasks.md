# Implementation Plan: Asset Service Billing Reference Flow

## Overview

Backend: tambah entry point "create from AssetService" di `AssetService/Show.jsx` + `case 'assetService'` baru pada `SalesOrderController::create()`/`InternalOrderController::create()` (pola sama seperti `PurchaseRequestController::create()` yang sudah ada). `InternalOrderController::create()` saat ini SAMA SEKALI belum punya mekanisme `$ref` (beda dengan `SalesOrderController`) — task ini membangunnya dari nol, bukan sekadar menambah 1 case.

Frontend: hapus kolom picker `referenceable` per-baris di `SalesOrders/Form.jsx` dan `InternalOrders/Form.jsx`, pindahkan logicnya ke `onValueChange` kolom Item (`ItemVariantLinkModel`) — filter kandidat Item, auto-link baris ke `AssetService`/`AssetServiceConsumedItem`, dan lock Item+Quantity untuk baris part.

**Temuan yang mengubah cara implementasi Requirement 7 (auto-derive customer) dari yang tertulis di `design.md`:** karena AssetService header sekarang datang dari `defaultData` (native Eloquent `$svc->loadRelations()` via Inertia props), BUKAN dari pencarian `/model` LinkModel per-baris, batasan kedalaman `with` 2-segmen milik `ModelController` **tidak berlaku** di sini — itu batasan endpoint `/model`, bukan batasan `Eloquent::load()`. Jadi customer/ownership-customer bisa di-eager-load penuh (termasuk chain 3 segmen `assetMaintenanceTask.assetMaintenance.asset.ownershipCustomer`) di controller, dan FE tinggal baca langsung dari `data.referenceable` yang sudah dimuat di state form — TIDAK perlu request `/model` terpisah lagi untuk auto-derive customer, baik untuk baris jasa maupun baris part. Ini strictly lebih baik dari yang direncanakan design.md (Req 7.2 semula mengasumsikan path `ownership_customer` tidak bisa dipakai untuk baris part — sekarang BISA).

## Tasks

- [x] 1. Backend — entry point & prefill dokumen dari AssetService
  - [x] 1.1 `resources/js/Pages/Asset/Services/Show.jsx` — tambah 2 tombol aksi ("Buat Sales Order", "Buat Internal Order") di blok `controls()` (pola sama seperti tombol `create_pr`/`create_po` yang sudah ada di file ini), masing-masing `<Link href={route("salesOrders.create", {ref: `assetService/${assetService.id}`})}>` dan `route("internalOrders.create", ...)`, dibungkus `canGlobal("App\\Models\\Sales\\SalesOrder", "create")` / `canGlobal("App\\Models\\Sales\\InternalOrder", "create")`, gate sama seperti tombol existing (`canRequestPurchase` / `assetService?.submitted_at`)
    - Tambah key `asset.service.actions.create_so` + `create_io` di `lang/id/asset/service.php` dan `lang/en/asset/service.php`
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 1.2 `app/Http/Controllers/Sales/SalesOrderController.php` — tambah `case 'assetService':` baru pada switch `$modelOri` di `create()` (di samping case `workOrder`/`quotation` yang sudah ada)
    - Import `App\Models\Asset\AssetService`, `App\Models\Asset\AssetServiceConsumedItem`
    - `$svc = AssetService::find($split[1]); if ($svc) { $svc->loadRelations(); ... }`
    - `defaultData`: `date`, `referenceable_type => AssetService::class`, `referenceable_id => $svc->id`, `referenceable => $svc`, `items => $svc->consumedItems->map(...)` — tiap baris: `id` (`Utils::generateRandom(5)`), `item` (`$item->item`, ItemVariant), `quantity` (`$item->quantity`), `unit` (`$item->itemUnit`), `referenceable` (`$item`), `referenceable_type => AssetServiceConsumedItem::class`, `referenceable_id => $item->id`. TIDAK memfilter `is_stock_item` (beda dari pola PurchaseRequestController — billing part harus mencakup non-stock item juga)
    - _Requirements: 2.1, 2.2_

  - [x] 1.3 `app/Http/Controllers/Sales/InternalOrderController.php` — ubah signature `create()` jadi `create(Request $request, ?string $ref = null)` (saat ini TIDAK menerima param apapun, padahal route `internalOrders/create/{ref?}` sudah mendukungnya lewat `Route::resourceDetail` — dipakai tapi diabaikan), tambah switch `$modelOri` dengan `case 'assetService':` (pola sama seperti Task 1.2, TANPA field `price` karena `InternalOrderItem` tidak punya kolom itu), render `Inertia::render('Sales/InternalOrders/Show', ['defaultData' => $defaultData ?? null])`
    - _Requirements: 2.3_

  - [x] 1.4 `resources/js/Pages/Sales/InternalOrders/Form.jsx` — tambah field "Reference To" read-only di header (SAAT INI TIDAK ADA SAMA SEKALI di form ini), mirror pola persis `SalesOrders/Form.jsx` baris ~522-535 (`{data.referenceable && <FormInput ...><LinkModel disabledAddButton model={data.referenceable_type} value={data.referenceable} /></FormInput>}`)
    - Tambah key `sales.internalOrder.columns.reference_to` di `lang/id/sales/internalOrder.php` + `lang/en/sales/internalOrder.php` (cek dulu apakah sudah ada — kalau `SalesOrders` versi sudah ada key serupa, samakan penamaan)
    - _Requirements: 2.3 (turunan — field tampilan hasil prefill Task 1.3)_

  - [x] 1.5 Write feature tests for controller create() case 'assetService'
    - **Test: `SalesOrderController::create()` dgn `ref=assetService/{id}` → `referenceable_type`/`referenceable_id`/`items` ter-prefill benar dari `consumedItems`** (assert Inertia props `defaultData`)
    - **Test: `InternalOrderController::create()` dgn `ref=assetService/{id}` → sama, tanpa field `price`**
    - **Test: AssetService tidak ditemukan → `defaultData` null, tidak error**
    - **Validates: Requirements 2.1, 2.2, 2.3**

- [x] 2. Checkpoint - Ensure Task 1 tests pass
  - `php artisan test --compact --filter=SalesOrderController` dan `--filter=InternalOrderController` (atau nama test file baru Task 1.5). Ensure all tests pass, ask the user if questions arise.

- [x] 3. Frontend — SalesOrders/Form.jsx: hapus picker per-baris, filter+lock+auto-derive di Item
  - [x] 3.1 Hapus kolom `referenceable` (baris ~275-353), fungsi `resolveAssetServiceBillingCustomer` (~49-64), konstanta `ASSET_SERVICE_BILLING_CUSTOMER_WITH` (~66-71), import `AssetServiceLinkModel`/`AssetServiceConsumedItemLinkModel` yang jadi tidak terpakai
    - _Requirements: 3.1_

  - [x] 3.2 Kolom `item` (`ItemVariantLinkModel`, baris ~248-274) — saat `data.referenceable_type === "App\\Models\\Asset\\AssetService"`:
    - Tambah prop `filters={{ or: { "item.category.type": "service", id: { in: consumedItemVariantIds } } }}` (pakai grammar filter LinkModel — lihat `app/Services/Core/LinkModelFilterConverter.php`, mendukung `or`/`in` langsung; `consumedItemVariantIds` = `useMemo` dari `data.referenceable?.consumed_items?.map(ci => ci.item?.id).filter(Boolean)`) — HANYA saat referenceable_type cocok, else `filters` tetap kosong (perilaku existing tidak berubah)
    - `onValueChange`: turunkan unit/conversion_factor seperti sekarang (Req 4.5 lama), LALU cari `matched = data.referenceable?.consumed_items?.find(ci => ci.item?.id === val?.id)`:
      - kalau `matched` ketemu → `setData({ referenceable: {type: AssetServiceConsumedItem FQCN, id: matched.id}, quantity: matched.quantity, price: matched.valuation_rate, unit: matched.item_unit, assetServiceLocked: true })`
      - kalau tidak ketemu TAPI `val.item?.category?.type === "service"` → `setData({ referenceable: {type: AssetService FQCN, id: data.referenceable_id}, assetServiceLocked: false })`
      - customer prefill (baik matched maupun baris jasa langsung): baca LANGSUNG dari `data.referenceable` yang sudah di-load (`bill_to_renter ? {customer, customer_branch} : asset?.ownership_type === "customer" ? {ownership_customer, ownership_customer_branch} : null` — lihat catatan Overview soal kenapa kedua path sekarang bisa dipakai bebas), TIDAK lewat prop `with` LinkModel lagi
    - _Requirements: 4.1, 4.2, 6.1, 6.2, 6.3, 6.5, 7.1, 7.2, 7.3, 7.4_

  - [x] 3.3 Kolom `quantity` (baris ~415-436) — tambah `disabled={!dataRow?.item || dataRow?.assetServiceLocked}` (field baru `assetServiceLocked`, BUKAN field `readOnly`/`isCustom` yang sudah ada di kolom ini — keduanya vestigial, tidak pernah di-set di alur SalesOrder manapun saat ini, dan kalau dipakai ulang berisiko ikut mengunci kolom lain lewat mekanisme row-level `FormTable` `item?.readOnly`)
    - _Requirements: 5.2, 6.4_

  - [x] 3.4 Kolom `item` (Task 3.2) — tambah `disabled={dataRow?.assetServiceLocked}` di prop `ItemVariantLinkModel`
    - _Requirements: 5.1, 6.4_

  - [x] 3.5 Kolom `price` — TIDAK diubah (tetap prefill-tapi-editable, `disabled={!dataRow?.item}` seperti sekarang, jangan tambah `assetServiceLocked`)
    - _Requirements: 5.3_

  - [x] 3.6 Kolom `source_warehouse` — TIDAK diubah sama sekali
    - _Requirements: 5.4_

  - [x] 3.7 Write RTL tests for SalesOrders/Form.jsx (`resources/js/Pages/Sales/SalesOrders/Form.rtl.test.jsx` atau file baru bila belum ada)
    - **Test: kolom referenceable per-baris tidak lagi dirender**
    - **Test: saat `referenceable_type=AssetService`, ItemVariantLinkModel menerima prop `filters` sesuai konsumsi consumed_items**
    - **Test: pilih ItemVariant yang cocok consumedItem → quantity+price+referenceable ter-set, `assetServiceLocked=true`, Item & Quantity input disabled**
    - **Test: pilih ItemVariant type=service tanpa match consumedItem → referenceable ter-set ke AssetService, baris TIDAK locked**
    - **Test: customer ter-prefill dari `data.referenceable` (bill_to_renter dan ownership_customer, tanpa mock request `/model` tambahan)**
    - **Validates: Requirements 3.1, 4.1, 4.2, 5.1, 5.2, 5.3, 5.4, 6.1-6.5, 7.1-7.4**

- [x] 4. Checkpoint - Ensure Task 3 tests pass
  - `npm run test -- SalesOrders/Form`. Ensure all tests pass, ask the user if questions arise.

- [x] 5. Frontend — InternalOrders/Form.jsx: hapus picker per-baris, filter+lock+auto-derive di Item (tanpa price, tanpa customer)
  - [x] 5.1 Hapus kolom `referenceable` (baris ~87-141), import `AssetServiceLinkModel`/`AssetServiceConsumedItemLinkModel` yang jadi tidak terpakai
    - _Requirements: 3.2_

  - [x] 5.2 Kolom `item` (`ItemVariantLinkModel`, baris ~60-86) — filter + auto-link + set `assetServiceLocked`, pola SAMA seperti Task 3.2, TANPA bagian `price` dan TANPA bagian customer prefill (InternalOrder tidak punya field customer)
    - _Requirements: 4.1, 4.2, 6.1, 6.2, 6.3, 6.5_

  - [x] 5.3 Kolom `quantity` (baris ~181-202) — tambah `disabled={!dataRow?.item || dataRow?.assetServiceLocked}`
    - _Requirements: 5.2, 6.4_

  - [x] 5.4 Kolom `item` (Task 5.2) — tambah `disabled={dataRow?.assetServiceLocked}`
    - _Requirements: 5.1, 6.4_

  - [x] 5.5 Kolom `source_warehouse` — TIDAK diubah
    - _Requirements: 5.4_

  - [x] 5.6 Write RTL tests for InternalOrders/Form.jsx (pola sama Task 3.7, minus test customer/price)
    - **Validates: Requirements 3.2, 4.1, 4.2, 5.1, 5.2, 5.4, 6.1-6.5**

- [x] 6. Checkpoint - Ensure Task 5 tests pass
  - `npm run test -- InternalOrders/Form`. Ensure all tests pass, ask the user if questions arise.

- [x] 7. Regresi & verifikasi visual
  - [x] 7.1 Regression: `SalesOrderRequest`/`InternalOrderRequest` — jalankan test existing spec `asset-service-billing` (`validateAssetServiceReferenceables`), pastikan tetap hijau TANPA modifikasi kode request (Requirement 8)
    - _Requirements: 8.1, 8.2_ — 16 test hijau (SalesOrderRequestReferenceableTest, InternalOrderRequestReferenceableTest, AssetServiceLinkModelSearchTest)

  - [x] 7.2 Full backend test suite — jalankan per-domain terpisah (Sales, Asset, Purchase) untuk hindari memory exhaustion PHPUnit gabungan (pola yang sudah terverifikasi sesi sebelumnya)
    - `php artisan test --compact tests/Feature/Sales tests/Unit/Sales` → 53 passed (dijalankan 2x, sebelum & sesudah bugfix Task 7.4)
    - `php artisan test --compact tests/Feature/Asset tests/Unit/Asset` → 238 passed, 7 failed (SEMUA pre-existing, `purchase_receipts.code` NOT NULL — didokumentasikan `project_pretest_bugs_dev_rahmad_5.md`, TIDAK terkait spec ini)
    - Ensure all tests pass, ask the user if questions arise.

  - [x] 7.3 Full frontend test suite — `npm run test`
    - 216/217 file, 2578/2581 test passed. 1 file gagal (`Finances/PurchaseInvoice/Form.rtl.test.jsx`, 3 test) — file itu SUDAH `git modified` (WIP tak terkait) SEBELUM sesi ini mulai, di-flag terpisah via spawn_task, BUKAN regresi dari spec ini.
    - Dijalankan ULANG setelah bugfix Task 7.4 (lihat catatan di bawah) — hasil final harus dicek ulang di Task 8.

  - [x] 7.4 Visual test — ditemukan DAN DIPERBAIKI 2 bug nyata via testing manual di browser (bukan cuma "verifikasi jalan", genuinely menemukan regresi):
    1. **Bug controller**: `SalesOrderController`/`InternalOrderController` case `assetService` TIDAK mengisi `price`/`assetServiceLocked` pada baris hasil prefill (Requirement 5.1-5.3 gagal utk baris awal, hanya jalan utk baris hasil auto-link manual). Fix: tambah `'price' => $item->valuation_rate` (SalesOrder saja) + `'assetServiceLocked' => true` di kedua controller. Juga tambah prefill `customer`/`customer_branch` level dokumen (SalesOrder, dari `bill_to_renter`/`ownership_customer` via `AssetOwnershipType`) — sebelumnya TIDAK ada sama sekali di controller (Requirement 7 hanya jalan dari interaksi Item picker manual, tidak dari create-from-source langsung).
    2. **Bug KRITIS**: `SalesOrders/Form.jsx` Item column's customer-prefill memanggil `setData({customer, customer_branch})` (form-level, argumen objek) — Inertia `useForm().setData(obj)` MENGGANTI SELURUH data form (bukan merge, lihat `node_modules/@inertiajs/react` `setDataFunction`), menghapus `date`/`referenceable`/`referenceable_type` setiap kali baris ter-auto-link ke customer. Efek berantai: field² itu hilang → filter kolom Item (Requirement 4) berhenti bekerja utk baris berikutnya karena `data.referenceable_type` sudah bukan `AssetService::class` lagi. Fix: ganti ke bentuk updater `setData((prev) => ({...prev, customer, customer_branch}))`. **Root cause asli bug filter Item baris ke-2+, BUKAN staleness efek LinkModel.jsx.**
    3. Mock `setData` di KEDUA file `Form.rtl.test.jsx` (SalesOrders + InternalOrders) diam-diam SELALU merge utk argumen objek — tidak meniru perilaku asli Inertia (replace) — inilah kenapa bug #2 lolos dari RTL test yang sudah ditulis. Diperbaiki supaya persis meniru `@inertiajs/react`.
    4. (Perbaikan tambahan, disetujui user via AskUserQuestion sebelum root cause asli ditemukan) `resources/js/Components/LinkModel.jsx` — 2 effect (`useDidMountEffect` "on open" & "on search") ditambah dependency `filtersKey` (string stabil dari `filters`) supaya component TIDAK memakai closure `filters` basi kalau prop-nya berubah tanpa `open`/`search` ikut berubah. TIDAK terbukti perlu utk bug spesifik ini (root cause aslinya bug #2), tapi tetap perbaikan defensif yang valid secara umum (dipertahankan, sudah lolos full frontend suite) — WAJIB diverifikasi ulang di Task 8 mengingat file ini dipakai luas di seluruh aplikasi.
    - Requirement 1.1-1.3, 2.1-2.3, 4.1-4.2, 5.1-5.4, 6.1-6.5, 7.1-7.4 — SEMUA terverifikasi benar di browser sungguhan setelah fix di atas (termasuk filter baris dinamis ke-3, lock, customer prefill, price prefill, reference_to tetap utuh).

- [x] 8. Final checkpoint - Ensure all tests pass
  - Backend Sales 53/53 (2x run pasca-fix), Asset 238/245 (7 gagal pre-existing tak terkait, identik baseline awal sesi), frontend 2578/2581 (3 gagal di file lain yg sudah dirty sebelum sesi ini, sudah di-flag terpisah). Semua hijau utk scope spec ini.

- [x] 9. Lint/format (HANYA setelah semua task di atas selesai) — Pint fix 2 file (formatting saja, non-fungsional), eslint 0 error setelah perbaikan 2 warning jsdoc
  - `vendor/bin/pint --dirty --format agent`
  - `npm run lint` (atau perintah eslint project) untuk file JS yang diubah

## Notes

- Tidak ada migration baru — field `referenceable_type`/`referenceable_id` level dokumen sudah ada di `sales_orders`/`internal_orders`.
- `assetServiceLocked` adalah field BARU pada tiap object baris `items[]` (client-side state saja, bukan kolom DB) — tidak dikirim/divalidasi backend (backend hanya peduli `referenceable.type`/`referenceable.id` per baris, seperti sekarang).
- Task 1.3 adalah task PALING BERISIKO di plan ini — `InternalOrderController::create()` berubah dari tanpa-parameter jadi menerima `$ref`, pastikan tidak ada test/route lama yang bergantung pada signature lama sebelum mengubahnya (`php artisan route:list --name=internalOrders.create` untuk konfirmasi route sudah benar sebelum & sesudah).
- Checkpoint 2/4/6 memvalidasi tiap layer terpisah sebelum lanjut — kalau ada yang gagal, TIDAK lanjut ke task berikutnya sebelum fix.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["1.4", "1.5"] },
    { "id": 2, "tasks": ["2"] },
    { "id": 3, "tasks": ["3.1"] },
    { "id": 4, "tasks": ["3.2"] },
    { "id": 5, "tasks": ["3.3", "3.4", "3.5", "3.6"] },
    { "id": 6, "tasks": ["3.7"] },
    { "id": 7, "tasks": ["4"] },
    { "id": 8, "tasks": ["5.1"] },
    { "id": 9, "tasks": ["5.2"] },
    { "id": 10, "tasks": ["5.3", "5.4", "5.5"] },
    { "id": 11, "tasks": ["5.6"] },
    { "id": 12, "tasks": ["6"] },
    { "id": 13, "tasks": ["7.1", "7.2", "7.3", "7.4"] },
    { "id": 14, "tasks": ["8"] },
    { "id": 15, "tasks": ["9"] }
  ]
}
```
