# Requirements Document

## Introduction

Spec ini diturunkan dari sesi brainstorming 2026-10-17. Tujuannya: developer bisa **mendesain tampilan sel** DataTable secara bebas (mis. judul tebal + subjudul redup, badge status + keterangan kecil di bawahnya, chip daftar relasi, donut persentase) tanpa terikat pada tampilan polos per-type yang ada sekarang, dan **tampilan itu konsisten** di semua komponen yang menampilkan data model (DataTable desktop & mobile, dropdown LinkModel/SelectModel, AdvanceSearchDialog, QuickListBlock).

Spec ini juga prasyarat fitur **Report Templates** (brainstorming terpisah, branch `feat/custom-reports`): kolom DataTable di report akan memakai mekanisme `template`, `expression`, dan pencarian Attribute yang sama.

Kondisi saat ini (hasil penelusuran):

- `templateLink()` per model sudah mendukung HTML mentah, placeholder `:field` / `:rel.field` / `:name{:alias}`, dan ternary (`resolveTernaryTokens` di `resources/js/lib/linkModelUtils.js`). Tag `<title>` dipakai sebagai teks polos (input terpilih); sisanya dirender HTML di dropdown LinkModel lewat `dangerouslySetInnerHTML` (`LinkModel.jsx:870`, `LinkModel/GroupedOptions.jsx:139`, `LinkModel/SourceSection.jsx:211`) dengan sorotan pencarian `<mark class="bg-yellow-500">` di node teks.
- Sel DataTable (`Cell` di `resources/js/Components/Table/Table2.jsx`) merender per `type` (relation, date, number/currency, boolean, image, formStatus, html). Kolom relasi tunggal hanya menampilkan teks `<title>`/teks polos pertama; kolom `type: 'relations'` (has-many) **tidak merender apa pun** (`Table2.jsx:238`).
- `dependsOn` ditulis manual dan wajib untuk accessor (`DataTableColumnSelector` strict).
- Kartu mobile `DataTable2` ditulis manual per halaman lewat prop `templateItem` (JSX).
- Badge (`Components/ui/badge.jsx`) hanya punya varian `default`, `secondary`, `destructive`, `outline`.
- `resources/css/app.css` hanya memindai `*.blade.php`, `*.js`, `*.jsx` via `@source`.
- `html-react-parser` dan `dompurify` sudah terpasang (tanpa dependensi baru).
- Konfigurasi kolom di-cache lewat `php artisan model:cache` (`ModelCacheCommand` → `DataTableConfigValidator::validate` + `DataTableConfigCache::warm`).

Yang **tidak** diatur di sini: konfigurasi oleh pengguna akhir lewat UI (hanya developer lewat PHP), mesin rumus ramah-pengguna (urusan Report Templates), export CSV/PDF DataTable (DataTable2 belum punya export), dan sorotan pencarian di sel DataTable.

## Glossary

- **Template kolom**: string di key `template` pada entri `configColumns` — HTML terbatas + placeholder + tag semantik — yang menentukan isi sel kolom tsb.
- **Placeholder**: token `:field`, `:rel.field`, `:rel.sub.field`, `:name{:alias}`, dan ternary (sintaks `templateLink` existing) yang diganti nilai data saat render.
- **Formatter**: akhiran pipe pada placeholder (`:created_at|datetime`) yang memformat nilai sebelum ditampilkan.
- **Tag semantik**: tag kustom (mis. `<badge>`, `<muted>`) di template yang dirender menjadi komponen UI bersama, bukan HTML apa adanya.
- **Renderer bersama**: satu komponen React (nama kerja `SemanticTemplate`) yang mengubah template + data baris menjadi elemen React; dipakai oleh semua konsumen di Requirement 11.
- **Kolom Attribute**: kolom `configColumns` yang bukan kolom DB fisik (accessor/append/virtual template), nilainya dihitung dari kolom lain yang dideklarasikan di `dependsOn`.
- **Kolom expression**: kolom dengan key `expression` berisi ekspresi SQL (string, ditulis developer) yang dievaluasi di database sebagai nilai kolom.
- **Kolom relasi banyak**: kolom `type: 'relations'` (has-many / belongs-to-many / morph-many).
- **Opsi A / Opsi B**: A = gaya lewat kelas Tailwind langsung di HTML template; B = gaya lewat tag semantik. B adalah cara utama; A tetap didukung.

