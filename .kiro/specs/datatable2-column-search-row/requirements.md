# Requirements Document

## Introduction

Search Bar `DataTable2` (spec `datatable2-advanced-search`) sudah mendukung pencarian per kolom, tetapi dinilai sebagian user masih sulit: user harus memilih kolom dari saran, lalu mengisi nilai, lalu menekan Enter berkali-kali. Spec ini menambahkan **baris input pencarian per kolom** tepat di bawah baris judul kolom: setiap kolom punya sel input sendiri, sehingga "kolom mana yang dicari" ditentukan oleh posisi sel, bukan oleh langkah memilih kolom.

Prinsip utama:

- **Sumber state tunggal tetap `filterTree`** (`DataTable2.jsx`). Badge di sel kolom adalah turunan leaf tree untuk kolom itu, persis seperti chip Search Bar atas adalah turunan tree yang sama. Tidak ada state filter kedua, sehingga sinkron dua arah tidak butuh kode sinkronisasi (perubahan di sel muncul sebagai chip di atas, dan sebaliknya).
- **Fitur sel = fitur Search Bar atas**: operator diturunkan dari tipe kolom (`resolveValueMode`), sintaks operator ketik yang sama (`! > >= < <= a..b a|b`, pemisah `|;`), picker nilai untuk list/boolean/date/relation, `Diisi`/`Tidak diisi`, badge nilai yang bisa diedit/dihapus.
- Baris filter **selalu tampil** di desktop (tanpa toggle).

Dokumen ini diturunkan dari pembacaan `SearchBar.jsx`, `columnSearch.js`, `searchChips.js`, `Table2.jsx`, `table.css`, dan `DataTable2.jsx` pada worktree ini. Seluruh butir yang sebelumnya bertanda `[TODO]` sudah diselesaikan lewat penelusuran kode dan keputusan user; tidak ada butir terbuka.

## Glossary

- **Baris Filter Kolom**: baris kedua di `<thead>` `Table2.jsx` berisi satu **Sel Filter** per kolom tampil (plus sel kosong untuk kolom checkbox/aksi).
- **Sel Filter**: komponen input + badge untuk satu kolom.
- **Badge Nilai**: representasi satu nilai (atau satu leaf) di dalam Sel Filter; kelas warna peran `value` (`CHIP_CLASS.value`, secondary) seperti chip nilai di kotak mode value SearchBar.
- **Leaf Kolom**: leaf `{k, o, v}` anak langsung root AND `filterTree` yang `k`-nya = kolom sel itu (untuk kolom relasi: `k` = kolom anak label, mis. `customer.name`, via `relationLabelColumn`).
- **Leaf Non-Sederhana**: kondisi di tree yang tidak bisa direpresentasikan sebagai Badge di satu sel: leaf di dalam grup (`advanced`), Chip Cari (`search`), atau root OR beranak > 1.
- **Search Bar atas**: `SearchBar.jsx` yang sudah ada.
- **Mode Value**: istilah existing SearchBar — mode input untuk mengisi nilai satu kolom (`mode === "value"`).
- **Host**: `DataTable2.jsx`, pemilik `filterTree`, `onTreeChange` (→ `persistFilterTree`), dan state `busy`.
- **Kolom Searchable**: kolom yang lolos `isColumnSearchable` (`columnSearch.js`): `searchable !== false`, tidak `hidden`/`ignore`/`parentCol`/meta-append, dan `resolveValueMode(column) !== null`.

## Requirements

### Requirement 1: Baris Filter Kolom di bawah header

**User Story:** As user halaman list, I want setiap kolom punya kotak pencarian sendiri tepat di bawah judul kolomnya, so that saya langsung mengetik/memilih nilai tanpa memilih kolom lebih dulu.

#### Acceptance Criteria

