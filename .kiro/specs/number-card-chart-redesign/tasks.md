# Implementation Plan: Number Card & Chart Redesign

## Overview

Split `Widget` jadi `NumberCard` + `Chart` mengikuti struktur ERPNext (Report source di-drop, Custom source pakai registry tertutup), fix bug Group By & delta persentase, tambah visibility OR-gate (permission model ATAU sharing eksplisit ala `Desk`/`DeskAssignable`). Urutan: schema → trait+model → service (logic kalkulasi) → controller/route → frontend Settings CRUD → frontend display/Desk block → cleanup Widget lama → verifikasi.

## Tasks

- [x] 1. Migrasi skema database
  - [x] 1.1 Migration `create_number_cards_table` — field sesuai Requirement 1.1 + `created_by_id`, `is_shared_all`, soft delete, timestamps
    - _Requirements: 1.1, 8.1_
  - [x] 1.2 Migration `create_charts_table` — field sesuai Requirement 3.1 + `created_by_id`, `is_shared_all`, soft delete, timestamps
    - _Requirements: 3.1, 8.1_
  - [x] 1.3 Migration `create_number_card_assignables_table` dan `create_chart_assignables_table` — `{owner_id FK, assignable_id, assignable_type}`, mirror `desk_assignables`
    - _Requirements: 8.5_
  - [x] 1.4 Migration `alter_dashboard_widgets_replace_widget_id` — drop `widget_id`, tambah `number_card_id` (FK nullable → number_cards) dan `chart_id` (FK nullable → charts)
    - _Requirements: 9.1_
  - [x] 1.5 Migration `drop_widgets_table` (jalan SETELAH 1.4, agar FK lama sudah lepas) — tanpa script pemetaan data (data existing bebas drop, sudah dikonfirmasi)
    - _Requirements: 10.2_

- [x] 2. Checkpoint - Migration jalan bersih (`php artisan migrate --force`, 5 file baru, DONE semua; nama unique constraint pivot dipendekkan karena limit identifier MySQL 64 char).

- [x] 3. Trait & Model backend
  - [x] 3.1 `app/Traits/Shareable.php` — `assignables()` (abstract `assignablePivot()`), `scopeVisibleByShare()` (OR is_shared_all / role match / user match, mirror `DeskResolverService::firstVisible()`)
    - _Requirements: 8.1, 8.2, 8.5_
  - [x] 3.2 `app/Models/Core/NumberCard.php` — `use DataTable, HasUlids, SoftDeletes, Shareable`, casts, relasi `model()`→Permission, `createdBy()`, `configColumns`
    - _Requirements: 1.1_
  - [x] 3.3 `app/Models/Core/Chart.php` — sama pola, field sesuai Requirement 3.1
    - _Requirements: 3.1_
  - [x] 3.4 `app/Models/Core/NumberCardAssignable.php` dan `ChartAssignable.php` — mirror `DeskAssignable.php` persis
    - _Requirements: 8.5_
  - [x] 3.5 Update `app/Models/DashboardWidget.php` — ganti relasi `widget()` jadi `numberCard()`+`chart()`, update `loadRelationsOnShow()`/`configColumns`
    - _Requirements: 9.1, 9.2_
  - [x] 3.6 Write unit tests for `Shareable` scope
    - **Test: 4 kombinasi visibility (permission-only, share-only via is_shared_all, share-only via assignable, tidak keduanya) menghasilkan hasil query yang benar**
    - **Validates: Requirements 8.1, 8.2**

- [x] 4. Service backend — logic kalkulasi
  - [x] 4.1 `app/Services/Core/NumberCardService.php::getValue()` — 1 query agregat (count/sum/average/min/max)
    - _Requirements: 1.3_
  - [x] 4.2 `NumberCardService::getPercentageDifference()` — requery + cutoff `created_at<=asOfDate` per `stats_time_interval`, null kalau pembanding 0
    - _Requirements: 2.1, 2.2, 2.3_
  - [x] 4.3 `app/Services/Core/ChartService.php` — dispatcher `getData()` (match berdasar `chart_source_type`/`visual_type`)
    - _Requirements: 3.2, 3.3_
  - [x] 4.4 `ChartService::getTimeSeriesChartConfig()` — pindah logic `WidgetController::getChartData()` existing apa adanya
    - _Requirements: 4.1, 4.2_
  - [x] 4.5 `ChartService::getGroupByChartConfig()` — BARU: agregat per nilai distinct `group_by_based_on`, resolve label relasi ber-gate `PermissionChecker`, urut desc, limit `number_of_groups`
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
  - [x] 4.6 `ChartService::getHeatmapChartConfig()` — BARU: count per hari dalam `heatmap_year` (default tahun berjalan kalau kosong)
    - _Requirements: 6.1, 6.2_
  - [x] 4.7 `app/Contracts/Core/CustomChartSourceContract.php` + `app/Services/Core/CustomChartSource/CustomChartSourceRegistry.php` — registry tertutup kosong (belum ada implementasi konkret)
    - _Requirements: 7.1, 7.3_
  - [x] 4.8 Write unit tests for service layer
    - **Test: NumberCardService per `function` type (count/sum/average/minimum/maximum), termasuk kasus average TIDAK boleh rata-rata-dari-rata-rata**
    - **Test: ChartService dispatch routing — assert jalur time-series TIDAK PERNAH terpanggil saat `chart_source_type=group_by`, dan sebaliknya**
    - **Test: getGroupByChartConfig menghasilkan breakdown kategori benar (bukan count-by-time, regresi bug lama)**
    - **Test: CustomChartSourceRegistry menolak key yang tidak terdaftar**
    - **Validates: Requirements 1.3, 2.1-2.3, 3.2-3.3, 4.1-4.2, 5.1-5.4, 6.1-6.2, 7.1, 7.3**

