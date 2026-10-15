# Tasks: Modul Laporan

Status: `[ ]` todo, `[~]` queued, `[-]` in progress, `[x]` done.
Task bertanda `*` bersifat opsional dan perlu dikonfirmasi sebelum dikerjakan.

Lint dan Pint dijalankan sekali setelah seluruh task selesai, bukan per task.

---

## Fase 1: Fondasi

Kerangka bersama yang dipakai sembilan laporan. Dikerjakan lebih dulu karena
seluruh laporan bergantung padanya.

- [x] T01 Buat kontrak `ReportFilter` dan wadah `ReportKpi`
  - `app/Services/Report/ReportFilter.php`: abstrak dengan `applyTo()` dan `toSummary()`
  - `app/Services/Report/ReportKpi.php`: readonly, berisi `values` dan `rowCount`
  - Test: `ReportKpi` menyimpan dan mengembalikan nilai dengan benar
  - Requirement: 4.1

- [x] T02 Buat `ReportConsistencyChecker`
  - Lewati seluruh pemeriksaan bila environment production
  - Lewati bila request membawa `fid`, `filter`, atau `search` (filter lanjutan
    DataTableScope hanya berlaku pada tabel, jadi selisih di situ wajar)
  - Bila selisih terdeteksi: catat `Log::warning` dan kembalikan detailnya
  - Test: production dilewati; filter lanjutan dilewati; selisih nyata terdeteksi
    dan tercatat; jumlah sama menghasilkan null
  - Requirement: 4.3, 4.4, 4.6

- [x] T03 Buat `ReportIssueReporter` dan `ReportIssueNotification`
  - Buat Ticket: `type` = `bug_problem`, `priority` = `high`, `status` = `new`
  - Assign ke role tim IT, dibaca dari config (jangan ditulis mati)
  - Notifikasi ke anggota role tersebut
  - Test: Ticket terbuat dengan field benar; notifikasi terkirim ke anggota role
  - Requirement: 5.2, 5.3

- [x] T04 Buat `ReportIssueController` dan routenya
  - Endpoint membuat Ticket dari detail ketidakcocokan
  - Endpoint hitung ulang akurat, dibatasi izin administratif
  - Test: non-admin ditolak pada endpoint hitung ulang; endpoint lapor bisa
    diakses pengguna biasa
  - Requirement: 5.1, 5.5, 5.6, 5.8

- [x] T05 Buat komponen frontend bersama
  - `ReportLayout.jsx`, `KpiStrip.jsx`, `ConsistencyWarning.jsx`
  - `ConsistencyWarning` menampilkan tombol lapor untuk semua pengguna, tombol
    hitung ulang hanya untuk yang berizin
  - Test: `.rtl.test.jsx` untuk `ConsistencyWarning` (gating tombol) dan
    `KpiStrip` (render nilai dan format uang)
  - Requirement: 1.1, 5.1, 5.5, 5.7, 5.8

- [x] T06 Buat layanan export PDF dan CSV bersama
  - PDF memakai mekanisme yang sudah ada, CSV memakai PHP bawaan
  - Keduanya mencakup seluruh baris hasil filter, bukan satu halaman
  - Header berisi nama laporan, filter aktif, waktu pembuatan
  - CSV menyertakan baris KPI sebelum header tabel
  - Test: jumlah baris export sama dengan jumlah baris hasil filter; header berisi
    ringkasan filter
  - Requirement: 7.1 sampai 7.6

- [x] T07 Daftarkan grup menu Laporan di `DeskSeeder`
  - Grup "Laporan" berisi sembilan laporan
  - Grup tidak muncul bila pengguna tidak berizin atas satu pun laporan
  - Test: menu muncul sesuai izin
  - Requirement: 17.1 sampai 17.4

### Checkpoint 1

Jalankan seluruh test fase 1. Lanjut ke fase 2 hanya bila semuanya hijau.
Fondasi yang rapuh akan menular ke sembilan laporan sekaligus.

---

## Fase 2: Laporan inventory

Dikerjakan lebih dulu di antara laporan karena paling sedikit gap datanya, jadi
sekaligus menguji fondasi pada kasus yang paling bersih.

