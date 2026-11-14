# Runbook: Mode `shadow` Posting Engine di Staging (Fase 2, Task 7.4 dan 8.5)

Panduan operasional untuk mengumpulkan bukti parity sebelum satu jenis dokumen boleh dipindah ke `on`. Dokumen ini bukan keputusan: perpindahan ke `on` tetap keputusan pemilik produk (Req 7.2c, Q-P2-1 masih terbuka).

## 1. Apa yang dilakukan mode `shadow`

- Jalur lama (Fase 1) tetap **satu-satunya penulis jurnal**. Engine hanya menghitung jurnal yang akan ia tulis dan membandingkannya dengan jurnal jalur lama.
- Hasil perbandingan disimpan di `posting_parity_logs` per dokumen: `match`, `rounding`, `config_diff`, atau `mismatch`.
- Error engine biasa ditelan dan dicatat sebagai `engine_error`. Error konkurensi (deadlock, lock wait) dan koneksi putus **dilempar ulang** (Q-P2-21), jadi job gagal dan dicoba ulang; ini bukan tanda bug parity.
- Guard cancel (F-16) berlaku pada semua mode, termasuk `off`: dokumen yang sudah `canceled` dilewati (`skipped`).

## 2. Prasyarat (semua harus terpenuhi sebelum mode apa pun diubah)

