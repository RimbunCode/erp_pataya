# Pembelian

Bagian ini menjelaskan cara mencatat pembelian barang dari pemasok — mulai
dari mengajukan permintaan, memesan, menerima barang, sampai membayar
tagihannya. Kalau kamu bertugas sebagai bagian pembelian (purchasing),
admin gudang, atau keuangan yang menangani pembayaran ke pemasok, panduan
ini untuk kamu.

## Istilah yang Perlu Kamu Tahu

- **Purchase Request (PR)** — permintaan pembelian dari internal
  perusahaan, sebelum benar-benar memesan ke pemasok. Sifatnya opsional.
- **Purchase Order (PO)** — surat pesanan resmi yang dikirim ke pemasok.
- **Purchase Receipt (GR)** — bukti penerimaan barang dari pemasok.
- **Purchase Invoice (PI)** — tagihan yang diterima dari pemasok.
- **Payment Entry** — catatan pembayaran yang dikirim ke pemasok.

## Alur Besarnya Seperti Apa?

Satu proses pembelian biasanya melewati tahap-tahap ini:

```mermaid
flowchart LR
    PR(["📝 1. Ajukan permintaan"]) --> PO["📋 2. Pesan ke pemasok"] --> GR["📦 3. Barang diterima"] --> PI["🧾 4. Tagihan dicatat"] --> PE(["💸 5. Bayar pemasok"])

    style PR fill:#dcfce7,stroke:#16a34a
    style PE fill:#22c55e,stroke:#15803d,color:#fff
```

Langkah pertama (mengajukan permintaan) sifatnya opsional — kamu boleh
langsung membuat pesanan resmi tanpa mengajukan permintaan dulu, kalau
memang tidak diperlukan proses persetujuan kebutuhan/anggaran di
perusahaanmu.

Sama seperti alur penjualan, **menerima barang** dan **mencatat tagihan**
adalah dua hal terpisah yang boleh dilakukan dalam urutan bebas — terima
barang dulu baru dapat tagihan (paling umum), atau tagihan datang dulu
sebelum barang tiba (misalnya kamu bayar di muka).

## Langkah 1 — Mengajukan Permintaan Pembelian (opsional)

Kalau perusahaan kamu perlu persetujuan kebutuhan sebelum memesan barang,
buka menu **Purchase → Purchase Requests → Tambah**, isi barang apa saja
yang dibutuhkan dan kapan dibutuhkannya, lalu klik **Submit**. Setelah
disetujui, statusnya berubah jadi siap dipesan.

Kalau perusahaan kamu tidak memerlukan langkah ini, langsung saja lanjut ke
Langkah 2.

## Langkah 2 — Membuat Pesanan Pembelian (Purchase Order)

Buka menu **Purchase → Purchase Orders → Tambah**.

1. Pilih pemasok tujuan pemesanan.
2. Tambahkan barang yang mau dipesan satu per satu: jenis/varian barang,
   jumlah, satuan, harga, pajak (kalau ada), dan gudang tujuan
   penyimpanannya. Kalau pesanan ini berasal dari permintaan yang sudah
   dibuat di Langkah 1, kamu bisa klik tombol **"Sync dari PR"** supaya
   barisnya terisi otomatis — tidak perlu input ulang manual.
3. Klik **Submit**. Setelah itu, nomor dokumen resmi dibuat otomatis dan
   sistem mengecek apakah perlu persetujuan atasan dulu. Kalau tidak ada
   alur persetujuan, pesanan langsung siap diproses (siap diterima & siap
   ditagih).

> 💡 Kalau pemasok ternyata tidak bisa memenuhi seluruh pesanan, kamu bisa
> menutup pesanan itu secara manual lewat tombol **"Tandai Selesai"** —
> tidak perlu menunggu semua barang diterima penuh.

## Langkah 3 — Menerima Barang (Purchase Receipt)

Setelah pesanan siap diproses dan barang tiba dari pemasok, catat
penerimaannya.

1. Buka menu **Purchase → Purchase Receipts → Tambah**, pilih pesanan
   (Purchase Order) yang barangnya diterima.
2. Klik **Submit**. Setelah itu:
   - Stok barang otomatis bertambah di gudang tujuan.
   - Jumlah "sudah diterima" pada pesanan aslinya bertambah. Kalau seluruh
     barang di pesanan sudah diterima, statusnya berubah jadi "Diterima".
     Kalau baru sebagian, statusnya "Sebagian Diterima".

