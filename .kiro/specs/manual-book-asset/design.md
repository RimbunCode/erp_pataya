# Design Document: Manual Book — Fitur Asset

## Overview

Modul Asset Management sudah selesai diimplementasi penuh lewat 9 spec
(`asset-management-core`, `asset-management-purchase-integration`,
`asset-management-depreciation`, `asset-management-movement`,
`asset-maintenance-repair`, `asset-rental-migration`,
`asset-service-billing`, `asset-service-internal-order`,
`asset-service-procurement`) — model, route, dan menu sidebar "Assets"
semua sudah aktif di aplikasi. Manual Book (`/manual-book`) belum punya
section untuk modul ini sama sekali.

Sebagian fitur Asset juga beririsan dengan section `service` (`Layanan /
Work Order`, sumber `docs/manual-book/layanan.md`) yang sudah ada: Asset
Service (maintenance/repair) adalah penerus WorkOrder, tapi WorkOrder
belum dihapus dari codebase — dua jalur servis hidup berdampingan.

Solusi: tambah **section baru** `aset` (sumber `docs/manual-book/aset.md`)
mengikuti template & gaya bahasa yang sudah dipakai 8 section existing
(lihat `manual-book-human-friendly`), dan **revisi** `layanan.md` supaya
pengguna tidak bingung ada dua cara mencatat servis.

## Goals & Non-Goals

**Goals:**

- 1 file markdown baru `docs/manual-book/aset.md`, bahasa Indonesia awam,
  mencakup seluruh alur end-user modul Asset (master data → perolehan →
  operasional → pelaporan nilai).
- Registrasi section baru `aset` di `config/manual_book.php`.
- Revisi `docs/manual-book/layanan.md`: tambah pointer ke section Aset
  untuk maintenance/repair asset tetap, WorkOrder tetap dijelaskan apa
  adanya (modelnya belum dihapus, spec penghapusan belum ada).
- Konsisten dengan 8 section existing: struktur, gaya sapaan, cara
  menjelaskan istilah domain.

**Non-Goals:**

- Tidak menyentuh `docs/modules/asset.md` atau `docs/modules/service.md`
  (dokumentasi teknis developer) — bahkan kalau ditemukan outdated
  (`docs/modules/asset.md` saat ini masih berhenti di Fase 1), itu di luar
  cakupan spec ini. Sumber kebenaran fitur untuk penulisan Manual Book ini
  adalah `.kiro/specs/asset-*/requirements.md` + `design.md`, bukan
  `docs/modules/`.
- Tidak menghapus atau men-deprecate WorkOrder — itu keputusan terpisah
  yang belum di-spec (dicatat sebagai konteks di `asset-service-internal-order`
  dan `asset-service-procurement`, bukan tugas di sini).
- Tidak mengubah UI Manual Book (`Index.jsx`, `Show.jsx`,
  `MarkdownMermaidRenderer`) atau `ManualBookService` — mekanisme render
  1-file-per-section sudah ada dan cukup, tinggal tambah 1 entry config.
- Tidak mengaktifkan section CRM (di luar cakupan, tidak terkait).

## Sumber Kebenaran Fitur (bukan untuk disalin, untuk validasi alur)

| Sub-topik                                 | Spec rujukan                            |
| ----------------------------------------- | --------------------------------------- |
| Master data (Asset, Category, Location)   | `asset-management-core`                 |
| Auto-create Asset dari pembelian          | `asset-management-purchase-integration` |
| Depresiasi & revaluasi nilai              | `asset-management-depreciation`         |
| Perpindahan lokasi/custodian              | `asset-management-movement`             |
| Maintenance terjadwal & repair insidental | `asset-maintenance-repair`              |
| Sewa & jual putus Asset                   | `asset-rental-migration`                |
| Billing servis ke penyewa aktif           | `asset-service-billing`                 |
| Permintaan servis internal (non-customer) | `asset-service-internal-order`          |
| Buat PR/PO dari part servis               | `asset-service-procurement`             |