1. THE Table2 SHALL me-render Baris Filter Kolom sebagai `<tr>` kedua di dalam `<thead>`, berisi tepat satu Sel Filter per kolom tampil (`showedColumns`) dengan urutan yang sama dengan header.
2. THE Baris Filter Kolom SHALL selalu tampil pada desktop tanpa tombol toggle show/hide.
3. WHEN kolom checkbox (`selectable`) atau kolom aksi (`actions`) ada, THE Baris Filter Kolom SHALL menyisipkan sel kosong pada posisi grid yang sama agar sel lain tetap sejajar dengan header kolomnya.
4. WHEN user menambah, menyembunyikan, atau mengurutkan ulang kolom, THE Baris Filter Kolom SHALL mengikuti `showedColumns` terbaru tanpa reload.
5. WHEN user me-resize lebar kolom, THE Sel Filter SHALL ikut berubah lebar karena memakai grid template yang sama (`gridTemplateColumns`) dengan header.
6. THE klik atau fokus pada Sel Filter SHALL TIDAK memicu sort, drag reorder, atau aksi header kolom.
7. THE Baris Filter Kolom SHALL bersifat opt-in lewat prop `Table2` (mis. `columnFilter`) yang hanya diberikan oleh `DataTable2`; tanpa prop itu, `Table2` SHALL TIDAK merender baris filter dan tampilannya SHALL TIDAK berubah. (Terverifikasi: `Table2` juga dipakai langsung oleh `AdvanceSearchDialog` dan `SelectModel` dengan `isDynamicData` dan tanpa `filterTree`/`onTreeChange`; keduanya tidak boleh terpengaruh. Halaman Index lain memakai `DataTable2`, bukan `Table2` langsung.)

### Requirement 2: Sticky dan pengukuran tinggi header

**User Story:** As user, I want baris filter tetap terlihat bersama judul kolom saat saya menggulir data, so that saya bisa mengubah pencarian kapan saja.

#### Acceptance Criteria

1. THE aturan sticky di `resources/css/table.css` (`thead tr:first-child th { sticky top-0 }`) SHALL diperluas sehingga Baris Filter Kolom ikut sticky tepat di bawah baris judul kolom (`top` = tinggi baris judul, bukan 0).
2. THE efek `--group-sticky-top` di `Table2.jsx` SHALL mengukur tinggi gabungan baris judul + Baris Filter Kolom (observe SEMUA `th`/sel kedua baris, ambil tinggi terbesar per baris lalu jumlahkan), sehingga header grup (`GroupHeaderRow`) tetap menempel tepat di bawah Baris Filter Kolom.
3. WHEN tinggi sebuah Sel Filter berubah (badge bertambah, wrap), THE tinggi baris filter dan `--group-sticky-top` SHALL ikut diperbarui tanpa menunggu render ulang tabel.
4. THE baris filter SHALL memakai latar yang sama dengan header (`bg-muted`) dan z-index di bawah dropdown/popover Sel Filter.
5. THE prop `freezeColumn` (default 0 di `Table2`, tidak diberikan `DataTable2`) di `Header.jsx` hanya menonaktifkan drag handle dan transform dnd-kit, BUKAN sticky-kiri; oleh karena itu Sel Filter SHALL TIDAK punya perilaku khusus kolom beku: urutan sel mengikuti `showedColumns` seperti header, tidak ikut transform dnd-kit saat header diseret (sel baru berpindah saat urutan kolom berubah), dan sel tidak menjadi drag handle atau sortable item.

### Requirement 3: Sel Filter per tipe kolom

**User Story:** As user, I want sel filter menyesuaikan tipe kolomnya, so that saya mengisi nilai dengan cara yang paling natural untuk kolom itu.

#### Acceptance Criteria

