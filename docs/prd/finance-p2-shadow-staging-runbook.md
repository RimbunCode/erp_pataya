# Runbook: Mode `shadow` Posting Engine di Staging (Fase 2, Task 7.4 dan 8.5) — RIWAYAT, dihentikan 22 November 2026

> **DIHENTIKAN 22 November 2026 (Q-P2-23, opsi A, disetujui pemilik produk).** Mode `off`/`shadow`/`on` dihapus: Posting Engine selalu aktif dan halaman Posting Parity Logs tidak lagi memiliki kontrol ubah mode. Bagian 1 sampai 6, 8, dan 9 adalah prosedur historis yang **tidak dapat dijalankan lagi** (tidak ada mode `shadow`, tidak ada jalur lama untuk dibandingkan, tidak ada catatan parity baru). Bagian 7 sudah diperbarui dan bagian 10 tetap berlaku sebagai bukti uji engine di staging (21 November 2026). Pemilik produk menyatakan produksi belum berisi data dan staging hanya berisi data uji, sehingga tidak ada lingkungan dengan data asli yang menunggu prosedur ini.

Panduan operasional untuk mengumpulkan bukti parity (skenario terarah per jenis dokumen, Req 7.2b, Q-P2-22) sebelum satu jenis dokumen boleh dipindah ke `on`. Dokumen ini bukan keputusan: perpindahan ke `on` tetap keputusan pemilik produk (Req 7.2c; Q-P2-1 dijawab pemilik produk 2026-11-21, lihat bagian 10).

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
3. Jalankan skenario terarah jenis itu (daftar di bagian 6) lewat operasional normal di staging; bila volume operasional sudah cukup, skenario dapat terpenuhi dari dokumen yang ada. Jangan memakai skrip untuk membuat dokumen.
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
- (b) Paritas terbukti pada **skenario terarah** (daftar di bawah) di mode `shadow` pada staging: semua hasil `match` atau `rounding`, `config_diff` dijelaskan, **0 `mismatch` dan 0 `engine_error` yang tidak dijelaskan**. Tidak ada batas minimum jumlah dokumen atau hari (keputusan pemilik produk 2026-11-15, Q-P2-22; sebelumnya 200 dokumen atau 14 hari).
- (c) Persetujuan pemilik produk.

**Skenario terarah minimum per jenis** (akuntan atau QA dapat menambah; satu dokumen atau lebih per baris):

| Jenis | Skenario |
|-------|----------|
| `asset_depreciation` | Satu jadwal depresiasi terposting |
| `asset_scrap` | Satu scrap aset |
| `asset_value_adjustment` | Kenaikan dan penurunan nilai |
| `asset_disposal` | Penjualan aset dengan untung, dan dengan rugi |
| `payment_entry` | Receive atas Sales Invoice, pay atas Purchase Invoice (retur dan `internal_transfer` di luar cakupan sampai T-3 dan T-4 diputuskan) |
| `purchase_receipt` | Normal dan retur, barang stok |
| `delivery_note` | Normal dan retur |
| `sales_invoice` | Normal, retur, berpajak, barang stok dan non-stok, berdiskon |
| `purchase_invoice` | Stok (dua jurnal), non-stok, retur, off-PO |
| `stock_entry` | Setiap `purpose` yang dipakai operasional |

Dokumen yang tidak dapat dibuat di staging (mis. mata uang asing bila belum ada kurs) dicatat sebagai **tidak tercakup** di laporan, beserta alasannya, dan menjadi keputusan pemilik produk.

Laporan ke pemilik produk memuat per jenis: jumlah dokumen, hitungan per status, daftar `mismatch` beserta penjelasan, `engine_error` yang tersisa, dan rekomendasi. Tanpa menyalin ID baris atau nama pihak ke dokumen.

## 7. Rollback

- **Tidak ada lagi rollback ke jalur lama (sejak Task 14.1, 2026-11-22) dan tidak ada lagi mode yang dapat diubah (sejak 22 November 2026, Q-P2-23).** Closure legacy sudah dihapus dan mode `off`/`shadow`/`on` dihapus: posting selalu lewat engine. Dokumen yang gagal posting (`GlPostingStatus` `failed`, mis. peran tak ter-resolve) dicoba ulang setelah profil dilengkapi. Rollback sesungguhnya adalah redeploy rilis sebelumnya (git revert); migrasi `2026_11_22_090001` reversible (`down()` memulihkan kolom `finance_settings.posting_modes` dan mengisi `on` untuk 10 jenis bila baris setting ada).
- Profil yang salah: buat versi baru dari profil aktif (versi harus bersambung dengan versi lama) atau pensiunkan; pensiun yang menimbulkan celah hanya memberi peringatan (Q-P2-11).
- Jangan menghapus data jurnal untuk "memperbaiki" parity; jalur lama tidak berubah dan jurnal asli tetap benar.

## 8. Risiko dan hal yang perlu dijaga