Menu sidebar aktual (referensi penamaan menu, dari `AppSidebar.jsx`, grup
**Assets**): Assets, Asset Categories, Asset Locations, Asset Value
Adjustments, Asset Movements, Maintenance Teams, Asset Maintenance, Asset
Services.

## Format File `aset.md`

Mengikuti template baku yang sama dengan 8 file existing (lihat
`manual-book-human-friendly/design.md`):

```markdown
# Aset

[1-2 kalimat pembuka: section ini untuk apa, kapan dipakai]

## Istilah yang Perlu Kamu Tahu

- **[Istilah]** — [penjelasan 1 kalimat, analogi sehari-hari]

## [Nama Alur/Tugas]

[Narasi singkat kapan langkah ini dilakukan]

1. [Langkah konkret mulai dari klik menu apa]
2. ...

> 💡 [Tips opsional]

## Pertanyaan Umum

...
```

Ketentuan gaya bahasa — **identik** dengan 8 file existing (tidak
diulang detail di sini, rujuk `manual-book-human-friendly/design.md`
§"Ketentuan gaya bahasa"): sapaan "kamu", tanpa istilah teknis developer,
istilah domain dieja penuh saat pertama muncul, struktur "klik di mana",
Mermaid untuk alur multi-dokumen, hindari pasif, contoh angka konkret
untuk konsep abstrak (depresiasi, gain/loss on disposal).

### Urutan Alur/Tugas yang Dicakup

Urutan mengikuti perjalanan alami satu Asset dari didaftarkan sampai
dilepas, supaya pembaca baru bisa ikuti dari atas ke bawah:

1. **Istilah yang Perlu Kamu Tahu** — Asset, Asset Category, Asset
   Location, Ownership, Custodian, Book Value, Asset Service, Asset
   Movement.
2. **Menyiapkan Data Master** — buat Asset Category & Asset Location
   dulu sebelum bisa daftar Asset.
3. **Mendaftarkan Aset Baru (Manual)** — form Asset langsung dari menu
   Assets.
4. **Aset Otomatis dari Pembelian** — kalau barang yang dibeli ditandai
   fixed-asset, Asset dibuat otomatis dari Purchase Receipt/Invoice;
   lengkapi kategori/lokasi/split unit dari sana.
5. **Siklus Status Aset** — draft → submit approval → Active, lalu aksi
   scrap/out-of-order/maintenance/aktifkan kembali.
6. **Memindahkan Lokasi atau Penanggung Jawab Aset (Asset Movement)** —
   transfer, issue, receipt, dengan approval.
7. **Servis Aset: Maintenance Terjadwal & Perbaikan (Asset Service)** —
   dua jalur: jadwal rutin lewat Asset Maintenance, atau insidental lewat
   Asset Service langsung; catat part yang dipakai; opsi tagih ke
   penyewa aktif atau capitalize ke nilai aset.
8. **Menyewakan atau Menjual Aset** — lewat Sales Order/Delivery
   Note/Sales Invoice seperti alur penjualan biasa, tapi barangnya Asset;
   sistem lacak kuantitas tersedia vs disewa vs terjual; jual putus
   menghasilkan untung/rugi otomatis.
9. **Susut Nilai Aset (Depresiasi)** — penjelasan awam kenapa nilai aset
   berkurang tiap periode, cara melihat jadwalnya, dan kapan perlu
   revaluasi manual (Asset Value Adjustment).
10. **Pertanyaan Umum**.

Diagram Mermaid dipakai minimal di 2 tempat: (a) siklus status Asset
(Draft → Active → Scrap/dst), (b) alur servis dua-jalur (Maintenance
terjadwal vs Repair insidental → sama-sama jadi Asset Service).

## Revisi `layanan.md`

