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

### Requirement 16: Pengujian

**User Story:** As tim pengembang, I want fitur ini teruji di level fungsi murni, komponen, dan backend, so that regresi di 60+ halaman Index terdeteksi CI.

#### Acceptance Criteria

1. THE modul `searchChips.js`, `searchSuggestions.js`, `resolveSearchColumns.js`, dan `filterTreeCompare.js` SHALL punya unit test co-located (`.test.js`, environment node) yang mencakup aturan design §5.1–§5.4.
2. THE komponen `SearchBar`, `SearchPanel`, `ChipEditor` SHALL punya test RTL (`.rtl.test.jsx`); test existing `FilterTable2.rtl.test.jsx` dan `DataTable2.rtl.test.jsx` SHALL diperbarui dan tetap hijau.
3. THE test RTL SHALL TIDAK memakai `vi.useFakeTimers()` bersama Radix Popover/cmdk; assertion asinkron SHALL memakai `waitFor` dari `@testing-library/react`.
4. THE backend SHALL punya test PHPUnit untuk: validasi `sort`/`group` di `SavedFilterController::update()`, `group` di `index()`, `group` di `FilterTemplateController`, prioritas & fallback group di `DataTableScope` (Requirement 12), dan sanitasi `searchScope` (Requirement 5.2–5.3).
5. THE fitur SHALL diverifikasi visual di browser memakai `npm run build` setelah `php artisan migrate` di DB lokal.