- **Beban:** engine menambah sekitar 7 sampai 12% query per posting (proksi benchmark lokal, resolver dingin). Rasio waktu sungguhan belum terukur di MySQL/staging; catat durasi job posting sebelum dan sesudah `shadow` dan laporkan bila lebih dari 25% (Req 11.1).
- **Konkurensi:** bila job posting sering gagal dengan deadlock setelah `shadow` diaktifkan, kembalikan ke `off` dan laporkan; gagal berulang berarti kontensi persisten, bukan parity.
- **Hardening gagal-tertutup baris invoice** tidak diberlakukan (risiko diterima, Q-P2-21); gejalanya hanya log peringatan di atas.
- **Mode `on` bukan bagian dari prosedur shadow di atas.** Pemakaian `on` di staging dan hasil ujinya dicatat di bagian 10.

## 9. Yang menunggu keputusan sebelum atau selama shadow (riwayat; mode `shadow` dihapus 22 November 2026)

| Butir | Dibutuhkan untuk |
|-------|------------------|
| Cara menyampaikan kode ke staging (cabang mana, kapan merge ke `dev-1`) | Prasyarat 1 |
| Hasil audit COA oleh akuntan (Task 1.3) | Prasyarat 3 dan 4 |
| T-3 dan T-4 (retur Payment, `internal_transfer`) | `payment_entry` |
| T-1, T-5/T-6, T-7, T-8 (bentuk jurnal legacy) | Menilai `mismatch` yang berasal dari kesalahan bawaan jalur lama |
| T-11 (`posted_account_id` pada item Delivery Note dan Purchase Receipt) | Task 12.1 (setelah `on`) |
| ~~Q-P2-1 (siapa menyetujui `on`)~~ dijawab pemilik produk 2026-11-21 (pemilik produk sendiri; bagian 10) | Langkah 5 bagian 4 |

## 10. Hasil uji mode `on` di staging (21 November 2026)

**Keputusan:** pemilik produk memerintahkan semua 10 jenis dokumen dinyalakan ke `on` di staging pada 2026-11-21 (data staging seluruhnya data uji; belum ada data asli). Pengaktifan ini semula hanya berlaku untuk staging dan rollout ke lingkungan dengan data asli menunggu butir bagian 9. **Diubah 22 November 2026 (Q-P2-23):** prosedur itu tidak dapat dijalankan lagi (mode dihapus) dan pemilik produk menyatakan produksi belum berisi data, sehingga tidak ada lingkungan dengan data asli yang menunggu. Pada tanggal yang sama pemilik produk menyatakan Task 7.4 dan 8.5 selesai (Q-P2-1 dijawab; Req 7.2(c) terpenuhi); laporan parity `shadow` per jenis tidak dilampirkan di dokumen ini, sehingga bukti tertulisnya adalah hasil uji `on` di bawah.

**Prasyarat yang dibereskan sebelum pengujian:** profil posting v3 (berlaku mulai 2026-11-16, tanpa batas akhir, 11 peran terpetakan) dibuat dari v2 dan diaktifkan; sebelumnya dokumen bertanggal 16 November ke atas tidak punya profil aktif (v3 lama berstatus `retired` dan tanpa pemetaan).

**Metode:** dokumen uji dibuat lewat UI staging dan diajukan; jurnal dibaca dari Buku Besar Umum. Dengan mode `on` tidak ada log parity (jalur lama tidak menulis jurnal), jadi pembuktiannya dari jurnal dan status antrean.

| Jenis dokumen | Dokumen uji | Jurnal | Hasil |
|---------------|-------------|--------|-------|
| Stock Entry (penerimaan) | StockEntry-0020/26, 5 x 100.000 | JV-0026: Dr 1241 Persediaan 500.000, Cr 5110 Penyesuaian Stok 500.000 | Sesuai |
| Sales Invoice | SalesInvoice-0012/26, 10 x 1.000.000, PPN 11% | JV-0027: Dr 1231 Piutang 11.008.333,33, Cr 4110 Penjualan 11.008.333,33 (PPN tanpa baris sendiri, D-12) | Sesuai desain |
| Purchase Invoice | PurchaseINV-0020/26 dari PO-0012 | JV-0028: Dr 2214 615.250, Cr 2211 Hutang Dagang 615.250 (PPN 11% dari DPP baris berpajak) | Sesuai |
| Delivery Note | DN-0007/26 dari SO-0007 | JV-0029: Dr 4210 HPP 15.250.000, Cr 1241 Persediaan 15.250.000 | Arah sesuai; nilai HPP belum dicocokkan dengan kartu stok |
| Purchase Receipt | Receipt-0016/26 dari PO-0012, dua baris stok | JV-0030: Dr 1241 285.000, Cr 2214 285.000 | Sesuai |
| Penyesuaian Nilai Aset | 0004, Asset-0009 9.000.000 menjadi 9.500.000 | JV-0031: Dr 1251.1 500.000, Cr 5110 500.000 | Sesuai |
| Pelepasan Aset | SalesInvoice-0013/26 dari SO-0015, Asset-0009 dijual 10.000.000 | JV-0033 (faktur): Dr 1231 10.000.000, Cr 4110 10.000.000. JV-0032 (pelepasan): Dr 4110 500.000, Cr 1251.1 500.000 | Sesuai desain; arah dan cakupan jurnal pelepasan adalah T-7 yang masih terbuka |
| Scrap Aset | Asset-0010 (diuji sebelumnya) | Terposting | Sesuai |
| Depresiasi Aset | Tidak dipicu ulang; job harian 02.30 | JV-0024 dan JV-0025 (16 November, jalur lama) | Tidak diuji dengan `on` |
| Payment Entry | SalesInvoice-0014/26 (1.000.000, jadwal 30 November); PaymentEntry-0014/26 (Terima 400.000) dan 0015/26 (Terima 300.000) lewat Aksi → Buat Entri Pembayaran dari faktur | JV-0035: Dr 1221 Bank Rupiah 400.000, Cr 1231 Piutang Dagang 400.000. JV-0036: Dr 1221 300.000, Cr 1231 300.000. Setelah PE-0014 dibatalkan, baris GL JV-0035 hilang dari Buku Besar | Sesuai: N-4, F-10, dan F-04 lolos (lihat catatan) |

