# Implementation Plan: DataTable Semantic Templates

## Overview

Implementasi dimulai dari **backend murni** (parser dependensi & SQL ekspresi), lalu metadata kolom (`computeColumnsFlat` + cache), jalur query (`DataTableColumnSelector`, `DataTableScope`, `FilterEvaluator`) dan validator. Setelah itu **frontend murni** (`templateEngine.js`), komponen tag + `SemanticTemplate`, dan terakhir integrasi ke `Cell`, LinkModel, kartu mobile, `operators.js`, dan `app.css`. Kolom tanpa `template`/`expression`/`progress`, `convertTemplateLink()` untuk teks terpilih, dan pohon grup tidak berubah perilakunya.

## Tasks

- [x] 1. Parser dependensi template & SQL ekspresi (backend murni)
  - [x] 1.1 Buat `app/Services/Core/DataTable/Template/TemplateDependencyExtractor.php`
    - `extract(?string $template): list<string>` — placeholder teks & atribut (regex `templateLinkPlaceholders` + akhiran `(\|\w+)?`), alias `{:x}` dibuang, cabang ternary keduanya, atribut `to`/`of` (relasi) dan `field` (`<when>`); hasil unik & terurut
    - `stripFormatter(string): string`
    - `DataTableColumnSelector::templateLinkPlaceholders()` didelegasikan ke `extract()`
    - _Requirements: 1.2, 1.3, 2.1, 6.6_

  - [x] 1.2 Buat `app/Services/Core/DataTable/Template/ExpressionSql.php`
    - `forColumn(array $column): ?string` — `progress()` untuk `type: 'progress'`, `(expr)` untuk number/currency, `null` tanpa expression
    - `progress(string $expr): string` — `CASE WHEN … IS NULL THEN NULL WHEN < 0 THEN 0 WHEN > 100 THEN 100 ELSE ROUND(…, 2) END` (portabel MySQL & SQLite)
    - _Requirements: 7.2, 7.3, 8.1, 8.2_

  - [x] 1.3 Write unit tests `tests/Unit/TemplateDependencyExtractorTest.php`
    - **Kelengkapan dependensi (Property 3)**: placeholder dasar, relasi bertingkat, alias, pipe, ternary, atribut ber-placeholder, `to`/`of`/`field`
    - **Paritas ekstraksi (Property 4)**: data provider seluruh `templateLink()` model existing → hasil sama dengan implementasi lama
    - **Validates: Requirements 2.1, 14.2**

  - [x] 1.4 Write unit tests `tests/Unit/ExpressionSqlTest.php` (SQLite)
    - **Clamp progress (Property 5)**: nilai < 0 → 0, > 100 → 100, `12.345` → `12.35`, NULL → NULL, pembagi nol via `NULLIF` → NULL
    - **Validates: Requirements 7.2, 7.3**

- [x] 2. Metadata kolom & cache
  - [x] 2.1 Ubah `LinkModel::computeColumnsFlat()` (`app/Traits/LinkModel.php`)
    - Entri DB/append/relasi ber-`template` → `dependsOn` = union(baseline, manual, `extract(template)`)
    - Cabang kolom virtual (bukan DB/append/relasi, punya `template` atau `expression`) → `virtual`, `derived`, `type` default `string`, `sortable` = ada expression
    - `searchable`/`searchVia` sesuai Keputusan D1 (opt-in Attribute; expression default searchable); `single` untuk number/currency dengan tepat satu `dependsOn`
    - `relations`: `max` default 3
    - _Requirements: 1.1, 2.1, 2.2, 2.5, 6.3, 8.1, 9.1, 9.2, 9.3_

  - [x] 2.2 Tambah `DataTableConfigCache::meta()` + update `warm()`/`forget()`
    - Payload `{mobileTemplate, mobileDependsOn}` di key `<cacheKey>:meta`
    - _Requirements: 12.1, 12.4, 13.1, 13.3_

  - [x] 2.3 Write feature tests `tests/Feature/DataTable/TemplateColumnMetadataTest.php`
    - Model fixture dengan kolom template, virtual, expression, progress, relations, Attribute opt-in & non-opt-in, kolom `$hidden`
    - Verifikasi `dependsOn` gabungan, flag `virtual`/`searchable`/`searchVia`, `max` default, kolom hidden tidak muncul
    - Meta cache: warm menulis, forget menghapus
    - **Validates: Requirements 2.1, 2.2, 2.5, 9.1, 12.4, 13.1, 13.3**

