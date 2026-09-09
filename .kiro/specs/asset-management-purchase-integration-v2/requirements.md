# Requirements Document

## Introduction

Spec `asset-management-purchase-integration` (Fase 2) menyediakan **satu** jalur pembuatan `Asset` dari dokumen Purchase: otomatis, dipicu event `FixedAssetItemApproved` saat baris item `is_fixed_asset` pada `PurchaseReceipt`/`PurchaseInvoice` disetujui. Jalur manual (`/assets/create`, Fase 1) sengaja mengunci `item_id` dan tidak menyediakan field `purchase_receipt_id`/`purchase_invoice_id` sama sekali — asumsinya, kalau Asset berasal dari pembelian, pasti lewat jalur otomatis itu.

Asumsi itu tidak selalu berlaku: user yang perannya hanya punya akses ke modul Asset (tidak punya akses baca dokumen Purchase) tetap perlu mencatat Asset yang faktanya berasal dari pembelian. Spec ini menambahkan **jalur kedua**: dari form manual Asset, `item_id` dibuka (LinkModel Item, difilter `is_fixed_asset = true`), berpasangan dengan **dua field independen** — link ke `PurchaseReceiptItem` dan link ke `PurchaseInvoiceItem` — yang bisa diisi salah satu, keduanya, atau tidak sama sekali.

**Prinsip pembagian sumber data** (berdasarkan alur procurement nyata — barang diterima secara fisik belum tentu bersamaan dengan tagihan final):
- **Quantity siap pakai** (`asset_quantity`) mengikuti `PurchaseReceiptItem` — dokumen yang mencatat barang benar-benar diterima secara fisik.
- **Harga final perolehan** (`net_purchase_amount`/`gross_purchase_amount`) mengikuti `PurchaseInvoiceItem` — dokumen tagihan resmi dari supplier (bisa berbeda dari rate di PO karena negosiasi/diskon).
- Kedua link ini **independen** dan boleh diisi bertahap (tidak harus sekaligus) — tapi begitu **keduanya** terisi, sistem **wajib memvalidasi bahwa keduanya saling terkait** (merujuk `PurchaseOrderItem` yang sama), supaya user tidak salah pasang dua dokumen yang kebetulan sama Item-nya tapi sebenarnya tidak berhubungan.
- **Guard baru**: Asset yang punya riwayat pembelian (`purchase_receipt_id` dan/atau `purchase_invoice_id` terisi) **tidak boleh Active** sampai **kedua** link (Receipt DAN Invoice) terisi — barang harus sudah diterima DAN sudah ditagih final sebelum aset dianggap capitalized. Guard ini berlaku **universal**: baik Asset dari jalur manual (spec ini) maupun dari jalur otomatis (Fase 2, existing) — ini review/perbaikan gap yang sudah ada di jalur otomatis (`CreateAssetFromPurchase::createFromInvoice()` bisa membuat Asset dari Invoice tanpa Receipt terkait, tanpa guard apa pun yang mencegahnya di-submit jadi Active).
- Melengkapi link yang belum lengkap (mis. baru ada Receipt, Invoice menyusul) dilakukan lewat **edit Asset biasa** — bukan dialog/mekanisme khusus.

**Di luar scope spec ini**:
- `asset_type` tetap terkunci ke `existing_asset` di form manual. Value `composite_asset`/`composite_component` tetap tanpa logic aktif (Fase 5 module asset, belum dikerjakan, tidak disentuh spec ini).
- Tidak ada perubahan pada *pembuatan* Asset otomatis (`CreateAssetFromPurchase` listener, event `FixedAssetItemApproved`) — spec ini menambah jalur pembuatan (manual) dan menambah guard submit (universal), bukan mengganti cara Asset dibuat otomatis.
- Dialog "Lengkapi Data Asset" (`CompleteAssetDataRequest`, untuk `asset_category`/`asset_location`) tidak berubah — beda konsen dari guard kelengkapan pembelian (Requirement 7) yang ditambahkan spec ini.

## Glossary

