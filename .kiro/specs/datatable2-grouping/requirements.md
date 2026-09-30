# Requirements Document

## Introduction

Requirements ini diturunkan dari [design.md](design.md) yang sudah disepakati lewat sesi brainstorming (alur `design-first`). `DataTable2` dipakai di 73+ controller lewat macro `Model::dataTable()` ([DataTableScope.php](../../../app/Models/Scopes/DataTableScope.php)) — fitur baru di komponen ini butuh keputusan desain eksplisit, bukan sekadar tambal 1-2 file.

Fitur inti: user bisa mengelompokkan (*group-by*) baris `DataTable2` berdasarkan 1 kolom yang secara eksplisit ditandai boleh di-group (`groupable`). Backend menghitung jumlah baris per grup lewat query terpisah, akurat lintas **semua** data yang match filter aktif — bukan cuma baris di halaman yang sedang tampil. Mekanisme fetch data (pagination) **tidak diubah** — baris tetap diambil lewat `paginate()` seperti sekarang; infinite scroll dipertimbangkan tapi sengaja dikeluarkan dari scope (lihat §Keputusan).

Saat review design, ditemukan celah existing yang tidak berhubungan langsung dengan grouping tapi pola perbaikannya identik: `?sort=` di `DataTableScope::dataTable()` tidak pernah divalidasi terhadap flag `sortable` sebelum dipakai di `orderBy()`. Atas permintaan eksplisit user, gate ini ditutup dalam spec yang sama (Requirement 2), memakai pola validasi yang sama dengan gate `groupable`.

## Glossary

- **Groupable**: flag boolean per kolom (`$configColumns` milik model) yang menandai kolom itu boleh dipakai untuk grouping. Opt-in — default absent/false.
- **Gate sortable**: validasi baru di `DataTableScope::dataTable()` yang memastikan `?sort=` cuma dipakai kalau kolom itu ada di `dataTableColumns` DAN `sortable !== false`, sebelum masuk `orderBy()`.
- **Flat-paginated**: baris tetap diambil lewat `Builder::paginate($show)` biasa (LIMIT/OFFSET per halaman) — bukan di-restrukturisasi jadi fetch per-grup.
- **Run-length grouping**: teknik deteksi batas grup di frontend dengan membandingkan value grup baris berjalan vs baris sebelumnya pada array `data` yang SUDAH terurut — bukan re-sort di client.
- **groupCounts**: prop Inertia baru (`{value: count} | null`) berisi jumlah baris per grup, dihitung backend lewat query `GROUP BY` terpisah, akurat lintas semua halaman.
- **Grup terpotong**: kondisi disengaja di mana 1 grup melebihi ukuran halaman (`show`) sehingga header grup yang sama muncul lagi di halaman berikutnya — count tetap akurat, cuma representasi visualnya terpisah.

## Requirements

### Requirement 1: Kolom groupable bersifat opt-in

**User Story:** As pengembang modul, I want mendeklarasikan kolom mana yang boleh di-group secara eksplisit, so that grouping tidak otomatis aktif di kolom yang tidak masuk akal di-group (mis. jumlah currency, kolom relasi).

#### Acceptance Criteria

1. THE flag `groupable` SHALL dideklarasikan per kolom lewat `$configColumns`/`$defaultConfigColumns` milik model (extension point existing yang sudah dipakai untuk override `sortable`/`ignore`) — `app/Traits/LinkModel.php` SHALL TIDAK diubah.
2. Kolom TANPA flag `groupable` eksplisit SHALL diperlakukan sebagai `groupable: false` (opt-in, bukan opt-out — beda dari `sortable` yang default `true`).
3. Kolom bertipe relasi (`type: relation`) SHALL TIDAK diperlakukan sebagai groupable oleh backend, WALAUPUN developer keliru men-set `groupable: true` di config relasi tsb — grouping by relasi eksplisit di luar scope v1.

### Requirement 2: Gate validasi `sortable` pada `?sort=`

**User Story:** As pengembang, I want request `?sort=` tervalidasi terhadap flag `sortable` sebelum dipakai di query, so that kolom yang eksplisit dinonaktifkan sortable-nya (atau kolom tak dikenal/dotted path relasi) tidak bisa dipaksa lewat URL manual.

