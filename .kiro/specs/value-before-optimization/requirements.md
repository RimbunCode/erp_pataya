# Requirements Document

## Introduction

Fitur log ERP menyimpan snapshot `data_before` & `data_after` tiap dokumen diubah. Saat user membuka halaman **"Tampilkan Perbedaan"** pada log, sistem menampilkan ulang form dokumen dalam mode read-only dengan field yang berubah di-highlight.

Saat ini mekanisme highlight (`valueBefore`) hanya berjalan untuk komponen `LinkModel`, dengan perbandingan berbasis string-label yang tidak bisa menangani tipe data lain (angka, tanggal, teks bebas, boolean, baris tabel). Penerapannya juga manual per field (`valueBefore={dataBefore.X}` ditulis tangan di tiap `Form.jsx`) sehingga dari ~40 modul dokumen di ERP ini, praktis hanya 1 modul (`Services/WorkOrders`) yang benar-benar menampilkan highlight — dan hanya untuk 3 field.

Spec ini mendefinisikan requirement untuk: (1) membuat mekanisme perbandingan before/after yang generik untuk semua tipe data, (2) mendistribusikan `valueBefore` secara otomatis lewat context form sehingga tidak perlu pengkabelan manual per field, (3) memperluas dukungan highlight ke semua jenis komponen input termasuk tabel baris (line-items), dan (4) memastikan hal ini berlaku konsisten di seluruh modul ERP tanpa mengubah backend maupun mengganggu mode edit normal.

## Glossary

- **Log**: record aktivitas perubahan dokumen (`App\Models\Core\Log`), menyimpan `data_before` dan `data_after` sebagai snapshot JSON.
- **Mode diff**: tampilan read-only sebuah form dokumen yang menunjukkan perbedaan field antara `data_before` dan `data_after`, diakses lewat halaman "Tampilkan Perbedaan" (`ShowLog` / `FormPageDiff`).
- **Mode edit normal**: tampilan form dokumen standar (create/edit), di mana tidak ada data pembanding (`dataBefore` kosong).
- **`valueBefore`**: prop yang diterima komponen input untuk menampilkan highlight bila nilainya berbeda dari `value` (nilai saat ini).
- **`dataBefore`**: object berisi snapshot nilai field sebelum perubahan, tersedia lewat context form saat mode diff.
- **Auto-inject**: mekanisme di mana `FormInput` secara otomatis menyisipkan `valueBefore` ke komponen anak berdasarkan nama field (`name`), tanpa perlu ditulis manual.
- **`ignoreDiff`**: prop opt-out pada `FormInput` untuk menonaktifkan auto-inject pada field tertentu.
- **Ghost row**: baris tabel yang hanya ada di `data_before` (dihapus di `data_after`), ditampilkan di mode diff sebagai baris read-only bertanda "dihapus".
- **`isChanged`**: fungsi util pembanding generik yang menentukan apakah dua nilai (dari tipe apa pun) dianggap berbeda secara semantik.

## Requirements

### Requirement 1: Perbandingan nilai generik lintas tipe data

**User Story:** As a pengguna ERP yang meninjau riwayat perubahan dokumen, I want sistem membandingkan nilai before/after secara akurat untuk semua jenis field (model referensi, angka, tanggal, teks, boolean), so that saya bisa melihat field mana saja yang benar-benar berubah tanpa false positive/negative.

#### Acceptance Criteria

1. THE sistem SHALL menyediakan satu fungsi pembanding (`isChanged`) yang dipakai seluruh komponen input untuk menentukan status berubah/tidak.
2. WHEN kedua nilai berupa objek model dengan `templateLink`, THE fungsi pembanding SHALL membandingkan berdasarkan label hasil render template, bukan referensi objek.
3. WHEN kedua nilai berupa tanggal (baik sebagai `Date` object maupun string ISO 8601), THE fungsi pembanding SHALL membandingkan berdasarkan nilai waktu (timestamp), bukan format string.
4. WHEN kedua nilai berupa angka atau string numerik yang merepresentasikan angka yang sama (mis. `5` vs `"5"`), THE fungsi pembanding SHALL menganggap keduanya sama.
5. WHEN kedua nilai kosong dalam bentuk berbeda (`null`, `undefined`, `""`), THE fungsi pembanding SHALL menganggap keduanya sama (tidak berubah).
6. WHEN salah satu nilai kosong dan yang lain berisi, THE fungsi pembanding SHALL menganggap keduanya berbeda.
7. WHEN kedua nilai berupa array atau object biasa (bukan model/tanggal), THE fungsi pembanding SHALL menggunakan deep-equality untuk menentukan perbedaan.
8. THE fungsi pembanding SHALL diuji dengan unit test (`diffUtils.test.js`) yang mencakup seluruh kasus tipe di atas.

