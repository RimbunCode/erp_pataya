# Requirements Document

## Introduction

Spec 1 (`asset-management-core`) membangun fondasi model `Asset`, `AssetCategory`, `AssetLocation` — tapi Asset saat ini hanya bisa dibuat manual lewat form. Kebutuhan nyata: sebagian besar aset tetap (laptop, kendaraan, mesin) diperoleh lewat alur pembelian normal (`PurchaseReceipt`/`PurchaseInvoice`), dan mencatat ulang secara manual di form Asset setelah barang diterima itu duplikasi kerja serta rawan data tidak sinkron (nilai perolehan, tanggal beli, supplier — semua sudah ada di dokumen Purchase).

Spec ini adalah **Fase 2 dari 4 fase modul Asset Management**. Fase ini menghubungkan domain Purchase/Inventory ke domain Asset: menandai `Item` mana yang merupakan aset tetap (`is_fixed_asset`), lalu saat `PurchaseReceipt` atau `PurchaseInvoice` yang berisi item tersebut disetujui (approved), sistem otomatis membuat record `Asset` baru berstatus belum lengkap (menunggu kategori/lokasi diisi manual), disertai UI untuk melengkapi data tersebut dari halaman dokumen Purchase.

**Fase-fase lain (di luar scope spec ini, dicatat sebagai konteks)**:
- Fase 1 — Core: `Asset`, `AssetCategory`, `AssetLocation` (SELESAI)
- Fase 3 — Depresiasi otomatis + posting General Ledger + Asset Value Adjustment
- Fase 4 — Asset Movement, Asset Maintenance, Asset Repair, Report, perbaikan sistem rental SalesOrder

## Glossary

- **Fixed Asset Item**: `Item` dengan flag `is_fixed_asset = true` — menandakan setiap unit barang ini, saat dibeli, harus dilacak sebagai `Asset` individual/kelompok, bukan sekadar stok barang dagangan biasa.
- **Auto-created Asset**: `Asset` yang dibuat otomatis oleh sistem saat dokumen Purchase (Receipt/Invoice) disetujui, BUKAN lewat form manual. Statusnya tetap `DRAFT`, tapi `asset_category_id`/`asset_location_id` kosong sampai dilengkapi manual.
- **Melengkapi data Asset**: proses manual (lewat dialog di halaman Show PurchaseReceipt/PurchaseInvoice) mengisi `asset_category_id`, `asset_location_id`, dan opsi split unit pada Asset yang auto-created.
- **Split Asset**: memecah satu record `Asset` dengan `asset_quantity > 1` menjadi beberapa record `Asset` terpisah dengan `asset_quantity` lebih kecil (termasuk `1`), untuk kasus sebagian unit perlu dilacak individual (custodian/lokasi berbeda).
- **Dokumen sumber**: `PurchaseReceipt` atau `PurchaseInvoice` yang memicu pembuatan `Asset` — dilacak lewat `Asset.purchase_receipt_id`/`Asset.purchase_invoice_id`.

## Requirements

### Requirement 1: Flag `is_fixed_asset` pada Item

**User Story:** As an administrator inventaris, I want menandai Item tertentu sebagai aset tetap, so that sistem tahu barang tersebut harus dilacak sebagai Asset individual saat dibeli, bukan sekadar stok dagangan.

#### Acceptance Criteria

1. THE system SHALL menambahkan kolom `is_fixed_asset` (boolean, default `false`) pada tabel `items`.
2. THE `Item` model SHALL meng-cast `is_fixed_asset` sebagai boolean, konsisten pola `is_stock_item`/`is_disabled` yang sudah ada.
3. THE system SHALL menambahkan kolom `asset_category_id` (nullable, FK ke `asset_categories`) pada tabel `items`, dipakai sebagai default `AssetCategory` saat auto-create Asset dari item ini — TIDAK wajib diisi (Requirement 3 menangani kasus kosong).
4. WHEN `is_fixed_asset = false`, THE system SHALL mengabaikan `asset_category_id` pada Item tersebut (tidak ada validasi lebih lanjut, field tetap ada di skema tapi tidak relevan).
5. THE FE form Item (`resources/js/Pages/Inventory/Items/Form.jsx` atau sejenisnya, ikuti konvensi lokasi form Item yang sudah ada) SHALL menampilkan toggle `is_fixed_asset` dan, ketika aktif, field pemilihan `AssetCategory` (opsional).

