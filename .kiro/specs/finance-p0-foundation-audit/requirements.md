# Requirements Document

## Introduction

Fase 0 dari 7 fase program **Finance Engine** (lihat `docs/prd/finance-engine-prd.md`). Fase ini **tidak mengubah perilaku produksi**. Tujuannya mengukur kondisi nyata ledger sebelum refactor, mengunci perilaku posting saat ini dengan test, dan mengumpulkan keputusan yang menentukan fase berikutnya.

Alasan fase ini ada: PRD memuat temuan audit kode (F-01…F-15) yang sebagian masih berupa dugaan dari pembacaan kode (F-10 dan bagian FX dari F-11). Selain itu, ukuran masalah data (berapa banyak jurnal tak seimbang, GL yatim) belum diketahui, padahal itu menentukan beban backfill Fase 1. Tanpa characterization test, refactor Fase 2 tidak punya acuan perilaku lama untuk *parity test*.

**Di luar scope:** memperbaiki bug yang ditemukan (hanya dicatat dan diputuskan terpisah), mengubah skema tabel, membuat jurnal/header, mengubah listener, atau mengubah UI. Perbaikan atas temuan dikerjakan di Fase 1–2 atau sebagai hotfix terpisah atas keputusan pemilik produk.

## Glossary

- **Characterization test**: test yang mengunci perilaku *saat ini* (benar atau salah) agar perubahan perilaku di fase berikutnya bersifat disengaja.
- **Known-issue test**: characterization test untuk perilaku yang diduga salah; ditandai grup `known-issue` dan merujuk ID temuan PRD. Dibalik (dikoreksi) saat bug diperbaiki.
- **Kelompok posting**: himpunan baris `general_ledgers` dengan `referenceable_type`, `referenceable_id`, dan `transaction_date` yang sama.
- **Kelompok tak seimbang**: kelompok posting dengan |Σdebit − Σkredit| melebihi toleransi (default 0,005 karena kolom `double`).
- **GL yatim**: baris GL aktif yang `referenceable`-nya tidak ada, atau yang dokumen sumbernya berstatus `canceled`.
- **Soft-delete saat cancel**: perilaku hook `saving` trait `Submitable` yang menandai `deleted_at` pada baris GL/SLE dokumen yang dibatalkan, bukan membuat jurnal pembalik (F-04).
- **Baseline saldo**: snapshot Σdebit, Σkredit, dan `balance_amount` per akun pada satu waktu, sebagai acuan rekonsiliasi Fase 1.

## Requirements

### Requirement 1: Perintah audit integritas ledger (read-only)

**User Story:** Sebagai pemilik produk, saya ingin tahu seberapa sehat data GL saat ini, so that saya dapat memperkirakan beban migrasi dan risiko sebelum Fase 1 dimulai.

#### Acceptance Criteria

1. THE sistem SHALL menyediakan perintah Artisan `finance:audit-gl` yang hanya membaca data (tidak ada `INSERT`/`UPDATE`/`DELETE`/DDL).
2. THE perintah SHALL melaporkan jumlah dan contoh (maks. 20 per kategori, dapat diubah lewat opsi `--limit`) untuk setiap kategori anomali:
   1. kelompok posting tak seimbang, beserta selisih total;
   2. baris GL dengan `debit` dan `credit` sama-sama nol, atau salah satunya negatif;
   3. baris GL yang soft-deleted (`deleted_at` tidak null), dipisah menjadi (a) *diharapkan*: dokumen sumber berstatus `canceled` (perilaku hook `Submitable`, F-04) dan (b) *anomali*: dokumen sumber tidak `canceled` atau tidak ditemukan;
   4. baris GL dengan `account_id` atau `against_account_id` yang akunnya tidak ada atau soft-deleted;
   5. baris GL yang `referenceable`-nya tidak ditemukan;
   6. dokumen berstatus `canceled` yang masih memiliki baris GL **aktif** (tidak soft-deleted), mis. akibat job posting yang selesai setelah pembatalan (F-16);
   7. duplikasi posting (kombinasi `referenceable_type`, `referenceable_id`, `account_id`, `debit`, `credit`, `transaction_date` muncul lebih dari sekali).
3. THE perintah SHALL menyertakan ringkasan total: jumlah baris GL, jumlah kelompok posting, rentang `transaction_date`, Σdebit, Σkredit, dan selisih.
4. WHERE opsi `--json=<path>` diberikan, THE perintah SHALL menulis laporan lengkap dalam JSON ke path tersebut (default di bawah `storage/app/finance-audit/`).
5. THE perintah SHALL menangani tabel besar tanpa memuat seluruh baris ke memori (pemrosesan `chunk`/agregasi di database).
6. IF tabel `general_ledgers` kosong, THEN THE perintah SHALL selesai dengan kode sukses dan laporan nol, tanpa error.

### Requirement 2: Audit cakupan pembatalan dan pelacakan status posting

