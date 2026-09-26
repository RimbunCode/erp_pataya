# Requirements Document

## Introduction

Halaman list berbasis `DataTable2` (`resources/js/Pages/Core/DataTable2.jsx`, dipakai 60+ halaman Index) saat ini **tidak punya pencarian teks sama sekali**. Penyaringan hanya bisa lewat dialog Filter (`FilterTable2`) berupa builder nested-tree yang dinilai sebagian user terlalu ribet untuk kebutuhan sehari-hari ("cari SO customer PT A yang masih draft"). Grouping dan filter tersimpan juga tersebar di tombol/dialog terpisah.

Spec ini menambahkan **search bar advance** bergaya hybrid Odoo + GitHub: satu kotak ketik yang menjangkau teks bebas, kondisi per kolom, nilai opsi, filter tersimpan (termasuk template shared), dan grouping. Kondisi aktif tampil sebagai chip yang bisa diedit langsung. Chip adalah representasi dari **filter tree yang sama** dengan `FilterTable2` — tidak ada state filter kedua. Tombol Filter dan Group by pindah ke panel dropdown di ujung search bar; Sort tetap di toolbar.

Sisi backend: model bisa mendeklarasikan `searchScope` (daftar kolom yang dicari teks bebas); saved filter diperluas agar ikut menyimpan sort dan group, dan `DataTableScope` menerapkan group dari filter aktif.

Dokumen ini diturunkan dari `design.md` (alur design-first); nomor § merujuk ke bagian di sana.

## Glossary

- **Search Bar**: komponen baru `resources/js/Components/Table/Search/SearchBar.jsx` — input + chip + dropdown saran.
- **Host**: komponen yang me-render Search Bar dan memiliki transport state-nya. Spec ini: `DataTable2`. Host kedua (Advance Search Dialog LinkModel) di spec terpisah.
- **Filter Tree**: struktur nested `{ root: { k: "and"|"or", c: { [id]: Node } } }` yang dipakai `FilterTable2`, di-persist sebagai `SavedFilter` dan dievaluasi `FilterEvaluator`.
- **Chip**: representasi visual turunan dari Filter Tree / group / saved filter sumber. Jenis: `leaf`, `search`, `advanced`, `group`, `source` (design §Data Models).
- **Chip Cari**: chip `search` — grup OR di Filter Tree yang semua anaknya leaf `matches` dengan nilai identik (≥2 anak).
- **Saran (Suggestion)**: item dropdown saat mengetik, terbagi 5 seksi: teks bebas, Filter Tersimpan, Kolom, Nilai, Kelompokkan.
- **Mode key / mode value**: mode input Search Bar — memilih kolom (key) vs mengisi nilai untuk kolom terpilih (value).
- **Panel ▾**: dropdown di ujung Search Bar berisi kolom Filter Tersimpan dan Group by.
- **Filter Tersimpan**: row `SavedFilter` named milik user (`is_saved=true`) atau shared (`is_shared=true`, dikelola halaman Filter Templates). Istilah existing di UI; istilah "Favorit" TIDAK dipakai.
- **Saved filter sumber**: Filter Tersimpan yang terakhir dipilih user dan menjadi asal Filter Tree aktif.
- **searchScope**: static property model `protected static array $searchScope` berisi daftar nama kolom (boleh path relasi bertitik) yang dicari oleh Chip Cari.
- **Kolom tampil**: kolom yang sedang terlihat di tabel menurut cookie visibility (`createHeaders()` di `Table2.jsx`).
- **Builder**: dialog `FilterTable2` (builder nested-tree existing).

## Requirements

### Requirement 1: Penempatan dan tata letak toolbar

**User Story:** As user halaman list, I want search bar berada di baris sendiri yang jelas milik tabel, dengan toolbar judul yang ringkas, so that halaman tidak ramai dan search bar tidak tertukar dengan search global di navbar.

#### Acceptance Criteria

1. THE DataTable2 SHALL me-render Search Bar pada baris tersendiri di antara baris judul halaman dan kartu tabel, dengan tombol Sort berada pada baris yang sama di sebelah kanan Search Bar.
2. THE baris judul DataTable2 SHALL hanya berisi judul, tombol Reload, dan tombol Tambah (bila diizinkan); tombol Filter, tombol clear filter (`X`), Popover Group by, dan Select granularity/range SHALL dihapus dari toolbar.
3. THE placeholder Search Bar SHALL memuat nama halaman (mis. "Cari Sales Order…") agar terbedakan dari search global.
4. THE Search Bar SHALL TIDAK mendaftarkan shortcut keyboard global apa pun; `/` dan `Ctrl/⌘+K` tetap milik `GlobalCommandPalette`.
5. WHEN user mengetik `/` di dalam input Search Bar, THE karakter SHALL masuk ke input dan palette global SHALL TIDAK terbuka.
6. WHILE viewport mobile, THE baris Search Bar SHALL full-width dengan tombol Sort berupa ikon saja, chip SHALL membungkus ke baris baru bila tidak muat, AND menu ⋯ SHALL hanya berisi Reload dan Tampilkan per halaman.

### Requirement 2: Chip adalah Filter Tree (satu sumber state)

**User Story:** As user, I want kondisi filter aktif tampil sebagai chip yang selalu sinkron dengan builder Filter, so that saya tidak pernah melihat dua tempat filter yang saling tidak tahu.

#### Acceptance Criteria

1. THE Search Bar SHALL menurunkan chip dari prop `tree` milik host lewat fungsi murni `treeToChips`, AND SHALL TIDAK menyimpan salinan kondisi filter di state sendiri.
2. WHEN user menambah, mengubah, atau menghapus chip, THE Search Bar SHALL menghasilkan Filter Tree baru dan memanggil `onTreeChange(tree)`; DataTable2 SHALL meneruskannya ke `persistFilterTree` existing.
3. WHEN Filter Tree berubah dari sumber lain (Builder, klik sel via `addFilter`, pemilihan Filter Tersimpan, reload dengan `?fid=`), THE chip SHALL ikut berubah tanpa kode sinkronisasi tambahan.
4. THE leaf anak langsung root `and` SHALL tampil sebagai chip `leaf` dengan format `Kolom: nilai` untuk operator `=`/`in` dan `Kolom <label operator> nilai` untuk operator lain.
5. THE grup OR anak langsung root yang memenuhi definisi Chip Cari SHALL tampil sebagai chip `Cari: <nilai>` dengan tooltip daftar kolom yang dicari.
6. THE grup lain anak langsung root SHALL tampil sebagai chip `Filter lanjutan (n)` dengan n = jumlah leaf di dalamnya.
7. IF root Filter Tree bertipe `or` dengan lebih dari satu anak, THEN seluruh tree SHALL tampil sebagai satu chip `Filter lanjutan (n)`.
8. THE label nilai chip SHALL memakai label opsi / `parseTrans` kolom; value relasi (objek record) SHALL dilabeli via `convertTemplateLink(record, "")` dengan fallback `name ?? code ?? id`; kolom yang tidak ter-resolve SHALL memakai key mentah.

### Requirement 3: Saran saat mengetik

**User Story:** As user, I want satu kotak ketik yang menyarankan teks bebas, kolom, nilai, filter tersimpan, dan grouping, so that saya bisa menjangkau semua fitur penyaringan tanpa membuka dialog.

#### Acceptance Criteria

1. WHEN user mengetik di mode key, THE Search Bar SHALL menampilkan saran berurutan dalam seksi: (1) teks bebas, (2) Filter Tersimpan, (3) Kolom, (4) Nilai, (5) Kelompokkan.
2. THE batas item per seksi SHALL: teks bebas 1, Filter Tersimpan 3, Kolom 5, Nilai 5, Kelompokkan 3.
3. THE pencocokan saran SHALL case-insensitive dan per kata (teks dipecah spasi).
4. THE seksi Kolom SHALL hanya memuat kolom `searchable !== false` yang bukan `hidden`/`ignore`/meta append — sama dengan penyaringan `FilterItem2`.
5. THE seksi Nilai SHALL memuat label opsi (`options`/`parseTrans`) dari kolom ber-opsi yang cocok dengan teks, ditampilkan sebagai `Kolom: Label`.
6. THE seksi Filter Tersimpan SHALL hanya tampil bila host memberi prop `model`; seksi Kelompokkan SHALL hanya tampil bila host memberi `groupOptions` tidak kosong; seksi teks bebas SHALL hanya tampil bila kolom pencarian (Requirement 5) tidak kosong. Seksi tanpa item SHALL TIDAK dirender.
7. THE item yang di-highlight saat daftar saran berubah SHALL selalu item pertama yang tampil (cmdk dikontrol via `value`/`onValueChange`).
8. THE setiap label saran SHALL me-mark bagian yang cocok memakai helper `highlightMatch` (`resources/js/lib/highlightMatch.jsx`) dan SHALL TIDAK memakai `dangerouslySetInnerHTML`.
9. WHEN user memilih saran Filter Tersimpan, THE Search Bar SHALL memanggil `onPickSaved(saved)`.
10. WHEN user memilih saran Kelompokkan, THE Search Bar SHALL memanggil `onGroupChange` dengan granularity default `month` untuk kolom date/time/datetime atau range pertama (`groupRangeOptions` kolom / default) untuk number/currency.
11. THE daftar Filter Tersimpan SHALL di-fetch dari `saved-filters.index` saat input pertama kali difokus (atau saat mount bila `activeFid` ada), di-cache, dan di-refresh setelah user menyimpan filter.

### Requirement 4: Teks bebas (Chip Cari)

**User Story:** As user, I want mengetik kata lalu Enter untuk mencari di kolom-kolom yang relevan, so that saya tidak perlu tahu kolom mana yang harus difilter.

#### Acceptance Criteria

1. WHEN user menekan Enter pada saran teks bebas, THE Search Bar SHALL menambahkan ke root Filter Tree satu grup `or` berisi leaf `{ k: <kolom>, o: "matches", v: <teks> }` untuk setiap kolom pencarian.
2. THE teks multi-kata SHALL diperlakukan sebagai satu frasa (tidak dipecah per kata).
3. WHEN Chip Cari kedua ditambahkan, THE Search Bar SHALL menambahkannya sebagai grup `or` terpisah (AND antar-pencarian).
4. THE daftar kolom pencarian SHALL dihitung SAAT Enter ditekan (via `getSearchColumns()`), bukan disimpan sebagai state, AND SHALL di-snapshot ke dalam Filter Tree.
5. IF kolom pencarian hanya satu, THEN chip hasil collapse `FilterTreeCleaner` (leaf `matches`) SHALL tampil sebagai chip `leaf` `Kolom mengandung <teks>` — perilaku ini SHALL dianggap benar.
6. THE deteksi Chip Cari SHALL berbasis pola (grup `or`, ≥2 anak, semua leaf `matches`, `v` identik), bukan penanda custom, karena `FilterTreeCleaner::cleanGroup()` membuang key selain `k`/`c`.

### Requirement 5: searchScope model dan fallback

**User Story:** As pengembang modul, I want menentukan kolom yang dicari teks bebas per model, dengan fallback otomatis bila tidak ditentukan, so that pencarian relevan tanpa wajib konfigurasi di setiap model.

#### Acceptance Criteria

1. THE trait `App\Traits\DataTable` SHALL menyediakan `public static function getSearchScope(): array` yang mengembalikan `static::$searchScope` bila properti itu dideklarasi model, atau `[]` bila tidak — memakai `property_exists` (pola `getDefaultGroupColumn()`), AND properti `$searchScope` SHALL TIDAK dideklarasikan di trait.
2. THE `DataTableScope` SHALL men-share prop Inertia `searchScope` berisi entri `getSearchScope()` yang lolos sanitasi: ter-resolve oleh `FilterColumnResolver::resolve()` (termasuk path relasi bertitik), `searchable !== false`, dan tipe kolom akhir `string`.
3. IF sebuah entri `searchScope` gagal sanitasi, THEN entri itu SHALL dibuang diam-diam (tanpa exception / error SQL).
4. WHEN prop `searchScope` tidak kosong, THE kolom pencarian SHALL sama dengan `searchScope`.
5. WHEN prop `searchScope` kosong, THE kolom pencarian SHALL = Kolom tampil ∩ kolom `searchable !== false` ∩ kolom level-atas bertipe `string`.
6. THE DataTable2 SHALL membaca Kolom tampil lewat `createHeaders({ ...mapColumns })` (salinan dangkal, karena `createHeaders` memutasi argumennya).

### Requirement 6: Mode value dan aturan penggabungan

**User Story:** As user, I want setelah memilih kolom langsung bisa mengisi nilainya sesuai tipe kolom, so that membuat kondisi per kolom secepat mengetik.

#### Acceptance Criteria

1. WHEN user memilih saran Kolom, THE Search Bar SHALL masuk mode value dengan prefix pill `[Kolom:]` dan operator default dari `getOperators(type, { typeRelation, hasOptions })`.
2. WHERE kolom punya opsi terbatas atau bertipe `boolean`, THE Search Bar SHALL menampilkan daftar nilai inline yang bisa difilter dengan mengetik.
3. WHERE kolom bertipe `string` tanpa opsi, WHEN user menekan Enter, THE Search Bar SHALL menambahkan leaf `matches`.
4. WHERE kolom bertipe `number`/`currency`, WHEN user menekan Enter dengan input numerik, THE Search Bar SHALL menambahkan leaf `=`; IF input tidak numerik, THEN THE Search Bar SHALL menampilkan pesan inline dan SHALL TIDAK commit.
5. WHERE kolom bertipe `date`/`datetime`/`time`/`relation`/`relations` atau tipe lain, THE Search Bar SHALL langsung membuka Chip Editor untuk kolom itu.
6. WHEN leaf `=`/`in` ditambahkan pada kolom yang sudah punya leaf `=`/`in` sebagai anak langsung root, THE Search Bar SHALL menggabungkannya menjadi satu leaf `in` dengan nilai unik (relasi dibandingkan via `.id`).
7. WHEN user menekan `Esc`, atau `Backspace` pada input kosong, di mode value, THE Search Bar SHALL kembali ke mode key.

### Requirement 7: Edit chip langsung

**User Story:** As user, I want mengubah nilai atau operator chip tanpa menghapusnya dulu, so that koreksi kecil tidak memaksa saya menyusun ulang kondisi.

#### Acceptance Criteria

