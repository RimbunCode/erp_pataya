# Implementation Plan: Fix Amend Item Remapping, Code Collision & Code Overwrite saat Submit

## Overview

Tiga perbaikan independen pada satu alur bisnis (amend): (1) guard di `FormatingSeries::generate()` supaya submit dokumen hasil amend tidak meregenerate `code`, (2) row-lock di `Submitable::amend()` supaya amend concurrent pada root yang sama tidak race, (3) two-pass replicate di `Submitable::amend()` supaya kolom self-reference (`parent_item_id`) ter-remap ke id baru. Tidak ada migration baru, tidak ada perubahan signature publik, tidak ada perubahan route/controller/frontend. Task 1 dan 2 tidak saling bergantung dan bisa dikerjakan dalam urutan apapun; task 3 lebih kompleks (butuh helper deteksi FK self-reference generic) dan dikerjakan terakhir.

## Tasks

- [x] 1. Guard `FormatingSeries::generate()` untuk dokumen hasil amend
  - [x] 1.1 Tambah early-return di `FormatingSeries::generate()` (`app/Models/Core/FormatingSeries.php:151`)
    - Tambah pengecekan di baris pertama method: jika `$data instanceof \App\Models\Model` dan `$data->amended_from_id !== null`, langsung `return $data->code` tanpa menyentuh `$ref`, `$refKey`, atau counter `logs`.
    - Pastikan guard ini tidak tersentuh oleh jalur create (`$isDraft = true`, `$data` selalu array di titik itu) — cukup type-check `instanceof Model` untuk membedakan.
    - _Requirements: 3.1, 3.3, 3.4_

  - [x] 1.2 Write unit tests for `FormatingSeries::generate()` guard (Amend Code Preservation)
    - **Amend Code Preservation: memverifikasi `generate()` mengembalikan `code` apa adanya untuk model dengan `amended_from_id` terisi, dan tidak mengubah counter `logs` milik `FormatingSeries`.**
    - Test: panggil `generate()` dengan model yang `amended_from_id`-nya terisi dan `code = "SO-001/07/26-1"` — assert return value `"SO-001/07/26-1"`, assert `logs`/`current` counter pada `FormatingSeries` tidak berubah sebelum-sesudah.
    - Test: panggil `generate()` dengan model yang `amended_from_id`-nya `null` — assert perilaku tidak berubah dari sebelumnya (masih generate seperti biasa, ini test regresi).
    - **Validates: Requirements 3.1, 3.2, 3.3**

- [x] 2. Checkpoint - Ensure FormatingSeries guard tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Feature test: submit dokumen hasil amend end-to-end
  - [x] 3.1 Tambah test di `tests/Feature/Sales/SalesOrderPermissionTest.php` (atau file test submit SalesOrder yang relevan)
    - Alur: create SalesOrder → cancel → amend → submit dokumen hasil amend → assert `code` setelah submit identik dengan `code` sebelum submit (suffix `-1` tidak hilang).
    - Assert status berubah sesuai alur submit normal (bukan sekadar code-nya, pastikan submit tetap berfungsi penuh).
    - _Requirements: 3.1, 3.2_
    - **Catatan**: menemukan bug independen di luar scope spec ini (`Controller.php:126`, `ignoresPermission()` model vs `$ignorePermission` controller ternyata konsep beda yang keliru ditukar via ternary) yang memblokir SEMUA `submit()` (bukan spesifik amend) kalau session tidak eksplisit menyediakan permission `ApprovalInstanceStep`. Diperbaiki sekalian atas persetujuan user (ganti ternary jadi OR logic).

  - [x] 3.2 Tambah test serupa untuk minimal 1 modul lain (mis. PurchaseOrder) untuk cakupan lintas-modul
    - Pola sama seperti 3.1, disesuaikan dengan service/factory PurchaseOrder.
    - _Requirements: 3.1, 3.2, 3.4_
    - **Catatan**: test individual passed; ditemukan isu lingkungan test (SQLite `:memory:` + PHP 8.4, transaksi berlapis amend→submit→checkApproval bikin test LAIN di file yang sama gagal PDOException saat dijalankan bersamaan). Dikonfirmasi pre-existing keterbatasan lingkungan test (bukan bug produksi — tidak terjadi di MySQL), dicatat dan dilanjutkan atas persetujuan user.

