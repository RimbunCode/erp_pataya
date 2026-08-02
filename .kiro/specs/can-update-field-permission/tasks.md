# Implementation Plan: canUpdate Field Permission Contract

## Overview

Tambah computed attribute `canUpdate` (field-level permission, bisa
`bool`/`array`/`Closure`) dan rombak `disabledOn` (string → `bool`
status-aware) pada `App\Traits\LinkModel`/`App\Traits\Submitable`. Kedua
attribute HANYA aktif di halaman `show` (via flag instance yang di-set
satu titik generic, `DataTable::showDetail()`) — TIDAK PERNAH di
index/lookup, dan child model TIDAK punya accessor sendiri (closure
level-relasi milik parent di-attach ke tiap child row). FE dapat hook
terpusat `useCanUpdate` di atas `FormPageContext` yang sudah ada.

## Tasks

- [x] 1. Backend — flag show-context & getAppends()
  - [x] 1.1 Tambah property `$isShowContext` + `markAsShowContext()` di `App\Traits\LinkModel`
    - Property instance `protected bool $isShowContext = false;`
    - Method public `markAsShowContext(): static` — set true, return `$this`
    - _Requirements: 1.7, 1.8_

  - [x] 1.2 Panggil `markAsShowContext()` di `App\Traits\DataTable::showDetail()`
    - Satu baris `$this->markAsShowContext();` di awal method — tidak mengubah 46 controller `show()`
    - _Requirements: 1.8_

  - [x] 1.3 Update `getAppends()` di `LinkModel.php` — append `canUpdate`/`disabledOn` kondisional
    - Ganti `disabledOn` dari conditional `method_exists()` jadi unconditional-tapi-show-gated
    - Tambah `canUpdate` ke daftar, sama-sama di-gate `$this->isShowContext ? [...] : []`
    - _Requirements: 1.1, 1.7, 3.1_

  - [x] 1.4 Write unit tests for show-context gating (Property 4)
    - **Property 4: getAppends() TIDAK mengandung canUpdate/disabledOn tanpa markAsShowContext(); accessor tidak terpanggil (spy/mock count = 0)**
    - Test: model baru (tanpa `markAsShowContext()`) → `getAppends()` tidak mengandung `canUpdate`/`disabledOn`
    - Test: setelah `markAsShowContext()` → keduanya muncul di `getAppends()`
    - **Validates: Requirements 1.7, 6.2**

- [x] 2. Checkpoint - Ensure show-context gating tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Backend — getCanUpdateAttribute() & evaluasi closure
  - [x] 3.1 Implementasi `getCanUpdateAttribute()` di `LinkModel.php`
    - Return `true` bila model tidak override `canUpdate()`
    - Return hasil `canUpdate()` model, closure/array di-resolve rekursif (lihat 3.2)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.6_

  - [x] 3.2 Implementasi resolusi closure level-field & level-relasi
    - Closure level-field biasa: panggil dengan `$this` (instance model saat ini)
    - Closure/array level-relasi many: iterasi `Collection` child row ter-load, panggil per row dengan `$row` = instance child
    - **Ditemukan saat implementasi**: `setAttribute('canUpdate', ...)` TIDAK bekerja — child (juga pakai `LinkModel`) punya `getCanUpdateAttribute()` sendiri, accessor Eloquent SELALU menang atas raw attribute bernama sama. Solusi: property terpisah `canUpdateOverride` (bukan Eloquent attribute) + `getCanUpdateAttribute()` cek property itu duluan sebelum logic normal, plus `$childRow->append('canUpdate')` (child tidak show-context, `getAppends()`-nya tidak otomatis include `canUpdate`)
    - Field relasi many di struktur root tetap `true` (whole-relation allowed) kecuali eksplisit `false` non-closure
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.6_

  - [x] 3.3 Write unit tests for closure resolution (Property 1, 3)
    - **Property 1: default canUpdate === true tanpa override (show context)**
    - **Property 3: hasil akhir canUpdate tidak mengandung instance Closure (json_encode tidak exception), termasuk pada child row items[]**
    - Test: override return `bool` murni → dipakai apa adanya
    - Test: override array dengan closure level-field → hasil ter-resolve, bukan Closure
    - Test: closure level-relasi dengan 2+ child row berbeda kondisi → assert tiap child row punya `canUpdate` sesuai row-nya sendiri (row A locked, row B tidak)
    - **Validates: Requirements 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4**

  - [x]* 3.4 Write unit test for child model isolation (Property 8)
    - **Property 8: child model class TIDAK punya getCanUpdateAttribute()/canUpdate() sendiri yang dideklarasikan langsung**
    - Test: assert `PurchaseOrderItem` (atau child model contoh lain yang dipakai spec ini) tidak override kedua method tsb di class-nya sendiri
    - **Validates: Requirements 2.6**

