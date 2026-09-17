# Requirements Document

## Introduction

`LinkModel.jsx` (resources/js/Components/LinkModel.jsx) adalah komponen lookup/typeahead untuk memilih satu record dari model Eloquent lain. Saat ini, dropdown-nya hanya menampilkan daftar terbatas (`limit`, default 10) hasil pencarian teks sederhana. Baris "more" (`MORE_VALUE`) sudah ada di dropdown sebagai sentinel saat `total > limit`, tapi `onSelect`-nya masih placeholder kosong (`// setOpenDialog(true);`).

Fitur ini menambahkan **dialog Advance Search / See More**: saat user klik baris "more" (atau tombol advance search eksplisit), muncul dialog pencarian lanjutan bergaya `SelectModel.jsx` (tabel + kolom + filter + infinite scroll), tapi dengan gate keamanan kolom yang sama seperti dropdown LinkModel biasa (bukan raw schema seperti `SelectModel`). Di mobile, tabel diganti tampilan list berbasis `templateLink`. Pencarian di dialog dibekali filter lanjutan (`FilterTable`, nested-tree) yang bersifat **tambahan** terhadap `filters` non-editable yang sudah dipasang form pemanggil LinkModel — `filters` sendiri tetap ditampilkan di FilterTable dalam keadaan locked, bukan disembunyikan.

## Glossary

- **LinkModel**: komponen dropdown/typeahead single-select (resources/js/Components/LinkModel.jsx) yang jadi subjek utama spec ini.
- **Advance Search Dialog**: dialog baru yang dibuka dari LinkModel, isinya tabel/list hasil pencarian lanjutan.
- **templateLink**: representasi tampilan satu record sebagai string (mis. `:code — :name`), dihasilkan `convertTemplateLink()` (resources/js/lib/linkModelUtils.js). Dipakai untuk render baris dropdown & fallback mobile.
- **Kolom aman (linkable)**: himpunan kolom yang server izinkan keluar untuk konteks lookup LinkModel — `templateLink columns + id + (fields ∩ linkable) − visibleFor gagal izin`, dihitung `safeLookupColumns()` di `ModelController.php`. Beda dari kolom yang di-return `model.selectData` untuk `SelectModel` (raw schema, tidak digating `linkable` di level metadata — hanya row data yang digating). Untuk Advance Search Dialog, himpunan ini terbagi TIGA subset (lihat Requirement 2.6-2.7):
  - **Kolom non-picker** (selalu ikut query, TIDAK PERNAH muncul sbg opsi di column-picker): `id`/primary key, `ALWAYS_ALLOWED_ATTRIBUTES` (`route`, `canDelete`, `canUpdate`, `keyModel`, `appendStatus`, `thisModel`, `templateLink` computed attribute, `disabledOn`).
  - **Kolom sumber templateLink** (`templateLinkColumns()` — mis. `code`/`name` yang dipakai template `:code — :name`): selalu ikut query DAN selalu tampil di tabel — MUNCUL di column-picker tapi dalam keadaan **locked** (selalu tercentang, tidak bisa di-toggle/disembunyikan user).
  - **Kolom data linkable lain**: kolom scalar yang lolos gate `linkable===true` (dan `visibleFor` bila ada) di luar kolom sumber templateLink — opsi togglable biasa di column-picker.