1. WHEN user mengklik badan chip `leaf`, THE Search Bar SHALL membuka Chip Editor (popover) berisi label kolom, `Select` operator dari `getOperators()`, dan `ValueField` existing; menekan Terapkan atau Enter SHALL memperbarui node itu di Filter Tree.
2. WHEN user mengklik chip `search`, THE Chip Editor SHALL menampilkan input teks + info "Mencari di: …" dan mengganti `v` semua anak grup saat diterapkan.
3. WHEN user mengklik chip `group`, THE Chip Editor SHALL menampilkan pilihan kolom grup + granularity/range.
4. WHEN user mengklik chip `advanced`, THE Search Bar SHALL memanggil `onOpenBuilder()`.
5. WHEN user mengklik `×` pada chip, THE Search Bar SHALL menghapus node terkait dari Filter Tree (untuk chip `group`: `onGroupChange({ column: null })`).

### Requirement 8: Keyboard

**User Story:** As power user, I want mengoperasikan search bar sepenuhnya dengan keyboard, so that penyaringan cepat tanpa mouse.

#### Acceptance Criteria

1. THE Search Bar SHALL mendukung `↑`/`↓` untuk navigasi saran, `Enter` untuk memilih item yang di-highlight, dan `Esc` untuk keluar mode value / menutup dropdown.
2. WHEN user menekan `Backspace` pada input kosong di mode key, THE chip terakhir SHALL disorot; WHEN `Backspace` ditekan lagi, THE chip itu SHALL dihapus; tombol lain SHALL menghilangkan sorotan.

### Requirement 9: Panel ▾ (Filter Tersimpan dan Group by)

**User Story:** As user, I want satu panel untuk memilih filter tersimpan, menyimpan pencarian, membuka builder lanjutan, dan mengatur grouping, so that fitur yang dulu tersebar di beberapa tombol terkumpul di satu tempat.

#### Acceptance Criteria

1. WHEN user mengklik tombol ▾ di ujung Search Bar, THE Search Bar SHALL membuka Panel berisi kolom Filter Tersimpan dan (bila `groupOptions` diberikan) kolom Group by.
2. THE kolom Filter Tersimpan SHALL menampilkan daftar dari `saved-filters.index` dengan badge "Shared" untuk `is_shared`, penanda item yang sedang menjadi saved filter sumber, dan tombol hapus HANYA untuk item bukan shared.
3. THE kolom Filter Tersimpan SHALL berisi aksi "Simpan sebagai baru", "Timpa \"<nama>\"" (hanya bila saved filter sumber ada, dirty menurut Requirement 10.3, dan bukan shared), "Builder lanjutan" (→ `onOpenBuilder`), dan "Hapus semua filter" (→ `onTreeChange(null)`, hanya bila tree tidak kosong).
4. THE kolom Group by SHALL memakai `SearchableOptionList` dengan opsi "Tidak ada" paling atas, AND SHALL menampilkan sub-pilihan granularity (kolom date/time/datetime) atau range (kolom number/currency) untuk kolom grup aktif.
5. WHILE viewport mobile, THE Panel SHALL ditampilkan sebagai `Dialog` dengan kedua seksi bertumpuk.
6. THE UI SHALL memakai istilah existing ("Filter Tersimpan", "Shared", "Simpan sebagai baru", "Timpa") AND SHALL TIDAK memakai istilah "Favorit".

### Requirement 10: Badge saved filter sumber

**User Story:** As user, I want tahu filter tersimpan mana yang sedang aktif dan apakah sudah saya ubah, so that saya bisa memutuskan menimpa atau menyimpannya sebagai baru.

#### Acceptance Criteria

1. WHEN user memilih Filter Tersimpan, THE Search Bar SHALL menampilkan chip `source` `★ <nama>` di posisi paling depan.
2. WHEN halaman dimuat dengan `activeFid` yang ada di daftar `saved-filters.index`, THE chip `source` SHALL ditampilkan dengan nama dari daftar itu (bukan dari `saved-filters.show`, yang menyembunyikan `name` dari non-owner).
3. THE saved filter sumber SHALL dianggap **dirty** bila `isFilterTreeDirty(sumber.filter, tree)` bernilai true, ATAU `sumber.sort` tidak null dan berbeda dari sort aktif, ATAU `sumber.group` tidak null dan berbeda dari group aktif (kolom/granularity/range). WHILE dirty, THE chip `source` SHALL menampilkan titik kuning dengan tooltip `core.datatable.filter.saved.dirty`.
4. WHEN user mengklik `×` pada chip `source`, THE Search Bar SHALL memanggil `onTreeChange(null)` dan melepas saved filter sumber.
5. THE logika `isDirty` existing di `FilterTable2` SHALL diekstrak menjadi fungsi murni `isFilterTreeDirty(savedTree, currentTree)` (`resources/js/Components/Table/Filter/filterTreeCompare.js`) yang dipakai bersama `FilterTable2` dan Search Bar, dengan perilaku tidak berubah (urutan-independen, item belum lengkap ikut dibandingkan).

### Requirement 11: Filter tersimpan menyimpan tree + sort + group

**User Story:** As user, I want menyimpan pencarian lengkap dengan urutan dan pengelompokannya, so that memilih filter tersimpan mengembalikan tampilan persis seperti saat disimpan.

#### Acceptance Criteria

1. THE tabel `saved_filters` SHALL mendapat kolom `group` bertipe JSON nullable berbentuk `{ column, granularity, range }`; model `SavedFilter` SHALL meng-cast-nya `array` dan configColumns-nya SHALL `show: false`.
2. THE `UpdateSavedFilterRequest` SHALL memvalidasi `sort` (nullable string) dan `group` memakai `SavedFilter::groupValidationRules()`: `group` nullable array; `group.column` wajib bila `group` diisi; `group.granularity` nullable dan termasuk `DataTableScope::GROUP_GRANULARITIES` (`day`, `month`, `quarter`, `half`, `year`); `group.range` nullable numeric > 0. Validasi ini SHALL hanya memeriksa bentuk; gate `groupable` SHALL tetap dilakukan saat runtime (Requirement 12.4).
3. IF payload `group` tidak valid, THEN THE request SHALL ditolak dengan 422.
4. THE `SavedFilterController::update()` SHALL menyimpan `sort`/`group` hanya bila key-nya dikirim, SHALL tetap owner-only (403 untuk non-owner), AND response-nya SHALL menyertakan `sort` dan `group`. THE `SavedFilterController::index()` SHALL mengembalikan field `group`.
5. THE `SavedFilterController::store()` (jalur ephemeral) SHALL TIDAK berubah.
6. WHEN user memakai "Simpan sebagai baru" atau "Timpa" dari Panel, THE payload PATCH SHALL menyertakan `sort` dan `group` dari `getViewSnapshot()` host.
7. WHEN user memilih Filter Tersimpan, THE DataTable2 SHALL menerapkan tree, `fid`, `sort`, dan `group` (kolom + granularity + range) sekaligus tanpa POST baru; nilai `sort`/`group` `null` SHALL berarti jangan override nilai aktif.

### Requirement 12: DataTableScope menerapkan group dari filter aktif

**User Story:** As user yang membuka link `?fid=` atau halaman dengan default shared filter, I want grouping dari filter itu ikut diterapkan, so that tampilan konsisten dengan saat filter disimpan.

#### Acceptance Criteria

1. THE resolusi `$appliedFilter` di `DataTableScope` SHALL dipindah ke sebelum blok validasi group.
2. THE kolom grup SHALL ditentukan dengan prioritas: `?group=` bila param ada (termasuk nilai kosong = "Tidak ada") > `group.column` milik filter aktif > `getDefaultGroupColumn()` model.
3. THE granularity dan range grup SHALL ditentukan dengan prioritas: query param > `group` milik filter aktif > default existing.
4. IF kolom grup dari filter aktif tidak lolos gate `groupable`, THEN grouping SHALL diabaikan diam-diam.
5. WHEN request tanpa `fid` dan model punya default shared filter ber-`group`, THE group itu SHALL diterapkan.
6. THE `DataTableScope` SHALL men-share `defaultGroup`, `defaultGroupGranularity`, dan `defaultGroupRange` yang mencerminkan group efektif tanpa param (filter aktif ?? default model), AND DataTable2 SHALL memakainya sebagai state awal `options`.

### Requirement 13: Filter Templates mendukung group

**User Story:** As pengelola filter shared, I want mengatur group by pada template, so that template shared bisa berisi snapshot tampilan utuh seperti filter pribadi.

#### Acceptance Criteria

1. THE form `resources/js/Pages/Core/FilterTemplate/Form.jsx` SHALL menampilkan field Group by (kolom groupable + granularity/range kondisional) di sebelah field Sort existing.
2. THE `StoreFilterTemplateRequest` dan `UpdateFilterTemplateRequest` SHALL memvalidasi `group` memakai `SavedFilter::groupValidationRules()` yang sama (satu sumber aturan), AND `FilterTemplateController::store()`/`update()` SHALL menyimpannya dengan pola yang sama seperti `sort`.

### Requirement 14: Kontrak host-agnostic dan kompatibilitas mundur

**User Story:** As pengembang, I want Search Bar tidak terikat ke DataTable2, so that bisa dipakai ulang di Advance Search Dialog LinkModel pada spec berikutnya tanpa refactor.

#### Acceptance Criteria

1. THE Search Bar SHALL TIDAK mengimpor `router`, TIDAK membaca `usePage()`, dan TIDAK menulis `fid`; satu-satunya I/O mandiri SHALL fetch `saved-filters.index` saat `model` diberikan.
2. THE Search Bar SHALL menerima props sesuai kontrak design §2 (`columns`, `tree`, `onTreeChange`, `getSearchColumns`, `model`, `activeFid`, `onPickSaved`, `getViewSnapshot`, `group`, `groupOptions`, `onGroupChange`, `onOpenBuilder`, `placeholder`), dengan fitur opsional hilang otomatis bila prop-nya tidak diberikan.
3. THE `FilterTable2` SHALL menerima prop opsional `open`/`onOpenChange`; WHEN prop tidak diberikan, perilakunya SHALL identik dengan sebelumnya (termasuk pemakaian `trigger` custom oleh `AdvanceSearchDialog` LinkModel).
4. THE `SaveFilterControl` SHALL diekspor dari `FilterTable2.jsx` tanpa perubahan perilaku, dengan prop opsional baru `getViewSnapshot`.
5. THE logika inti (tree↔chip, saran, resolusi kolom pencarian, dirty check) SHALL berupa fungsi murni di modul terpisah yang bisa diuji tanpa render.
6. THE file baru SHALL berada di `resources/js/Components/Table/Search/` (aturan folder `{Domain}/{Feature}`).

### Requirement 15: Error handling dan busy state

**User Story:** As user, I want search bar tetap konsisten saat penyimpanan gagal atau lambat, so that chip tidak pernah menampilkan filter yang sebenarnya tidak diterapkan.

#### Acceptance Criteria

1. IF `onTreeChange` gagal (Promise reject), THEN chip SHALL tetap menampilkan tree sebelumnya (turunan dari prop `tree` yang tidak berubah) AND teks ketikan SHALL TIDAK dikosongkan.
2. WHILE Promise `onTreeChange` belum selesai, THE Search Bar SHALL menampilkan indikator loading dan SHALL menolak commit baru.
3. IF fetch `saved-filters.index` gagal, THEN seksi saran dan kolom Panel Filter Tersimpan SHALL kosong tanpa memblokir fitur lain.
4. IF kolom pencarian kosong setelah fallback, THEN seksi teks bebas SHALL TIDAK ditampilkan dan Enter tanpa item terpilih SHALL tidak melakukan apa pun.

### Requirement 17: Model staged-apply (menggantikan sebagian Requirement 2.2)

**User Story:** As user, I want menyusun beberapa kondisi pencarian dulu sebelum tabel benar-benar difilter ulang, so that saya tidak menunggu refetch tiap kali memilih satu kondisi saat masih menyusun beberapa sekaligus.

Requirement ini MENGGANTIKAN Requirement 2.2 untuk semua aksi KECUALI chip Cari (Requirement 4) — Requirement 2.2 (`onTreeChange` dipanggil setiap chip berubah) tetap berlaku HANYA untuk chip Cari.

#### Acceptance Criteria

1. THE Search Bar SHALL menyimpan `draftTree` (turunan awal dari prop `tree`) dan `draftGroup` (turunan awal dari prop `group`) sebagai state lokal; chip SHALL dirender dari `draftTree`/`draftGroup`, bukan dari prop `tree`/`group` langsung.
2. WHEN prop `tree` atau `group` berubah dari host (mis. setelah apply sukses, atau reload `?fid=`), THE `draftTree`/`draftGroup` SHALL resync mengikuti prop baru.
3. WHEN user memilih kolom+nilai, mengedit/menghapus chip, memilih Filter Tersimpan, atau mengubah Group, THE Search Bar SHALL memperbarui `draftTree`/`draftGroup`/`pendingSaved` (state lokal) SAJA DAN SHALL TIDAK memanggil `onTreeChange`/`onGroupChange`/`onPickSaved` pada saat itu.
4. WHEN user memilih saran/chip Cari (teks bebas), THE Search Bar SHALL TETAP langsung memanggil `onTreeChange` seperti Requirement 4 (tidak tertunda oleh staging).
5. THE Search Bar SHALL menyediakan `applyDraft()` yang: (a) IF ada `pendingSaved`, memanggil `onPickSaved(pendingSaved)` dan mengosongkan `pendingSaved`; (b) ELSE, memanggil `onTreeChange(draftTree)` bila `draftTree` berbeda dari `tree` (`isFilterTreeDirty`) dan/atau `onGroupChange(draftGroup)` bila `draftGroup` berbeda dari `group`; (c) TIDAK melakukan apa pun bila tidak ada yang berbeda.
6. `applyDraft()` SHALL dipanggil pada TIGA jalur saja: (a) `Enter` ditekan di input SAAT dropdown/panel tertutup; (b) tombol Search diklik; (c) klik di luar Search Bar (`ClickAwayListener`).
7. THE jalur klik-luar (6c) SHALL menggunakan `ClickAwayListener` yang sudah ada untuk `closeDropdown` — SHALL TIDAK memicu `applyDraft()` untuk klik pada elemen internal Search Bar (tombol chevron, tombol Search, tombol Builder lanjutan, item Panel/saran/Chip Editor), termasuk yang di-portal Radix.
8. IF `onTreeChange` yang dipanggil dari `applyDraft()` gagal (Promise reject), THEN `draftTree` SHALL TETAP seperti sebelum kegagalan (TIDAK ter-revert ke prop `tree` lama) sehingga user bisa mencoba Terapkan lagi tanpa kehilangan susunan chip; toast error SHALL tetap tampil seperti Requirement 15.1.
9. WHILE `applyDraft()` sedang berjalan (Promise pending), THE tombol Search SHALL disabled dan menampilkan indikator loading; `Enter`/klik-luar SHALL TIDAK memicu `applyDraft()` baru sampai selesai.

