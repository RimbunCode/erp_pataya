# Requirements Document

## Introduction

Spec kedua program **Konfigurasi Modul** (lihat `docs/prd/module-settings-prd.md`). Saat ini pajak dan gudang hanya ada di baris item dokumen dan harus diisi manual, dan tidak ada kontrol rantai dokumen yang dapat dikonfigurasi. Spec ini menambahkan, di atas fondasi `module-settings-foundation`:

1. **Default transaksi**: pajak, gudang, dan termin pembayaran default yang mengisi dokumen/baris **baru** pada Purchase dan Sales (dan Inventory sebagai cadangan gudang).
2. **Kontrol rantai dokumen**: wajib PO sebelum Receipt/Invoice, wajib Receipt sebelum Invoice, wajib SO sebelum DN/Invoice, wajib DN sebelum Invoice.
3. **Toleransi** penerimaan, pengiriman, dan penagihan berlebih (%).
4. **Halaman setting** Purchase, Sales, dan Inventory dengan tab "Default" dan "Transaksi".

**Prinsip:** semua nilai berawal **netral** (default kosong, kontrol nonaktif, toleransi 0) sehingga merge **tidak mengubah perilaku**; default **mengisi** form baru dan tetap dapat diubah user; kontrol dan toleransi hanya berlaku bila diaktifkan.

**Prasyarat:** `module-settings-foundation` selesai (model `ModuleSetting`, `SettingsService`, registry halaman, menu). Spec ini **tidak** bergantung pada Finance Engine; akun, diskon, dan selisih kurs bukan bagian spec ini.

**Di luar scope:**
- Akun default dan aturan akun (Finance P2).
- Default bersyarat pajak/gudang menurut tipe/kategori barang (spec `module-conditional-defaults`, bergantung spec ini).
- Kunci periode dan kontrol pembukuan (Finance P1/P6).
- Mengubah alur persetujuan (approval scheme).

## Glossary

- **Default transaksi**: nilai yang mengisi field kosong pada dokumen/baris baru.
- **Rantai dokumen**: urutan dokumen sumber → turunan (PR → PO → Receipt → Invoice; SO → DN → Invoice).
- **Kontrol rantai**: setting yang mewajibkan dokumen turunan berasal dari dokumen sumbernya.
- **Toleransi**: persentase kelebihan yang diizinkan atas kuantitas/nilai dokumen sumber.
- **Baris di luar sumber**: baris Receipt/Invoice/DN tanpa baris sumber (fitur `*-off-po-items`, `*-off-source-items`).
- **Item stok**: item dengan `is_stock_item = true`.

## Requirements

### Requirement 1: Skema dan model setting

**User Story:** Sebagai developer, saya ingin kolom setting bertipe untuk default dan kontrol, so that nilainya tervalidasi dan referensinya terjaga.

#### Acceptance Criteria

1. THE sistem SHALL membuat tabel `purchase_settings` dan `inventory_settings`, dan menambah kolom pada `sales_settings` (dari spec fondasi), memakai `ModuleSetting` dan migrasi sendiri.
2. THE `purchase_settings` SHALL memuat: `default_tax_id` (FK `taxes`, `nullOnDelete`), `default_target_warehouse_id` (FK `warehouses`, `nullOnDelete`), `default_payment_term_template_id` (FK `payment_term_templates`, `nullOnDelete`; lihat Requirement 4), `require_po_for_receipt`, `require_po_for_invoice`, `require_receipt_for_invoice` (boolean, default `false`), `over_receipt_tolerance_percent` dan `over_billing_tolerance_percent` (decimal(5,2), default `0`).
3. THE `sales_settings` SHALL menambah: `default_source_warehouse_id` (FK `warehouses`, `nullOnDelete`), `default_payment_term_template_id`, `require_so_for_delivery_note`, `require_so_for_invoice`, `require_dn_for_invoice` (boolean, default `false`), `over_delivery_tolerance_percent` dan `over_billing_tolerance_percent` (decimal(5,2), default `0`); `default_tax_id` sudah ada dari spec fondasi.
4. THE `inventory_settings` SHALL memuat `default_warehouse_id` (FK `warehouses`, `nullOnDelete`) sebagai cadangan gudang umum.
5. THE `rules()` tiap model SHALL menolak persentase di luar 0–100 dan referensi ke baris yang tidak ada atau berstatus nonaktif/terhapus.
6. THE nilai awal SHALL netral sehingga migrasi tidak mengubah perilaku aplikasi.

### Requirement 2: Pajak default

**User Story:** Sebagai user Purchase/Sales, saya ingin pajak terisi otomatis pada baris baru, so that saya tidak perlu memilihnya berulang kali.

#### Acceptance Criteria