- [x] T08 Laporan Stok Persediaan
  - `StockBalanceFilter` (item, gudang, kategori; tanpa rentang tanggal)
  - `StockBalanceKpiBuilder`: total item dipegang, total nilai persediaan
  - Controller, halaman `Report/StockBalance.jsx`, kolom sesuai Requirement 8.3
  - Nilai persediaan = kuantitas dikali `valuation_rate`
  - Jangan tampilkan harga jual, nilai jual, nilai laba, persentase
  - Test: uji konsistensi KPI; filter menyaring benar; laporan kosong tidak error
  - Requirement: 8.1 sampai 8.6

- [x] T09 Buat `TransactionTypeLabeler`
  - Telusuri dari kode seluruh kelas yang menulis ke `stock_ledger_entries`,
    jangan menyimpulkan dari isi database dev yang masih tipis
  - FQCN tak dikenal jatuh ke `class_basename`, bukan kosong atau error
  - Test: FQCN dikenal menghasilkan label terjemahan; FQCN asing menghasilkan
    nama kelas pendek; null menghasilkan label "tidak diketahui"
  - Requirement: 9.4, 9.5

- [x] T10 Laporan Mutasi Stock
  - `StockMutationFilter` (rentang tanggal, item, gudang)
  - `StockMutationKpiBuilder`: total transaksi, item masuk, item keluar
  - Controller, halaman, kolom sesuai Requirement 9.3
  - Kolom jenis transaksi memakai `TransactionTypeLabeler` dan menjadi tautan ke
    dokumen sumber bila pengguna berizin
  - Test: uji konsistensi KPI; item masuk hanya menjumlah perubahan positif; item
    keluar hanya yang negatif; tautan tersembunyi saat tak berizin
  - Requirement: 9.1 sampai 9.7

### Checkpoint 2

Jalankan test fase 1 dan 2. Pada titik ini pola satu laporan sudah terbukti
utuh dari filter sampai export, jadi laporan berikutnya tinggal mengikuti.

---

## Fase 3: Laporan penjualan dan pembelian

- [x] T11 Buat pembangun grafik garis bersama
  - Agregasi nilai per tanggal dalam rentang filter
  - Memakai `ReportFilter` yang sama dengan tabel dan KPI
  - Test: titik grafik sesuai hasil filter; rentang tanpa data menghasilkan
    deret kosong, bukan error
  - Requirement: 1.2, 10.5, 12.5

- [x] T12 Laporan Penjualan
  - `SalesFilter` (rentang tanggal, pelanggan, item), `SalesKpiBuilder`
  - Satu baris per Sales Order; kolom sesuai Requirement 10.3
  - KPI: total transaksi, total kuantitas, nilai penjualan, nilai pajak
  - Grafik garis nilai penjualan per tanggal
  - Test: uji konsistensi KPI; filter item menyaring lewat relasi baris
  - Requirement: 10.1 sampai 10.6

- [x] T13 Laporan Pembelian
  - `PurchaseFilter` (rentang tanggal, supplier, item), `PurchaseKpiBuilder`
  - Satu baris per Purchase Order; kolom sesuai Requirement 12.3
  - Grafik garis total pembelian per tanggal
  - Test: uji konsistensi KPI; filter supplier dan item menyaring benar
  - Requirement: 12.1 sampai 12.6

- [x] T14 Laporan Invoice Penjualan
  - `SalesInvoiceFilter` (rentang tanggal, pelanggan, status pembayaran)
  - KPI: jumlah transaksi, jumlah item, total invoice, nilai pajak, sisa piutang
  - Total pelunasan dari Payment Entry terkait
  - Judul kolom PPN tanpa persentase tetap
  - Jangan tampilkan PPH, potongan breakdown, potongan pungutan PPN, jenis
  - Test: uji konsistensi KPI; sisa piutang cocok dengan `outstanding_amount`;
    total pelunasan cocok dengan jumlah Payment Entry
  - Requirement: 11.1 sampai 11.7

- [x] T15 Laporan Invoice Pembelian
  - `PurchaseInvoiceFilter` (rentang tanggal, supplier, status pembayaran)
  - KPI: jumlah transaksi, jumlah item, nilai DPP, nilai pajak, sisa hutang
  - Nomor invoice memakai `supplier_invoice`
  - Jangan tampilkan PPH dan tanggal terima invoice
  - Test: uji konsistensi KPI; filter status menyaring benar
  - Requirement: 13.1 sampai 13.5