### Requirement 18: Indikator draft, tombol Search, dan animasi chevron

**User Story:** As user, I want tahu kapan ada perubahan yang belum diterapkan dan cara memicunya secara eksplisit, so that saya tidak bingung kenapa tabel belum berubah.

#### Acceptance Criteria

1. THE Search Bar SHALL menampilkan tombol Search (ikon kaca pembesar) di ujung bar, di sebelah tombol chevron.
2. WHEN `pendingSaved` terisi, ATAU `draftTree` berbeda dari `tree`, ATAU `draftGroup` berbeda dari `group`, THE tombol Search SHALL menampilkan indikator aksen visual (titik, pola sama dengan indikator dirty Requirement 10.3); WHEN tidak ada perbedaan, indikator SHALL hilang.
3. WHEN tombol Search diklik, THE Search Bar SHALL memanggil `applyDraft()` (Requirement 17.5).
4. THE ikon chevron SHALL berotasi 180° dengan transisi CSS saat Panel ▾ terbuka, dan kembali ke posisi semula saat tertutup.

### Requirement 19: Sintaks ketik `kolom:operator?value`

**User Story:** As power user, I want mengetik langsung `kolom:nilai` tanpa mengklik saran, so that menyusun kondisi secepat mengetik seperti pencarian GitHub.

#### Acceptance Criteria

1. WHEN user menekan `:` di mode key SAAT ada item seksi Kolom yang sedang di-highlight keyboard, THE Search Bar SHALL mencegah karakter `:` masuk ke input DAN memanggil aksi yang sama dengan mengklik saran kolom itu (masuk mode value untuk kolom tersebut).
2. WHEN user menekan `:` SAAT item yang di-highlight BUKAN dari seksi Kolom (atau tidak ada item ter-highlight), THE karakter `:` SHALL masuk ke input seperti karakter biasa, tanpa aksi khusus.
3. WHILE mode value untuk kolom bertipe `text`/`number`/`relation` (bukan list/boolean/date), WHEN teks yang diketik diawali `!`, THE Search Bar SHALL memakai operator negasi (`!matches` untuk text/relation, `!=` untuk number) dan SHALL memperlakukan sisa teks setelah `!` sebagai value.
4. WHILE mode value untuk kolom `number`, WHEN teks diawali `>`, `>=`, `<`, atau `<=`, THE Search Bar SHALL memakai operator perbandingan sesuai simbol itu.
5. WHILE mode value untuk kolom `text`/`number`/`relation`, WHEN teks berbentuk beberapa nilai dipisah koma tanpa awalan simbol lain, THE Search Bar SHALL memakai operator `in` dengan array nilai hasil split-trim koma.
6. IF kombinasi simbol tidak valid untuk tipe kolom aktif (mis. `>` pada kolom text), THEN Search Bar SHALL memperlakukan seluruh teks (termasuk simbolnya) sebagai value literal dengan operator default — SHALL TIDAK menampilkan error blocking.
7. THE sintaks ketik ini SHALL TIDAK berlaku untuk kolom list/boolean/date — kolom itu tetap hanya bisa diisi lewat klik pada daftar nilai/preset inline (Requirement 6.2).

### Requirement 20: Bobot relevansi saran gabungan

**User Story:** As user, I want saran yang paling relevan (dan yang baru saya pakai) muncul lebih dulu, so that saya tidak perlu menyisir daftar panjang.

Requirement ini MENGGANTIKAN urutan seksi TETAP di Requirement 3.1 — urutan seksi sekarang dinamis mengikuti skor tertinggi di dalamnya, bukan urutan (1)-(5) yang tetap.

#### Acceptance Criteria

1. THE Search Bar SHALL memberi skor tiap item saran: match prefix (awal label atau awal salah satu kata dalam label) SHALL berskor lebih tinggi daripada match substring di tengah kata.
2. UNTUK seksi Kolom, WHEN nama kolom ada dalam daftar `lastUsedColumns` tersimpan (lihat AC4), THE item itu SHALL mendapat tambahan skor (boost) — diposisikan di bawah match prefix murni tapi di atas match substring biasa yang belum pernah dipakai.
3. THE item DALAM tiap seksi SHALL diurutkan skor menurun; SEKSI itu sendiri SHALL diurutkan ulang berdasarkan skor item tertinggi di dalamnya (bukan urutan tetap); seksi kosong tetap tidak dirender (Requirement 3.6 tidak berubah).
4. WHEN user memilih kolom (lewat klik ATAU sintaks `:` Requirement 19), THE Search Bar SHALL menyimpan nama kolom itu ke `lastUsedColumns` (localStorage key `searchbar.recent.<model>`, terbaru di depan, dedup, dibatasi 8 entri).
5. IF `model` tidak diberikan, THEN `lastUsedColumns` SHALL selalu kosong (fitur boost nonaktif, TIDAK error).

### Requirement 21: Pengujian

**User Story:** As tim pengembang, I want fitur ini teruji di level fungsi murni, komponen, dan backend, so that regresi di 60+ halaman Index terdeteksi CI.

#### Acceptance Criteria

1. THE modul `searchChips.js`, `searchSuggestions.js`, `resolveSearchColumns.js`, dan `filterTreeCompare.js` SHALL punya unit test co-located (`.test.js`, environment node) yang mencakup aturan design §5.1–§5.4.
2. THE komponen `SearchBar`, `SearchPanel`, `ChipEditor` SHALL punya test RTL (`.rtl.test.jsx`); test existing `FilterTable2.rtl.test.jsx` dan `DataTable2.rtl.test.jsx` SHALL diperbarui dan tetap hijau.
3. THE test RTL SHALL TIDAK memakai `vi.useFakeTimers()` bersama Radix Popover/cmdk; assertion asinkron SHALL memakai `waitFor` dari `@testing-library/react`.
4. THE backend SHALL punya test PHPUnit untuk: validasi `sort`/`group` di `SavedFilterController::update()`, `group` di `index()`, `group` di `FilterTemplateController`, prioritas & fallback group di `DataTableScope` (Requirement 12), dan sanitasi `searchScope` (Requirement 5.2–5.3).
5. THE fitur SHALL diverifikasi visual di browser memakai `npm run build` setelah `php artisan migrate` di DB lokal.
6. THE test `SearchBar.rtl.test.jsx` SHALL mencakup Requirement 17-19 secara eksplisit: Enter saat panel tertutup memicu `applyDraft` (bukan per-pick); pick kolom + isi value + Enter (mode value) TIDAK memanggil `onTreeChange` sampai salah satu dari 3 jalur Requirement 17.6 dipanggil; klik tombol Search memanggil `onTreeChange`/`onGroupChange` dengan draft terakumulasi; klik ke tombol chevron/Builder lanjutan/item Panel/saran TIDAK memicu `applyDraft` (regresi eksplisit kekhawatiran klik-luar salah-trigger); klik-luar sungguhan dengan draft pending MEMICU `applyDraft`; `onTreeChange` reject TIDAK me-revert `draftTree`; sintaks `:` pada highlight kolom vs bukan kolom; chip Cari tetap instant-apply.
7. THE test `searchSuggestions.test.js` SHALL mencakup Requirement 20: prefix mengalahkan substring, boost `lastUsedColumns`, urutan seksi mengikuti skor tertinggi (bukan urutan tetap).
8. THE test `columnSearch.test.js` SHALL mencakup Requirement 19: `buildLeafFromText` cabang `!`, `>`/`>=`/`<`/`<=` (khusus number), koma → `in`, dan kombinasi tak valid jatuh ke value literal.

### Requirement 22: Live-suggestion record untuk kolom relation (Revisi 4)

**User Story:** As user, I want mengetik nama kategori/relasi dan langsung melihat daftar record yang cocok untuk dipilih, so that saya tidak salah ketik nama persis dan filter yang terbentuk presisi ke record yang benar, sama seperti pengalaman `LinkModel` di Builder lanjutan.

#### Acceptance Criteria

1. WHEN kolom bertipe `relation` dipilih (klik saran, klik Panel, atau sintaks `:`), THE Search Bar SHALL langsung fetch dan menampilkan daftar record dari endpoint `route("model")` (via `useLinkModelOptions`) dengan `search` kosong — TANPA mengharuskan user mengetik dulu.
2. WHILE mode value untuk kolom relation aktif, WHEN teks di input berubah, THE Search Bar SHALL memperbarui pencarian record (debounce 500ms, bawaan `useLinkModelOptions`) dan menampilkan hasil terbaru, dibatasi 8 item.
3. WHEN user memilih satu record dari daftar, THE Search Bar SHALL membentuk leaf `{k: column.name, o: "=", v: record}` (record object utuh) — SHALL TIDAK lagi membentuk leaf `{k: "kolom.label_anak", o:"matches", v:teks}` untuk chip BARU.
4. THE Search Bar SHALL TIDAK menyediakan jalur "ketik teks lalu Enter tanpa pilih record" untuk kolom relation — Enter SAAT dropdown suggestion relation terbuka SHALL mengikuti perilaku pilih-item-ter-highlight (cmdk), sama seperti kolom bertipe list/date; Enter TANPA ada item ter-highlight (belum ada hasil) SHALL tidak membentuk leaf apa pun.
5. WHILE fetch record sedang berlangsung, THE dropdown SHALL menampilkan indikator loading; input SHALL TIDAK disabled (mengetik tetap memicu pencarian baru).
6. IF hasil fetch kosong (tidak ada record cocok), THEN THE dropdown SHALL menampilkan pesan "tidak ditemukan" (reuse `CommandEmpty` yang sudah ada).
7. WHEN user memilih record kedua pada kolom relation yang SUDAH punya leaf `=`/`in` untuk kolom yang sama, THE Search Bar SHALL menggabungkannya jadi satu leaf `in` dengan dedup berdasarkan `.id` record — mengikuti aturan penggabungan yang SUDAH ADA (`addLeafChip`/`mergeValues`, `searchChips.js`, tidak berubah).
8. WHEN user klik chip leaf relation `{k, o:"=", v:record}` yang sudah ada untuk mengedit, THE Search Bar SHALL masuk ke mode value relation (fetch/daftar record dari 0, TANPA prefill teks) — SHALL TIDAK membuka Builder lanjutan sebagai fallback untuk bentuk leaf ini.
9. Leaf `matches` LAMA pada kolom anak relasi (dari saved filter yang dibuat sebelum revisi ini, atau leaf dotted hasil Builder lanjutan manual) SHALL TETAP bisa dibuka-edit sebagai teks biasa lewat jalur fallback yang sudah ada — backward-compatible, TANPA migrasi data.

### Requirement 23: Fokus dan placeholder mode value (semua kolom)

**User Story:** As user, I want langsung bisa mengetik nilai setelah memilih kolom apa pun, dan tahu kolom mana yang sedang saya isi, so that saya tidak perlu klik ulang ke input atau menebak-nebak dari chip kecil di sampingnya.

#### Acceptance Criteria

1. WHEN Search Bar masuk mode value untuk kolom apa pun (via klik saran, klik Panel, sintaks `:`, atau edit chip existing) DAN tidak sedang menunggu proses lain yang men-disable input, THE fokus keyboard SHALL otomatis berada di `<input>` Search Bar tanpa memerlukan klik manual tambahan.
2. WHILE mode value aktif untuk sebuah kolom, THE placeholder `<input>` SHALL mengandung judul kolom yang sedang menunggu nilai — kecuali sedang dalam kondisi loading lain yang sudah punya placeholder sendiri (mis. §13.3 loading relation), yang tetap diprioritaskan.

### Requirement 24: Pengujian (Revisi 4)

**User Story:** As tim pengembang, I want live-suggestion relation dan fix fokus/placeholder teruji di level komponen, so that regresi (termasuk state leak antar test TanStack Query) terdeteksi CI.

#### Acceptance Criteria

1. THE test RTL untuk kolom relation yang sebelumnya menguji `ensureRelationHydrated`/`model.columns` (mekanisme lama) SHALL diganti total — mock `axios.post` untuk `route("model")`, assert dropdown record + leaf `{k, o:"=", v:record}`.
2. THE test RTL SHALL mencakup: loading state (indikator tampil selagi fetch pending), empty state (`CommandEmpty` saat hasil kosong), re-edit chip relation (masuk mode value, bukan Builder lanjutan), dan merge dua record jadi `in`.
3. THE test RTL SHALL mencakup Requirement 23: pilih kolom string non-relation (dari saran maupun Panel) memindahkan fokus ke `<input>` tanpa klik manual; placeholder mengandung judul kolom terpilih.
4. THE setup render `SearchBar` untuk test-test ini SHALL dibungkus `QueryClientProvider` dengan `QueryClient` baru per pemanggilan render (bukan module-level) — mencegah cache TanStack Query bocor antar test-case dengan query key sama.

### Requirement 25: Perbaikan bounded dari feedback verifikasi visual (Revisi 5)

**User Story:** As user, I want dropdown relation tidak menampilkan pesan kosong & loading bersamaan, chip yang diedit ulang tidak diam-diam kehilangan operatornya, Builder lanjutan menampilkan draft yang sedang disusun, input tetap nyaman diketik saat chip menumpuk, dan value string terlihat jelas sebagai teks yang diketik, so that Search Bar terasa presisi dan bisa dipercaya.

#### Acceptance Criteria

1. WHILE fetch live-suggestion relation sedang berlangsung (`loading` true), THE dropdown SHALL TIDAK menampilkan pesan "tidak ditemukan" bersamaan dengan indikator loading — pesan itu SHALL hanya muncul setelah fetch selesai dengan hasil kosong.
2. WHEN chip leaf dengan operator selain default (`!=`/`!matches`/`>`/`>=`/`<`/`<=`/`in`) diklik untuk diedit, THE Search Bar SHALL mem-prefill teks input dengan simbol operator itu (bukan cuma value polos) — commit ulang tanpa mengubah apa pun SHALL mempertahankan operator yang sama.
3. WHEN Builder lanjutan dibuka dari Search Bar (chip "Filter lanjutan", tombol Panel, atau fallback edit chip) SAAT ada draft belum di-apply, THE Builder lanjutan SHALL menampilkan `draftTree` itu (bukan tree yang sudah ter-apply ke host).
4. THE `<input>` Search Bar SHALL mempertahankan lebar minimum yang cukup nyaman diketik (160px) walau chip menumpuk banyak baris.
5. WHEN value chip berasal dari kolom bertipe `string` biasa (bukan boolean/ber-opsi/relasi), THE label chip SHALL membungkus value itu dengan tanda kutip (`"..."`) untuk menandakan itu teks bebas yang diketik, bukan label/preset tetap.

