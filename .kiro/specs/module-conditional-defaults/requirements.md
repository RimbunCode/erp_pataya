# Requirements Document

## Introduction

Spec keempat program **Konfigurasi Modul** (lihat `docs/prd/module-settings-prd.md`). Spec `module-defaults-and-controls` memberi **satu** pajak dan **satu** gudang default per modul. Kebutuhan nyata lebih halus: barang berbeda perlu pajak/gudang berbeda (mis. jasa tanpa gudang dan tanpa pajak tertentu, kategori tertentu bebas pajak, gudang berbeda per kategori). Spec ini menambahkan **aturan default bersyarat** dengan pola yang mirip Odoo (pajak default menurut jenis barang), tetapi dikelola terpusat di halaman setting:

1. **Aturan pajak default** dan **aturan gudang default** menurut jenis dokumen serta atribut barang: `type`, `is_stock_item`, `category_id`.
2. **Pencocokan** berdasarkan spesifisitas dan prioritas, dengan fallback ke default modul (spec defaults), lalu gudang umum Inventory.
3. **Endpoint resolusi** yang dipanggil form saat barang dipilih pada baris baru.
4. **Tab "Aturan Default"** pada halaman Purchase Settings dan Sales Settings.

**Kait multi-pajak:** pemilik produk berencana mendukung **beberapa pajak per baris** (pola Odoo) di masa depan. Spec ini belum mengubah skema baris dokumen (tetap satu `tax_id` per baris), tetapi **hasil resolusi berbentuk daftar** (`tax_ids`) agar kontrak frontend tidak berubah ketika spec `multi-tax-per-line` datang (lihat PRD).

**Prinsip:** nilai berawal **kosong** (tanpa aturan) sehingga perilaku sama dengan spec defaults; aturan hanya **mengisi** field kosong pada baris baru, tidak menimpa, dan dapat diubah user.

**Prasyarat:** `module-settings-foundation` dan `module-defaults-and-controls` selesai (resolver default, hook `useDocumentDefaults`, halaman Purchase/Sales Settings). Tidak bergantung pada Finance Engine.

**Di luar scope:**
- Aturan akun bersyarat (Finance P2 Requirement 12).
- Penyimpanan banyak pajak per baris dan perhitungannya (spec masa depan `multi-tax-per-line`, bergantung Finance P3).
- Pemetaan pajak menurut pelanggan/pemasok (mirip *fiscal position* Odoo); ditanyakan di Q-C1 dan tidak dikerjakan di sini.
- Default termin pembayaran bersyarat.

## Glossary

- **Aturan default**: baris konfigurasi (jenis dokumen, kondisi barang) → nilai default (pajak atau gudang).
- **Kondisi barang**: `item_type` (kolom `items.type`), `is_stock_item`, `item_category_id`.
- **Spesifisitas**: jumlah kondisi non-null yang dimiliki sebuah aturan.
- **Fallback**: default modul dari spec defaults, lalu `inventory_settings.default_warehouse_id` khusus gudang.

## Requirements

### Requirement 1: Tabel aturan default

**User Story:** Sebagai admin, saya ingin aturan default tersimpan bertipe dan berelasi, so that referensinya terjaga.

#### Acceptance Criteria

1. THE sistem SHALL membuat tabel `default_tax_rules` dengan kolom: `module` (`purchase`/`sales`), `document_type` nullable, `item_type` nullable, `is_stock_item` nullable boolean, `item_category_id` nullable (FK `categories`, `cascadeOnDelete`), `tax_id` nullable (FK `taxes`, `restrictOnDelete`; null berarti "tanpa pajak"), `priority` unsigned integer, timestamps.
2. THE sistem SHALL membuat tabel `default_warehouse_rules` dengan kolom yang sama kecuali `warehouse_id` (FK `warehouses`, `restrictOnDelete`, wajib) menggantikan `tax_id`.
3. THE kondisi bernilai null berarti tidak dibatasi; aturan tanpa kondisi sama sekali SHALL ditolak (itu tugas default modul).
4. THE dua aturan dengan kombinasi kondisi identik pada `module` yang sama SHALL ditolak saat disimpan.
5. THE aturan pajak dengan `tax_id = null` SHALL berarti "kosongkan pajak" (pengecualian eksplisit), berbeda dari "tidak ada aturan".
6. THE aturan gudang SHALL tidak dapat memuat `is_stock_item = false` (item non-stok tidak pernah diberi gudang).
7. THE `rules()` SHALL menolak pajak/gudang nonaktif atau terhapus dan kategori yang tidak ada.

### Requirement 2: Pencocokan dan urutan fallback

**User Story:** Sebagai admin, saya ingin hasil default dapat diprediksi, so that tidak ada kejutan.

#### Acceptance Criteria