Semua jurnal seimbang dan terposting dalam sekitar 2 menit. Satu baris antrean lama berstatus Gagal (retry 1): dokumen "0001", `AssetCategoryAccount` tidak ditemukan untuk aset terkait; tidak berasal dari pengujian ini dan tidak diubah.

**Catatan dan temuan:**
- **Payment Entry teruji dengan `on`; N-4, F-10, dan F-04 lolos.** Faktur uji memakai jadwal tagihan tunggal 1.000.000 (jumlah jadwal dikoreksi manual karena sempat basi setelah harga diubah). **N-4:** pembayaran tipe Terima mendebit Bank dan mengkredit Piutang. **F-10:** pembayaran parsial kedua memposting 300.000, bukan 700.000 kumulatif. **F-04:** setelah PaymentEntry-0014 (400.000) dibatalkan, sisa jadwal naik dari 300.000 menjadi 700.000, dan jurnalnya (JV-0035) dihapus dari Buku Besar, bukan dibalik dengan jurnal pembalik. **Diputuskan 21 November 2026 (pemilik produk):** pembatalan Payment Entry memang menghapus jurnalnya ("jika dibatalkan maka dihapus"); perilaku ini disengaja dan bukan temuan. Cakupan dikonfirmasi pemilik produk: semua jenis dokumen. Ini menjawab D-13 (opsi A, soft-delete dipertahankan) dan sudah dicatat di PRD, decision log, dan spec `finance-p2-posting-engine` (Requirement 10, Task 11, design).
- **Temuan: form Payment Entry jalur "Referensi ke" tidak memuat jadwal tagihan.** Endpoint `/model` untuk jalur ini hanya mengembalikan `id` pada `payment_schedules` (tanpa `due_date`/`outstanding_amount`), sehingga baris jadwal kosong dan dokumen tidak bisa dibuat. Jalur Aksi → Buat Entri Pembayaran dari faktur berfungsi dan dipakai pada uji ini. Belum diperbaiki; perlu diputuskan apakah masuk lingkup hotfix.
- **T-7 (jurnal pelepasan aset) tetap menunggu keputusan akuntan.** JV-0032 hanya memuat selisih untung/rugi (harga dikurangi nilai buku), tidak mengeluarkan nilai buku aset, dan arahnya mengikuti perilaku lama (untung mendebit akun untung/rugi dan mengkredit aset tetap). Ini disengaja demi parity (`AssetDisposalRule`), bukan regresi engine.
- **D-12:** jurnal Sales Invoice dan Purchase Invoice mencatat total termasuk PPN ke satu pasang akun tanpa baris PPN Keluaran/Masukan terpisah; D-12 disetujui pemilik produk 22 November 2026 sebagai usulan PRD (implementasi di Fase 3).
- **Tanggal bergeser sehari di staging:** Penyesuaian Nilai 0004 diketik 21 November tersimpan 20 November. Ini bug DatetimePicker `type="date"` yang sudah diperbaiki di kode; staging belum memuatnya karena PR perbaikannya berlabel `skip-deploy`. Label dokumen sumber di Status Posting GL juga masih tampil token mentah (`:item`, `:asset.asset_name`) karena alasan yang sama.
- **Data uji yang tersisa di staging:** StockEntry-0020, SalesInvoice-0012, 0013, dan 0014, PaymentEntry-0014 (dibatalkan) dan 0015, PurchaseINV-0020, DN-0007, Receipt-0016, SO-0015, Penyesuaian Nilai 0004, dan Asset-0009 yang kini terjual.
