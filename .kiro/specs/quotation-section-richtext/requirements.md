# Requirements: Quotation Section Rich Text + Save as Template

## Latar Belakang

Form Quotation (`resources/js/Pages/CRM/Quotations/Form.jsx`) memiliki komponen
`QuotationSections` (`resources/js/Pages/CRM/Quotations/QuotationSections.jsx`)
untuk pengisian blok teks bebas pada surat penawaran, khususnya untuk tipe
Kontrak / Sewa (`rental`) dan Unit Baru (`new_unit`) seperti:

- **Note**
- **Term of Payment**
- **Owner Obligation**
- **Tenant Obligation**
- **Terms & Conditions**

Saat ini konten blok teks diisi lewat `<Textarea>` biasa (plain text), dan
template master di `quotation_section_templates` hanya dimuat satu kali secara
massal tanpa kemampuan memilih varian template per blok atau menyimpan hasil
editan inline kembali menjadi template baru.

### Masalah yang Diselesaikan

1. **Plain text (`Textarea`) kurang memadai untuk struktur Terms & Obligations.**
   Pada dokumen surat penawaran (seperti contoh surat PT Pataya Sarana Niaga),
   _Term of Payment_, _Owner Obligation_, _Tenant Obligation_, dan _Note_
   membutuhkan penomoran (`<ol>`), sub-bullet (`<ul>`), penebalan teks (`<b>`),
   dan garis bawah (`<u>`). Mengandalkan plain text + `white-space: pre-line`
   menyulitkan pemformatan berjenjang.

2. **Tidak bisa memilih template spesifik per blok atau menyimpan editan inline sebagai template baru.**
   Dalam praktiknya, _Terms_, _Owner Obligation_, dan _Tenant Obligation_ sering
   memiliki variasi klausul yang diedit langsung (_inline_) saat menyusun
   penawaran. Setelah selesai mengedit, user membutuhkan pilihan apakah ingin
   menyimpan hasil editan tersebut sebagai template baru (agar bisa dipakai
   kembali di penawaran berikutnya) atau hanya berlaku untuk dokumen Quotation
   ini saja.

### Fondasi yang Sudah Ada

| Komponen                                        | Lokasi                                                         | Status                                                                                                                             |
| ----------------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| TipTap packages                                 | `package.json`                                                 | ✅ `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-underline`, `@tiptap/extension-text-align`, `@tiptap/extension-link` |
| `TiptapEditor` component                        | `resources/js/Components/TiptapEditor.jsx`                     | ✅ Lengkap dengan toolbar, BubbleMenu, `sanitizeProseMirrorJSON`, dual output `onValueChange(json, html)`                          |
| Pola Dual Storage (`content` + `content_json`)  | `app/Models/Helpdesk/Ticket.php` & `Helpdesk/Tickets/Form.jsx` | ✅ `content` menyimpan HTML/text, `content_json` menyimpan ProseMirror JSON                                                        |
| `QuotationSections` component                   | `resources/js/Pages/CRM/Quotations/QuotationSections.jsx`      | ✅ CRUD blok, urutkan blok, salin dari template                                                                                    |
| `QuotationSection` & `QuotationSectionTemplate` | `app/Models/CRM/`                                              | ✅ Sudah ada beserta seeder 5 template awal                                                                                        |
| Print templates                                 | `database/seeders/QuotationPrintTemplateSeeder.php`            | ✅ 3 template cetak Handlebars                                                                                                     |

---

## Tujuan

1. Setiap blok teks pada Quotation (_Note_, _Term of Payment_, _Owner
   Obligation_, _Tenant Obligation_, _Terms & Conditions_) dapat diedit secara
   inline menggunakan **TipTap Rich Text Editor**.
2. Menyimpan konten blok dan template dalam **dual storage** (`content` untuk
   HTML/teks dan `content_json` untuk ProseMirror JSON) mengikuti pola
   `Helpdesk/Ticket`.
3. User dapat memilih/memuat template yang tersimpan untuk blok tertentu maupun
   memuat set template standar sesuai jenis Quotation.
4. Ketika isi blok ditambahkan atau diubah secara inline, setelah selesai
   mengedit muncul pilihan bagi user untuk **menyimpan editan tersebut sebagai
   template baru** atau **tidak** (hanya untuk dokumen ini).
5. Hasil cetak PDF Quotation merender rich text (daftar bernomor, bullet,
   tebal, garis bawah) dengan rapi.

---

## Prinsip Desain

**PD1 — Dual storage (`content` + `content_json`) mengikuti pola Ticket.**
Kolom `content` (`text`) yang sudah ada tetap dipertahankan untuk menyimpan
HTML hasil serialisasi TipTap (sekaligus menjaga kompatibilitas mundur dengan
data/test plain text yang sudah ada). Kolom baru `content_json` (`json`,
nullable) ditambahkan ke `quotation_sections` dan `quotation_section_templates`
sebagai sumber kebenaran struktur editor ProseMirror (`value={section.content_json ?? section.content}`).