- [x] 4. Checkpoint - Ensure canUpdate closure evaluation tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Backend — getDisabledOnAttribute() rombak jadi boolean
  - [x] 5.1 Implementasi `getDisabledOnAttribute()` baru di `LinkModel.php`
    - Non-submitable: default `false`, override (bila ada) replace total
    - Submitable + status DRAFT: baseline `false`
    - Submitable + status CANCELED/REJECTED: SELALU `true`, override TIDAK dipanggil (short-circuit)
    - Submitable + status lain: baseline `true`, override (bila ada) replace murni
    - _Requirements: 3.1, 3.3, 3.4, 3.5, 3.6, 3.7_

  - [x] 5.2 Write unit tests for disabledOn baseline (Property 5, 7)
    - **Property 5: status CANCELED/REJECTED → disabledOn selalu true, override TIDAK terpanggil (mock call count 0)**
    - **Property 7: non-submitable tanpa override → disabledOn === false**
    - Test data provider: kombinasi (non-submitable/submitable) × (draft/canceled/rejected/submitted) × (ada/tidak override) → assert hasil sesuai tabel Requirement 3
    - **Validates: Requirements 3.3, 3.4, 3.5, 3.6, 3.7**

- [x] 6. Checkpoint - Ensure disabledOn tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Backend — metadata kolom & whitelist
  - [x] 7.1 ~~Tambah `canUpdate` ke cabang `dependsOn` di `getColumns()`~~ — TIDAK dilakukan (keputusan sadar)
    - `computeColumnsFlat()` build `$appends` dari instance yang TIDAK show-context (`new static`, tanpa `markAsShowContext()`) → `canUpdate`/`disabledOn` tidak pernah masuk `$appends` di titik ini, sehingga entri `dependsOn` khusus jadi dead code
    - Exclusion picker cukup lewat `ALWAYS_ALLOWED_ATTRIBUTES`/`META_APPEND_COLUMN_NAMES` (7.2-7.3), tidak perlu entri `getColumns()`
    - _Requirements: 4.2, 4.3_

  - [x] 7.2 Tambah `canUpdate` ke `ModelController::ALWAYS_ALLOWED_ATTRIBUTES`
    - _Requirements: 4.1_

  - [x] 7.3 Tambah `canUpdate` ke `META_APPEND_COLUMN_NAMES` (`resources/js/lib/utils.js`)
    - _Requirements: 4.1_

  - [x] 7.4 Write integration test: canUpdate/disabledOn absen di index, hadir di show
    - Request `show` (`PurchaseOrder`, route model binding) → assert payload Inertia prop mengandung `canUpdate` & `disabledOn`
    - Request `index` (`POST /model`, `ModelController::__invoke`) model SAMA → assert `data[].canUpdate`/`disabledOn` key ABSEN
    - `selectData`/`columns` endpoint TIDAK diuji terpisah sbg Feature test — mekanismenya identik `__invoke` (whitelist `getAppends()` non-show-context sama), dan setup request macro `dataTable` di luar scope spec ini; `columns` endpoint punya bug pre-existing tak terkait spec ini (route param slash-encoding)
    - **Validates: Requirements 1.7, 4.1, 6.2**