## Requirements

### Requirement 1: Template tampilan per kolom

**User Story:** As developer, I want menulis template tampilan per kolom di `configColumns`, so that saya bisa menyusun isi sel (multi-baris, badge, teks redup, dll.) tanpa menulis komponen JSX per halaman.

#### Acceptance Criteria

1. THE entri `configColumns` SHALL menerima key opsional `template` (string) berisi HTML terbatas, placeholder, dan tag semantik.
2. THE placeholder di `template` SHALL memakai sintaks yang sama dengan `templateLink()` existing: `:field`, `:rel.field` (bertingkat), `:name{:alias}`, dan ternary.
3. THE placeholder SHALL mendukung formatter: `|date`, `|datetime`, `|relative` (mis. "2 jam lalu"), `|number`, `|currency`, `|percent`, dan `|trans` (memakai `valueTrans` kolom/field). Format angka & tanggal SHALL mengikuti preferensi user yang dipakai `Cell` saat ini (`preferences.default_number_format`, locale `lang`).
4. WHEN sebuah kolom punya `template`, THE `Cell` SHALL merender kolom itu lewat renderer bersama, menggantikan render per-`type` default.
5. WHEN sebuah kolom tidak punya `template`, THE `Cell` SHALL merender persis seperti sekarang (tidak ada perubahan perilaku).
6. WHEN template dirender di sel DataTable, THE tag `<title>` beserta isinya SHALL dibuang (diperlakukan seolah tidak ada).
7. THE nilai placeholder yang kosong/null SHALL dirender sebagai string kosong, bukan token placeholder mentah (berbeda dari `convertTemplateLink` existing yang mengembalikan token `:field` mentah bila nilainya null — perilaku existing itu tetap untuk jalur teks input terpilih, Requirement 14.2).

### Requirement 2: Ekstraksi `dependsOn` otomatis

**User Story:** As developer, I want kolom dan relasi yang dirujuk template terdeteksi otomatis, so that saya tidak perlu menulis `dependsOn` manual dan data yang dibutuhkan selalu ikut di-SELECT/eager-load.

#### Acceptance Criteria

1. THE backend SHALL mengekstrak `dependsOn` dari setiap placeholder di `template` (termasuk path relasi bertingkat, alias accessor, dan cabang ternary) dan dari `expression` bila memungkinkan.
2. WHEN entri kolom juga punya `dependsOn` manual, THE hasil ekstraksi SHALL digabung (union) dengan `dependsOn` manual.
3. THE `DataTableColumnSelector` SHALL memakai `dependsOn` gabungan itu untuk menentukan SELECT dan `with()` presisi, dengan aturan keamanan yang sama seperti `templateLink` (hanya kolom DB nyata yang di-SELECT; relasi lewat eager-load).
4. WHEN placeholder merujuk kolom/relasi yang tidak dikenal model, THE `DataTableConfigValidator` SHALL melaporkan violation (dan error di non-produksi, mengikuti pola strict `dependsOn` existing).
5. THE kolom yang disembunyikan model (`$hidden`, `ignore` di `configColumns`) SHALL TIDAK bisa diekspos lewat placeholder template.

### Requirement 3: Tag semantik dan renderer bersama

**User Story:** As developer, I want sekumpulan tag semantik yang dirender jadi komponen UI yang sama di seluruh aplikasi, so that tampilan konsisten antar-fitur dan ikut berubah bila desain komponennya berubah.

#### Acceptance Criteria

