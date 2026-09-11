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
   dikembalikan, lalu klik tombol **Buat Sales Return**. Sistem otomatis
   membuat dokumen baru dengan pilihan **Apakah Retur (Sales Return)**
   yang sudah tercentang dan menunjuk balik ke surat jalan aslinya.
2. Isi jumlah barang yang dikembalikan per baris, dan pilih gudang tujuan
   penyimpanan barang retur ini.
3. Klik **Simpan**, lalu **Ajukan**.

> 💡 Kamu juga bisa mulai dari menu **Inventory → Delivery Notes →
> Delivery Note Baru**, lalu centang sendiri **Apakah Retur (Sales
> Return)** dan pilih surat jalan asli di kolom "Retur Terhadap".

![Formulir Delivery Note dengan pilihan Apakah Retur (Sales Return)](/manual-book-images/penjualan/form-delivery-note.png)

Dokumen retur ini melewati **langkah persetujuan** yang sama seperti
surat jalan biasa — statusnya jadi **Butuh Persetujuan** sampai
disetujui. Begitu **disetujui**, stok barang otomatis masuk kembali ke
gudang, jumlah "dikembalikan" pada surat jalan aslinya bertambah, dan
status pesanan penjualan terkait ikut diperbarui.

> Ini hanya mengurus pergerakan barangnya. Kalau tagihan pelanggan juga
> perlu dikoreksi, lanjutkan dengan membuat Credit Note (lihat bagian
> berikutnya).

## 2. Mengoreksi Tagihan ke Pelanggan (Credit Note)

Dipakai untuk mengurangi tagihan yang sudah dibuat ke pelanggan —
misalnya karena ada barang yang dikembalikan atau ada kesalahan jumlah
tagih.

1. Buka tagihan (Sales Invoice) **asli** yang mau dikoreksi, lalu klik
   **Aksi → Buat Nota Kredit**. Sistem otomatis membuat tagihan baru
   dengan pilihan **Apakah Retur (Nota Kredit)** tercentang, field
   **Retur Terhadap Sales Invoice** terisi, dan **Akun Pendapatan**
   diganti ke akun *Retur Penjualan* — inilah yang disebut Credit Note.
2. Isi baris dengan jumlah yang dikoreksi.
3. Klik **Simpan**, lalu **Ajukan**.

![Formulir Nota Kredit dengan Retur Terhadap Sales Invoice dan akun Retur Penjualan](/manual-book-images/retur/form-nota-kredit.png)

Nota Kredit ini juga melewati **langkah persetujuan** sebelum berlaku.
Begitu **disetujui**, jumlah yang ditagih pada pesanan penjualan terkait
berkurang, piutang ke pelanggan itu ikut berkurang di pembukuan, dan
status tagihan aslinya diperbarui (jadi Lunas atau Sebagian Lunas sesuai
sisa yang berlaku).

## 3. Mengembalikan Barang ke Pemasok (Purchase Return)

Dipakai kalau kamu perlu mengembalikan barang yang sudah diterima dari
pemasok.

1. Buka penerimaan barang (Purchase Receipt) **asli** yang mau
   dikembalikan, lalu klik tombol **Buat Purchase Return**. Sistem
   otomatis membuat dokumen baru dengan pilihan **Apakah Retur (Purchase
   Return)** tercentang dan field **Retur Terhadap Purchase Receipt**
   terisi.
2. Isi jumlah barang yang dikembalikan per baris, dan pilih dari gudang
   mana barangnya diambil untuk dikembalikan.
3. Klik **Simpan**, lalu **Ajukan**.

![Daftar Purchase Receipts yang bisa di-retur](/manual-book-images/retur/list-purchase-receipts.png)

![Formulir Purchase Return: mencentang Apakah Retur memunculkan field Retur Terhadap Purchase Receipt](/manual-book-images/retur/form-purchase-return.png)

![Formulir Purchase Return terisi: pesanan, pemasok, dan barang otomatis dari penerimaan asli](/manual-book-images/retur/form-purchase-return-terisi.png)

Dokumen retur ini melewati **langkah persetujuan** yang sama seperti
penerimaan barang biasa — statusnya jadi **Butuh Persetujuan** sampai
disetujui. Begitu **disetujui**, stok barang otomatis keluar dari
gudang, jumlah "dikembalikan" pada penerimaan aslinya bertambah, dan
status pesanan pembelian terkait ikut diperbarui.

> Ini hanya mengurus pergerakan barangnya. Kalau tagihan dari pemasok
> juga perlu dikoreksi, lanjutkan dengan membuat Debit Note (lihat bagian
> berikutnya).

## 4. Mengoreksi Tagihan dari Pemasok (Debit Note)

Dipakai untuk mengurangi tagihan yang diterima dari pemasok — misalnya
karena ada barang yang dikembalikan atau ada kesalahan jumlah tagih.

1. Buka tagihan (Purchase Invoice) **asli** yang mau dikoreksi, lalu klik
   **Aksi → Buat Nota Debit**. Sistem otomatis membuat tagihan baru
   dengan pilihan **Apakah Retur (Nota Debit)** tercentang dan menunjuk
   balik ke tagihan aslinya — inilah yang disebut Debit Note.
2. Isi baris dengan jumlah yang dikoreksi.
3. Klik **Simpan**, lalu **Ajukan**.

Nota Debit ini juga melewati **langkah persetujuan** sebelum berlaku.
Begitu **disetujui**, jumlah yang ditagihkan pada pesanan pembelian
terkait disesuaikan, dan hutang ke pemasok itu ikut berkurang di
pembukuan.

## Pertanyaan Umum

**Apakah saya wajib membuat retur barang dan retur tagihan sekaligus?**
Tidak. Keduanya independen. Kalau barang dikembalikan tapi belum pernah
ditagih, kamu cukup buat retur barangnya saja. Kalau yang perlu dikoreksi
hanya nilai tagihannya (misalnya salah hitung), kamu bisa langsung buat
Credit Note/Debit Note tanpa retur barang fisik.

**Kenapa saya tidak menemukan menu "Retur" terpisah?**
Karena retur bukan menu tersendiri — kamu membuatnya lewat tombol **Buat
Sales Return** / **Buat Purchase Return** atau menu **Aksi → Buat Nota
Kredit** / **Buat Nota Debit** yang ada di halaman detail dokumen aslinya
(surat jalan, penerimaan barang, atau tagihan yang mau dikoreksi).
Alternatifnya, buat dokumen baru dari menu biasa lalu centang sendiri
pilihan **Apakah Retur (...)** di formulirnya.

**Bagaimana kalau saya salah membuat dokumen retur?**
Kalau dokumen retur itu perlu dibatalkan, gunakan tombol **Batal**
(Cancel) — seluruh efeknya ke stok dan pembukuan akan otomatis
dikembalikan seperti sebelum retur itu dibuat.