`docs/manual-book/layanan.md` saat ini murni menjelaskan Work Order.
Karena WorkOrder belum dihapus dan Asset Service belum menggantikannya
secara resmi di UI, revisi ini **menambah**, bukan mengganti:

- Tambah 1-2 kalimat di pembuka section yang menjelaskan: servis untuk
  aset tetap (kendaraan, mesin, peralatan kantor) sekarang dicatat lewat
  **Asset Service** (menu Assets → Asset Services), bukan Work Order.
  Work Order tetap dipakai untuk jenis layanan yang belum masuk ke
  modul Asset.
- Tambah pointer eksplisit ke section **Aset** untuk detail lengkap
  Asset Service (hindari duplikasi konten — cukup 1 paragraf + link
  konsep, bukan menyalin ulang seluruh alur Asset Service ke
  `layanan.md`).
- Tidak menghapus konten Work Order existing.

## Components and Interfaces

### 1. File konten baru

`docs/manual-book/aset.md` — ditulis dari nol, alur divalidasi terhadap
`.kiro/specs/asset-*/requirements.md` + `design.md` (9 spec), bukan
disalin dari `docs/modules/asset.md` (outdated, berhenti di Fase 1).

### 2. File revisi

`docs/manual-book/layanan.md` — tambah pointer ke Asset Service, tanpa
mengubah struktur/konten Work Order yang sudah ada.

### 3. `config/manual_book.php`

Tambah 1 entry baru di array `sections`, format identik entry lain:

```php
'aset' => [
    'title'       => 'Aset',
    'description' => 'Asset, kategori, lokasi, movement, maintenance/repair, sewa/jual, dan depresiasi.',
    'icon'        => 'Boxes', // konsisten dengan ikon grup "Assets" di AppSidebar.jsx
    'source'      => 'aset.md',
],
```

Posisi entry: setelah `service`, sebelum `helpdesk` — mengikuti urutan
domain operasional (Sales → Purchase → Inventory → Finances → Service →
**Aset** → Helpdesk → Retur → Pengaturan Umum), karena Asset Service
beririsan langsung dengan section Service.

### 4. `ManualBookService`

Tidak berubah — mekanisme render 1-file-per-section dari section lain
sudah generik dan langsung berlaku untuk section baru tanpa modifikasi.

## Migration Plan

1. Tulis `docs/manual-book/aset.md` (task terbesar, referensi 9 spec).
2. Checkpoint: review draft ke user sebelum lanjut (kalibrasi gaya
   bahasa & akurasi alur, sama seperti pola `manual-book-human-friendly`).
3. Revisi `docs/manual-book/layanan.md` — tambah pointer Asset Service.
4. Tambah entry `aset` di `config/manual_book.php`.
5. Cek `tests/Feature/Core/ManualBookControllerTest.php` — tambah
   assertion section baru kalau test ini mengiterasi daftar section
   secara eksplisit; kalau generik (baca dari config), tidak perlu
   diubah.
6. Jalankan test terkait, cek render section Aset di browser (index
   card baru muncul, Mermaid diagram jalan, TOC kebentuk benar).

## Keputusan

- 1 file `aset.md` untuk seluruh modul Asset (bukan dipecah per
  sub-fitur) — modul ini satu alur besar yang saling terkait (master
  data → servis → sewa/jual → depresiasi), dipisah jadi beberapa file
  berisiko pembaca kehilangan konteks silang.
- `layanan.md` direvisi (bukan dibiarkan) — WorkOrder dan Asset Service
  sama-sama hidup di aplikasi saat ini, membiarkan `layanan.md` apa
  adanya berisiko pengguna asset tidak tahu ada jalur servis yang lebih
  sesuai.
- `docs/modules/asset.md` tidak dijadikan sumber utama karena terbukti
  outdated (berhenti di status "Fase 1 selesai, Fase 2-5 planned"
  padahal kesembilan spec sudah 100% task selesai) — sumber kebenaran
  fitur diambil langsung dari `.kiro/specs/asset-*/`.
