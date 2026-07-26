# Inventory & Gudang

Bagian ini menjelaskan cara mengelola data barang (produk), gudang, dan
stoknya — mulai dari mendaftarkan produk baru sampai memantau berapa
stoknya di tiap gudang. Kalau kamu bertugas mengurus data produk atau
stok gudang, panduan ini untuk kamu.

## Istilah yang Perlu Kamu Tahu

- **Item** — produk induk, mis. "Kaos Polos".
- **Variant** — versi konkret dari suatu Item yang benar-benar disimpan
  stoknya, mis. "Kaos Polos - Merah, Size L". Satu Item bisa punya banyak
  Variant.
- **Delivery Note (DN)** — surat jalan pengiriman barang ke pelanggan.
- **Stock Entry** — dokumen untuk mencatat pergerakan stok yang bukan dari
  penjualan/pembelian biasa (transfer antar gudang, penyesuaian stok, dll).
- **Kartu Stok** — riwayat lengkap dan permanen semua perubahan stok suatu
  barang, dari waktu ke waktu.

## Konsep Penting: Item vs Variant

Setiap kali kamu membuat transaksi (pesanan penjualan, pesanan pembelian,
pengiriman, dll.), kamu **tidak memilih Item secara langsung** — kamu
memilih **Variant**-nya. Ini karena stok, kode SKU, dan barcode itu
menempel ke Variant, bukan ke Item induknya.

```mermaid
flowchart LR
    Item(["📦 Item<br/>Kaos Polos"]) --> V1["🏷️ Variant<br/>Merah, Size M"]
    Item --> V2["🏷️ Variant<br/>Biru, Size L"]
    V1 --> S1[("📊 Stok Gudang A")]
    V2 --> S2[("📊 Stok Gudang B")]

    style Item fill:#3b82f6,stroke:#1d4ed8,color:#fff
    style V1 fill:#fef3c7,stroke:#d97706
    style V2 fill:#fef3c7,stroke:#d97706
```

Contoh: "Kaos Polos" adalah satu Item, tapi kalau tersedia dalam 3 warna
dan 2 ukuran, itu artinya ada sampai 6 Variant berbeda di bawahnya —
masing-masing punya stoknya sendiri per gudang.

## Langkah 1 — Mendaftarkan Produk Baru (Item)

Buka menu **Inventory → Items → Tambah**.

1. Isi kode dan nama produk, pilih kategorinya, dan tentukan satuan dasar
   (misalnya pcs, kg, atau box).
2. Aktifkan opsi **Pantau Stok** kalau stok produk ini perlu dilacak
   sistem (untuk barang fisik yang dijual/dibeli). Nonaktifkan kalau ini
   produk jasa yang tidak punya stok.
3. Klik **Save**.

### Menambah Satuan Lain (opsional)

Kalau produk kamu dijual dalam beberapa satuan berbeda (misalnya bisa
dijual per pcs atau per box isi 12), buka tab **Units** di form produk dan
tambahkan satuan tambahan beserta faktor konversinya (mis. 1 Box = 12
Pcs). Sistem akan otomatis mengonversi jumlahnya kapan pun satuan yang
berbeda dipakai dalam transaksi.

## Langkah 2 — Membuat Variant

Masih di halaman yang sama, buka tab **Variant**.

1. Kombinasikan atribut produk yang membedakan tiap variasi — misalnya
   Warna (Merah, Biru) dan Ukuran (M, L). Sistem otomatis membuatkan satu
   Variant untuk setiap kombinasi (dalam contoh ini, otomatis jadi 4
   Variant).
2. Setiap Variant yang terbentuk punya kode (SKU), stok, dan barcode
   sendiri-sendiri — terpisah satu sama lain meski berasal dari produk
   induk yang sama.

### Menambahkan Barcode (opsional)

Buka tab **Barcodes** untuk mendaftarkan barcode per Variant dan per
satuan — berguna untuk mempercepat pencarian barang saat input transaksi
(misalnya lewat pemindai barcode).

## Langkah 3 — Mengisi Stok Awal

Stok **tidak diisi langsung** di form produk. Untuk mencatat stok awal,
kamu perlu membuat dokumen **Stock Entry** bertipe penerimaan:

Buka menu **Inventory → Stock Entries → Tambah**, pilih tipe "Terima",
lalu isi Variant dan jumlah barang yang mau dicatat sebagai stok awal.

Setelah dokumen ini di-submit, Variant tersebut siap dipilih sebagai
pilihan barang di transaksi penjualan maupun pembelian.

## Mendaftarkan Gudang