- [x] 3. Checkpoint - Ensure parser, metadata & cache tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Jalur query DataTable
  - [x] 4.1 Ubah `DataTableColumnSelector` (`app/Services/Core/DataTableColumnSelector.php`)
    - `isAppendColumn()` → false untuk `virtual`
    - `resolveForSafe()`: dependensi kolom virtual/template (non-strict untuk virtual), output baru `selectRaw` untuk kolom expression, child-select `relations` ber-`template` memakai `extract()`, `mobileDependsOn` selalu ikut bila model punya `mobileTemplate()`
    - _Requirements: 2.3, 6.5, 8.2, 12.4_

  - [x] 4.2 Ubah `DataTableScope::dataTable()` (`app/Models/Scopes/DataTableScope.php`)
    - Sort kolom expression → `orderByRaw(ExpressionSql::forColumn(...))`
    - `addSelect(DB::raw("<sql> as <alias>"))` untuk `selectRaw`
    - Share `dataTableColumns` tanpa key `expression` (helper presenter) + page prop `mobileTemplate`
    - Pastikan pohon grup (`GroupNodeQuery`) tetap jalan dengan select raw (Risiko R1)
    - _Requirements: 8.2, 8.3, 12.2, 14.1_

  - [x] 4.3 Ubah `FilterEvaluator` (`app/Services/Core/FilterEvaluator.php`)
    - Operator `attribute` = `matches`/`!matches` (+ universal set/!set); `relations` + `matches`/`!matches`
    - `applyScalarRaw()` untuk `searchVia: expression` (nilai selalu binding)
    - `applyDependsOnSearch()` untuk `searchVia: dependsOn` (OR LIKE lokal + `whereHas` relasi; `set` = minimal satu dep terisi)
    - `searchVia: single` → `applyScalar` ke kolom dep tunggal
    - `applyRelationsMatches()` → `whereHas` ke kolom template anak
    - _Requirements: 8.3, 8.4, 9.2, 9.3, 9.4_

  - [x] 4.4 Write feature tests `tests/Feature/DataTable/TemplateColumnQueryTest.php`
    - Kolom virtual: dep ter-SELECT, relasi ter-`with`, tanpa `setAppends` virtual
    - Expression: nilai di baris, sort asc/desc, filter `>`/`between`/`in`
    - **Binding (Property 11)**: nilai filter tidak muncul di `toSql()`
    - Attribute string `matches`/`!matches`/`set`/`!set` (kolom lokal & relasi); Attribute tanpa opt-in diabaikan
    - `relations` `matches`
    - Share: `dataTableColumns` tanpa `expression`, `mobileTemplate` ada
    - Pohon grup pada model ber-expression tidak error
    - **Kompatibilitas (Property 10)**: `toSql()` model tanpa konfigurasi baru identik dengan sebelum perubahan
    - **Validates: Requirements 2.3, 6.5, 8.2, 8.3, 8.4, 9.2, 9.3, 9.4, 12.2, 14.1**

- [x] 5. Validator & `model:cache`
  - [x] 5.1 Tambah rule di `DataTableConfigValidator`
    - Template resolvable (rekursif per relasi), formatter dikenal, `isLink` + `<nav-link>`, expression hanya number/currency/progress, expression valid (`limit 0`), progress tanpa expression/dep tunggal, `badgeColors` valid
    - _Requirements: 2.4, 4.2, 5.6, 8.5, 13.2_

  - [x] 5.2 Write unit tests untuk rule validator baru
    - Satu kasus valid + satu violation per rule; `model:cache` memanggil validasi & warm meta
    - **Validates: Requirements 2.4, 5.6, 8.5, 13.2**

- [x] 6. Checkpoint - Ensure all backend tests pass
  - Jalankan test baru + regression `FilterEvaluator*`, `DataTableColumnSelector*`, `DataTableConfig*`, test grup DataTable. Ensure all tests pass, ask the user if questions arise.