- **`fields` (prop LinkModel)**: daftar nama kolom tambahan yang form BUTUHKAN di payload `onValueChange`, di luar kolom templateLink (lihat JSDoc `LinkModel.jsx` & spec `linkmodel-column-security`). Prop ini BUKAN gerbang keamanan (gate keamanan tetap `linkable` di server, `fields` cuma hemat over-fetch) dan scope-nya HANYA payload value terpilih — **bukan** pembatas kolom yang boleh ditampilkan/di-browse di Advance Search Dialog (lihat Requirement 2.3).
- **`filters` (prop LinkModel, non-editable)**: filter dasar yang sudah dipasang form pemanggil (mis. batasi status/tipe record). Grammar tree sama seperti dijelaskan di `SelectModel.jsx` JSDoc (`LinkModelFilterTree`).
- **FilterTable**: komponen `resources/js/Components/Table/Filter/FilterTable2.jsx` (nama file `FilterTable2.jsx`, nama komponen di dalamnya `FilterTable`) — filter nested-tree + saved-filter, dipakai `DataTable2.jsx` saat ini. **Bukan** `resources/js/Components/Table/FilterTable.jsx` (versi lama, array-based, legacy).
- **Filter tambahan (additive filter)**: kondisi yang disusun user lewat FilterTable di dalam Advance Search Dialog — di-AND-kan dengan `filters` (non-editable), tidak menimpanya.
- **InputGroup**: primitive UI (`resources/js/Components/ui/input-group.jsx`: `InputGroup`, `InputGroupAddon`, `InputGroupButton`, `InputGroupInput`) untuk menyusun input + tombol berdampingan dalam satu border.

## Requirements

### Requirement 1: Membuka Advance Search Dialog

**User Story:** Sebagai user yang mengisi field LinkModel, saya ingin bisa membuka pencarian lanjutan saat hasil dropdown singkat tidak cukup, supaya saya bisa menelusuri lebih banyak record dengan kolom & filter lengkap.

Ada DUA entry point independen menuju dialog yang sama — kemunculannya tidak saling bergantung:

- **Baris "See more"** (di dalam `CommandList` dropdown): kondisional, hanya muncul saat `showMore` true (`!cache && total > limit`). Perilaku ini SUDAH ADA (`showMore`/`MORE_VALUE`) dan TIDAK berubah — spec ini hanya mengisi `onSelect`-nya.
- **Tombol "Advance Search"**: SELALU tampil di LinkModel, terlepas dari `total`/`limit`/`showMore`/ada-tidaknya opsi terpilih — bukan alternatif/pengganti "See more", melainkan entry point tambahan yang independen.

#### Acceptance Criteria

1. WHEN jumlah total hasil (`total`) melebihi `limit` (`showMore` true) DAN user memilih baris "See more" di dropdown, THE LinkModel SHALL membuka Advance Search Dialog (menggantikan placeholder `onSelect` kosong yang ada sekarang di baris `MORE_VALUE`).
2. IF `showMore` false (total belum melebihi limit), THEN THE LinkModel SHALL tetap TIDAK menampilkan baris "See more" di dropdown — kondisi kemunculannya tidak berubah dari perilaku sekarang.
3. THE LinkModel SHALL selalu menampilkan tombol "Advance Search" (unconditional — tidak bergantung pada `total`, `limit`, `showMore`, maupun ada/tidaknya value terpilih), sebagai entry point kedua yang independen dari baris "See more".
4. WHEN `disabled` atau `readOnly` bernilai true, THE LinkModel SHALL tidak menampilkan/menonaktifkan tombol "Advance Search" maupun akses ke Advance Search Dialog (konsisten dengan dropdown utama yang juga disembunyikan saat `disabled`/`readOnly`).
5. WHEN Advance Search Dialog terbuka (dari entry point manapun — "See more" atau tombol "Advance Search"), THE LinkModel SHALL menutup dropdown popover utama (state `open` di-set `false`) agar tidak tumpang tindih.

### Requirement 2: Tampilan tabel desktop dengan kolom aman (linkable-gated)

**User Story:** Sebagai user desktop, saya ingin melihat hasil pencarian lanjutan dalam bentuk tabel berkolom seperti SelectModel, supaya saya bisa membandingkan beberapa atribut record sebelum memilih.

#### Acceptance Criteria