### Requirement 2: Distribusi otomatis `valueBefore` ke komponen input

**User Story:** As a developer yang membuat/memelihara form dokumen, I want highlight before/after muncul otomatis tanpa harus menulis `valueBefore={dataBefore.X}` di setiap field secara manual, so that seluruh form di ERP dapat mendukung fitur ini tanpa kerja pengkabelan berulang dan rawan lupa.

#### Acceptance Criteria

1. WHEN sebuah field dibungkus `FormInput` dengan prop `name` yang valid DAN sistem sedang berada di mode diff, THE `FormInput` SHALL secara otomatis menyisipkan `valueBefore` ke komponen anak menggunakan `dataBefore[name]`.
2. IF komponen anak sudah memiliki `valueBefore` yang ditulis secara eksplisit, THEN THE `FormInput` SHALL mempertahankan nilai eksplisit tersebut dan tidak menimpanya dengan hasil auto-inject.
3. IF `FormInput` diberi prop `ignoreDiff`, THEN THE `FormInput` SHALL tidak melakukan auto-inject `valueBefore` untuk field tersebut.
4. WHEN sistem berada di mode edit normal (bukan mode diff), THE `FormInput` SHALL tidak menyisipkan `valueBefore` apa pun (tidak ada highlight yang tampil).
5. WHEN sebuah field tidak memiliki prop `name` atau `name` tidak match dengan key mana pun di `dataBefore`, THE `FormInput` SHALL membiarkan field tersebut tanpa highlight (tidak menimbulkan error).
6. THE context form (`FormPageProvider`/`useFormPageMeta`) SHALL menyediakan `dataBefore` sebagai bagian dari context yang bisa diakses `FormInput` tanpa perlu prop-drilling manual dari komponen form induk.

### Requirement 3: Dukungan highlight di semua jenis komponen input

**User Story:** As a pengguna ERP yang meninjau riwayat perubahan dokumen, I want semua jenis input (pilihan referensi, dropdown, tanggal, angka, teks pendek, teks panjang, checkbox) menampilkan highlight saat nilainya berubah, so that saya tidak melewatkan perubahan apa pun hanya karena tipe field tertentu tidak didukung.

#### Acceptance Criteria

1. WHEN nilai `valueBefore` berbeda dari nilai saat ini pada komponen `LinkModel`, THE komponen SHALL menampilkan highlight visual dan tooltip yang menunjukkan nilai sebelum dan sesudah.
2. WHEN nilai `valueBefore` berbeda dari nilai saat ini pada komponen `Select`, THE komponen SHALL menampilkan highlight visual dan tooltip berbasis label opsi.
3. WHEN nilai `valueBefore` berbeda dari nilai saat ini pada komponen `DatetimePicker`, THE komponen SHALL menampilkan highlight visual dan tooltip berbasis nilai tanggal terformat.
4. WHEN nilai `valueBefore` berbeda dari nilai saat ini pada `NumberInput`, THE komponen SHALL menampilkan highlight visual dan tooltip berbasis nilai angka terformat.
5. WHEN nilai `valueBefore` berbeda dari nilai saat ini pada input teks dasar (`ui/input`) atau area teks (`ui/textarea`), THE komponen SHALL menampilkan highlight visual; untuk area teks, tooltip SHALL menampilkan perbedaan teks secara visual (strikethrough untuk bagian dihapus, penanda untuk bagian ditambahkan).
6. WHEN nilai `valueBefore` berbeda dari nilai saat ini pada checkbox (`FormCheckbox`), THE komponen SHALL menampilkan highlight visual dan indikator status sebelum/sesudah (tercentang/tidak).
7. WHEN `valueBefore` bernilai `undefined` (tidak diberikan) pada komponen apa pun, THE komponen SHALL berperilaku identik dengan sebelum fitur ini ada (tidak ada highlight, tidak ada efek samping visual atau fungsional).
8. THE gaya visual highlight (warna, kelas) SHALL konsisten di semua komponen (memakai konstanta bersama dari `diffUtils`).

