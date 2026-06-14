# Requirements Document

## Introduction

Dokumen ini mendefinisikan persyaratan perbaikan dan peningkatan fitur Editor PrintTemplate. Cakupan meliputi perbaikan bug, peningkatan UX pada modal editor, perbaikan konfigurasi token dan tabel relasi, penambahan group variabel baru (docInfo), perbaikan style manager, penggantian block layout, serta perbaikan pada controller backend untuk pengiriman data saat print preview.

## Glossary

- **Editor**: Komponen GrapesJS editor yang digunakan untuk mendesain template cetak
- **Canvas**: Area visual pada editor tempat komponen template ditampilkan dan diedit
- **Token**: Placeholder handlebar (contoh: `{{doc.name}}`) yang akan diganti dengan data aktual saat cetak
- **Relation_Table**: Komponen tabel relasi (gjsRelationsTable) yang menampilkan data relasi many (hasMany)
- **Inspector**: Panel sidebar yang menampilkan pengaturan detail komponen yang dipilih
- **NestedSelect**: Komponen select bertingkat yang menampilkan opsi dalam hierarki parent-child
- **VariableItem**: Komponen UI pada sidebar yang merepresentasikan satu variabel/kolom data
- **CustomHTML_Editor**: Modal editor berbasis Monaco untuk mengedit HTML statis
- **StyleManager**: Panel pada sidebar tab "Style" untuk mengatur properti CSS komponen
- **PrintPreview**: Halaman preview cetak dokumen yang merender template dengan data aktual
- **DocInfo**: Group variabel baru berisi informasi meta dokumen (nama dokumen, dll)
- **Controller**: `App\Http\Controllers\Controller.php` yang menangani logika print
- **Preferences**: Data pengaturan perusahaan (company preferences) dari database
- **Static_HTML_Wrapper**: Komponen wrapper (`gjs-static-html-wrapper`) untuk konten HTML statis

## Requirements

### Requirement 1: Perbaikan Bug Slash Command pada Custom HTML Editor

**User Story:** Sebagai pengguna editor, saya ingin mengetik karakter "/" di dalam Custom HTML Editor tanpa memicu global command palette, sehingga saya dapat menulis kode HTML dengan bebas.

#### Acceptance Criteria

1. WHEN pengguna menekan tombol "/" di dalam CustomHTML_Editor, THE Editor SHALL mencegah event keydown tersebut dari propagasi ke parent yang memicu global command palette dengan memanggil `event.stopPropagation()`
2. WHEN pengguna menekan tombol "/" di dalam CustomHTML_Editor, THE CustomHTML_Editor SHALL memasukkan karakter "/" ke dalam konten editor secara normal tanpa efek samping

---

### Requirement 2: Perbesar Modal Custom HTML Editor

**User Story:** Sebagai pengguna editor, saya ingin modal Custom HTML Editor berukuran lebih besar, sehingga saya memiliki ruang kerja yang lebih luas untuk mengedit kode HTML.

#### Acceptance Criteria

1. WHEN modal CustomHTML_Editor ditampilkan, THE Editor SHALL menggunakan breakpoint `--breakpoint-xl` sebagai lebar maksimum modal
2. WHEN modal CustomHTML_Editor ditampilkan, THE Editor SHALL menampilkan area code editor dan area preview masing-masing dengan tinggi minimum 400px
3. THE CustomHTML_Editor SHALL membatasi tinggi maksimum konten modal agar tidak melebihi 92svh sehingga modal tetap berada dalam area viewport

---

### Requirement 3: Label Header Relation Table Sesuai Bahasa Aktif

**User Story:** Sebagai pengguna editor, saya ingin label pada header tabel relasi ditampilkan sesuai bahasa (lang) yang aktif, sehingga tampilan konsisten dengan pengaturan bahasa aplikasi.

#### Acceptance Criteria

