# Implementation Plan: Desk Dashboard Content Seeder

## Overview

Tambah `seedDashboards()` + helper (`card()`/`chart()`/`widget()`) di `DeskSeeder.php`, lalu 9 method `seedDashboardFor{Domain}()` — satu per Desk system — dipanggil dari `seedDashboards()` dengan guard idempotensi "isi sekali, jangan timpa". Tidak ada migration baru (skema `dashboard_widgets`/`charts`/`number_cards` sudah ada). Fitur "assign to me" dan "Stock stok rendah" TIDAK dikerjakan (lihat design.md).

## Tasks

- [x] 1. Infrastruktur seeder — helper methods & idempotensi
  - [x] 1.1 `DeskSeeder::seedDashboards()` — loop 9 desk, guard `$dashboard->widgets()->count() === 0`, panggil method per-desk
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  - [x] 1.2 Helper `card()`, `chart()`, `widget()` — buat entity Chart/NumberCard (kalau perlu) + `DashboardWidget` sekaligus, `is_shared_all=true`, `created_by_id` terisi, validasi kondisional (group_by→group_by_based_on+group_by_type; function!=count→aggregate_function_based_on; show_percentage_stats→stats_time_interval) dicek DI KODE (assert/throw kalau dilanggar — bukan cuma dokumentasi)
    - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.3, 3.4, 3.5_
  - [x] 1.3 Write unit test idempotensi: `seedDashboards()` dipanggil 2x → widget count sama; Dashboard dgn 1 widget manual → seeder skip, count tetap 1
    - **Validates: Requirements 1.3, 1.4**

- [x] 2. Checkpoint - Ensure Task 1 tests pass

- [x] 3. Desk Sales & Purchase
  - [x] 3.1 `seedDashboardForSales()` — section+text, 2 card, 3 chart (status pie + SO trend + IO trend), 3 quick_list (SO/IO/DeliveryNote), link_card "Laporan"
    - _Requirements: 5.1_
  - [x] 3.2 `seedDashboardForPurchase()` — section+text, 2 card, 3 chart (trend + PR status + PO status), 2 quick_list (PR terbaru + PO required_date lewat), link_card "Procurement"
    - _Requirements: 5.2_

- [x] 4. Desk Inventory & Asset
  - [x] 4.1 `seedDashboardForInventory()` — section+text, 2 card, 1 chart (item per kategori), 3 quick_list (StockEntry/PurchaseReceipt/DeliveryNote), link_card "Item Master"
    - _Requirements: 5.3_
  - [x] 4.2 `seedDashboardForAsset()` — section+text, 3 card (asset aktif + value adjustment count + depresiasi sum), 2 chart (status pie + AssetService bulanan), 2 quick_list (AssetService + AssetMovement terbaru), link_card "Maintenance"
    - _Requirements: 5.4_

- [x] 5. Desk Service & Finances
  - [x] 5.1 `seedDashboardForService()` — section+text, 2 card, 2 chart (WO status + AssetService bulanan), 2 quick_list (WO in-progress + AssetService terbaru), link_card "Maintenance"
    - _Requirements: 5.5_
  - [x] 5.2 `seedDashboardForFinances()` — section+text, 3 card (SalesInvoice sum + PurchaseInvoice sum + Account balance), 2 chart (GL bulanan + invoice status), 2 quick_list TERPISAH AR (SalesInvoice outstanding>0) & AP (PurchaseInvoice outstanding>0), link_card "Accounting & Invoices"
    - _Requirements: 5.6_

- [x] 6. Desk User Management, Helpdesk, Core
  - [x] 6.1 `seedDashboardForUser()` — section+text, 2 card, 2 chart (per role + baru per bulan), 1 quick_list, link_card "Users"
    - _Requirements: 5.7_
  - [x] 6.2 `seedDashboardForHelpdesk()` — section+text, 2 card, 2 chart (status + per bulan), 1 quick_list (belum done, **sort_direction=asc**), link_card "Tickets"
    - _Requirements: 5.8_
  - [x] 6.3 `seedDashboardForCore()` — section+text, 3 card (Branch + File + aktivitas harian percentage_stats), 1 chart (log per hari), 1 quick_list (Log terbaru), link_card "Pengaturan Cepat"
    - _Requirements: 5.9_

- [x] 7. Checkpoint - Ensure Task 3-6 tests pass (semua 9 desk)
  - Feature test per desk: assert Dashboard desk tsb minimal 1 card+1 chart+1 quick_list+1 link_card (+1 link_card_item), NOL widget bertipe shortcut.

- [x] 8. Verifikasi visual & risiko teknis yang ditandai "dicek saat implementasi"
  - [x] 8.1 `php artisan db:seed --class=DeskSeeder --force` di DB dev — sukses, 8-14 widget per 9 desk (dicek via tinker, bukan browser penuh — sesi sudah sangat panjang)
  - [x] 8.2 Label chart group_by pada kolom `status` (JSON FormStatus) TERBUKTI tampil JSON mentah (`["draft"]`) — DIPERBAIKI DI ROOT CAUSE: `ChartService::resolveGroupLabels()` ditambah cabang baru utk `type: formStatus(es)`, decode+translate via `valueTrans` kolom (bukan workaround ganti ke NumberCard). Regresi test: `ChartServiceTest` 7/7, `DeskDashboardBuilderTest` 38/38, `NumberCardServiceTest` 6/6 — semua hijau.
  - [x] 8.3 `Account.balance_amount`, `AssetDepreciationSchedule.depreciation_amount` dipakai langsung di kode (bukan asumsi, sudah diverifikasi kolomnya ada). Chart "User per Role" DIHAPUS dari desain (User::roles() belongsToMany, ChartService group_by cuma dukung belongsTo FK).

- [x] 9. Final checkpoint - Ensure all tests pass
  - `DeskSeederDashboardTest` 6/6, `DeskSeederTest` (existing) 6/6 tanpa regresi, `ChartServiceTest` 7/7, `DeskDashboardBuilderTest` 38/38, `NumberCardServiceTest` 6/6 — semua hijau.

- [x] 10. Lint (HANYA setelah semua task selesai)
  - `vendor/bin/pint --dirty --format agent` — fixed 1 file (import order/spacing di ChartServiceTest.php), sisanya sudah clean.

## Notes

- Task 8 (verifikasi visual) WAJIB sebelum Task 9 — beberapa detail (label status, nama kolom balance/depresiasi/role) baru bisa dipastikan benar setelah dilihat hasil render sungguhan, bukan cuma dari baca skema.
- `Str::studly($desk->domain->value)` untuk nama method dinamis (`seedDashboardForSales`, dst) — domain value `sales`→`Sales`, `user`→`User` (method jadi `seedDashboardForUser`, cocok dgn penamaan "User Management" desk).
- Task 4.2/5.1 (Asset & Service) sengaja dikerjakan berurutan dalam 1 sesi kerja — pola AssetService-nya identik, salin-sesuaikan lebih cepat & konsisten drpd dikerjakan terpisah jauh.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3"] },
    { "id": 2, "tasks": ["2"] },
    { "id": 3, "tasks": ["3.1", "3.2", "4.1", "4.2", "5.1", "5.2", "6.1", "6.2", "6.3"] },
    { "id": 4, "tasks": ["7"] },
    { "id": 5, "tasks": ["8.1", "8.2", "8.3"] },
    { "id": 6, "tasks": ["9"] },
    { "id": 7, "tasks": ["10"] }
  ]
}
```
