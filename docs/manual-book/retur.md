# Retur

Bagian ini menjelaskan cara mencatat pengembalian barang — baik barang
yang dikembalikan pelanggan ke kamu, maupun barang yang kamu kembalikan
ke pemasok. Sebaiknya kamu sudah familiar dengan panduan **Penjualan**
dan **Pembelian** terlebih dahulu sebelum membaca bagian ini.

## Konsep Dasar

Retur **bukan jenis dokumen baru** — kamu tetap memakai dokumen yang
sama seperti biasa (surat jalan, tagihan), hanya saja ditandai sebagai
"pengembalian dari" dokumen aslinya. Ada dua hal yang perlu dipisahkan:

| | Pergerakan barang fisik | Koreksi tagihan/uang |
|---|---|---|
| **Sisi Penjualan** | Sales Return — barang kembali masuk gudang | Credit Note — tagihan ke pelanggan dikurangi |
| **Sisi Pembelian** | Purchase Return — barang keluar lagi ke pemasok | Debit Note — tagihan dari pemasok dikurangi |

Kedua sisi ini **terpisah** — kamu bisa membuat retur barang tanpa retur
tagihan, atau sebaliknya, tergantung situasinya. Misalnya kalau barangnya
belum sempat ditagih, kamu cukup buat retur barangnya saja tanpa perlu
Credit Note.

> 💡 Kalau dokumen retur perlu dibatalkan, efeknya ke stok dan pembukuan
> otomatis dibalikkan lagi — kamu tidak perlu mengoreksinya manual.

## 1. Mengembalikan Barang dari Pelanggan (Sales Return)

Dipakai kalau pelanggan mengembalikan barang yang sudah kamu kirim.

1. Buka surat jalan (Delivery Note) **asli** yang barangnya mau
   dikembalikan, lalu klik aksi **Retur**. Sistem otomatis membuat
   dokumen baru yang menunjuk balik ke surat jalan aslinya.
2. Isi jumlah barang yang dikembalikan per baris, dan pilih gudang tujuan
   penyimpanan barang retur ini.
3. Klik **Save**, lalu **Submit**.

Setelah disubmit, stok barang otomatis masuk kembali ke gudang, jumlah
"dikembalikan" pada surat jalan aslinya bertambah, dan status pesanan
penjualan terkait ikut diperbarui.

> Ini hanya mengurus pergerakan barangnya. Kalau tagihan pelanggan juga
> perlu dikoreksi, lanjutkan dengan membuat Credit Note (lihat bagian
> berikutnya).

## 2. Mengoreksi Tagihan ke Pelanggan (Credit Note)

Dipakai untuk mengurangi tagihan yang sudah dibuat ke pelanggan —
misalnya karena ada barang yang dikembalikan atau ada kesalahan jumlah
tagih.

1. Buka tagihan (Sales Invoice) **asli** yang mau dikoreksi, lalu klik
   aksi **Retur**. Sistem otomatis membuat tagihan baru yang menunjuk
   balik ke tagihan aslinya — inilah yang disebut Credit Note.
2. Isi baris dengan jumlah yang dikoreksi.
3. Klik **Save**, lalu **Submit**.

Setelah disubmit, jumlah yang ditagih pada pesanan penjualan terkait
berkurang, piutang ke pelanggan itu ikut berkurang di pembukuan, dan
status tagihan aslinya diperbarui (jadi Lunas atau Sebagian Lunas sesuai
sisa yang berlaku).

## 3. Mengembalikan Barang ke Pemasok (Purchase Return)

Dipakai kalau kamu perlu mengembalikan barang yang sudah diterima dari
pemasok.

1. Buka penerimaan barang (Purchase Receipt) **asli** yang mau
   dikembalikan, lalu klik aksi **Retur**. Sistem otomatis membuat
   dokumen baru yang menunjuk balik ke penerimaan aslinya.

   ![Tombol buat retur di Purchase Receipt](/images/manual-book/retur/01-purchase-receipt-tombol-buat-retur.jpg)
2. Isi jumlah barang yang dikembalikan per baris, dan pilih dari gudang
   mana barangnya diambil untuk dikembalikan.

   ![Form Purchase Return terisi otomatis](/images/manual-book/retur/02-purchase-return-form-terisi-otomatis.jpg)
3. Klik **Save**, lalu **Submit**.

Setelah disubmit, stok barang otomatis keluar dari gudang, jumlah
"dikembalikan" pada penerimaan aslinya bertambah, dan status pesanan
pembelian terkait ikut diperbarui.

> Ini hanya mengurus pergerakan barangnya. Kalau tagihan dari pemasok
> juga perlu dikoreksi, lanjutkan dengan membuat Debit Note (lihat bagian
> berikutnya).

## 4. Mengoreksi Tagihan dari Pemasok (Debit Note)

Dipakai untuk mengurangi tagihan yang diterima dari pemasok — misalnya
karena ada barang yang dikembalikan atau ada kesalahan jumlah tagih.

1. Buka tagihan (Purchase Invoice) **asli** yang mau dikoreksi, lalu klik
   aksi **Retur**. Sistem otomatis membuat tagihan baru yang menunjuk
   balik ke tagihan aslinya — inilah yang disebut Debit Note.
2. Isi baris dengan jumlah yang dikoreksi.
3. Klik **Save**, lalu **Submit**.

Setelah disubmit, jumlah yang ditagihkan pada pesanan pembelian terkait
disesuaikan, dan hutang ke pemasok itu ikut berkurang di pembukuan.

## Pertanyaan Umum

**Apakah saya wajib membuat retur barang dan retur tagihan sekaligus?**
Tidak. Keduanya independen. Kalau barang dikembalikan tapi belum pernah
ditagih, kamu cukup buat retur barangnya saja. Kalau yang perlu dikoreksi
hanya nilai tagihannya (misalnya salah hitung), kamu bisa langsung buat
Credit Note/Debit Note tanpa retur barang fisik.

**Kenapa saya tidak menemukan menu "Retur" terpisah?**
Karena retur bukan menu tersendiri — kamu membuatnya lewat tombol
**Retur** yang ada di halaman detail dokumen aslinya (surat jalan,
penerimaan barang, atau tagihan yang mau dikoreksi).

**Bagaimana kalau saya salah membuat dokumen retur?**
Kalau dokumen retur itu perlu dibatalkan, gunakan tombol **Cancel** —
seluruh efeknya ke stok dan pembukuan akan otomatis dikembalikan seperti
sebelum retur itu dibuat.
