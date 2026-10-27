# Design: Document Connection Coverage

## T01: Hasil Pemeriksaan Skema dan Data

Diperiksa pada 18 Oktober 2026 di branch `dev-jo`. Pemeriksaan skema dibaca dari
migrasi dan model. Pemeriksaan data memakai DB lokal `127.0.0.1:3307/erp` dengan
query baca-saja. DB ini **bukan staging**. Angka staging di requirements.md 2.4
perlu diperiksa ulang sebelum backfill di produksi.

### 1. Kolom `referenceable` pada tabel item

| Dokumen | Tabel item | Kolom `referenceable` | Catatan |
|---------|------------|------------------------|---------|
| WorkOrder | `work_order_items` | ada (migrasi `2025_04_26_172013`) | Model `WorkOrderItem` **tidak punya** relasi `referenceable()`. Tidak ada kode maupun FE yang mengisinya. |
| InternalOrder | `internal_order_items` | ada (migrasi `2025_08_23_080716`) | Model `InternalOrderItem::referenceable()` ada. FE `Sales/InternalOrders/Form.jsx` mengirim, `InternalOrderService::fillItemRelations()` menulis. |
| AssetService | `asset_service_consumed_items` | **tidak ada** | Konsumsi tidak punya induk di item. Lihat bagian 2. |
| AssetMovement | `asset_movement_items` | **tidak ada** | Induk ada di header, lihat bagian 2. |
| AssetValueAdjustment | (tidak ada tabel item) | **tidak ada** | Dokumen ini hanya punya header. |

### 2. Induk pada header

| Dokumen | Kolom induk di header | Diisi oleh kode |
|---------|-----------------------|-----------------|
| WorkOrder | tidak ada (hanya `item_service_id`, yaitu item, bukan dokumen) | - |
| InternalOrder | tidak ada | - |
| AssetService | `asset_maintenance_task_id` (nullable) | Tidak ditulis kode mana pun di jalur submit |
| AssetMovement | `reference_type`, `reference_id` (polimorfik) | Hanya `AssetMovementService::createFromRentalSale()` (baris 152-165), isi `DeliveryNote` |
| AssetValueAdjustment | `asset_id` (master Asset, bukan dokumen) | - |

Koreksi pada 2.1 requirements.md: pernyataan "tidak satu pun tabel header punya
`referenceable`" hanya berlaku untuk enam tabel yang diperiksa di sana. Tabel
header lain yang punya `referenceable_type` / `referenceable_id`: `delivery_notes`,
`sales_orders`, `stock_entries`, `quotations`. Ketiganya sudah ditangani
`DocumentSubmitted` di service masing-masing.

### 3. Status pencatatan koneksi per service (verifikasi dengan grep)

Ketiadaan pemanggilan `attachConnections()`, `DocumentSubmitted`, dan
`ModelConnection::createConnection()` dicek di `submit()` dan `onApproved()`:

| Service | Status |
|---------|--------|
| `WorkOrderService` | tidak memanggil mekanisme apa pun |
| `InternalOrderService` | tidak memanggil mekanisme apa pun (`submit()` baris 94) |
| `AssetServiceService` | tidak memanggil mekanisme apa pun |
| `AssetMovementService` | tidak memanggil mekanisme apa pun di `submit()`; `createFromRentalSale()` langsung APPROVED tanpa submit |
| `AssetValueAdjustmentService` | tidak memanggil mekanisme apa pun (hanya `GlPostingStatus`) |

Dua jalur sudah berjalan dan tidak perlu diubah:

- **Turunan AssetService ke PR**: `PurchaseRequestService::onApproved()` (baris
  126-150) mencatat induk lewat `parentRelation()` dari `AssetServiceConsumedItem`
  (`$parentRelation = 'assetService'`).
- **Turunan AssetService ke PO**: `PurchaseOrderService::submit()` (baris 303-318)
  memanggil `attachConnections()`. Rantai PO item -> PR item -> consumed item
  -> AssetService sampai ke induk.