1. WHEN Relation_Table dirender pada Canvas, THE Editor SHALL menampilkan label header kolom menggunakan terjemahan dari `titleTrans` key masing-masing kolom sesuai locale bahasa aktif yang dikonfigurasi pada field `default_language` di printTemplate, dengan fallback ke `title` lalu `name` jika terjemahan tidak tersedia
2. WHEN bahasa aktif (field `default_language` pada printTemplate) berubah, THE Editor SHALL memperbarui seluruh label header Relation_Table yang ada di Canvas menggunakan terjemahan bahasa yang baru tanpa memerlukan reload halaman
3. IF terjemahan untuk suatu kolom header tidak tersedia pada bahasa aktif, THEN THE Editor SHALL menampilkan nilai `title` kolom tersebut, atau jika `title` juga tidak tersedia, menampilkan nilai `name` kolom sebagai fallback

---

### Requirement 4: Pindahkan Pengaturan Kolom Relation Table ke Card Token Tabel Relasi

**User Story:** Sebagai pengguna editor, saya ingin pengaturan kolom untuk setiap relation table dipindahkan dari Inspector ke card "Token Tabel Relasi" pada tab Token, sehingga konfigurasi tabel relasi terpusat di satu tempat.

#### Acceptance Criteria

1. THE TokenConfigurationManager SHALL menampilkan pengaturan kolom (show/hide per kolom, urutan kolom via drag-and-drop atau tombol reorder) untuk setiap Relation_Table di dalam card "Token Tabel Relasi"
2. THE Inspector tab SHALL tidak lagi menampilkan RelationsInspector atau pengaturan kolom untuk Relation_Table (seluruh pengaturan kolom dipindahkan ke TokenConfigurationManager)
3. WHEN pengguna mengubah pengaturan kolom (show/hide atau urutan) pada card "Token Tabel Relasi", THE Editor SHALL memperbarui tampilan Relation_Table pada Canvas sesuai konfigurasi baru
4. WHEN card "Token Tabel Relasi" menampilkan Relation_Table yang belum memiliki kolom terkonfigurasi, THE TokenConfigurationManager SHALL menampilkan pesan empty state
5. IF pengguna menyembunyikan semua kolom, THEN THE TokenConfigurationManager SHALL tetap menampilkan Relation_Table pada Canvas dengan kondisi tabel kosong tanpa kolom header maupun data row

---

### Requirement 5: Tampilkan Hanya Node Relation Table yang Aktif pada Panel Token Tabel Relasi

**User Story:** Sebagai pengguna editor, saya ingin panel "Token Tabel Relasi" hanya menampilkan node relation table yang sedang aktif (selected) di canvas, sehingga saya fokus pada konfigurasi komponen yang sedang diedit.

#### Acceptance Criteria

1. WHEN sebuah komponen Relation_Table dipilih pada Canvas, THE TokenConfigurationManager SHALL menampilkan hanya konfigurasi Relation_Table yang dipilih tersebut pada panel "Token Tabel Relasi", menyembunyikan konfigurasi Relation_Table lain
2. IF tidak ada komponen Relation_Table yang dipilih pada Canvas (termasuk ketika komponen non-Relation_Table dipilih atau tidak ada komponen yang dipilih), THEN THE TokenConfigurationManager SHALL menampilkan pesan informasi bahwa tidak ada tabel relasi yang aktif
3. WHEN pengguna berpindah seleksi dari satu Relation_Table ke Relation_Table lain pada Canvas, THE TokenConfigurationManager SHALL langsung memperbarui panel untuk menampilkan konfigurasi Relation_Table yang baru dipilih

---

### Requirement 6: Gunakan Komponen NestedSelect pada Field labelKey, token, dan relationPath

**User Story:** Sebagai pengguna editor, saya ingin field "labelKey", "token", dan "relationPath" pada konfigurasi token menggunakan komponen NestedSelect, sehingga saya dapat memilih opsi secara hierarkis dan lebih mudah menavigasi struktur data.

#### Acceptance Criteria

