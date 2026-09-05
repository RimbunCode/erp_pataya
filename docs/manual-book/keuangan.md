# Keuangan

Bagian ini menjelaskan cara kerja pembukuan, tagihan, dan pembayaran di
aplikasi. Kalau kamu bertugas di bagian keuangan/akunting, panduan ini
untuk kamu.

## Istilah yang Perlu Kamu Tahu

- **Buku Besar** — catatan pembukuan yang dibuat **otomatis** oleh sistem
  setiap kali dokumen keuangan **disetujui**. Kamu tidak pernah
  mengisinya secara manual.
- **Sales Invoice (SI)** — tagihan ke pelanggan.
- **Purchase Invoice (PI)** — tagihan dari pemasok.
- **Payment Entry** — catatan pembayaran, baik yang diterima dari
  pelanggan maupun yang dibayarkan ke pemasok.
- **Piutang** — uang yang masih harus diterima dari pelanggan.
- **Hutang** — uang yang masih harus dibayarkan ke pemasok.
- **Chart of Accounts (Bagan Akun)** — daftar akun keuangan perusahaan,
  misalnya "Kas", "Piutang Dagang", "Pendapatan Penjualan".

## Gambaran Umum: Dua Sisi yang Mirip

Sisi tagihan ke pelanggan (piutang) dan sisi tagihan dari pemasok (hutang)
bekerja dengan pola yang benar-benar sama — hanya arah uangnya yang
berbeda:

| | Sisi Penjualan (Piutang) | Sisi Pembelian (Hutang) |
|---|---|---|
| Tagihan dibuat | Sales Invoice | Purchase Invoice |
| Efeknya | Piutang **bertambah** | Hutang **bertambah** |
| Saat dibayar | Payment Entry (Terima) | Payment Entry (Bayar) |
| Efeknya | Kas bertambah, piutang **berkurang** | Kas berkurang, hutang **berkurang** |

Semua tagihan dan pembayaran, begitu **disetujui**, otomatis tercatat ke
Buku Besar — kamu tidak perlu (dan tidak bisa) menginput jurnal akuntansi
secara manual.

## Membuat Tagihan ke Pelanggan (Sales Invoice)

Tagihan ke pelanggan biasanya dibuat dari sebuah pesanan penjualan (Sales
Order) — buka detail Sales Order lalu klik **Aksi → Buat Sales Invoice**.
Lihat panduan **Penjualan** untuk alur lengkapnya, mulai dari pesanan
sampai pembayaran diterima.

![Formulir Sales Invoice Baru dengan Akun Pendapatan dan perhitungan pajak](/manual-book-images/keuangan/form-sales-invoice.png)

Klik **Simpan** untuk menyimpan sebagai draf, lalu **Ajukan** dari
halaman detail. Tagihan masuk ke **langkah persetujuan** dengan status
**Butuh Persetujuan** — belum ada catatan piutang yang dibuat. Begitu
Sales Invoice **disetujui** approver:
- Piutang ke pelanggan bertambah, dan pendapatan penjualan tercatat di
  Buku Besar.
- Jumlah "sudah ditagih" pada pesanan aslinya ikut diperbarui.

![Sales Invoice submitted berstatus Belum Dibayar](/manual-book-images/keuangan/sales-invoice-submitted.png)

### Bagaimana Pajak Dihitung

Setiap baris tagihan boleh diisi tarif pajak (misalnya PPN 11%) atau
dikosongkan kalau memang tidak kena pajak. Kalau diisi, sistem otomatis
menghitung:

1. **Dasar Pengenaan Pajak (DPP)** — dihitung otomatis dari nilai baris
   sebelum pajak, mengikuti aturan PPN yang berlaku di Indonesia (misalnya
   Jumlah Dasar Rp 40.000.000 menghasilkan DPP Rp 36.666.666,67).
2. **Nilai pajak** — dihitung otomatis dari DPP dikalikan tarif pajak yang
   kamu pilih.

Kamu tidak perlu (dan tidak bisa) mengisi kedua nilai ini secara manual —
cukup isi nilai baris dan pilih tarif pajaknya, sisanya dihitung otomatis
oleh sistem. Kalau tidak ada pajak dipilih, kedua nilai ini otomatis
menjadi nol dan tagihan tetap bisa dibuat seperti biasa.

![Sales Invoice draf dengan DPP terhitung otomatis](/manual-book-images/keuangan/sales-invoice-draft-dpp.png)

## Mencatat Tagihan dari Pemasok (Purchase Invoice)

Tagihan dari pemasok biasanya dibuat dari sebuah pesanan pembelian
(Purchase Order) — buka detail Purchase Order lalu klik **Aksi → Buat
Purchase Invoice**. Lihat panduan **Pembelian** untuk alur lengkapnya.
Cara menghitung pajaknya (DPP dan Jumlah Pajak) sama persis dengan Sales
Invoice di atas.

![Daftar Purchase Invoices dengan kolom DPP, PPN, PPnBM](/manual-book-images/keuangan/list-purchase-invoices.png)

![Formulir Purchase Invoice Baru dengan Akun Kepala Biaya dan Akun Kredit](/manual-book-images/keuangan/form-purchase-invoice.png)

Setelah diajukan, tagihan masuk ke **langkah persetujuan** dulu (status
**Butuh Persetujuan**). Begitu Purchase Invoice **disetujui**, hutang ke
pemasok bertambah dan tercatat di Buku Besar, sementara jumlah "sudah
ditagih" pada pesanan aslinya ikut diperbarui.

## Menerima atau Melakukan Pembayaran (Payment Entry)