### 4. Data (DB lokal, 18 Okt 2026)

| Tabel | Total baris | Baris dengan referensi |
|-------|-------------|------------------------|
| `work_order_items` | 1 | 0 |
| `internal_order_items` | 0 | 0 |
| `purchase_request_items` | 4 | 0 |
| `purchase_order_items` | 10 | 5 (semua ke `PurchaseRequestItem`) |
| `purchase_invoice_items` | 6 | 2 (semua ke `PurchaseRequestItem`) |
| `sales_order_items` | 3 | 0 |
| `delivery_note_items` | 0 | 0 |
| `asset_service_consumed_items` | 1 | tidak ada kolom |
| `asset_movement_items` | 0 | tidak ada kolom |
| `asset_services` | 1 | `asset_maintenance_task_id` terisi 0 |
| `asset_movements` | 0 | 0 |
| `asset_value_adjustments` | 0 | - |
| `delivery_notes` | 0 | header `referenceable` 0 |
| `purchase_receipts` | 7 | `purchase_order_id` 7; `return_against_id` 0 |
| `purchase_invoices` | 5 | `purchase_order_id` 5 |
| `sales_invoices` | 2 | `sales_order_id` 2 |
| `payment_entries` | 2 | `paymentable_type` 2 |
| `model_connections` | 21 | 7 pasangan tipe |

Tujuh pasangan tipe di `model_connections` (total 21 baris): PR item -> PO item (5),
PO -> PurchaseReceipt (5), PR -> PO (3), PO -> `sync` (3), PO -> PI (2),
SO -> SI (2), SI -> PE (1).

Kesimpulan data: dampak perbaikan di DB lokal nyaris nol. Semua dokumen
AssetService, AssetMovement, dan WorkOrder hampir tidak punya baris. Dampak
nyata kemungkinan ada di data staging atau produksi, dan itu belum bisa dibuktikan
dari DB lokal.

### 5. Mekanisme per dokumen

| Kode | Dokumen | Keputusan | Status |
|------|---------|-----------|--------|
| D1 | InternalOrder (FR1) | Panggil `attachConnections()` per item ber-`referenceable` di dalam transaksi `submit()`. Pola sama dengan PO. | Disetujui cakupannya, dikerjakan di T02 |
| D2 | WorkOrder (FR1) | Tambah relasi `referenceable()` (MorphTo) ke `WorkOrderItem` agar tidak null saat dibaca. Panggil `attachConnections()` di `submit()`. Tidak ada writer di FE atau service, jadi tidak ada baris yang berubah sampai writer ada. | Perlu konfirmasi user (Q3) |
| D3 | AssetService, turunan ke PR/PO/SO/IO (FR2) | PR dan PO sudah tercatat (bagian 3). SO tercatat lewat `DocumentSubmitted` bila `referenceable` berupa AssetService, perlu diverifikasi di T03. IO tercatat setelah D1. | Tidak perlu perubahan tambahan selain D1 |
| D4 | AssetService, induk `asset_maintenance_task_id` (FR2) | Kandidat: catat `AssetMaintenanceTask -> AssetService`. `AssetMaintenanceTask` adalah CRUD, bukan dokumen Submitable. Belum jelas apakah tipe ini tampil di tab Connections. | Perlu keputusan user (Q1) |
| D5 | AssetMovement, dari DeliveryNote rental/sale (FR2) | Di `createFromRentalSale()` setelah `create`, panggil `ModelConnection::createConnection(['model' => $deliveryNote, 'reference' => $movement])`. Jalur ini melewati `submit()` dan `DocumentSubmitted`, jadi tanpa ini tidak tercatat. | Direkomendasikan, perlu konfirmasi (Q4) |
| D6 | AssetValueAdjustment (FR2) | Dikeluarkan dari cakupan. Induknya hanya master `Asset` (`asset_id`), bukan dokumen. Keterkaitan ke GL sudah lewat `GlPostingStatus`. | Direkomendasikan, perlu konfirmasi (Q2) |