1. THE TokenConfigurationManager SHALL menggunakan komponen NestedSelect sebagai pengganti komponen Select untuk field "labelKey", dengan prop `options` berisi tree structure dari dataTableColumns yang memiliki properti `label`, `value`, dan `children` untuk setiap node
2. THE TokenConfigurationManager SHALL menggunakan komponen NestedSelect sebagai pengganti komponen Select untuk field "token", dengan prop `options` berisi tree structure dari dataTableColumns
3. THE TokenConfigurationManager SHALL menggunakan komponen NestedSelect sebagai pengganti komponen Select untuk field "relationPath", dengan prop `options` berisi tree structure dari dataTableColumns yang difilter hanya node bertipe "relation" atau "relations" beserta children-nya
4. WHEN pengguna memilih opsi dari NestedSelect pada field "labelKey", "token", atau "relationPath", THE TokenConfigurationManager SHALL memperbarui formState atau relationConfigs dengan value yang dipilih
5. THE NestedSelect SHALL menampilkan opsi dalam struktur hierarki parent-child sesuai nesting asli dari dataTableColumns, di mana node yang memiliki sub-kolom ditampilkan sebagai parent yang dapat di-expand

---

### Requirement 7: Format Label Select pada Field Token

**User Story:** Sebagai pengguna editor, saya ingin label pada select field "token" ditampilkan dalam format handlebar sederhana seperti `{{date}}`, `{{code}}`, sehingga lebih mudah dibaca dan dipahami.

#### Acceptance Criteria

1. WHEN opsi token ditampilkan pada NestedSelect field "token", THE TokenConfigurationManager SHALL menampilkan label dalam format `{{nama_field}}` (contoh: `{{date}}`, `{{code}}`)
2. THE TokenConfigurationManager SHALL tidak menampilkan label token dalam format path lengkap (contoh: bukan `date -> {{doc.date}}`)
3. WHEN opsi token yang dipilih ditampilkan sebagai selected value, THE TokenConfigurationManager SHALL menampilkan dalam format `{{nama_field}}` yang sama

---

### Requirement 8: Filter Opsi pada Field Token

**User Story:** Sebagai pengguna editor, saya ingin field "token" hanya menampilkan kolom biasa dan relasi tunggal (relation), sehingga saya tidak bingung dengan opsi yang tidak relevan.

#### Acceptance Criteria

1. WHEN opsi ditampilkan pada dropdown "Handlebar Token" di Token_Configuration, THE TokenConfigurationManager SHALL menampilkan variabel bertipe kolom biasa (type "data") dan bertipe preferences
2. WHEN opsi ditampilkan pada dropdown "Handlebar Token" di Token_Configuration, THE TokenConfigurationManager SHALL juga menampilkan variabel bertipe relasi tunggal (type "relation") beserta opsi token yang dihasilkan dalam format `{{relation doc.path}}`
3. WHEN opsi ditampilkan pada dropdown "Handlebar Token" di Token_Configuration, THE TokenConfigurationManager SHALL tidak menampilkan variabel bertipe relasi many (type "relations") maupun child variabel yang berada di bawah relasi many tersebut
4. IF variabel bertipe "relations" memiliki nested children, THEN THE TokenConfigurationManager SHALL mengecualikan seluruh children tersebut dari daftar opsi dropdown "Handlebar Token"

---

### Requirement 9: Format Token untuk Relasi Tunggal

**User Story:** Sebagai pengguna editor, saya ingin token yang dihasilkan saat memilih item bertipe relasi tunggal menggunakan format `{{relation doc.branch}}`, sehingga template engine dapat memproses relasi dengan benar.

#### Acceptance Criteria

1. WHEN pengguna memilih item bertipe "relation" (relasi tunggal) pada field "Handlebar Token", THE TokenConfigurationManager SHALL menghasilkan token dalam format `{{relation doc.<nama_relasi>}}` (contoh: memilih "branch" menghasilkan `{{relation doc.branch}}`)
2. WHEN token relasi tunggal diterapkan ke komponen di Canvas dan template diekspor ke HTML, THE Editor SHALL menghasilkan output HTML yang memuat token `{{relation doc.<nama_relasi>}}` secara utuh tanpa modifikasi format
3. WHEN token relasi tunggal ditampilkan di Canvas, THE Canvas SHALL menampilkan format yang disederhanakan `{{branch}}` (tanpa prefix "doc." dan relation)
4. IF item yang dipilih bertipe "relation" namun path variabel tidak memiliki prefix "doc.", THEN THE TokenConfigurationManager SHALL secara otomatis menambahkan prefix "doc." sehingga format akhir tetap `{{relation doc.<nama_relasi>}}`

