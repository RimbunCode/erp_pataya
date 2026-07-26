# Design Document: Manual Book Human-Friendly

## Overview

Manual Book (in-app help, `/manual-book`) saat ini merender ulang isi
`docs/modules/*.md` dan `docs/tutorials/*.md` — dokumen yang sama dipakai
sebagai referensi teknis untuk developer (nama model Eloquent, tabel database,
matriks Permission, field type, dsb). `ManualBookService` menyaring sebagian
heading teknis (Routes, Frontend Pages) tapi banyak istilah teknis tetap lolos
karena section naratif (mis. "Korelasi Antar-Feature", "Business Flow
End-to-End") sendiri ditulis dengan asumsi pembaca developer.

Solusi: buat **sumber konten baru** khusus Manual Book — satu file markdown
per section, ditulis dari nol dengan bahasa awam, ditujukan untuk end-user
yang mengoperasikan aplikasi sehari-hari (admin gudang, sales, kasir, dsb),
bukan developer. `docs/modules/*.md` dan `docs/tutorials/*.md` tidak diubah —
tetap jadi referensi teknis untuk developer.

## Goals & Non-Goals

**Goals:**
- 8 file markdown baru (satu per section aktif), bahasa Indonesia awam,
  tanpa jargon teknis.
- `config/manual_book.php` dan `ManualBookService` membaca dari sumber baru,
  tanpa filter heading berlapis (karena file baru sudah bersih dari section
  teknis sejak ditulis).
- Konsisten lintas 8 file: struktur, gaya sapaan, cara menjelaskan istilah
  domain yang tak terhindarkan (mis. "Sales Order").

**Non-Goals:**
- Tidak menyentuh `docs/modules/*.md`, `docs/tutorials/*.md`, atau dokumen
  developer lain — itu tetap sumber kebenaran teknis.
- Tidak mengaktifkan section CRM (tetap nonaktif sesuai config saat ini).
- Tidak mengubah UI Manual Book (`Index.jsx`, `Show.jsx`,
  `MarkdownMermaidRenderer`) — struktur HTML/Mermaid yang dihasilkan tetap
  kompatibel dengan komponen yang sudah ada.

## Struktur Folder & Penamaan

```
docs/manual-book/
  penjualan.md
  pembelian.md
  inventory.md
  keuangan.md
  layanan.md
  helpdesk.md
  retur.md
  pengaturan-umum.md
```

Satu file = satu section = satu key di config (pemetaan 1:1, tidak ada lagi
gabungan 2 file seperti `modules/sales.md` + `tutorials/03-alur-penjualan.md`
saat ini). Ini menyederhanakan `ManualBookService::renderSection()`: tidak
perlu lagi `implode` multi-source per section, cukup baca 1 file.

## Format Tiap File

Template konsisten untuk semua 8 file:

```markdown
# [Judul Section dalam bahasa awam, mis. "Penjualan"]

[1-2 kalimat pembuka: section ini untuk apa, kapan dipakai — bahasa percakapan]

## Istilah yang Perlu Kamu Tahu   <!-- opsional, hanya jika ada istilah tak terhindarkan -->

- **[Istilah]** — [penjelasan 1 kalimat pakai analogi sehari-hari]

## [Nama Alur/Tugas, mis. "Menjual Barang ke Pelanggan"]

[Narasi singkat: kapan langkah ini dilakukan]

1. [Langkah konkret, mulai dari klik menu apa]
2. [Langkah berikutnya]
   - [Sub-detail jika perlu]
3. ...

> 💡 [Tips atau hal yang sering bikin bingung, opsional]

## [Alur/Tugas berikutnya]
...

## Pertanyaan Umum   <!-- opsional -->

**[Pertanyaan yang sering muncul]**
[Jawaban singkat]
```

Ketentuan gaya bahasa (berlaku semua file):

1. **Sapaan**: orang kedua langsung ("kamu"), instruksi imperatif ("Klik...",
   "Pilih...", "Isi...").
2. **Tanpa istilah teknis developer**: tidak ada nama tabel, nama model,
   nama field database, nama Controller/Route, tipe data, matriks Permission
   role. Larangan eksplisit sama seperti yang sudah difilter
   `ManualBookService::stripTechnicalNoise()` untuk sumber lama — tapi di
   sini dicapai dengan menulis bersih dari awal, bukan filter regex.
3. **Istilah domain aplikasi (SO, DN, SI, Payment Entry, dst.)**: boleh
   dipakai TAPI setiap singkatan wajib dieja penuh + penjelasan awam saat
   pertama muncul di tiap file (file berdiri sendiri, pembaca mungkin buka
   section itu saja). Contoh: "Sales Order (surat pesanan penjualan)".
   Prioritaskan istilah yang sudah ada di label UI aplikasi (tombol menu,
   judul halaman) supaya user tidak bingung mencocokkan manual dengan layar.
4. **Struktur "klik di mana"**: setiap langkah operasional menyebut lokasi
   menu persis seperti di sidebar aplikasi (mis. "Menu **Sales → Sales
   Orders → Tambah**"), supaya bisa diikuti sambil buka aplikasi.
5. **Diagram Mermaid**: dipertahankan untuk alur multi-dokumen (mis. alur
   Penjualan SO→DN→SI→Payment) karena terbukti efektif di tutorial lama;
   label node disederhanakan ke bahasa awam.
6. **Hindari pasif & birokratis**: bukan "Stok akan direservasi oleh
   sistem", tapi "Sistem otomatis menahan stok itu supaya tidak kepakai
   transaksi lain".
7. **Contoh angka konkret** di beberapa alur kunci (mis. "Misalnya kamu
   jual 10 unit seharga Rp100.000...") untuk mengonkretkan konsep abstrak
   seperti pajak/DPP, alokasi pembayaran.

## Components and Interfaces

### 1. File konten baru (8 file)
`docs/manual-book/*.md` — dibuat dari nol, isi disarikan dari
`docs/modules/*.md` + `docs/tutorials/*.md` terkait (sebagai referensi
kebenaran alur/bisnis) tapi ditulis ulang total, bukan disalin/diedit
sebagian.

Pemetaan section → file sumber referensi (untuk memastikan akurasi alur,
bukan untuk disalin mentah):

| Section (key)      | File baru                       | Referensi alur dari                                         |
|---------------------|----------------------------------|---------------------------------------------------------------|
| `sales`             | `manual-book/penjualan.md`      | `modules/sales.md`, `tutorials/03-alur-penjualan.md`         |
| `purchase`          | `manual-book/pembelian.md`      | `modules/purchase.md`, `tutorials/04-alur-pembelian.md`      |
| `inventory`         | `manual-book/inventory.md`      | `modules/inventory.md`, `tutorials/02-item-variant.md`       |
| `finances`          | `manual-book/keuangan.md`       | `modules/finances.md`                                        |
| `service`           | `manual-book/layanan.md`        | `modules/service.md`                                         |
| `helpdesk`          | `manual-book/helpdesk.md`       | `modules/helpdesk.md`                                        |
| `retur`             | `manual-book/retur.md`          | `tutorials/retur.md`                                         |
| `pengaturan-umum`   | `manual-book/pengaturan-umum.md`| `modules/core.md` (bagian tertentu), `auth.md` (bagian tertentu), `tutorials/01-setup-data-master.md`, `tutorials/05-approval-scheme.md` |

`pengaturan-umum` adalah yang paling kompleks (gabungan banyak sub-topik:
Branch, Approval, Penomoran Dokumen, Print Template, Dashboard, Tags &
Files, Todo, Notifikasi, Roles & Permissions, Workflow Dokumen). Ditulis
sebagai satu file dengan heading `##` per sub-topik seperti sekarang, tapi
tiap sub-topik disederhanakan.

### 2. `config/manual_book.php`

Disederhanakan: tiap section punya `source` tunggal (bukan array `sources`),
tidak ada lagi `include_headings` / `excluded_heading_patterns` per-source
(karena file baru sudah bersih). `default_excluded_heading_patterns` tetap
dipertahankan sebagai safety net minimal (jaga-jaga heading "Routes" tidak
sengaja ke-copy saat penulisan), tapi tidak lagi jadi mekanisme utama.

```php
'docs_path' => base_path('docs/manual-book'),

'sections' => [
    'sales' => [
        'title'       => 'Penjualan',
        'description' => '...',
        'icon'        => 'Receipt',
        'source'      => 'penjualan.md',
    ],
    // ...
],
```

### 3. `ManualBookService`

- `renderSection()`: baca 1 file (`$section['source']`) alih-alih
  `implode` banyak source.
- `extractMarkdown()` / `filterSections()` / `stripSubHeadings()`: filter
  include/exclude per-source (whitelist heading) **dihapus** — tidak
  relevan lagi karena tiap file baru sudah didedikasikan penuh untuk satu
  section (tidak ada file campuran seperti `core.md`/`auth.md` lama).
- `stripTechnicalNoise()`: dipertahankan sebagai safety net (regex
  `Controller@method`), tidak berubah.
- `toHtml()`: tidak berubah.

## Migration Plan

1. Buat 8 file baru di `docs/manual-book/` (task terbesar — 1 task per
   file agar bisa direview bertahap).
2. Update `config/manual_book.php` ke skema `source` tunggal.
3. Sederhanakan `ManualBookService` (hapus logic filter per-source yang
   sudah tidak dipakai).
4. Update `tests/Feature/Core/ManualBookControllerTest.php` bila ada
   assertion yang bergantung pada konten lama (mis. cek heading spesifik
   dari `docs/modules/*.md`).
5. Jalankan test, cek render tiap section manual di browser (khususnya
   Mermaid diagram & TOC masih jalan dengan heading baru).

## Keputusan

- File `penjualan.md` ditulis lebih dulu sebagai contoh kalibrasi gaya
  bahasa dan direview user sebelum 7 file sisanya dikerjakan (lihat
  `tasks.md`).
