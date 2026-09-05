# Panduan Menulis Manual Book — Menaruh Gambar

> **Untuk tim dokumentasi.** File ini _tidak_ dirender ke halaman in-app — ia
> sengaja tidak didaftarkan di `config/manual_book.php`. Bacanya lewat editor
> atau GitHub. Isi panduan penggunaan aplikasi ada di file section
> (`penjualan.md`, `pembelian.md`, dst); di sini khusus soal cara menyisipkan
> screenshot.

Halaman Manual Book (`/manual-book/{section}`) merender file markdown di
`docs/manual-book/` jadi HTML lewat `App\Services\Core\ManualBookService`
(`GithubFlavoredMarkdownConverter`). Gambar dirujuk dengan sintaks markdown
biasa dan dilayani statis lewat sebuah junction/symlink.

---

## 1. Menyiapkan folder gambar (sekali per mesin)

Folder `docs/` **tidak** dilayani web server. Supaya gambar tetap tampil di
halaman, buat junction/symlink `public/manual-book-images` yang menunjuk ke
`docs/manual-book/images` (sudah masuk `.gitignore`, jadi tiap orang membuatnya
sendiri):

```bash
# dari folder public/ — Windows, tanpa hak admin:
cmd /c "mklink /J manual-book-images ..\docs\manual-book\images"

# Linux / macOS:
ln -s ../docs/manual-book/images manual-book-images
```

Referensi lengkap ada di komentar `config/manual_book.php` (bagian "Gambar /
Screenshot Manual Book").

---

## 2. Menaruh berkas screenshot

- Lokasi: `docs/manual-book/images/<slug-section>/` — **satu subfolder per
  section**.
- `<slug-section>` = nama file `.md` tanpa ekstensi:
  `penjualan`, `pembelian`, `inventory`, `keuangan`, `layanan`, `aset`,
  `helpdesk`, `retur`, `pengaturan-umum`.
  (Perhatikan: slug folder pakai bahasa Indonesia, **bukan** key config seperti
  `sales`/`purchase`.)
- Nama berkas: **kebab-case**, ekstensi **`.png`**, deskriptif terhadap layar
  yang ditangkap.
  - ✅ `form-sales-order.png`, `detail-delivery-note-draft.png`
  - ❌ `Langkah1.png`, `gambar2.png`, `Screenshot 2026-08-30.png`

Berkas gambar **di-commit** ke repo (yang di-`.gitignore` hanya junction
`public/manual-book-images`).

---

## 3. Menyisipkan gambar ke halaman

Sintaksnya markdown standar:

```markdown
![deskripsi jelas isi layar](/manual-book-images/<slug-section>/<berkas>.png)
```

Contoh nyata dari `penjualan.md`:

```markdown
![Halaman daftar Sales Orders dengan tombol Sales Order Baru di kanan atas dan tabel berisi kolom Kode, Pelanggan, Tanggal, dan Status](/manual-book-images/penjualan/list-sales-orders.png)
```

**Path absolut wajib** (diawali `/`). Route halaman
`/manual-book/{section}` bersifat _catch-all_ — path relatif seperti
`images/x.png` akan diperlakukan sebagai nama section dan menghasilkan 404.

Teks dalam kurung siku `![...]` menjadi **alt text**. Ia juga dipakai sebagai
judul (untuk pembaca layar) dan caption ketika gambar dibuka besar — jadi tulis
deskriptif, bukan sekadar "gambar" atau "langkah 2".

---

## 4. Cara pembaca melihat ukuran asli (otomatis)

Penulis **tidak perlu** markup khusus — cukup `![...](...)` biasa.

Di halaman, setiap gambar di dalam konten otomatis bisa **diklik untuk dibuka
besar**: modal layar penuh menampilkan berkas pada resolusi & kualitas aslinya,
dengan zoom (tombol, scroll, atau pinch) dan geser. Tutup dengan `Esc`, klik
area gelap di luar gambar, atau tombol ✕.

Fitur ini berlaku untuk semua section — tidak ada yang perlu diaktifkan
per-halaman.

---

## 5. Mengganti placeholder 1×1 dengan screenshot asli

Sebagian slot gambar masih berisi **placeholder PNG 1×1 piksel** (± 69 byte)
supaya halaman tetap render sebelum screenshot aslinya siap. Saat placeholder
dibuka besar, modal menampilkan pesan "Screenshot untuk bagian ini belum
ditambahkan."

Untuk menggantinya:

- **Cara A — timpa berkas dengan nama sama.** Ambil screenshot asli, simpan
  dengan nama & path persis seperti placeholder, commit.
- **Cara B — berkas nama baru yang lebih deskriptif.** Taruh berkas baru, lalu
  ubah path di file `.md`-nya. Hapus placeholder lama kalau tidak dipakai lagi.

Setelah mengganti gambar, jalankan `npm run build` (atau minta dev menjalankan
`npm run dev`) bila perubahan tidak langsung terlihat di browser.

---

## 6. Checklist sebelum commit

- [ ] Berkas ada di `docs/manual-book/images/<slug-section>/`
- [ ] Nama berkas kebab-case, ekstensi `.png`
- [ ] Path di markdown absolut (`/manual-book-images/...`) dan cocok dengan nama
      berkas
- [ ] Alt text menjelaskan isi layar, bukan "gambar"
- [ ] Halaman `/manual-book/<key-section>` dibuka — gambar tampil dan bisa
      diklik untuk dibuka besar
