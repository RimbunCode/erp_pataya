# Requirements: Modul Laporan

## Pendahuluan

Modul Laporan menyediakan sembilan laporan yang mengacu pada modul laporan app
lama (Pataya Sarana Niaga), disesuaikan dengan data yang tersedia di app baru.

Seluruh laporan bersifat **baca-saja**: tidak membuat, mengubah, atau menghapus
data transaksi. Laporan hanya menyajikan ulang data yang sudah ada.

Perbedaan dengan app lama dicatat terpisah di [`gap-app-lama.md`](gap-app-lama.md)
sebagai bahan diskusi tim. Requirement di dokumen ini hanya mencakup yang
datanya tersedia di app baru.

### Daftar laporan

Enam laporan dikerjakan lengkap:

1. Stok Persediaan
2. Mutasi Stock
3. Laporan Penjualan
4. Laporan Invoice Penjualan
5. Laporan Pembelian
6. Laporan Invoice Pembelian

Tiga laporan dikerjakan dengan data seadanya (halaman berfungsi penuh, kolom
yang datanya belum ada dikosongkan dengan catatan):

7. Monitoring Work Order
8. Laporan Pemakaian Sparepart
9. Laporan Anggota Tim

Ketiganya berbasis `AssetService`, bukan `Service\WorkOrder`. Alasannya: menu
"Work Orders" di app baru mengarah ke `AssetService`, dan `WorkOrder` lama sudah
disembunyikan dari menu lewat `DeskSeeder`.

---

## Requirement 1: Kerangka laporan yang seragam

**User story:** Sebagai pengguna, saya ingin semua laporan punya tata letak yang
sama, supaya saya tidak perlu belajar ulang tiap kali membuka laporan berbeda.

### Acceptance Criteria

1. WHEN pengguna membuka halaman laporan mana pun THEN sistem SHALL menampilkan
   urutan bagian: panel filter, strip KPI, tabel data.
2. WHERE laporan memiliki grafik (Laporan Penjualan dan Laporan Pembelian) THEN
   sistem SHALL menempatkan grafik antara strip KPI dan tabel data.
3. WHEN halaman laporan dimuat tanpa parameter filter THEN sistem SHALL
   menerapkan filter bawaan laporan tersebut dan menampilkan hasilnya.
4. WHEN pengguna mengubah filter THEN sistem SHALL memperbarui strip KPI, grafik
   (bila ada), dan tabel data secara bersamaan berdasarkan filter yang sama.
5. IF hasil filter kosong THEN sistem SHALL menampilkan strip KPI bernilai nol
   dan tabel dengan pesan kosong, BUKAN halaman error.

---

## Requirement 2: Filter laporan

**User story:** Sebagai staf, saya ingin menyaring laporan berdasarkan kombinasi
beberapa kriteria sekaligus, supaya saya bisa menjawab pertanyaan spesifik
seperti "dari Supplier A, barang B, ada transaksi di tanggal berapa saja".

### Acceptance Criteria

1. WHEN pengguna membuka laporan THEN sistem SHALL menyediakan filter rentang
   tanggal, kecuali pada laporan Stok Persediaan yang bersifat snapshot posisi
   terkini.
2. WHEN pengguna menyaring berdasarkan kolom relasi (supplier, pelanggan, item,
   gudang, kategori) THEN sistem SHALL mendukungnya melalui mekanisme filter
   `DataTableScope` yang sudah ada.
3. WHEN pengguna menggabungkan beberapa kondisi filter THEN sistem SHALL
   mendukung kombinasi bersarang dengan operator AND dan OR.
4. WHEN pengguna menyaring berdasarkan kolom relasi bertingkat (contoh: item
   pada baris transaksi) THEN sistem SHALL mendukungnya melalui dot-notation
   yang sudah ditangani `FilterColumnResolver` dan `FilterEvaluator`.
5. WHEN pengguna menyimpan kombinasi filter THEN sistem SHALL memakai mekanisme
   saved filter yang sudah ada, tanpa mekanisme penyimpanan baru.