Satu pesanan boleh diterima bertahap lewat beberapa kali penerimaan,
misalnya kalau pemasok mengirim barangnya secara bertahap.

## Langkah 4 — Mencatat Tagihan dari Pemasok (Purchase Invoice)

1. Buka menu **Finances → Purchase Invoices → Tambah**, pilih pesanan
   (Purchase Order) yang ditagihkan.
2. Klik **Submit**. Setelah itu, tagihan dari pemasok resmi tercatat
   sebagai hutang perusahaan, dan jumlah "sudah ditagih" pada pesanan
   aslinya ikut bertambah.

## Langkah 5 — Membayar Pemasok (Payment Entry)

1. Buka menu **Finances → Payment Entries → Tambah**, pilih tipe
   **"Bayar"** (karena ini uang keluar ke pemasok).
2. Pilih tagihan (Purchase Invoice) mana yang dibayar, dan pastikan
   pemasoknya benar sebagai penerima.
3. Klik **Submit**. Setelah itu, saldo kas/bank perusahaan berkurang dan
   hutang ke pemasok itu ikut berkurang. Kalau pembayarannya melunasi
   seluruh tagihan, statusnya berubah jadi "Lunas".

> 💡 Sama seperti pembayaran dari pelanggan, kalau ada beberapa tagihan
> dengan jatuh tempo berbeda, pembayaran akan otomatis dialokasikan ke
> tagihan yang jatuh temponya paling dekat lebih dulu.

## Langkah 6 — Pesanan Selesai

Begitu seluruh barang di satu pesanan sudah diterima **dan** seluruh
tagihannya sudah dicatat dan lunas, status pesanan otomatis berubah
menjadi **Selesai**.

## Contoh: Bayar di Muka Dulu, Baru Barang Diterima

Kalau kamu perlu membayar pemasok lebih dulu sebelum barang dikirim,
urutannya boleh dibalik:

```mermaid
flowchart LR
    PO(["📋 Pesanan disetujui"]) --> PI["🧾 Tagihan dicatat & dibayar"] --> GR["📦 Barang diterima"]
```

1. Buat pesanan seperti biasa (Langkah 2) sampai disetujui.
2. Catat tagihannya lebih dulu (Langkah 4), sebelum barang tiba.
3. Bayar pemasoknya (Langkah 5).
4. Setelah barang benar-benar tiba, baru catat penerimaannya (Langkah 3).

Hasil akhirnya sama saja — begitu keduanya (terima & tagih) tuntas, pesanan
berstatus Selesai.

## Membatalkan Dokumen

Kalau ada dokumen yang perlu dibatalkan (permintaan, pesanan, penerimaan
barang, atau tagihan), gunakan tombol **Cancel** pada dokumen tersebut.
Semua efeknya otomatis dibalikkan — stok yang tadinya bertambah akan
dikurangi lagi, dan catatan hutang di pembukuan ikut dikoreksi.

## Mencatat Data Pemasok

Sebelum membuat pesanan, pastikan data pemasoknya sudah ada. Buka menu
**Purchase → Suppliers → Tambah** untuk mendaftarkan pemasok baru — isi
nama, kontak, rekening bank untuk pembayaran, dan alamatnya.

## Kalau Ada Barang yang Dikembalikan ke Pemasok

Kalau barang yang sudah diterima perlu dikembalikan ke pemasok, atau
tagihannya perlu dikoreksi, kamu tidak membuat dokumen jenis baru — cukup
buat penerimaan barang atau tagihan seperti biasa, tapi tandai bahwa
dokumen itu adalah **retur** dari dokumen aslinya. Penjelasan lengkapnya
ada di panduan **Retur**.

## Pertanyaan Umum

**Apakah saya wajib membuat Purchase Request sebelum memesan?**
Tidak wajib. Purchase Request hanya diperlukan kalau perusahaan kamu
memang menerapkan alur persetujuan kebutuhan sebelum barang dipesan. Kamu
tetap bisa langsung membuat Purchase Order tanpa permintaan sebelumnya.

**Bolehkah satu pesanan diterima beberapa kali secara bertahap?**
Boleh. Kamu bisa mencatat beberapa kali penerimaan untuk satu pesanan yang
sama sampai seluruh jumlah barangnya diterima.

**Kenapa ada tombol "Tandai Selesai" di pesanan?**
Untuk menutup pesanan secara manual kalau pemasok ternyata tidak bisa
mengirim seluruh barang yang dipesan — supaya pesanan tidak menggantung
selamanya menunggu sisa barang yang tidak akan pernah datang.
