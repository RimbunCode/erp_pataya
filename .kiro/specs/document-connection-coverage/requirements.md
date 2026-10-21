# Requirements: Document Connection Coverage

## 1. Ringkasan

Sebagian dokumen tidak pernah tercatat di `model_connections` saat disubmit.
Akibatnya tab Connections di sidebar dan panel relasi (spec
`document-relation-panels`, commit `b5440e4b`) tampil kosong, meski dokumennya
benar-benar berhubungan.

Spec ini memanggil mekanisme pencatatan yang sudah ada pada service yang belum
memanggilnya, lalu membackfill data lama.

## 2. Arsitektur yang berlaku

Diverifikasi dengan membaca skema dan service pada 18 Oktober 2026. Bagian ini
penting karena asumsi yang salah di sini mengarah ke refactor yang tidak perlu.

### 2.1 `referenceable` ada di item, bukan di header

Tidak satu pun tabel header dokumen punya kolom `referenceable_type` /
`referenceable_id`. Diperiksa: `work_orders`, `internal_orders`,
`asset_services`, `asset_movements`, `asset_value_adjustments`,
`purchase_orders`.

Yang punya kolom itu adalah tabel item: `internal_order_items`,
`work_order_items`, `purchase_order_items`, `purchase_invoice_items`, dan
seterusnya.

Konsekuensinya, induk sebuah dokumen hanya dapat ditemukan lewat itemnya.

### 2.2 Dua mekanisme pencatatan, keduanya sah

**`attachConnections($item, $data)`** (`app/Traits/Submitable.php:348`) dipakai
dokumen yang induknya diketahui lewat item. Untuk tiap item yang punya
`referenceable`, ia menulis dua baris: koneksi item ke item sumber, lalu
koneksi dokumen induk ke dokumen ini melalui `parentRelation`. Lalu ia
menyusuri rantai ke atas secara rekursif.

**`event(new DocumentSubmitted($document, $reference))`** dipakai dokumen yang
induknya diketahui langsung dari kolom header, misalnya
`PurchaseInvoice::purchaseOrder` atau `PaymentEntry::paymentable`.
`CreateDocumentConnection` menulis koneksi tingkat pertama, lalu meneruskan ke
`attachConnections()` bila induk itu sendiri punya `referenceable`.

`PurchaseOrderService` memakai mekanisme pertama
(`app/Services/Purchase/PurchaseOrderService.php:315`). Itu **bukan**
peninggalan yang perlu diseragamkan: PO tidak punya kolom induk di header,
sehingga rantai item adalah satu-satunya jalur yang tersedia.

### 2.3 Lima service tidak memanggil mekanisme apa pun

Tidak memancarkan `DocumentSubmitted`, tidak memanggil `attachConnections()`,
tidak memanggil `ModelConnection::createConnection()`:

| Service | Dokumen | Item punya `referenceable` |
|---------|---------|----------------------------|
| `app/Services/Service/WorkOrderService.php` | WorkOrder | ya |
| `app/Services/Sales/InternalOrderService.php` | InternalOrder | ya |
| `app/Services/Asset/AssetServiceService.php` | AssetService | perlu dicek |
| `app/Services/Asset/AssetMovementService.php` | AssetMovement | perlu dicek |
| `app/Services/Asset/AssetValueAdjustmentService.php` | AssetValueAdjustment | perlu dicek |

`InternalOrderService::fillItemRelations()` (baris 36) menulis
`referenceable_type` dan `referenceable_id` ke item, tetapi `submit()` (baris
94) tidak pernah memanggil `attachConnections()`. Datanya tersimpan, relasinya
tidak pernah dicatat.

`asset_service_consumed_items` tidak punya kolom `referenceable`. AssetService
mungkin membutuhkan jalur lain, atau mungkin tidak punya induk sama sekali.
Pelaksana memeriksa ini lebih dulu (lihat T01).

### 2.4 Koneksi tingkat pertama baru ada sejak 14 Oktober 2026

Commit `6e684b41` menambahkan pencatatan koneksi tingkat pertama di
`CreateDocumentConnection`. Sebelum itu listener hanya memanggil
`attachConnections()`, yang keluar lewat guard bila induk tidak punya
`referenceable` sendiri.

Di database staging, dari 7 pasangan tipe yang tercatat, hanya 3 baris
bertanggal 15 September, semuanya lewat rantai item. Dokumen yang disubmit
sebelum 14 Oktober tanpa rantai item tidak punya koneksi.

### 2.5 PaymentEntry tidak terhubung ke PurchaseOrder, dan itu benar

`PaymentEntryService` memancarkan event dengan reference `paymentable`, yang
selalu PurchaseInvoice atau SalesInvoice. Tabel `purchase_invoices` tidak punya
kolom `referenceable`, sehingga rantai berhenti di Invoice.

Sudah diverifikasi di spec `document-relation-panels` (design.md bagian 4) dan
dikunci test `chain_stops_when_parent_has_no_referenceable_column`. Bukan bug:
panel pembayaran memang dipasang di halaman Invoice.

### 2.6 Retur hanya terhubung lewat foreign key

PurchaseReceipt dan DeliveryNote punya tombol membuat retur. Dokumen retur
adalah record sejenis dengan `return_against_id` terisi.

Saat retur disubmit, `DocumentSubmitted` dipancarkan dengan reference
`purchaseOrder`, bukan receipt yang diretur. Hubungan retur ke dokumen asalnya
karena itu hanya ada sebagai foreign key, tidak di graf.