Sebelum bisa mencatat stok, pastikan gudangnya sudah terdaftar. Buka menu
**Inventory → Warehouses → Tambah**, isi nama gudang dan tentukan siapa
yang bertanggung jawab atasnya.

## Memindahkan Barang Antar Gudang atau Menyesuaikan Stok

Selain dari pembelian dan penjualan, stok juga bisa berubah lewat
**Stock Entry** untuk kebutuhan lain:

- **Transfer** — memindahkan barang dari satu gudang ke gudang lain.
- **Penyesuaian (stock opname)** — mengoreksi jumlah stok di sistem supaya
  sesuai dengan hasil hitung fisik di gudang.
- **Pengeluaran** — mengeluarkan barang untuk kebutuhan internal di luar
  penjualan.

Buka menu **Inventory → Stock Entries → Tambah**, pilih tipe yang sesuai
kebutuhan, isi barang dan jumlahnya, lalu klik **Submit**. Kalau ini
transfer antar gudang, stok otomatis berkurang di gudang asal dan
bertambah di gudang tujuan begitu disubmit.

> 💡 Kalau dokumen Stock Entry-nya ditolak atau dibatalkan, semua
> perubahan stok yang sudah sempat terjadi akan otomatis dikembalikan —
> kamu tidak perlu membenarkannya secara manual.

## Bagaimana Barang Dikirim ke Pelanggan (Delivery Note)

Pengiriman barang ke pelanggan dicatat lewat **Delivery Note**, yang
biasanya dibuat dari sebuah pesanan penjualan (Sales Order) — lihat
panduan **Penjualan** untuk alur lengkapnya. Begitu Delivery Note
disubmit, stok otomatis berkurang dari gudang asal.

## Melihat Riwayat Pergerakan Stok (Kartu Stok)

Setiap kali stok berubah — baik dari pembelian, penjualan, maupun
transfer/penyesuaian — perubahannya otomatis tercatat di **Kartu Stok**.
Ini adalah riwayat permanen yang tidak bisa diubah atau dihapus, jadi kamu
selalu bisa menelusuri kembali dari mana asal setiap perubahan stok suatu
barang.

Halaman Kartu Stok hanya untuk dilihat — tidak ada input manual di sana,
karena semua catatannya dibuat otomatis oleh sistem setiap kali dokumen
terkait disubmit.

> 💡 **Bagaimana harga pokok dihitung?** Sistem memakai metode
> "masuk pertama, keluar pertama" — artinya stok yang masuk lebih dulu
> dianggap sebagai stok yang dipakai/dijual lebih dulu. Ini menentukan
> berapa nilai harga pokok yang tercatat setiap kali barang keluar.

## Mengatur Kategori, Satuan, dan Atribut

Sebelum mendaftarkan produk, ada beberapa data pendukung yang biasanya
disiapkan lebih dulu:

- **Kategori** (menu **Inventory → Categories**) — untuk mengelompokkan
  produk, bisa disusun bertingkat (kategori besar dengan sub-kategori di
  dalamnya).
- **Satuan** (menu **Inventory → Units**) — satuan pengukuran seperti pcs,
  kg, box. Satuan yang bisa saling dikonversi (misalnya Kg, Gram, Ton)
  bisa dikelompokkan dalam satu grup supaya konversinya otomatis.
- **Atribut** (menu **Inventory → Attributes**) — atribut pembeda Variant
  seperti warna atau ukuran, yang nanti dipakai saat membuat kombinasi
  Variant di Langkah 2.

## Kalau Ada Barang yang Dikembalikan

Kalau barang yang sudah dikirim ke pelanggan dikembalikan, atau barang
yang sudah diterima dari pemasok perlu dikembalikan, penjelasan lengkapnya
ada di panduan **Retur**.

## Pertanyaan Umum

**Kenapa saya tidak bisa memilih produk saat membuat pesanan, hanya
variannya saja?**
Karena stok dan kode barang menempel ke Variant, bukan ke Item induknya.
Kalau produk kamu belum punya Variant sama sekali, buat dulu minimal satu
Variant di tab Variant sebelum bisa dipakai dalam transaksi.

**Kenapa stok awal tidak bisa langsung diisi di form produk?**
Supaya semua perubahan stok — termasuk stok awal — tetap tercatat lewat
satu jalur yang sama (Stock Entry) dan bisa ditelusuri riwayatnya lewat
Kartu Stok. Ini menjaga supaya angka stok selalu bisa dipertanggungjawabkan
asal-usulnya.

**Bagaimana cara memantau stok yang tersisa di suatu gudang?**
Buka halaman detail Variant yang ingin dicek — di sana ada tab yang
menampilkan posisi stok terkini per gudang.
