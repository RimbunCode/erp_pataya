# Implementation Plan: LinkModel Column Security

## Overview

Batasi kolom yang dikembalikan endpoint lookup (`/model` `__invoke` + `/model/select-data` `selectData`) ke
`templateLink + (requested ∩ linkable) − (visibleFor gagal)`, server-side, fail-safe. Tambah infra baru
(`Permission` enum, `PermissionChecker` dgn evaluator any/all rekursif), helper `resolveLookupColumns`, tag
`linkable`/`visibleFor` di model sensitif, prop `fields` di LinkModel (SelectModel reuse `from.columns`).
TIDAK mengubah jalur filter (`baseFilters`/`filters`/`fid`) maupun mekanisme query.

## Tasks

- [x] 1. Infra permission backend
  - [x] 1.1 Buat `app/Enums/Permission.php`
    - Enum string-backed 12 aksi (`select/read/write/create/delete/submit/cancel/amend/print/import/export/share`) selaras `PermissionSeeder`
    - _Requirements: 5.1_

  - [x] 1.2 Buat `app/Services/Core/PermissionChecker.php`
    - `__construct(array $permissions)`; `forUser(Request): self` (session AppMiddleware → fallback resolve `RolePermission`)
    - `can(string $model, Permission $action, int $level=0): bool` mirror FE `checkPermission` (`lib/utils.js`)
    - `satisfies(array $node): bool` rekursif: `{any}`/`{all}` di level node DAN aksi; leaf `[Model::class, actionNode]`; list datar = `{any}`
    - _Requirements: 5.2, 5.3, 5.4, 4.3, 4.4, 4.5_

  - [x] 1.3 Write unit test `PermissionCheckerTest`
    - **satisfies: pohon any/all benar di kedua level.** leaf, OR aksi (`[Write,Create]`), AND aksi (`{all:[Write,Read]}`), node `{any}`/`{all}`, nested `{all:[{any},leaf]}`, aksi-bersarang, list-datar=any (backward-compat)
    - `can` paritas dgn FE `checkPermission` (level, only_creator)
    - **Validates: Requirements 5.2, 5.3, 4.3, 4.4, 4.5**

- [x] 2. Checkpoint — PermissionChecker tests pass
  - `php artisan test --compact --filter=PermissionChecker`
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Pembatasan kolom di ModelController
  - [x] 3.1 `resolveLookupColumns($model, array $requested, PermissionChecker $perm): array`
    - Mulai kolom `templateLink` (parse `:token`) + `id` + PK relasi
    - Tambah `requested ∩ {kolom configColumns ber-linkable}`
    - Buang kolom ber-`visibleFor` bila `! $perm->satisfies(...)`
    - Rekursi relasi `with` (pakai `getColumns`/`FilterColumnResolver` metadata)
    - _Requirements: 6.1, 1.1, 1.2, 1.4, 2.2, 2.3, 3.4, 4.2_

  - [x] 3.2 Terapkan di `__invoke`
    - Batasi `get()->toArray()` ke kolom aman; map relasi `with` → kolom aman relasi
    - Baca `fields` dari request; `PermissionChecker::forUser`
    - _Requirements: 6.2, 3.1, 3.3_

  - [x] 3.3 Terapkan di `selectData`
    - Batasi `columns` metadata + data ke kolom aman; `columns` (SelectModel) sbg `requested`
    - Tidak mengubah jalur filter (baseFilters/filters/fid)
    - _Requirements: 6.3, 6.4, 3.2, 3.3_

  - [x] 3.4 Write feature test `LinkModelColumnSecurityTest`
    - **Default hanya templateLink + id; kolom non-linkable TIDAK ada.**
    - **`fields=[linkable]` keluar; `fields=[non-linkable]`/IDOR (`valuation_rate`) dibuang.**
    - **visibleFor: user berizin → kolom keluar; tanpa izin → tidak (row sama).**
    - relasi `with`: kolom relasi tersaring.
    - Pakai model stub (pola `ModelControllerFilterTest`) + set permission via session/RolePermission.
    - **Validates: Requirements 1.1-1.4, 2.2, 2.3, 3.4, 4.2, 4.6, 6.2, 6.3**

