# Requirements — Manual Book Image Lightbox

## Latar Belakang

Halaman Manual Book in-app (`/manual-book/{section}`) merender markdown dari
`docs/manual-book/*.md` menjadi HTML lewat `App\Services\Core\ManualBookService`
(`GithubFlavoredMarkdownConverter`, opsi `html_input => 'strip'`), lalu
ditampilkan oleh `resources/js/Components/ManualBook/MarkdownMermaidRenderer.jsx`
melalui `dangerouslySetInnerHTML`.

Gambar dirujuk dengan sintaks markdown standar
`![alt](/manual-book-images/<section>/<file>.png)` dan dilayani statis lewat
junction `public/manual-book-images -> docs/manual-book/images`. Converter
menghasilkan `<p><img src alt></p>` polos tanpa class/atribut tambahan; blok
`<figure>`/`<figcaption>` HTML mentah dibuang total oleh `html_input => 'strip'`.

Saat ini screenshot ditampilkan inline pada lebar kolom konten (`prose`,
`max-w-6xl` dikurangi kolom TOC). Screenshot UI ERP padat detail (tabel, form,
angka kecil) sehingga pada lebar itu teks di dalam gambar sering tidak terbaca.
Tidak ada cara melihat gambar pada ukuran/kualitas aslinya tanpa membuka file
PNG secara manual.

## Glosarium

- **Lightbox / modal gambar** — overlay layar penuh yang menampilkan satu gambar
  di atas konten halaman, dengan latar gelap dan tombol tutup.
- **Ukuran asli / native** — dimensi piksel intrinsik berkas PNG (mis. 1384×957),
  tanpa penskalaan CSS.
- **Zoom** — memperbesar tampilan gambar di dalam modal melebihi 100% ukuran fit.
- **Pan** — menggeser area pandang gambar yang sudah di-zoom.
- **Fit-to-viewport** — skala awal saat modal dibuka: gambar diperkecil
  proporsional agar seluruhnya masuk viewport modal, tidak pernah diperbesar
  melebihi 100%.

---

## Requirement 1 — Membuka gambar dalam lightbox

**User story:** Sebagai pembaca Manual Book, saya ingin mengklik screenshot pada
halaman panduan supaya gambar itu terbuka besar dan saya bisa membaca detail di
dalamnya.

### Acceptance Criteria

1. WHEN pengguna mengklik `<img>` yang berada di dalam konten Manual Book yang
   dirender, THEN sistem SHALL menampilkan lightbox berisi gambar yang sama.
2. WHEN lightbox terbuka, THEN sistem SHALL memuat berkas gambar pada resolusi
   penuh (URL `src` yang sama dengan gambar inline — bukan versi thumbnail
   terpisah) sehingga kualitas yang tampil adalah kualitas asli berkas.
3. WHEN lightbox terbuka DAN dimensi native gambar lebih besar dari viewport
   modal, THEN sistem SHALL menampilkan gambar dalam keadaan fit-to-viewport
   sebagai skala awal.
4. WHEN lightbox terbuka DAN dimensi native gambar lebih kecil atau sama dengan
   viewport modal, THEN sistem SHALL menampilkan gambar pada 100% ukuran native
   (tidak di-upscale).
5. WHERE sebuah `<img>` dapat dibuka di lightbox, THE sistem SHALL memberi
   indikasi visual afordансi klik pada gambar inline (mis. kursor `zoom-in`
   dan/atau perubahan halus saat hover).
6. WHEN halaman Manual Book dirender, THEN setiap `<img>` di dalam area konten
   SHALL otomatis mendapat perilaku Requirement 1 tanpa perlu markup khusus di
   file markdown sumber (penulis docs cukup memakai sintaks `![alt](src)`
   standar).
7. IF konten mengandung gambar yang merupakan bagian dari diagram Mermaid hasil
   render (SVG), THEN sistem SHALL TIDAK menerapkan perilaku lightbox pada elemen
   SVG diagram tersebut (lightbox hanya untuk `<img>` raster dari markdown).

---

## Requirement 2 — Zoom dan pan di dalam lightbox

**User story:** Sebagai pembaca, saya ingin memperbesar bagian tertentu dari
screenshot yang sudah terbuka supaya angka dan label kecil terbaca jelas.

### Acceptance Criteria

1. WHEN lightbox menampilkan gambar dalam keadaan fit-to-viewport, THEN sistem
   SHALL menyediakan kontrol untuk memperbesar gambar hingga minimal 100% ukuran
   native, dan idealnya sampai 2×–3× ukuran native untuk detail sangat kecil.
2. WHEN gambar di-zoom melebihi ukuran viewport modal, THEN sistem SHALL
   mengizinkan pengguna menggeser (pan) area pandang, minimal lewat drag pointer.
3. WHEN pengguna menggunakan scroll wheel / gesture pinch di atas gambar dalam
   lightbox, THEN sistem SHALL menyesuaikan tingkat zoom (perilaku umum lightbox).