---

### Requirement 10: Filter Opsi pada Field relationPath

**User Story:** Sebagai pengguna editor, saya ingin field "relationPath" hanya mengizinkan pemilihan relasi many (relations), namun tetap menampilkan relasi tunggal sebagai parent untuk navigasi nested, sehingga saya dapat menemukan relasi many yang berada di dalam relasi tunggal.

#### Acceptance Criteria

1. WHEN opsi ditampilkan pada field "relationPath", THE TokenConfigurationManager SHALL menampilkan item bertipe "relations" (relasi many) sebagai opsi yang dapat dipilih (selectable)
2. WHEN opsi ditampilkan pada field "relationPath", THE TokenConfigurationManager SHALL menampilkan item bertipe "relation" (relasi tunggal) sebagai label parent yang tidak dapat dipilih (disabled), hanya berfungsi untuk menampilkan nested item bertipe "relations" di dalamnya
3. IF pengguna mencoba memilih item bertipe "relation" (relasi tunggal) pada field "relationPath", THEN THE TokenConfigurationManager SHALL mencegah pemilihan tersebut dan tidak mengubah nilai field
4. WHEN tidak terdapat item bertipe "relations" di dalam nested children dari suatu item bertipe "relation", THE TokenConfigurationManager SHALL menyembunyikan item "relation" tersebut dari daftar opsi
5. WHEN pengguna memilih item bertipe "relations" yang berada di dalam nested "relation", THE TokenConfigurationManager SHALL menyimpan full path relasi sebagai nilai field "relationPath"

---

### Requirement 11: Deteksi Token Relation pada Konfigurasi Token

**User Story:** Sebagai pengguna editor, saya ingin token `{{relation doc.branch}}` terdeteksi dengan benar pada konfigurasi token, sehingga token tersebut muncul di daftar "Token di Canvas" dan dapat dikonfigurasi ulang.

#### Acceptance Criteria

1. WHEN Canvas mengandung komponen variabel yang memiliki atribut `data-token` berisi format `{{relation doc.<nama_relasi>}}`, THE TokenConfigurationManager SHALL menampilkan token tersebut pada daftar "Token di Canvas"
2. WHEN token relation dipilih pada daftar "Token di Canvas", THE TokenConfigurationManager SHALL menampilkan form konfigurasi dengan field labelKey, token, dan variablePath yang sesuai
3. WHEN pengguna mengubah nilai field token melalui dropdown konfigurasi dan menekan tombol "Terapkan Konfigurasi", THE TokenConfigurationManager SHALL memperbarui atribut `data-token` pada komponen di Canvas
4. IF komponen variabel memiliki atribut `data-token` berisi format `{{relation doc.<nama_relasi>}}` namun `<nama_relasi>` tidak tersedia dalam daftar opsi variabel, THEN THE TokenConfigurationManager SHALL tetap menampilkan token tersebut pada daftar "Token di Canvas"

---

### Requirement 12: Preview Token Relation pada Canvas

**User Story:** Sebagai pengguna editor, saya ingin preview token `{{relation doc.branch}}` ditampilkan sebagai `{{branch}}` pada canvas, sehingga tampilan lebih ringkas dan mudah dibaca.

#### Acceptance Criteria

1. WHEN token `{{relation doc.<nama_relasi>}}` dirender pada Canvas, THE Editor SHALL menampilkan preview dalam format `{{<nama_relasi>}}` (tanpa prefix "relation doc.")
2. THE Editor SHALL mempertahankan token asli `{{relation doc.<nama_relasi>}}` pada atribut `data-token` untuk keperluan ekspor
3. WHEN token memiliki nested path seperti `{{relation doc.customer.address}}`, THE Editor SHALL menampilkan preview sebagai `{{customer.address}}`

---

### Requirement 13: Sembunyikan Nested Column untuk Tipe Relations (Many)

**User Story:** Sebagai pengguna editor, saya ingin VariableItem bertipe "relations" (many relasi) tidak menampilkan nested column, sehingga tidak membingungkan karena kolom tersebut dikonfigurasi melalui tabel relasi.