### Requirement 26: Grammar sintaks ketik terpadu (Revisi 6)

**User Story:** As power user, I want satu aturan simbol yang konsisten untuk negasi, daftar nilai, dan rentang di semua tipe kolom yang mendukung ketik bebas, so that saya tidak perlu mengingat aturan berbeda per tipe kolom.

#### Acceptance Criteria

1. THE separator operator `in` SHALL diganti dari koma (`,`) menjadi pipe (`|`) untuk kolom text/number — koma SHALL TIDAK LAGI diperlakukan sebagai separator `in`.
2. WHILE mode value untuk kolom number ATAU date/datetime, WHEN teks berbentuk `a..b` (dua token valid dipisah titik-dua-ganda), THE Search Bar SHALL memakai operator `between` dengan `a` sebagai batas bawah dan `b` sebagai batas atas.
3. THE karakter `-` SHALL TIDAK diperlakukan sebagai sintaks `between` — hanya `..` yang valid (menghindari tabrakan dengan angka negatif).
4. Kombinasi simbol yang tidak valid untuk tipe kolom aktif SHALL tetap fallback ke value literal (tidak berubah dari Requirement 19.6).

### Requirement 27: Checkbox-multi untuk list, boolean, relation (bukan date)

> **DIGANTIKAN oleh Requirement 36 (Revisi 7)** untuk bagian tampilan/interaksi: opsi list/boolean/relation TIDAK lagi berupa checkbox; nilai terpilih jadi chip di kotak search dan hilang dari daftar. Yang tetap berlaku: komit SATU leaf `=`/`in` (27.3), boolean satu pilihan, date bukan multi (27.5).

**User Story:** As user, I want memilih beberapa nilai sekaligus untuk kolom pilihan/relasi tanpa harus membuka-tutup dropdown berulang kali, so that menyusun kondisi "salah satu dari beberapa nilai" terasa cepat dan jelas.

#### Acceptance Criteria

1. WHEN kolom bertipe list, boolean, atau relation dipilih dan user mengklik satu opsi, THE dropdown SHALL TETAP TERBUKA (bukan langsung keluar mode value) dan opsi itu SHALL tertandai tercentang.
2. THE user SHALL bisa mencentang lebih dari satu opsi sebelum keluar dari mode value.
3. WHEN user keluar dari mode value (klik-luar, Escape, atau pilih kolom lain), THE Search Bar SHALL membentuk SATU leaf berisi SEMUA opsi yang tercentang (`=` bila satu, `in` bila lebih dari satu), dedup berdasarkan value/`.id`. Enter SHALL TIDAK menjadi jalur keluar — dibiarkan berperilaku native cmdk (toggle opsi ter-highlight, sama seperti klik), konsisten dengan pola `MultiSelect.jsx` supaya user tetap bisa mencentang >1 opsi lewat keyboard.
4. THE opsi yang SUDAH tercentang SHALL dirender di kelompok ATAS, dipisah `CommandSeparator` dari opsi yang belum tercentang.
5. Kolom date/datetime SHALL TIDAK mengikuti Requirement ini — backend (`FilterEvaluator::applyPeriod()`) tidak mendukung array period dalam satu leaf; date tetap radio-style (pilih satu, langsung keluar mode value).
6. (Feedback) THE search box SHALL menjadi cerminan dua arah dari centangan untuk kolom list/boolean/relation: WHEN opsi dicentang/di-uncentang, THE label opsi SHALL masuk/keluar dari teks search box dalam bentuk `a | b | ` (separator terakhir dipertahankan supaya user lanjut ke opsi berikutnya); WHEN user mengetik label opsi diikuti `|`, THE opsi yang labelnya cocok PERSIS (tanpa beda huruf besar/kecil) SHALL tercentang, dan teks dinormalisasi ke label kanonik saat penyisipan.
7. (Feedback) THE segmen yang sedang diketik (sesudah `|` terakhir) SHALL hanya berlaku sebagai filter pencarian; segmen sebelum `|` yang tidak cocok label opsi mana pun SHALL tidak tercentang dan memunculkan pesan "opsi tidak ditemukan". Untuk relation, label yang belum ada di daftar hasil fetch SHALL dicari langsung ke endpoint yang sama sebelum dinyatakan tidak ditemukan.
8. (Feedback) THE kolom boolean SHALL hanya boleh memiliki SATU nilai terpilih (pilihan berikutnya menggantikan) — backend (`FilterTreeCleaner`) hanya menerima `=`/`!=` untuk boolean; `in`/`!in` menyebabkan leaf dibuang dan `POST /saved-filters` gagal 422 `empty_tree`.
9. (Feedback) WHEN mode value keluar (klik-luar, Escape, tombol Search), THE segmen terakhir yang cocok PERSIS satu opsi SHALL ikut dikomit. Prefill saat mengedit chip SHALL menampilkan label terpilih pada search box (diawali `!` bila leaf bernegasi). Backspace SHALL selalu bisa menghapus separator (normalisasi hanya saat penyisipan).

### Requirement 28: Relation checkbox-multi tanpa kehilangan item saat search berubah

**User Story:** As user, I want record yang sudah saya centang tetap terlihat walau saya mengetik ulang kata kunci pencarian lain, so that saya tidak kehilangan jejak pilihan yang sudah dibuat.

#### Acceptance Criteria

1. THE Search Bar SHALL menyimpan record yang tercentang dalam state terpisah (`selectedRecords`) dari hasil fetch live-suggestion (`relationSearch.options`).
2. WHILE ada record tercentang, WHEN `inputValue` (teks pencarian) berubah dan memicu fetch baru, THE record yang tercentang SHALL TETAP tampil di kelompok atas walau TIDAK match hasil fetch terbaru.
3. THE hasil fetch terbaru (`relationSearch.options`) yang SUDAH ada di `selectedRecords` SHALL TIDAK dirender dua kali (difilter dari kelompok bawah).

### Requirement 29: Operator negasi (`!`) universal

**User Story:** As user, I want mengecualikan nilai tertentu untuk SEMUA tipe kolom (termasuk relasi/pilihan), bukan cuma teks/angka, so that saya bisa bilang "semua KECUALI ini" di kolom mana pun.

#### Acceptance Criteria

1. WHEN user mengetik `!` di AWAL search box (sebelum karakter filter lain) SAAT mode value untuk kolom apa pun, THE Search Bar SHALL menampilkan indikator visual "Kecualikan" di header dropdown.
2. WHILE indikator "Kecualikan" aktif, THE sisa teks setelah `!` SHALL tetap berfungsi sebagai filter pencarian seperti biasa (relation: dikirim sbg parameter `search`; list/boolean: filter label lokal).
3. WHEN user mencentang/memilih opsi SAAT indikator "Kecualikan" aktif, THE leaf yang terbentuk SHALL memakai operator negasi (`!=` untuk satu pilihan, `!in` untuk beberapa) alih-alih `=`/`in`.

### Requirement 30: Date/datetime — embed date picker, tetap text-parse, partial-suggestion

**User Story:** As user, I want memilih tanggal lewat kalender visual ATAU mengetik cepat dengan berbagai format (termasuk bulan-tahun angka dan tahun 2-digit), dengan saran otomatis saat ketikan belum lengkap, so that saya bisa pakai cara mana pun yang paling nyaman saat itu.

#### Acceptance Criteria

1. WHILE mode value untuk kolom date/datetime aktif, THE dropdown SHALL menampilkan preset quick-pick (existing, tidak berubah) DAN widget `DateSelector` (`ui/date-selector.jsx`) ter-embed penuh sebagai calendar picker, dipisah `CommandSeparator`.
2. THE jalur ketik teks (text-parse token) SHALL tetap berfungsi seperti sebelumnya — embed widget adalah TAMBAHAN, bukan pengganti.
3. THE format yang didukung SHALL mencakup (selain yang sudah ada — tahun 4-digit, kuartal, half-year, bulan nama+tahun, tanggal harian): tahun 2-digit (SELALU ditambah 2000, tanpa pivot ke 19xx), DAN bulan-tahun format angka (`MM/yyyy` atau `yyyy-MM`).
4. THE parser token (`parsePeriodToken`/`parseSummary`) SHALL diekstrak dari `Filter/DateSelector.jsx` jadi modul murni terpisah yang di-reuse OLEH KEDUANYA (`Filter/DateSelector.jsx` DAN Search Bar) — TIDAK ada duplikasi implementasi.
5. WHEN teks yang diketik adalah token PARSIAL tanpa tahun spesifik (mis. `Q2`, `Jan`, `H1`), THE Search Bar SHALL menampilkan saran kandidat lengkap dengan 3 tahun relevan (tahun lalu, ini, depan).
6. WHEN token sudah menyertakan tahun spesifik (mis. `Q2 2024`), THE saran SHALL menyempit ke exact match itu saja.
7. THE sintaks `!`/`>`/`>=`/`<`/`<=`/`..` (Requirement 26, 29) SHALL berlaku pada token date/datetime dengan cara yang sama seperti number.
8. (Feedback) THE parser SHALL mendukung varian format: hari `dd/MM/yy(yy)`, `dd-MM-yyyy`, `dd.MM.yyyy`, `dd MM yyyy`, `yyyy-MM-dd`, `yyyy/MM/dd`, `d MMM(M) yy(yy)`; bulan-tahun `M/yy(yy)`, `M-yyyy`, `yyyy/M`, nama bulan penuh/singkat/awalan ≥3 huruf (locale aktif + Inggris) dengan tahun sebelum/sesudahnya; kuartal & half-year dengan tahun sebelum/sesudahnya; serta jam (`HH:mm[:ss]`, `T`) untuk kolom datetime.
9. (Feedback) THE chip leaf tanggal SHALL menampilkan nilainya untuk `in_period` MAUPUN `!in_period` (negasi tetap terbaca, bukan `[object Object]`), dan operator perbandingan (`>`, `>=`, `<`, `<=`) SHALL tampil sebagai simbol di depan nilai.
10. (Feedback) THE leaf tanggal yang dikirim ke backend SHALL memakai string LOKAL (`YYYY-MM-DD` atau `YYYY-MM-DD HH:mm`), BUKAN `Date`/ISO UTC, sehingga hari tidak bergeser di zona waktu non-UTC (`FilterEvaluator::resolvePeriodBounds` memakai `Carbon::parse`).

### Requirement 31: Hint discoverability sintaks simbol

**User Story:** As user baru, I want tahu simbol apa saja yang bisa dipakai tanpa harus baca dokumentasi terpisah, so that saya bisa langsung memanfaatkan fitur ketik cepat ini.

#### Acceptance Criteria

1. WHILE mode value aktif untuk kolom text/number/date/relation, THE Search Bar SHALL menampilkan footer hint kecil di dalam dropdown berisi simbol yang RELEVAN untuk tipe kolom itu.
2. ~~Kolom list/boolean SHALL TIDAK menampilkan hint ini~~ — DIREVISI (feedback, Requirement 27.6): list/boolean juga menampilkan hint karena search box kini bisa diketik (`a | b |`).

### Requirement 32: Fix posisi Panel (anchor stabil)

**User Story:** As user, I want Panel dropdown selalu muncul di posisi yang bisa diprediksi, walau chip yang sudah ada menumpuk banyak baris, so that saya tidak kehilangan bagian Panel yang terpotong keluar layar.

#### Acceptance Criteria

1. THE Popover Search Bar (Panel, suggestion, value-list) SHALL menggunakan `PopoverAnchor` yang di-set ke elemen wrapper TERLUAR (posisi stabil), BUKAN ke `triggerDiv` kecil yang posisinya bisa bergeser saat chip menumpuk banyak baris.
2. WHEN chip menumpuk sampai beberapa baris, THE Panel SHALL TIDAK overflow keluar viewport/wrapper.

### Requirement 33: Navigasi keyboard di Panel

**User Story:** As power user, I want menavigasi Panel (Filter/Group/Kolom) pakai keyboard saja, so that saya tidak perlu berpindah tangan ke mouse.

#### Acceptance Criteria

1. WHILE Panel terbuka, WHEN tombol Up/Down ditekan, THE highlight SHALL berpindah ke item berikutnya/sebelumnya DALAM kolom yang sedang aktif.
2. WHILE Panel terbuka, WHEN tombol Left/Right ditekan, THE highlight SHALL berpindah ke kolom lain (Filter/Group/Kolom, dengan wrap-around di ujung).
3. WHEN Enter ditekan dengan item ter-highlight, THE Search Bar SHALL memilih item itu (setara dengan mengklik item tsb). (Feedback) Enter dari item Panel SHALL TIDAK ditangkap/dibatalkan oleh handler Enter root cmdk milik Search Bar (`stopPropagation` di Panel).

### Requirement 34: Tooltip chip

**User Story:** As user, I want melihat isi lengkap sebuah chip walau teksnya terpotong, so that saya tidak perlu mengklik chip itu (yang membuka mode edit) hanya untuk sekadar melihat isinya.

#### Acceptance Criteria

1. WHILE mouse di-hover di atas badan chip, THE Search Bar SHALL menampilkan tooltip berisi label leaf LENGKAP (kolom, operator, value) — SAMA dengan teks chip itu sendiri (berguna khusus saat `truncate` memotong teks).

### Requirement 35: Pengujian (Revisi 6)

**User Story:** As tim pengembang, I want seluruh perubahan Revisi 6 teruji, so that regresi (termasuk ekstraksi parser tanggal) terdeteksi CI.

#### Acceptance Criteria

