# Requirements Document

## Introduction

Modul Asset Management sudah diimplementasi penuh (9 spec: core,
purchase-integration, depreciation, movement, maintenance-repair,
rental-migration, service-billing, service-internal-order,
service-procurement) — menu "Assets" sudah aktif di sidebar dengan 8
submenu. Manual Book (`/manual-book`), panduan penggunaan aplikasi untuk
end-user awam, belum punya section untuk modul ini sama sekali sehingga
pengguna yang mengoperasikan fitur Asset (admin gudang, staf maintenance,
sales) tidak punya panduan in-app.

Section `service` (`Layanan / Work Order`) yang sudah ada juga perlu
disentuh: Asset Service (bagian dari modul Asset) adalah penerus WorkOrder
untuk maintenance/repair, tapi WorkOrder belum dihapus dari aplikasi —
kalau dibiarkan, pengguna asset tidak tahu jalur servis mana yang harus
dipakai untuk aset tetap.

## Glossary

- **Section** — satu topik Manual Book yang bisa diakses lewat kartu di
  halaman index (`/manual-book`), mis. "Penjualan", "Aset".
- **Modul Asset** — kumpulan fitur pengelolaan aset tetap (fixed asset):
  registrasi, kategori, lokasi, movement, maintenance/repair, sewa/jual,
  depresiasi. Diimplementasi lewat 9 spec di `.kiro/specs/asset-*/`.
- **Asset Service** — dokumen pekerjaan servis (maintenance terjadwal
  atau repair insidental) untuk Asset, penerus fungsional Work Order
  untuk aset tetap.
- **Istilah domain** — istilah spesifik aplikasi yang tak terhindarkan
  (mis. "Asset Movement", "Custodian") karena juga muncul sebagai label
  di UI aplikasi.

## Requirements

### Requirement 1: Section Aset baru, bebas istilah teknis developer

**User Story:** Sebagai pengguna aplikasi yang mengelola aset tetap
(admin gudang, staf maintenance), saya ingin membaca panduan modul Asset
dalam bahasa awam, supaya saya bisa memakai fitur ini tanpa perlu paham
struktur database/kode.

#### Acceptance Criteria

1. THE sistem SHALL menyediakan file sumber baru
   `docs/manual-book/aset.md` untuk section "Aset".
2. THE konten `aset.md` SHALL tidak menyebut nama tabel database, nama
   model Eloquent, nama Controller/method, nama route, atau tipe data
   field.