1. WHEN Advance Search Dialog terbuka di layar desktop (breakpoint mengikuti konvensi responsive yang sudah dipakai codebase, mis. `lg:` di `DataTable2.jsx`), THE Advance Search Dialog SHALL menampilkan data dalam bentuk tabel berkolom (pola `Table2` seperti `SelectModel.jsx`).
2. THE Advance Search Dialog SHALL HANYA menampilkan kolom yang termasuk himpunan "kolom aman" LinkModel (lihat Glossary) untuk model yang sedang di-lookup — bukan seluruh kolom schema mentah seperti `SelectModel`.
3. THE himpunan "kolom data linkable" yang ditampilkan/dapat-ditoggle di Advance Search Dialog SHALL mencakup SEMUA kolom yang `linkable===true` (dan lolos `visibleFor`) untuk model tsb, TIDAK dibatasi ke subset yang kebetulan disebut di prop `fields` pada instance LinkModel tersebut. Prop `fields` hanya mengatur payload `onValueChange` (lihat Glossary) — independen dari kolom yang boleh di-browse di dialog ini.
4. IF sebuah kolom tidak lolos gate `linkable`/`visibleFor` untuk user yang sedang login, THEN THE Advance Search Dialog SHALL tidak menampilkan kolom tersebut sebagai header tabel maupun cell data.
5. THE Advance Search Dialog SHALL memuat data lewat infinite scroll (bukan kontrol pagination bernomor seperti `Pagination` di `SelectModel.jsx`) — halaman berikutnya otomatis dimuat & di-append ke daftar saat user scroll mendekati baris terakhir, dan indikator loading tampil saat sedang memuat halaman berikutnya maupun saat query awal berubah (search/filter baru).
6. THE Advance Search Dialog SHALL menyediakan pemilih kolom (column-picker, pola `Table2`/`ColumnsFilter` yang sudah dipakai `SelectModel.jsx`) yang opsinya TERBATAS ke "kolom sumber templateLink" + "kolom data linkable lain" (lihat Glossary) — EXCLUDE `id`/primary key dan `ALWAYS_ALLOWED_ATTRIBUTES` sepenuhnya dari daftar opsi (tidak pernah muncul sbg pilihan), walau keduanya tetap bagian dari "kolom aman" yang ikut di-query.
7. THE column-picker SHALL menampilkan kolom sumber templateLink sebagai opsi yang **di-lock**: selalu tercentang/tampil di tabel, TIDAK BISA di-toggle/disembunyikan user — beda dari "kolom data linkable lain" yang togglable bebas.
8. WHEN user memilih (klik) satu baris di tabel, THE Advance Search Dialog SHALL menetapkan baris tersebut sebagai value LinkModel dan menutup dialog, dengan payload yang dipangkas sesuai Requirement 7 (bukan seluruh kolom linkable yang tampil di tabel).

### Requirement 3: Tampilan mobile berbasis templateLink

**User Story:** Sebagai user mobile, saya ingin hasil pencarian lanjutan ditampilkan sebagai daftar ringkas, supaya tetap mudah dibaca & dipilih di layar sempit tanpa tabel berkolom banyak.

#### Acceptance Criteria

1. WHEN Advance Search Dialog terbuka di layar mobile (breakpoint sama seperti Requirement 2.1), THE Advance Search Dialog SHALL menampilkan data sebagai daftar (list), setiap item merender `convertTemplateLink()` dari row tersebut — bukan tabel berkolom.
2. THE tampilan mobile SHALL menggunakan sumber data & hasil filter/pencarian yang sama dengan tampilan desktop (hanya representasi render yang beda, bukan query/endpoint berbeda).
3. WHEN user memilih (tap) satu item di daftar mobile, THE Advance Search Dialog SHALL menetapkan item tersebut sebagai value LinkModel dan menutup dialog, dengan payload dipangkas sesuai Requirement 7 (perilaku sama seperti Requirement 2.8).
4. THE tampilan mobile SHALL memakai mekanisme infinite scroll yang sama seperti Requirement 2.5 (bukan pagination bernomor) bila hasil melebihi satu halaman.

### Requirement 4: Search bar InputGroup dengan tombol filter berbadge

**User Story:** Sebagai user, saya ingin kotak pencarian teks dan tombol buka filter lanjutan berada dalam satu grup input yang rapi, dengan indikator jumlah filter aktif, supaya saya tahu ada filter tambahan yang sedang berlaku.

#### Acceptance Criteria