1. THE renderer bersama SHALL mendukung tag semantik berikut:

   | Tag | Perilaku |
   |---|---|
   | `<strong>` / `<b>` | Teks utama/tebal |
   | `<muted>` | Teks sekunder kecil redup |
   | `<stack>` | Susun anak secara vertikal dengan jarak konsisten |
   | `<inline>` | Susun anak secara horizontal dengan jarak konsisten |
   | `<badge color="…">` | Badge; warna dari atribut `color` atau dari peta `badgeColors` kolom (Requirement 4) |
   | `<status>` | Badge status dokumen memakai `BadgeStatus` existing |
   | `<dot color="…">` | Titik indikator warna |
   | `<nav-link to="…">` | Navigasi (Requirement 5) |
   | `<chips of="…" max="…">` | Daftar chip relasi banyak (Requirement 6) |
   | `<truncate>` | Satu baris terpotong "…" dengan tooltip teks penuh |
   | `<progress value="…" shape="…">` | Progress donut/bar (Requirement 7) |
   | `<icon name="…">` | Ikon lucide |
   | `<avatar src="…" name="…">` | Foto/inisial, pola `type: image` existing |
   | `<when field="…">` | Render anak hanya bila field terisi (truthy) |
   | `<mark>` | Sorotan (juga dipakai sorotan pencarian, Requirement 10) |

2. THE renderer SHALL juga menerima HTML dasar: `span`, `div`, `p`, `br`, `i`, `em`, `small`, `u`.
3. THE renderer SHALL menyanitasi **template** dengan DOMPurify memakai allowlist tag & atribut di atas; tag/atribut di luar allowlist (termasuk `script`, `style`, `iframe`, atribut `on*`, `href` mentah) SHALL dibuang.
4. THE nilai data yang mengisi placeholder SHALL selalu di-escape sebagai teks dan disisipkan **setelah** sanitasi template — nilai data SHALL TIDAK pernah diparsing sebagai HTML.
5. THE tag semantik SHALL dirender menjadi komponen React lewat opsi `replace` `html-react-parser` (dependensi existing; tanpa dependensi baru).
6. THE tag semantik tanpa anak SHALL boleh ditulis self-closing (`<icon name="truck"/>`), dan renderer SHALL menormalkannya menjadi pasangan buka/tutup sebelum parsing (parser HTML browser tidak menghormati self-closing pada elemen non-void).
7. THE tag navigasi SHALL bernama `<nav-link>`, bukan `<link>`: `<link>` adalah elemen HTML asli yang *void* (parser browser memecah `<link><strong>…</strong></link>` jadi elemen bersebelahan) dan dibuang DOMPurify secara default. `<progress>` (elemen asli non-void) aman diparsing sehingga namanya dipertahankan.

### Requirement 4: Gaya tampilan (Opsi B utama, Opsi A didukung)

**User Story:** As developer, I want mengatur warna badge per nilai dan, bila perlu, memakai kelas Tailwind langsung, so that saya punya cara konsisten untuk pola umum dan jalan keluar untuk kasus khusus.

#### Acceptance Criteria

1. THE entri `configColumns` SHALL menerima key opsional `badgeColors` (peta `nilai => warna`) yang dipakai `<badge>` tanpa atribut `color` di kolom tsb.
2. THE palet warna badge/dot SHALL berupa daftar nama tetap yang dipetakan ke kelas Tailwind di sisi JSX (sehingga ter-generate oleh build): `gray`, `blue`, `green`, `yellow`, `orange`, `red`, `purple`, plus varian existing `default`/`secondary`/`destructive`/`outline`. Nilai di luar daftar SHALL fallback ke `secondary`.
3. THE renderer SHALL mengizinkan atribut `class` pada tag di template (Opsi A).
4. THE `resources/css/app.css` SHALL menambahkan `@source` untuk file PHP model (`app/Models/**/*.php`) agar kelas Tailwind yang ditulis di `template`/`templateLink()`/`mobileTemplate()` ikut ter-generate saat build.

### Requirement 5: Navigasi `<nav-link>` dan hubungannya dengan `isLink`

**User Story:** As developer, I want bagian tertentu sel bisa diklik ke record terkait, so that kolom link tetap berfungsi walau isinya dirancang bebas.