### Requirement 2: Event dan Listener — trigger auto-create Asset

**User Story:** As a staf gudang, I want Asset otomatis tercatat begitu barang fixed-asset diterima atau ditagih, so that saya tidak perlu input ulang data yang sama secara manual.

#### Acceptance Criteria

1. THE system SHALL mendefinisikan event baru `App\Events\Asset\FixedAssetItemApproved` (folder `Asset` mengikuti konvensi domain event), dengan payload dokumen sumber (`PurchaseReceipt` atau `PurchaseInvoice`), baris item (`PurchaseReceiptItem`/`PurchaseInvoiceItem`), dan `Item` terkait.
2. WHEN `PurchaseReceiptService::onApproved()` selesai memproses sebuah `PurchaseReceiptItem` YANG item-nya (`$item->item->item`, path `ItemVariant` → `Item`) memiliki `is_fixed_asset = true`, THE system SHALL men-dispatch `FixedAssetItemApproved` untuk baris tersebut.
3. WHEN `PurchaseInvoiceService::onApproved()` selesai memproses sebuah `PurchaseInvoiceItem` yang item-nya memiliki `is_fixed_asset = true`, THE system SHALL men-dispatch `FixedAssetItemApproved` untuk baris tersebut.
4. THE system SHALL mendaftarkan listener baru `App\Listeners\Asset\CreateAssetFromPurchase` pada `FixedAssetItemApproved` di `EventServiceProvider`, `implements ShouldQueue` (konsisten pola `CreateDocumentConnection`).
5. THE listener `CreateAssetFromPurchase` SHALL menjadi satu-satunya titik yang memanggil `AssetService::create()` untuk alur otomatis ini — logic bisnis (Requirement 3, 4, 5) berada di listener/service, bukan inline di `PurchaseReceiptService`/`PurchaseInvoiceService`.

### Requirement 3: Auto-create Asset dari PurchaseReceipt

**User Story:** As a staf gudang, I want Asset baru langsung tercatat saat barang fixed-asset diterima secara fisik, so that pelacakan aset dimulai sejak barang benar-benar ada, bukan menunggu proses administrasi invoice.

#### Acceptance Criteria

1. WHEN `FixedAssetItemApproved` di-dispatch dari `PurchaseReceiptService::onApproved()` untuk sebuah `PurchaseReceiptItem`, THE listener SHALL membuat satu record `Asset` baru dengan `asset_quantity` sama dengan `PurchaseReceiptItem.quantity` (TIDAK dipecah per unit — lihat Requirement 6 untuk split manual belakangan).
2. THE Asset yang dibuat SHALL memiliki `asset_category_id = null` dan `asset_location_id = null` KECUALI `Item.asset_category_id` (Requirement 1.3) terisi, dalam hal ini `asset_category_id` Asset SHALL diisi dari nilai tersebut.
3. THE Asset yang dibuat SHALL memiliki `asset_name` diisi dari `Item.name`, `purchase_date` dari `PurchaseReceipt.received_date`, `net_purchase_amount`/`gross_purchase_amount` dihitung dari `PurchaseReceiptItem` (rate × quantity, mengikuti field yang tersedia di `PurchaseReceiptItem`), `purchase_receipt_id` diisi merujuk dokumen sumber, dan `item_id` diisi dari `Item` (bukan `ItemVariant`).
4. THE Asset yang dibuat SHALL berstatus `DRAFT` (default `Submitable`) — TIDAK otomatis submit/approve.
5. IF `PurchaseReceiptItem` sudah pernah memicu pembuatan Asset sebelumnya (mis. `onApproved()` terpanggil ulang, atau retry queue), THEN THE system SHALL TIDAK membuat Asset duplikat — cek berdasarkan kombinasi unik dokumen sumber + baris item sebelum create.