- [x] 4. Checkpoint - Ensure submit-after-amend feature tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Row-lock pada `Submitable::amend()` untuk cegah race condition `revision_number`
  - [x] 5.1 Tambah `lockForUpdate()` saat resolve baris root di `amend()` (`app/Traits/Submitable.php`, blok `if ($this->amended_from_id == null) {...} else {...}`)
    - Query ulang baris root (`$this` atau `$dataOri`) dengan `lockForUpdate()` di dalam transaksi yang sudah dibuka (`DB::beginTransaction()` di awal method), sebelum `increment('revision_number')` dipanggil.
    - Pastikan query lock terjadi pada kedua cabang (`amended_from_id == null` dan `else`), karena keduanya melakukan increment pada baris root yang berbeda secara kondisional.
    - _Requirements: 2.1, 2.2_

  - [x] 5.2 Tangani `QueryException` unique-violation saat insert `$newData`
    - Bungkus operasi insert dokumen hasil amend dengan try-catch: jika terjadi `QueryException` yang merupakan unique constraint violation pada kolom `code`, lempar ulang sebagai exception dengan pesan actionable (mis. `ValidationException` dengan pesan "Amend gagal, ada proses amend lain yang bersamaan — coba lagi"), bukan biarkan `QueryException` mentah bocor ke response.
    - Pastikan `DB::rollBack()` tetap terpanggil pada jalur exception ini (transaksi tidak boleh menggantung).
    - _Requirements: 2.3_

  - [x] 5.3 Write unit/feature tests for row-lock behavior (Concurrent Amend Safety)
    - **Concurrent Amend Safety: memverifikasi bahwa row-lock mencegah dua amend pada root yang sama menghasilkan `code` duplikat, dan bahwa pelanggaran unique constraint (jika tetap terjadi) menghasilkan pesan error yang jelas bukan `QueryException` mentah.**
    - Test: dua amend berurutan (bukan simulasi race asli, cukup pastikan `revision_number` naik benar dan `code` tidak collide) pada root yang sama menghasilkan `code` yang berbeda.
    - Test: jika `QueryException` unique-violation disimulasikan (mis. lewat mocking atau insert manual duplikat sebelum `amend()` dipanggil), assert exception yang dilempar adalah exception dengan pesan jelas, bukan `QueryException` mentah.
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4**