1. WHEN baris item baru ditambahkan pada dokumen **baru** (Purchase Order, Sales Order, Purchase Invoice, Sales Invoice, Quotation), THE form SHALL mengisi `tax_id` dengan pajak default modulnya bila field kosong; Purchase memakai `purchase_settings.default_tax_id`, Sales dan Quotation memakai `sales_settings.default_tax_id`.
2. THE default SHALL tidak menimpa nilai yang sudah ada: baris yang berasal dari dokumen sumber (konversi PR→PO, PO→Receipt/Invoice, SO→DN/Invoice, duplikasi) mempertahankan pajaknya.
3. THE user SHALL tetap dapat mengubah atau mengosongkan pajak pada baris.
4. IF pajak default dinonaktifkan atau dihapus, THEN THE default SHALL tidak mengisi apa pun dan halaman setting SHALL menampilkan peringatan.
5. THE `QuotationController` yang sudah memakai pajak default SHALL tetap berperilaku sama (sumber nilai kini `sales_settings.default_tax_id`).
6. THE dokumen yang sudah ada dan baris yang sudah tersimpan SHALL tidak diubah.

### Requirement 3: Gudang default

**User Story:** Sebagai user Purchase/Sales, saya ingin gudang terisi otomatis, so that tidak ada baris tanpa gudang karena lupa memilih.

#### Acceptance Criteria

1. WHEN baris **item stok** baru ditambahkan pada dokumen baru, THE form SHALL mengisi gudang bila field kosong: `target_warehouse_id` dari `purchase_settings.default_target_warehouse_id` (Purchase Order dan dokumen penerimaan), `source_warehouse_id` dari `sales_settings.default_source_warehouse_id` (Sales Order, Delivery Note).
2. IF setting modul kosong, THEN THE form SHALL memakai `inventory_settings.default_warehouse_id`; bila kosong juga, field dibiarkan kosong.
3. THE item non-stok SHALL tidak diberi gudang oleh default.
4. THE default SHALL tidak menimpa gudang pada baris yang berasal dari dokumen sumber, dan SHALL tetap dapat diubah user.
5. IF gudang default nonaktif atau terhapus, THEN THE default SHALL tidak mengisi apa pun dan halaman setting SHALL menampilkan peringatan.
6. THE form Stock Entry dan dokumen inventori lain SHALL memakai `inventory_settings.default_warehouse_id` hanya bila hasil verifikasi Task 1 menunjukkan field gudangnya wajib diisi manual saat ini; bila tidak, di luar scope.

### Requirement 4: Termin pembayaran default

**User Story:** Sebagai user, saya ingin termin pembayaran terisi otomatis, so that jadwal pembayaran konsisten.

#### Acceptance Criteria

1. WHEN dokumen **baru** Purchase Order, Sales Order, Purchase Invoice, atau Sales Invoice dibuat dan jadwal pembayarannya (`payment_schedules`) masih kosong, THE form SHALL mengisi jadwal dari `default_payment_term_template_id` memakai konversi templat → baris jadwal yang sama dengan pemilih templat pada komponen `PaymentSchedule` (item templat menjadi baris jadwal).
2. THE dokumen turunan dari dokumen sumber SHALL mempertahankan jadwalnya; default tidak menimpa jadwal yang sudah ada.
3. THE user SHALL tetap dapat mengubah atau mengosongkan jadwal, atau memilih templat lain.
4. THE sistem SHALL tidak menambah kolom penaut templat pada dokumen: templat hanya menjadi sumber salinan, sebagaimana pemilih templat saat ini.
5. IF templat default nonaktif atau terhapus, THEN THE default SHALL tidak mengisi apa pun dan halaman setting SHALL menampilkan peringatan.
6. THE Purchase Receipt, Delivery Note, dan Quotation yang tidak memiliki jadwal pembayaran SHALL tidak terkena requirement ini (diverifikasi Task 1.4).

### Requirement 5: Halaman setting Purchase, Sales, dan Inventory

**User Story:** Sebagai admin, saya ingin mengatur default dan kontrol dari satu halaman per modul, so that mudah ditemukan.

#### Acceptance Criteria

1. THE sistem SHALL menyediakan halaman **Purchase Settings**, **Sales Settings** (melengkapi halaman dari spec fondasi), dan **Inventory Settings** memakai `ModuleSettingsPage`, terdaftar di registry dengan desk menurut pemetaan spec fondasi.
2. THE halaman Purchase dan Sales SHALL memiliki tab **Default** (pajak, gudang, termin) dan **Transaksi** (kontrol rantai dokumen dan toleransi); halaman Inventory memiliki tab **Default**.
3. THE pemilih pajak, gudang, dan termin SHALL hanya menampilkan baris aktif.
4. THE halaman SHALL menampilkan peringatan bila referensi default nonaktif/terhapus dan keterangan singkat perilaku tiap kontrol.
5. THE izin halaman mengikuti model setting (`read`/`write`) dan perubahan tercatat audit (spec fondasi).
6. THE teks UI SHALL memakai kunci terjemahan `lang/id` dan `lang/en`; komponen baru memiliki test `.rtl.test.jsx`.

### Requirement 6: Kontrol rantai dokumen (GATED hasil verifikasi Task 1)