6. WHERE kolom relasi dibutuhkan untuk penyaringan THEN sistem SHALL
   mendaftarkan kolom tersebut sebagai kolom filter pada model laporan terkait.

---

## Requirement 3: Strip KPI

**User story:** Sebagai manajer, saya ingin melihat angka ringkasan di atas
tabel, supaya saya tahu gambaran besar tanpa membaca seluruh baris.

### Acceptance Criteria

1. WHEN halaman laporan dimuat THEN sistem SHALL menampilkan strip berisi 2
   sampai 5 angka ringkasan sesuai laporannya.
2. WHEN filter berubah THEN sistem SHALL menghitung ulang seluruh angka KPI
   berdasarkan filter yang sedang aktif.
3. WHEN KPI dihitung THEN sistem SHALL menghitungnya atas **seluruh** baris
   hasil filter, bukan hanya baris pada halaman yang sedang ditampilkan.
4. WHEN nilai KPI berupa uang THEN sistem SHALL menampilkannya dengan format
   mata uang sesuai konvensi yang berlaku di aplikasi.
5. IF sebuah KPI tidak dapat dihitung karena datanya tidak tersedia THEN sistem
   SHALL tidak menampilkan KPI tersebut, BUKAN menampilkan nilai nol yang
   menyesatkan.

---

## Requirement 4: Konsistensi KPI dengan isi tabel

**User story:** Sebagai pengguna, saya ingin yakin angka KPI benar-benar
mencerminkan isi tabel di bawahnya, supaya saya tidak mengambil keputusan dari
angka yang salah.

**Latar belakang:** Tabel dirender lewat `DataTableScope`, sedangkan KPI
dihitung lewat query agregat terpisah. Macro `dataTable()` tidak mengembalikan
builder yang sudah terfilter, sehingga filter mau tidak mau diterapkan pada dua
builder berbeda. Requirement ini mencegah kedua jalur itu menyimpang.

### Acceptance Criteria

1. WHEN filter laporan diterapkan THEN sistem SHALL memakai satu definisi filter
   yang sama untuk jalur tabel dan jalur KPI, sehingga perubahan filter cukup
   ditulis di satu tempat.
2. WHEN sebuah laporan diuji THEN sistem SHALL memiliki pengujian otomatis yang
   membandingkan nilai KPI dengan hasil perhitungan manual atas seluruh baris
   tabel pada filter yang sama.
3. WHERE lingkungan BUKAN production THEN sistem SHALL membandingkan jumlah baris
   versi KPI dengan jumlah baris versi tabel setiap kali laporan dimuat.
4. IF perbandingan pada kriteria 3 menunjukkan selisih THEN sistem SHALL mencatat
   peringatan ke log berisi nama laporan, filter yang aktif, dan kedua nilai yang
   berbeda.
5. IF terdeteksi selisih THEN sistem SHALL tetap menampilkan laporan beserta
   peringatan di layar, BUKAN menyembunyikan laporan.
6. WHERE lingkungan adalah production THEN sistem SHALL TIDAK menjalankan
   pemeriksaan pada kriteria 3, agar tidak menambah beban query.

---

## Requirement 5: Penanganan saat KPI tidak konsisten

**User story:** Sebagai staf yang menemukan peringatan ketidakcocokan, saya
ingin bisa melaporkannya ke tim IT dengan satu klik; sebagai admin, saya ingin
bisa memperoleh angka yang benar saat itu juga.

### Acceptance Criteria

1. WHEN peringatan ketidakcocokan muncul THEN sistem SHALL menampilkan tombol
   "Laporkan masalah ini" kepada seluruh pengguna yang melihat peringatan itu.
2. WHEN pengguna menekan tombol laporkan THEN sistem SHALL membuat Ticket dengan
   `type` bernilai `bug_problem`, `priority` bernilai `high`, subjek yang
   menyebutkan nama laporan, dan deskripsi berisi filter aktif serta kedua nilai
   yang berbeda.