### 6. Dokumen yang dikeluarkan dari cakupan

- **AssetValueAdjustment**: tidak punya tabel item dan tidak punya induk dokumen
  (D6). Tidak ada perubahan kode untuknya.
- **AssetMovement dari submit manual**: tidak punya induk di header kecuali
  `reference_type` diisi form. Jalur itu belum dipakai di kode (lihat D5).
- **WorkOrder writer**: tidak ada kode yang mengisi `referenceable` di item WO
  (lihat D2). Perubahan di sini hanya relasi dan panggilan `attachConnections()`.

### 7. Koreksi pada requirements.md (tidak diubah, perlu disetujui user)

- **FR4**: `DeliveryNote` tidak punya `sales_order_id`. Induk DeliveryNote ada di
  `referenceable_type` / `referenceable_id` pada header. Backfill harus memakai
  kolom ini, bukan `sales_order_id`.
- **FR4**: daftar sumber backfill perlu ditambah `referenceable` pada header
  `delivery_notes`, `sales_orders`, dan `stock_entries`.
- **2.3**: "perlu dicek" untuk AssetService, AssetMovement, dan
  AssetValueAdjustment sudah dijawab di bagian 1 sampai 3.
- **Catatan T02**: "Keduanya sudah dipastikan punya item ber-referenceable" hanya
  benar untuk InternalOrder. WorkOrder tidak punya relasi di model dan tidak punya
  writer (D2).

## Pertanyaan Terbuka untuk User

- **Q1 (D4)**: apakah `asset_maintenance_task_id` dicatat sebagai induk
  AssetService? Rekomendasi: ya, jika AssetMaintenanceTask tampil di tab
  Connections. Jika tidak, keluarkan dari cakupan.
- **Q2 (D6)**: setuju AssetValueAdjustment dikeluarkan dari cakupan? Rekomendasi: ya.
- **Q3 (D2)**: setuju menambah `referenceable()` ke WorkOrderItem tanpa writer?
  Rekomendasi: ya. Ini hanya mencegah error laten.
- **Q4 (D5)**: setuju mencatat DeliveryNote -> AssetMovement di
  `createFromRentalSale()`? Rekomendasi: ya.

**Keputusan user (18 Oktober 2026): Q1-Q4 disetujui mengikuti rekomendasi.**
Q1 dicatat hanya jika `AssetMaintenanceTask` tampil di tab Connections. Itu diperiksa saat T03.

## T02: WorkOrder dan InternalOrder (FR1)

### Perubahan kode

- `app/Models/Service/WorkOrderItem.php`: tambah relasi `referenceable()` (MorphTo),
  sesuai Q3 (D2).
- `app/Services/Service/WorkOrderService.php` `submit()`: `attachConnections()` per
  item ber-`referenceable`, dibungkus `DB::transaction` bersama update kode.
- `app/Services/Sales/InternalOrderService.php` `submit()`: `attachConnections()` per
  item ber-`referenceable`, ditaruh di dalam transaksi `submit()` yang sudah ada,
  setelah validasi stok lolos dan sebelum `DB::commit()`.

### Keputusan teknis

- **Eager load satu tingkat** (`->with('referenceable')`). Pola PO memakai
  `referenceable.referenceable` dan seterusnya. Itu valid untuk rantai PO -> PR item
  -> consumed item, tetapi untuk WO/IO sumbernya `AssetServiceConsumedItem` yang
  tidak punya relasi `referenceable`. Eager load dalam akan melempar
  `RelationNotFoundException`. Rantai yang lebih dalam dibaca lazy oleh
  `attachConnections()`.
- **Idempotensi** dari `ModelConnection::createConnection()` (`updateOrCreate` pada
  model + reference). Submit berulang tidak menggandakan baris (dites).