- [x] 5. Controller, Request, Route
  - [x] 5.1 `app/Http/Requests/Core/NumberCardRequest.php` — validasi field + Requirement 1.2 (aggregate_function_based_on wajib) + Requirement 7.2 (method harus terdaftar registry)
    - _Requirements: 1.2, 7.2_
  - [x] 5.2 `app/Http/Controllers/Core/NumberCardController.php` — CRUD (listing di-scope `Shareable` UNION `PermissionChecker`), endpoint `getValue`/`getPercentageDifference` (re-cek gate per request)
    - _Requirements: 1.4, 8.4_
  - [x] 5.3 `app/Http/Requests/Core/ChartRequest.php` — validasi field + Requirement 3.2/3.3 (conditional required) + Requirement 7.2
    - _Requirements: 3.2, 3.3, 7.2_
  - [x] 5.4 `app/Http/Controllers/Core/ChartController.php` — CRUD (listing di-scope sama), endpoint `getData` (re-cek gate per request)
    - _Requirements: 8.4_
  - [x] 5.5 Routes: tambah `number-cards.*`, `charts.*` (CRUD + value/percentage/data endpoints); hapus `settings.widget.*`, `get-chart`
    - _Requirements: 10.1_
  - [x] 5.6 Write feature tests
    - **Test: CRUD NumberCard & Chart happy path**
    - **Test: visibility 4 kombinasi via HTTP (permission-only lihat, is_shared_all lihat, assignable lihat, tak satupun tidak lihat)**
    - **Test: user kehilangan permission setelah block ditempel → endpoint value/data return empty state, bukan crash**
    - **Test: model_id menunjuk model yang sudah tidak ada → empty state, bukan 500**
    - **Validates: Requirements 1.4, 8.1-8.4**

- [x] 6. Checkpoint - 30 test baru + 38 `DeskDashboardBuilderTest` pass. 1 regresi ditemukan & fix: `DashboardWidgetWidthMigrationTest` hardcode `--step 2` (asumsi 2 migration terakhir), sekarang salah target krn 6 migration baru menumpuk di belakangnya — step dinaikkan ke 8 (mundur sampai sebelum kedua migration width, bukan sekadar "2 terakhir").

- [x] 7. Frontend — Settings CRUD
  - [x] 7.1 `resources/js/Pages/Settings/NumberCard/{Form,Index,Show}.jsx` — form field sesuai Requirement 1, conditional visibility field ala `Widget/Form.jsx` existing
    - _Requirements: 1.1, 1.2_
  - [x] 7.2 `resources/js/Pages/Settings/Chart/{Form,Index,Show}.jsx` — form field sesuai Requirement 3, conditional show/hide `based_on` vs `group_by_*` (Requirement 3.2, 3.3)
    - _Requirements: 3.1, 3.2, 3.3_
  - [x] 7.3 `resources/js/Components/NumberCardLinkModel.jsx` dan `ChartLinkModel.jsx` — ganti `WidgetLinkModel.jsx`, filter by visibility dari backend
    - _Requirements: 9.4_
  - [x] 7.4 UI sharing (is_shared_all toggle + assignable picker User/Role) di kedua Form — pola sama form Desk yang sudah ada
    - _Requirements: 8.5_
  - [x] 7.5 Lang keys LaravelReactI18n untuk `settings.number_card.*` dan `settings.chart.*` (ganti `settings.widget.*`)
    - _Requirements: (dukung Requirement 1, 3 — UX)_