#### Acceptance Criteria

1. WHEN `<nav-link>` ditulis tanpa atribut `to`, THE renderer SHALL menautkan ke record baris itu sendiri dengan aturan yang sama seperti `isLink` existing (`route` + `primaryKey`, cek izin `can("read")`).
2. WHEN `<nav-link to="rel">` ditulis, THE renderer SHALL menautkan ke record relasi `rel` dengan aturan yang sama seperti kolom `type: 'relation'` existing (`disabledNavigation`, `signedRouteKey`, `forceNavigation`, cek izin `canGlobal`).
3. WHEN izin tidak terpenuhi atau route tidak tersedia, THE isi `<nav-link>` SHALL tetap dirender sebagai konten biasa tanpa tautan.
4. THE `<nav-link>` SHALL boleh berisi tag non-interaktif apa pun (`strong`, `muted`, `badge`, `status`, `icon`, `avatar`, `stack`, `inline`, `truncate`, `dot`, `progress`), dan SHALL TIDAK boleh berisi `<nav-link>` lain atau `<chips>`.
5. WHEN kolom ber-`template` juga `isLink: true`, THE seluruh sel SHALL diperlakukan setara dengan template yang dibungkus `<nav-link>`.
6. WHEN kolom `isLink: true` DAN template-nya memuat `<nav-link>`, THE `DataTableConfigValidator` SHALL melaporkan violation (tautan bersarang tidak valid).

### Requirement 6: Kolom relasi banyak sebagai chip

**User Story:** As user, I want melihat daftar record anak (mis. Delivery Note sebuah SO) langsung di kolom tabel, so that saya tidak perlu membuka detail record.

#### Acceptance Criteria

1. THE kolom `type: 'relations'` SHALL dirender sebagai daftar chip, satu chip per record anak.
2. THE isi chip SHALL memakai `template` kolom bila ada, atau `templateLink()` model anak tanpa `<title>`.
3. THE jumlah chip yang tampil SHALL dibatasi properti `max` (kolom: key `max`; tag: atribut `max`), sisanya diringkas sebagai chip "+N". Default `max` = 3; WHEN `max` bernilai `0`, THE semua chip SHALL ditampilkan (tanpa batas, tanpa chip "+N").
4. THE setiap chip SHALL bisa diklik ke record anak dengan aturan navigasi relasi (Requirement 5.2).
5. THE backend SHALL meng-eager-load relasi banyak hanya dengan kolom yang dibutuhkan template chip (Requirement 2) — tanpa N+1.
6. THE tag `<chips of="rel" max="n">` SHALL merender relasi banyak `rel` dengan aturan yang sama di dalam template kolom lain.

### Requirement 7: Type `progress`

**User Story:** As user, I want persentase (mis. % terkirim, % tertagih) tampil sebagai donut atau bar, so that progres langsung terbaca sekilas.

#### Acceptance Criteria

1. THE entri `configColumns` SHALL menerima `type: 'progress'` dengan key `expression` berisi rumus nilai (Requirement 8).
2. THE nilai progress SHALL dibatasi ke rentang 0–100 dan dibulatkan 2 desimal di database (`LEAST(GREATEST(ROUND(expr, 2), 0), 100)` atau ekuivalen per driver).
3. WHEN hasil ekspresi NULL (mis. pembagi nol via `NULLIF`), THE sel SHALL menampilkan "–" (tanpa donut/bar).
4. THE tampilan default SHALL berupa **donut** dengan nilai (mis. `45,25%`) di tengah.
5. THE key `shape` (kolom) / atribut `shape` (tag `<progress>`) SHALL mengatur bentuk: `donut` (default) atau `bar` (batang horizontal + teks).
6. THE donut/bar SHALL digambar dengan SVG/CSS ringan (bukan instance chart library per sel).
7. THE warna progress SHALL biru (`blue`) selama nilai < 100 dan hijau (`green`) saat nilai = 100.

### Requirement 8: Kolom `expression` (SQL)