**PD2 — Penyalinan nilai (Copy-on-Apply, Pola P3).**
Memilih atau memuat template selalu menyalin `title`, `content`, dan
`content_json` ke blok dokumen Quotation. Mengedit blok secara inline di
dokumen tidak pernah mengubah template master yang sudah ada.

**PD3 — Prompt non-intrusif setelah selesai mengedit.**
Saat user selesai mengedit isi blok secara inline (mis. saat editor kehilangan
fokus / `onBlur` atau terdeteksi ada perubahan isi dibanding kondisi awal/template
asal), sistem menampilkan bar/pilihan kontekstual pada blok tersebut:
_"Simpan perubahan ini sebagai template baru?"_ dengan aksi **Simpan sebagai
Template** atau **Abaikan / Tidak**. User juga dapat menekan tombol **Simpan
sebagai Template** kapan saja pada blok yang memiliki judul dan isi.

**PD4 — Kompatibilitas mundur penuh untuk data plain text.**
Konten template atau section lama yang hanya memiliki plain text di `content`
(dan `content_json = null`) tetap dapat dibuka di `TiptapEditor` dan dicetak di
Print Template tanpa rusak.

---

## Non-Goals

- **Mengubah template yang sudah ada secara otomatis saat mengedit dokumen.**
  Perubahan di dokumen hanya disimpan sebagai template _baru_ jika user memilih
  untuk menyimpannya.
- **Image upload dan Mention (`@`) di dalam blok teks Quotation.** Klausul
  kontrak/sewa hanya membutuhkan pemformatan teks dan daftar, bukan gambar atau
  mention.
- **Versioning riwayat template.**

---

## Requirements

### Requirement 1: Inline Rich Text Editing dengan TipTap pada Blok Teks

**User Story:** Sebagai user penyusun Quotation, saya ingin menulis dan
mengedit isi blok teks (_Terms_, _Owner Obligation_, _Tenant Obligation_, _Note_)
secara inline menggunakan TipTap agar penomoran, sub-poin, huruf tebal, dan
garis bawah dapat diatur dengan mudah.

#### Acceptance Criteria

- **AC1.1** WHEN form Quotation dibuka dalam mode tambah/edit, THEN setiap blok
  di `QuotationSections` menampilkan `TiptapEditor` untuk field isi blok
  (`sections.{index}.content`).
- **AC1.2** WHEN `TiptapEditor` digunakan di `QuotationSections`, THEN editor
  mendukung pemformatan teks (Bold, Italic, Underline, Strikethrough), daftar
  (Ordered List, Bullet List), Heading, Blockquote, perataan teks (Text Align),
  Link, serta Undo/Redo tanpa tombol upload gambar.
- **AC1.3** WHEN form Quotation berada dalam mode `readOnly` (mis. dokumen
  sudah disubmit atau user tidak memiliki izin edit), THEN `TiptapEditor`
  menonaktifkan pengeditan (`editable: false`), menyembunyikan toolbar dan
  `BubbleMenu`, serta menampilkan isi rich text secara terformat.
- **AC1.4** WHEN user mengubah isi pada `TiptapEditor`, THEN komponen
  memperbarui state blok dengan `content_json` (ProseMirror JSON hasil
  sanitasi) dan `content` (HTML string).
- **AC1.5** WHEN sebuah blok memiliki `content_json = null` tetapi memiliki
  `content` berupa plain text (baris dipisahkan `\n`) atau HTML string, THEN
  `TiptapEditor` tetap menampilkan isi tersebut dengan benar tanpa kehilangan
  pemisah baris.

### Requirement 2: Dual Storage (`content` + `content_json`) di Database & Backend

**User Story:** Sebagai developer, saya ingin menyimpan struktur JSON TipTap
dan representasi HTML secara berdampingan agar pengeditan ulang di TipTap
presisi dan pencetakan dokumen tetap cepat.

#### Acceptance Criteria

- **AC2.1** Tabel `quotation_sections` memiliki kolom baru `content_json`
  bertipe `json` (`nullable`). Kolom `content` (`text`) tetap ada.
- **AC2.2** Tabel `quotation_section_templates` memiliki kolom baru
  `content_json` bertipe `json` (`nullable`). Kolom `content` (`text`) tetap
  ada.
- **AC2.3** Model `QuotationSection` dan `QuotationSectionTemplate` meng-cast
  `content_json` sebagai `'array'`.
- **AC2.4** `QuotationController::sectionTemplates()` menyertakan kolom
  `content_json` saat mengirim prop `sectionTemplates` ke halaman `create` dan
  `show`.
- **AC2.5** `QuotationRequest` mengizinkan `sections.*.content_json` sebagai
  `['nullable', 'array']` dan tetap memvalidasi `sections.*.title` (`required`,
  `string`, `max:255`) serta `sections.*.content` (`required`, `string`). Jika
  editor kosong (mis. hanya `<p></p>` tanpa teks), validasi menolak penyimpanan
  blok kosong.
- **AC2.6** `QuotationService::syncSections()` menyimpan `content_json`
  (default `null` bila tidak dikirim) bersama `title`, `content`, dan `order`.

### Requirement 3: Pilihan Menyimpan Hasil Editan Inline sebagai Template Baru

