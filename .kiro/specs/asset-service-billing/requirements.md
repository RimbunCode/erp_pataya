# Requirements Document

## Introduction

Spec ini punya dua bagian yang saling bergantung, ditemukan lewat brainstorming lanjutan setelah draft awal:

**Bagian A — Unifikasi AssetMovement untuk rental & sale (fondasi).** `asset-rental-migration` (Spec 6) menambahkan `Asset.rental_quantity`/`sold_quantity` (angka) tapi TIDAK mencatat *siapa* penyewa/pembeli — rental/sale di Spec 6 sengaja tidak membuat `AssetMovement` sama sekali (cuma `DeliveryNoteItemAsset`), padahal `AssetMovement`+`AssetMovementItem` (Spec 4) adalah audit trail resmi Asset domain untuk "siapa pegang Asset ini sekarang" (analog `StockLedgerEntry` untuk Stock). Akibatnya tidak ada cara solid mencari "penyewa aktif Asset X sekarang" — harus reverse-query manual lewat `DeliveryNoteItemAsset → DeliveryNote → referenceable (SalesOrder) → customer`, rapuh dan tidak terpusat.

Bagian A menutup gap ini: `AssetMovement` diperluas jadi SATU-SATUNYA sumber kebenaran pergerakan Asset, mencakup lokasi/custodian (existing, Spec 4) DAN rental/sale (baru). `AssetMovement` untuk rental/sale dibuat OTOMATIS (bypass approval) saat `DeliveryNote` terkait di-approve — karena approval DeliveryNote itu sendiri sudah menjadi gate-nya, AssetMovement di sini murni catatan turunan, bukan approval chain kedua.

**Bagian B — Billing AssetService ke penyewa aktif (scope asli spec ini).** `AssetService` (repair/maintenance, Spec 5) belum terhubung ke billing apapun. Untuk Asset company-owned yang SEDANG disewa (status `IN_RENT`/`PARTIALLY_RENTED`), user servis bisa memilih menagih biaya ke penyewa aktif — bukan ke `Asset.ownership_customer_id` (yang kosong/company untuk kasus ini). Bagian B membangun jembatan billing lewat `SalesOrder` → `DeliveryNote` (serah-terima part yang dipakai, mengurangi stok) → `SalesInvoice` (tagihan jasa + part), dengan arah referensi SELALU dari `SalesOrderItem` menunjuk balik ke Asset domain (`AssetService`/`AssetServiceConsumedItem`), bukan sebaliknya — AssetService dan AssetServiceConsumedItem TIDAK mendapat field/relasi baru ke dokumen transaksi Sales (SalesOrder/SalesOrderItem/SalesInvoice/DeliveryNote). Pengecualian: field snapshot `customer_id`/`customer_branch_id` di AssetService (Requirement 6) BOLEH ada karena itu referensi ke master data (Customer/Branch), bukan ke dokumen transaksi — dan nilainya diambil dari Bagian A (AssetMovement), bukan reverse-query Sales.

Spec ini adalah bagian dari rencana besar "Spec 7" (AssetService billing/procurement integration) yang dipecah jadi beberapa spec terpisah. Sub-area lain (permintaan internal via InternalOrder, pengadaan part kurang stok via PurchaseRequest/PurchaseOrder, investigasi+desain penggantian `App\Models\Service\WorkOrder`) di luar scope, akan jadi spec terpisah di masa depan.

## Glossary

- **Baris jasa**: satu `SalesOrderItem` yang `referenceable`-nya menunjuk ke sebuah `AssetService` — mewakili biaya jasa/labor servis itu sendiri, terlepas dari part yang dipakai.
- **Baris part**: satu `SalesOrderItem` yang `referenceable`-nya menunjuk ke sebuah `AssetServiceConsumedItem` — mewakili satu jenis part yang dipakai saat servis, 1:1 dengan row consumed item aslinya.
- **Asset ownership customer**: kondisi `Asset.ownership_type === AssetOwnershipType::CUSTOMER`, dengan `Asset.ownership_customer_id` terisi — Asset ini secara hukum milik customer tersebut (dititipkan/consignment), bukan milik company.
- **Penyewa aktif**: customer yang SEDANG menyewa sebuah Asset company-owned, ditentukan dari `AssetMovement` terakhir berpurpose rental milik Asset tersebut yang BELUM ada pasangan `AssetMovement` retur-nya (lihat Requirement 3).

## Requirements

### Bagian A — Unifikasi AssetMovement

### Requirement 1: AssetMovementPurpose baru untuk rental & sale

**User Story:** As a developer, I want AssetMovement mencakup purpose rental dan sale, so that AssetMovement jadi satu-satunya sumber kebenaran pergerakan Asset, tidak terpecah antara lokasi (AssetMovement) dan penyewa/pembeli (tempat lain).