- [x] 7. Engine template frontend (fungsi murni)
  - [x] 7.1 Buat `resources/js/Components/SemanticTemplate/templateEngine.js`
    - `SEMANTIC_TAGS`, `BASIC_TAGS`, `ALLOWED_ATTRS`, `PLACEHOLDER_RE`
    - `prepareTemplate(template, row, { context })`: ternary (pakai ulang `resolveTernaryTokens` — export dari `linkModelUtils.js`), buang `<title>` kecuali `selected`, `normalizeSelfClosing`, `sanitizeTemplate` (DOMPurify allowlist, memo `Map`)
    - `fillPlaceholders(text, row, column)` satu lintasan, null → ""
    - `formatValue(value, formatter, ctx)`: date, datetime, relative, number, currency, percent, trans (pakai `formatNumber`, `getLocaleDate`, `t`)
    - `templateToText(template, row)` (teks terlihat, tanpa `<title>`)
    - _Requirements: 1.2, 1.3, 1.6, 1.7, 3.3, 3.4, 3.6, 10.2, 10.3_

  - [x] 7.2 Buat `highlight.jsx` dan `badgeColors.js`
    - `highlightText(text, search)` → string/`<mark className="bg-yellow-500">`
    - Palet `gray|blue|green|yellow|orange|red|purple` + varian existing, fallback `secondary`
    - _Requirements: 4.2, 10.4_

  - [x] 7.3 Write property tests `templateEngine.test.js` & `badgeColors.test.js` (fast-check)
    - **Escaping nilai (Property 1)** & **tidak diekspansi ulang (Property 2)** (dicek bersama render di 8.4)
    - **Highlight mempertahankan teks (Property 6)**, **`<title>` (Property 7)**, **self-closing idempoten (Property 8)**
    - Formatter per tipe & locale; fallback palet
    - **Validates: Requirements 1.3, 1.6, 1.7, 3.4, 3.6, 4.2, 10.2, 10.4**

- [x] 8. Komponen tag & `SemanticTemplate`
  - [x] 8.1 Ekstrak hook `useRecordLink(row, { to, column })` dari logika `isLink`/relation di `Cell` (`Table2.jsx:296-335`) dan pakai di `Cell` tanpa mengubah perilaku
    - _Requirements: 5.1, 5.2, 5.3, 14.1_

  - [x] 8.2 Buat komponen `tags/`
    - `TemplateBadge`, `TemplateStatus` (`BadgeStatus`), `TemplateDot`, `TemplateNavLink` (tanpa `<a>` bila izin/route tidak ada atau bersarang), `TemplateChips` (max default 3, `0` = semua, "+N" popover), `TemplateTruncate` (tooltip), `TemplateProgress` (SVG donut default / bar, biru < 100, hijau = 100, "–" bila null), `TemplateIcon` (`lucideIcons[name]`), `TemplateAvatar`, `TemplateWhen`, layout `muted`/`stack`/`inline`; `tags/index.js`
    - _Requirements: 3.1, 5.4, 6.1, 6.2, 6.3, 6.4, 7.4, 7.5, 7.6, 7.7_

  - [x] 8.3 Buat `SemanticTemplate.jsx`
    - `html-react-parser` `replace`: tag semantik → komponen, node teks → `fillPlaceholders` + `highlightText`, atribut → nilai terisi (React escape); `context` `cell|option|chip|mobile|selected`
    - _Requirements: 1.4, 3.2, 3.5, 10.4_

  - [x] 8.4 Write RTL tests `SemanticTemplate.rtl.test.jsx`, `TemplateChips.rtl.test.jsx`, `TemplateProgress.rtl.test.jsx`
    - **Escaping (Property 1)**: nilai `<img onerror>` tampil sebagai teks, tidak ada elemen `img`
    - Setiap tag semantik (role/teks), `<when>`, `<nav-link>` dengan/tanpa izin, nested link tanpa `<a>` dalam, `<mark>` di dalam tag
    - **Chip (Property 9)**: n vs max (termasuk 0), klik navigasi, popover "+N"
    - Progress donut/bar, warna, "–"
    - **Validates: Requirements 3.1–3.5, 5.1–5.4, 6.1–6.4, 7.3–7.7, 10.4**