### Requirement 4: Highlight baris dan sel pada tabel baris dokumen (line-items)

**User Story:** As a pengguna ERP yang meninjau riwayat perubahan dokumen bertransaksi (mis. Sales Order, Purchase Order), I want melihat baris item mana yang ditambahkan, dihapus, atau diubah, so that saya bisa memahami perubahan detail transaksi tanpa membandingkan manual satu per satu.

#### Acceptance Criteria

1. WHEN sebuah baris ada di `data_after` tetapi tidak ada pasangannya (by `id`) di `data_before`, THE `FormTable` SHALL menandai baris tersebut sebagai "ditambahkan" dengan highlight visual berbeda dari baris berubah.
2. WHEN sebuah baris ada di `data_before` tetapi tidak ada pasangannya (by `id`) di `data_after`, THE `FormTable` SHALL menampilkan baris tersebut sebagai ghost row read-only pada posisi index asalnya di `data_before`, ditandai sebagai "dihapus" dengan highlight visual dan gaya strikethrough.
3. WHEN sebuah baris ter-match antara `data_before` dan `data_after` (by `id`) dan salah satu sel berubah, THE `FormTable` SHALL menampilkan highlight hanya pada sel yang berubah, menggunakan mekanisme diff yang sama seperti komponen input tunggal (Requirement 1 & 3).
4. WHEN dua baris ter-match tetapi tidak memiliki `id` (baris baru yang belum tersimpan saat snapshot diambil), THE `FormTable` SHALL menggunakan index posisi sebagai fallback pencocokan.
5. THE highlight baris/sel pada `FormTable` SHALL hanya aktif ketika form berada dalam mode diff (`disabled=true` dengan `dataBefore` tersedia); pada mode edit normal, `FormTable` SHALL berperilaku identik dengan sebelum fitur ini ada.
6. THE `FormTable` SHALL menentukan array pembanding `data_before` menggunakan `name` tabel sebagai key lookup ke `dataBefore` pada context, kecuali diberikan `valueBefore` secara eksplisit.

### Requirement 5: Konsistensi lintas modul tanpa regresi

**User Story:** As a pengguna ERP di modul mana pun (Sales, Purchase, Inventory, Finance, dll.), I want fitur tampilkan-perbedaan bekerja konsisten di semua dokumen, so that saya tidak perlu mengingat modul mana yang mendukung fitur ini dan mana yang tidak.

#### Acceptance Criteria

1. THE mekanisme auto-inject `valueBefore` SHALL berfungsi pada seluruh `Form.jsx` dan sub-form (mis. `FormDetail.jsx`) di seluruh modul ERP tanpa memerlukan modifikasi kode pada form yang field-nya sudah memiliki `name` yang sesuai dengan key `dataBefore`.
2. IF sebuah field memiliki `name` yang tidak sesuai dengan shape data aktualnya (mis. `name` duplikat atau field yang menampilkan data dari sumber berbeda dari `data[name]`), THEN developer SHALL dapat menandai field tersebut dengan `ignoreDiff` untuk mencegah highlight yang salah.
3. WHEN pengguna membuka form create atau edit dokumen dalam kondisi normal (bukan mode diff), THE sistem SHALL tidak menampilkan highlight apa pun pada field mana pun, identik dengan perilaku sebelum fitur ini diimplementasikan.
4. THE perubahan yang dilakukan untuk fitur ini SHALL bersifat frontend-only — tidak mengubah struktur database, migrasi, atau format penyimpanan `data_before`/`data_after` di backend.
5. THE mekanisme `valueBefore` eksplisit yang sudah ada (mis. di `Services/WorkOrders/Form.jsx`) SHALL tetap berfungsi tanpa perubahan setelah auto-inject diterapkan (kompatibel mundur).
6. WHEN fitur ini diverifikasi, THE verifikasi SHALL mencakup minimal satu modul dari tiap kategori: dominan `LinkModel` (mis. Purchase Order), dominan field primitif (mis. Item detail), dan dominan `FormTable`/line-items (mis. Sales Invoice).