1. THE Sel Filter SHALL menentukan mode dari `resolveValueMode(column)`: `text`, `number`, `relation`, `list`, atau `date`.
2. WHERE mode `text`/`number`, THE Sel Filter SHALL menyediakan input teks yang mengubah ketikan menjadi leaf lewat `buildLeafFromText`/`buildChipsLeaf` (operator default: `matches` untuk text, `=` untuk number; satu nilai bersimbol → operator sesuai simbol; ≥2 nilai → `in`/`!in`).
3. WHERE mode `list` (kolom boolean atau kolom ber-opsi), THE Sel Filter SHALL menyediakan input dengan dropdown opsi (`buildOptionList`/opsi boolean Ya/Tidak) yang meng-commit leaf `=`/`in`; kolom boolean SHALL hanya menerima satu nilai.
4. WHERE mode `relation`, THE Sel Filter SHALL mengikuti jalur SearchBar saat ini (revisi 4 spec existing, §13.2-13.3): ketikan dipakai mencari record lewat `useLinkModelOptions` (debounce 500ms, endpoint `model`) dan hasilnya tampil sebagai opsi; nilai terpilih SHALL menjadi leaf `=`/`in` (negasi `!=`/`!in`) ber-`v` record utuh. Label yang diketik persis dan belum ada di hasil fetch SHALL di-resolve ke record lewat `resolveRelationLabels`-setara; bila tak ada yang cocok SHALL tampil `option_not_found` dan tidak ter-commit. THE Sel Filter SHALL TIDAK membentuk leaf baru berupa `matches` pada kolom anak.
5. WHERE sebuah leaf lama `matches` pada kolom anak relasi bertitik (mis. `category.name`, berasal dari saved filter sebelum revisi 4) ada di tree, THE Leaf Kolom untuk kolom `category` SHALL mencakup leaf ber-`k` berawalan `category.`; leaf itu SHALL tampil sebagai Badge teks dan dapat diedit sebagai teks polos (pola fallback dotted-key `openEditorForChip`, tanpa fetch kolom anak).
6. WHERE mode `date`, THE Sel Filter SHALL menyediakan dropdown preset periode (`buildDatePresets`) dan widget `DateSelector`, serta menerima ketikan periode (`parseDateText`/`parseDatePeriod`) yang menghasilkan leaf `in_period`.
7. THE dropdown SEMUA tipe SHALL menyediakan opsi `Diisi` / `Tidak diisi` (`set` / `!set`) seperti Requirement 40 spec `datatable2-advanced-search`.
8. IF kolom bukan Kolom Searchable, THEN THE Sel Filter SHALL kosong dan tidak dapat difokus (tanpa input, tanpa tooltip error).
9. THE Sel Filter SHALL memakai `aria-label` berisi judul kolom (`columnTitle`) dan placeholder singkat sesuai mode.

### Requirement 4: Sintaks operator ketik sama dengan Search Bar

**User Story:** As user, I want sintaks operator di sel kolom sama dengan di Search Bar atas, so that saya tidak perlu mempelajari dua cara.

#### Acceptance Criteria

1. THE Sel Filter SHALL mengenali `!nilai` (negasi: `!matches`, `!=`, `!in`, `!in_period` sesuai mode), `>`, `>=`, `<`, `<=` nilai dan `a..b` (KHUSUS number), serta `a|b` / `a;b` (daftar → `in`), memakai `buildLeafFromText`/`parseMultiValueText`/`separatorsFor` yang sama dengan SearchBar.
2. IF kombinasi simbol tidak cocok untuk tipe kolom (mis. `>` pada kolom text), THEN THE Sel Filter SHALL memperlakukannya sebagai literal tanpa error (Requirement 19.6 spec existing).
3. IF ketikan number bukan angka valid, THEN THE Sel Filter SHALL menampilkan pesan `core.datatable.search.number_invalid` pada sel dan TIDAK meng-commit.
4. IF ketikan list/relation tidak cocok dengan label opsi mana pun, THEN THE Sel Filter SHALL menampilkan `core.datatable.search.option_not_found` dan TIDAK meng-commit.
5. WHEN Sel Filter difokus, THE Sel Filter SHALL membuka popover di bawah sel (dropdown opsi untuk list/relation/date; hanya petunjuk untuk text/number) yang footer-nya memakai `SearchLegend`/`legendTipsFor({scope: "value", vmode, isBoolean, hasChips, typing, editing, excluded, ...})` yang sama dengan Search Bar atas, sehingga petunjuk sintaks (`! | ; > >= < <= a..b`, Enter/Tab/Esc/⌫) mengikuti kondisi sel saat ini. THE placeholder input SHALL hanya berupa satu contoh singkat sesuai mode.

### Requirement 5: Badge Nilai di dalam Sel Filter