- **Link Receipt**: Asset yang `purchase_receipt_id`/`purchase_receipt_item_id`-nya terisi.
- **Link Invoice**: Asset yang `purchase_invoice_id`/`purchase_invoice_item_id`-nya terisi.
- **Baris pembelian**: `PurchaseReceiptItem` atau `PurchaseInvoiceItem` — baris pada dokumen Purchase.
- **Riwayat pembelian**: status suatu Asset yang punya Link Receipt dan/atau Link Invoice (salah satu atau keduanya terisi) — beda dari Asset manual murni (keduanya null).
- **Field derived**: field yang nilainya diambil otomatis dari baris pembelian terpilih, bukan diisi bebas — `asset_quantity`/`purchase_date` dari Link Receipt, `net_purchase_amount`/`gross_purchase_amount` dari Link Invoice. `item_id` derived hanya kalau ia belum terisi sebelum salah satu link dipilih (lihat Requirement 2).
- **Guard kelengkapan pembelian**: aturan baru pada titik submit (`AssetService::submit()`) — Asset dengan riwayat pembelian tidak boleh Active kecuali Link Receipt DAN Link Invoice keduanya terisi.

## Requirements

### Requirement 1: Buka `item_id` di form manual, difilter fixed asset

**User Story:** As a staf yang hanya punya akses ke modul Asset, I want memilih Item (fixed asset) saat membuat Asset manual, so that Asset yang saya catat punya rujukan Item yang jelas, sebagai titik masuk untuk (opsional) link ke pembelian.

#### Acceptance Criteria

1. THE form `/assets/create` SHALL membuka field `item_id` (LinkModel Item, sebelumnya disabled) agar bisa dipilih manual.
2. THE pilihan Item pada field ini SHALL difilter hanya menampilkan `Item` dengan `is_fixed_asset = true`.
3. `item_id` SHALL tetap opsional (nullable) — Asset manual tanpa Item sama sekali (perilaku saat ini) tetap didukung.

### Requirement 2: Link independen ke Purchase Receipt Item & Purchase Invoice Item

**User Story:** As a staf Asset, I want dua field terpisah untuk link ke baris Purchase Receipt dan Purchase Invoice, so that saya bisa mengisi salah satu duluan (tergantung dokumen mana yang saya punya informasinya) tanpa dipaksa mengisi keduanya sekaligus.

#### Acceptance Criteria

1. THE form `/assets/create` SHALL menyediakan dua LinkModel terpisah: "Purchase Receipt Item" dan "Purchase Invoice Item", keduanya opsional dan independen satu sama lain.
2. WHEN `item_id` sudah terisi (dari Requirement 1 atau ter-derive dari salah satu link), THE pilihan pada kedua LinkModel tersebut SHALL difilter ke baris pembelian untuk Item yang sama.
3. WHEN `item_id` belum terisi, THE pilihan pada kedua LinkModel tersebut SHALL menampilkan seluruh baris pembelian untuk Item dengan `is_fixed_asset = true`, tanpa filter Item tertentu.
4. THE pilihan pada kedua LinkModel tersebut SHALL memfilter keluar baris yang sudah punya `Asset` lain terkait — dicek lewat `Asset::where('purchase_receipt_item_id', <id>)` / `Asset::where('purchase_invoice_item_id', <id>)` yang exists dan tidak soft-deleted. Filter ini diterapkan di level query, bukan hanya validasi setelah submit.
5. WHEN user memilih baris pertama (Receipt atau Invoice, mana pun duluan) SEDANGKAN `item_id` masih kosong, THE system SHALL menge-derive dan mengunci `item_id` dari baris tersebut (read-only).
6. WHEN user KEMUDIAN mengisi link kedua (dokumen yang satunya), THE system SHALL memvalidasi baris kedua itu untuk Item yang sama dengan `item_id` saat ini — tolak (tampilkan error) kalau Item beda.
7. WHEN kedua link (Receipt DAN Invoice) sama-sama terisi, THE system SHALL memvalidasi keduanya saling terkait — merujuk `PurchaseOrderItem` yang sama (pola sama seperti `CreateAssetFromPurchase::findAssetFromRelatedReceipt()`) — tolak kalau tidak match, mencegah user memasangkan dua dokumen yang kebetulan sama Item-nya tapi sebenarnya tidak berhubungan. Asumsi bisnis: `PurchaseReceipt` selalu berasal dari `PurchaseOrder` (kolom `purchase_order_item_id` pada `purchase_receipt_items` nullable secara skema, tapi tidak ada alur direct-receipt-tanpa-PO di proses bisnis ini) — validasi ini TIDAK perlu jalur skip untuk kasus `purchaseOrderItem` null; kalau ternyata null, perlakukan sebagai data anomali dan tolak (bukan diloloskan diam-diam).
8. WHEN user menghapus salah satu link, THE field derived dari link tersebut SHALL dikosongkan/kembali editable (Requirement 3) — TAPI `item_id` SHALL TETAP terisi apabila link yang tersisa masih ada dan itemnya sama (tidak ikut ter-reset kalau masih valid dari sumber lain).
9. Kedua link ini SHALL bersifat opsional — Asset manual boleh dibuat tanpa link Purchase sama sekali (perilaku saat ini tidak berubah).

