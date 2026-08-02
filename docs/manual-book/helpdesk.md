# Helpdesk / Ticket

Bagian ini menjelaskan cara memakai sistem tiket internal untuk melaporkan
masalah, mengajukan permintaan, atau bertanya ke tim yang menangani
aplikasi ini. Ini bukan layanan untuk pelanggan dari luar — murni alat
bantu internal antar tim di perusahaan.

## Istilah yang Perlu Kamu Tahu

- **Ticket** — satu laporan atau permintaan kerja: bisa berupa laporan
  bug/masalah, tugas, atau pertanyaan.
- **Riwayat Ticket** — catatan otomatis setiap perubahan penting pada satu
  Ticket, termasuk balasan yang ditambahkan manual.

## Siapa yang Bisa Membuat Ticket?

Semua user yang sudah login bisa membuka dan membuat Ticket — modul ini
sengaja dibuat terbuka untuk siapa saja, tidak dibatasi hak akses khusus
seperti modul bisnis lainnya (Penjualan, Pembelian, dst.). Yang tetap
dibatasi hanya dua aksi: **menandai ticket selesai** dan **membalas/
memperbarui ticket**.

Ticket juga **tidak melewati alur persetujuan** seperti Sales Order atau
Invoice — statusnya diubah langsung oleh orang yang menanganinya, tanpa
perlu disetujui atasan.

## Langkah 1 — Membuat Ticket Baru

Buka menu **Helpdesk → Tickets → Tambah**.

1. Pilih tipe laporan kamu: **Bug/Masalah**, **Tugas**, **Pertanyaan**,
   atau **Lainnya**.
2. Pilih tingkat prioritas: Rendah, Sedang, Tinggi, atau Kritis.
3. Tulis judul yang ringkas menjelaskan masalah/permintaan kamu.
4. Isi tanggal mulai dan batas waktu penyelesaian (kalau ada tenggat
   tertentu).
5. Klik **Save**.

Begitu tersimpan, sistem otomatis membuatkan kode ticket dan mencatat satu
baris riwayat sebagai kondisi awal ticket ini dibuat.

> 💡 Ticket **tidak bisa dihapus** dari tampilan — ini disengaja, supaya
> riwayat penanganan semua laporan tetap utuh dan bisa ditelusuri kapan
> saja diperlukan.

## Langkah 2 — Menugaskan & Menangani Ticket

Ticket yang masuk perlu ditugaskan ke seseorang untuk ditindaklanjuti:

1. Buka detail ticket, tugaskan ke user yang akan menanganinya.
2. Ubah statusnya menjadi **Sedang Dikerjakan** saat mulai ditangani.
3. Gunakan tombol **Balas/Update** untuk menambahkan catatan progres —
   ini bisa sekaligus mengubah siapa yang ditugaskan, status, dan
   persentase penyelesaiannya. Setiap kali kamu melakukan ini, satu baris
   riwayat baru otomatis ditambahkan berisi catatan yang kamu tulis.

## Langkah 3 — Menandai Ticket Selesai

Kalau masalah/permintaan sudah selesai ditangani, klik tombol **Tandai
Selesai** pada ticket tersebut. Status berubah jadi "Selesai", progresnya
otomatis 100%, dan tanggal selesainya tercatat otomatis.

> 💡 Aksi ini **tidak bisa dibatalkan** — pastikan pekerjaannya memang
> sudah benar-benar selesai sebelum menandainya.

## Status Ticket

| Status | Artinya |
|---|---|
| Baru | Ticket baru dibuat, belum ditangani |
| Sedang Dikerjakan | Sudah mulai ditindaklanjuti |
| Ditunda | Sementara tidak dikerjakan dulu |
| Terselesaikan | Sudah diperbaiki, menunggu verifikasi pelapor |
| Selesai | Sudah dikonfirmasi tuntas |

## Ticket yang Selesai Otomatis Lewat Rilis Aplikasi

Kalau tim developer merilis pembaruan aplikasi dan menyebutkan kode
ticket kamu di catatan rilisnya, ticket kamu akan **otomatis** berubah
status jadi "Terselesaikan" (bukan langsung "Selesai") dan tugasnya
dialihkan kembali ke kamu sebagai pelapor untuk diverifikasi. Kalau
setelah dicek memang sudah benar, kamu tinggal klik **Tandai Selesai**
untuk menutupnya.

Kamu bisa melihat catatan rilis aplikasi (perubahan apa saja yang baru
ditambahkan) di menu **Changelog** — kode ticket yang disebutkan di sana
otomatis menjadi tautan yang bisa diklik langsung menuju halaman
ticketnya.

## Pertanyaan Umum

**Kenapa saya tidak bisa menghapus ticket yang salah buat?**
Ticket memang sengaja tidak bisa dihapus, supaya riwayat pelaporan tetap
lengkap. Kalau ticketnya memang keliru, cukup tandai statusnya dan beri
catatan penjelasan lewat fitur Balas/Update.

**Kenapa status ticket saya tiba-tiba berubah jadi "Terselesaikan" tanpa
saya lakukan apa-apa?**
Kemungkinan tim developer sudah merilis perbaikan dan menyebutkan kode
ticket kamu di catatan rilisnya. Cek kembali dan verifikasi apakah
masalahnya memang sudah teratasi, lalu tandai selesai kalau sudah oke.

**Apakah ticket saya perlu disetujui atasan dulu?**
Tidak. Ticket tidak melewati alur persetujuan seperti dokumen bisnis
lainnya — statusnya diubah langsung oleh siapa pun yang menanganinya.