1. THE test `columnSearch.test.js` SHALL mencakup: separator `in` baru (`|`, bukan lagi `,`), `between` (`a..b`) untuk number.
2. THE modul parser tanggal hasil ekstraksi (`periodParsing.js`) SHALL punya test unit sendiri yang mencakup SEMUA token existing (regression guard supaya ekstraksi tidak mengubah behavior `Filter/DateSelector.jsx`) DITAMBAH token baru (`MM/yyyy`, `yyyy-MM`, tahun 2-digit) dan generator partial-suggestion (3 tahun relevan).
3. THE test `SearchBar.rtl.test.jsx` SHALL mencakup: checkbox-multi list/boolean (dropdown tetap terbuka antar centang, commit jadi leaf `in`); relation checked-persist (record tercentang tetap tampil di atas walau search text berubah); operator `!` universal (badge muncul, leaf jadi `!=`/`!in`); embed `DateSelector` widget (kalender ter-render, pilih via widget menghasilkan leaf yang sama seperti text-parse); navigasi keyboard Panel; tooltip chip; posisi Panel tidak overflow saat chip disimulasikan banyak baris.

## Revisi 11 — Banyak nilai (`in`) untuk kolom date/datetime

> **Catatan (Revisi 16):** bentuk data Requirement 57.1-57.2, 58.1-58.2 dan komponen Builder Requirement 61.1 DIGANTIKAN Revisi 16 -- banyak nilai kini memakai `in_period`/`!in_period` (`v` = daftar), bukan operator `in`/`!in`. Requirement 59 (widget) dan 60 (perilaku Search Bar) tetap berlaku.

Konteks: date/datetime hanya punya `in_period`/`!in_period` (satu objek periode). Brainstorming (keputusan user): tambah dukungan banyak nilai, hanya untuk kondisi "Pada" (`is`, tanpa simbol; negasi tetap boleh). Widget `DateSelector` DIUBAH agar bisa multi (keputusan user, menggantikan arahan "widget tidak diubah") lewat prop `allowMultiple` default mati sehingga Builder dan `DatetimePicker` tidak terpengaruh. Koma TIDAK dipakai sebagai separator (dibatalkan).

### Requirement 57: Model data `in` / `!in` untuk date/datetime

1. THE leaf `{k, o:"in"|"!in", v:[<periode>, ...]}` SHALL berlaku untuk kolom bertipe `date`/`datetime`; tiap `<periode>` SHALL berbentuk objek periode yang sama dengan `in_period` (`period`, `operator`, `startDate`/`year`/`month`/`quarter`/`halfYear`) dengan `operator` SELALU `is`.
2. THE Search Bar SHALL memakai aturan yang sama dgn tipe lain: satu nilai -> `in_period`/`!in_period` (tak berubah); dua nilai atau lebih -> `in`/`!in`.
3. THE `in` skalar untuk date (mis. `whereIn` tanggal mentah) dan `in` mode kolom (`{kind:"column"}`) SHALL tidak terpengaruh dan SHALL tidak menerima daftar periode.

### Requirement 58: Backend — validasi & evaluasi

1. THE `FilterTreeCleaner` SHALL menerima `in`/`!in` untuk date/datetime HANYA bila `v` adalah daftar (list) 1 s/d 20 objek periode yang masing-masing valid (`isPeriodValid`) dan ber-`operator` `is`; selain itu leaf di-drop. Melebihi 20 SHALL di-drop.
2. THE `FilterEvaluator` SHALL mengevaluasi `in` date/datetime sebagai OR dari batas tiap periode (memakai logika `applyPeriod` yang sama, termasuk presisi-menit utk datetime berjam); `!in` SHALL = NOT(OR). Elemen tak valid dilewati; daftar tanpa elemen valid tak menambah kondisi.
3. THE cabang SHALL berlaku juga utk kolom di dalam relasi (dot-notation / nested `whereHas`).
4. Baris NULL SHALL tak masuk `in` maupun `!in` (semantik SQL yang sama dgn `!in_period`).

### Requirement 59: Widget `DateSelector` — multi-select ("Pada")

1. THE `DateSelector` SHALL menerima prop `allowMultiple` (default `false`) dan `maxSelections` (default 20). Tanpa `allowMultiple` perilaku SHALL identik dgn sebelumnya.
2. WHEN `allowMultiple` aktif DAN Kondisi = Pada (`is`), klik sel (hari, bulan, kuartal, semester, tahun; termasuk pintasan "hari ini") SHALL men-toggle anggota `selections`; sel terpilih SHALL ditandai (hari: `mode="multiple"`; grid periode: penanda daftar).
3. THE `currentValue` yang di-emit SHALL menyertakan `selections` (array objek periode `is`) bila `allowMultiple`; prop `value.selections` SHALL menghidrasi pilihan.
4. WHEN Periode diganti di mode multi, pilihan TIDAK dibersihkan (daftar boleh campuran granularitas); WHEN Kondisi diganti ke selain Pada, pilihan dibersihkan (perilaku widget sekarang) dan opsi Kondisi selain Pada SHALL dinonaktifkan selama `selections` >= 2.
5. THE kolom datetime dalam mode multi: klik sel = seluruh hari (tanpa jam); pemilih jam tak dipakai selama multi.
6. Melebihi `maxSelections`, klik sel baru SHALL diabaikan.

### Requirement 60: Search Bar — chip nilai date

1. THE mode value date/datetime SHALL memakai chip nilai (pola text/number): daftar chip = `selections` widget; hapus chip melepas sel di widget, toggle di widget menambah/mengurangi chip.
2. THE separator SHALL `|` dan `;` (bukan koma); `!` di awal = negasi seluruh daftar.
3. THE alur SHALL: Enter dgn ketikan -> jadi chip; Enter (input kosong) -> selesai; Enter (dropdown tertutup) -> apply; klik preset/saran menambah chip dan dropdown tetap terbuka. Menggantikan aturan khusus date "klik menutup" dan "Enter pertama = komit + apply".
4. THE daftar chip SHALL berupa N (>= 1) chip Pada, ATAU tepat 1 chip non-Pada (`>=2027`, `a..b`); menambah chip yg melanggar aturan ini SHALL menampilkan pesan dan tidak mengubah daftar. Mengetik simbol saat ada chip Pada SHALL menampilkan pesan, bukan menghapus chip.
5. THE ketikan plain SHALL dipreview di widget sebagai terpilih (gabungan chip + pending); klik sel yang sudah terpilih menghapusnya (chip, atau mengosongkan teks pending).
6. THE chip utama `in` SHALL berlabel `Kolom: a, b, c` (dipotong dgn tooltip penuh); mengedit chip utama mengisi ulang chip nilai. Melebihi 20 nilai SHALL menampilkan pesan.
7. THE Periode widget SHALL mengikuti ketikan "Pada" yg dipratinjau; selain itu dipertahankan selama belum ada chip atau ada chip ber-Periode itu, kalau tidak mengikuti Periode chip terakhir (chip hasil tempel/edit tetap terlihat di widget).
8. THE `addLeafChip` SHALL TIDAK menggabung leaf date `in` dgn leaf `in` kolom yg sama (chip terpisah); nilai periode bukan skalar dan gabungan bisa melampaui batas 20.

### Requirement 61: Builder (fase terakhir)

1. THE Builder SHALL dapat membuka dan mengedit leaf `in`/`!in` date tanpa crash: operator `in`/`!in` untuk date/datetime memakai komponen `DateMultiSelector` (daftar periode "Pada", Kondisi terkunci, maks 20) — keputusan: komponen terpisah, wrapper `DateSelector.jsx` (`in_period`) tidak diubah.
2. THE `filterValidation` SHALL menolak daftar kosong, >20, elemen bukan `is`, atau elemen tak lengkap; mode column (`columnrefMulti`) tak terpengaruh.

### Requirement 62: Pengujian (Revisi 11)

1. THE test SHALL mencakup: PHPUnit Cleaner (daftar valid/kosong/>20/elemen non-`is`/elemen invalid/date vs datetime/negasi/`in` skalar ditolak) dan Evaluator (OR antar periode campuran granularitas, datetime berjam, `!in` + NULL, relasi nested, mode kolom tak terpengaruh); Vitest widget (toggle, hidrasi, Periode tak membersihkan, Kondisi guard, batas, default-off = perilaku lama); Vitest Search Bar (chip, sinkron, pesan, alur Enter, edit chip utama); verifikasi browser sungguhan (fid + SQL) tiap fase.

## Revisi 12 — Aturan daftar chip, edit menyembunyikan chip, negasi, kembali ke kotak, tips kontekstual, opsi status

Konteks: feedback pemakaian atas Revisi 11 (7 poin). Menggantikan sebagian aturan lama: penanda cincin chip yg diedit (Requirement 43/47), "Escape membuang edit -> chip utuh" tetap, pesan-tanpa-tolak utk simbol date (Requirement 60.4), legend statis per tipe (Requirement 42/52).

### Requirement 63: Aturan daftar chip nilai (number & date)

1. THE daftar chip nilai kolom number/date SHALL berupa N nilai polos ATAU tepat SATU nilai bersimbol (`>`, `>=`, `<`, `<=`, `a..b`); negasi `!` SHALL tetap boleh (global, bukan simbol nilai).
2. WHEN sudah ada chip lain (polos) DAN user mengetik simbol nilai (atau tempel >1 segmen dgn simbol), THE Search Bar SHALL MENOLAK ketikan itu (kotak tak berubah) dan menampilkan pesan `chip_symbol_with_chips`.
3. WHEN nilai pertama bersimbol terbentuk (Enter, pemisah date, klik saran/preset bersimbol), THE Search Bar SHALL langsung SELESAI: leaf ke draft, mode value keluar, dropdown tertutup (tak ada chip bersimbol yg tinggal, tak ada nilai berikutnya); apply tetap Enter berikutnya (dropdown tertutup). Guard `chip_single_only` tetap ada sbg pengaman.
4. Nilai bersimbol number dibuat lewat Enter (pemisah `|` `;` hanya utk angka polos); date lewat Enter/pemisah/saran/preset.
5. THE aturan SHALL berlaku utk chip yg diedit dgn membandingkan terhadap chip LAIN (yg diedit tak dihitung).

### Requirement 64: Chip yg sedang diedit disembunyikan

1. WHEN sebuah chip filter masuk mode edit (mode value utk leaf itu), THE Search Bar SHALL tidak menampilkan chip itu di daftar (nilainya sudah dimuat ke kotak); chip SHALL muncul kembali dgn nilai baru setelah selesai (atau utuh bila keluar tanpa perubahan).
2. THE hal yg sama SHALL berlaku utk chip nilai (text/number/date): chip yg diedit tak tampil, teksnya di kotak; datanya tetap di daftar sehingga Escape membuang edit tanpa data hilang; navigasi panah memakai chip yg tampil.

6. WHEN chip filter yg SATU nilai (number/text/date, polos maupun bersimbol) masuk mode edit, THE Search Bar SHALL langsung mengonversinya ke TEKS di kotak (mis. `>=2027`, `!>15 Sep 2026`, `1..5`), bukan chip nilai; banyak nilai (`in`/`!in`) tetap dimuat sbg chip nilai; list/relation tetap chip.

### Requirement 65: Tanda visual negasi (mode value)

1. WHEN mode kecualikan (`!`) aktif di mode value, THE penanda kolom `[Kolom:]` SHALL berwarna destruktif dgn ikon larangan, DAN tiap chip nilai SHALL diberi atribut `data-excluded` (warna chip TIDAK berubah — lihat Requirement 70); kembali normal saat `!` dihapus. Berlaku juga saat mengedit leaf bernegasi (`!` dimuat ke kotak).

### Requirement 66: Panah atas di opsi pertama kembali ke kotak

1. WHEN sorotan opsi berada di opsi PERTAMA (daftar nilai list/relation/date/set) DAN user menekan panah atas, THE Search Bar SHALL menyembunyikan sorotan (fokus kembali ke kotak) dan Enter SHALL tidak lagi memilih opsi (memakai ketikan apa adanya / selesai) sampai user mengetik atau menekan panah bawah; sorotan SHALL TIDAK memutar ke opsi terakhir.
2. WHEN fokus berada di item PERTAMA sebuah kolom Panel DAN user menekan panah atas, THE fokus SHALL kembali ke kotak search.
3. Date memakai aturan "niat" yg sama dgn list (sorotan opsi tersembunyi tanpa ketikan/panah).

### Requirement 67: Tips kontekstual

1. THE legend SHALL menampilkan HANYA petunjuk yg berlaku pada kondisi saat ini: scope (Panel fokus kotak / fokus item Panel / saran ketikan / mode value), fokus (kotak kosong, mengetik, opsi tersorot, chip tersorot, widget kalender), sedang mengedit, mode kecualikan, kunci aturan daftar (`chipLock`).
2. Tombol yg sama SHALL punya kalimat berbeda sesuai fungsi pada kondisi itu (mis. Enter = jadikan chip / pilih opsi / edit chip / selesai / simpan hasil edit / terapkan / pilih & terapkan).

### Requirement 68: Opsi kolom formStatus / formStatuses

1. THE backend SHALL mengisi `options` kolom bertipe `formStatus`/`formStatuses` dari `options` di `$configColumns` (daftar `FormStatus` atau string; mendaftarkan/membatasi status relevan utk dokumen), dan bila tak ada dari seluruh case enum `FormStatus`; `valueTrans` default `status`.
2. THE Search Bar SHALL menawarkan kolom itu sbg daftar opsi; utk `formStatuses` leaf SELALU `in`/`!in` (walau satu nilai — backend tak menerima `=`); saran nilai memakai `{o:"in", v:[nilai]}`; edit leaf `has`/`!has` (Builder) memuat nilainya sbg chip.
3. Model dgn status terbatas (mis. Ticket) SHALL mendaftarkan `options` sendiri.

### Requirement 69: Pengujian (Revisi 12)

1. THE test SHALL mencakup: unit `chipEntryViolation`/`hasValueSymbol`/`buildListLeaf`/`legendTipsFor`; RTL SearchBar (tolak ketikan, chip diedit tersembunyi, tanda negasi, panah atas di opsi/Panel, tips berganti mengikuti kondisi, leaf formStatuses); PHPUnit `StatusColumnOptionsTest` (default enum, batas config, valueTrans, string biasa tak tersentuh, Ticket).

## Revisi 13 — Warna chip negasi, opsi urut abjad + BadgeStatus, tombol muted, saran nilai per kolom

Konteks: feedback verifikasi visual Purchase Receipts (kolom Status). 5 poin.

### Requirement 70: Chip nilai mode negasi tidak merah

