# Requirements: Document Connection Coverage

## 1. Ringkasan

Sebagian dokumen tidak pernah tercatat di `model_connections` saat disubmit.
Akibatnya tab Connections di sidebar dan panel relasi (spec
`document-relation-panels`) tampil kosong, meski dokumennya benar-benar
berhubungan.

Spec ini menyeragamkan pencatatan koneksi dan membackfill data lama.

## 2. Temuan

Diverifikasi dengan membaca service dan memeriksa database staging pada
18 Oktober 2026.

### 2.1 Lima service tanpa mekanisme koneksi sama sekali

Tidak memancarkan `DocumentSubmitted`, tidak memanggil `attachConnections()`,
tidak memanggil `ModelConnection::createConnection()`:

| Service | Dokumen |
|---------|---------|
| `app/Services/Service/WorkOrderService.php` | WorkOrder |
| `app/Services/Sales/InternalOrderService.php` | InternalOrder |
| `app/Services/Asset/AssetServiceService.php` | AssetService |
| `app/Services/Asset/AssetMovementService.php` | AssetMovement |
| `app/Services/Asset/AssetValueAdjustmentService.php` | AssetValueAdjustment |

AssetService dan WorkOrder punya dokumen turunan di UI: halaman mereka
menyediakan tombol membuat PurchaseRequest, PurchaseOrder, SalesOrder, dan
InternalOrder. Turunan itu tidak pernah terhubung balik ke induknya.

### 2.2 Delapan service yang memancarkan event

| Service | Reference yang dipakai |
|---------|------------------------|
| `SalesOrderService` | `referenceable` (bersyarat) |
| `SalesInvoiceService` | `salesOrder` |
| `PurchaseInvoiceService` | `purchaseOrder` |
| `PurchaseReceiptService` | `purchaseOrder` |
| `PaymentEntryService` | `paymentable` (SalesInvoice atau PurchaseInvoice) |
| `QuotationService` | `referenceable` (bersyarat) |
| `DeliveryNoteService` | `referenceable` |
| `StockEntryService` | `referenceable` (bersyarat) |

Tiga di antaranya memancarkan event hanya bila `referenceable_type` dan
`referenceable_id` terisi. Dokumen yang dibuat tanpa `ref` tidak menghasilkan
koneksi, dan itu memang benar.

### 2.3 PurchaseOrder memakai jalur lama

`PurchaseOrderService::submit()` tidak memancarkan `DocumentSubmitted`.
Ia memanggil `attachConnections()` per item yang punya `referenceable`
(`app/Services/Purchase/PurchaseOrderService.php:315`).

Konsekuensinya koneksi tingkat dokumen (PurchaseRequest -> PurchaseOrder)
hanya tertulis bila ada item yang menunjuk item dokumen induk. PO yang dibuat
dari AssetService tanpa rantai item tidak terhubung.

### 2.4 Koneksi tingkat pertama baru ada sejak 14 Oktober 2026

Commit `6e684b41` menambahkan pencatatan koneksi tingkat pertama di
`CreateDocumentConnection`. Sebelum itu listener hanya memanggil
`attachConnections()`, yang keluar lewat guard bila induk tidak punya
`referenceable` sendiri.

Di database staging, dari 7 pasangan tipe yang tercatat, hanya 3 baris
bertanggal 15 September. Semuanya lewat rantai item (PurchaseRequestItem ->
PurchaseOrderItem dan turunannya). Dokumen yang disubmit sebelum 14 Oktober
tanpa rantai item tidak punya koneksi sama sekali.

### 2.5 PaymentEntry tidak pernah terhubung ke PurchaseOrder

`PaymentEntryService` memancarkan event dengan reference `paymentable`, yang
selalu PurchaseInvoice atau SalesInvoice. Tabel `purchase_invoices` tidak punya
kolom `referenceable`, sehingga rantai berhenti di Invoice.

Ini sudah diverifikasi di spec `document-relation-panels` (design.md bagian 4)
dan dikunci test `chain_stops_when_parent_has_no_referenceable_column`. Bukan
bug: panel pembayaran memang dipasang di halaman Invoice, bukan PO.

### 2.6 Retur tidak tercatat sebagai koneksi

PurchaseReceipt dan DeliveryNote punya tombol membuat retur. Dokumen retur
adalah record sejenis dengan `return_against_id` terisi.

Saat retur disubmit, `DocumentSubmitted` dipancarkan dengan reference
`purchaseOrder`, bukan receipt yang diretur. Hubungan retur ke dokumen asalnya
karena itu hanya ada sebagai foreign key, tidak di graf.