#### Acceptance Criteria

1. WHEN VariableItem bertipe "relations" (many relasi) ditampilkan pada sidebar, THE VariableItem SHALL tidak menampilkan tombol expand/collapse (ChevronRight) dan tidak merender CollapsibleContent
2. THE VariableItem SHALL tetap menampilkan nested column (collapsible children) untuk tipe "relation" (relasi tunggal), "data", dan "preferences"
3. WHEN VariableItem bertipe "relations" di-drag ke Canvas, THE Editor SHALL tetap membuat komponen Relation_Table dengan kolom yang sesuai (kolom dikonfigurasi melalui panel Token Tabel Relasi)

---

### Requirement 14: Kirim Data Preferences dan DocInfo pada Print Controller

**User Story:** Sebagai pengguna editor, saya ingin data preferences untuk group company dan payload docInfo dikirim saat printPreview/cetak dokumen, sehingga token yang mereferensikan data tersebut dapat dirender dengan benar.

#### Acceptance Criteria

1. WHEN fungsi print() dipanggil pada Controller, THE Controller SHALL menyertakan prop `preferences` dalam response Inertia::render berisi seluruh key-value dari tabel preferences (company_name, street, city, phone, email, logo, dll)
2. WHEN fungsi print() dipanggil pada Controller, THE Controller SHALL menyertakan prop `docInfo` dalam response Inertia::render berisi objek dengan minimal field `name` (nama dokumen dari model yang dicetak)
3. IF data preferences tidak dapat diambil dari database, THEN THE Controller SHALL tetap mengirim prop `preferences` sebagai array kosong dan melanjutkan render tanpa error
4. WHEN halaman print dirender, THE PrintPreview component SHALL menerima prop `doc`, `preferences` dan `docInfo` serta meneruskannya ke template context agar token `{{doc.*}}`, `{{company.*}}` dan `{{docInfo.*}}` menghasilkan nilai yang sesuai

---

### Requirement 15: Tambahkan Group DocInfo pada VariableItem

**User Story:** Sebagai pengguna editor, saya ingin tersedia group variabel baru "docInfo" yang berisi informasi meta dokumen (nama dokumen, dll), sehingga saya dapat menyisipkan informasi dokumen ke dalam template.

#### Acceptance Criteria

1. THE VariableManager SHALL menampilkan group baru "docInfo" yang berisi informasi terkait dokumen yang akan dicetak (minimal: nama dokumen/document name)
2. THE VariableManager SHALL menampilkan group "docInfo" pada semua jenis printTemplate (letter_head dan printTemplate document)
3. WHEN data docInfo dikirim dari backend, THE VariableManager SHALL menampilkan item-item docInfo sebagai variabel yang dapat di-drag atau di-klik ke canvas
4. WHEN item docInfo di-insert ke canvas, THE Editor SHALL menghasilkan token dalam format `{{docInfo.<field_name>}}` (contoh: `{{docInfo.name}}`)
5. WHEN token docInfo ditampilkan di Canvas, THE Canvas SHALL menampilkan format yang disederhanakan `{{name}}` (tanpa prefix "docInfo.")

---

### Requirement 16: Hilangkan Pengaturan Background pada Tab Style

**User Story:** Sebagai pengguna editor, saya ingin pengaturan background (selain background-color) dihilangkan dari tab style, sehingga panel style lebih sederhana dan hanya menampilkan opsi yang didukung.

#### Acceptance Criteria

1. THE StyleManager SHALL menyembunyikan properti background-image, background-repeat, background-position, background-size, dan background-attachment dari panel style dengan menambahkan ID properti tersebut ke `HIDDEN_PROPERTY_IDS`
2. THE StyleManager SHALL tetap menampilkan properti background-color pada panel style (tidak termasuk dalam daftar hidden)

---

### Requirement 17: Ganti Block Column dengan Block Multi Fungsi

**User Story:** Sebagai pengguna editor, saya ingin block "1 column", "2 columns", "3 columns", dan "2 columns 3/7" diganti dengan satu block multi fungsi yang tag-nya dapat diubah (default: div), sehingga lebih fleksibel.

