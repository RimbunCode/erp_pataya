# Requirements Document

## Introduction

Spec `asset-service-billing` (selesai) membangun mekanisme billing customer untuk pekerjaan `AssetService` (repair/maintenance Asset) lewat `SalesOrder`/`InternalOrder`. Implementasinya menaruh picker referensi (`AssetService` untuk baris jasa, `AssetServiceConsumedItem` untuk baris part) di level BARIS FormTable (`SalesOrderItem`/`InternalOrderItem`) — user memilih manual per baris lewat toggle nested LinkModel.

Pendekatan ini punya dua masalah: (1) tidak ada filter pada kolom Item, sehingga user bisa salah pilih Item yang tidak relevan dengan AssetService yang sedang ditagih; (2) referensi ditentukan per-baris secara independen, padahal secara bisnis satu SalesOrder/InternalOrder billing AssetService seharusnya SELALU merujuk ke satu AssetService yang sama di semua barisnya.

Spec ini me-redesain flow tersebut: referensi AssetService dipindah ke level DOKUMEN (reuse field `referenceable_type`/`referenceable_id` yang sudah ada, dipakai bersama untuk pola "create from Quotation/WorkOrder" yang sudah ada), diisi lewat flow "create from source" baru dari halaman `AssetService` Show. Baris FormTable lalu mengikuti header: Item difilter, baris hasil prefill di-lock sebagian, dan baris manual yang cocok otomatis ter-link.

Sistem yang terlibat: `SalesOrderController`/`InternalOrderController` (`create()`), `SalesOrderRequest`/`InternalOrderRequest` (validasi existing, tidak berubah), `resources/js/Pages/Sales/SalesOrders/Form.jsx` dan `InternalOrders/Form.jsx`, `resources/js/Pages/Asset/Services/Show.jsx`.

## Glossary

- **AssetService**: dokumen pekerjaan repair/maintenance Asset yang bisa ditagihkan ke customer.
- **AssetServiceConsumedItem**: baris part/spare-part yang dipakai dalam sebuah AssetService.
- **Baris jasa**: baris SalesOrderItem/InternalOrderItem yang me-refer langsung ke AssetService (menagihkan jasa pengerjaan).
- **Baris part**: baris SalesOrderItem/InternalOrderItem yang me-refer ke AssetServiceConsumedItem (menagihkan part yang dipakai).
- **Reference To**: field dokumen `referenceable_type`/`referenceable_id` pada SalesOrder/InternalOrder, ditampilkan read-only di FE, dipakai untuk mencatat sumber pembuatan dokumen (Quotation/WorkOrder/AssetService).
- **Create-from-source**: pola URL `route('salesOrders.create', {ref: 'modelType/id'})` yang sudah ada untuk Quotation/WorkOrder, memicu prefill `defaultData` di `SalesOrderController::create()`/`InternalOrderController::create()`.

## Requirements

### Requirement 1: Entry point create-from-AssetService

**User Story:** As a staff Asset Service, I want membuat SalesOrder/InternalOrder langsung dari halaman detail AssetService, so that saya tidak perlu mencari dan memilih AssetService manual di form order.

#### Acceptance Criteria

1. THE halaman `AssetService` Show SHALL menampilkan tombol "Buat Sales Order" dan tombol "Buat Internal Order".
2. WHEN user klik tombol "Buat Sales Order", THE sistem SHALL navigasi ke `route('salesOrders.create', {ref: 'assetService/{id}'})` dengan `{id}` adalah id AssetService yang sedang dilihat.
3. WHEN user klik tombol "Buat Internal Order", THE sistem SHALL navigasi ke `route('internalOrders.create', {ref: 'assetService/{id}'})` dengan `{id}` adalah id AssetService yang sedang dilihat.

### Requirement 2: Prefill dokumen dari AssetService

**User Story:** As a staff Sales, I want form SalesOrder/InternalOrder otomatis terisi referensi dan baris item saat dibuat dari AssetService, so that saya tidak perlu input ulang data yang sudah ada di AssetService.