- [x] 8. Checkpoint - Ensure metadata & scope-isolation tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Frontend — hook useCanUpdate & integrasi disabledOn boolean
  - [x] 9.1 Buat `resources/js/Hooks/useCanUpdate.js`
    - `useCanUpdate(fieldPath, row?)` — cek `disabled` prop context & `defaultData.disabledOn` dulu (short-circuit `false`), lalu resolve dari `row?.canUpdate ?? defaultData?.canUpdate`
    - Field/row absen di source → return `true`
    - Export `FormPageContext` dari `FormPage.jsx` (bila belum) agar bisa di-`useContext` di hook terpisah
    - _Requirements: 5.1, 5.2, 5.3, 5.5_

  - [x] 9.2 Update `FormPage.jsx` (baris ~739-744) — `disabledOn` boolean langsung
    - Hapus pemanggilan `evaluate(defaultData?.disabledOn, defaultData)`, ganti `!!defaultData?.disabledOn`
    - _Requirements: 3.8_

  - [x] 9.3 Audit `gjsRelationsTable.js` — TIDAK ADA perubahan diperlukan
    - `evaluateExpression` di file ini dipakai utk `col.expression` (kolom custom GrapesJS relations table) — tidak terkait `disabledOn` sama sekali, tidak disentuh
    - _Requirements: 3.8_

  - [x] 9.4 Integrasikan `useCanUpdate` ke komponen field wrapper
    - `FormInput.jsx`: `useCanUpdate(_name)` → OR-kan ke `readOnly` (field root/wrapper umum, meng-cover `LinkModel` sbg child krn LinkModel treat `disabled||readOnly` setara internal — tidak perlu integrasi terpisah di `LinkModel.jsx` sendiri)
    - `FormTable.jsx` (`CellComponent`): `useCanUpdate(col.name, item)` per-row → OR-kan ke `attributes.readOnly`
    - _Requirements: 5.4_

  - [x]* 9.5 Write frontend tests for useCanUpdate hook
    - Project pakai Vitest (bukan Jest/RTL), TANPA `@testing-library/react`/jsdom terinstal → logic murni diekstrak ke `resolveCanUpdate()` (testable tanpa render), hook `useCanUpdate` jadi wrapper tipis `useContext` di atasnya
    - 10 test case: field absen → true; canUpdate map absen → true; disabledOn/propDisabled short-circuit → false; blanket bool; row vs defaultData source; ctx undefined → true
    - **Validates: Requirements 5.2, 5.3, 5.5**

- [x] 10. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass (backend PHPUnit + frontend bila ada), ask the user if questions arise.
  - Jalankan `vendor/bin/pint --dirty --format agent` (formatter, HANYA setelah semua task selesai)
  - Hasil: 55/55 test spec ini pass (unit + integration). Full suite: backend 301/303 relevan pass (2 gagal pre-existing, tercatat di memory `project_pretest_bugs_dev_rahmad_5`, tidak terkait spec ini). FE: `useCanUpdate.test.js` 10/10 pass, full vitest 1821/1840 (19 gagal pre-existing di modul PrintTemplate, tidak terkait spec ini). Pint: `{"result":"pass"}`.

## Notes

- Setiap task mereferensi requirement spesifik untuk traceability ke `requirements.md`.
- Task 1-2 WAJIB selesai lebih dulu — task 3 & 5 (accessor) bergantung pada gating `getAppends()` sbg prasyarat semantik (accessor baru relevan diuji dalam show-context).
- Task 3 & 5 independen satu sama lain (bisa dikerjakan paralel bila perlu), tapi keduanya harus selesai sebelum task 7 (integration test butuh kedua attribute).
- Task 9 (frontend) bergantung pada payload backend (task 1-7) sudah benar — tidak bisa diverifikasi penuh tanpa backend selesai, tapi hook (9.1) bisa ditulis lebih awal dgn payload mock.
- Model contoh (`PurchaseOrder`/`PurchaseOrderItem`) dipakai HANYA sbg referensi test/dokumentasi — spec ini TIDAK mewajibkan menulis override `canUpdate()`/`disabledOn()` ke model production manapun; itu keputusan terpisah per model, di luar scope spec ini.
- Task 3.4 & 9.5 ditandai optional — 3.4 karena sifatnya assertion negatif (mencegah regresi arsitektur, bukan behavior inti); 9.5 karena bergantung konvensi testing FE project yang perlu dicek dulu ketersediaannya.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["1.3"] },
    { "id": 3, "tasks": ["1.4"] },
    { "id": 4, "tasks": ["3.1", "5.1"] },
    { "id": 5, "tasks": ["3.2"] },
    { "id": 6, "tasks": ["3.3", "3.4", "5.2"] },
    { "id": 7, "tasks": ["7.1", "7.2", "7.3"] },
    { "id": 8, "tasks": ["7.4"] },
    { "id": 9, "tasks": ["9.1"] },
    { "id": 10, "tasks": ["9.2", "9.3"] },
    { "id": 11, "tasks": ["9.4"] },
    { "id": 12, "tasks": ["9.5"] }
  ]
}
```