#### Acceptance Criteria

1. THE `AssetMovementPurpose` enum SHALL menambah case baru: `RENT_OUT`, `RETURN_FROM_RENT`, `SELL`.
2. THE `AssetMovementItem` SHALL menambah kolom nullable `customer_id` (FK → Customer) dan `customer_branch_id` (FK → Branch), terisi HANYA untuk item dengan `AssetMovement.purpose` bertipe `RENT_OUT`/`RETURN_FROM_RENT`/`SELL`.
3. THE `AssetMovementItem` SHALL menambah kolom `quantity` (decimal, default 1) — kolom ini sebelumnya tidak ada karena Spec 4 (lokasi/custodian) selalu 1 Asset penuh per baris; rental/sale (Spec 6) bisa parsial (`asset_quantity > 1` kategori bulk).
4. `source_location_id`/`target_location_id`/`from_custodian_id`/`to_custodian_id` SHALL tetap null untuk item berpurpose `RENT_OUT`/`RETURN_FROM_RENT`/`SELL` (field itu murni utk purpose lokasi/custodian Spec 4, tidak dipaksa terisi).

### Requirement 2: AssetMovement rental/sale dibuat otomatis saat DeliveryNote approved

**User Story:** As a developer, I want AssetMovement untuk rental/sale tercipta otomatis mengikuti approval DeliveryNote yang sudah ada, so that tidak ada approval chain baru yang duplikat/independen.

#### Acceptance Criteria

1. WHEN `DeliveryNoteService::onApproved()` memproses baris rental (event `AssetRentalDeliveryApproved`), THE sistem SHALL membuat `AssetMovement` (purpose `RENT_OUT`, status langsung `[FormStatus::APPROVED]` — bypass approval chain, karena persetujuan DeliveryNote adalah gate-nya) beserta `AssetMovementItem` (asset_id, quantity, customer_id, customer_branch_id diambil dari `DeliveryNote.referenceable` yaitu SalesOrder terkait).
2. WHEN event `AssetRentalReturnApproved` diproses, THE sistem SHALL membuat `AssetMovement` (purpose `RETURN_FROM_RENT`) dengan cara sama.
3. WHEN event `AssetSoldViaDelivery` diproses, THE sistem SHALL membuat `AssetMovement` (purpose `SELL`) dengan cara sama.
4. THE `AssetMovement` yang dibuat SHALL diisi `reference_type`/`reference_id` menunjuk ke `DeliveryNote` asal (memakai kolom polymorphic yang sudah ada di tabel `asset_movements`, belum pernah dipakai sebelumnya).
5. THE pembuatan `AssetMovement` ini SHALL terjadi di listener Spec 6 yang sudah ada (`SetAssetInRent`, `ReturnAssetFromRent`, `MarkAssetSoldFromDelivery`) — ditambahkan sebagai baris kode baru, TIDAK mengubah logic `rental_quantity`/`sold_quantity` yang sudah ada di listener tersebut.
6. THE proses ini SHALL idempotent mengikuti guard `processed_at` yang sudah ada di listener (tidak ada AssetMovement dobel untuk baris DeliveryNoteItemAsset yang sama).

### Requirement 3: Resolusi "penyewa aktif" dari AssetMovement

**User Story:** As a developer, I want cara solid menentukan siapa penyewa aktif sebuah Asset, so that AssetService bisa menampilkan info ini tanpa reverse-query manual yang rapuh.

#### Acceptance Criteria

1. THE sistem SHALL menyediakan method (mis. `Asset::activeRenter()`) yang mengembalikan `AssetMovementItem` purpose `RENT_OUT` PALING BARU untuk Asset tersebut YANG BELUM ADA `AssetMovementItem` purpose `RETURN_FROM_RENT` sesudahnya.
2. IF Asset tidak sedang disewa (tidak ada `RENT_OUT` tanpa `RETURN_FROM_RENT` pasangannya), THEN method ini SHALL mengembalikan null.
3. THE resolusi ini SHALL query ke tabel `asset_movement_items`/`asset_movements`, BUKAN ke `DeliveryNoteItemAsset` atau tabel Sales manapun.

### Bagian B — Billing AssetService ke penyewa

### Requirement 4: SalesOrderItem.referenceable generik

**User Story:** As a developer, I want SalesOrderItem punya cara generik untuk merujuk ke sumber non-Item (mis. AssetService), so that jenis sumber baru di masa depan bisa memakai pola yang sama tanpa menambah FK baru tiap kali.

#### Acceptance Criteria