- **Task 7 dilewati**. `ordered_quantity` ada di `work_order_items`, tetapi tidak ada
  padanan di sumber. Agregat PO mengisi `ordered_quantity` item PO dari
  `connections.data.ordered_quantity`. Untuk WO dan IO, sumbernya
  (`AssetServiceConsumedItem`, `SalesOrderItem`) tidak punya kolom
  `ordered_quantity` yang bisa diisi, dan tidak ada pembacaan dari arah WO/IO.
  Tidak ada perubahan untuk task ini.

### Deviasi dari teks spec yang perlu diketahui

- **Lokasi PO berbeda dari teks spec.** requirements.md FR1 dan tasks.md T02 minta
  pencatatan "saat submit", dengan acuan "PurchaseOrderService::submit() baris
  303-318". Pada kode, blok itu ada di `PurchaseOrderService::onApproved()` (baris
  297-330), bukan `submit()`. PO mencatat koneksi saat disetujui. T02 mengikuti teks
  spec (saat submit). Akibatnya dokumen yang belum disetujui, lalu ditolak,
  sudah punya koneksi. Perlu dikonfirmasi user apakah WO dan IO mencatat saat submit
  atau saat disetujui.
  **Keputusan user: saat submit, sesuai teks spec.** Lokasi PO di `onApproved()` tetap
  tidak diubah.

### Test

- `tests/Feature/Services/WorkOrderSubmitConnectionTest.php` (4 test): koneksi item
  tingkat pertama, koneksi tingkat dokumen ke AssetService, tidak ada koneksi tanpa
  `referenceable`, submit berulang tidak menggandakan.
- `tests/Feature/Sales/InternalOrderSubmitConnectionTest.php` (4 test): sama dengan
  WO.
- Regresi: `tests/Feature/Core/DocumentConnectionTest.php`,
  `InternalOrderSubmitStockValidationMessageTest`, `InternalOrderSourceWarehouseTest`,
  `InternalOrderRequestReferenceableTest`: 16 lulus.

### Catatan untuk test

- Dokumen WO dan IO memerlukan `initPermissions()` agar kolom Submitable dibuat di
  SQLite test (`DataTable`). Test juga membuat `Branch` karena kode dokumen
  memakai `@[branch.code]`.
- Stok IO membutuhkan `item_unit_id`, jadi test membuat `units` dan `item_units`
  dengan pola `InternalOrderSubmitStockValidationMessageTest`.

## T03: Dokumen Asset (FR2)

### Hasil per dokumen

- **AssetService (D3, D4)**
  - Turunan ke PR, PO, SO, IO: PR dan PO sudah tercatat (bagian 3). IO tercatat
    setelah T02. SO tercatat lewat `DocumentSubmitted` bila `referenceable`-nya
    AssetService. Tidak ada perubahan kode untuk jalur ini.
  - Induk `asset_maintenance_task_id` (D4, Q1): **dicatat**. Pemeriksaan tab
    Connections: `DataTable` mengirim `connections` lewat `ModelConnection::search()`,
    yang dua arah, dan memberi label dari `getNameClass()` tanpa daftar tipe yang
    dibatasi. `AssetMaintenanceTask` karena itu tampil di tab Connections AssetService.
  - Implementasi: `AssetServiceService::attachMaintenanceTaskConnection()`, dipanggil
    di dua cabang `submit()` (repair di dalam `try` sebelum `DB::commit()`, maintenance
    task di dalam `DB::transaction`). Arah koneksi: `model` = AssetMaintenanceTask,
    `reference` = AssetService.
- **AssetMovement (D5)**: **dicatat**. `AssetMovementService::createFromRentalSale()`
  memanggil `ModelConnection::createConnection()` dengan `model` = DeliveryNote dan
  `reference` = AssetMovement. Jalur ini tidak lewat `submit()` dan tidak memancarkan
  `DocumentSubmitted`.