3. WHEN Ticket dibuat THEN sistem SHALL menugaskannya ke role tim IT dan
   mengirim notifikasi kepada anggota role tersebut.
4. WHEN Ticket berhasil dibuat THEN sistem SHALL menampilkan konfirmasi berisi
   nomor Ticket kepada pengguna.
5. WHERE pengguna memiliki izin administratif THEN sistem SHALL menampilkan
   tombol tambahan "Hitung ulang akurat".
6. WHEN pengguna menekan tombol hitung ulang akurat THEN sistem SHALL menghitung
   KPI dengan mengambil seluruh baris hasil filter melalui jalur tabel lalu
   menjumlahkannya di aplikasi, sehingga hasilnya dijamin konsisten dengan tabel.
7. WHEN hasil hitung ulang akurat tersedia THEN sistem SHALL menampilkannya
   menggantikan nilai KPI sebelumnya, disertai penanda bahwa angka itu berasal
   dari perhitungan ulang.
8. IF pengguna TIDAK memiliki izin administratif THEN sistem SHALL TIDAK
   menampilkan tombol hitung ulang akurat.

---

## Requirement 6: Hak akses laporan

**User story:** Sebagai admin, saya ingin akses laporan mengikuti izin modul
sumbernya, supaya saya tidak perlu mengatur izin dua kali untuk data yang sama.

### Acceptance Criteria

1. WHEN pengguna mengakses sebuah laporan THEN sistem SHALL memeriksa izin baca
   pada modul sumber data laporan tersebut.
2. WHERE pengguna tidak memiliki izin modul sumber THEN sistem SHALL menolak
   akses ke laporan itu.
3. WHEN menu laporan dirender THEN sistem SHALL hanya menampilkan laporan yang
   boleh diakses pengguna tersebut.
4. WHEN laporan menampilkan data yang dibatasi cabang THEN sistem SHALL
   menerapkan pembatasan cabang yang sama seperti pada modul sumbernya.

Pemetaan laporan ke modul sumber:

| Laporan | Modul sumber |
|---------|--------------|
| Stok Persediaan | Inventory |
| Mutasi Stock | Inventory |
| Laporan Penjualan | Sales |
| Laporan Invoice Penjualan | Finances |
| Laporan Pembelian | Purchase |
| Laporan Invoice Pembelian | Finances |
| Monitoring Work Order | Asset / Service |
| Laporan Pemakaian Sparepart | Asset / Service |
| Laporan Anggota Tim | Asset / Service |

---

## Requirement 7: Export laporan

**User story:** Sebagai staf, saya ingin mengunduh laporan sebagai PDF atau CSV,
supaya bisa saya lampirkan ke email atau olah lebih lanjut.

### Acceptance Criteria

1. WHEN pengguna membuka laporan THEN sistem SHALL menyediakan tombol unduh PDF
   dan tombol unduh CSV.
2. WHEN pengguna mengunduh THEN sistem SHALL menyertakan seluruh baris hasil
   filter, bukan hanya baris pada halaman yang sedang ditampilkan.
3. WHEN berkas diunduh THEN sistem SHALL mencantumkan nama laporan, filter yang
   aktif, dan waktu pembuatan di bagian atas berkas.
4. WHEN PDF dibuat THEN sistem SHALL memakai mekanisme PDF yang sudah ada di
   aplikasi, tanpa menambah dependensi baru.
5. WHEN CSV dibuat THEN sistem SHALL memakai PHP bawaan, tanpa menambah
   dependensi baru.
6. WHEN CSV dibuat THEN sistem SHALL menyertakan baris KPI di bagian atas berkas
   sebelum baris header tabel.

---

## Requirement 8: Laporan Stok Persediaan

**User story:** Sebagai staf gudang, saya ingin melihat posisi stok seluruh item
beserta nilai modalnya, supaya saya tahu berapa nilai persediaan yang dipegang.

### Acceptance Criteria

1. WHEN laporan dimuat THEN sistem SHALL menampilkan satu baris per kombinasi
   item dan gudang.