1. WHEN mode kecualikan (`!`) aktif, THE chip nilai SHALL tetap berwarna chip nilai biasa (`secondary`); penanda negasi hanya penanda kolom `[Kolom:]` (destruktif + ikon larangan) dan atribut `data-excluded`. Alasan: merah bentrok dgn cincin merah penanda chip nilai yg sedang tersorot. Menggantikan sebagian Requirement 65.1.

### Requirement 71: Opsi diurut abjad menurut label terjemahan

1. THE daftar opsi kolom ber-opsi (daftar nilai, saran nilai, resolusi ketikan) SHALL diurutkan abjad menurut label yg SUDAH diterjemahkan (`t()`), bukan urutan `options` di config maupun `value`.
2. THE aturan ini SHALL TIDAK berlaku utk: record relation (urutan dari server), boolean (tetap Ya lalu Tidak), preset periode tanggal (urutan logis Hari ini → Tahun lalu).

### Requirement 72: Opsi status dirender sbg BadgeStatus

1. WHEN kolom bertipe `formStatus`/`formStatuses`, THE daftar nilai (mode value) DAN saran nilai (mode key) SHALL merender opsi dgn `BadgeStatus` (tampilan sama dgn sel tabel); teks yg cocok dgn ketikan SHALL tetap di-highlight (prop `label` opsional pada `BadgeStatus`).
2. Chip nilai di dalam kotak SHALL tetap chip biasa (bukan badge).

### Requirement 73: Tombol Search & chevron tampak sbg tombol

1. THE tombol Search dan chevron SHALL berlatar `bg-muted` (hover sedikit lebih gelap) supaya terbaca sbg tombol.

### Requirement 74: Saran nilai terbatas ke kolom yg disebut

1. THE saran nilai (seksi Nilai, mode key) SHALL memecah ketikan per kolom: kata yg ada di JUDUL kolom = "kata kolom", sisanya = pencarian nilai; urutan kata bebas ("status sel" = "sel status").
2. WHEN ketikan hanya menyebut judul kolom ber-opsi/boolean/tanggal, THE seksi Nilai SHALL menampilkan nilai kolom itu; WHEN ada sisa kata, hanya nilai yg cocok. Ketikan yg cocok label nilai saja (tanpa judul kolom) SHALL tetap bekerja seperti sebelumnya.
3. Kolom tanggal/datetime: selain preset, sisa ketikan diparse sbg periode ("tanggal sep 2026", "dibuat >= jan 26") -> maks 3 saran periode per kolom (butuh `dateContext`).
4. Kolom angka: sisa ketikan numerik -> leaf `=`/perbandingan (`total 500`, `total >= 500`); kolom teks: sisa ketikan -> leaf `matches` (`kode Budi`); judul saja tak menghasilkan saran nilai; ketikan bukan angka utk kolom angka -> tak ada saran.
5. Kolom relation: WHEN ketikan (>= 3 huruf) menyebut judul SATU kolom relation (kata kolom terbanyak; seri -> urutan kolom), THE Search Bar SHALL fetch record ke endpoint LinkModel yg sama (`search` = sisa kata, limit 5) dan menampilkannya di seksi Nilai; klik = leaf `{k, o:"=", v: record}`. Hasil SHALL baru tampil setelah debounce hook mengejar ketikan (`settled`); tanpa kolom relation yg disebut TIDAK ada fetch.
6. Batas seksi Nilai tetap 5 item; item terbaik (skor) dulu.

### Requirement 75: Pengujian (Revisi 13)

1. THE test SHALL mencakup: unit `buildOptionList` (urut abjad, tak memutasi config), `isStatusColumn`, `buildSuggestions` (judul saja, judul + nilai, urutan kata, boolean, preset & periode tanggal, angka, teks, record relation, tanpa `dateContext`), `findRelationScope`; RTL SearchBar (tombol `bg-muted`, saran nilai status/boolean/tanggal/angka/relation, tanpa fetch bila bukan relation, opsi status badge + urut abjad, chip negasi tak merah).

## Revisi 14 — Tombol Simpan Filter: tanpa dropdown, tak menimpa, ada progres

Konteks: feedback visual Panel (kolom Filter). Menggantikan dropdown "Simpan sebagai baru / Timpa <nama>" pada `SaveFilterControl` (Panel Search Bar & dialog Builder).

### Requirement 76: Simpan Filter tanpa dropdown

1. THE tombol "Simpan Filter" SHALL membuka isian nama inline (bukan menu); isian berisi nama + tombol Simpan + Batal.
2. WHEN nama (trim, tanpa beda huruf) sama dgn salah satu filter tersimpan yg boleh ditimpa, THE tombol simpan SHALL berganti `Timpa "<nama>"` dan aksinya PATCH tree (+ sort/group bila `getViewSnapshot`) filter itu, tanpa POST; selain itu record baru (POST lalu PATCH nama).
3. THE Panel SHALL memberi kandidat timpa = filter tersimpan MILIK SENDIRI (bukan shared -- dikelola via Filter Templates); dialog Builder tetap memberi seluruh filter bernama.
4. THE `defaultName` SHALL mengisi isian saat dibuka (Panel: nama sumber yg sedang diubah -> Enter langsung menimpa; dialog: nama filter yg dimuat).
5. THE Escape di isian SHALL membatalkan isian dulu (tak sampai menutup Panel/dialog); tombol panah SHALL menggerakkan kursor isian, bukan navigasi Panel; Enter = simpan.
6. THE tombol tak aktif di Panel saat belum ada filter (`hasFilters=false`; backend menolak tree kosong 422).

### Requirement 77: Tak saling menimpa

1. THE isian & tombol SHALL memakai tata letak `flex-wrap` (isian `min-w-0 flex-1`, tombol `shrink-0`) sehingga di kolom sempit Panel turun baris, tidak melampaui/menimpa kolom Group; tombol awal lebar penuh di Panel (`className`).

### Requirement 78: Indikator progres simpan

1. WHILE menyimpan/menimpa, THE tombol simpan SHALL menampilkan spinner + "Menyimpan..." (`core.form.saving`), isian & Batal terkunci, `aria-busy`; status dilaporkan lewat `onSavingChange` (dialog Builder membekukan seluruh dialog).
2. WHEN sukses, THE isian SHALL menutup + toast; WHEN gagal, isian tetap terbuka (nama utuh) + toast error, bisa dicoba lagi.

### Requirement 79: Pengujian (Revisi 14)

1. THE test SHALL mencakup: RTL `SaveFilterControl` (tanpa menu, POST+PATCH nama, snapshot sort/group, timpa lewat nama sama, `defaultName` + Enter, spinner & terkunci lalu menutup, gagal -> toast & tetap terbuka, Escape/panah tak naik ke induk, Batal, disabled + `className`), RTL `SearchPanel` (`defaultName`, `disabled`, `className`, kandidat timpa non-shared), dialog `FilterTable2` (alur simpan baru inline); verifikasi browser (Items: form tak menimpa kolom, spinner "Menyimpan...", nama sama -> Timpa).

## Revisi 15 — "Tidak ada hasil" tak kontradiktif dgn Diisi/Tidak diisi

### Requirement 80: Pesan kosong daftar nilai

1. WHEN mode value list/boolean/relation DAN ketikan cocok opsi "Diisi"/"Tidak diisi" (opsi ini di-filter oleh ketikan utk list/relation) tetapi tak ada nilai/record yg cocok, THE dropdown SHALL menampilkan opsi itu SAJA, TANPA pesan "Tidak ada hasil yang ditemukan" di atasnya (kontradiktif).
2. WHEN ketikan tak cocok apa pun (nilai maupun Diisi/Tidak diisi), THE dropdown SHALL menampilkan pesan bawaan cmdk "Tidak ada hasil yang ditemukan".
3. THE pesan eksplisit SHALL hanya muncul utk relation TANPA ketikan dan tanpa record sama sekali (fetch selesai kosong); list yg semua opsinya sudah jadi chip SHALL tidak menampilkannya.
4. Test: RTL SearchBar (boolean cocok Diisi, boolean tak cocok, relation server kosong + ketikan cocok Diisi, list semua opsi jadi chip).

## Revisi 16 — Banyak nilai date/datetime lewat `in_period` (bukan operator `in`)

Konteks: pengecekan Filter Builder -- date/datetime menampilkan empat operator (`in_period`, `!in_period`, `in`, `!in`) untuk satu konsep. Di backend `in` date hanyalah jalan pintas ke logika `in_period` (OR antar periode); bedanya cuma bentuk `v`. Keputusan user: banyak nilai diterapkan pada operator `in_period`/`!in_period` sendiri; `DateSelector` (Builder) mendeteksi ketikan seperti Search Bar. Leaf `in`/`!in` date lama TIDAK dinormalisasi (keputusan user: hindari kode tambahan; fitur belum dirilis, data lama hanya di DB dev).

### Requirement 81: Model data `in_period` / `!in_period` multi-nilai

1. THE leaf `{k, o:"in_period"|"!in_period", v}` untuk date/datetime SHALL menerima `v` berupa SATU objek periode (seperti sekarang, Kondisi apa pun) ATAU daftar (list) 1 s/d 20 objek periode yang semuanya ber-`operator` `is`.
2. THE operator `in`/`!in` SHALL tidak lagi menjadi operator date/datetime (whitelist Cleaner & Evaluator); `in` mode kolom (`{kind:"column"}`, membandingkan dgn kolom lain) SHALL tidak terpengaruh.
3. THE klien (Search Bar & Builder) SHALL selalu mengirim SATU nilai sbg objek (bukan daftar berisi satu elemen) dan >= 2 nilai sbg daftar.

### Requirement 82: Backend -- validasi & evaluasi

1. THE `FilterTreeCleaner` SHALL, utk `in_period`/`!in_period`, menerima `v` objek yang lolos `isPeriodValid`, ATAU daftar yg lolos `isPeriodListValid` (`array_is_list`, 1..20, tiap elemen `isPeriodValid` dgn `operator` `is`); selain itu leaf di-drop. `in`/`!in` date (non-mode-kolom) SHALL di-drop (tak dinormalisasi).
2. THE `FilterEvaluator` SHALL, utk `in_period`/`!in_period` dgn `v` daftar, mengevaluasi OR dari batas tiap periode (logika `applyPeriodIn` yang sudah ada, dipanggil dari cabang `in_period`); `!in_period` = NOT(OR); objek tunggal SHALL tetap lewat `applyPeriod`. Berlaku juga utk kolom di dalam relasi (nested `whereHas`). Baris NULL tak masuk `in_period` maupun `!in_period` (semantik lama).
3. WHEN leaf lama `in`/`!in` date (non-mode-kolom) sampai ke Evaluator, THE item SHALL dilewati diam-diam (mekanisme "item invalid di-skip" yg sudah ada) -- TIDAK ada normalisasi. Konsekuensi diketahui & diterima: filter tersimpan/default yg memuatnya tampil tak terfilter sampai dibuat ulang.
4. THE klien SHALL tidak crash saat menerima leaf lama itu (label generik / operator kosong di Builder); tak ada kode khusus utk memperbaikinya.

### Requirement 83: Builder -- `DateSelector` multi + deteksi ketikan

1. THE operator date/datetime di Builder SHALL hanya `in_period`, `!in_period` (+ `set`/`!set`, mode kolom tak berubah); `dateselectorMulti` dan `DateMultiSelector.jsx` SHALL dihapus.
2. THE `DateSelector` (wrapper `Filter/DateSelector.jsx`) SHALL memakai widget `ui/date-selector` dgn `allowMultiple`/`maxSelections=20`: Kondisi "Pada" + banyak pilihan -> `v` daftar (1 pilihan -> objek); Kondisi lain -> satu objek; Kondisi selain Pada dinonaktifkan selama pilihan >= 2 (perilaku widget Requirement 59.4).
3. THE kotak teks `DateSelector` SHALL, selain grammar lama (`parseSummary`: awalan label operator, rentang ` - `), mengenali ketikan gaya Search Bar: pemisah `|`/`;` -> banyak periode "Pada" (`parseMultiValueText` + `parseDatePeriod` + `mergeDatePeriods` dari `columnSearch.js`, maks 20, duplikat dibuang); satu segmen berpemisah -> objek tunggal; segmen tak terparse / campur nilai bersimbol / awalan `!` (negasi = operator `!in_period`) -> tak ada emisi; teks tanpa pemisah SHALL tetap lewat jalur lama (tak ada perubahan perilaku utk satu nilai). Ringkasan utk daftar = `a | b | c` (`periodValueToText`, round-trip dgn ketikan); tombol hapus berlabel `dateselector.clear`.
4. THE `filterValidation` utk `dateselector` SHALL menerima objek (validasi lama) ATAU daftar 1..20 elemen `is` lengkap; daftar kosong / >20 / elemen bukan `is` / tak lengkap ditolak.

### Requirement 84: Search Bar -- bentuk leaf saja

1. THE `buildDateChipsLeaf` SHALL menghasilkan `in_period`/`!in_period` utk satu maupun banyak nilai (banyak = `v` daftar); daftar dgn elemen non-`is` tetap `null` (aturan daftar Requirement 60.4).
2. THE `leafDatePeriods` SHALL membaca `in_period`/`!in_period` ber-`v` objek (-> [objek]) ATAU daftar (-> daftar) sbg sumber chip nilai saat edit chip utama.
3. THE `leafToChip` (label `Kolom: a, b, c`, tooltip penuh) SHALL mengenali daftar lewat bentuk `v` (`isPeriodListValue`) di bawah operator `in_period`/`!in_period`, bukan lewat operator `in`; `addLeafChip` SHALL tetap TIDAK menggabung leaf date (hanya `=`/`in` yang digabung, guard `isPeriodListValue` di sana dihapus karena tak lagi terjangkau).
4. THE perilaku UI Search Bar (chip nilai, sinkron widget dua arah, alur Enter, pesan, negasi `!`) SHALL tidak berubah.

### Requirement 85: Yang tidak berubah

1. THE widget `ui/date-selector.jsx` (`allowMultiple`), `in` mode kolom (`columnrefMulti`), `LinkModelFilterConverter` dan `linkModelToFilterTree` (hanya menghasilkan objek tunggal) SHALL tidak diubah.

### Requirement 86: Pengujian (Revisi 16)

