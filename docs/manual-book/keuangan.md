# Keuangan

Bagian ini menjelaskan cara kerja pembukuan, tagihan, dan pembayaran di
aplikasi. Kalau kamu bertugas di bagian keuangan/akunting, panduan ini
untuk kamu.

## Istilah yang Perlu Kamu Tahu

- **Buku Besar** — catatan pembukuan yang dibuat **otomatis** oleh sistem
  setiap kali dokumen keuangan disubmit. Kamu tidak pernah mengisinya
  secara manual.
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

Semua tagihan dan pembayaran yang disubmit otomatis tercatat ke Buku Besar
— kamu tidak perlu (dan tidak bisa) menginput jurnal akuntansi secara
manual.

## Membuat Tagihan ke Pelanggan (Sales Invoice)

Tagihan ke pelanggan biasanya dibuat dari sebuah pesanan penjualan (Sales
Order) — lihat panduan **Penjualan** untuk alur lengkapnya, mulai dari
pesanan sampai pembayaran diterima.

Begitu Sales Invoice di-submit:
- Piutang ke pelanggan bertambah, dan pendapatan penjualan tercatat di
  Buku Besar.
- Jumlah "sudah ditagih" pada pesanan aslinya ikut diperbarui.

### Bagaimana Pajak Dihitung

Setiap baris tagihan boleh diisi tarif pajak (misalnya PPN 11%) atau
dikosongkan kalau memang tidak kena pajak. Kalau diisi, sistem otomatis
menghitung:

1. **Dasar Pengenaan Pajak (DPP)** — dihitung otomatis dari nilai baris
   sebelum pajak, mengikuti aturan PPN yang berlaku di Indonesia.
2. **Nilai pajak** — dihitung otomatis dari DPP dikalikan tarif pajak yang
   kamu pilih.

Kamu tidak perlu (dan tidak bisa) mengisi kedua nilai ini secara manual —
cukup isi nilai baris dan pilih tarif pajaknya, sisanya dihitung otomatis
oleh sistem. Kalau tidak ada pajak dipilih, kedua nilai ini otomatis
menjadi nol dan tagihan tetap bisa dibuat seperti biasa.

## Mencatat Tagihan dari Pemasok (Purchase Invoice)

Tagihan dari pemasok biasanya dibuat dari sebuah pesanan pembelian
(Purchase Order) — lihat panduan **Pembelian** untuk alur lengkapnya.
Cara menghitung pajaknya sama persis dengan Sales Invoice di atas.

Begitu Purchase Invoice di-submit, hutang ke pemasok bertambah dan
tercatat di Buku Besar, sementara jumlah "sudah ditagih" pada pesanan
aslinya ikut diperbarui.

## Menerima atau Melakukan Pembayaran (Payment Entry)

Buka menu **Finances → Payment Entries → Tambah**.

1. Pilih tipe pembayaran:
   - **Terima** — untuk uang yang masuk dari pelanggan.
   - **Bayar** — untuk uang yang keluar ke pemasok.
2. Pilih tagihan mana yang dibayar, dan pastikan pihak (pelanggan/pemasok)
   sudah benar.
3. Isi jumlah pembayaran dan metode pembayarannya (transfer, tunai, dll.).
4. Klik **Submit**.

Setelah disubmit, saldo kas/bank perusahaan ikut berubah, dan sisa
tagihan (piutang/hutang) berkurang sesuai jumlah yang dibayarkan. Kalau
pembayaran melunasi seluruh tagihan, statusnya berubah jadi "Lunas". Kalau
baru sebagian, sisanya tetap tercatat sebagai belum dibayar.

> 💡 **Kalau ada beberapa jadwal pembayaran (cicilan)**: pembayaran yang
> masuk otomatis dialokasikan ke jadwal yang jatuh temponya **paling
> dekat** terlebih dahulu, sampai jadwal itu lunas, baru lanjut ke jadwal
> berikutnya. Kamu tidak perlu memilih jadwal mana yang dibayar secara
> manual.

## Mengatur Jadwal & Metode Pembayaran

- **Metode Pembayaran** (menu **Finances → Payment Methods**) — daftar
  cara pembayaran yang dipakai (transfer, tunai, kartu, dll.), masing-
  masing dengan akun kas/bank tujuannya sendiri.

  ![Daftar Payment Method kosong](/images/manual-book/finances/02-payment-methods-list-kosong.jpg)
- **Template Termin Pembayaran** — pola cicilan yang bisa dipakai berulang
  untuk pelanggan/pemasok tertentu, misalnya "Net 30" (jatuh tempo 30 hari
  setelah tanggal invoice) atau "50% di muka, 50% pelunasan". Saat sebuah
  tagihan memakai template ini, jadwal pembayarannya otomatis terbentuk
  mengikuti pola yang sudah diatur.

  ![Daftar Payment Term Template kosong](/images/manual-book/finances/05-payment-term-templates-list-kosong.jpg)

## Mengatur Bagan Akun (Chart of Accounts)

Sebelum transaksi keuangan bisa dicatat, pastikan daftar akun perusahaan
sudah disiapkan. Buka menu **Finances → Accounts → Tambah** untuk
menambahkan akun baru — akun bisa disusun bertingkat (akun induk dengan
sub-akun di dalamnya) untuk struktur pembukuan yang lebih rapi.

![Daftar Chart of Accounts](/images/manual-book/finances/01-chart-of-accounts-list.jpg)

## Mengatur Tarif Pajak

Buka menu **Finances → Taxes → Tambah** untuk mendaftarkan tarif pajak
yang berlaku (misalnya PPN 11%, PPh 23%). Tarif yang terdaftar di sini
akan muncul sebagai pilihan di setiap baris tagihan penjualan maupun
pembelian.

![Daftar Tax / Pajak](/images/manual-book/finances/03-taxes-pajak-list.jpg)

## Melihat Buku Besar

Buku Besar (menu **Finances → General Ledger**) menampilkan seluruh
riwayat pencatatan keuangan yang dibuat otomatis dari dokumen-dokumen yang
sudah disubmit. Halaman ini hanya untuk dilihat — tidak ada input manual
di sana, karena tiap baris di Buku Besar selalu berasal dari satu dokumen
sumber (tagihan atau pembayaran) yang sudah disetujui.

![General Ledger / Buku Besar Umum](/images/manual-book/finances/04-general-ledger-buku-besar-umum.jpg)

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