**User Story:** Sebagai pemilik produk, saya ingin tahu dokumen mana yang tidak membalik GL saat dibatalkan dan mana yang tidak dilacak status postingnya, so that cakupan refactor Fase 2 jelas.

#### Acceptance Criteria

1. THE `finance:audit-gl` SHALL menghasilkan matriks per jenis dokumen (Sales Invoice, Purchase Invoice, Purchase Receipt, Delivery Note, Payment Entry, Stock Entry, Asset Depreciation Schedule, Asset Value Adjustment, Asset) berisi: jumlah dokumen berstatus `approved`/`canceled`, jumlah yang punya baris GL, jumlah dokumen `canceled` yang baris GL-nya sudah soft-deleted, jumlah dokumen `canceled` yang masih memiliki GL aktif, dan apakah jenis tersebut dilacak `GlPostingStatus`.
2. THE matriks SHALL menandai dokumen berstatus approved yang `GlPostingStatus`-nya bukan `posted` (mis. `pending` lama atau `failed`).
3. THE dokumen yang secara desain tidak memakai `GlPostingStatus` (Payment Entry, Stock Entry) SHALL dilaporkan sebagai "tidak dilacak", bukan sebagai anomali.
4. WHEN sebuah jenis dokumen tidak memiliki data, THE matriks SHALL tetap menampilkan barisnya dengan nilai nol.

### Requirement 3: Baseline saldo per akun

**User Story:** Sebagai pemilik produk, saya ingin snapshot saldo sebelum migrasi, so that hasil Fase 1 dapat direkonsiliasi terhadap kondisi awal.

#### Acceptance Criteria

1. THE sistem SHALL menyediakan perintah `finance:snapshot-balances` yang menulis CSV (default `storage/app/finance-audit/baseline-<timestamp>.csv`) dengan kolom: `account_id`, `account_number`, `account_name`, `root_type`, `balance_type`, `sum_debit`, `sum_credit`, `net`, `balance_amount`, `difference`.
2. THE `net` SHALL dihitung dari baris GL yang tidak soft-deleted; `difference` = `net` yang disesuaikan arah `balance_type` dikurangi `balance_amount`.
3. THE perintah SHALL bersifat read-only dan idempoten (menjalankan ulang menghasilkan berkas baru tanpa efek samping).
4. THE baris akun tanpa transaksi SHALL tetap dicantumkan dengan nilai nol agar jumlah akun dapat direkonsiliasi.
5. IF `balance_type` akun null, THEN THE `difference` SHALL dikosongkan dan akun ditandai pada kolom `note`.

### Requirement 4: Characterization test untuk setiap titik posting GL

**User Story:** Sebagai developer Fase 2, saya ingin perilaku posting saat ini terkunci dalam test, so that refactor dapat dibuktikan tidak mengubah hasil kecuali disengaja.

#### Acceptance Criteria

1. THE test suite SHALL memiliki characterization test untuk 10 titik posting pada Lampiran B PRD: Sales Invoice, Purchase Invoice (termasuk cabang stok/SRNB), Purchase Receipt, Delivery Note, Payment Entry, Stock Entry, depresiasi aset, scrap aset, penyesuaian nilai aset, disposal gain/loss aset.
2. FOR setiap titik posting, THE test SHALL memverifikasi: jumlah baris GL, akun debit/kredit yang dipakai, nilai `debit`/`credit`, `transaction_date`, `referenceable`, dan status `GlPostingStatus` (bila berlaku).
3. FOR setiap titik posting yang memiliki jalur retur, THE test SHALL mencakup jalur retur (debit/kredit terbalik).
4. THE test SHALL dijalankan tanpa bergantung pada worker queue eksternal (listener dieksekusi sinkron di test, mis. dengan `QUEUE_CONNECTION=sync`).
5. THE test SHALL ditempatkan di `tests/Feature/Finances/Characterization/` dan memakai helper fixture bersama agar dapat dipakai ulang sebagai *parity test* Fase 2.

### Requirement 5: Known-issue test untuk dugaan bug

**User Story:** Sebagai pemilik produk, saya ingin dugaan bug dikonfirmasi dengan bukti test, so that keputusan perbaikan didasarkan fakta, bukan tebakan.

#### Acceptance Criteria