1. THE test SHALL mencakup: PHPUnit Cleaner (`in_period` objek & daftar valid, daftar kosong/>20/elemen non-`is`/elemen invalid, negasi, `in` date non-kolom di-drop, `in` mode kolom tetap lolos) dan Evaluator (daftar OR campuran granularitas, datetime berjam, `!in_period` + NULL, relasi nested, leaf lama `in` dilewati); Vitest `operators`/`filterValidation`/`ValueField` (operator date = 2 + set, daftar valid/invalid), RTL `DateSelector` Builder (multi lewat widget, ketikan `a | b`, Kondisi lain = objek, jalur lama utuh), `columnSearch`/`searchChips` (leaf daftar `in_period`, label, tidak digabung), RTL SearchBar (leaf `in_period` daftar menggantikan `in`); verifikasi browser sungguhan (Builder + Search Bar, fid + SQL).

## Revisi 9 — Feedback pemakaian: tata letak, warna chip, tips, Enter/Space, klik menutup

Konteks: verifikasi user atas Revisi 8 (screenshot). Dikerjakan bertahap: yang cepat dulu (Requirement 47-52), sisanya (53-54) dibahas dulu.

### Requirement 47: Tata letak area nilai

1. THE area nilai (penanda kolom + chip nilai + input) SHALL tetap satu baris dengan chip utama selama sisa ruang di kanan chip >= 24rem; WHEN sisa ruang lebih kecil, THE area SHALL turun ke baris baru selebar kotak (induk `flex-wrap`, area `flex-1 basis-96`). Menggantikan Requirement 43.1 (selalu baris baru).

### Requirement 48: Penanda kolom yang sedang diatur nilainya

1. THE penanda `[Kolom:]` di mode value SHALL tampil sebagai badge kontras tinggi (`bg-foreground text-background`, tebal), bukan teks muted.

### Requirement 49: Warna & ikon chip menurut peran

1. THE chip filter tersimpan (sumber) SHALL berwarna emas dengan ikon bintang; chip filter (leaf/search/advanced) biru tanpa ikon; chip group hijau dengan ikon tumpukan (`Layers`, label tanpa awalan "≡"); chip nilai (di kotak nilai) `secondary`.

### Requirement 50: Tips di Panel & kontras

1. WHEN Panel (input kosong) tampil, THE Search Bar SHALL menampilkan legend tips (ketik kolom, `Tab`/`:` pilih kolom, `↑↓` masuk panel, `Enter` apply saat tertutup, `Esc`); tips sorot/edit/hapus chip HANYA bila sudah ada chip.
2. THE teks legend (Panel & mode value) SHALL memakai warna `foreground` (kontras tinggi), bukan `muted-foreground`.

### Requirement 51: Enter / Space pada chip tersorot = edit

1. WHEN chip (filter, group, atau chip nilai — text, number, list/boolean, relation) tersorot lewat panah dan Enter atau Space ditekan, THE Search Bar SHALL masuk mode edit chip itu: chip filter/group membuka editornya; chip nilai text/number diganti di tempat; chip nilai list/boolean/relation dilepas dan labelnya dimuat ke input.

### Requirement 52: Klik menutup; Enter text/number = chip dulu

1. WHEN sebuah opsi diklik pada kolom tanpa operator `in` (boolean; date: preset & saran; opsi Diisi/Tidak diisi semua tipe), THE Search Bar SHALL mengomit leaf ke draft, keluar mode value, dan menutup dropdown tanpa menunggu Enter. Apply tetap lewat Enter (dropdown tertutup) atau tombol Search.
2. WHEN Enter ditekan di kolom text/number dengan ketikan, THE ketikan SHALL menjadi chip (dropdown tetap terbuka); Enter berikutnya (input kosong) menyelesaikan; Enter berikutnya (tertutup) meng-apply. Ketikan yang tak valid (number) menampilkan pesan dan tidak menjadi chip.

### Requirement 53: Pilihan tanggal di widget mengisi nilai di Search Bar

> **Revisi 10: butir 1–3 DIGANTIKAN Requirement 56 — widget tidak lagi auto-komit; pilihan widget disinkronkan ke teks search box dan dikomit lewat Enter/preset/Search. Butir 4 (abaikan emisi sama) dan 5 (kembalikan fokus) tetap berlaku.**

Keputusan awal user: opsi A (komit + tutup, tanpa apply); kolom datetime: klik hari = seluruh hari. Widget `ui/date-selector.jsx` TIDAK diubah — semua perilaku di sisi Search Bar.

1. ~~WHEN pilihan di widget `DateSelector` sudah lengkap (satu pilihan; untuk `between` kedua ujung), THE Search Bar SHALL mengomit leaf `in_period`/`!in_period` ke draft, keluar mode value, dan menutup dropdown; apply tetap lewat Enter (dropdown tertutup) / tombol Search.
2. ~~WHEN `between` baru dipilih ujung awalnya, THE Search Bar SHALL menunggu ujung kedua (belum komit); Enter/Esc sebelum itu melengkapi akhir = awal.
3. ~~WHEN kolom datetime dan pilihan (period `day`, non-range) membawa jam (pemilih jam / Now / Today), THE Search Bar SHALL TIDAK auto-komit; diselesaikan lewat Enter/Esc supaya jam masih bisa diatur. Klik sel hari (00:00) = seluruh hari, auto-komit.
4. WHEN widget meng-emit nilai yang sama dengan nilai yang sudah dipegang (emisi-mount / hydrate prefill saat edit chip; dibandingkan lewat tanda tangan kanonik), THE Search Bar SHALL mengabaikannya (membuka chip untuk diedit tidak auto-komit).
5. WHEN komit dari widget, THE Search Bar SHALL mengembalikan fokus ke input (sel kalender mencurinya) tanpa membuka ulang dropdown, supaya Enter berikutnya meng-apply.

### Requirement 56: Dropdown date 2 kolom & sinkron search box <-> widget

Keputusan user: saran di kiri, DateSelector di kanan, tips tetap di bawah; simbol yang diketik tersinkron ke field "Kondisi" widget dan sebaliknya, termasuk nilainya, TANPA langsung komit ke chip.

1. WHEN mode value kolom date/datetime, THE dropdown SHALL berbentuk 2 kolom (layar `md` ke atas): kolom kiri = saran (preset, saran ketikan, Diisi/Tidak diisi), kolom kanan = widget `DateSelector`; legend tips SHALL tetap selebar penuh di bawah kedua kolom. Di layar sempit kolom bertumpuk. Lebar dropdown = lebar Panel (`min(90vw, 42rem)`).
2. WHEN user mengetik simbol di search box (`>`, `>=`, `<`, `<=`, `a..b`, tanpa simbol = `is`), THE field "Kondisi" widget SHALL berganti ke operator padanannya (`after`, `on-or-after`, `before`, `on-or-before`, `between`, `is`); WHEN teks memuat nilai yang terparse, THE Periode dan pilihan kalender/grid widget SHALL ikut terisi. Simbol berdiri sendiri (mis. `>`) mengganti Kondisi tanpa nilai; rentang separuh (`25 Sep 2026..`) mengisi ujung awal saja.
3. WHEN teks tak terparse tetapi tidak kosong, THE pilihan widget SHALL dikosongkan (operator tetap) sehingga widget selalu mencerminkan teks.
4. WHEN user mengubah "Kondisi" atau memilih nilai di widget, THE search box SHALL menulis simbol + nilai padanannya (format `>=25 Sep 2026`, `Sep 2026`, `Q3 2026`, `10 Sep 2026..20 Sep 2026`, `..` untuk between kosong); awalan `!` (kecualikan) dipertahankan. Kondisi/Periode yang diganti membersihkan pilihan (perilaku widget), sehingga teks menjadi simbol saja.
5. THE sinkronisasi SHALL TIDAK mengomit chip: komit tetap lewat Enter (Enter pertama = komit + apply untuk date), klik preset/saran, Esc/klik-luar, atau tombol Search. Teks transisi (mis. `>` saja) + Enter SHALL tidak diam-diam memilih "Diisi": opsi Diisi/Tidak diisi hanya dipilih Enter bila user menavigasi ke sana dengan panah.
6. THE saran ketikan SHALL mendukung simbol perbandingan di depan (`>= Jan` -> `>=Jan 2026`, ...) dengan operator terbawa ke nilai saran; Tab melengkapi teks sekaligus menyinkronkan widget.
8. WHILE simbol perbandingan diketik/dipilih (mis. `>` saja), THE preset dan opsi Diisi/Tidak diisi SHALL tetap tampil (disaring memakai isi tanpa simbol); preset SHALL berlabel bersimbol dan membawa operator simbol itu (`>Bulan ini` = sesudah bulan ini). Rentang (`..`) tidak menampilkan preset.
7. WHEN chip tanggal diedit, THE search box SHALL berisi teks nilai chip (`!` bila negasi `!in_period`) dan widget ter-prefill sesuai; membuka chip TIDAK mengomit apa pun.

### Requirement 54: Saran nilai tanggal mengikuti format ketikan

Keputusan user: maksimal 5 saran; ketikan paling atas; batas atas tahun = tahun sistem + 1, sisa slot tahun SEBELUM ketikan; seri urutan → tahun lebih lampau.

1. THE saran SHALL meniru format ketikan (kata, pemisah, 2/4 digit tahun, suffix jam) dan tiap kandidat divalidasi `parsePeriodToken` (sama dgn Enter): `Jan 26` → `Jan 26, Jan 25, Jan 27, Jan 24, Jan 23`.
2. THE tahun kandidat SHALL memakai `suggestionYears(typed)`: `after = clamp(0..2, tahunSistem+1 − typed)`, `before = 4 − after`, diurut selisih terdekat lalu tahun lebih lampau (ketik 2025, sistem 2026 → 2025, 2024, 2026, 2023, 2027).
3. THE token tanpa tahun (`Jan`, `Q2`, `Kuartal 2`, `Semester 1`, `15/09`, `15 Sep`) SHALL dilengkapi tahun sistem lalu divariasikan; awalan tahun 1–3 digit → tahun sekitar sistem yang berawalan itu; kata kuartal/semester tanpa angka → unit di tahun sistem (paling dekat sekarang dulu); awalan bulan 1–2 huruf/ambigu → bulan-bulan itu di tahun sistem.
4. THE parser SHALL menerima `Quartal` di samping `Kuartal`/`Triwulan`/`Quarter`.
5. WHEN Enter ditekan, THE saran ter-highlight SHALL menang atas ketikan mentah (saran pertama = ketikan itu sendiri; navigasi ke saran lain = itu yang dikomit).

9. WHEN rentang `a..b` diketik, THE saran SHALL dihitung untuk ujung akhir (kosong -> dari ujung awal) dgn ujung awal apa adanya; ujung akhir yang mendahului ujung awal SHALL dibuang; ujung akhir tanpa tahun (`Jan 2026..Mar`) SHALL dilengkapi tahun ujung AWAL. Granularitas ujung boleh beda (`Jan 2026..2027`, `2026..Q2 2027`, `10 Sep 2026..Des 2026`): kedua ujung dinormalkan ke granularitas yg lebih halus (ujung awal = unit pertama, ujung akhir = unit terakhir periodenya) lewat `buildFlexibleBetween`; berlaku juga saat Enter (`buildDateLeafFromText`) dan sinkron widget (`parseDateText`). `buildBetweenPeriodValue` (dipakai wrapper Builder) TIDAK diubah.
10. THE opsi Diisi/Tidak diisi kolom date SHALL selalu tampil (aksi tetap, tidak tersaring ketikan); Enter tanpa niat (input kosong / hanya simbol) SHALL menyelesaikan mode value tanpa mengomit preset/opsi yg tersorot otomatis; sorotan tanpa navigasi panah SHALL selalu kembali ke item pertama saat daftar berubah.

### Requirement 55: Format chip tanggal

1. THE label chip `in_period` SHALL berformat `dd MMM yyyy` (+ ` HH:mm` 24 jam bila bukan 00:00) untuk hari, `MMM yyyy` bulan, `Qn yyyy`, `Hn yyyy`, `yyyy`; nama bulan singkat mengikuti locale aktif; rentang memakai en dash. String dibaca apa adanya (tanpa konversi zona) selaras backend.

## Revisi 8 — Set/Not set, edit chip nilai, petunjuk, navigasi chip utama, audit date/datetime

### Requirement 40: Kondisi "Diisi" / "Tidak diisi" (`set` / `!set`) untuk semua tipe kolom

**User Story:** As user, I want memfilter "kolom ini terisi / kosong" langsung dari Search Bar untuk kolom tipe apa pun, so that saya tak perlu membuka Builder lanjutan hanya untuk operator `set`/`!set`.

#### Acceptance Criteria

1. WHILE mode value untuk kolom list/boolean, relation, text, number, atau date/datetime, THE dropdown SHALL menampilkan dua opsi tetap "Diisi" (`set`) dan "Tidak diisi" (`!set`) (label i18n operator yang sudah ada), terpisah dari daftar nilai; keduanya ikut tersaring oleh ketikan (list/relation/date) dan dapat dijangkau panah/Tab/Enter.
2. WHEN opsi dipilih (klik atau Enter), THE Search Bar SHALL mengomit leaf `{k, o:"set"|"!set"}` tanpa value dan keluar dari mode value; `!` di awal ketikan SHALL membalik opsi (Diisi ↔ Tidak diisi). Enter (kolom tanpa operator `in`) SHALL langsung meng-apply (Requirement 37.8); klik hanya mengomit.
3. THE chip leaf `set`/`!set` SHALL berlabel `Kolom: Diisi` / `Kolom: Tidak diisi` dan dapat diklik untuk diedit seperti chip lain.

### Requirement 41: Edit chip nilai text

#### Acceptance Criteria

1. WHILE mode value kolom text (string tanpa opsi), WHEN chip nilai diklik, THE Search Bar SHALL memuat teks chip ke input dan menandai chip itu sebagai sedang diedit (cincin `primary`); nilai baru menggantikan chip di posisi yang sama saat pemisah/Enter, dan mengosongkan input menghapus chip. Escape/klik-luar SHALL membuang perubahan (chip lama utuh).
2. WHILE sebuah chip nilai tersorot (Requirement 37.5), WHEN Enter ditekan pada kolom text, THE chip SHALL masuk mode edit yang sama.

### Requirement 42: Petunjuk (hint) yang jelas

#### Acceptance Criteria