4. WHERE lightbox menyediakan kontrol zoom eksplisit, THE kontrol SHALL mencakup
   minimal: perbesar, perkecil, dan reset ke fit-to-viewport.
5. WHEN pengguna telah mengubah zoom/pan lalu menutup lightbox dan membukanya lagi
   (gambar apa pun), THEN sistem SHALL memulai kembali dari keadaan
   fit-to-viewport (state zoom tidak persist antar pembukaan).

---

## Requirement 3 — Menutup lightbox

**User story:** Sebagai pembaca, saya ingin menutup tampilan gambar besar dengan
cepat supaya bisa lanjut membaca panduan.

### Acceptance Criteria

1. WHEN lightbox terbuka DAN pengguna menekan tombol `Escape`, THEN sistem SHALL
   menutup lightbox.
2. WHEN lightbox terbuka DAN pengguna mengklik area latar gelap di luar gambar,
   THEN sistem SHALL menutup lightbox.
3. WHEN lightbox terbuka, THEN sistem SHALL menampilkan tombol tutup (ikon `X`)
   yang terlihat jelas dan dapat diklik.
4. WHEN lightbox ditutup, THEN sistem SHALL mengembalikan fokus keyboard ke
   gambar/elemen yang memicu pembukaannya (aksesibilitas).
5. WHILE lightbox terbuka, THE sistem SHALL mencegah scroll pada body halaman di
   belakang overlay.

---

## Requirement 4 — Konsistensi dengan fitur & tampilan Manual Book yang ada

**User story:** Sebagai developer yang merawat Manual Book, saya ingin fitur
lightbox tidak merusak fitur cetak, TOC, maupun rendering diagram yang sudah ada.

### Acceptance Criteria

1. WHEN pengguna menjalankan fungsi Cetak (`window.print()`) pada halaman Manual
   Book, THEN gambar SHALL tercetak inline seperti sekarang (lightbox/overlay
   TIDAK muncul di hasil cetak).
2. WHEN `MarkdownMermaidRenderer` sedang memproses diagram Mermaid, THEN
   penambahan perilaku lightbox SHALL TIDAK mengganggu mekanisme
   `data-diagrams-ready` maupun memicu re-render yang menimpa SVG diagram (lihat
   catatan `RawContent` memo di komponen tersebut).
3. WHEN konten section berubah (navigasi antar section), THEN handler lightbox
   SHALL menempel ulang ke gambar-gambar section baru dan melepas handler lama
   (tidak ada listener bocor / dobel).
4. WHERE komponen UI modal dibutuhkan, THE implementasi SHALL memakai primitive
   yang sudah tersedia di proyek (`@/Components/ui/dialog` berbasis
   `@radix-ui/react-dialog`) kecuali design.md memutuskan lain dengan alasan
   eksplisit.
5. IF fitur ini membutuhkan dependency npm baru, THEN penambahannya SHALL
   diputuskan dan disetujui pada tahap design (sesuai aturan proyek: tidak
   mengubah dependency tanpa persetujuan).
6. WHEN lightbox dipakai pada layar mobile (viewport sempit), THEN gambar SHALL
   tetap fit-to-viewport dan kontrol tutup SHALL tetap terjangkau.

---

## Requirement 5 — Ketahanan terhadap gambar yang gagal dimuat

**User story:** Sebagai pembaca, saya tidak ingin mengklik placeholder gambar yang
belum diisi lalu terjebak di modal kosong.

### Acceptance Criteria

1. IF berkas gambar gagal dimuat (404 / broken image), THEN sistem SHALL TIDAK
   membuka lightbox kosong ketika gambar itu diklik (atau membuka lightbox dengan
   pesan "gambar tidak tersedia" yang bisa ditutup normal).
2. WHERE section markdown masih memakai placeholder 1×1 piksel, THE gambar inline
   SHALL tetap tampil sebagai placeholder kecil tanpa menimbulkan error JS saat
   diklik.
3. WHEN sebuah `<img>` tidak memiliki atribut `alt`, THEN lightbox SHALL tetap
   berfungsi (judul/caption modal boleh kosong, tidak error).

---

## Requirement 6 — Pola placeholder gambar pada `penjualan.md` & panduan menulis terpisah

**User story:** Sebagai penulis Manual Book, saya ingin `penjualan.md` menjadi
contoh acuan pola penempatan gambar yang benar, dan sebuah panduan langkah demi
langkah yang bisa saya baca saat mengisi gambar, supaya saya bisa menyalin
polanya ke section lain dan mengganti placeholder dengan screenshot asli tanpa
bertanya.

### Keputusan desain terkait (dari `design.md`)