**User Story:** As user, I want nilai yang sudah saya isi tampil sebagai badge di kolomnya, so that saya melihat dan mengubah filter langsung di tempatnya.

#### Acceptance Criteria

1. THE Sel Filter SHALL menurunkan Badge Nilai dari Leaf Kolom di `filterTree` (bukan dari state lokal): leaf `in` multi-nilai menjadi satu Badge per nilai; leaf `=`/`matches` satu Badge.
2. THE label Badge SHALL hanya memuat nilai (judul kolom tidak diulang), dengan awalan operator bila bukan `=`/`in`/`matches` (mis. `≥ 100`, `≠ Draft`, `a..b`, `Diisi`), memakai logika label `searchChips.js` (`formatValueLabel`/`formatPeriodValue`) yang diekspos sebagai varian "tanpa judul kolom".
3. WHEN user mengklik Badge, THE Sel Filter SHALL masuk mode edit untuk nilai itu: nilainya dimuat ke input dan commit menggantikan Badge di posisinya (pola `startEditValueChip`).
4. WHEN user mengklik tombol `×` Badge, THE nilai SHALL dihapus dari leaf (leaf dihapus bila nilai terakhir) dan `filterTree` baru di-commit.
5. WHEN input kosong dan user menekan Backspace, THE Badge terakhir SHALL tersorot dulu; Backspace kedua SHALL menghapusnya (hapus 2 langkah seperti SearchBar).
6. THE Badge nilai negasi (`!=`, `!in`, `!matches`, `!in_period`) SHALL dibedakan visual (mis. coret/awalan `≠`) dan tooltip berisi label penuh.
7. WHILE lebar sel tidak muat semua Badge dalam satu baris, THE Badge SHALL membungkus (wrap) ke baris berikutnya di dalam sel; THE tinggi baris filter SHALL mengikuti sel tertinggi dan `--group-sticky-top` SHALL ikut (Requirement 2.2-2.3). THE tinggi sel SHALL dibatasi maksimum 3 baris Badge; selebihnya SHALL scroll vertikal di dalam sel (bukan membesarkan baris sticky), agar baris sticky tidak memakan viewport. THE tinggi baris judul + baris filter di dalam batas itu SHALL tetap terukur oleh `--group-sticky-top` (Requirement 2.2).

### Requirement 6: Interaksi dan commit

**User Story:** As user, I want alur ketik → Enter yang konsisten dengan Search Bar, so that perilakunya bisa ditebak.

#### Acceptance Criteria

1. WHEN user menekan Enter dengan ketikan valid pada mode text/number/relation, THE ketikan SHALL menjadi Badge (input dikosongkan, awalan `!` dipertahankan bila mode negasi); Enter berikutnya pada input kosong SHALL menyelesaikan dan meng-commit ke host.
2. WHEN ketikan memakai simbol tunggal (`>5`, `1..5`), THE leaf SHALL langsung di-commit tanpa Enter kedua (pola `hasValueSymbol`).
3. WHEN user memilih opsi di dropdown list/boolean/relation/date atau `Diisi`/`Tidak diisi`, THE pilihan SHALL menjadi Badge; kolom boolean dan `set`/`!set` SHALL langsung di-commit (tidak punya `in`).
4. THE HANYA Enter (dan pilihan opsi/aksi eksplisit seperti Requirement 6.3) yang meng-commit ke Host; WHEN fokus meninggalkan Sel Filter (blur/klik-luar), THE ketikan yang belum di-commit SHALL tetap berada di input sel (tidak di-commit, tidak dibuang) sampai user menekan Enter atau Escape. THE keputusan ini sengaja berbeda dari klik-luar = apply pada Search Bar atas, agar berpindah antar sel tidak memicu reload tak disengaja.
5. WHEN user menekan Escape, THE edit yang belum di-commit SHALL dibuang dan fokus tetap di sel.
6. THE commit SHALL memanggil `addLeafChip`/`updateChip`/`removeChip` (`searchChips.js`) lalu `onTreeChange(tree)` milik Host; leaf `=`/`in` pada kolom yang sama SHALL digabung seperti aturan `addLeafChip` existing.
7. WHILE Host sedang memproses commit sebelumnya (`busy`), THE Sel Filter SHALL menolak commit baru dan menampilkan indikator sibuk (seperti `busyRef` di SearchBar).
8. THE ketikan pada sel text/number/relation SHALL TIDAK memicu request reload per ketukan; request hanya terjadi saat commit (Enter/blur/pilih opsi). THE pencarian opsi relation SHALL memakai debounce yang sama dengan SearchBar.