#### Acceptance Criteria

1. WHEN request membawa `?sort=<kolom>` dan `<kolom>` ada di `dataTableColumns` model dengan `sortable` bernilai selain `false`, THE `DataTableScope::dataTable()` SHALL memakai `<kolom>` tsb sebagai `orderBy()`.
2. WHEN request membawa `?sort=<kolom>` dan `<kolom>` TIDAK ada di `dataTableColumns`, ATAU `sortable: false`, ATAU berupa dotted path relasi, THE `DataTableScope::dataTable()` SHALL diam-diam fallback ke `Model::getDefaultSortColumn()` — TIDAK mengembalikan error 422/500.
3. Gate ini SHALL berlaku juga untuk sort yang berasal dari saved filter default (`$appliedFilter->sort`), bukan cuma `?sort=` eksplisit di query string.
4. Default sort kolom model (`Model::getDefaultSortColumn()`) SHALL dipercaya tanpa validasi tambahan terhadap dirinya sendiri (developer-controlled, bukan input dari luar).

### Requirement 3: Backend menghitung count per grup secara akurat

**User Story:** As user yang mengaktifkan grouping, I want jumlah baris per grup akurat lintas SEMUA data yang match filter aktif, so that saya tahu total sebenarnya walau grup itu terpotong ke banyak halaman.

#### Acceptance Criteria

1. WHEN request membawa `?group=<kolom>` dan `<kolom>` groupable (Requirement 1), THE `DataTableScope::dataTable()` SHALL menjalankan query `GROUP BY` terpisah — clone query SETELAH seluruh constraint (where/filter/branch-scope/submitable) ter-apply — untuk menghitung `COUNT(*)` per nilai grup.
2. Hasil hitung SHALL dibagikan sebagai `groupCounts` (peta `{value: count}`) lewat `Inertia::share()`.
3. WHEN request TIDAK membawa `?group=`, THE macro SHALL TIDAK menjalankan query `GROUP BY` tambahan sama sekali — zero overhead untuk 73+ halaman yang tidak pakai grouping.
4. WHEN `?group=<kolom>` menunjuk kolom yang tidak groupable atau tidak dikenal, THE `groupCounts` SHALL bernilai `null` dan grouping SHALL diabaikan diam-diam (bukan error).
5. `groupCounts` SHALL dihitung dari row-set yang PERSIS SAMA dengan yang menghasilkan `data.data` (paginator) — filter aktif dan branch scope yang sama SHALL berlaku di kedua query.

### Requirement 4: Kontrol "Group by" & penguncian sort di frontend

**User Story:** As user, I want memilih kolom grouping dari toolbar tabel dan langsung melihat baris se-grup saling menempel, so that saya tidak perlu mengatur sort secara manual.

#### Acceptance Criteria

1. THE `DataTable2.jsx` SHALL menampilkan kontrol "Group by" (Select di toolbar desktop, submenu di dropdown mobile) berisi daftar kolom yang `groupable`, plus 1 opsi "Tidak ada" untuk menonaktifkan grouping.
2. WHEN user memilih kolom di "Group by", THE `options.group` SHALL diset ke kolom itu, `options.sort` SHALL otomatis mengikuti kolom yang sama, DAN `options.page` SHALL direset ke `1`.
3. SELAMA `options.group` truthy, THE dropdown pemilih KOLOM pada kontrol "Sort By" SHALL dinonaktifkan — tombol arah asc/desc SHALL tetap aktif.
4. WHEN user memilih "Tidak ada" di "Group by", THE `options.group` SHALL menjadi `null` DAN `options.sort` SHALL TIDAK direset otomatis (tetap di posisi terakhir).
5. `options.group` SHALL disinkronkan ke URL query string, mengikuti pola `options.sort`/`options.page`/`options.fid`/`options.show` yang sudah ada.

### Requirement 5: Render header grup collapsible di `Table2.jsx`

**User Story:** As user, I want melihat baris tabel dikelompokkan dengan header yang bisa dilipat, so that saya bisa fokus ke grup tertentu tanpa scroll panjang.