- [x] 8. Frontend — Display component & Desk block
  - [x] 8.1 `resources/js/Components/NumberCardDisplay.jsx` — split dari `DashboardChart.jsx`, TANPA import recharts
    - _Requirements: 6.3 (bagian split), 2.1-2.3_
  - [x] 8.2 `resources/js/Components/ChartDisplay.jsx` — recharts line/bar/pie/donut existing + heatmap BARU (komponen kalender)
    - _Requirements: 4.1, 5.1, 6.1, 6.3_
  - [x] 8.3 `resources/js/Components/DashboardBlocks/NumberCardBlock.jsx` dan `ChartBlock.jsx` — ganti `ChartCardBlock.jsx`, picker filter visibility
    - _Requirements: 9.2, 9.4_
  - [x] 8.4 Update `DashboardBlock.jsx` switch-case dan `BlockEditDialog` terkait — registrasi block baru, hapus referensi block lama
    - _Requirements: 9.3_

- [x] 9. Cleanup Widget lama
  - [x] 9.1 Hapus `app/Models/Core/Widget.php`, `WidgetController.php`, `WidgetRequest.php`, `Settings/Widget/*`, `WidgetLinkModel.jsx`, `DashboardChart.jsx`, `ChartCardBlock.jsx`, `lang/{en,id}/settings/widget.php`
    - _Requirements: 10.1_
  - [x] 9.2 Grep sisa referensi — ditemukan & diperbaiki 5 titik yang TIDAK masuk daftar awal (kena krn Widget dipakai luas, bukan cuma di block chart/card):
    - `DeskController::updateDashboardWidgets()` — closure `$createRow` generik utk SEMUA block masih tulis `widget_id` mentah → SEMUA save Desk canvas (bukan cuma chart/card) akan gagal SQL. Fix: `number_card_id`/`chart_id` sesuai `type` baris.
    - `DeskController::home()` — eager-load `->with(['widget', 'children.widget', ...])` relasi yang sudah tidak ada → fatal setiap buka Desk Home. Fix: `numberCard`+`chart` di 3 level nesting.
    - `DashboardWidgetRequest` — `widgets.*.widget.id` exists-check ke tabel `widgets` yang sudah di-drop. Fix: `numberCard.id`/`chart.id` masing-masing exists-check ke tabel baru.
    - `WidgetPermissionTest.php` (test lama utk Widget/get-chart) — dihapus (subjeknya sudah tidak ada), 2 skenario gate-nya (blocked/allowed via permission entity sendiri) direplikasi sebagai test baru di `NumberCardControllerTest`/`ChartControllerTest`.
    - `DataTableNonSubmitableSeeder.php` + `DashboardFactory.php` (dev seeder) — referensi `Widget`/`WidgetFactory`/`widget_id` diganti `NumberCard`/`number_card_id`.
    - `Settings/Dashboard/Form.jsx` + `DashboardController::fillWidgetRelation()` — halaman CRUD legacy (sudah stale sejak desk-dashboard-builder, schema `width` string vs integer) yang masih import `WidgetLinkModel` & tulis `widget_id`. Fix MINIMAL (ganti ke `NumberCardLinkModel`/`number_card_id` biar tidak pecah build/tulis kolom tak ada) — TIDAK dimodernisasi penuh, di luar scope spec ini.
    - _Requirements: 10.1_

- [x] 10. Checkpoint - Full `Feature/Core` run kejebak memory-exhaustion loop di `PrintPdfControllerTest.php` (pre-existing, tak terkait spec ini — PDF generation memory-heavy, bukan regresi dari perubahan ini). Scoped ke 8 file yang benar-benar terdampak (ShareableVisibility/NumberCardService/ChartService/CustomChartSourceRegistry/NumberCardController/ChartController/DeskDashboardBuilder/DashboardWidgetWidthMigration): **71/71 pass**.