### Requirement 7: Sinkron dua arah dengan Search Bar atas

**User Story:** As user, I want perubahan di kolom tampil di Search Bar atas dan sebaliknya, so that saya tidak melihat dua sumber kebenaran.

#### Acceptance Criteria

1. WHEN `filterTree` berubah dari sumber mana pun (Sel Filter, Search Bar atas, Builder lanjutan, Filter Tersimpan, klik sel data via `addFilter`, reload `?fid=`), THE Badge di semua Sel Filter SHALL ikut berubah.
2. WHEN user meng-commit nilai di Sel Filter, THE chip leaf yang sesuai SHALL muncul di Search Bar atas; WHEN user menghapus chip leaf di Search Bar atas, THE Badge terkait di Sel Filter SHALL hilang setelah tree ter-apply.
3. THE `draftTree` (beserta `draftGroup` dan `pendingSaved`) SHALL diangkat dari state internal `SearchBar` ke Host (`DataTable2`) sebagai state terkontrol, sehingga Search Bar atas dan Baris Filter Kolom membaca dan menulis draft yang SAMA (keputusan user: opsi B). THE Sel Filter SHALL membangun Badge dari `draftTree` (bukan `filterTree` terapan), sehingga chip yang sudah disusun di atas tetapi belum di-apply tampil juga di sel kolomnya.
4. WHEN user meng-commit dari Sel Filter (Enter/pilihan eksplisit, Requirement 6), THE Host SHALL menambah/mengubah/menghapus leaf pada `draftTree` lalu meng-apply SELURUH draft lewat jalur `applyDraft` yang sama dengan Search Bar atas (tree + group + saved filter terpilih), sehingga tidak ada kondisi draft atas yang hilang. THE perilaku ini SHALL teruji: draft atas yang belum di-apply sebelum commit sel SHALL tetap ada (dan ter-apply) setelah commit sel.
5. WHEN `filterTree` terapan berubah dari sumber luar (Builder, Filter Tersimpan, klik sel data via `addFilter`, reload `?fid=`), THE `draftTree` SHALL di-reset ke tree itu seperti perilaku `useEffect(() => setDraftTree(tree), [tree])` sekarang, dan sel serta chip atas SHALL ikut.
6. THE Search Bar atas SHALL tetap bisa dipakai host lain tanpa Host menyediakan draft (Advance Search Dialog `LinkModel`): `SearchBar` SHALL mendukung mode terkontrol (draft dari prop) DAN mode tak terkontrol (draft internal seperti sekarang), dengan perilaku mode tak terkontrol tidak berubah.
7. THE tidak ada state filter baru di Host selain `draftTree`/`draftGroup`/`pendingSaved` (terangkat) dan `filterTree` terapan; Sel Filter SHALL TIDAK menyimpan salinan kondisi filter yang bertahan antar render (state lokal hanya ketikan/edit sementara).

### Requirement 8: Kondisi yang tidak sesuai satu sel (Leaf Non-Sederhana)

**User Story:** As user, I want filter kompleks tidak merusak atau diam-diam tertimpa oleh baris filter kolom, so that kondisi lanjutan tetap aman.

#### Acceptance Criteria