### Requirement 3: Derive field independen per dokumen

**User Story:** As a staf Asset, I want kuantitas ikut data Receipt dan nilai perolehan ikut data Invoice secara otomatis, so that datanya konsisten dengan dokumen aslinya dan tidak saya ketik ulang secara manual.

#### Acceptance Criteria

1. WHEN Link Receipt terisi, THE system SHALL mengisi otomatis dan mengunci (read-only): `asset_quantity` (dari `quantity` baris), `purchase_date` (dari `purchaseReceipt.received_date`).
2. WHEN Link Invoice terisi, THE system SHALL mengisi otomatis dan mengunci (read-only): `net_purchase_amount`/`gross_purchase_amount` (dari `rate`/`amount` baris `PurchaseInvoiceItem`, yang punya field `rate` sendiri — TIDAK perlu fallback ke `purchaseOrderItem` seperti pada Receipt).
3. WHEN Link Receipt terisi TAPI Link Invoice belum, THE `net_purchase_amount`/`gross_purchase_amount` SHALL tetap editable manual (default `0`) sampai Link Invoice diisi — TIDAK memaksa isi rate dari `purchaseOrderItem` sebagai pengganti (berbeda dari `CreateAssetFromPurchase::createFromReceipt()` yang memang begitu untuk kasus otomatis; di jalur manual, harga final ditunggu dari Invoice, bukan diperkirakan dari PO).
4. WHEN Link Invoice terisi TAPI Link Receipt belum, THE `asset_quantity` SHALL tetap editable manual sampai Link Receipt diisi.
5. WHEN Link Receipt DAN Link Invoice keduanya terisi DAN `purchase_date` tersedia dari keduanya, THE system SHALL mengutamakan `purchase_date` dari Receipt (tanggal barang diterima secara fisik lebih relevan untuk pencatatan Asset dibanding tanggal invoice).
6. WHEN user menghapus Link Receipt, THE `asset_quantity`/`purchase_date` (yang berasal darinya) SHALL kembali editable dan dikosongkan.
7. WHEN user menghapus Link Invoice, THE `net_purchase_amount`/`gross_purchase_amount` SHALL kembali editable dan dikosongkan.

### Requirement 4: Validasi backend

**User Story:** As pengembang, I want validasi server-side yang tidak bergantung pada FE, so that data tidak bisa dipalsukan lewat request langsung ke endpoint.

#### Acceptance Criteria

1. THE `AssetRequest` SHALL menambahkan rule untuk `purchase_receipt_id`, `purchase_invoice_id`, `purchase_receipt_item_id`, `purchase_invoice_item_id` (nullable, `exists` ke tabel masing-masing) — field ini saat ini tidak punya rule sama sekali.
2. WHEN `item_id` diisi, THE system SHALL memvalidasi Item tersebut `is_fixed_asset = true`.
3. WHEN `purchase_receipt_item_id` diisi, THE system SHALL memvalidasi baris tersebut belum dipakai `Asset` lain (guard idempoten server-side) — cegah race condition dua user memilih baris yang sama bersamaan. Setara untuk `purchase_invoice_item_id`.
4. WHEN `purchase_receipt_item_id` diisi, THE system SHALL memvalidasi `item_id` yang dikirim sama dengan item pada baris tersebut, dan `asset_quantity` yang dikirim sama dengan hasil derive dari baris tersebut. Setara untuk `purchase_invoice_item_id` terhadap `net_purchase_amount`/`gross_purchase_amount`.
5. WHEN `purchase_receipt_item_id` DAN `purchase_invoice_item_id` keduanya diisi, THE system SHALL memvalidasi keduanya merujuk `PurchaseOrderItem` yang sama (Requirement 2.7).
6. THE `purchase_receipt_id` SHALL konsisten dengan `purchase_receipt_item_id` yang dipilih (baris harus milik dokumen yang sama) — dan setara untuk invoice.