1. THE `DefaultRuleMatcher` SHALL memilih aturan yang semua kondisi non-null-nya sama dengan konteks (jenis dokumen dan atribut barang); bila ada beberapa, SHALL memilih yang spesifisitasnya terbesar, lalu `priority` terbesar.
2. THE urutan resolusi pajak SHALL: aturan cocok → `default_tax_id` modul → kosong.
3. THE urutan resolusi gudang SHALL: (hanya item stok) aturan cocok → default gudang modul (tujuan untuk Purchase, asal untuk Sales) → `inventory_settings.default_warehouse_id` → kosong.
4. THE hasil SHALL deterministik: input sama menghasilkan nilai sama, tidak bergantung urutan penyimpanan.
5. THE pencocokan SHALL murni (tanpa efek samping) dan tidak membaca dokumen tersimpan.

### Requirement 3: Endpoint resolusi

**User Story:** Sebagai developer frontend, saya ingin satu endpoint untuk mengetahui default suatu barang, so that logika pencocokan hanya ada di server.

#### Acceptance Criteria

1. THE sistem SHALL menyediakan `POST /defaults/resolve` dengan body `{document_type, items: [{item_id}]}` dan respons peta `item_id → {tax_ids: string[], warehouse_id: string|null}`.
2. THE `tax_ids` SHALL berbentuk daftar (kosong, atau satu elemen pada v1) sebagai kait multi-pajak.
3. THE endpoint SHALL dibatasi autentikasi dan izin `read`/`create` pada model dokumen terkait, dan SHALL membatasi jumlah barang per permintaan.
4. THE endpoint SHALL menjalankan satu query aturan per jenis (pajak, gudang) per permintaan dan satu query atribut barang, bukan query per barang.
5. THE endpoint SHALL tidak menulis data apa pun.

### Requirement 4: Penerapan di form

**User Story:** Sebagai user, saya ingin pajak dan gudang terisi tepat setelah memilih barang, so that saya tidak mengisinya manual.

#### Acceptance Criteria

1. WHEN user memilih barang pada **baris baru** dokumen **baru**, THE form SHALL memanggil endpoint resolusi dan mengisi `tax_id` (elemen pertama `tax_ids`) dan gudang hanya bila field masih kosong.
2. THE form SHALL tidak menimpa nilai yang sudah ada, baris yang berasal dari dokumen sumber, maupun nilai yang diubah user setelah terisi.
3. IF pemanggilan endpoint gagal, THEN THE form SHALL memakai default modul dari prop `defaults` (spec defaults) dan tidak memblokir user.
4. THE form SHALL mengelompokkan pemanggilan (satu permintaan untuk beberapa barang yang ditambahkan bersamaan).
5. THE perilaku untuk Quotation SHALL sama seperti Sales.

### Requirement 5: Halaman setting

**User Story:** Sebagai admin, saya ingin mengelola aturan default dari halaman setting, so that tidak perlu bantuan developer.

#### Acceptance Criteria

1. THE halaman **Purchase Settings** dan **Sales Settings** SHALL memiliki tab **Aturan Default** berisi dua tabel yang dapat diedit (pajak dan gudang), dengan kolom jenis dokumen, tipe barang, status stok, kategori, nilai, dan prioritas.
2. THE pemilih nilai SHALL hanya menampilkan pajak/gudang aktif, dan penyimpanan menolak kombinasi duplikat atau tanpa kondisi.
3. THE halaman SHALL menampilkan peringatan bila aturan menunjuk referensi yang kemudian nonaktif atau terhapus, dan pratinjau "hasil untuk barang X" (memanggil endpoint resolusi).
4. THE izin dan audit mengikuti model setting (`read`/`write`); aturan tercatat audit bersama setting.
5. THE teks UI memakai kunci terjemahan `lang/id` dan `lang/en`; komponen baru memiliki test `.rtl.test.jsx`.

### Requirement 6: Non-fungsional

#### Acceptance Criteria

1. THE tanpa aturan, THE hasil dan perilaku form SHALL identik dengan spec `module-defaults-and-controls`.
2. THE aturan SHALL hanya memengaruhi dokumen/baris baru; dokumen tersimpan tidak berubah.
3. THE migrasi SHALL aditif dengan `down()`.
4. THE nama berkas mengikuti `{Domain}/{Feature}`; test backend PHPUnit, frontend Vitest; `LocaleKeysTest` hijau.

## Pertanyaan yang Menunggu Konfirmasi

| ID | Pertanyaan | Dampak |
|---|---|---|
| Q-C1 | Perlukah pajak default menurut pelanggan/pemasok (mirip *fiscal position* Odoo), misalnya pelanggan luar negeri bebas PPN? | Di luar scope sekarang |
| Q-C2 | Apakah kondisi cukup tipe, kategori, dan status stok, atau perlu atribut lain (mis. grup barang induk)? | Requirement 1 |
| Q-C3 | Pembagian pemakaian pencocok bersama dengan Finance P2 (`AccountRuleMatcher`) atau implementasi terpisah | Design |