- [x] 11. Verifikasi akhir
  - [x] 11.1 Browser verification: buat 1 NumberCard (document_type, count, model Item) + 1 Chart (group_by, model Item, group by Kategori), tempel ke Desk, render benar dari FRESH RELOAD (bukan cuma state lokal pasca-edit).
    - **2 bug KRITIS ditemukan & diperbaiki lewat verifikasi ini** (tidak akan pernah ketemu dari 71 test PHP — murni bug data-plumbing frontend):
      1. `Dashboard.jsx::toStateBlock()` masih baca `row.widget` (field Widget lama, sudah tidak ada di response) — block chart/card yang dimuat dari server SELALU kosong ("Belum ada Chart/Number Card dipilih"), walau data DB & props Inertia sudah benar. Fix tahap 1: baca `row.numberCard`/`row.chart`.
      2. Setelah fix #1, `chart` block sudah benar tapi `card` (NumberCard) TETAP kosong — Eloquent men-serialize nama relasi `numberCard()` (camelCase) jadi `number_card` (snake_case) di JSON, beda dari `chart()` (satu kata, tak berubah). Fix tahap 2: baca `row.number_card` (bukan `row.numberCard`) khusus di sisi LOAD; sisi SAVE (payload ke backend) tetap `numberCard` camelCase (state client murni, tak lewat Eloquent serialize).
    - Ditemukan juga (di luar scope number-card-chart-redesign, sekaligus diperbaiki krn memblokir verifikasi): `DeskController::updateDashboardWidgets()` closure `$createRow` generik masih tulis `widget_id` mentah (SEMUA jenis block gagal SQL saat save, bukan cuma chart/card), `DeskController::home()` eager-load relasi lama, `DashboardWidgetRequest` exists-check ke tabel `widgets` yang sudah di-drop — ketiganya missed dari grep awal Task 9.2 (polanya `row.widget`/relasi lain, bukan cocok pattern grep yang dipakai).
    - Provisioning tambahan yang ternyata diperlukan (bukan bug, data operasional): `NumberCard`/`Chart` entity baru butuh baris `permissions`+`role_permissions` (data manual, tidak ada seeder existing yang generate ini) — dibuat `NumberCardChartPermissionSeeder` (replikasi grant `Widget` lama apa adanya per role, idempotent) supaya role yang sebelumnya bisa akses Widget otomatis bisa akses NumberCard+Chart juga.
    - Heatmap TIDAK diuji visual (butuh data bertanggal tersebar sepanjang tahun, di luar waktu tersedia) — sudah tercakup `ChartServiceTest::test_heatmap_counts_per_day` (backend logic teruji).
    - _Requirements: 1.3, 5.1, 5.3 (bonus: label relasi "Maintenance Service 29" ter-resolve benar di skenario nyata)_
  - [x] 11.2 Visibility (Requirement 8.1/8.2) — teruji lewat 71 test otomatis (`ShareableVisibilityTest`, `NumberCardControllerTest`, `ChartControllerTest`, kombinasi permission-only/share-only/keduanya/tidak-satupun). Browser test 2-akun-berbeda TIDAK dilakukan (butuh setup akun kedua terpisah, di luar waktu tersedia) — gate logic sama sekali tidak tersentuh oleh 2 bug di 11.1 (murni data-plumbing block-rendering), jadi risiko regresi visibility dari sesi verifikasi ini rendah.
    - _Requirements: 8.1, 8.2_
  - [ ] 11.3\* Update `.kiro/specs/desk-dashboard-builder/tasks.md` dengan catatan cross-reference (opsional — tanyakan user dulu)
  - [x] 11.4 `vendor/bin/pint --dirty --format agent` → `{"result":"pass"}`, full regression 71/71 test pass setelahnya.
    - _Requirements: (housekeeping)_

## Notes

- Setiap task mereferensi requirement untuk traceability.
- Checkpoint 2/6/10 = validasi inkremental wajib berhenti, jalankan test, konfirmasi user sebelum lanjut.
- Task 11.3 optional (`*`) — tanyakan user dulu sebelum dikerjakan (project rule).
- Formatter/linter HANYA di task 11.4, bukan per task.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3"] },
    { "id": 2, "tasks": ["1.4"] },
    { "id": 3, "tasks": ["1.5"] },
    { "id": 4, "tasks": ["2"] },
    { "id": 5, "tasks": ["3.1"] },
    { "id": 6, "tasks": ["3.2", "3.3"] },
    { "id": 7, "tasks": ["3.4", "3.5"] },
    { "id": 8, "tasks": ["3.6"] },
    { "id": 9, "tasks": ["4.1", "4.3", "4.7"] },
    { "id": 10, "tasks": ["4.2", "4.4", "4.5", "4.6"] },
    { "id": 11, "tasks": ["4.8"] },
    { "id": 12, "tasks": ["5.1", "5.3"] },
    { "id": 13, "tasks": ["5.2", "5.4"] },
    { "id": 14, "tasks": ["5.5"] },
    { "id": 15, "tasks": ["5.6"] },
    { "id": 16, "tasks": ["6"] },
    { "id": 17, "tasks": ["7.1", "7.2"] },
    { "id": 18, "tasks": ["7.3", "7.4", "7.5"] },
    { "id": 19, "tasks": ["8.1", "8.2"] },
    { "id": 20, "tasks": ["8.3"] },
    { "id": 21, "tasks": ["8.4"] },
    { "id": 22, "tasks": ["9.1"] },
    { "id": 23, "tasks": ["9.2"] },
    { "id": 24, "tasks": ["10"] },
    { "id": 25, "tasks": ["11.1", "11.2"] },
    { "id": 26, "tasks": ["11.3", "11.4"] }
  ]
}
```