## 3. Functional Requirements

### FR1: Semua Dokumen Mencatat Koneksi Saat Submit

Setiap service dengan `submit()` memancarkan `DocumentSubmitted` ketika
dokumennya punya induk.

**Acceptance:**

- WorkOrder, InternalOrder, AssetService, AssetMovement, dan
  AssetValueAdjustment memancarkan `DocumentSubmitted` saat submit, dengan
  reference dari `referenceable` bila terisi.
- Dokumen tanpa induk tidak memancarkan event dan tidak menghasilkan baris
  koneksi.
- Dokumen yang dibuat dari halaman lain lewat parameter `ref` menghasilkan
  koneksi ke dokumen asalnya.

### FR2: PurchaseOrder Memakai Jalur yang Sama

`PurchaseOrderService::submit()` memancarkan `DocumentSubmitted` seperti
service lain.

**Acceptance:**

- PO yang dibuat dari PurchaseRequest tetap terhubung seperti sebelumnya.
- PO yang dibuat dari AssetService tanpa rantai item juga terhubung.
- Koneksi tingkat item (`PurchaseRequestItem -> PurchaseOrderItem`) beserta
  payload `ordered_quantity` tidak hilang.
- Tidak ada baris koneksi ganda untuk pasangan dokumen yang sama.

### FR3: Retur Terhubung ke Dokumen Asalnya

**Acceptance:**

- Retur penerimaan menghasilkan koneksi ke PurchaseReceipt yang diretur.
- Retur pengiriman menghasilkan koneksi ke DeliveryNote yang diretur.
- Koneksi ke PurchaseOrder atau SalesOrder yang sudah ada tetap ada.

### FR4: Backfill Data Lama

Dokumen yang sudah disubmit sebelum perbaikan ini mendapat koneksinya.

**Acceptance:**

- Tersedia Artisan command yang menulis koneksi berdasarkan `referenceable`,
  `purchase_order_id`, `sales_order_id`, `paymentable`, dan `return_against_id`
  pada dokumen yang sudah disubmit.
- Command dapat dijalankan berulang tanpa menghasilkan baris ganda
  (`ModelConnection::createConnection()` memakai `updateOrCreate`).
- Command menampilkan jumlah baris yang ditulis per pasangan tipe.
- Tersedia mode kering (`--dry-run`) yang melaporkan tanpa menulis.

### FR5: Tidak Ada Regresi pada Koneksi yang Sudah Benar

**Acceptance:**

- Pasangan tipe yang sudah tercatat sebelum perbaikan tetap tercatat dengan
  bentuk yang sama.
- Payload `data` pada koneksi tingkat item tidak berubah.
- Baris audit bertipe penanda bebas (`sync`, `mark_done`) tidak terpengaruh.

## 4. Non-Functional Requirements

### NFR1: Testing

- Feature test per service yang diubah: koneksi tertulis saat ada induk, tidak
  tertulis saat tidak ada.
- Feature test untuk command backfill: idempoten, dan `--dry-run` tidak menulis.
- Test regresi untuk FR5 memakai pasangan tipe yang sudah tercatat di staging.

### NFR2: Backfill Aman Dijalankan di Produksi

Command memproses per batch, tidak memuat seluruh tabel ke memori, dan dapat
dihentikan lalu dilanjutkan tanpa merusak data.

## 5. Di Luar Cakupan

- Mengubah bentuk tabel `model_connections`.
- Mengubah panel relasi (`document-relation-panels`). Spec ini hanya
  memperbaiki datanya; panel membaca apa yang tersedia.
- Menghubungkan PaymentEntry ke PurchaseOrder. Lihat 2.5: itu keputusan desain,
  bukan bug.
- Koneksi lintas dokumen yang belum ada alurnya di UI.

## 6. Catatan untuk Pelaksana

Baca lebih dulu:

- `app/Models/Core/ModelConnection.php`, terutama `scopeSearch()` dan
  `createConnection()`
- `app/Listeners/Core/Submission/CreateDocumentConnection.php`
- `app/Traits/Submitable.php` baris 349-374 (`attachConnections()`)
- `tests/Feature/Core/DocumentConnectionTest.php` untuk pola test yang berlaku

Spec `document-relation-panels` mengonsumsi data ini. Perubahan di sini
membuat panel yang sudah ada menampilkan lebih banyak baris, tanpa perlu
diubah.
