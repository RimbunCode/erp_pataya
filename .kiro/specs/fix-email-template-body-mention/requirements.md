# Requirements: fix-email-template-body-mention

## Latar Belakang

Editor body pada form Email Template (`resources/js/Pages/Core/EmailTemplate/Form.jsx`) memakai `TiptapEditor` dengan dukungan tag `@merge-tag` (variable/kolom model). Dua masalah dilaporkan pengguna:

1. Tag `@` berhasil dipasang saat mengetik, tapi setelah form disimpan, seluruh isi body hilang.
2. Dropdown daftar variable saat mengetik `@` tidak bisa di-scroll dan tidak terfilter sesuai teks yang diketik, serta tidak ada highlight pada kata yang cocok (berbeda dengan komponen `LinkModel` yang sudah punya perilaku ini).

## Requirement 1 — Body tidak hilang setelah submit

**User Story:** Sebagai user yang mengedit Email Template, saya ingin isi body (termasuk tag `@merge-tag` yang sudah dipasang) tetap utuh setelah saya menyimpan form, supaya saya tidak perlu mengetik ulang.

### Acceptance Criteria

1. WHEN user mengetik body berisi minimal satu tag `@merge-tag` DAN menekan submit/simpan, THEN body yang tampil di editor SETELAH submit selesai HARUS identik dengan body sebelum submit (termasuk tag merge-tag-nya).
2. WHEN form disimpan dengan sukses, THEN data yang tersimpan di database (`email_templates.body_html` dan `email_templates.body_json`) HARUS sesuai dengan yang diketik user, bukan kosong atau versi lama.
3. WHEN user membuka kembali (reload halaman) Email Template yang sudah pernah disimpan dengan body berisi merge-tag, THEN editor HARUS menampilkan body tersebut dengan benar (tag muncul sebagai merge-tag, bukan hilang atau rusak).
4. IF root cause bug ternyata di lapisan `useDraftForm` (dipakai form lain di aplikasi), THEN fix HARUS tidak mengubah perilaku form-form lain yang sudah berjalan benar (regresi nol pada form existing).

## Requirement 2 — Dropdown variable scrollable

**User Story:** Sebagai user yang menyisipkan variable ke body, saya ingin bisa scroll daftar variable saat daftarnya panjang, supaya saya bisa memilih variable yang berada di luar area tampilan awal.

### Acceptance Criteria

1. WHEN daftar variable yang muncul saat mengetik `@` melebihi tinggi maksimum container, THEN daftar HARUS bisa di-scroll secara vertikal (bukan terpotong/tersembunyi).
2. WHEN daftar di-scroll, THEN item yang berada di luar area awal HARUS bisa dijangkau dan diklik/dipilih.

## Requirement 3 — Dropdown variable searchable/filterable

**User Story:** Sebagai user yang mengetik `@` diikuti kata kunci, saya ingin daftar variable terfilter sesuai kata kunci yang saya ketik, supaya saya cepat menemukan variable yang saya cari tanpa scroll manual.

### Acceptance Criteria

1. WHEN user mengetik teks setelah `@` (mis. `@na`), THEN daftar variable yang ditampilkan HARUS hanya berisi item yang label-nya (teks yang terlihat oleh user) mengandung teks tersebut (case-insensitive).
2. WHEN teks yang diketik tidak cocok dengan label item manapun, THEN daftar HARUS menampilkan state kosong ("No results" atau setara), bukan seluruh daftar tak terfilter.
3. WHEN user menghapus teks setelah `@` hingga kosong, THEN daftar HARUS kembali menampilkan semua variable yang tersedia.

## Requirement 4 — Highlight kata yang cocok

**User Story:** Sebagai user, saya ingin melihat bagian teks yang cocok dengan pencarian saya disorot (highlight), seperti pada komponen `LinkModel`, supaya saya lebih cepat memindai daftar hasil filter.

### Acceptance Criteria

1. WHEN daftar variable terfilter oleh kata kunci setelah `@`, THEN bagian label item yang cocok dengan kata kunci tersebut HARUS ditampilkan dengan highlight visual (warna latar berbeda), konsisten dengan gaya highlight di `LinkModel`.
2. WHEN kata kunci kosong (baru mengetik `@` tanpa teks tambahan), THEN tidak ada highlight yang ditampilkan (seluruh label tampil normal).
3. IF label mengandung karakter spesial regex (mis. tanda kurung), THEN highlight HARUS tetap berfungsi tanpa error (karakter tersebut di-escape sebelum dipakai sebagai pola pencarian).

## Non-Goals (di luar scope)

- Tidak mengubah field `subject` (memakai `react-mentions`, sudah berfungsi berbeda dari body dan tidak dilaporkan bermasalah).
- Tidak menambah fitur baru pada merge-tag (mis. nested/relasi field) — hanya memperbaiki bug yang sudah ada.
- Tidak mengubah `EmailTemplateRenderService` (proses render saat kirim email nyata) kecuali ditemukan terkait langsung dengan root cause bug #1.
