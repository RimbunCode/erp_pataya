# Requirements Document

## Introduction

Diturunkan dari [design.md](design.md) (`design-first`). Menyatukan section Asset Items ke tabel Items pada Sales Order lewat LinkModel multi-model.

## Glossary

- **Baris item**: baris `sales_order_items` dengan `item_id` (ItemVariant).
- **Baris asset**: baris `sales_order_items` dengan `asset_id` (satu baris = satu Asset).

## Requirements

### Requirement 1: Satu tabel Items

1. THE form Sales Order SHALL memiliki satu tabel Items; section dan tabel Asset Items SHALL dihapus.
2. THE kolom item SHALL memakai LinkModel multi-model: model utama ItemVariant (filter `item.is_fixed_asset=false` dipertahankan) dan sub model Asset.
3. WHEN pengguna memilih opsi Asset, THE baris SHALL mengisi `asset` dan mengosongkan `item`, `unit`, `source_warehouse`, dengan `conversion_factor` 1; WHEN memilih opsi ItemVariant, THE baris SHALL mengosongkan `asset`.
4. THE sub model Asset SHALL hanya menawarkan Asset berstatus aktif (`status` memuat `active`); WHEN `is_rent` SO aktif, THE sub model SHALL hanya menawarkan Asset `is_rentable`.
5. WHEN pengguna memilih opsi Asset, THE `quantity` baris SHALL langsung terisi 1.
6. THE sel `unit`, `source_warehouse`, dan `available_quantity` SHALL nonaktif pada baris asset; Tax SHALL tetap wajib.
7. Total dokumen dan alokasi diskon SHALL dihitung dari satu `items`.

### Requirement 2: Payload dan validasi

1. THE payload SHALL memakai satu `items[]`; key `asset_items` SHALL tidak dipakai.
2. Setiap baris SHALL memiliki tepat satu dari `item.id` atau `asset.id`; baris dengan keduanya atau tanpa keduanya SHALL ditolak (422).
3. Baris asset SHALL memenuhi rule yang berlaku sekarang: `asset.id` ada di `assets`, `quantity` min 1, `tax.id` wajib, `unit` dan `source_warehouse.id` tidak boleh ada.
4. Baris item SHALL memenuhi rule `items.*` yang berlaku sekarang (termasuk Gudang Asal wajib untuk item stok).
5. Dokumen SHALL memiliki minimal satu baris.

### Requirement 3: Backend dan tampilan

1. THE service SHALL menyimpan baris asset dengan `asset_id` dan `item_id` null, `item_unit_id` null, `conversion_factor` 1 (perilaku sekarang).
2. THE controller dan model SHALL tidak lagi memisah `items` dan `asset_items`; `rentalDurations` SHALL dihitung dari `items`.
3. THE halaman Show SHALL menampilkan satu tabel item; baris asset SHALL tampil dengan identitas Asset.

### Requirement 4: Kompatibilitas

1. Event dan listener rental/jual aset, validasi rental (`Asset.is_rentable`), dan alur create-from-SO di Delivery Note dan Sales Invoice SHALL berperilaku identik.
2. Section Asset Items milik Delivery Note dan Sales Invoice SHALL tidak berubah oleh spec ini.
3. Test Sales Order yang ada SHALL tetap lulus setelah disesuaikan ke bentuk payload baru.