- **AssetValueAdjustment (D6)**: **dikeluarkan dari cakupan, tanpa perubahan kode**.
  Tidak ada tabel item, dan induk header (`asset_id`) adalah master Asset, bukan
  dokumen. Keterkaitan ke GL sudah lewat `GlPostingStatus`.

### Pengecualian yang dicatat

- AssetMovement dengan `reference_type` yang diisi manual dari form tidak dicatat.
  Jalur itu belum dipakai di kode dan tidak ada di keputusan D5. Perlu spec tersendiri
  bila dibutuhkan.
- AssetValueAdjustment: tidak ada perubahan kode (lihat di atas).

### Test

- `tests/Feature/Asset/AssetServiceConnectionTest.php` (3 test): koneksi tugas
  maintenance ke AssetService (cabang maintenance), koneksi untuk repair yang punya
  task (cabang repair), dan tidak ada koneksi tanpa task.
- `tests/Unit/Asset/AssetMovementServiceRentalSaleTest.php`: ditambah 1 test koneksi
  DeliveryNote ke AssetMovement.
- Regresi: `tests/Feature/Asset/AssetServiceServiceTest.php`,
  `tests/Unit/Asset/AssetServiceTest.php`, dan `tests/Feature/Core/DocumentConnectionTest.php`:
  38 lulus bersama test di atas.

## T04: Retur (FR3)

### Perubahan kode

- `app/Services/Purchase/PurchaseReceiptService.php` `submit()`: setelah
  `DocumentSubmitted`, bila `returnAgainst` ada, panggil
  `ModelConnection::createConnection()` dengan `model` = receipt asal dan `reference` =
  retur. Arah ini mengikuti `DocumentSubmitted` (induk sebagai `model`).
- `app/Services/Inventory/DeliveryNoteService.php` `submit()`: sama, untuk
  `returnAgainst`. Import `ModelConnection` ditambahkan.

### Keputusan

- Koneksi ke PurchaseOrder atau SalesOrder tetap dicatat oleh `DocumentSubmitted` seperti
  sebelumnya. Perubahan hanya menambah tautan retur.
- Panel retur (`source` = `returnRows`) membaca FK `return_against_id` lewat
  `RelationPanelService::sourceQuery()`, tidak lewat `ModelConnection`. Karena itu
  panelnya tidak berubah dan tidak bisa menghasilkan baris ganda dari tautan baru ini.
  Tautan baru hanya terlihat di tab Connections sidebar.
- Pencatatan di submit, bukan approval, mengikuti teks FR3 ("saat retur disubmit").

### Test

- `tests/Feature/Purchase/PurchaseReceiptReturnConnectionTest.php` (4 test): retur
  tercatat ke receipt asal, koneksi PO yang sudah ada tetap, tanpa `return_against`
  tidak ada tautan retur, submit berulang tidak menggandakan.
- `tests/Feature/Inventory/DeliveryNoteReturnConnectionTest.php` (4 test): sama dengan
  PR. Test ini memakai shim `json_overlaps` untuk SQLite, karena `DeliveryNoteService::submit()`
  memakai fungsi MySQL itu untuk membatalkan draft lain.
- Regresi: `tests/Feature/Core/RelationPanelPagesTest.php` dan
  `tests/Feature/Core/DocumentConnectionTest.php` lulus bersama test di atas (45 test).

## T05: Command Backfill (FR4)

### Perintah

- `php artisan connections:backfill` dan `connections:backfill --dry-run`.
- Kelas: `app/Console/Commands/Core/BackfillDocumentConnectionsCommand.php`.

### Sumber data

- **Item ber-`referenceable`**: `WorkOrderItem`, `InternalOrderItem`, `PurchaseOrderItem`,
  `PurchaseRequestItem`, `PurchaseInvoiceItem`, `DeliveryNoteItem`, `SalesOrderItem`.
  Dipanggil lewat `attachConnections()` pada dokumen induk, sama dengan submit.
  Payload `ordered_quantity` untuk PO mengikuti `onApproved()`. Jenis lain tanpa payload.