1. THE footer petunjuk SHALL menampilkan tiap fungsi sebagai pasangan tombol (`<kbd>`) + penjelasan singkat, dikelompokkan menurut tipe kolom (mis. `!` Kecualikan, `|` `;` `,` Pisahkan jadi chip, `↑` `↓` Pilih, `Enter` Pilih/Selesai, `Tab` Lengkapi, `←` `⌫` Hapus chip), bukan satu kalimat panjang berpemisah titik.
2. THE petunjuk SHALL sesuai perilaku aktual per tipe (boolean/date: Enter menerapkan; list/relation: Enter memilih saat ada ketikan/panah, selesai bila kosong; text/number: Enter selesai) dan menyebut opsi Diisi/Tidak diisi.

### Requirement 43: Tata letak area nilai & penanda chip yang diedit

#### Acceptance Criteria

1. WHILE mode value dan sudah ada chip lain di bar, THE area nilai (penanda kolom + chip nilai + input) SHALL pindah ke baris baru selebar kotak; tombol Search/panel tetap di ujung kanan baris pertama.
2. WHILE sebuah chip (leaf, Cari, atau Group) sedang diedit, THE chip itu SHALL ditandai secara visual (cincin `primary`, atribut `data-editing`).

### Requirement 44: Navigasi panah untuk chip utama (Filter / Group)

#### Acceptance Criteria

1. WHILE mode key dan ada chip di bar, WHEN ArrowLeft ditekan (input kosong atau kursor di awal), THE chip terakhir SHALL tersorot; ArrowLeft/ArrowRight menggeser sorotan; ArrowRight melewati chip terakhir kembali ke input. ArrowUp/ArrowDown tetap memfokuskan Panel.
2. WHEN Backspace/Delete ditekan pada chip tersorot, THE chip SHALL dihapus; WHEN Enter ditekan, THE chip SHALL masuk mode edit (Requirement 41 / editor chip).

### Requirement 45: Audit date/datetime

#### Acceptance Criteria

> **Revisi 9 (instruksi user): widget `ui/date-selector.jsx` dan wrapper Builder `Filter/DateSelector.jsx` DIKEMBALIKAN ke kondisi semula ("source tidak bermasalah; fokus pada kode Search Bar"). Butir 1, 2, 4, 7 di bawah DIBATALKAN; butir 3, 5 (hanya embed Search Bar), 6, 8 tetap. Temuan pada widget/wrapper hanya dilaporkan, tidak diubah.**

1. ~~THE widget `DateSelector` (`ui/date-selector.jsx`) SHALL tidak menghasilkan nilai yang membawa jam untuk pilihan hari pada kolom date: tombol "Hari ini"/"Today" SHALL memakai awal hari; pilihan hari SHALL mempertahankan jam yang sudah dipilih (datetime).
2. ~~THE widget SHALL memiliki SATU tombol "hari ini" per tampilan hari (tombol ganda dan berteks Inggris di dalam kalender dihapus saat dipakai di dalam `DateSelector`).
3. THE nilai tidak lengkap dari widget (mis. emit awal saat mount / setelah ganti periode, tanpa tanggal) SHALL tidak dianggap nilai oleh Search Bar (tak menghasilkan leaf) maupun oleh wrapper `Filter/DateSelector.jsx`; range hari/periode yang baru separuh dipilih SHALL dilengkapi (akhir = awal) saat dikomit, konsisten di kedua tempat (helper bersama di `periodParsing.js`).
4. ~~THE wrapper `Filter/DateSelector.jsx` SHALL serialisasi tanggal sebagai string LOKAL (`YYYY-MM-DD[ HH:mm]`, Requirement 30.10), bukan `toISOString()` (UTC menggeser hari), dan membaca string lokal secara lokal.
5. THE panel pemilih periode/tahun (wrapper `Filter/DateSelector.jsx` dan embed Search Bar) SHALL mencakup 20 tahun ke belakang s/d 5 tahun ke depan secara default (`defaultYearBounds`), bukan 10 tahun terpusat / berhenti di tahun ini.
6. WHEN Enter ditekan pada preset/saran ter-highlight tanpa ketikan dan tanpa pilihan widget, THE Search Bar SHALL mengomit nilai preset itu (bukan leaf kosong hasil emisi-mount widget).
7. ~~THE tombol X wrapper `Filter/DateSelector.jsx` SHALL selalu meneruskan `null` ke parent (klik pertama pada nilai tersimpan tidak boleh no-op) dan me-remount panel supaya tanggal yang sama bisa dipilih ulang.
8. THE parser ketik `parsePeriodToken` SHALL menerima kata kuartal/semester (`Kuartal 2 2026`, `Triwulan 3 26`, `TW4 2026`, `Semester 1 2026`, `S2 2026`, `2026 Semester 2`) dan nama-bulan-dulu ala AS dengan tahun 4 digit (`Sep 15 2026`, `September 15, 2026`), tanpa mengubah format yang sudah ada.
9. Catatan keputusan yang TIDAK diubah di sini: tanggal ditafsirkan di zona waktu aplikasi (server, `APP_TIMEZONE`), sementara tabel menampilkan datetime di zona waktu browser — selisih zona untuk kolom datetime dilaporkan ke user sebagai keputusan lanjutan (perlu `tz` pada value).

### Requirement 46: Pengujian (Revisi 8)

#### Acceptance Criteria

1. THE test SHALL mencakup: `set`/`!set` di semua vmode (klik, Enter, `!` membalik, chip label, edit chip); edit chip nilai text (klik, Enter pada chip tersorot, Escape membuang, kosong menghapus); navigasi panah chip utama; legend petunjuk; tata letak baris baru & penanda `data-editing`; perbaikan date (nilai tidak lengkap tak jadi leaf, range separuh dilengkapi, Today = awal hari, jam dipertahankan, wrapper Builder serialisasi lokal, tahun mendatang).

## Revisi 7 — Chip nilai (`in`), Enter = selesai, Tab completion

Konteks: setelah Revisi 6 (feedback), search box mencerminkan centangan sebagai teks `a | b | c`. Dipakai nyata, input jadi panjang & sulit dipakai mencari opsi berikutnya (persis keluhan lama pada `MultiSelect`), dan Enter ambigu (toggle opsi ter-highlight vs. "selesai"). Revisi 7 mengganti model teks itu dengan **chip nilai**; Requirement 27.6–27.9 yang menyebut "teks `a | b |` di search box" digantikan Requirement 36 di bawah (hal lain di 27 — komit satu leaf `=`/`in`, checked di atas, boolean satu pilihan — tetap berlaku).

### Requirement 36: Chip nilai untuk kolom ber-operator `in`

**User Story:** As user, I want nilai yang sudah saya pilih/ketik tampil sebagai chip di dalam search box, so that kotak tetap ringkas dan saya bisa terus mencari nilai berikutnya.

#### Acceptance Criteria

1. WHILE mode value untuk kolom list/boolean, relation, text, atau number, THE nilai terpilih SHALL tampil sebagai chip (label + tombol ×) di dalam kotak search, setelah penanda `[Kolom:]` dan sebelum input; THE input SHALL hanya berisi ketikan yang sedang berlangsung.
2. WHEN user mengetik pemisah (`|` atau `;` untuk SEMUA tipe; `,` hanya untuk non-number — koma = desimal pada number) setelah teks, THE Search Bar SHALL langsung mengubah teks itu menjadi chip (list/boolean: cocok PERSIS label opsi, relation: cocok PERSIS label record, number: harus angka, text: teks apa pun), mengosongkan input, dan MEMBIARKAN dropdown nilai tetap terbuka.
3. IF segmen sebelum `|` tidak dapat diresolusi (label tak cocok / bukan angka), THEN THE Search Bar SHALL tidak membuat chip, membiarkan teks apa adanya, dan menampilkan pesan. Untuk relation, label yang belum ada di hasil fetch SHALL dicari langsung ke endpoint yang sama sebelum dinyatakan tidak ditemukan. Bila beberapa record berlabel sama, THE Search Bar SHALL memilih yang belum terpilih.
4. WHEN opsi dipilih dari daftar (klik atau Enter, Requirement 37.1), THE chip SHALL ditambah dan ketikan sementara dikosongkan; dropdown tetap terbuka. Chip dihapus lewat tombol ×, Backspace/Delete (Requirement 37.6).
5. THE tanda `!` di awal input SHALL tetap tinggal di input setelah konversi chip (negasi berlaku untuk seluruh chip: `!=`/`!in`, `!matches`).
6. THE kolom boolean SHALL maksimal satu chip (pilihan berikutnya menggantikan).
7. WHEN mode value keluar (Enter, Escape, klik-luar, tombol Search), THE chip SHALL dikomit jadi SATU leaf: satu chip → operator biasa, ≥2 chip → `in`/`!in`. Ketikan yang cocok PERSIS satu opsi ikut dikomit (list/relation).
8. WHEN mengedit chip leaf existing berisi `in`/`!in`/`=`/`!=` (list/relation) atau `in`/`!in` (text/number), THE nilai SHALL tampil sebagai chip; `!` di input bila leaf bernegasi.
9. Kolom date/datetime SHALL TIDAK memakai chip nilai (backend hanya menerima satu periode per leaf).
10. (Revisi 7, susulan) THE daftar opsi list/boolean/relation SHALL TIDAK memakai checkbox dan SHALL hanya memuat opsi/record yang BELUM menjadi chip (tanpa kelompok tercentang & pemisah); chip di kotak sudah menampilkan pilihan, termasuk saat kata kunci pencarian berubah (Requirement 28).

### Requirement 37: Enter = selesai; navigasi & penghapusan chip nilai

**User Story:** As user, I want Enter selalu berarti "selesai", so that tidak ada lagi kebingungan antara mencentang opsi dan menutup dropdown.

#### Acceptance Criteria

1. WHILE mode value list/boolean atau relation, WHEN Enter ditekan dan user sedang MENUJU opsi (ada ketikan, atau baru menekan panah atas/bawah), THE Search Bar SHALL memilih opsi ter-highlight yang cocok dengan ketikan menjadi chip (dropdown tetap terbuka, ketikan dikosongkan). WHEN Enter ditekan TANPA niat itu (ketikan kosong & tanpa panah) atau pada kolom text/number, THE Search Bar SHALL menyelesaikan: ketikan yang cocok/valid ikut jadi chip, semua chip dikomit ke draft tree, mode value keluar, dan dropdown ditutup (Enter berikutnya saat dropdown tertutup meng-apply — jalur trigger 1). Handler Enter root cmdk SHALL dicegah (tidak ikut memilih item). (Susulan Revisi 7: sebelumnya Enter selalu menyelesaikan.)
2. IF ketikan tak kosong tapi tak dapat menjadi nilai (label tak cocok / bukan angka), THEN Enter SHALL tidak menyelesaikan dan menampilkan pesan.
3. IF tidak ada chip maupun ketikan, THEN Enter SHALL keluar dari mode value tanpa mengubah draft tree.
4. THE date/datetime SHALL tetap memakai aturan Requirement 30.6 (Enter mengomit ketikan/widget), dan setelah komit dropdown SHALL ditutup juga.
5. WHILE input kosong (atau kursor di awal) dan ada chip nilai, WHEN ArrowLeft ditekan, THE chip terakhir SHALL tersorot; ArrowLeft/ArrowRight berikutnya SHALL memindahkan sorotan antar chip (ArrowRight melewati chip terakhir mengembalikan ke input).
6. WHEN Backspace ditekan dengan input kosong, THE chip terakhir SHALL tersorot dulu (langkah 1); WHEN Backspace/Delete ditekan saat sebuah chip tersorot, THE chip itu SHALL dihapus dan sorotan direset (langkah 2). Backspace di input kosong TANPA chip SHALL keluar dari mode value seperti sebelumnya.
7. WHEN user mengetik apa pun atau memindahkan fokus, THE sorotan chip SHALL dilepas.

8. (Susulan) Untuk kolom TANPA operator `in` (boolean, date/datetime), THE Enter PERTAMA SHALL langsung menyelesaikan DAN meng-apply (tidak menunggu Enter kedua): boolean — Enter memilih opsi ter-highlight (bila ada ketikan/panah) atau mengomit chip yang ada; date/datetime — Enter mengomit ketikan/widget, atau preset/saran ter-highlight. Tanpa nilai apa pun Enter hanya keluar dari mode value tanpa apply. Kolom dengan `in` (list, relation, text, number) tetap: Enter menyelesaikan, Enter berikutnya (dropdown tertutup) meng-apply.

### Requirement 38: Tab completion (mirip `Select.jsx`)

**User Story:** As user, I want Tab melengkapi ketikan dengan opsi ter-highlight, so that saya tak perlu mengetik label penuh.

#### Acceptance Criteria

1. WHILE mode key (memilih kolom), WHEN Tab ditekan dengan saran kolom ter-highlight, THE Search Bar SHALL memilih kolom itu (setara `:`, Requirement 19.1) dan fokus tetap di input.
2. WHILE mode value list/boolean/relation dengan ketikan tak kosong, WHEN Tab ditekan dengan opsi ter-highlight, THE Search Bar SHALL hanya MENULIS label opsi itu ke input (tidak memilihnya) dan mempertahankan fokus; pemilihan sebenarnya lewat `|` atau Enter. Awalan `!` dipertahankan.
3. WHILE mode value date/datetime, WHEN Tab ditekan dengan saran periode ter-highlight, THE Search Bar SHALL menulis label saran itu ke input (awalan `!`/`>`/`>=`/`<`/`<=` dipertahankan).
4. WHILE ketikan kosong (mode value) atau tidak ada yang ter-highlight, THE Tab SHALL berperilaku normal.
5. WHILE user belum menuju opsi (tanpa ketikan & tanpa panah), THE sorotan cmdk otomatis pada item pertama SHALL disembunyikan secara visual (hover mouse tetap terlihat) dan panah PERTAMA SHALL hanya memunculkan sorotan pada opsi itu (bukan menggesernya ke item kedua). (Menggantikan aturan "highlight melompati opsi tercentang": opsi terpilih tak ada lagi di daftar.)

### Requirement 39: Pengujian (Revisi 7)

#### Acceptance Criteria

1. THE test `SearchBar.rtl.test.jsx` SHALL mencakup: konversi `|` → chip (list, boolean, relation, text, number) dengan dropdown tetap terbuka; tombol ×; navigasi ArrowLeft/Right + Backspace/Delete 2 langkah; Enter = selesai (semua vmode, dropdown tertutup, Enter berikutnya apply); pesan bila label tak cocok; resolusi relation async; negasi `!`; prefill chip saat edit; Tab completion (kolom, opsi, saran date); boolean satu chip.
2. THE test `columnSearch.test.js` SHALL mencakup helper baru (komposisi leaf dari chip) bila ada.