Panel retur yang sudah dibangun membaca FK itu langsung lewat key `source`
(design.md 3.6b), jadi panelnya sudah berfungsi. Mencatatnya di graf tetap
berguna agar tab Connections di sidebar menampilkannya.

## 3. Functional Requirements

### FR1: Dokumen dengan Rantai Item Mencatat Koneksinya

Service yang dokumennya punya item ber-`referenceable` memanggil
`attachConnections()` saat submit.

**Acceptance:**

- WorkOrder dan InternalOrder memanggil `attachConnections()` untuk tiap item
  yang punya `referenceable`, dengan pola sama seperti
  `PurchaseOrderService::submit()`.
- Dokumen yang itemnya tidak punya `referenceable` tidak menghasilkan baris
  koneksi dan tidak melempar error.
- Submit berulang (amend, retry) tidak menggandakan baris.
- Koneksi tingkat dokumen muncul, bukan hanya tingkat item.

### FR2: Dokumen Asset Mencatat Koneksinya

AssetService, AssetMovement, dan AssetValueAdjustment mencatat koneksi ke
induknya, dengan mekanisme yang sesuai skema masing-masing.

**Acceptance:**

- Mekanisme dipilih berdasarkan hasil pemeriksaan di T01, bukan diasumsikan.
- Dokumen yang memang tidak punya induk tidak mendapat perubahan apa pun, dan
  alasannya dicatat di design.md.
- AssetService yang menurunkan PurchaseRequest, PurchaseOrder, SalesOrder, atau
  InternalOrder muncul sebagai induk pada dokumen turunan itu.

### FR3: Retur Tercatat di Graf

**Acceptance:**

- Retur penerimaan menghasilkan koneksi ke PurchaseReceipt yang diretur.
- Retur pengiriman menghasilkan koneksi ke DeliveryNote yang diretur.
- Koneksi ke PurchaseOrder atau SalesOrder yang sudah ada tetap ada.
- Panel retur yang sudah berfungsi lewat `source` tidak berubah perilakunya.

### FR4: Backfill Data Lama

**Acceptance:**

- Tersedia Artisan command yang menulis koneksi untuk dokumen yang sudah
  disubmit, berdasarkan `referenceable` pada item, kolom induk pada header
  (`purchase_order_id`, `sales_order_id`, `paymentable`), dan
  `return_against_id`.
- Idempoten: dijalankan berulang tidak menghasilkan baris ganda
  (`ModelConnection::createConnection()` memakai `updateOrCreate`).
- Menampilkan jumlah baris yang ditulis per pasangan tipe.
- Punya mode `--dry-run` yang melaporkan tanpa menulis.
- Memproses per batch, tidak memuat seluruh tabel ke memori.

### FR5: Tidak Ada Regresi

**Acceptance:**

- Pasangan tipe yang sudah tercatat sebelum perbaikan tetap tercatat dengan
  bentuk yang sama.
- Payload `data` pada koneksi tingkat item (misalnya `ordered_quantity`) tidak
  berubah.
- Baris audit bertipe penanda bebas (`sync`, `mark_done`) tidak terpengaruh.
- Panel relasi dan tab Connections tidak diubah oleh spec ini.

## 4. Non-Functional Requirements

### NFR1: Testing

- Feature test per service yang diubah: koneksi tertulis saat item punya
  induk, tidak tertulis saat tidak punya, tidak ganda saat submit berulang.
- Feature test command backfill: idempoten, `--dry-run` tidak menulis.
- Test regresi FR5 memakai pasangan tipe yang sudah tercatat.
- Pola test ada di `tests/Feature/Core/DocumentConnectionTest.php`.

### NFR2: Backfill Aman di Produksi

Dapat dihentikan lalu dilanjutkan tanpa merusak data.

## 5. Di Luar Cakupan

- Mengubah bentuk tabel `model_connections`.
- Mengubah panel relasi atau tab Connections. Spec ini hanya memperbaiki
  datanya; keduanya membaca apa yang tersedia.
- Menambahkan kolom `referenceable` ke tabel header. Arsitektur berbasis item
  dipertahankan.
- Menghubungkan PaymentEntry ke PurchaseOrder (lihat 2.5).
- Koneksi lintas dokumen yang belum ada alurnya di UI.

## 6. Catatan untuk Pelaksana

Baca lebih dulu:

- `app/Traits/Submitable.php` baris 348-374 (`attachConnections()`)
- `app/Services/Purchase/PurchaseOrderService.php` baris 300-325, contoh
  pemanggilan yang benar beserta pembaruan `ordered_quantity`
- `app/Listeners/Core/Submission/CreateDocumentConnection.php`
- `app/Models/Core/ModelConnection.php`, terutama `scopeSearch()` dan
  `createConnection()`
- `tests/Feature/Core/DocumentConnectionTest.php`

Dua kelompok test di branch `dev-jo` sudah merah sebelum pekerjaan ini dan
bukan tanggung jawab spec ini:

- `ApprovalSignatureHelperParityTest`, 4 merah, tinggi tanda tangan 80px vs
  58px, dari commit `7cd000a1`
- `tests/Feature/CRM`, 69 merah, `no such column: so.code` pada view
  `report_sales`, dari commit `9e85393a`

Verifikasi sendiri dengan `git stash` bila ragu.

Ada perubahan user yang belum di-commit di
`lang/en/finances/purchaseInvoice.php` dan `lang/id/finances/purchaseInvoice.php`.
Jangan sentuh keduanya.