#### Acceptance Criteria

1. WHEN `SalesOrderController::create()` menerima `ref=assetService/{id}`, THE sistem SHALL set `defaultData.referenceable_type` ke `AssetService::class` DAN `defaultData.referenceable_id` ke id AssetService tersebut.
2. WHEN `SalesOrderController::create()` menerima `ref=assetService/{id}`, THE sistem SHALL mengisi `defaultData.items` dari `consumedItems` milik AssetService tersebut, dengan tiap baris berisi `item` (ItemVariant consumedItem), `quantity`, `unit`, `referenceable` (consumedItem itu sendiri), `referenceable_type: AssetServiceConsumedItem::class`, DAN `referenceable_id`.
3. THE `InternalOrderController::create()` SHALL berperilaku setara dengan Acceptance Criteria 1 dan 2 di atas untuk `internalOrders.create`.
4. IF AssetService yang direferensikan tidak ditemukan atau tidak berstatus approved, THEN THE sistem SHALL menampilkan perilaku error yang sama seperti pola create-from-source existing (Quotation/WorkOrder) untuk kondisi serupa.

### Requirement 3: Hapus picker referenceable per-baris

**User Story:** As a staff Sales, I want kolom "Asset Service (opsional)" di FormTable SalesOrderItem/InternalOrderItem dihapus, so that tidak ada ambiguitas antara referensi level-dokumen dan pilihan manual per-baris yang independen.

#### Acceptance Criteria

1. THE FormTable `SalesOrderItem` pada `resources/js/Pages/Sales/SalesOrders/Form.jsx` SHALL TIDAK LAGI menampilkan kolom picker `AssetService`/`AssetServiceConsumedItem` per baris.
2. THE FormTable `InternalOrderItem` pada `resources/js/Pages/Sales/InternalOrders/Form.jsx` SHALL TIDAK LAGI menampilkan kolom picker `AssetService`/`AssetServiceConsumedItem` per baris.

### Requirement 4: Filter kolom Item berdasarkan referensi header

**User Story:** As a staff Sales, I want kolom Item pada baris otomatis difilter saat dokumen mereferensikan AssetService, so that saya hanya bisa memilih Item yang relevan dengan pekerjaan tersebut.

#### Acceptance Criteria

1. WHEN `data.referenceable_type` sama dengan `AssetService::class`, THE kolom Item (`ItemVariantLinkModel`) pada baris SHALL difilter untuk hanya menampilkan ItemVariant yang Item induknya `type=service`, ATAU ItemVariant yang id-nya termasuk dalam `item_id` milik `consumedItems` AssetService header.
2. WHEN `data.referenceable_type` BUKAN `AssetService::class`, THE kolom Item SHALL berperilaku normal tanpa filter tambahan (perilaku existing tidak berubah).

### Requirement 5: Lock baris hasil prefill

**User Story:** As a staff Sales, I want baris yang berasal dari AssetServiceConsumedItem terkunci sebagian, so that saya tidak sengaja mengubah item atau quantity yang seharusnya mengikuti data konsumsi part yang sebenarnya.

#### Acceptance Criteria

1. THE baris yang berasal dari prefill `consumedItems` (Requirement 2) SHALL mengunci (disable) field Item.
2. THE baris yang berasal dari prefill `consumedItems` SHALL mengunci (disable) field Quantity.
3. THE baris yang berasal dari prefill `consumedItems` SHALL TETAP mengizinkan field Price diubah manual meski nilainya diprefill dari `valuation_rate` (perilaku existing Requirement 9.2 pada spec `asset-service-billing`, SalesOrder saja — InternalOrderItem tidak punya field Price).
4. THE baris yang berasal dari prefill `consumedItems` SHALL TIDAK mengunci dan TIDAK memprefill field Source Warehouse — field ini tetap normal dan wajib diisi manual.

### Requirement 6: Auto-link baris yang ditambahkan manual