#### Acceptance Criteria

1. WHEN prop `groupBy` diberikan ke `Table2.jsx`, THE komponen SHALL mendeteksi batas grup dari urutan `data` yang diterima (run-length grouping) — TIDAK melakukan re-sort di client.
2. THE baris header grup SHALL dirender full-width (`gridColumn: span N`, pola sama dengan baris no-data/footer existing), menampilkan nilai grup dan count dari `groupCounts[value]` — BUKAN dihitung dari jumlah rows pada halaman yang sedang tampil.
3. WHEN user mengklik toggle collapse pada header grup, THE baris data milik grup itu SHALL disembunyikan dari render sampai di-toggle kembali — state collapse disimpan per NILAI grup, bukan per index/posisi baris.
4. Collapse state SHALL TIDAK dipersist ke cookie/localStorage untuk v1 — reset setiap reload/navigasi.
5. WHEN prop `groupBy` bernilai `null`/tidak diberikan, THE `Table2.jsx` SHALL merender seperti sebelum spec ini, TANPA baris header grup apapun — no regression untuk 73+ halaman existing.
6. WHEN grup yang sama muncul lagi di halaman berikutnya (grup terpotong pagination), THE `Table2.jsx` SHALL merender header grup baru dengan count yang SAMA dari `groupCounts` — bukan dihitung ulang dari rows pada halaman itu.

### Requirement 6: Cakupan pengujian

**User Story:** As pengembang, I want gate sortable dan fitur grouping tercakup test otomatis, so that regresi di 73+ halaman existing maupun celah validasi baru langsung ketahuan.

#### Acceptance Criteria

1. THE test backend baru (mis. `tests/Feature/Models/Scopes/DataTableScopeGroupingTest.php`) SHALL mencakup skenario gate sortable (Requirement 2: kolom `sortable:false`, kolom tak dikenal/dotted path, regression kolom normal) dan hitung count grup (Requirement 3: akurasi count, opt-in tervalidasi, kombinasi dengan filter aktif, zero-overhead tanpa `?group=`).
2. THE test frontend `Table2.rtl.test.jsx`/`Table2.dom.test.js` SHALL mencakup render header grup dari `groupCounts`, toggle collapse/expand, dan regression `groupBy` null (tanpa header grup).
3. THE test frontend `DataTable2.rtl.test.jsx` SHALL mencakup interaksi kontrol "Group by" dengan penguncian dropdown "Sort By" dan reset `page`.

## Keputusan (dikonfirmasi user, sesi brainstorming)

1. **Akurasi grouping** — backend menghitung count per grup (query `GROUP BY` terpisah), baris tetap flat-paginated. Ditolak: grouping visual per-halaman saja (count tidak akurat), dan grouping lazy-load per-grup penuh (effort besar, ubah shape data 73+ pemakai).
2. **Cakupan kolom** — opt-in per kolom via flag `groupable` eksplisit. Ditolak: otomatis untuk semua kolom `sortable`.
3. **Agregat** — count saja untuk v1. Ditolak (untuk sekarang): tambahan SUM/AVG kolom numerik di header grup.
4. **Nesting** — 1 level (single column) untuk v1. Ditolak (untuk sekarang): nested grouping multi-kolom.
5. **Sort saat grouping aktif** — dikunci ke kolom grup (dropdown Sort By kolom lain di-disable). Ditolak: sort independen dari grouping (berisiko baris se-grup tidak nempel).
6. **Pagination vs infinite scroll** — pagination existing dipertahankan. Infinite scroll secara teknis bisa menyelesaikan masalah "grup terpotong" secara visual (rows di-*append* bukan *replace*), tapi blast radius-nya mengubah arsitektur inti `DataTable2` di 73+ controller (URL/back-button/bookmark, `Pagination.jsx`, cursor-pagination di backend) — di luar scope spec ini, dibahas terpisah kalau ada kebutuhan nyata.
7. **Gate sortable** — ditambahkan ke `DataTableScope.php` atas permintaan eksplisit user saat review design, menutup celah validasi yang sebelumnya tidak ada sama sekali (`?sort=` langsung ke `orderBy()` tanpa dicek).