### Requirement 4: Sinkronisasi dari PurchaseInvoice (melengkapi, bukan duplikat)

**User Story:** As a staf finance, I want data pembelian aset di invoice tersambung ke Asset yang sudah dibuat saat barang diterima, so that nilai final pembelian (setelah pajak/diskon) tercatat akurat tanpa membuat data aset ganda.

#### Acceptance Criteria

1. WHEN `FixedAssetItemApproved` di-dispatch dari `PurchaseInvoiceService::onApproved()` untuk sebuah `PurchaseInvoiceItem`, THE listener SHALL mencari Asset yang sudah ada via `PurchaseInvoiceItem.purchaseOrderItem` yang sama dengan `purchaseOrderItem` milik `PurchaseReceiptItem` pemilik Asset tersebut (relasi tidak langsung lewat `PurchaseOrderItem` bersama).
2. IF Asset terkait ditemukan (dibuat sebelumnya dari `PurchaseReceipt`), THEN THE listener SHALL meng-update Asset tersebut: mengisi `purchase_invoice_id`, dan menyesuaikan `net_purchase_amount`/`gross_purchase_amount` ke nilai final dari `PurchaseInvoiceItem` (termasuk pajak/diskon) — BUKAN membuat Asset baru.
3. IF Asset terkait TIDAK ditemukan (alur invoice-only, tanpa `PurchaseReceipt` — mis. jasa atau pembelian tanpa penerimaan barang terpisah), THEN THE listener SHALL membuat Asset baru mengikuti aturan Requirement 3 (kecuali sumber data dari `PurchaseInvoiceItem`/`PurchaseInvoice`, dan `purchase_invoice_id` diisi alih-alih `purchase_receipt_id`).
4. THE pencarian Asset terkait (Criteria 1) SHALL dibatasi pada Asset yang belum memiliki `purchase_invoice_id` (menghindari mengaitkan ulang Asset yang sudah closed oleh invoice lain).

### Requirement 5: Kolom Asset menjadi nullable + validasi submit

**User Story:** As a staf aset, I want sistem mencegah Asset yang datanya belum lengkap untuk disetujui, so that setiap Asset yang aktif dijamin punya kategori dan lokasi yang jelas.

#### Acceptance Criteria

1. THE system SHALL mengubah migration `create_assets_table` (milik Spec 1, belum pernah dijalankan di lingkungan production) sehingga `asset_category_id` dan `asset_location_id` menjadi `nullable()`.
2. WHEN `AssetService::submit()` atau `checkApproval()` dipanggil pada Asset dengan `asset_category_id = null` OR `asset_location_id = null`, THE system SHALL menolak dengan `LogicException` pesan jelas (lang key baru `asset/asset.cannot_submit_incomplete`) menyebutkan field mana yang kosong.
3. THE `configColumns` pada `Asset` model SHALL tetap valid (lulus `DataTableConfigValidator`) meski `asset_category_id`/`asset_location_id` nullable — relasi `assetCategory`/`assetLocation` tetap resolve normal untuk Asset yang datanya kosong (menampilkan nilai kosong di tabel, bukan error).
4. THE Requirement ini TIDAK mengubah constraint NOT NULL kolom lain di tabel `assets` (`asset_name`, `code` tetap wajib).

### Requirement 6: Dialog "Lengkapi Data Asset" di halaman Purchase

**User Story:** As a staf aset, I want melengkapi kategori, lokasi, dan (opsional) memecah unit aset langsung dari halaman dokumen pembelian, so that saya tidak perlu berpindah ke halaman Asset terpisah untuk kerja yang berhubungan langsung dengan dokumen yang sedang saya lihat.

#### Acceptance Criteria

