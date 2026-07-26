# Requirements Document

## Introduction

Manual Book (`/manual-book`) adalah panduan penggunaan aplikasi yang bisa
diakses langsung dari dalam aplikasi. Saat ini kontennya diambil dari
dokumentasi teknis developer (`docs/modules/*.md`, `docs/tutorials/*.md`)
yang penuh istilah teknis (nama tabel database, model, matriks permission,
tipe field) — sulit dipahami pengguna awam yang sehari-hari mengoperasikan
aplikasi (sales, admin gudang, kasir, dsb).

Tujuan: setiap section Manual Book ditulis ulang dengan bahasa sederhana,
naratif, dan berorientasi tugas ("bagaimana cara saya menjual barang?"),
bukan berorientasi struktur data ("field apa saja yang ada di Sales Order").

## Glossary

- **Section** — satu topik Manual Book yang bisa diakses lewat kartu di
  halaman index (`/manual-book`), mis. "Penjualan", "Pembelian".
- **Manual Book lama** — konten saat ini, hasil render `docs/modules/*.md` +
  `docs/tutorials/*.md` melalui `ManualBookService`.
- **Sumber baru** — file markdown baru di `docs/manual-book/*.md`, ditulis
  khusus untuk end-user.
- **Istilah domain** — istilah spesifik aplikasi yang tak terhindarkan
  (mis. "Sales Order", "Delivery Note") karena juga muncul sebagai label di
  UI aplikasi.

## Requirements

### Requirement 1: Konten Manual Book bebas istilah teknis developer

**User Story:** Sebagai pengguna aplikasi tanpa latar belakang teknis, saya
ingin membaca panduan yang tidak menyebut struktur database/kode, supaya
saya bisa fokus memahami cara memakai aplikasi.

#### Acceptance Criteria

1. THE konten Manual Book SHALL tidak menyebut nama tabel database, nama
   model Eloquent, nama Controller/method, nama route, atau tipe data field.
2. THE konten Manual Book SHALL tidak menampilkan matriks Permission/Role
   dalam bentuk tabel teknis.
3. WHEN sebuah istilah domain aplikasi (mis. "Sales Order") pertama kali
   disebut dalam satu file, THE konten SHALL menyertakan penjelasan awam di
   sampingnya (mis. "surat pesanan penjualan").
4. THE konten Manual Book SHALL ditulis dengan sapaan orang kedua ("kamu")
   dan instruksi imperatif langsung ("Klik...", "Pilih...").

### Requirement 2: Instruksi berbasis langkah dan lokasi menu

**User Story:** Sebagai pengguna, saya ingin instruksi yang menyebut persis
menu mana yang harus saya klik, supaya saya bisa mengikuti panduan sambil
membuka aplikasi.

#### Acceptance Criteria

1. WHEN sebuah alur kerja dijelaskan, THE konten SHALL menyertakan langkah
   bernomor yang dimulai dari lokasi menu di sidebar aplikasi.
2. WHEN sebuah alur melibatkan lebih dari 2 dokumen berurutan (mis. alur
   penjualan SO → DN → SI → Payment), THE konten SHALL menyertakan diagram
   Mermaid yang label node-nya memakai bahasa awam.
3. WHERE ada langkah yang sering membingungkan pengguna, THE konten SHALL
   menyertakan catatan tips (blockquote) yang menjelaskan hal tersebut.

### Requirement 3: Delapan section aktif ditulis ulang penuh

**User Story:** Sebagai pemilik produk, saya ingin seluruh section aktif
konsisten kualitasnya, supaya pengguna tidak menemukan sebagian panduan
masih teknis dan sebagian sudah awam.

#### Acceptance Criteria

1. THE sistem SHALL menyediakan file sumber baru untuk kedelapan section
   aktif: Penjualan, Pembelian, Inventory, Keuangan, Layanan/Work Order,
   Helpdesk, Retur, dan Pengaturan Umum.
2. THE section CRM SHALL tetap nonaktif (tidak termasuk cakupan ini).
3. THE isi tiap file baru SHALL akurat secara bisnis — merujuk pada alur
   yang benar-benar diimplementasikan (divalidasi terhadap
   `docs/modules/*.md` dan `docs/tutorials/*.md` sebagai referensi teknis),
   bukan disalin mentah dari sana.

### Requirement 4: Manual Book membaca dari sumber baru

**User Story:** Sebagai developer yang merawat fitur ini, saya ingin
konfigurasi Manual Book sederhana (1 file per section), supaya mudah
dipelihara ke depannya.

#### Acceptance Criteria

1. THE `config/manual_book.php` SHALL memetakan tiap section ke tepat satu
   file di `docs/manual-book/`.
2. THE `ManualBookService` SHALL merender section dari file tunggal
   tersebut, tanpa lagi memerlukan filter `include_headings` per-source.
3. THE `docs/modules/*.md` dan `docs/tutorials/*.md` SHALL tidak diubah oleh
   pekerjaan ini — tetap berfungsi sebagai referensi teknis developer.
4. WHEN halaman Manual Book (index & show) diakses, THE halaman SHALL tetap
   berfungsi normal (kartu index, TOC, render Mermaid, tombol cetak) tanpa
   perubahan pada komponen frontend.

### Requirement 5: Kalibrasi gaya bahasa sebelum full rollout

**User Story:** Sebagai reviewer, saya ingin melihat contoh satu section
jadi dulu sebelum semua section ditulis, supaya saya bisa memberi masukan
gaya bahasa lebih awal tanpa harus me-review 8 file sekaligus.

#### Acceptance Criteria

1. THE section Penjualan SHALL ditulis dan direview terlebih dahulu sebagai
   contoh kalibrasi.
2. WHEN contoh kalibrasi disetujui, THE 7 section sisanya SHALL mengikuti
   gaya bahasa dan struktur yang sama.