Buka detail tagihan (Sales Invoice atau Purchase Invoice), klik **Aksi →
Buat Entri Pembayaran**. Daftar semua pembayaran ada di menu
**Finances → Payment Entries**.

![Daftar Pembayaran Masuk](/manual-book-images/keuangan/list-payment-entries.png)

1. Pilih tipe pembayaran:
   - **Terima** — untuk uang yang masuk dari pelanggan.
   - **Bayar** — untuk uang yang keluar ke pemasok.
2. Tagihan dan pihak (pelanggan/pemasok) terisi otomatis kalau kamu masuk
   lewat menu Aksi. Pastikan sudah benar.
3. Isi jumlah pembayaran, metode pembayarannya, dan akun kas/bank-nya.
4. Klik **Simpan**, lalu **Ajukan**.

![Formulir Pembayaran Masuk dengan tipe Terima dan jadwal jatuh tempo](/manual-book-images/keuangan/form-payment-masuk.png)

Setelah diajukan, entri pembayaran masuk ke **langkah persetujuan**
dengan status **Butuh Persetujuan** — saldo kas dan sisa tagihan belum
bergerak. Begitu **disetujui** approver, saldo kas/bank perusahaan ikut
berubah, dan sisa tagihan (piutang/hutang) berkurang sesuai jumlah yang
dibayarkan. Kalau pembayaran melunasi seluruh tagihan, statusnya berubah
jadi "Lunas". Kalau baru sebagian, sisanya tetap tercatat sebagai belum
dibayar.

> 💡 **Kalau ada beberapa jadwal pembayaran (cicilan)**: pembayaran yang
> masuk otomatis dialokasikan ke jadwal yang jatuh temponya **paling
> dekat** terlebih dahulu, sampai jadwal itu lunas, baru lanjut ke jadwal
> berikutnya. Kamu tidak perlu memilih jadwal mana yang dibayar secara
> manual.

## Mengatur Jadwal & Metode Pembayaran

- **Metode Pembayaran** (menu **Finances → Payment Methods**) — daftar
  cara pembayaran yang dipakai (transfer, tunai, kartu, dll.), masing-
  masing dengan **Akun Default** (akun kas/bank tujuannya) sendiri.

  ![Daftar Metode Pembayaran](/manual-book-images/keuangan/list-metode-pembayaran.png)

  ![Formulir Metode Pembayaran Baru](/manual-book-images/keuangan/form-metode-pembayaran.png)

- **Template Syarat Pembayaran** (menu **Finances → Payment Term
  Templates**) — pola cicilan yang bisa dipakai berulang untuk
  pelanggan/pemasok tertentu, misalnya "Net 30" (jatuh tempo 30 hari
  setelah tanggal invoice) atau "50% di muka, 50% pelunasan". Panel
  **Contoh** di formulir langsung mensimulasikan jadwal jatuh tempo dari
  total faktur contoh. Saat sebuah tagihan memakai template ini, jadwal
  pembayarannya otomatis terbentuk mengikuti pola yang sudah diatur.

  ![Formulir Template Syarat Pembayaran dengan panel Contoh simulasi](/manual-book-images/keuangan/form-template-termin.png)

## Mengatur Bagan Akun (Chart of Accounts)

Sebelum transaksi keuangan bisa dicatat, pastikan daftar akun perusahaan
sudah disiapkan. Buka menu **Finances → Accounts**, klik **Tambah Akun** —
akun bisa disusun bertingkat (akun induk dengan sub-akun di dalamnya)
untuk struktur pembukuan yang lebih rapi.

![Bagan Akun dengan struktur bertingkat](/manual-book-images/keuangan/chart-of-accounts.png)

## Mengatur Tarif Pajak

Buka menu **Finances → Taxes**, klik **Tambah Pajak** untuk mendaftarkan
tarif pajak yang berlaku (misalnya PPN 11%, PPh 10%). Tarif yang terdaftar
di sini akan muncul sebagai pilihan di setiap baris tagihan penjualan
maupun pembelian.

![Daftar Pajak: PPN 11% dan PPh 10%](/manual-book-images/keuangan/list-pajak.png)

## Melihat Buku Besar

Buku Besar (menu **Finances → General Ledgers**) menampilkan seluruh
riwayat pencatatan keuangan yang dibuat otomatis dari dokumen-dokumen yang
sudah **disetujui**. Halaman ini hanya untuk dilihat — tidak ada input
manual di sana, karena tiap baris di Buku Besar selalu berasal dari satu
dokumen sumber (tagihan atau pembayaran) yang sudah melewati langkah
persetujuan.

![Buku Besar Umum dengan kolom Akun, Akun Lawan, Debit, Kredit](/manual-book-images/keuangan/buku-besar.png)

## Pertanyaan Umum

**Kenapa saya tidak bisa mengisi nilai pajak secara manual?**
Karena nilainya dihitung otomatis oleh sistem berdasarkan aturan PPN yang
berlaku, supaya perhitungannya konsisten di semua dokumen dan tidak
rawan salah ketik.

**Kenapa pembayaran yang saya input tidak masuk ke jadwal yang saya
kira?**
Sistem selalu mengalokasikan pembayaran ke jadwal dengan jatuh tempo
paling dekat lebih dulu, bukan berdasarkan urutan input. Kalau ada
beberapa jadwal cicilan yang belum dibayar, cek dulu jadwal mana yang
paling dekat jatuh temponya.

**Bagaimana kalau tagihan yang saya buat salah?**
Kalau tagihannya belum disubmit, kamu masih bisa mengedit atau menghapus
draftnya. Kalau sudah disubmit, buat dokumen retur (Credit Note untuk
tagihan penjualan, Debit Note untuk tagihan pembelian) — lihat panduan
**Retur** untuk caranya.
