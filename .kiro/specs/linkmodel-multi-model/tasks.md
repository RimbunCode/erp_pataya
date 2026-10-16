# Implementation Plan: LinkModel Multi-Model

## Overview

Frontend-only. Urutan: (1) util murni, (2) komponen `SourceSection` + integrasi dropdown, (3) add/navigate per sumber, (4) Advance Search bertab, (5) i18n + verifikasi browser. Tidak ada perubahan backend.

## Tasks

- [x] 1. Util murni
  - [x] 1.1 `validate(value, model)` menerima string atau array di `lib/linkModelUtils.js`
    - _Requirements: 7.1, 7.3_
  - [x] 1.2 `sourceValue(index, id)` / `parseSourceValue()` + normalisasi `sources` (`buildSources(model, mainLabel, subModels)`: duplikat, label wajib, peringatan dev)
    - _Requirements: 2.2, 2.3, 8.1_
  - [x] 1.3 Unit test (`.test.js`) untuk 1.1-1.2
    - _Requirements: 1, 2, 7, 8_

- [x] 2. Bagian dropdown multi-sumber
  - [x] 2.1 Komponen `LinkModel/SourceSection.jsx`: hook `useLinkModelInfiniteOptions` per sumber, flat/`GroupedOptions`, header bagian, gate fetch (main=open; sub=open&&(terbuka||search)), `onStatus`
    - _Requirements: 3, 4, 6_
  - [x] 2.2 Integrasi di `LinkModel.jsx`: render bagian main+sub bila `subModels` ada (jalur lama utuh bila tidak), "tidak ditemukan" saat semua kosong, sembunyikan bagian kosong saat search
    - _Requirements: 1, 3.5, 4.3, 4.4_
  - [x] 2.3 Nilai cmdk/`knownRowsRef` berprefiks sumber; highlight awal; panah/Enter header bagian; Tab-autocomplete + exact-match-on-close lintas sumber
    - _Requirements: 8_
  - [x] 2.4 Validasi `setOption`/efek pembersih memakai daftar model
    - _Requirements: 7_
  - [x] 2.5 Test RTL: kompatibilitas tanpa `subModels` (suite lama hijau), main terbuka/sub tertutup, sub tak fetch sebelum dibuka, request sub (model+`notIn`), search lintas sumber + auto-expand + sembunyikan kosong, `mainLabel` on/off, pilih baris sub, model luar daftar ditolak, id sama lintas model, grup per sumber
    - _Requirements: 1, 3, 4, 5, 6, 7, 8_

- [x] 3. Add dan navigate per sumber
  - [x] 3.1 Baris Add per sumber di area sticky bawah + `FormPageDialog` per sumber + `onSuccess` fetch model sumber
    - _Requirements: 9_
  - [x] 3.2 Navigasi memilih konfigurasi sumber dari `option.thisModel`; izin per model
    - _Requirements: 10_
  - [x] 3.3 Test RTL add/navigate per sumber
    - _Requirements: 9, 10_

- [x] 4. Advance Search bertab
  - [x] 4.1 `AdvanceSearchDialog` menerima `sources`, `Tabs` per model, tab awal main, `initialSearch` terbawa
    - _Requirements: 11_
  - [x] 4.2 Test RTL tab per model + pemilihan baris
    - _Requirements: 11_

- [x] 5. i18n dan verifikasi
  - [x] 5.1 Kunci i18n: tidak ada kunci baru (memakai `core.form.not_found` yang sudah ada); label bagian/tab berasal dari prop `label`/`mainLabel`
    - _Requirements: 3.6_
  - [x] 5.2 Update JSDoc props `LinkModel.jsx` (`mainLabel`, `subModels`) dan halaman uji `Pages/Test/LinkModelTest.jsx` dengan contoh multi-model
  - [x] 5.3 Checkpoint: Vitest (LinkModel + AdvanceSearchDialog + util) hijau; regresi PHPUnit `ModelController`; `npm run lint`
  - [x] 5.4 Verifikasi browser sungguhan (`npm run build`, login admin/admin): contoh PurchaseOrderItem + ItemVariant — lazy sub, search lintas sumber, keyboard panah/Enter/Tab, dedupe `notIn`, tab Advance Search
    - _Requirements: 3, 4, 8, 11_
