# Implementation Plan: Asset Ownership Morph

## Overview

Urutan: (1) skema + migrasi data, (2) model `Asset` (relasi morph khusus Asset, branch customer), (3) request/service/controller SalesOrder, (4) mesin grup: `groupMorph`, label, urutan, (5) konfigurasi Asset (grup bawaan, `AssetLinkModel`), (6) form + lang + factory + tes lama, (7) verifikasi menyeluruh. Mesin grup `datatable2-group-tree` dipakai ulang dengan satu perluasan opt-in; kolom morph lain dan konsumen lain tidak berubah.

## Tasks

- [x] 1. Skema dan migrasi data
  - [x] 1.1 Migration `convert_asset_ownership_to_morph`
    - Tambah `ownership_id` (ulid nullable index); konversi supplier/customer/company; hentikan dengan pesan bila ada `ownership_type` tak dikenal; drop tiga kolom lama; transaksi + chunk; `down()` memulihkan (company_id NULL)
    - _Requirements: 1.1–1.7_

  - [x] 1.2 Write tests migrasi
    - **Test: konversi tiga tipe, `down()` mengembalikan nilai supplier/customer, baris tak dikenal menghentikan migrasi tanpa mengubah data**
    - **Validates: Requirements 1.2–1.6**

- [x] 2. Model `Asset`
  - [x] 2.1 Relasi morph khusus Asset
    - `AssetOwnershipMorphTo` (subclass `MorphTo`, peta lokal supplier/customer, lewati `company`/NULL); `Asset::ownership()`; hapus `ownershipEntity()`, `ownershipSupplier()`, `ownershipCustomer()`; `loadRelationsOnShow`; accessor `ownershipName`; tanpa `morphMap` global
    - _Requirements: 2.1–2.7_

  - [x] 2.2 Branch customer
    - Auto-clear `ownership_customer_branch_id` saat tipe berubah dari customer (`saving`); relasi `ownershipCustomerBranch()` tetap
    - _Requirements: 3.2, 3.3_

  - [x] 2.3 Write model tests
    - **Test: ownership supplier/customer/company (eager-load campuran, tanpa error untuk company), auto-clear branch, `ownershipName`, tak ada morphMap global (morph lain tak berubah)**
    - **Validates: Requirements 2.1–2.7, 3.2**

- [x] 3. Request, service, controller
  - [x] 3.1 `AssetRequest`
    - Ganti tiga field lama dengan `ownership_type` + `ownership`; mapping `ownership` → `ownership_id`; model sesuai tipe; company wajib kosong; branch hanya untuk customer; hapus `validateOwnershipExclusivity()`
    - _Requirements: 3.1, 4.1–4.4, 4.6_

  - [x] 3.2 `AssetService` dan `SalesOrderController`
    - Daftar field/snapshot memakai `ownership_type`/`ownership_id`; `SalesOrderController` memuat `asset.ownership` dan resolve customer billing hanya untuk tipe customer; `Asset::configColumns` mengekspos `ownership` (hidden)
    - _Requirements: 4.5, 5.1–5.3_

  - [x] 3.3 Write feature tests
    - **Test: eksklusivitas dan model sesuai tipe (422), snapshot AssetService, customer billing SalesOrder identik dengan sebelumnya**
    - **Validates: Requirements 3.1, 4.1–4.6, 5.1–5.2**

- [x] 4. Checkpoint - Ensure backend core tests pass
  - Jalankan test Asset, SalesOrder, dan migrasi (PHPUnit langsung dengan `-d memory_limit=2G` per direktori).
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Mesin grup: morph, label, urutan
  - [x] 5.1 `groupMorph` di `GroupColumnGate`
    - Terima `MorphTo` bila `groupMorph: true` (kolom SQL `{nama}_id`); tolak tanpa flag; `ResolvedGroupLevel` memperlakukan level morph sebagai relasi; `LinkModelGroupGate` meloloskan tanpa `linkable`
    - _Requirements: 7.1–7.4_

  - [x] 5.2 Label dan `groupNullLabel`
    - Eager-load relasi morph untuk sampel (`extraKeys`); label objek pemilik tersaring kolom aman; grup NULL berlabel `{name: Preference, templateLink: ':name'}` dari config `groupNullLabel`; Preference kosong → `no_group_value`; `withTrashed`; kolom tanpa config tak berubah
    - _Requirements: 8.1–8.6_

  - [x] 5.3 Write tests grup
    - **Test: `groupMorph` diterima/ditolak, grup company pertama (asc) dan terakhir (desc), label supplier/customer/company, Preference kosong, morph tak berflag tetap ditolak, lookup `model` menyaring label, `AllModelsGroupableConfigTest` diperluas**
    - **Validates: Requirements 7.1–7.4, 8.1–8.6**

- [x] 6. Konfigurasi Asset
  - [x] 6.1 Grup bawaan dan LinkModel
    - `Asset`: `$defaultGroups = ['ownership', 'asset_type']`, kolom `ownership` (`groupable`, `groupMorph`, `groupNullLabel`); `AssetLinkModel` `group={["ownership"]}`; `LinkModelDefaultGroupsConfigTest` diperbarui
    - _Requirements: 9.1–9.4_

- [x] 7. Frontend, lang, factory, tes lama
  - [x] 7.1 `Form.jsx`
    - Satu pemilih pemilik bergantung tipe, company read-only (nama perusahaan), reset `ownership` saat ganti tipe, kirim `ownership_type` + `ownership`, branch hanya untuk customer
    - _Requirements: 6.1–6.5_

  - [x] 7.2 Lang, factory, seeder, tes lama
    - Lang id/en; `AssetFactory`/seeder; perbarui `AssetControllerTest`, `AssetTest`, `AssetOwnershipCustomerResolutionTest`, `AssetServiceLinkModelSearchTest`; grep memastikan tak ada rujukan ke tiga kolom lama
    - _Requirements: 10.1–10.4_

  - [x] 7.3 Write FE tests
    - **Test: ganti tipe → pemilih/model berubah dan nilai direset, payload `ownership`, company read-only, `AssetLinkModel` grup `ownership`**
    - **Validates: Requirements 6.1–6.5, 9.2, 11.2**

- [x] 8. Final checkpoint - Verifikasi menyeluruh
  - Full suite BE dan FE; `LocaleKeysTest`; Pint/ESLint sekali di akhir
  - Verifikasi browser (`npm run build`, port bebas): dropdown Asset (nama pemilik, company di atas), index Asset (`ownership > asset_type`), form Asset (ganti tipe)
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Setiap task mereferensi requirement; checkpoint 4 dan 8 memvalidasi inkremental.
- Task 1 (migrasi) harus lulus sebelum model/request disentuh; jangan jalankan migration pada DB dev sebelum pemeriksaan baris `ownership_type` tak dikenal.
- Tanpa `morphMap` global: morph lain (log, todo, lampiran, dst.) tidak boleh berubah perilakunya (diuji di 2.3).
- Efek samping yang disadari: `$defaultGroups` di `Asset` membuat index Asset langsung terkelompok `ownership > asset_type`.
- TODO terbuka: konfirmasi akhir user soal `morphMap` (default: khusus Asset).
- Pint/ESLint hanya di akhir (task 8), bukan per task.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "2.1"] },
    { "id": 2, "tasks": ["2.2", "5.1"] },
    { "id": 3, "tasks": ["2.3", "3.1", "5.2"] },
    { "id": 4, "tasks": ["3.2", "5.3", "6.1"] },
    { "id": 5, "tasks": ["3.3", "7.1"] },
    { "id": 6, "tasks": ["7.2", "7.3"] }
  ]
}
```