Panduan menulis ditempatkan di **file terpisah `docs/manual-book/README-penulisan.md`**,
BUKAN sebagai section di dalam `penjualan.md`. File itu tidak terdaftar di
`config/manual_book.php` sehingga tidak dirender ke halaman in-app — dibaca lewat
editor/GitHub oleh tim dokumentasi. Konsekuensinya `penjualan.md` hanya menerima
penyeragaman placeholder; alur panduan penggunaan aplikasi di dalamnya tidak
ditambah section teknis apa pun.

Folder gambar section ini adalah `docs/manual-book/images/penjualan/` (mengikuti
konvensi folder section lain yang memakai slug bahasa Indonesia = nama berkas
`.md`, mis. `pembelian/`, `keuangan/`). Path rujukan di markdown tetap
`/manual-book-images/penjualan/...`.

### Acceptance Criteria

1. WHEN `docs/manual-book/penjualan.md` dibaca, THEN setiap titik yang memerlukan
   screenshot SHALL memiliki placeholder gambar dengan format konsisten:
   `![<deskripsi jelas isi gambar>](/manual-book-images/penjualan/<nama-file-kebab-case>.png)`.
2. WHERE penamaan berkas gambar dipakai, THE nama SHALL kebab-case, berekstensi
   `.png`, deskriptif terhadap layar yang ditangkap (mis.
   `form-sales-order-terisi.png`, bukan `Langkah1.png` atau `gambar2.png`).
3. WHEN `docs/manual-book/README-penulisan.md` dibuat, THEN isinya SHALL
   menjelaskan, dalam bahasa Indonesia yang jelas untuk tim dokumentasi:
   a. lokasi menaruh berkas: `docs/manual-book/images/<slug-section>/` (satu
      subfolder per section, contoh `penjualan/`);
   b. syarat menjalankan junction/symlink `public/manual-book-images` sekali di
      awal (perintah untuk Windows tanpa admin dan untuk Linux/macOS), merujuk
      `config/manual_book.php`;
   c. sintaks markdown persis untuk menyisipkan gambar, dengan contoh nyata yang
      diambil dari `penjualan.md`;
   d. aturan path absolut `/manual-book-images/...` (kenapa path relatif gagal —
      route section `/manual-book/{section}` bersifat catch-all sehingga path
      relatif diperlakukan sebagai nama section → 404);
   e. konvensi penamaan berkas (kebab-case, `.png`, deskriptif) dan aturan slug
      folder (bahasa Indonesia, sama dengan nama berkas `.md`);
   f. cara kerja fitur klik-untuk-perbesar dari sisi pembaca (penulis tidak perlu
      markup khusus — cukup sintaks `![...]()` standar; pembaca klik gambar →
      modal besar + zoom);
   g. langkah mengganti placeholder 1×1 px dengan screenshot asli (timpa berkas
      dengan nama sama, atau ganti nama berkas lalu update path di markdown; lalu
      `npm run build`/`npm run dev` bila perlu).
4. WHERE `penjualan.md` sudah selesai diseragamkan, THE file itu SHALL bisa
   dijadikan contoh yang dirujuk langsung oleh `README-penulisan.md` (AC 3.c).
5. WHEN placeholder berkas gambar dibuat/diganti namanya di
   `docs/manual-book/images/penjualan/`, THEN berkas screenshot lama yang tidak
   lagi dirujuk (`Langkah1.png`, `Sales Order Baru.png`, dll.) SHALL dibereskan —
   entah di-rename mengikuti konvensi lalu dirujuk dari `penjualan.md`, atau
   dihapus jika bukan screenshot final. Keputusan per-berkas diambil saat
   implementasi task dan dilaporkan di ringkasan task.
6. WHEN folder `docs/manual-book/images/Penjualan/` (kapital) di-rename menjadi
   `penjualan/` (huruf kecil), THEN semua rujukan `/manual-book-images/penjualan/...`
   di `penjualan.md` DAN `retur.md` SHALL tetap resolve (verifikasi render
   setelah rename).

---

## Di Luar Cakupan (Non-Goals)

- Membuat versi thumbnail / resize otomatis di server. Gambar inline dan gambar
  lightbox memakai berkas yang sama.
- Galeri multi-gambar / navigasi prev-next antar screenshot dalam satu modal.
- Caption kaya (HTML) di bawah gambar inline. Teks alternatif tetap lewat atribut
  `alt` markdown standar.
- Mengubah `html_input => 'strip'` menjadi mode yang mengizinkan HTML mentah di
  markdown Manual Book.
- Mengisi screenshot asli untuk section selain memperbaiki/menamai ulang berkas
  di `penjualan.md` (pengisian gambar section lain dikerjakan terpisah oleh user).
- Menambahkan panduan menulis (`README-penulisan.md`) sebagai section yang
  dirender di halaman in-app. File itu sengaja tidak terdaftar di config.
- Menyeragamkan placeholder di section lain (`pembelian.md`, `inventory.md`, dst)
  — hanya `penjualan.md` yang jadi contoh acuan di spec ini.
- Fitur lightbox untuk Changelog atau halaman lain di luar Manual Book.