2. WHEN laporan dimuat THEN sistem SHALL menyediakan filter item, gudang, dan
   kategori.
3. WHEN laporan dimuat THEN sistem SHALL menampilkan kolom: kode item, nama
   item, gudang, satuan, stok tersedia, harga beli rata-rata, dan nilai
   persediaan.
4. WHEN nilai persediaan dihitung THEN sistem SHALL mengalikan kuantitas dengan
   `valuation_rate`.
5. WHEN laporan dimuat THEN sistem SHALL menampilkan KPI: total item dipegang dan
   total nilai persediaan.
6. WHERE app lama menampilkan harga jual, nilai jual, nilai laba, dan persentase
   margin THEN sistem SHALL TIDAK menampilkannya, karena app baru belum memiliki
   master harga jual (lihat gap 1 pada `gap-app-lama.md`).

---

## Requirement 9: Laporan Mutasi Stock

**User story:** Sebagai staf gudang, saya ingin melihat riwayat keluar-masuk
barang, supaya saya bisa menelusuri perubahan stok suatu item.

### Acceptance Criteria

1. WHEN laporan dimuat THEN sistem SHALL menampilkan satu baris per entri
   `StockLedgerEntry`.
2. WHEN laporan dimuat THEN sistem SHALL menyediakan filter rentang tanggal,
   item, dan gudang.
3. WHEN laporan dimuat THEN sistem SHALL menampilkan kolom: tanggal transaksi,
   kode item, nama item, gudang, jenis transaksi, perubahan kuantitas, dan
   kuantitas setelah transaksi.
4. WHEN kolom jenis transaksi ditampilkan THEN sistem SHALL menerjemahkan
   `referenceable_type` menjadi label berbahasa Indonesia melalui peta yang
   ditulis di kode.
5. IF `referenceable_type` tidak dikenali dalam peta THEN sistem SHALL
   menampilkan nama kelas pendeknya, BUKAN mengosongkan kolom atau gagal.
6. WHEN laporan dimuat THEN sistem SHALL menampilkan KPI: total transaksi, total
   item masuk, dan total item keluar.
7. WHEN kolom jenis transaksi ditampilkan THEN sistem SHALL menjadikannya tautan
   ke dokumen sumbernya bila pengguna berizin membuka dokumen itu.

---

## Requirement 10: Laporan Penjualan

**User story:** Sebagai manajer penjualan, saya ingin melihat seluruh pesanan
penjualan dalam satu periode beserta status pengiriman dan penagihannya.

### Acceptance Criteria

1. WHEN laporan dimuat THEN sistem SHALL menampilkan satu baris per Sales Order.
2. WHEN laporan dimuat THEN sistem SHALL menyediakan filter rentang tanggal,
   pelanggan, dan item.
3. WHEN laporan dimuat THEN sistem SHALL menampilkan kolom: nomor SO, pelanggan,
   tanggal, total kuantitas, nilai penjualan, pajak, invoice terkait, status
   pembayaran invoice, dan status pengiriman.
4. WHEN laporan dimuat THEN sistem SHALL menampilkan KPI: total transaksi, total
   kuantitas, nilai penjualan, dan nilai pajak.
5. WHEN laporan dimuat THEN sistem SHALL menampilkan grafik garis nilai penjualan
   per tanggal dalam rentang filter.
6. WHEN nomor SO ditampilkan THEN sistem SHALL menjadikannya tautan ke dokumen
   Sales Order.

---

## Requirement 11: Laporan Invoice Penjualan

**User story:** Sebagai staf keuangan, saya ingin melihat seluruh invoice
penjualan beserta sisa piutangnya, supaya saya tahu tagihan mana yang belum
lunas.

### Acceptance Criteria

1. WHEN laporan dimuat THEN sistem SHALL menampilkan satu baris per Sales
   Invoice.
2. WHEN laporan dimuat THEN sistem SHALL menyediakan filter rentang tanggal,
   pelanggan, dan status pembayaran.