1. THE test suite SHALL memuat known-issue test untuk F-10: dua pembayaran parsial berurutan atas satu invoice; test mencatat jumlah yang diposting GL pembayaran kedua dan apakah sama dengan jumlah pembayaran itu atau dengan total kumulatif.
2. THE test suite SHALL memuat known-issue test untuk F-11 (bagian FX): pembayaran dalam mata uang asing dengan `exchange_rate` ≠ 1; test mencatat nominal yang diposting GL (mata uang asing atau dasar).
3. THE test suite SHALL memuat known-issue test untuk F-04: pembatalan dokumen (Sales Invoice, Payment Entry, dan jenis lain yang `Submitable`) mencatat bahwa baris GL dan SLE di-soft-delete tanpa jurnal pembalik, dan apakah `accounts.balance_amount` ikut disesuaikan (kasus Stock Entry).
4. THE test suite SHALL memuat known-issue test untuk F-16: dokumen dibatalkan sebelum job posting GL dieksekusi; test mencatat apakah job kemudian membuat baris GL aktif untuk dokumen `canceled`.
5. EACH known-issue test SHALL ditandai atribut grup `known-issue`, memuat komentar yang merujuk ID temuan PRD, dan menegaskan perilaku *aktual* (bukan yang diharapkan) sehingga test lulus pada kode saat ini.
6. WHEN hasil test menunjukkan dugaan ternyata tidak terjadi, THE temuan di PRD SHALL diperbarui (status "tidak terkonfirmasi") dan test diubah menjadi characterization test biasa.
7. THE spec ini SHALL TIDAK memperbaiki bug yang dikonfirmasi; perbaikannya diputuskan terpisah (lihat Requirement 7).

### Requirement 6: Audit skema runtime dan konvensi kolom

**User Story:** Sebagai developer Fase 1, saya ingin tahu kolom apa saja yang ditambahkan trait `DataTable` saat runtime, so that migration tabel jurnal baru tidak bertabrakan atau bergantung pada kolom yang muncul belakangan.

#### Acceptance Criteria

1. THE dokumen audit SHALL mendaftar kolom yang ditambahkan `initPermissions()` per jenis model (non-submitable, submitable, `generateCodeSeries`, tree view), berdasarkan `app/Traits/DataTable.php`.
2. THE dokumen audit SHALL mencantumkan skema aktual tabel `accounts` dan `general_ledgers` pada DB staging (kolom, tipe, indeks, FK) dan perbedaannya dengan file migration.
3. THE dokumen audit SHALL menyebutkan perilaku penghapusan kolom di lingkungan lokal (`app()->isLocal()`) dan risikonya bagi model jurnal baru.
4. THE dokumen audit SHALL menyimpulkan konvensi deklarasi kolom untuk tabel baru Finance (kolom wajib dideklarasikan eksplisit di migration).

### Requirement 7: Decision log dan laporan audit

**User Story:** Sebagai pemilik produk, saya ingin satu tempat yang merangkum temuan dan keputusan yang menunggu saya, so that saya dapat menyetujui Fase 1 dengan informasi lengkap.

#### Acceptance Criteria

1. THE sistem SHALL menghasilkan `docs/prd/finance-audit-report.md` yang merangkum hasil `finance:audit-gl` (dijalankan di staging, dan di produksi bila akses disetujui pemilik), hasil known-issue test, dan hasil audit skema.
2. THE sistem SHALL menghasilkan `docs/prd/finance-decision-log.md` berisi D-1, D-4 (sudah diputuskan 2026-10-18: satu perusahaan), D-11, D-12 dan pertanyaan Q1–Q7 PRD, masing-masing dengan opsi, rekomendasi, pemilik keputusan, status, dan tanggal.
3. FOR setiap bug terkonfirmasi, THE laporan SHALL mencantumkan dampak, usulan penanganan (hotfix terpisah, Fase 1, atau Fase 2), dan meminta keputusan pemilik produk.
4. THE laporan SHALL menyajikan estimasi beban backfill Fase 1 berdasarkan jumlah baris, jumlah kelompok, dan persentase kelompok tak seimbang.
5. THE spec Fase 1 SHALL TIDAK dimulai sebelum pemilik produk menyetujui laporan ini dan menjawab minimal Q1 (D-4 sudah diputuskan).

### Requirement 8: Batasan non-fungsional fase

#### Acceptance Criteria

1. THE seluruh perintah baru SHALL read-only dan aman dijalankan di produksi di luar jam sibuk; query berat memakai agregasi dan indeks yang ada, dengan opsi `--connection` bila tersedia replika baca.
2. THE kode baru SHALL berada di `app/Services/Finances/Audit/` dan `app/Console/Commands/Finances/` sesuai konvensi `{Domain}/{Feature}`.
3. THE kunci terjemahan baru (bila ada output berlokalisasi) SHALL tersedia di `lang/id` dan `lang/en`; output perintah konsol boleh berbahasa Indonesia tetap tanpa kunci terjemahan.
4. THE seluruh test SHALL lulus pada `php artisan test --compact` untuk berkas yang disentuh.

## Pertanyaan yang Menunggu Konfirmasi

| ID | Pertanyaan | Dampak |
|---|---|---|
| Q1 | Apakah audit boleh dijalankan pada DB **produksi** (read-only)? Menentukan apakah estimasi beban backfill berbasis data nyata | Requirement 1, 3, 7.4 |
| Q-P0-1 | Siapa yang menjalankan perintah di staging/produksi dan mengirim hasilnya? | Task 6.5 |
| D-4 | Satu perusahaan — DECIDED 2026-10-18 (PRD); dicatat di decision log | Requirement 7.5 |
| D-11 | Standar akuntansi acuan (SAK/PSAK vs IFRS) — hanya dicatat di decision log pada fase ini | Requirement 7.2 |