- **Induk di header**: `PurchaseReceipt` dan `PurchaseInvoice` (`purchase_order_id`),
  `SalesInvoice` (`sales_order_id`), `PaymentEntry` (`paymentable`), serta
  `DeliveryNote`, `SalesOrder`, dan `StockEntry` (`referenceable` di header). Dijalankan
  lewat `CreateDocumentConnection` langsung, bukan lewat dispatch event, supaya listener
  notifikasi tidak ikut terpicu.
- **Retur**: `PurchaseReceipt` dan `DeliveryNote` (`return_against_id`).

### Keputusan

- **Koreksi FR4 diterapkan**: DN memakai `referenceable` di header, bukan `sales_order_id`.
- **Dry-run memakai transaksi yang di-rollback.** Hitungan dihasilkan dari event
  `created` pada `ModelConnection`, jadi dry-run melaporkan jumlah yang akan benar-benar
  ditulis, tanpa logika terpisah yang bisa berbeda dari jalur nyata.
- **Hitungan = baris baru** (event `created`). Baris yang sudah ada dan hanya di-update
  tidak masuk ringkasan.
- **Idempoten** lewat `updateOrCreate` di `createConnection()`. Aman dihentikan lalu
  dijalankan lagi (NFR2).
- **Tidak memperbarui agregat** `ordered_quantity` PO. Agregat itu diisi `onApproved()`
  dan tidak termasuk FR4.
- **Pemrosesan per batch** dengan `chunkById(500)`.

### Hasil dry-run di DB lokal (18 Okt 2026)

Tidak ada yang ditulis. Tabel ringkasan:

| Pasangan | Baris |
|----------|-------|
| PurchaseInvoice -> PaymentEntry | 1 |
| PurchaseOrder -> PurchaseInvoice | 3 |
| PurchaseOrder -> PurchaseReceipt | 2 |
| PurchaseRequest -> PurchaseInvoice | 1 |
| PurchaseRequestItem -> PurchaseInvoiceItem | 2 |

Total 9 baris. Pasangan PR item -> PO item tidak menambah baris baru, jadi bentuk
barisnya yang sudah ada tidak berubah (FR5). Real run belum dijalankan di DB lokal.

### Test

- `tests/Feature/Core/BackfillDocumentConnectionsCommandTest.php` (6 test): backfill
  induk receipt ke PO, backfill retur, backfill rantai WO item ke AssetService,
  `--dry-run` tidak menulis, dua kali jalan tidak menggandakan, dokumen tanpa induk
  dilewati. Semuanya lulus.

## Tambahan T05: backfill hanya menambah baris baru (FR5)

- Sebelum memproses dokumen, backfill memeriksa baris tingkat pertama (model -> reference).
  Jika sudah ada, dokumen itu dilewati, sehingga payload yang tercatat saat submit tidak
  tertimpa. Berlaku untuk item, header, dan retur.
- Test: `DocumentConnectionRegressionTest` (payload item, pasangan header, baris `sync`).

## T06: Regresi dan Finalisasi (FR5)

- Task 26: test regresi lulus (3 test di `DocumentConnectionRegressionTest`).
- Task 28: Pint dijalankan hanya pada berkas yang diubah di spec ini. Berkas
  `lang/*/finances/purchaseInvoice.php` yang sudah dimodifikasi user tidak disentuh.
- Task 27 (regresi suite lebar) dan task 29 (verifikasi browser) belum selesai.
  Permintaan user: pengujian dilakukan sendiri.
  - Regresi suite sempat dijalankan di latar belakang, lalu dihentikan atas permintaan user.
    Hasil lengkap belum tersedia.
  - Verifikasi browser tidak bisa dilakukan. Server dev di port 8000 gagal listen, dan
    browser pane tidak bisa membuka localhost.