**User Story:** Sebagai pemilik proses, saya ingin mewajibkan urutan dokumen, so that pembelian dan penjualan tercatat berurutan.

#### Acceptance Criteria

1. THE kontrol SHALL hanya berlaku pada dokumen yang **saat ini dapat dibuat tanpa dokumen sumber** (diinventaris Task 1); kontrol untuk dokumen yang secara struktural selalu bersumber ditandai tidak berlaku dan tidak dibuat.
2. WHEN `require_po_for_receipt` aktif, THE Purchase Receipt tanpa Purchase Order SHALL ditolak saat simpan dan saat approve dengan pesan berlokalisasi; demikian pula `require_po_for_invoice` (Purchase Invoice), `require_receipt_for_invoice`, `require_so_for_delivery_note`, `require_so_for_invoice`, `require_dn_for_invoice`.
3. THE retur (`return_against_id`) SHALL tidak terkena kontrol ini.
4. THE baris di luar sumber pada dokumen yang bersumber (fitur `*-off-po-items`, `*-off-source-items`) SHALL tetap diizinkan; perubahan perlakuan ditentukan Q-S6 dan memerlukan setting terpisah.
5. WHEN kontrol nonaktif (default), THE perilaku dokumen SHALL identik dengan sekarang.
6. THE UI SHALL menyembunyikan atau menonaktifkan aksi "buat tanpa sumber" bila kontrol aktif, dan validasi server SHALL tetap menjadi penjaga utama.
7. THE perubahan setting SHALL tidak memengaruhi dokumen yang sudah dibuat.

### Requirement 7: Toleransi penerimaan, pengiriman, dan penagihan

**User Story:** Sebagai staf gudang dan keuangan, saya ingin toleransi kelebihan yang dapat diatur, so that selisih kecil tidak menghambat proses.

#### Acceptance Criteria

1. THE `over_receipt_tolerance_percent` SHALL mengizinkan kuantitas Purchase Receipt per baris sampai `sisa × (1 + persen/100)`; `over_delivery_tolerance_percent` serupa untuk Delivery Note.
2. THE `over_billing_tolerance_percent` SHALL mengizinkan nilai/kuantitas tagihan Purchase/Sales Invoice sampai `dokumen sumber × (1 + persen/100)`.
3. THE nilai `0` (default) SHALL menghasilkan validasi identik dengan sekarang.
4. THE validasi SHALL dilakukan server-side saat simpan dan diulang di bawah lock saat approve, mengikuti pola validasi sisa yang ada (mis. `ReturnAgainstItemRules`, validasi `received_quantity`).
5. THE pesan galat SHALL menyebut batas yang berlaku (sisa dan toleransi).

### Requirement 8: Kontrol opsional (perlu konfirmasi sebelum dikerjakan)

**User Story:** Sebagai pemilik produk, saya ingin kontrol tambahan ala ERPNext bila perlu, so that harga dan stok terjaga.

#### Acceptance Criteria

1. THE kontrol berikut SHALL dikerjakan hanya setelah pemilik produk mengonfirmasi cakupannya (aturan proyek untuk task opsional): peringatan atau blokir saat tarif berubah antar dokumen dalam satu rantai (`rate_change_action`: `none`/`warn`/`stop`), validasi harga jual di bawah harga beli/valuasi, izin stok negatif (hanya bila Task 1 menunjukkan perilaku saat ini dapat dikonfigurasi dengan aman).
2. THE setiap kontrol opsional SHALL berawal nonaktif dan tidak mengubah perilaku sampai diaktifkan.

### Requirement 9: Non-fungsional

#### Acceptance Criteria

1. THE perubahan SHALL tidak mengubah perilaku selama setting bernilai default netral; test regresi dokumen Purchase/Sales/Inventory yang disentuh SHALL tetap hijau.
2. THE pembacaan default SHALL memakai `SettingsService` (satu query per tabel per request) dan tidak melakukan query per baris.
3. THE seluruh migrasi SHALL aditif dengan `down()`.
4. THE kunci terjemahan baru tersedia di `lang/id` dan `lang/en` (`LocaleKeysTest`).
5. THE nama berkas mengikuti `{Domain}/{Feature}`; test backend PHPUnit, frontend Vitest.

## Pertanyaan yang Menunggu Konfirmasi

| ID | Pertanyaan | Dampak |
|---|---|---|
| Q-S6 | Perlakuan kontrol rantai terhadap baris di luar sumber (`*-off-po-items`) | Requirement 6.4 |
| Q-S7 | ~~Perlukah default bersyarat?~~ Dijawab 2026-10-18: dibutuhkan; ditangani spec `module-conditional-defaults` | — |
| Q-D1 | Dokumen mana yang saat ini dapat dibuat tanpa sumber (menentukan kontrol yang berlaku) | Requirement 6.1 |
| Q-D2 | Apakah stok negatif sudah dikontrol di kode saat ini? | Requirement 8.1 |
