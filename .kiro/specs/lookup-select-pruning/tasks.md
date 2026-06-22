# Implementation Plan: Lookup SELECT Pruning + DataTable2 Strict

## Overview

Bangun mesin `DataTableColumnSelector::resolveForSafe` (input kolom-aman, output `{select, with}` tanpa
`fallbackAll`), lalu adopsi di lookup (`ModelController`) dan index (`DataTableScope`) — konvergensi penuh.
Urutan rollout WAJIB (Req 7.5): (1) bangun `resolveForSafe` + test, (2) audit `dependsOn` LENGKAP, (3) baru
swap scope + hapus `fallbackAll`. Membalik urutan = throw massal di semua halaman index (global scope).
TIDAK berubah: kontrak response lookup, `filterRowColumns` dipertahankan sebagai lapis kedua (hanya diperbaiki
untuk morph).

## Tasks

- [x] 1. `resolveForSafe` — mesin select kolom-aman (non-strict dulu, koeksistensi dgn `resolve`)
  - [x] 1.1 Tambah `resolveForSafe($dataTableColumns, $model, $safeColumns, $safeRelationColumns, $templateLink)`
    - Return `{select, with}` (TANPA `fallbackAll`).
    - Mulai `select=[PK]`; iterasi `$safeColumns`: kolom DB → select; relasi → `collectRelation` + child-select closure dari `$safeRelationColumns[rel]`; `forceAppend` → skip.
    - `with` non-morph → closure `fn ($q) => $q->select([kolom aman child + FK])`; morph → with tanpa closure.
    - Hasil `select`/`with` unik.
    - Sementara biarkan `resolve()` lama tetap ada (dipakai `DataTableScope`) — belum dihapus di task ini.
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 1.2, 1.3, 1.4_

  - [x] 1.2 Resolusi templateLink nested rekursif (Arah A) — `resolveTemplateLink`
    - Parse tiap placeholder via `FilterColumnResolver::resolvePath` → with rantai relasi + FK tiap segmen + kolom akhir.
    - Ujung relasi non-morph → rekursi `childClass::templateLink()`.
    - Cycle guard (`$visited[FQCN]`) + depth cap = 4; segmen morph → berhenti, relasi morph tetap di-with.
    - Integrasikan ke `resolveForSafe` (gantikan pemakaian `templateLinkHeads` single-level).
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 1.3 Write unit tests untuk `resolveForSafe` + `resolveTemplateLink`
    - **Kolom-aman: select hanya kolom aman + PK + FK; relasi aman ter-with dgn child-select.**
    - **forceAppend di-skip (tak select, tak throw).**
    - **templateLink nested `:a.b` → with rantai + select kolom terdalam; cycle guard; depth cap berhenti di 4.**
    - **morph → relasi di-with tanpa child-select.**
    - Pakai stub model existing (`SelectorParentStub`/`SelectorRelatedStub`) atau tambah stub bila perlu.
    - **Validates: Requirements 2.1–2.5, 4.1–4.5, 1.2–1.4**

- [x] 2. Checkpoint - Ensure `resolveForSafe` unit tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Audit & lengkapi `dependsOn` (PRASYARAT strict — Req 5.1)
  - [x] 3.1 Baseline meta global di `LinkModel`
    - `appendStatus` → baseline `dependsOn:['status']` conditional `Schema::hasColumn(table,'status')`.
    - `route`/`keyModel`/`thisModel` → exempt (pastikan tak butuh `dependsOn`).
    - _Requirements: 5.2, 5.3, 5.4_

  - [x] 3.2 Audit per-model: lengkapi `dependsOn` (~11 model) + override accessor
    - Tiap append/accessor non-DB tanpa `dependsOn` → tambahkan kolom sumber.
    - Override `canDelete()`/`disabledOn()`/`appendStatus()`/`replaceStatus()` yang baca kolom → `dependsOn` kolom itu.
    - Inventaris: 21 model punya append, 10 punya `dependsOn` → tutup gap ~11.
    - _Requirements: 5.5, 5.6_

  - [x] 3.3 Verifikasi audit lengkap (sebelum strict)
    - Jalankan tiap halaman index lewat test/smoke dgn `resolveForSafe` (mode throw-on-missing) untuk deteksi append tanpa `dependsOn` yang tersisa.
    - DependsOnAuditTest iterasi SEMUA model — hijau. Bonus: temukan+fix 2 bug getColumns pre-existing (ItemUnit `$col` undefined, Permission `new $model` null).
    - _Requirements: 5.1, 7.1_