**User Story:** Sebagai user, setelah saya selesai mengedit isi _Terms_,
_Owner Obligation_, atau _Tenant Obligation_ secara inline, saya ingin diberi
pilihan untuk menyimpan hasil editan tersebut sebagai template baru atau tidak,
sehingga klausul yang sudah disesuaikan bisa dipakai kembali di penawaran
berikutnya.

#### Acceptance Criteria

- **AC3.1** WHEN user mengedit isi blok teks secara inline sehingga isinya
  berubah dan kemudian selesai mengedit (`onBlur` pada editor atau klik tombol
  aksi blok), THEN pada blok tersebut muncul penanda/pilihan kontekstual yang
  menanyakan apakah user ingin menyimpan blok hasil editan ini sebagai template
  baru, dengan dua pilihan: **Simpan sebagai Template Baru** atau **Tidak /
  Abaikan**.
- **AC3.2** WHEN user memilih **Tidak / Abaikan**, THEN prompt penawaran simpan
  template pada blok tersebut disembunyikan untuk sesi edit tersebut, sementara
  isi editan tetap tersimpan di dokumen Quotation. User tetap dapat memicu
  penyimpanan template secara manual lewat tombol **Simpan sebagai Template**
  pada header/footer blok jika berubah pikiran.
- **AC3.3** WHEN user memilih **Simpan sebagai Template Baru**, THEN tampil
  form/dialog ringkas untuk mengonfirmasi:
  - **Nama Template (`name`)**: wajib diisi, default terisi otomatis (mis.
    `<Judul Blok> - <Jenis Quotation>` atau judul blok).
  - **Judul Blok (`title`)**: terisi otomatis dari judul blok saat ini (dapat
    disesuaikan).
  - **Jenis Quotation (`quotation_type`)**: opsional (`rental`, `new_unit`,
    `spare_part`, atau semua jenis), default mengikuti `type` Quotation yang
    sedang aktif.
- **AC3.4** WHEN user mengonfirmasi penyimpanan template baru, THEN frontend
  mengirim request `POST` ke endpoint penyimpanan `QuotationSectionTemplate`
  tanpa me-reset atau menghilangkan state form Quotation yang sedang diedit.
- **AC3.5** Backend memvalidasi dan menyimpan record baru di tabel
  `quotation_section_templates` (`name`, `quotation_type`, `title`, `content`,
  `content_json`, `order`), lalu mengarahkan kembali ke halaman Quotation agar
  respons mengikuti siklus form Inertia.
- **AC3.6** WHEN penyimpanan template baru berhasil, THEN daftar template yang
  tersedia di form langsung diperbarui secara reaktif, toast sukses ditampilkan,
  dan prompt "Simpan sebagai Template Baru" pada blok tersebut ditutup.

### Requirement 4: Memilih dan Memuat Template ke Blok Teks

**User Story:** Sebagai user, saya ingin bisa memuat template yang sudah pernah
disimpan (baik secara keseluruhan maupun memilih template tertentu untuk satu
blok) agar saya dapat menggunakan kembali variasi _Terms_, _Owner Obligation_,
atau _Tenant Obligation_ yang sudah dibuat.

#### Acceptance Criteria

- **AC4.1** WHEN user menekan tombol "Ambil dari Template" (`loadFromTemplates`),
  THEN template default untuk jenis Quotation tersebut disalin ke daftar blok
  dokumen beserta `content` dan `content_json`-nya.
- **AC4.2** Pada setiap blok (atau saat memilih template untuk blok), user
  dapat memilih dari daftar `sectionTemplates` yang tersedia untuk mengganti/
  mengisi `title`, `content`, dan `content_json` pada blok tersebut (sehingga
  jika ada beberapa varian template _Owner Obligation_, user bisa memilih varian
  yang diinginkan).
- **AC4.3** Fungsi `copyTemplatesToSections()` menyalin `content_json` (jika
  ada) selain `title` dan `content`.

### Requirement 5: Seeder & Print Template Mendukung Rich Text HTML

**User Story:** Sebagai user, ketika saya mencetak Quotation ke PDF, saya ingin
format rich text dari blok teks tampil rapi sesuai tampilan di editor.

#### Acceptance Criteria

- **AC5.1** `QuotationPrintTemplateSeeder` merender isi blok menggunakan
  Handlebars triple-stash `{{{this.content}}}` pada `.letter-section-content`
  agar tag HTML dari TipTap (`<p>`, `<ol>`, `<ul>`, `<li>`, `<strong>`, `<em>`,
  `<u>`) dirender sebagai elemen HTML, bukan teks mentah.
- **AC5.2** CSS `.letter-section-content` pada `QuotationPrintTemplateSeeder`
  mengatur styling untuk elemen HTML rich text (`p`, `ol`, `ul`, `li`) agar
  jarak antar paragraf dan indentasi daftar bernomor/bullet rapi di cetakan PDF,
  serta tetap mendukung konten plain text lama (`white-space: pre-line`).
- **AC5.3** `QuotationSectionTemplateSeeder` tetap idempoten dan menyediakan
  isi awal 5 template standar yang kompatibel dengan editor maupun cetakan.