1. THE Advance Search Dialog SHALL menyusun kotak pencarian teks menggunakan primitive `InputGroup`/`InputGroupInput` (resources/js/Components/ui/input-group.jsx).
2. THE tombol untuk membuka FilterTable SHALL diletakkan di sisi kiri input teks pencarian, di dalam `InputGroup` yang sama (pola `InputGroupAddon`/`InputGroupButton`).
3. WHEN jumlah kondisi filter tambahan (additive, dari user) aktif lebih dari nol, THE tombol filter SHALL menampilkan badge berisi jumlah kondisi tersebut (pola badge count yang sudah ada di `FilterTable2.jsx`, dihitung dari `flattenFilters`).
4. THE badge count SHALL HANYA menghitung kondisi filter tambahan (additive) — kondisi yang berasal dari prop `filters` non-editable (Requirement 5.6, ditampilkan locked di FilterTable) SHALL tidak ikut dihitung, walau kondisi itu tampil di FilterTable.
5. WHEN jumlah kondisi filter tambahan aktif adalah nol (terlepas dari ada/tidaknya kondisi locked dari `filters`), THE tombol filter SHALL tidak menampilkan badge.
6. WHEN user mengetik di kotak pencarian, THE Advance Search Dialog SHALL memakai teks tersebut sebagai kata kunci pencarian (dikirim ke endpoint yang sama dengan mekanisme search LinkModel/SelectModel yang sudah ada), dengan debounce bila diperlukan untuk menghindari request berlebihan.

### Requirement 5: FilterTable sebagai filter tambahan (additive), bukan pengganti

**User Story:** Sebagai developer form yang memasang `filters` non-editable di LinkModel (mis. batasi status record), saya ingin filter tambahan dari Advance Search Dialog tidak menimpa batasan dasar itu, supaya integritas data yang bisa dipilih user tetap terjaga.

#### Acceptance Criteria

1. WHEN tombol filter di-klik, THE Advance Search Dialog SHALL menampilkan `FilterTable` (`resources/js/Components/Table/Filter/FilterTable2.jsx`), bukan `Table/FilterTable.jsx` versi lama.
2. THE kondisi yang disusun user di FilterTable SHALL diperlakukan sebagai filter tambahan (additive) terhadap prop `filters` (non-editable) yang sudah dipasang pada instance LinkModel tersebut.
3. THE Advance Search Dialog SHALL mengirim KEDUA filter (non-editable `filters` dari props + filter tambahan dari FilterTable) sebagai kondisi yang di-AND-kan ke backend — bukan menggantikan salah satunya.
4. THE Advance Search Dialog SHALL tidak mengizinkan user mengubah/menghapus kondisi yang berasal dari prop `filters` (non-editable) lewat FilterTable — konsisten dengan sifat non-editable `filters` yang sudah didokumentasikan di JSDoc `SelectModel.jsx` (`LinkModelFilterTree`, "NON-EDITABLE").
5. WHEN user membuka kembali FilterTable dalam sesi dialog yang sama, THE FilterTable SHALL menampilkan kembali kondisi filter tambahan yang sebelumnya sudah diterapkan (state tidak hilang selama dialog masih terbuka).
6. THE FilterTable SHALL TETAP menampilkan kondisi dari prop `filters` (non-editable) sebagai baris **locked** (disabled/read-only, tidak bisa diubah operator/nilai maupun dihapus) — BUKAN disembunyikan — supaya user tahu ada filter dasar yang selalu diterapkan. Baris locked ini tampil terpisah/dapat dibedakan secara visual dari kondisi tambahan (additive) yang bisa diedit user.
7. THE konversi `filters` (grammar `LinkModelFilterTree`) → tree yang renderable di FilterTable SHALL memakai ulang helper yang sudah ada `linkModelToFilterTree()` (resources/js/lib/linkModelToFilterTree.js) — bukan implementasi konversi baru.
8. WHEN sebuah kondisi di `filters` mencocokkan relasi berdasarkan `id` (mis. `{ customer: { id: 5 } }` — value HANYA berisi `id`/`type`, tanpa sub-kolom lain), THE FilterTable SHALL merender kondisi tersebut sebagai satu baris relasi dengan operator `=` yang value field-nya adalah komponen `LinkModel` (pola `valueInput: "linkmodel"` yang sudah ada di `ValueField.jsx`/`operators.js`) — menampilkan label record terkait (templateLink), BUKAN angka id mentah. Ini konsekuensi otomatis dari reuse `linkModelToFilterTree()` (Requirement 5.7), bukan logic baru yang perlu ditulis ulang.