3. WHEN sebuah istilah domain aplikasi (mis. "Asset Movement", "Asset
   Category") pertama kali disebut dalam file, THE konten SHALL
   menyertakan penjelasan awam di sampingnya.
4. THE konten `aset.md` SHALL ditulis dengan sapaan orang kedua ("kamu")
   dan instruksi imperatif langsung ("Klik...", "Pilih...").
5. THE isi `aset.md` SHALL akurat secara bisnis — merujuk pada alur yang
   benar-benar diimplementasikan, divalidasi terhadap
   `.kiro/specs/asset-*/requirements.md` dan `design.md` (9 spec) sebagai
   sumber kebenaran, bukan `docs/modules/asset.md` (outdated, berhenti di
   Fase 1).

### Requirement 2: Cakupan penuh alur end-user modul Asset

**User Story:** Sebagai pengguna aset, saya ingin satu panduan yang
mencakup seluruh perjalanan aset — dari didaftarkan sampai dilepas —
supaya saya tidak perlu mencari-cari informasi di tempat lain.

#### Acceptance Criteria

1. THE `aset.md` SHALL mencakup: menyiapkan data master (Asset Category,
   Asset Location), mendaftarkan Asset (manual & otomatis dari
   pembelian), siklus status Asset, memindahkan lokasi/custodian
   (Asset Movement), servis Asset (maintenance terjadwal & repair
   insidental via Asset Service), menyewakan/menjual Asset, dan
   depresiasi/revaluasi nilai.
2. WHEN sebuah alur melibatkan lebih dari 2 dokumen berurutan atau
   percabangan status, THE konten SHALL menyertakan diagram Mermaid
   dengan label node bahasa awam.
3. WHERE ada langkah yang berpotensi membingungkan (mis. beda Asset
   Movement vs jalur sewa/jual, atau kapan pakai maintenance terjadwal
   vs repair insidental), THE konten SHALL menyertakan catatan tips.
4. WHEN menjelaskan depresiasi atau gain/loss saat penjualan aset, THE
   konten SHALL menyertakan contoh angka konkret untuk mengonkretkan
   konsep abstrak tersebut.

### Requirement 3: Instruksi berbasis langkah dan lokasi menu

**User Story:** Sebagai pengguna, saya ingin instruksi yang menyebut
persis menu mana yang harus saya klik (sesuai sidebar grup "Assets"),
supaya saya bisa mengikuti panduan sambil membuka aplikasi.

#### Acceptance Criteria

1. WHEN sebuah alur kerja dijelaskan, THE konten SHALL menyertakan
   langkah bernomor yang dimulai dari lokasi menu di sidebar aplikasi
   (mis. "Assets → Asset Movements → Tambah").
2. THE penamaan menu dalam konten SHALL konsisten dengan label aktual
   di `AppSidebar.jsx` grup "Assets".

### Requirement 4: Revisi section Layanan untuk hindari duplikasi jalur servis

**User Story:** Sebagai pengguna yang mencatat servis aset tetap, saya
ingin tahu bahwa Asset Service adalah cara yang sesuai untuk aset tetap
(bukan Work Order), supaya saya tidak salah pilih menu.

#### Acceptance Criteria

1. THE `docs/manual-book/layanan.md` SHALL ditambah 1-2 kalimat di
   pembuka yang menjelaskan servis aset tetap kini dicatat lewat Asset
   Service (menu Assets → Asset Services), dengan pointer ke section
   Aset untuk detail lengkap.
2. THE konten Work Order existing di `layanan.md` SHALL tidak dihapus
   atau diubah strukturnya — WorkOrder masih berfungsi di aplikasi dan
   penghapusannya di luar cakupan spec ini.
3. THE revisi `layanan.md` SHALL tidak menduplikasi seluruh alur Asset
   Service — cukup pointer singkat, detail lengkap hanya ada di
   `aset.md`.

### Requirement 5: Manual Book membaca section baru tanpa perubahan mekanisme

**User Story:** Sebagai developer yang merawat fitur ini, saya ingin
section baru terdaftar dengan cara yang sama seperti 8 section lain,
supaya tidak perlu mengubah `ManualBookService` atau komponen frontend.

#### Acceptance Criteria

1. THE `config/manual_book.php` SHALL menambah 1 entry baru untuk key
   `aset` (title, description, icon, source), mengikuti format entry
   lain persis.
2. THE `ManualBookService` SHALL tidak perlu diubah — render section
   baru memakai mekanisme baca-1-file yang sudah generik.
3. WHEN halaman Manual Book (index & show) diakses setelah section baru
   ditambahkan, THE halaman SHALL menampilkan kartu "Aset" di index dan
   merender kontennya di halaman show (TOC, Mermaid, tombol cetak)
   tanpa perubahan pada komponen frontend.
4. THE `docs/modules/*.md` dan `.kiro/specs/asset-*/` SHALL tidak diubah
   oleh pekerjaan ini — tetap jadi referensi teknis developer.

### Requirement 6: Kalibrasi sebelum finalisasi

**User Story:** Sebagai reviewer, saya ingin melihat draft `aset.md`
sebelum config didaftarkan dan `layanan.md` direvisi, supaya saya bisa
memberi masukan gaya bahasa dan akurasi alur lebih awal.

#### Acceptance Criteria

1. THE draft `aset.md` SHALL direview user sebelum lanjut ke revisi
   `layanan.md` dan pendaftaran config.
2. WHEN draft disetujui, THE langkah selanjutnya (revisi `layanan.md`,
   config, test) SHALL dikerjakan mengikuti gaya bahasa yang sudah
   disetujui.
