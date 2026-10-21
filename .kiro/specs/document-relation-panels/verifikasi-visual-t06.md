# Verifikasi Visual T06 — Panel Relasi di Purchase Order

Panduan ini untuk memeriksa tahap 1 (PurchaseOrder) di browser.

Jalankan setelah subagent menyelesaikan T03, T04, dan T06. Kalau `npm run dev`
dijalankan sebelum kode frontend-nya ada, panel tidak akan muncul dan itu bukan
kegagalan.

## Persiapan

Satu terminal, biarkan jalan selama pengujian:

```bash
composer run dev
```

Buka `http://localhost:8000`, login dengan **admin / admin**.

Jangan ganti password akun ini.

## Dokumen uji

Data staging sudah punya contoh untuk tiap skenario. Buka lewat URL langsung:

| Skenario | PO | URL |
|---|---|---|
| Panel penerimaan **terisi**, tagihan **kosong** | PSN/PO-0004/26 | `http://localhost:8000/purchaseOrders/01m4393ws05cevej4n5hs676nd` |
| Panel tagihan **terisi**, penerimaan **kosong** | PSN/PO-0001/26 | `http://localhost:8000/purchaseOrders/01m27aw6dn0vnd87hdhpad2gdr` |
| **Kedua panel kosong** | PSN/PO-0002/26 | `http://localhost:8000/purchaseOrders/01m27bbg2wk6tbddq6fzwgjyqg` |

## Yang diperiksa

### 1. Tab Relations muncul (FR1)

Di PSN/PO-0004/26, cari tab baru di baris tab atas, sejajar tab yang sudah ada.

- Tab muncul
- Namanya terbaca wajar, bukan kunci terjemahan mentah seperti
  `core.form.relations`

Kunci mentah yang bocor ke layar berarti terjemahannya belum ditambahkan.

### 2. Panel penerimaan terisi (FR1, FR2)

Masih di PSN/PO-0004/26, buka tab Relations.

- Ada panel penerimaan barang dengan judul terbaca
- Tabel berisi satu baris: **PSN/Receipt-0003/26**
- Kolom: kode, tanggal, total qty
- Tanggal tampil sebagai tanggal terbaca, bukan `2026-10-08T00:00:00.000000Z`
- Ada baris total di bawah tabel, kolom qty-nya terisi angka
- Kolom kode dan tanggal pada baris total **kosong**, bukan 0

### 3. Tautan baris berfungsi (FR1)

Klik kode penerimaan pada baris tabel.

- Pindah ke halaman penerimaan tersebut
- Kodenya cocok dengan yang diklik

Lalu tekan Back.

### 4. Panel kosong dengan tombol (FR3)

Masih di PSN/PO-0004/26, lihat panel tagihan (invoice).

- Panel tetap muncul walau belum ada tagihan
- Ada teks kosong terbaca, bukan tabel kosong tanpa penjelasan
- Ada tombol untuk membuat tagihan

Klik tombolnya.

- Pindah ke halaman pembuatan Purchase Invoice
- Form sudah terisi data dari PO ini (supplier, item). Kalau kosong melompong,
  parameter `ref` tidak terkirim

Tekan Back tanpa menyimpan.

### 5. Panel terisi dan kosong bertukar peran

Buka PSN/PO-0001/26.

- Panel **tagihan terisi** satu baris: PSN/PurchaseINV-0004/26
- Panel **penerimaan kosong**, dengan tombol buat penerimaan

Ini membuktikan panel tidak di-hardcode per posisi.

### 6. Kedua panel kosong

Buka PSN/PO-0002/26.

- Dua panel muncul, keduanya kosong, masing-masing dengan tombolnya
- Tab Relations tetap ada

### 7. Pemuatan tertunda (FR5)

Muat ulang PSN/PO-0004/26 dengan **Ctrl+Shift+R**, lalu langsung buka tab
Relations.

- Sempat terlihat skeleton atau indikator memuat sebelum isi tampil
- Halaman tidak membeku menunggu panel

Kalau terlalu cepat untuk dilihat, buka DevTools → tab Network → Throttling →
Slow 3G, lalu ulangi.

### 8. Tree Connections lama tetap ada (FR4)

Masih di PSN/PO-0004/26, lihat sidebar kanan.

- Bagian Connections masih ada dan masih bisa dibuka
- Isinya masih menampilkan relasi seperti sebelumnya

Panel baru **menambah**, bukan menggantikan.

### 9. Dokumen draft tidak menampilkan panel (FR6)

Data staging tidak punya PO draft, jadi perlu dibuat:

1. Menu Purchases → Purchase Orders → tombol buat baru
2. Isi seperlunya (supplier, satu item), **Save** saja, jangan Submit
3. Lihat halaman PO draft itu

- Tab Relations **tidak muncul**

Draft ini boleh dihapus setelahnya.

### 10. Console bersih

Buka DevTools → Console, muat ulang halaman PO.

- Tidak ada error merah
- Warning React soal `key` atau prop juga dicatat kalau muncul

## Kalau ada yang meleset

Catat nomor langkahnya, PO mana, dan apa yang terlihat. Screenshot membantu,
terutama untuk masalah tata letak.

Tiga hal yang paling mungkin bermasalah dan bukan sekadar soal tampilan:

- Kunci terjemahan mentah di layar (`core.form.relations`) berarti file lang
  belum lengkap
- Panel muncul pada PO draft berarti syarat FR6 tidak terpasang
- Tombol pada panel kosong membawa ke form kosong berarti parameter `ref`
  tidak terkirim

## Catatan

Panel pembayaran tidak ada, dan itu memang disengaja. Verifikasi T05 membuktikan
koneksi `PurchaseOrder -> PaymentEntry` tidak pernah tercatat. Alasannya ada di
design.md bagian 4.

Panel pada PO lama bisa tampil kosong walau dokumennya sebenarnya punya
penerimaan atau tagihan. Koneksi tingkat pertama baru tertulis sejak commit
6e684b41 (14 Oktober 2026). Ini soal data lama, bukan panelnya. Tiga PO di tabel
di atas sudah dipilih karena koneksinya memang ada.