3. WHEN laporan dimuat THEN sistem SHALL menampilkan kolom: nomor invoice,
   tanggal invoice, pelanggan, SO terkait, DPP, PPN, total invoice, total
   pelunasan, tanggal pelunasan terakhir, dan sisa piutang.
4. WHEN kolom PPN diberi judul THEN sistem SHALL TIDAK menuliskan persentase
   secara tetap pada judul kolom, melainkan mengambilnya dari data atau
   menuliskan "PPN" saja (lihat gap 10 pada `gap-app-lama.md`).
5. WHEN total pelunasan dihitung THEN sistem SHALL menjumlahkan Payment Entry
   yang terkait invoice tersebut.
6. WHEN laporan dimuat THEN sistem SHALL menampilkan KPI: jumlah transaksi,
   jumlah item, total invoice, nilai pajak, dan sisa piutang.
7. WHERE app lama menampilkan kolom PPH, potongan breakdown, potongan pungutan
   PPN, dan jenis invoice THEN sistem SHALL TIDAK menampilkannya, karena app baru
   belum mencatat data tersebut (lihat gap 2 sampai 5 pada `gap-app-lama.md`).

---

## Requirement 12: Laporan Pembelian

**User story:** Sebagai manajer pembelian, saya ingin melihat seluruh pesanan
pembelian dalam satu periode.

### Acceptance Criteria

1. WHEN laporan dimuat THEN sistem SHALL menampilkan satu baris per Purchase
   Order.
2. WHEN laporan dimuat THEN sistem SHALL menyediakan filter rentang tanggal,
   supplier, dan item.
3. WHEN laporan dimuat THEN sistem SHALL menampilkan kolom: nomor PO, supplier,
   tanggal, total kuantitas, total nilai, dan pajak.
4. WHEN laporan dimuat THEN sistem SHALL menampilkan KPI: total transaksi, total
   kuantitas, total nilai, dan nilai pajak.
5. WHEN laporan dimuat THEN sistem SHALL menampilkan grafik garis total pembelian
   per tanggal dalam rentang filter.
6. WHEN nomor PO ditampilkan THEN sistem SHALL menjadikannya tautan ke dokumen
   Purchase Order.

---

## Requirement 13: Laporan Invoice Pembelian

**User story:** Sebagai staf keuangan, saya ingin melihat seluruh invoice
pembelian beserta sisa hutangnya, supaya saya tahu kewajiban mana yang belum
dibayar.

### Acceptance Criteria

1. WHEN laporan dimuat THEN sistem SHALL menampilkan satu baris per Purchase
   Invoice.
2. WHEN laporan dimuat THEN sistem SHALL menyediakan filter rentang tanggal,
   supplier, dan status pembayaran.
3. WHEN laporan dimuat THEN sistem SHALL menampilkan kolom: nomor invoice
   supplier, tanggal invoice, supplier, PO terkait, DPP, diskon, PPN, total
   invoice, total pelunasan, tanggal pelunasan terakhir, dan keterangan.
4. WHEN laporan dimuat THEN sistem SHALL menampilkan KPI: jumlah transaksi,
   jumlah item, nilai DPP, nilai pajak, dan sisa hutang.
5. WHERE app lama menampilkan kolom PPH dan tanggal terima invoice THEN sistem
   SHALL TIDAK menampilkannya, karena app baru belum mencatat data tersebut
   (lihat gap 2 dan 6 pada `gap-app-lama.md`).

---

## Requirement 14: Monitoring Work Order

**User story:** Sebagai supervisor, saya ingin memantau pekerjaan servis yang
sedang berjalan dan yang tertunda, supaya saya tahu mana yang perlu didorong.

**Catatan:** Laporan ini berbasis `AssetService`.

### Acceptance Criteria

1. WHEN laporan dimuat THEN sistem SHALL menampilkan satu baris per
   `AssetService`.
2. WHEN laporan dimuat THEN sistem SHALL menyediakan filter rentang tanggal,
   status, jenis servis, dan aset.
3. WHEN laporan dimuat THEN sistem SHALL menampilkan kolom: kode, aset, jenis,
   status, tanggal kerusakan, tanggal mulai, tanggal selesai, dan lama
   pengerjaan.