1. THE SalesOrderItem SHALL memiliki kolom nullable `referenceable_type` dan `referenceable_id` (morph generik).
2. WHEN `referenceable_type` diisi `App\Models\Asset\AssetService`, THE SalesOrderItem SHALL dianggap sebagai baris jasa servis.
3. WHEN `referenceable_type` diisi `App\Models\Asset\AssetServiceConsumedItem`, THE SalesOrderItem SHALL dianggap sebagai baris part, dan HARUS 1:1 terhadap satu row `AssetServiceConsumedItem` (tidak boleh dua SalesOrderItem menunjuk ke `AssetServiceConsumedItem` yang sama).
4. IF `referenceable_type` kosong (null), THEN THE SalesOrderItem SHALL berperilaku persis seperti SalesOrderItem biasa sekarang (item-based, tidak ada perubahan perilaku existing).
5. THE SalesOrderItem.item_id SHALL tetap wajib diisi meskipun `referenceable` terisi. Untuk baris jasa, user memilih ItemVariant apapun secara manual (TIDAK ada Item/ItemVariant "jasa servis" khusus yang di-seed oleh spec ini). Untuk baris part, ItemVariant SHALL diturunkan otomatis dari `AssetServiceConsumedItem.item`.

### Requirement 5: Gating — SO hanya untuk AssetService yang sudah approved

**User Story:** As a Sales staff, I want sistem menolak pembuatan baris SO untuk AssetService yang belum disetujui, so that saya tidak menagih biaya untuk pekerjaan yang masih bisa berubah.

#### Acceptance Criteria

1. WHEN user membuat SalesOrderItem dengan `referenceable_type=AssetService`, THE sistem SHALL menolak (validation error) jika `AssetService.status` TIDAK mengandung `FormStatus::APPROVED`.
2. WHEN user membuat SalesOrderItem dengan `referenceable_type=AssetServiceConsumedItem`, THE sistem SHALL menolak jika `AssetServiceConsumedItem.assetService.status` TIDAK mengandung `FormStatus::APPROVED`.
3. THE validasi ini SHALL berlaku baik saat create maupun update SalesOrderItem (tidak bisa bypass lewat edit setelah SO draft dibuat).

### Requirement 6: Checkbox "tagih ke penyewa" pada AssetService

**User Story:** As an Asset Service staff, I want opsi menagih biaya servis ke penyewa aktif Asset (bukan hanya ke pemilik Asset), so that Asset company-owned yang disewakan tetap bisa ditagih servisnya ke penyewa kalau memang itu tanggung jawab penyewa.

#### Acceptance Criteria

1. THE AssetService SHALL memiliki field boolean baru `bill_to_renter` (default false).
2. THE opsi `bill_to_renter` SHALL HANYA muncul/bisa diaktifkan di FE JIKA `resolvedAsset()` sedang berstatus rental (`Asset::activeRenter()` — Requirement 3 — mengembalikan hasil non-null).
3. WHEN `bill_to_renter` diaktifkan (dicentang), THE sistem SHALL mengambil snapshot `Asset::activeRenter()` SAAT ITU JUGA dan menyimpannya sebagai kolom baru `customer_id`/`customer_branch_id` di AssetService (FK ke Customer/Branch — data master, BUKAN dokumen transaksi Sales, sehingga tidak melanggar batasan domain-independen di Requirement 8).
4. THE nilai `customer_id`/`customer_branch_id` ini SHALL bersifat snapshot (beku) — TIDAK berubah otomatis lagi walau status rental Asset berubah setelahnya (mis. Asset sudah diretur/disewa customer lain).
5. THE field `customer_id`/`customer_branch_id` di AssetService SHALL ditampilkan readonly di FE (informasi tambahan, bukan input manual).

### Requirement 7: Resolusi customer untuk SalesOrder

**User Story:** As a Sales staff, I want SalesOrder untuk AssetService otomatis terhubung ke customer yang tepat, so that saya tidak perlu mencari manual siapa yang harus ditagih.

#### Acceptance Criteria

1. IF `AssetService.bill_to_renter = true`, THEN SalesOrder yang dibuat untuk billing AssetService ini SHALL memakai `AssetService.customer_id`/`customer_branch_id` (snapshot penyewa, Requirement 6).
2. IF `AssetService.bill_to_renter = false` DAN `resolvedAsset().ownership_type === customer`, THEN SalesOrder SHALL memakai `Asset.ownershipCustomer`/`Asset.ownershipCustomerBranch` (pemilik Asset).
3. THE Asset SHALL menambah kolom baru nullable `ownership_customer_branch_id` (FK → Branch) — field ini SEBELUMNYA TIDAK ADA (Asset cuma punya `ownership_customer_id`, tanpa branch); diisi manual oleh user saat `ownership_type=customer`, dipakai sebagai sumber `customer_branch` untuk Requirement 7.2.
4. IF kedua kondisi di atas tidak terpenuhi (Asset company-owned, tidak disewa, atau `bill_to_renter=false` dan tidak ada ownership customer), THEN sistem SHALL tetap mengizinkan SO dibuat manual dengan customer pilihan user — TIDAK memblokir pembuatan SO.