| # | Prasyarat | Cara memeriksa | Catatan |
|---|-----------|----------------|---------|
| 1 | Kode Sprint A sampai D (PR #285 sampai #288) ada di staging | Menu **Posting Profiles** dan **Posting Parity Logs** muncul di Module Settings; 5 migrasi `2026_11_12_10000{1..5}` sudah berjalan | **Pertanyaan terbuka untuk pemilik:** workflow deploy hanya memicu dari `dev-1`; cabang `feat/finance-engine` belum bisa sampai ke staging tanpa merge ke `dev-1` atau deploy manual cabang itu. Migrasi `100008` Fase 1 masih terkunci query presisi 8.1(a) (lihat decision log). |
| 2 | Data staging cukup realistis | Ada dokumen berstatus approved/paid dari beberapa bulan | Staging dengan data kosong tidak menghasilkan parity bermakna. |
| 3 | COA diaudit akuntan (Task 1.3) | `php artisan finance:init-posting-profile --report` | Hanya laporan, tidak menulis. Perhatikan peran **ambigu** (lebih dari satu kandidat akun): resolver gagal tertutup (Q-P2-6), sehingga engine melempar `UnresolvedAccountRoleException` dan tercatat `engine_error`. Pada COA seed diketahui ambigu untuk `payable` (3 akun) dan `revenue` (2 akun, 1 contra). |
| 4 | Satu Posting Profile **aktif** | Halaman Posting Profiles: status `Aktif` | Buat draft (UI atau `finance:init-posting-profile` tanpa `--report`), lengkapi peran yang ambigu, lalu **Aktifkan** (izin `activate`). Profil harus berlaku pada rentang tanggal dokumen yang akan diuji. |
| 5 | Pelaku punya izin | Pengguna dengan profil `full` (Finance Officer baca-saja pada profil, Q-P2-15) | Mengubah mode butuh izin `switch_posting_mode`. |
| 6 | Penjadwal berjalan | `schedule:run` aktif | `finance:prune-parity-logs` terjadwal 03:30 (retensi 90 hari). |

## 3. Urutan jenis dokumen

Req 7.1 menetapkan urutan risiko menaik. Mulai dari **kelompok 1**, satu jenis per langkah, jangan serentak:

1. Asset: `asset_depreciation`, `asset_scrap`, `asset_value_adjustment`, `asset_disposal`
2. `payment_entry`
3. Kelompok 2: `purchase_receipt`, `delivery_note`, `sales_invoice`, `purchase_invoice`, `stock_entry`

### Batasan yang diketahui (jangan dianggap bug parity)

- **Payment Entry:** parity hanya diklaim untuk *receive* atas Sales Invoice dan *pay* atas Purchase Invoice (normal). Arah retur (T-3) dan `internal_transfer` (T-4) menunggu keputusan akuntan; pada `internal_transfer` engine gagal keras dan tercatat `engine_error` (jalur lama juga gagal di `onApproved`). **Rekomendasi:** tunda `payment_entry` sampai T-3 dan T-4 diputuskan, atau pantau terpisah dan jangan hitung kedua kasus itu.
- **Bentuk jurnal yang dipertahankan sama persis dengan jalur lama** (T-1, T-5/T-6, T-7, T-8: scrap tanpa baris untung/rugi, arah untung/rugi disposal, consumption/transfer Stock Entry tanpa jurnal utama, biaya tambahan semua jenis, tanggal `now()`). Keputusan akuntan masih terbuka; engine tidak memperbaikinya diam-diam.
- **Stock Entry bertotal 0 pada `on`:** tidak menyetel `have_transactions`. Pada `shadow` tidak berpengaruh.

## 4. Langkah per jenis dokumen

1. Buka **Posting Parity Logs** (`/settings/postingParityLogs`), panel **Mode Engine per Jenis Dokumen**.
2. Pilih **Shadow (bandingkan)** untuk **satu** jenis. Perubahan tercatat di audit pengaturan modul (pelaku, nilai sebelum dan sesudah).
3. Biarkan operasional normal berjalan (approve, bayar, depresiasi terjadwal, dan seterusnya). Jangan membuat dokumen uji khusus kecuali volume terlalu rendah.
4. Pantau berkala (lihat bagian 5).
5. Setelah kriteria bagian 6 terpenuhi, **laporkan ke pemilik produk** dan tunggu keputusan. Kembalikan ke `off` bila diminta, atau pindah ke `on` hanya atas persetujuan tertulis.

## 5. Pemantauan

```bash
# ringkasan per jenis dokumen (opsional: --type=, --since=Y-m-d)
php artisan finance:parity-report
php artisan finance:parity-report --type=asset_disposal --since=2026-11-15
```

Di UI: halaman **Posting Parity Logs** dengan filter jenis dokumen, status, dan tanggal. Kolom diff hanya terlihat bagi pemegang izin `read`.

Cara membaca status:

| Status | Arti | Tindakan |
|--------|------|----------|
| `match` | Jurnal engine identik dengan jalur lama | Tidak ada |
| `rounding` | Selisih pembulatan di dalam toleransi | Catat; periksa bila jumlahnya membesar |
| `config_diff` | Akun berbeda **hanya** karena akun pilihan pengguna di dokumen lama (SI, PE, SE, AVA, PI `expense`); sisi dan jumlah sama | Wajar selama profil belum menyamai pilihan pengguna; akuntan memutuskan akun profil yang benar |
| `mismatch` | Sisi, jumlah, jumlah baris, atau akun (pada jenis tanpa pilihan pengguna) berbeda | **Harus dijelaskan satu per satu** sebelum `on` |
| `engine_error` | Engine gagal (peran tak ter-resolve, profil tak berlaku pada tanggal itu, dan sebagainya) | Lengkapi profil atau COA, lalu amati ulang |

Juga perhatikan log aplikasi: `posting.invoice_lines_total_mismatch` (jumlah baris invoice menyimpang dari total; engine memakai satu baris sebesar total seperti jalur lama, aturan per barang terlewati) dan `posting.profile_retire_gap`.

## 6. Kriteria sebelum usulan `on` (Req 7.2)

Untuk **setiap** jenis dokumen:

- (a) Test parity hijau (sudah: `PostingParityGroup1Test` dan `PostingParityGroup2Test`).
- (b) Minimal **200 dokumen atau 14 hari** pada mode `shadow` di staging, dengan **0 `mismatch` yang tidak dijelaskan**. `engine_error` dan `config_diff` dijelaskan dan, bila perlu, diselesaikan lewat profil.
- (c) Persetujuan pemilik produk.

Laporan ke pemilik produk memuat per jenis: jumlah dokumen, hitungan per status, daftar `mismatch` beserta penjelasan, `engine_error` yang tersisa, dan rekomendasi. Tanpa menyalin ID baris atau nama pihak ke dokumen.

## 7. Rollback

- **Tanpa deploy:** ubah mode jenis itu kembali ke **Off** di panel yang sama. Efeknya segera (cache mode 60 detik). Closure legacy masih ada sehingga jalur lama langsung kembali menjadi satu-satunya penulis (Q-P2-19).
- Profil yang salah: buat versi baru dari profil aktif (versi harus bersambung dengan versi lama) atau pensiunkan; pensiun yang menimbulkan celah hanya memberi peringatan (Q-P2-11).
- Jangan menghapus data jurnal untuk "memperbaiki" parity; jalur lama tidak berubah dan jurnal asli tetap benar.

## 8. Risiko dan hal yang perlu dijaga

- **Beban:** engine menambah sekitar 7 sampai 12% query per posting (proksi benchmark lokal, resolver dingin). Rasio waktu sungguhan belum terukur di MySQL/staging; catat durasi job posting sebelum dan sesudah `shadow` dan laporkan bila lebih dari 25% (Req 11.1).
- **Konkurensi:** bila job posting sering gagal dengan deadlock setelah `shadow` diaktifkan, kembalikan ke `off` dan laporkan; gagal berulang berarti kontensi persisten, bukan parity.
- **Hardening gagal-tertutup baris invoice** tidak diberlakukan (risiko diterima, Q-P2-21); gejalanya hanya log peringatan di atas.
- **Mode `on` bukan bagian dari runbook ini.**

## 9. Yang menunggu keputusan sebelum atau selama shadow

| Butir | Dibutuhkan untuk |
|-------|------------------|
| Cara menyampaikan kode ke staging (cabang mana, kapan merge ke `dev-1`) | Prasyarat 1 |
| Hasil audit COA oleh akuntan (Task 1.3) | Prasyarat 3 dan 4 |
| T-3 dan T-4 (retur Payment, `internal_transfer`) | `payment_entry` |
| T-1, T-5/T-6, T-7, T-8 (bentuk jurnal legacy) | Menilai `mismatch` yang berasal dari kesalahan bawaan jalur lama |
| T-11 (`posted_account_id` pada item Delivery Note dan Purchase Receipt) | Task 12.1 (setelah `on`) |
| Q-P2-1 (siapa menyetujui `on`) | Langkah 5 bagian 4 |