4. WHEN lama pengerjaan dihitung THEN sistem SHALL mengambil selisih antara
   tanggal mulai dan tanggal selesai.
5. IF pekerjaan belum selesai THEN sistem SHALL menghitung lama pengerjaan dari
   tanggal mulai sampai hari ini dan menandainya sebagai masih berjalan.
6. WHEN laporan dimuat THEN sistem SHALL menampilkan KPI: total pekerjaan,
   pekerjaan selesai, pekerjaan berjalan, dan rata-rata lama pengerjaan.

---

## Requirement 15: Laporan Pemakaian Sparepart

**User story:** Sebagai staf gudang, saya ingin tahu sparepart apa saja yang
terpakai dalam pekerjaan servis beserta nilainya.

**Catatan:** Sumber data adalah `AssetServiceConsumedItem`.

### Acceptance Criteria

1. WHEN laporan dimuat THEN sistem SHALL menampilkan satu baris per item yang
   dikonsumsi pada sebuah `AssetService`.
2. WHEN laporan dimuat THEN sistem SHALL menyediakan filter rentang tanggal,
   item, dan aset.
3. WHEN laporan dimuat THEN sistem SHALL menampilkan kolom: tanggal, kode
   pekerjaan, aset, kode item, nama item, kuantitas, satuan, harga satuan, dan
   nilai total.
4. WHEN laporan dimuat THEN sistem SHALL menampilkan KPI: total jenis item, total
   kuantitas, dan total nilai sparepart terpakai.
5. WHEN kode pekerjaan ditampilkan THEN sistem SHALL menjadikannya tautan ke
   dokumen `AssetService`.

---

## Requirement 16: Laporan Anggota Tim

**User story:** Sebagai supervisor, saya ingin tahu siapa mengerjakan apa, supaya
saya bisa menilai beban kerja tiap anggota tim.

**Catatan:** Sumber data adalah `AssetServiceActivity`, yang mencatat PIC per
aktivitas. Satu pekerjaan bisa punya beberapa aktivitas dengan PIC berbeda.

### Acceptance Criteria

1. WHEN laporan dimuat THEN sistem SHALL menampilkan satu baris per aktivitas
   servis.
2. WHEN laporan dimuat THEN sistem SHALL menyediakan filter rentang tanggal, PIC,
   dan status aktivitas.
3. WHEN laporan dimuat THEN sistem SHALL menampilkan kolom: tanggal aktivitas,
   PIC, kode pekerjaan, aset, status, dan keterangan.
4. WHEN laporan dimuat THEN sistem SHALL menampilkan KPI: total aktivitas, jumlah
   PIC terlibat, dan jumlah pekerjaan tersentuh.
5. IF sebuah aktivitas tidak memiliki PIC THEN sistem SHALL menampilkannya dengan
   penanda "tanpa PIC", BUKAN menyembunyikan baris tersebut.
6. WHERE app lama mengelompokkan laporan per anggota tim THEN sistem SHALL
   memungkinkan pengelompokan per PIC melalui fitur grouping yang sudah ada pada
   `DataTableScope`.

---

## Requirement 17: Navigasi dan menu

**User story:** Sebagai pengguna, saya ingin menemukan laporan dari menu
navigasi, sama seperti modul lain.

### Acceptance Criteria

1. WHEN menu aplikasi dirender THEN sistem SHALL menampilkan grup menu "Laporan"
   berisi laporan yang boleh diakses pengguna.
2. WHEN pengguna membuka sebuah laporan THEN sistem SHALL menampilkan breadcrumb
   yang mencantumkan grup Laporan dan nama laporan tersebut.
3. WHEN menu laporan dibuat THEN sistem SHALL mendaftarkannya melalui mekanisme
   `DeskSeeder` yang sudah ada.
4. IF pengguna tidak berizin mengakses satu pun laporan THEN sistem SHALL TIDAK
   menampilkan grup menu Laporan sama sekali.