1. THE halaman Show `PurchaseReceipt` dan `PurchaseInvoice` SHALL menampilkan indikator (badge/alert) pada baris item yang memiliki Asset auto-created dengan `asset_category_id` atau `asset_location_id` masih kosong.
2. THE system SHALL menyediakan tombol aksi pada baris tersebut yang membuka dialog inline (BUKAN redirect halaman) berisi form: pilih `AssetCategory` (LinkModel), pilih `AssetLocation` (LinkModel), dan opsi jumlah pecahan (jika `asset_quantity > 1`).
3. WHEN user submit dialog TANPA memilih split (jumlah pecahan = 1 atau tidak diisi), THE system SHALL meng-update Asset yang sudah ada dengan `asset_category_id`/`asset_location_id` terpilih, `asset_quantity` tidak berubah.
4. WHEN user submit dialog DENGAN memilih split menjadi N bagian (N > 1, N ≤ `asset_quantity`), THE system SHALL:
   - Mengisi `asset_category_id`/`asset_location_id` yang sama pada seluruh hasil split.
   - Membuat N record `Asset` baru dengan total `asset_quantity` sama dengan `asset_quantity` Asset asal (pembagian merata; sisa pembagian bulat masuk ke unit pertama — mis. qty 5 split 3 menghasilkan `[2, 2, 1]` atau `[3, 1, 1]`, pilih salah satu aturan konsisten dan dokumentasikan di design.md).
   - Menghapus (soft-delete) Asset asal, MENGAITKAN seluruh Asset hasil split ke dokumen sumber yang sama (`purchase_receipt_id`/`purchase_invoice_id` tetap sama seperti Asset asal).
   - MEWARISKAN seluruh field lain (nama, tanggal beli, nilai — dibagi proporsional untuk nilai moneter) dari Asset asal ke tiap hasil split.
5. THE endpoint dialog SHALL divalidasi lewat FormRequest baru (mis. `CompleteAssetDataRequest`), memastikan `asset_category_id`/`asset_location_id` yang dipilih valid dan N split tidak melebihi `asset_quantity`.
6. THE aksi ini SHALL hanya tersedia untuk Asset yang masih `DRAFT` dan berasal dari dokumen Purchase yang sedang dilihat (tidak bisa melengkapi Asset milik dokumen lain dari halaman ini).

### Requirement 7: Konvensi struktur dan non-tujuan

**User Story:** As a developer, I want implementasi Fase 2 mengikuti konvensi domain/struktur folder yang sudah ditetapkan, so that kode tetap konsisten dengan seluruh codebase.

#### Acceptance Criteria

1. THE event dan listener baru SHALL ditempatkan di `app/Events/Asset/` dan `app/Listeners/Asset/` (domain `Asset`, bukan `Purchase`) — karena logic bisnisnya adalah "bagaimana Asset terbentuk", bukan "apa yang terjadi pada dokumen Purchase".
2. THE listener `CreateAssetFromPurchase` DAN calon listener domain Asset lain di masa depan (jika ada) SHALL ditempatkan dalam folder yang sama `app/Listeners/Asset/` TANPA nested Feature lebih lanjut kecuali jumlah listener domain Asset bertambah signifikan (ikuti aturan folder `{Domain}/{Feature}` berbasis jumlah file, bukan spekulasi).
3. THE spec ini SHALL TIDAK mengimplementasikan: depresiasi otomatis (Fase 3), Asset Movement/Maintenance/Repair (Fase 4), maupun Asset Capitalization (Fase 5) — field-field terkait yang sudah disiapkan skemanya di Spec 1 tetap tidak memiliki logic aktif tambahan di sini.
4. THE spec ini SHALL TIDAK mengubah perilaku Item/PurchaseReceipt/PurchaseInvoice untuk item yang BUKAN fixed-asset (`is_fixed_asset = false`) — seluruh alur existing (StockLedgerEntry, GeneralLedger, dll) tetap berjalan tanpa perubahan.