### Requirement 6: Carry-over teks pencarian dari input LinkModel

**User Story:** Sebagai user yang sudah mengetik sesuatu di kotak LinkModel sebelum membuka Advance Search, saya ingin teks itu otomatis muncul di kotak pencarian dialog, supaya saya tidak perlu mengetik ulang.

#### Acceptance Criteria

1. WHEN user mengetik teks di input LinkModel (state `search`) lalu membuka Advance Search Dialog (via Requirement 1.1 atau 1.2), THE Advance Search Dialog SHALL menginisialisasi kotak pencariannya dengan nilai `search` tersebut.
2. IF input LinkModel kosong (belum ada teks/opsi terpilih) saat Advance Search Dialog dibuka, THEN THE kotak pencarian dialog SHALL dimulai kosong.
3. THE carry-over ini SHALL terjadi hanya sekali saat dialog dibuka (nilai awal) — perubahan berikutnya pada kotak pencarian dialog SHALL independen dari perubahan pada input LinkModel utama (dan sebaliknya), selama dialog belum ditutup-buka ulang.

### Requirement 7: Payload `onValueChange` tetap dipangkas sesuai `fields`, terlepas dari kolom yang tampil di tabel dialog

**User Story:** Sebagai developer form yang memasang `fields` di LinkModel untuk membatasi data yang masuk ke `onValueChange`, saya ingin kontrak itu tetap berlaku walau user memilih record lewat Advance Search Dialog (yang tabelnya menampilkan lebih banyak kolom untuk keperluan browsing), supaya bentuk payload konsisten & tidak bocor kolom ekstra yang tak diminta form.

#### Acceptance Criteria

1. WHEN user memilih record dari Advance Search Dialog (tabel desktop Requirement 2.8 atau list mobile Requirement 3.3), THE LinkModel SHALL memanggil `onValueChange` dengan bentuk payload yang SAMA seperti hasil pemilihan dari dropdown biasa: kolom templateLink + `id` + `ALWAYS_ALLOWED_ATTRIBUTES` + (`fields` ∩ `linkable`) — BUKAN seluruh "kolom data linkable" yang sempat ditampilkan di tabel/list dialog untuk keperluan browsing.
2. THE kolom sumber templateLink SHALL SELALU ada di payload `onValueChange` tersebut, terlepas dari apakah kolom itu disebut di prop `fields` atau tidak (fail-safe: `fields` tidak bisa secara tidak sengaja menghilangkan kolom templateLink yang dibutuhkan untuk merender value terpilih).
3. THE kolom data linkable yang TIDAK disebut di prop `fields` — meski sempat tampil sbg kolom tabel di Advance Search Dialog (Requirement 2.3) — SHALL tidak ikut di payload `onValueChange`.

## Non-Goals / Out of Scope

- Perubahan pada mekanisme dropdown utama LinkModel yang sudah ada (Tab-autocomplete, exact-match on close, sentinel `ADD_VALUE`/tombol tambah data baru) — di luar scope, tidak diubah.
- Saved filter (bookmark/nama filter) di dalam Advance Search Dialog — `FilterTable2.jsx` mendukungnya via prop `model`/`activeFid`/`onSaved`, tapi keputusan apakah diaktifkan di konteks LinkModel ini didiskusikan di design.md, bukan requirement wajib.
- Perubahan skema keamanan kolom (`linkable`/`visibleFor`) itu sendiri — spec ini memakai mekanisme yang sudah ada (`linkmodel-column-security`), tidak mengubah aturannya.