- [x] 4. Checkpoint — kolom security tests pass + regresi
  - `php artisan test --compact --filter=LinkModelColumnSecurity`
  - Regresi: `php artisan test --compact --filter=ModelSelectData`, `--filter=ModelControllerFilter`, `--filter=FilterEvaluator`
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Tag model sensitif (`configColumns`)
  - [x] 5.1 Tandai kolom harga transaksi `linkable` + `visibleFor` (inline, type-safe)
    - `SalesOrderItem.price`, `SalesInvoiceItem.price`, `PurchaseOrderItem.rate`, `PurchaseInvoiceItem.rate`
    - `visibleFor` = izin dokumen-tujuan (mis. `[SalesInvoice::class, [Permission::Write, Permission::Create]]`, dst) — pakai `Model::class` + enum
    - `*_base_currency` & kolom margin: TIDAK linkable
    - _Requirements: 7.2, 4.1, 4.6, 4.7_

  - [x] 5.2 Pastikan `valuation_rate` TIDAK linkable
    - `stocks`/`stock_entry_items.valuation_rate` tak ditandai linkable (tak pernah keluar)
    - _Requirements: 7.3_

- [x] 6. Frontend — prop `fields` & migrasi konsumen
  - [x] 6.1 Tambah prop `fields` di `LinkModel.jsx`
    - Array nama kolom; kirim ke `/model` (default `[]`); SelectModel reuse `from.columns` (tanpa prop baru)
    - _Requirements: 3.1, 3.2_

  - [x] 6.2 Audit & migrasi konsumen LinkModel/SelectModel
    - Audit tiap pemakaian yang `onValueChange` baca kolom di luar templateLink → set `fields`/`columns` + pastikan model tandai `linkable`
    - Fokus: Invoice forms (butuh `price`/`rate`/`tax_rate`), forms yang butuh kolom ekstra
    - Konsumen id/name/code (ItemVariantLinkModel) tak berubah
    - _Requirements: 7.1, 7.4, 7.5, 3.5_

- [x] 7. Final checkpoint — semua test pass + lint
  - `php artisan test --compact` (suite terkait) — pass
  - Frontend manual: Invoice dapat harga; DeliveryNote tak bawa price; ItemVariant tak berubah
  - `vendor/bin/pint --dirty --format agent` + eslint
  - _Requirements: 8.4, 8.5_

## Notes

- **Fail-safe**: default templateLink saja — kolom baru tak bocor sampai sengaja `linkable`. Migrasi konsumen (task 6.2) WAJIB agar form existing tak rusak.
- **`fields`/`columns` BUKAN gerbang keamanan** — `linkable` (server) yang menjaga. Test IDOR (`fields=[valuation_rate]` → dibuang) membuktikan.
- **`visibleFor` diikat dokumen-tujuan**, bukan model sumber (R4.6) — user tanpa izin SO tetap dapat `price` bila berhak Invoice.
- **Type-safe**: `Model::class` + enum `Permission`, tanpa string FQCN/aksi.
- **TIDAK mengubah** jalur filter (`baseFilters`/`filters`/`fid`) atau macro `dataTable`.
- Task 6.2 (audit konsumen) berisiko regresi tertinggi — checkpoint manual + test per form.
- Lint hanya di final checkpoint (task 7), bukan per task.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["1.3"] },
    { "id": 3, "tasks": ["2"] },
    { "id": 4, "tasks": ["3.1"] },
    { "id": 5, "tasks": ["3.2", "3.3"] },
    { "id": 6, "tasks": ["3.4"] },
    { "id": 7, "tasks": ["4"] },
    { "id": 8, "tasks": ["5.1", "5.2"] },
    { "id": 9, "tasks": ["6.1"] },
    { "id": 10, "tasks": ["6.2"] },
    { "id": 11, "tasks": ["7"] }
  ]
}
```