1. THE Sel Filter SHALL hanya menampilkan Leaf Kolom = leaf anak LANGSUNG root AND; leaf di dalam grup (`advanced`), Chip Cari, dan grup lain SHALL TIDAK tampil sebagai Badge di sel.
2. WHERE sebuah kolom muncul pada Leaf Non-Sederhana, THE Sel Filter kolom itu SHALL menampilkan indikator kecil "juga dipakai di filter lanjutan" (tooltip) tanpa mengubah kondisi tersebut.
3. IF root tree bertipe OR beranak > 1 (seluruh tree tampil sebagai satu chip `Filter lanjutan (n)`), THEN Baris Filter Kolom SHALL TETAP AKTIF (tidak read-only): commit dari sel memakai perilaku `addLeafChip` existing yang membungkus root OR menjadi satu grup lalu menambahkan leaf baru dengan AND di bawah root AND baru, sehingga kondisi OR lama tidak hilang. THE kolom yang dipakai di dalam grup OR tersebut SHALL mendapat indikator Requirement 8.2.
4. WHEN user meng-commit dari Sel Filter, THE Leaf Non-Sederhana yang ada SHALL TIDAK berubah isinya (hanya leaf anak langsung root yang ditambah/diubah/dihapus; pembungkusan root OR pada 8.3 tidak mengubah isi grup).
5. THE leaf pada Kolom Searchable yang tidak bisa dibentuk ulang dari sintaks/picker sel SHALL tampil sebagai Badge read-only berlabel operator penuh (label `leafToChip`); mengkliknya SHALL memanggil `onOpenBuilder(draftTree)`, bukan mengedit di sel (pola sama dengan fallback akhir `openEditorForChip` di SearchBar). THE daftar leaf yang dianggap tak dapat diedit di sel (terverifikasi dari `operators.js` dan `buildLeafFromText`): (a) leaf mode kolom (`v.mode === "column"`, bandingkan dengan kolom lain); (b) kolom string bebas (tanpa opsi) dengan operator `=`, `!=`, `starts_with`, `ends_with`; (c) kolom number/currency dengan operator `!between`. Operator lain (`matches`, `!matches`, `in`, `!in`, `=`/`!=` pada kolom ber-opsi/boolean/relasi, `>`/`>=`/`<`/`<=`/`between`/`!=`/`=` pada number, `in_period`/`!in_period` pada date, `has`/`!has` pada kolom ber-opsi, `set`/`!set`) SHALL dapat diedit di sel.
6. THE keputusan "dapat diedit di sel atau tidak" SHALL dihitung oleh SATU fungsi murni bersama (`canEditLeafInCell(column, leaf)`) yang juga dipakai `openEditorForChip` Search Bar atas, agar kedua tempat tidak berbeda pendapat.
7. THE leaf pada kolom yang BUKAN Kolom Searchable (mis. `time`, `relations`, `json`) SHALL tetap hanya tampil di chip Search Bar atas; selnya kosong (Requirement 3.8) dan tidak menampilkan Badge.

### Requirement 9: Kompatibilitas dengan fitur tabel lain

**User Story:** As user, I want baris filter tidak merusak fitur tabel yang sudah ada.

#### Acceptance Criteria

1. WHEN grouping aktif (`GroupTree`), THE Baris Filter Kolom SHALL tetap tampil dan tetap bekerja; header grup sticky SHALL menempel di bawah Baris Filter Kolom (Requirement 2.2).
2. THE fitur sort, resize, reorder, Saved Filter (sort + group), Builder, dan klik sel data (`addFilter`) SHALL berperilaku sama seperti sebelum fitur ini.
3. WHILE viewport mobile (tampilan kartu, tanpa `<thead>`), THE Baris Filter Kolom SHALL TIDAK dirender dan Search Bar atas SHALL menjadi satu-satunya jalur pencarian.
4. WHEN data sedang dimuat (`isLoading`) atau kosong, THE Baris Filter Kolom SHALL tetap tampil agar user bisa mengubah/menghapus filter yang menyebabkan hasil kosong.
5. THE Search Bar atas SHALL tetap berfungsi penuh dan perilakunya SHALL TIDAK berubah (regresi nol pada `SearchBar.rtl.test.jsx`, `SearchPanel.rtl.test.jsx`, `ChipEditor.rtl.test.jsx`).

### Requirement 10: Reuse logika, bukan salin

**User Story:** As developer, I want logika input nilai dipakai bersama oleh Search Bar atas dan Sel Filter, so that dua tempat itu tidak menyimpang.