### Requirement 5: `asset_type` tetap terkunci

**User Story:** As pengembang, I want kepastian bahwa scope spec ini tidak menyentuh `composite_asset`/`composite_component`, so that tidak ada scope creep ke Fase 5 yang belum direncanakan.

#### Acceptance Criteria

1. THE form manual Asset SHALL tetap mengunci `asset_type` ke `existing_asset` (sudah diimplementasikan, tidak berubah oleh spec ini).

### Requirement 6: Asset dari jalur manual selalu langsung lengkap kategori/lokasi

**User Story:** As pengembang, I want kepastian bahwa Asset hasil jalur manual tidak pernah butuh dialog "Lengkapi Data Asset", so that tidak ada logic ganda/ambigu antara jalur manual dan jalur otomatis.

#### Acceptance Criteria

1. THE Asset hasil jalur manual SHALL selalu dibuat dengan `asset_category_id`/`asset_location_id` terisi (form manual sudah mewajibkan `asset_category.id`/`asset_location.id` di `AssetRequest`, tidak berubah oleh spec ini).
2. Dialog "Lengkapi Data Asset" (`CompleteAssetDataRequest`, endpoint `completeData`) SHALL TIDAK relevan untuk Asset hasil jalur manual — baik dengan maupun tanpa link Purchase. Ini concern terpisah dari guard kelengkapan pembelian (Requirement 7): kategori/lokasi vs Receipt/Invoice adalah dua hal berbeda yang kebetulan sama-sama gerbang sebelum Active.

### Requirement 7: Guard kelengkapan pembelian sebelum Active (universal)

**User Story:** As pengembang/auditor aset, I want Asset yang berasal dari pembelian tidak bisa Active sebelum barangnya benar-benar diterima DAN ditagih final, so that nilai buku Asset yang tercatat aktif selalu punya dasar dokumen pembelian yang lengkap.

#### Acceptance Criteria

1. WHEN Asset punya riwayat pembelian (`purchase_receipt_id` dan/atau `purchase_invoice_id` terisi) DAN salah satu dari keduanya masih kosong, THE `AssetService::submit()` SHALL menolak submit dengan pesan error (pola sama seperti pengecekan `asset_category_id`/`asset_location_id` yang sudah ada di method yang sama, `asset/asset.cannot_submit_incomplete`).
2. Guard ini SHALL berlaku universal — untuk Asset dari jalur manual (spec ini) MAUPUN Asset dari jalur otomatis (`CreateAssetFromPurchase`, Fase 2, existing) — karena keduanya sama-sama submit lewat `AssetService::submit()`.
3. Asset TANPA riwayat pembelian sama sekali (`purchase_receipt_id` dan `purchase_invoice_id` keduanya null) SHALL TIDAK terpengaruh guard ini — tetap bisa Active seperti perilaku sekarang.
4. Melengkapi link yang kurang pada Asset yang sudah ada (draft, ditolak submit karena guard ini) SHALL dilakukan lewat form update Asset biasa (`AssetService::update()`, sudah mendukung field `purchase_*` sejak Requirement 4) — bukan mekanisme/dialog terpisah.

## Pertanyaan terbuka (perlu konfirmasi sebelum lanjut ke design)

1. ~~UI pilihan baris pembelian?~~ **Terjawab**: 2 LinkModel terpisah ("Purchase Receipt Item" dan "Purchase Invoice Item"), bukan 1 gabungan.
2. ~~Pesan error guard kelengkapan pembelian?~~ **Terjawab**: reuse key `asset/asset.cannot_submit_incomplete` yang sudah ada (Requirement 7.1).
3. ~~Validasi keterkaitan Receipt-Invoice kalau `purchaseOrderItem` null?~~ **Terjawab**: tidak ada skip-case — `PurchaseReceipt` selalu berasal dari PO menurut proses bisnis ini; kalau `purchaseOrderItem` null, itu data anomali dan ditolak (Requirement 2.7).

Semua pertanyaan terbuka sudah terjawab. Requirements siap lanjut ke design.