#### Acceptance Criteria

1. THE Editor SHALL menghapus block "column1", "column2", "column3", dan "column3-7" dari daftar block di Blocks tab pada Sidebar
2. THE Editor SHALL menambahkan satu block baru bertipe container (droppable) dengan tag default `<div>` yang dapat menerima komponen lain sebagai children
3. WHEN block multi fungsi dipilih pada Canvas, THE Inspector/Traits panel SHALL menyediakan select untuk mengubah tag HTML dengan pilihan: div, section, article, aside, header, footer, main, nav, span
4. WHEN pengguna mengubah tag HTML melalui select di Inspector/Traits, THE Editor SHALL mengganti tag element pada komponen tanpa menghapus atau mengubah child components di dalamnya
5. WHEN block multi fungsi di-drop ke Canvas, THE Editor SHALL membuat komponen container kosong dengan tag `<div>` yang siap menerima komponen children

---

### Requirement 18: Tambahkan Pengaturan Class pada Tab Style

**User Story:** Sebagai pengguna editor, saya ingin dapat menambah dan menghapus CSS class pada komponen melalui tab style, sehingga saya dapat menggunakan class utility atau custom class.

#### Acceptance Criteria

1. THE StyleManager SHALL menampilkan field pengaturan "class" pada tab style yang menampilkan daftar class yang sudah diterapkan pada komponen yang dipilih
2. WHEN pengguna menambahkan class baru melalui input field, THE StyleManager SHALL menerapkan class tersebut pada komponen yang dipilih di Canvas
3. WHEN pengguna menghapus class (klik tombol hapus pada badge class), THE StyleManager SHALL menghapus class tersebut dari komponen yang dipilih
4. WHEN tidak ada komponen yang dipilih, THE StyleManager SHALL menyembunyikan atau menonaktifkan field pengaturan class

---

### Requirement 19: Gunakan Class Bootstrap pada Komponen Relations Table

**User Story:** Sebagai pengguna editor, saya ingin komponen relations table menggunakan class dari Bootstrap dengan width 100%, sehingga tampilan tabel konsisten dan responsif.

#### Acceptance Criteria

1. WHEN Relation_Table dirender, THE Editor SHALL menerapkan class Bootstrap `table` dan `table-bordered` pada elemen tabel HTML (`<table>`)
2. THE Relation_Table SHALL memiliki width 100% melalui class Bootstrap `w-100` yang diterapkan pada elemen tabel
3. WHEN Relation_Table di-export melalui toHTML(), THE Editor SHALL menyertakan class Bootstrap `table`, `table-bordered`, dan `w-100` pada output HTML tabel

---

### Requirement 20: Gunakan Modal untuk Edit Manual CSS

**User Story:** Sebagai pengguna editor, saya ingin mengedit manual CSS melalui modal terpisah, dan pada tab style hanya menampilkan nilai CSS yang sudah diterapkan, sehingga panel style lebih ringkas.

#### Acceptance Criteria

1. THE Style_Tab SHALL menampilkan manual CSS yang sudah diterapkan dalam format read-only text block (property: value pairs) tanpa editor yang bisa diedit langsung
2. WHEN pengguna mengklik tombol edit pada section manual CSS di Style_Tab, THE Style_Tab SHALL membuka modal dialog terpisah berisi MonacoCSSEditor
3. WHEN pengguna menyimpan perubahan pada modal CSS (klik save/apply), THE Editor SHALL memvalidasi sintaks CSS dan menerapkan properti CSS ke komponen yang dipilih
4. IF CSS mengandung syntax error saat pengguna mencoba menyimpan, THEN THE modal SHALL tetap terbuka dan menampilkan error indicator
5. WHEN pengguna menutup modal tanpa menyimpan (klik cancel atau close), THE Editor SHALL membuang perubahan yang belum disimpan
6. THE CSS modal SHALL menyimpan draft CSS per komponen sehingga membuka kembali modal untuk komponen yang sama menampilkan CSS terakhir yang disimpan

---

### Requirement 21: Format Penulisan Manual CSS