**User Story:** As developer, I want mendefinisikan kolom hitungan lewat ekspresi SQL, so that nilainya bisa ditampilkan, diurutkan, dan dicari tanpa memuat semua data.

#### Acceptance Criteria

1. THE entri `configColumns` SHALL menerima key `expression` (string ekspresi SQL, ditulis developer) untuk kolom bertipe `number`, `currency`, dan `progress`.
2. THE ekspresi SHALL dievaluasi di query sebagai `selectRaw`/subquery dengan alias nama kolom; ekspresi boleh berupa subquery relasi berkorelasi.
3. THE kolom expression SHALL dapat diurutkan dan dicari dengan operator number (Requirement 9.3).
4. THE ekspresi SHALL berasal hanya dari kode developer (`configColumns`); input pengguna SHALL TIDAK pernah digabung ke dalam string ekspresi — nilai pembanding dari filter SHALL dikirim sebagai binding.
5. THE `DataTableConfigValidator` SHALL memvalidasi ekspresi saat `model:cache` (mis. menjalankannya dalam query `LIMIT 0`) dan melaporkan violation bila gagal.

### Requirement 9: Pencarian kolom Attribute

**User Story:** As user, I want bisa mencari/filter pada kolom hasil hitungan atau template, so that kolom custom tidak menjadi kolom "mati" untuk pencarian.

#### Acceptance Criteria

1. THE kolom Attribute (append & kolom virtual tanpa `expression`) SHALL dapat dicari HANYA bila opt-in `searchable: true` di `configColumns` DAN `dependsOn`-nya terisi (manual atau hasil ekstraksi Requirement 2). Kolom ber-`expression` SHALL searchable secara default (dapat dimatikan dengan `searchable: false`).
2. WHEN kolom Attribute bertipe string, THE operator yang tersedia SHALL hanya `set`/`not_set` dan `matches`/`not_matches`:
   - `matches` = minimal satu kolom `dependsOn` mengandung teks (OR LIKE; kolom relasi lewat `whereHas`); `not_matches` = negasinya.
   - `set` = minimal satu kolom `dependsOn` terisi; `not_set` = semua kolom `dependsOn` kosong.
3. WHEN kolom Attribute bertipe number/currency, THE operator yang tersedia SHALL sama dengan kolom number existing, dievaluasi terhadap `expression` kolom; bila tidak ada `expression`, pencarian SHALL diizinkan hanya jika `dependsOn` berisi tepat satu kolom (dibandingkan langsung ke kolom itu).
4. THE perilaku per jenis kolom SHALL mengikuti tabel berikut:

   | Jenis kolom | Urutkan | Cari / filter | Group by |
   |---|---|---|---|
   | `template` di atas kolom DB nyata | Mengikuti kolom asli | Mengikuti kolom asli | Mengikuti kolom asli |
   | `template` virtual / Attribute tanpa `expression` | Tidak | String: AC 2 | Tidak |
   | Kolom `expression` (number/currency/progress) | Ya | Operator number | Tidak |
   | Relasi banyak (chip) | Tidak | `matches` ke kolom template anak (`whereHas`); `set`/`not_set` = punya/tidak punya anak | Tidak |

5. THE kolom yang tidak memenuhi syarat AC 1 SHALL tidak menampilkan input pencarian di baris pencarian kolom maupun di FilterTable.

### Requirement 10: Aturan `<title>` dan sorotan `<mark>`

**User Story:** As user, I want teks input terpilih tetap ringkas dan kata pencarian tersorot di dalam tampilan kaya, so that dropdown tetap mudah dipakai setelah tampilannya diperkaya.

#### Acceptance Criteria