#### Acceptance Criteria

1. THE logika murni (parse ketikan → leaf, label nilai, merge/update/remove, resolusi opsi, periode) SHALL dipakai ulang dari `columnSearch.js` dan `searchChips.js`; fungsi baru yang dibutuhkan (mis. label Badge tanpa judul kolom, pemetaan leaf → Badge per kolom) SHALL ditambahkan di modul tersebut dengan tes unit.
2. THE logika stateful input nilai yang sekarang tertanam di `SearchBar.jsx` (state `checkedValues`/`textChips`/`dateChips`/`selectedRecords`, `computeCheckedLeafPatch`, `absorbPendingText`, `finishValueMode`, resolusi label relasi/opsi) SHALL DIEKSTRAK menjadi hook/komponen bersama yang dipakai oleh Search Bar atas DAN Sel Filter; salinan logika yang sama di dua file SHALL TIDAK dibuat (keputusan user).
3. THE ekstraksi SHALL dilakukan bertahap dengan jaring pengaman: seluruh tes `SearchBar.rtl.test.jsx` (5.805 baris), `SearchPanel.rtl.test.jsx`, dan `ChipEditor.rtl.test.jsx` SHALL lulus tanpa perubahan assertion setelah tiap tahap ekstraksi, dan SHALL dijalankan sebelum Sel Filter dibangun di atas hasil ekstraksi.
4. THE Sel Filter SHALL memuat kolom anak relasi secara lazy hanya saat sel relasi pertama kali difokus (pola `SearchBar` untuk `fetchRelationColumns`), BUKAN saat mount tabel, agar halaman dengan banyak kolom relasi tidak memicu banyak request awal.

### Requirement 11: Aksesibilitas dan keyboard

**User Story:** As user keyboard-only, I want bisa memakai baris filter tanpa mouse.

#### Acceptance Criteria

1. THE Tab SHALL memindahkan fokus ke Sel Filter berikutnya dalam urutan kolom; Shift+Tab ke sebelumnya.
2. THE panah atas/bawah di dropdown opsi, Enter, Escape, Backspace (hapus 2 langkah), dan Tab-autocomplete label opsi SHALL berperilaku sama seperti di Search Bar atas (`handleInputKeyDown`).
3. THE Sel Filter SHALL TIDAK mendaftarkan shortcut global; `/` dan `Ctrl/⌘+K` tetap milik `GlobalCommandPalette`.
4. THE input mentah SHALL bebas dari border/ring bawaan `@tailwindcss/forms` (memakai `border-0! shadow-none! focus:ring-0!` sesuai pola input SearchBar) dan fokusnya SHALL tetap terlihat lewat ring sel.
5. THE konten sel di dalam `table.resizeable-table` SHALL memakai `inline-flex!`/`flex-row!` pada elemen `span` yang perlu `display` selain block (aturan `table.css`: `td span { display:block }` menimpa utilitas).

### Requirement 12: i18n

#### Acceptance Criteria

1. THE semua teks baru (placeholder, petunjuk, indikator, keterangan read-only, `+N`) SHALL memakai kunci `core.datatable.search.*`/`core.datatable.column_search.*` di `lang/en` dan `lang/id`.
2. THE kunci baru SHALL TIDAK memiliki placeholder yang saling berawalan (`:to` vs `:total`); guard `LangPlaceholderPrefixTest` SHALL tetap lulus.

### Requirement 13: Pengujian dan verifikasi

#### Acceptance Criteria

1. THE fungsi murni baru SHALL punya tes unit Vitest (`.test.js`, environment node) berdekatan dengan source.
2. THE komponen Sel Filter SHALL punya tes React Testing Library `.rtl.test.jsx` (render komponen sungguhan, query berbasis role/label): input text/number dengan operator, picker list, badge edit/hapus, `+N`, read-only saat root OR, sinkron dengan `tree` prop.
3. THE integrasi `Table2`/`DataTable2` SHALL punya tes yang memastikan baris filter ter-render, tidak ter-render di mobile, dan commit sel memanggil `onTreeChange` dengan tree yang benar.
4. THE perilaku yang tak terlihat di jsdom (sticky `top` dua baris, `--group-sticky-top` gabungan, dropdown Radix/cmdk, klik label ganda, fokus/blur lintas sel) SHALL diverifikasi di browser sungguhan memakai production build (`npm run build`), termasuk kolom relasi, date, dan status, serta saat grouping aktif.
5. WHEN Leaf baru dari sel diuji di browser, THE `POST /saved-filters` (Simpan sebagai baru) SHALL diuji sekali karena `FilterTreeCleaner` membatasi operator tertentu (mis. boolean hanya `=`/`!=`).