**User Story:** As a staff Sales, I want baris baru yang saya tambahkan manual otomatis terhubung ke AssetService/AssetServiceConsumedItem yang relevan, so that data billing tetap konsisten tanpa saya harus memilih referensi secara terpisah.

#### Acceptance Criteria

1. WHEN user memilih ItemVariant dengan Item `type=service` pada kolom Item baris manual, THE sistem SHALL otomatis set `referenceable_type` baris tersebut ke `AssetService::class` DAN `referenceable_id` ke id AssetService header.
2. THE baris yang ter-auto-link via Acceptance Criteria 1 SHALL TIDAK di-lock (user tetap bisa mengganti item jasa lain).
3. WHEN user memilih ItemVariant yang cocok dengan TEPAT SATU `AssetServiceConsumedItem` milik AssetService header, THE sistem SHALL otomatis set `referenceable_type` baris tersebut ke `AssetServiceConsumedItem::class`, `referenceable_id` ke id consumedItem tersebut, DAN mengisi quantity serta price dari consumedItem tersebut.
4. THE baris yang ter-auto-link via Acceptance Criteria 3 SHALL menerima perlakuan lock yang sama seperti Requirement 5 (Item dan Quantity locked), terlepas dari baris tersebut awalnya hasil prefill atau hasil resolusi manual.
5. THE sistem SHALL mengasumsikan setiap ItemVariant hanya cocok dengan paling banyak satu AssetServiceConsumedItem dalam satu AssetService (tidak ada penanganan ambiguitas di titik ini — dicegah di tempat lain, di luar scope spec ini).

### Requirement 7: Relokasi logic auto-derive item/customer/price

**User Story:** As a staff Sales, I want data unit, faktor konversi, customer billing, dan harga tetap otomatis terisi seperti sebelumnya, so that perilaku auto-fill yang sudah berfungsi hari ini tidak hilang akibat perubahan lokasi trigger-nya.

#### Acceptance Criteria

1. WHEN baris ter-resolve ke `AssetServiceConsumedItem` (prefill maupun manual), THE sistem SHALL menurunkan unit dan conversion_factor dari ItemVariant tersebut (perilaku existing Requirement 4.5 pada spec `asset-service-billing`), dipicu dari `onValueChange` kolom Item.
2. WHEN baris ter-resolve ke `AssetServiceConsumedItem`, THE sistem SHALL mem-prefill customer billing HANYA lewat path `assetService.customer`/`assetService.customerBranch` (2 segmen, kondisi `bill_to_renter`) — path `ownership_customer` (3 segmen) TIDAK didukung, konsisten dengan batasan infra yang sudah ada.
3. WHEN baris ter-resolve ke `AssetService` langsung (baris jasa), THE sistem SHALL mem-prefill customer billing lewat KEDUA path (`bill_to_renter` DAN `ownership_customer`), karena keduanya maksimal 2 segmen dari root AssetService.
4. WHEN baris ter-resolve ke `AssetServiceConsumedItem` pada SalesOrder (bukan InternalOrder), THE sistem SHALL mem-prefill Price dari `valuation_rate` ItemVariant tersebut (perilaku existing Requirement 9.2).

### Requirement 8: Validasi backend tidak berubah

**User Story:** As a developer, I want validasi existing `SalesOrderRequest`/`InternalOrderRequest` tetap berlaku tanpa modifikasi, so that constraint bisnis (status approved, uniqueness 1:1 consumedItem) tetap terjaga tanpa risiko regresi dari perubahan yang tidak perlu.

#### Acceptance Criteria

1. THE `SalesOrderRequest::validateAssetServiceReferenceables()` SHALL tetap memvalidasi status approved pada AssetService/AssetServiceConsumedItem yang direferensikan, tanpa perubahan kode.
2. THE `SalesOrderRequest::validateAssetServiceReferenceables()` SHALL tetap memvalidasi constraint uniqueness 1:1 untuk `AssetServiceConsumedItem` lintas `SalesOrderItem` dan `InternalOrderItem`, tanpa perubahan kode.