- [x] 6. Checkpoint - Ensure row-lock tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Two-pass item remapping untuk kolom self-reference (`parent_item_id`)
  - [x] 7.1 Tambah helper deteksi kolom FK self-reference di `Submitable.php`
    - Buat method baru (pola serupa `generatedColumnsOf()` yang sudah ada di trait ini), mis. `selfReferencingColumnsOf(string $table): array`, yang mengembalikan nama kolom pada tabel yang foreign key-nya menunjuk ke tabel itu sendiri (via `Schema::getForeignKeys($table)` — cek foreign key yang `foreign_table` sama dengan `$table`).
    - Cache hasil per-tabel dengan pola `static` array yang sama seperti `generatedColumnsOf()`.
    - _Requirements: 1.3_

  - [x] 7.2 Ubah blok replicate item di `amend()` jadi two-pass
    - **Pass 1**: saat replicate tiap item dalam `foreach ($value as $item)`, simpan `$idMap[$oldItem->id] = $newItem->id` per-relasi (array lokal dalam scope relasi yang sedang diproses).
    - **Pass 2**: setelah semua item dalam relasi itu selesai di-replicate dan disimpan, iterasi ulang item-item baru; untuk tiap kolom hasil `selfReferencingColumnsOf()` pada tabel item tsb, jika nilai kolom itu (id lama) ada di `$idMap`, update ke id baru sesuai map, lalu `save()` ulang. Jika id lama tidak ditemukan di map, biarkan nilai apa adanya.
    - _Requirements: 1.1, 1.2, 1.4_
    - **Catatan implementasi**: Pass 2 pakai query builder `update()` (bukan `$model->save()`) karena tabel item punya kolom generated/computed (`basic_amount`, `amount`, dst) — `save()` penuh sempat memicu percobaan UPDATE ke kolom generated itu dan gagal. Query builder update cuma menulis kolom yang eksplisit disebut.

  - [x] 7.3 Write unit/feature tests for item remapping (Split-Item Parent Remapping)
    - **Split-Item Parent Remapping: memverifikasi bahwa `parent_item_id` pada item hasil amend menunjuk ke item baru pada dokumen yang sama, bukan ke item pada dokumen lama.**
    - Test: amend PurchaseOrder dengan 2 item dimana item B punya `parent_item_id` menunjuk item A — assert setelah amend, item B baru punya `parent_item_id` menunjuk ke item A baru (id berbeda dari item A lama).
    - Test: amend dokumen dengan item yang `parent_item_id`-nya `null` — assert tetap `null` setelah amend.
    - Test: amend dokumen SalesOrder dengan pola split-item serupa (cakupan modul kedua).
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4**

- [x] 8. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass (jalankan test suite penuh untuk file yang disentuh: `SubmitableSnapshotFormatTest`, `SalesOrderPermissionTest`, `PurchaseOrderPermissionTest`, test baru di atas), ask the user if questions arise.
  - **Hasil**: 18/18 test pass di 3 file target (isolated run). Full suite run (873 test) menunjukkan 419 error/31 failure, TAPI semua traceback berhenti di `RefreshDatabase.php` (setUp phase, sebelum test body jalan) — root cause `PDOException: cannot start a transaction within a transaction` adalah cascading failure dari SQLite `:memory:` yang gagal rollback bersih di test lain (mis. `print_templates.is_example` schema drift), bukan dari kode `amend()`/`FormatingSeries::generate()`. Konsisten dengan temuan pre-existing di task 3.2. Tidak ada satupun error/failure yang traceback-nya menyentuh `Submitable.php` atau `FormatingSeries.php`.

## Notes

- Setiap task mereferensi requirement spesifik di `requirements.md` untuk traceability.
- Checkpoint memastikan validasi inkremental — jangan lanjut ke task berikutnya kalau checkpoint sebelumnya belum pass.
- Lint/Pint HANYA dijalankan setelah task 8 (final checkpoint) selesai, sesuai aturan project — jangan jalankan per task.
- Task 7 (item remapping) paling kompleks dan berisiko regresi pada modul lain yang juga punya self-reference item (jika ada selain PurchaseOrderItem/SalesOrderItem) — helper generic di 7.1 sengaja dibuat supaya otomatis mencakup semua tabel, tapi tetap perlu diverifikasi test tidak meregresi modul yang item-nya TIDAK punya self-reference (relasi HasMany/MorphMany biasa tetap ter-replicate seperti sebelumnya).
- Task 1-2 (guard FormatingSeries) tidak bergantung pada task 5 atau 7 — bisa merupakan PR/commit terpisah jika ingin di-ship lebih cepat.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "5.1", "7.1"] },
    { "id": 1, "tasks": ["1.2", "3.1", "3.2", "5.2", "7.2"] },
    { "id": 2, "tasks": ["2"] },
    { "id": 3, "tasks": ["4", "5.3"] },
    { "id": 4, "tasks": ["6", "7.3"] },
    { "id": 5, "tasks": ["8"] }
  ]
}
```