**User Story:** Sebagai pengguna editor, saya ingin menulis manual CSS langsung dalam format deklarasi CSS (contoh: `background-color:black; font-size:"12pt";`), sehingga penulisan lebih intuitif.

#### Acceptance Criteria

1. THE StyleManager SHALL menerima input manual CSS dalam format deklarasi langsung berupa pasangan `property: value;` yang dipisahkan oleh titik koma, tanpa memerlukan selector atau kurung kurawal
2. WHEN pengguna menyimpan CSS text di modal manual CSS, THE StyleManager SHALL parse deklarasi yang dipisahkan semicolon dan menerapkan properti CSS ke komponen yang dipilih
3. IF manual CSS input mengandung sintaks invalid (missing colon, missing value), THEN THE StyleManager SHALL menampilkan error indicator pada deklarasi yang invalid
4. WHEN valid manual CSS properties diterapkan, THE StyleManager SHALL merge dengan properti dari visual style panel, dengan manual CSS values mengambil precedence untuk properti yang overlap
5. IF pengguna menghapus semua manual CSS text, THEN THE StyleManager SHALL menghapus hanya properti manual CSS yang sebelumnya diterapkan, mempertahankan properti dari visual style panel

---

### Requirement 22: Penanganan CSS pada Node Body

**User Story:** Sebagai pengguna editor, saya ingin dapat menulis CSS format umum saat node body aktif, dan saat menyimpan hasilnya tidak dibungkus lagi ke `body{}`, sehingga tidak terjadi duplikasi wrapper `body{body{}}`.

#### Acceptance Criteria

1. WHILE node body yang aktif dipilih, THE StyleManager SHALL mengizinkan penulisan CSS dalam format umum dengan selector dan deklarasi (contoh: `body { color: black; } p { margin: 0; }`)
2. WHEN CSS disimpan pada node body, THE StyleManager SHALL menyimpan CSS langsung tanpa membungkus ulang ke dalam `body{}` (mencegah output `body{body{}}`)
3. WHEN CSS diekspor dari node body, THE Editor SHALL menghasilkan output CSS yang bersih tanpa nesting `body{}` yang berlebihan

---

### Requirement 23: Gunakan useLaravelReactI18n pada Editor

**User Story:** Sebagai pengguna editor, saya ingin seluruh teks UI pada editor menggunakan hook `useLaravelReactI18n` untuk internasionalisasi, sehingga editor mendukung multi-bahasa.

#### Acceptance Criteria

1. THE Editor SHALL menggunakan hook `useLaravelReactI18n` untuk semua label dan teks UI yang ditampilkan pada sidebar tab labels, toolbar button labels, dan panel headings
2. THE Editor SHALL tidak mengandung hardcoded user-facing strings; semua teks visible SHALL diambil via fungsi `t()` dari `useLaravelReactI18n`
3. WHEN bahasa aplikasi berubah, THE Editor SHALL me-render ulang semua teks UI dalam bahasa yang baru aktif tanpa memerlukan page reload
4. IF translation key tidak memiliki terjemahan untuk bahasa aktif, THEN THE Editor SHALL menampilkan translation key string sebagai fallback

---

### Requirement 24: Sembunyikan Outline dan Content pada Static HTML Wrapper saat Print

**User Story:** Sebagai pengguna editor, saya ingin outline dan content pada `::before` dari `gjs-static-html-wrapper` disembunyikan saat printPreview dan ekspor ke HTML/CSS, sehingga hasil cetak bersih tanpa elemen editor.

#### Acceptance Criteria

1. WHEN dokumen dalam mode printPreview, THE Editor SHALL menyembunyikan border/outline (properti `border: 2px dashed #6366f1`) pada `.gjs-static-html-wrapper`
2. WHEN dokumen dalam mode printPreview, THE Editor SHALL menyembunyikan content pada pseudo-element `::before` dari `.gjs-static-html-wrapper` (set `content: none` dan `display: none`)
3. WHEN HTML/CSS diekspor, THE Editor SHALL tidak menyertakan style `.gjs-static-html-wrapper` border/outline dan `::before` content pada output CSS
4. THE Editor SHALL mempertahankan style border dan `::before` pada mode editing normal di Canvas
