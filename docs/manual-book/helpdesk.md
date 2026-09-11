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

Buka menu **Helpdesk → Tickets**. Daftar semua ticket tampil di sini; klik
tombol **Ticket Baru** di kanan atas untuk membuat yang baru.

![Daftar ticket helpdesk dengan tombol Ticket Baru](/manual-book-images/helpdesk/list-tiket.png)

1. Pilih tipe laporan kamu: **Bug/Masalah**, **Tugas**, **Pertanyaan**,
   atau **Lainnya**.
2. Pilih tingkat prioritas: Rendah, Sedang, Tinggi, atau Kritis.
3. Tulis judul yang ringkas menjelaskan masalah/permintaan kamu di kolom
   **Subjek**, dan uraian lengkapnya di kolom **Konten**.
4. Isi tanggal mulai dan batas waktu penyelesaian (kalau ada tenggat
   tertentu), serta pilih siapa yang ditugaskan menangani.
5. Klik **Simpan**.

![Formulir Ticket Baru terisi lengkap](/manual-book-images/helpdesk/form-tambah-ticket.png)

Begitu tersimpan, sistem otomatis membuatkan kode ticket dan mencatat satu
baris riwayat sebagai kondisi awal ticket ini dibuat.

![Detail ticket dengan Riwayat Tickets kondisi awal](/manual-book-images/helpdesk/detail-ticket-riwayat.png)

> 💡 Ticket **tidak bisa dihapus** dari tampilan — ini disengaja, supaya
> riwayat penanganan semua laporan tetap utuh dan bisa ditelusuri kapan
> saja diperlukan.

## Langkah 2 — Menugaskan & Menangani Ticket

Ticket yang masuk perlu ditugaskan ke seseorang untuk ditindaklanjuti:

1. Buka detail ticket, klik tombol **Update Ticket** di kanan atas.
2. Ubah **Ditugaskan Ke** ke user yang akan menanganinya, dan ubah
   **Status** menjadi **Sedang Dikerjakan** saat mulai ditangani.
3. Isi kolom **Konten** dengan catatan progres, lalu klik **Simpan**.
   Lewat form ini kamu bisa sekaligus mengubah siapa yang ditugaskan,
   status, dan persentase penyelesaiannya. Setiap kali kamu menyimpannya,
   satu baris riwayat baru otomatis ditambahkan berisi catatan yang kamu
   tulis.

![Formulir Update Ticket dengan perubahan status dan catatan progres](/manual-book-images/helpdesk/assign-dan-status.png)

Setelah disimpan, baris baru langsung muncul di **Riwayat Tickets** —
mencatat perubahan status "Baru → Sedang Dikerjakan" beserta catatannya.

![Riwayat Tickets bertambah satu baris setelah update](/manual-book-images/helpdesk/riwayat-setelah-update.png)

Kalau kamu hanya ingin menambahkan komentar tanpa mengubah data ticket,
pakai tombol **Tambah Catatan / Komentar** di bagian **Aktivitas** di
bawah halaman detail.

![Formulir Tambah Catatan / Komentar](/manual-book-images/helpdesk/tambah-catatan.png)

Komentar yang dikirim langsung tampil di daftar **Aktivitas**.

![Komentar tampil di daftar Aktivitas](/manual-book-images/helpdesk/aktivitas-komentar.png)

## Langkah 3 — Menandai Ticket Selesai

Kalau masalah/permintaan sudah selesai ditangani, klik tombol **Tandai
Selesai** pada ticket tersebut. Sistem meminta konfirmasi dulu karena
aksi ini tidak bisa dibatalkan.

![Dialog konfirmasi Tandai Sebagai Selesai](/manual-book-images/helpdesk/konfirmasi-tandai-selesai.png)

Setelah dikonfirmasi, status berubah jadi "Selesai", progresnya otomatis
100%, dan tanggal selesainya tercatat otomatis. Semua perubahan ini juga
tercatat sebagai baris terakhir di Riwayat Tickets.

![Ticket berstatus Selesai dengan Riwayat Tickets lengkap](/manual-book-images/helpdesk/tombol-tandai-selesai.png)

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