1. THE `<title>` SHALL dipakai HANYA sebagai teks input terpilih LinkModel/SelectModel (fallback: teks polos pertama, perilaku existing).
2. THE opsi dropdown, chip, sel DataTable, dan kartu mobile SHALL membuang `<title>`.
3. THE pencocokan pencarian di LinkModel SHALL membuang `<title>` dan mencocokkan **teks yang terlihat** saja (bukan string HTML/nama tag).
4. WHEN renderer menerima prop `search`, THE renderer SHALL membungkus setiap kata yang cocok dengan `<mark>` bergaya `bg-yellow-500` di semua node teks, termasuk di dalam tag semantik, tanpa merusak struktur tag/atribut.
5. THE sorotan pencarian di sel DataTable SHALL tidak ditambahkan (di luar cakupan).

### Requirement 11: Konsumen renderer bersama

**User Story:** As developer, I want template dan tag semantik yang sama berlaku di semua komponen yang menampilkan record, so that satu definisi menghasilkan tampilan konsisten di mana-mana.

#### Acceptance Criteria

1. THE renderer bersama SHALL dipakai oleh: `Cell` (`Table2.jsx`, sehingga juga `DataTable2`, `SelectModel`, `AdvanceSearchDialog`, `QuickListBlock`), opsi dropdown LinkModel (`LinkModel.jsx`, `GroupedOptions.jsx`, `SourceSection.jsx`), chip relasi banyak, dan kartu mobile `DataTable2`.
2. THE `templateLink()` existing (mis. `<b>:code</b><br/><span>:name</span>`) SHALL tetap tampil sama seperti sekarang di dropdown LinkModel setelah dirender lewat renderer bersama.
3. THE `templateLink()` SHALL boleh memakai tag semantik (mis. `<muted>`, `<badge>`) dan hasilnya tampil di semua konsumen.

### Requirement 12: Template kartu mobile di model

**User Story:** As developer, I want mendefinisikan kartu mobile sekali di model, so that halaman tidak perlu menulis `templateItem` JSX untuk tampilan mobile yang umum.

#### Acceptance Criteria

1. THE model SHALL boleh mendefinisikan method statis `mobileTemplate()` yang mengembalikan template (sintaks & tag sama dengan Requirement 1–3).
2. WHEN halaman tidak memberi prop `templateItem`, THE `DataTable2` mode mobile SHALL merender kartu dari `mobileTemplate()` model.
3. WHEN halaman memberi prop `templateItem`, THE prop itu SHALL didahulukan (perilaku existing tidak berubah).
4. THE `dependsOn` untuk `mobileTemplate()` SHALL diekstrak otomatis (Requirement 2) dan ikut di-SELECT pada mode mobile.
5. WHEN model tidak punya `mobileTemplate()` dan halaman tidak memberi `templateItem`, THE perilaku mobile SHALL sama seperti sekarang.

### Requirement 13: Cache `model:cache`

**User Story:** As developer, I want hasil parsing template ikut di-cache, so that ekstraksi `dependsOn` dan validasi tidak diulang di setiap request.

#### Acceptance Criteria

1. THE `DataTableConfigCache::warm` SHALL menyimpan konfigurasi kolom baru (`template`, `badgeColors`, `expression`, `shape`, `max`, `dependsOn` hasil ekstraksi) serta template `mobileTemplate()`.
2. THE `php artisan model:cache` SHALL menjalankan validasi Requirement 2.4, 5.6, dan 8.5 lewat `DataTableConfigValidator::validate`.
3. WHEN cache dikosongkan (`--clear` / `DataTableConfigCache::forget`), THE konfigurasi baru SHALL ikut terhapus dan dihitung ulang saat warm berikutnya.

### Requirement 14: Kompatibilitas mundur

**User Story:** As developer, I want fitur ini tidak mengubah tampilan atau query halaman yang tidak memakainya, so that 70+ halaman DataTable existing aman.

#### Acceptance Criteria

1. THE kolom tanpa `template`/`expression`/`type: 'progress'` SHALL dirender dan di-query persis seperti sekarang.
2. THE `templateLink()` existing SHALL tetap menghasilkan teks input terpilih yang sama (`<title>` / teks polos pertama).
3. THE test existing `Table2*.rtl.test.jsx`, `DataTable2*.rtl.test.jsx`, `LinkModel*.rtl.test.jsx`, dan test backend DataTable SHALL tetap lulus.