### Requirement 8: DeliveryNote mengurangi stok sesuai AssetServiceConsumedItem

**User Story:** As an Inventory staff, I want DeliveryNote untuk baris part AssetService benar-benar mengurangi stok sesuai part yang dipakai, so that catatan stok akurat dan tidak perlu proses manual terpisah.

#### Acceptance Criteria

1. WHEN DeliveryNoteItem dibuat mereferensikan SalesOrderItem yang `referenceable_type=AssetServiceConsumedItem`, THE sistem SHALL memvalidasi `DeliveryNoteItem.quantity` TIDAK melebihi `AssetServiceConsumedItem.quantity`.
2. WHEN DeliveryNote (berisi baris part AssetService) di-approve, THE sistem SHALL mengurangi stok item terkait mengikuti mekanisme StockLedgerEntry standar yang sudah ada (sama seperti DeliveryNote non-Asset lainnya).
3. THE proses pengurangan stok SHALL idempotent per baris DeliveryNoteItem (tidak dobel proses kalau di-retry/re-approve).
4. Baris jasa (referenceable=AssetService) SHALL TIDAK PERNAH memicu logic Stock/StockLedgerEntry apapun — DeliveryNote untuk baris jasa (jika ada) murni dokumentasi, bukan gate stok.

### Requirement 9: SalesInvoice menagih jasa dan/atau part

**User Story:** As a Sales staff, I want bisa membuat SalesInvoice yang menagih biaya jasa dan/atau harga part yang dipakai, so that customer menerima tagihan lengkap untuk servis Asset mereka.

#### Acceptance Criteria

1. THE SalesInvoiceItem SHALL bisa dibuat dari SalesOrderItem baris jasa maupun baris part (sesuai `unbilled_quantity` seperti alur SO normal).
2. WHEN SalesOrderItem baris part dibuat, THE harga (`price`) SHALL diprefill dari `AssetServiceConsumedItem.valuation_rate`, TAPI user SHALL tetap bisa mengubahnya manual (markup/margin keuntungan penjualan part diperbolehkan).
3. THE urutan pembuatan DeliveryNote dan SalesInvoice SHALL bebas (tidak saling menunggu) — SalesInvoice boleh dibuat sebelum atau sesudah DeliveryNote untuk baris part yang sama.

### Requirement 10: Batas domain Asset

**User Story:** As a developer, I want AssetService dan AssetServiceConsumedItem tidak mengetahui dokumen transaksi Sales apapun, so that domain boundary tetap bersih dan AssetService bisa dipakai independen dari fitur billing.

#### Acceptance Criteria

1. THE AssetService model SHALL TIDAK mendapat field/relasi baru yang menunjuk ke SalesOrder/SalesOrderItem/SalesInvoice/DeliveryNote APAPUN (dokumen transaksi Sales/Inventory).
2. THE AssetService model BOLEH mendapat field baru yang menunjuk ke master data lintas-domain (Customer, Branch — Requirement 6), karena itu bukan dokumen transaksi.
3. THE AssetServiceConsumedItem model SHALL TIDAK mendapat field/relasi baru apapun ke Sales/Inventory domain (tidak ada pengecualian, berbeda dari AssetService).
4. Semua relasi/referensi ke dokumen transaksi SHALL berasal dari sisi Sales/Inventory (SalesOrderItem, DeliveryNoteItem) menunjuk KE Asset domain, bukan sebaliknya.

## Non-Goals

1. InternalOrder / permintaan servis internal (non-customer) — spec terpisah.
2. Procurement otomatis (PurchaseRequest/PurchaseOrder) untuk part yang kurang stok saat AssetServiceConsumedItem diisi — spec terpisah.
3. Investigasi dan desain penggantian `App\Models\Service\WorkOrder` — spec terpisah.
4. Tidak ada perubahan pada `SalesOrder`/`SalesOrderItem` untuk kasus ItemVariant biasa (non-referenceable) — perilaku existing harus 100% tidak berubah.
5. Tidak ada migrasi data historis (AssetService lama yang sudah completed tanpa billing tetap begitu; AssetMovement historis untuk rental/sale yang sudah terjadi SEBELUM spec ini tidak di-backfill).
6. AssetMovement untuk purpose `RENT_OUT`/`RETURN_FROM_RENT`/`SELL` TIDAK bisa dibuat manual oleh user lewat FE (selalu otomatis dari DeliveryNote, Requirement 2) — beda dari purpose lokasi/custodian existing yang tetap manual.
7. Tidak menagih biaya servis untuk Asset company-owned yang TIDAK sedang disewa dan TIDAK punya ownership customer (kasus ini AssetService selesai tanpa billing sama sekali, sesuai keputusan awal brainstorming).