### Checkpoint 3

Jalankan seluruh test fase 1 sampai 3. Enam laporan lengkap selesai di titik
ini dan sudah bisa dinilai pengguna.

---

## Fase 4: Laporan berbasis AssetService

Tiga laporan ini memakai data seadanya: halaman berfungsi penuh, kolom yang
datanya belum tersedia dikosongkan dengan catatan di kode.

Sumber data adalah `AssetService`, bukan `Service\WorkOrder`.

- [x] T16 Monitoring Work Order
  - `WorkOrderMonitoringFilter` (rentang tanggal, status, jenis, aset)
  - KPI: total pekerjaan, selesai, berjalan, rata-rata lama pengerjaan
  - Lama pengerjaan dari selisih tanggal mulai dan selesai; yang belum selesai
    dihitung sampai hari ini dan ditandai masih berjalan
  - Test: uji konsistensi KPI; pekerjaan belum selesai ditandai benar; rata-rata
    lama pengerjaan mengabaikan yang belum mulai
  - Requirement: 14.1 sampai 14.6

- [x] T17 Laporan Pemakaian Sparepart
  - `SparepartUsageFilter` (rentang tanggal, item, aset)
  - Satu baris per `AssetServiceConsumedItem`
  - KPI: total jenis item, total kuantitas, total nilai
  - Test: uji konsistensi KPI; total nilai cocok dengan jumlah `total_value`
  - Requirement: 15.1 sampai 15.5

- [x] T18 Laporan Anggota Tim
  - `TeamMemberFilter` (rentang tanggal, PIC, status aktivitas)
  - Satu baris per `AssetServiceActivity`
  - KPI: total aktivitas, jumlah PIC terlibat, jumlah pekerjaan tersentuh
  - Aktivitas tanpa PIC tetap tampil dengan penanda "tanpa PIC"
  - Pengelompokan per PIC lewat fitur grouping `DataTableScope`
  - Test: uji konsistensi KPI; aktivitas tanpa PIC tidak hilang; jumlah PIC
    menghitung nilai unik
  - Requirement: 16.1 sampai 16.6

### Checkpoint 4

Jalankan seluruh test suite. Seluruh laporan selesai.

---

## Fase 5: Penyelesaian

- [x] T19 Jalankan Pint dan ESLint
  - `vendor/bin/pint --dirty --format agent`
  - `npm run lint:fix`

- [-] T20 Verifikasi visual di browser
  - Login memakai admin/admin
  - Buka sembilan laporan, periksa tata letak seragam dan KPI tampil
  - Uji satu filter kompleks lintas relasi (contoh: supplier tertentu digabung
    item tertentu) untuk memastikan Requirement 2.3 dan 2.4 benar-benar jalan
  - Uji export PDF dan CSV pada satu laporan

- [ ] T21* Perbarui dokumentasi modul di `docs/`
  - Opsional, perlu konfirmasi lebih dulu
  - Tambah `docs/modules/report.md` berisi daftar laporan, sumber data, dan
    catatan gap terhadap app lama

---

## Catatan untuk pelaksana

**Soal skema**: tabel di repo ini dibentuk bertahap, trait menambah kolom lewat
migration generik belakangan. Baca skema dari database (MCP laravel-boost
`database-schema`), jangan menyimpulkan dari file migration.

**Soal Work Order**: menu "Work Orders" mengarah ke `AssetService`.
`Service\WorkOrder` sudah disembunyikan dari menu lewat `DeskSeeder`. Jangan
tertukar.

**Soal uji konsistensi**: setiap laporan wajib punya uji yang membandingkan KPI
dengan hitungan manual atas seluruh baris. Uji inilah yang menjaga agar dua
jalur query tidak menyimpang diam-diam. Jangan dilewati dengan alasan laporan
itu sederhana.

**Soal gap**: enam kolom dari app lama sengaja tidak dibuat karena datanya belum
ada. Rinciannya di `gap-app-lama.md`. Kalau saat implementasi ditemukan gap
baru, tambahkan ke dokumen itu, jangan diam-diam mengarang nilai pengganti.