### Requirement 14: Draft langsung (sinkron saat mengetik)

**User Story:** As user, I want ketikan di sel kolom langsung terlihat di Search Bar atas (dan sebaliknya) tanpa menunggu Enter, so that kedua tempat selalu menampilkan filter yang sama.

#### Acceptance Criteria

1. WHILE user mengetik/memilih nilai di Sel Filter ATAU di mode nilai Search Bar atas, THE ketikan yang sudah membentuk leaf valid SHALL ditulis ke draft bersama (`draftTree`) dengan debounce ringan (±150 ms), TANPA meng-apply ke host; chip Search Bar atas dan badge sel kolom SHALL berubah saat itu juga.
2. THE penulisan langsung SHALL hanya menyentuh LEAF MILIK sesi itu (dilacak lewat id), bukan snapshot seluruh tree, sehingga beberapa sel yang mengetik bergantian tidak saling menimpa.
3. WHEN ketikan menjadi tidak valid (mis. `>` atau angka tak lengkap), THE leaf sementara SHALL dihapus dari draft; WHEN valid lagi, SHALL ditulis kembali.
4. THE leaf sementara sesi baru SHALL ditulis tanpa merge ke leaf lain (`addLeafChip(..., {merge:false})`); sesi edit leaf SHALL memperbarui leaf aslinya di tempat dan menyimpan node aslinya.
5. WHEN sesi berakhir TANPA commit (Escape pada sel, Backspace-keluar, edit leaf dibatalkan karena fokus pergi), THE draft SHALL dikembalikan ke kondisi sebelum sesi: leaf sementara dihapus atau node asli dikembalikan.
6. WHEN user meng-commit (Enter/pilihan eksplisit), THE commit SHALL memakai tree tanpa leaf sementara sebagai dasar (`baseFor`) sehingga leaf final tidak ganda, lalu meng-apply seluruh draft seperti Requirement 7.4.
7. THE badge sel dan chip Search Bar atas milik sesi yang sedang aktif SHALL disembunyikan (nilainya sudah tampil sebagai chip nilai sesi), sedangkan sel/chip pihak lain SHALL menampilkannya.
8. THE Search Bar atas SHALL mengaktifkan draft langsung hanya bila host menyuplai draft terkontrol (prop `draft`); mode tak terkontrol (Advance Search Dialog LinkModel) SHALL berperilaku seperti sebelumnya.
9. THE klik di dalam Baris Filter Kolom SHALL TIDAK dianggap klik-luar oleh Search Bar atas (tidak meng-apply draft); apply hanya lewat Enter, tombol Search, atau klik-luar sungguhan.
10. THE apply SHALL tetap hanya terjadi pada Enter/pilihan eksplisit, tombol Search, atau klik-luar Search Bar; ketikan yang sudah masuk draft namun belum di-apply SHALL ditandai titik "belum diterapkan" di tombol Search.

## Di Luar Cakupan

- Advance Search Dialog di `LinkModel` (host kedua Search Bar) — tidak mendapat Baris Filter Kolom.
- Perubahan backend (`DataTableScope`, `FilterEvaluator`, saved filter) — semua operator yang dipakai sudah didukung.
- Toggle show/hide baris filter (diputuskan: selalu tampil).
- Filter per kolom pada tampilan mobile (kartu).
- Mengubah semantik staged-apply Search Bar atas (kapan draft di-apply: Enter-tertutup, tombol Search, klik-luar); yang berubah hanya lokasi state draft (Requirement 7.3).