- [x] 9. Checkpoint - Ensure frontend unit & RTL tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Integrasi konsumen
  - [x] 10.1 `Table2.jsx` `Cell`: cabang `template` (+ `isLink` → bungkus `TemplateNavLink`), `relations` → `TemplateChips`, `progress` → `TemplateProgress`
    - _Requirements: 1.4, 1.5, 5.5, 6.1, 7.1, 11.1_

  - [x] 10.2 LinkModel: ganti `dangerouslySetInnerHTML` di `LinkModel.jsx:870`, `GroupedOptions.jsx:139`, `SourceSection.jsx:211` dengan `SemanticTemplate context="option"`; filter klien `LinkModel.jsx:563` → `templateToText`; teks terpilih tetap `convertTemplateLink`
    - _Requirements: 10.1, 10.2, 10.3, 11.1, 11.2, 11.3, 14.2_

  - [x] 10.3 `DataTable2.jsx`: kartu mobile dari page prop `mobileTemplate` bila `templateItem` tidak ada
    - _Requirements: 12.2, 12.3, 12.5_

  - [x] 10.4 `operators.js`: `searchVia: dependsOn` → `matches`/`!matches` + universal; `expression`/`single` → operator number; `relations` + `matches`/`!matches`; kolom tanpa `searchVia` tetap tanpa input pencarian
    - _Requirements: 9.2, 9.3, 9.4, 9.5_

  - [x] 10.5 `resources/css/app.css`: `@source '../../app/Models/**/*.php';`
    - _Requirements: 4.3, 4.4_

  - [x] 10.6 Write integration tests (tambahan pada test existing)
    - `Table2.rtl.test.jsx`: kolom template, relations, progress, isLink + template; kolom lama tetap (Property 10)
    - `LinkModel*.rtl.test.jsx`: `templateLink` lama tampil sama, pencarian tidak cocok ke nama tag, teks terpilih memakai `<title>`
    - `DataTable2.rtl.test.jsx`: kartu `mobileTemplate`; `templateItem` didahulukan
    - `operators.test.js`: operator per `searchVia`
    - **Validates: Requirements 1.5, 9.5, 10.1–10.3, 11.1–11.3, 12.2, 12.3, 14.1–14.3**

- [x]* 11. Uji performa render (Risiko R3)
  - Render 100 baris × 10 kolom template; bila > ~100 ms, cache AST per template dan isi placeholder saat traversal
  - _Requirements: 11.1_

- [x]* 12. Contoh penerapan di satu model nyata
  - Terapkan `template` + `badgeColors` + `mobileTemplate()` pada satu model (mis. `Core/Changelog` atau `Sales/SalesOrder` dengan `per_billed` progress) sebagai referensi developer
  - _Requirements: 1.1, 7.1, 12.1_

- [x] 13. Final checkpoint - Ensure all tests pass
  - Jalankan seluruh test backend & frontend terkait + regression (Requirement 14.3), lalu `vendor/bin/pint --dirty --format agent` dan `npm run lint`. Ensure all tests pass, ask the user if questions arise.

## Notes

- Setiap task mereferensi requirement spesifik untuk traceability.
- Checkpoint (3, 6, 9, 13) memastikan validasi inkremental per layer.
- Pint/lint hanya di task 13 (aturan workflow spec project).
- Test backend berjalan di SQLite (`phpunit.xml`), produksi MySQL — semua SQL baru (clamp progress, `orderByRaw`) harus portabel.
- `expression` tidak pernah dikirim ke frontend; nilai filter selalu binding.
- Task opsional (11, 12) perlu konfirmasi sebelum dikerjakan.
- Di luar cakupan: konfigurasi via UI, export CSV/PDF DataTable, sorotan pencarian di sel DataTable, limit anak per-parent untuk relasi banyak.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "7.1", "7.2"] },
    { "id": 1, "tasks": ["1.3", "1.4", "2.1", "2.2", "7.3", "8.1"] },
    { "id": 2, "tasks": ["2.3", "4.1", "4.3", "5.1", "8.2"] },
    { "id": 3, "tasks": ["4.2", "5.2", "8.3"] },
    { "id": 4, "tasks": ["4.4", "8.4"] },
    { "id": 5, "tasks": ["10.1", "10.2", "10.3", "10.4", "10.5"] },
    { "id": 6, "tasks": ["10.6", "11", "12"] }
  ]
}
```