- [x] 4. Checkpoint - Audit `dependsOn` lengkap, tak ada append tanpa dependsOn tersisa
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Strict — hapus `fallbackAll`, throw selalu, swap scope
  - [x] 5.1 `collectAppend` throw selalu; hapus cabang produksi
    - `collectAppendStrict` throw selalu (resolveForSafe); `collectAppend`+`resolve` lama dihapus total bersama cabang produksi `Log::warning`.
    - _Requirements: 3.2, 3.3_

  - [x] 5.2 Hapus `resolve()` lama + cabang `fallbackAll`; arahkan ke `resolveForSafe`
    - Hapus `resolve`/`collectRelation`/`collectAppend`/`collectDependsRelation`/`templateLinkHeads`/`hasNonRelationHead` + import Log. 16 test lama dihapus (approved user).
    - _Requirements: 2.6, 3.1_

  - [x] 5.3 `DataTableScope` macro `dataTable` pakai `resolveForSafe`
    - `safeColumnsFromVisible` (cookie→map) + `resolveForSafe`; buang cabang `fallbackAll`. `with` map closure child-select (null→SELECT\* untuk morph/child tanpa info).
    - Child-select: kalau child punya templateLink/safeColumns → limit; else SELECT\* (perilaku lama, tak regresi).
    - Fix closure type-hint (Relation bukan Builder).
    - _Requirements: 3.4, 3.5, 3.6, 2.6_

- [x] 6. Checkpoint - Index (DataTable2) tetap render tanpa fallbackAll
  - Selector unit + DataTableAdaptiveFetch: 20 passed. Ensure all tests pass + smoke per modul. Ask the user if questions arise.

- [x] 7. Lookup — terapkan SELECT-level di `ModelController`
  - [x] 7.1 `__invoke` & `selectData` pakai `resolveForSafe`
    - `__invoke`: `safeRelationColumns` helper + `resolveForSafe` → `$query->select()->with()` (jalur non-join). `selectData` sudah SELECT-level otomatis via macro dataTable (group 5).
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 7.2 Jalur join + cache mode
    - Guard `if (! $request->has('joins'))` — jalur join skip SELECT-level (filter-PHP-only). Cache mode `getRelationKeys` dipertahankan. `filterRowColumns` lapis 2 semua jalur.
    - _Requirements: 1.5, 1.6, 1.7_

  - [x] 7.3 Write feature tests lookup SELECT-level
    - **Query log relasi non-morph tak memuat kolom non-aman; data tetap benar.**
    - Extend `LinkModelColumnSecurityTest`.
    - **Validates: Requirements 1.1–1.4, 7.4**

- [x] 8. Checkpoint - Lookup SELECT-level tests pass
  - 7 passed (5 existing + 2 query-log SELECT-level). Ensure all tests pass, ask the user if questions arise.

- [x] 9. Fix penyaringan relasi morph (fail-closed)
  - [x] 9.1 `filterRowColumns` saring morph child per-row
    - `morphClassFromRow($key,$row)` → FQCN dari `<key>_type` row induk. Class ber-getColumns → saring rekursif; class asing → buang (fail-closed).
    - Fix akar: `relatedModelMap` exclude `typeRelation==='morph'` (related ambigu di metadata) → morph jatuh ke morph-branch per-row.
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 9.2 Write feature tests morph filter
    - MorphLookupFilterTest: 2 passed (sensitif tersaring + fail-closed buang relasi asing).
    - **Validates: Requirements 6.2, 6.3, 6.4, 7.4**

- [x] 10. Final checkpoint - Ensure all tests pass + lint
  - Regresi penuh 8 file: 50 passed (146 assertions). Pasca-Pint re-verify: 16 passed.
  - Pint --dirty: fixed format 4 file (selector + 3 model). eslint: N/A (tak ada file JS berubah).
  - SEMUA TASK SELESAI.

## Notes

- **Urutan rollout WAJIB** (Req 7.5): group 1 (resolveForSafe) → group 3 (audit dependsOn) → group 5 (strict + swap scope). Strict (group 5) TIDAK boleh sebelum audit (group 3) tuntas — global scope `bootLinkModel` membuat throw menyebar ke semua halaman index.
- Lookup (group 7) & fix morph (group 9) bergantung pada `resolveForSafe` (group 1) tapi independen dari strict scope-swap (group 5) untuk jalur lookup — boleh setelah group 2.
- `filterRowColumns` dipertahankan sebagai lapis kedua di semua jalur; hanya diperbaiki untuk morph (group 9).
- Morph SELECT-level tetap `SELECT *` child (tak bisa prune build-time) — keamanan dijaga oleh group 9.
- Checkpoint (`2`, `4`, `6`, `8`, `10`) = stop, jalankan test suite relevan, konfirmasi ke user.
- Lint/Pint hanya di final checkpoint (group 10).

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["1.3"] },
    { "id": 3, "tasks": ["3.1", "3.2"] },
    { "id": 4, "tasks": ["3.3"] },
    { "id": 5, "tasks": ["5.1", "5.2"] },
    { "id": 6, "tasks": ["5.3"] },
    { "id": 7, "tasks": ["7.1", "9.1"] },
    { "id": 8, "tasks": ["7.2"] },
    { "id": 9, "tasks": ["7.3", "9.2"] }
  ]
}
```
