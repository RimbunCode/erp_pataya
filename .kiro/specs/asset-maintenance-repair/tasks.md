# Implementation Plan: asset-maintenance-repair

## Overview

Menambahkan domain maintenance/repair ke modul Asset. Jalur maintenance: `AssetMaintenanceTeam` â†’ `AssetMaintenance` (container, get-or-create per Asset) â†’ `AssetMaintenanceTask` (child non-DataTable, template jadwal) â†’ generate `AssetService` (`type=maintenance_task`, auto-approve, bypass `checkApproval()`). Jalur repair: `AssetService` (`type=repair`) langsung ke Asset, approval chain normal. Keduanya bermuara ke satu `AssetService` (Submitable) dengan child `AssetServiceActivity` (log/checklist) dan `AssetServiceConsumedItem` (cost-only). Completion via Event/Listener sync memanggil method existing `Asset::reactivate()`/`setInMaintenance()`/`setOutOfOrder()` (tidak ada perubahan pada `Asset.php`).

## Tasks

- [x] 1. Enum `AssetServiceType`
  - [x] 1.1 Buat `app/Enums/AssetServiceType.php`
    - 2 case: `MAINTENANCE_TASK` (`maintenance_task`), `REPAIR` (`repair`), method `label()`
    - _Requirements: 4.1_

- [x] 2. Migration & Model `AssetMaintenanceTeam` + `MaintenanceTeamMember`
  - [x] 2.1 Migration `create_asset_maintenance_teams_table`
    - Kolom: `team_name` (unique), `manager_id` (FK users nullable), `branch_id` (FK), timestamps, soft delete
    - _Requirements: 1.1_

  - [x] 2.2 Migration `create_maintenance_team_members_table`
    - Kolom: `maintenance_team_id` (FK cascade), `user_id` (FK), timestamps, soft delete
    - _Requirements: 1.2_

  - [x] 2.3 Model `app/Models/Asset/Maintenance/AssetMaintenanceTeam.php`
    - Traits `DataTable, HasUlids, SoftDeletes`; `$service = AssetMaintenanceTeamService::class`
    - Relasi `members(): HasMany`, `manager(): BelongsTo`, `branch(): BelongsTo`
    - _Requirements: 1.1, 1.3_

  - [x] 2.4 Model `app/Models/Asset/Maintenance/MaintenanceTeamMember.php`
    - Traits `HasUlids, SoftDeletes`; `$parentRelation = 'maintenanceTeam'`
    - Relasi `maintenanceTeam(): BelongsTo`, `user(): BelongsTo`
    - _Requirements: 1.2_

  - [x] 2.5 Service `app/Services/Asset/Maintenance/AssetMaintenanceTeamService.php`
    - CRUD biasa (implements `CrudService`), nested create/update `members`
    - _Requirements: 1.1, 1.2_

  - [x] 2.6 Factory `AssetMaintenanceTeamFactory`, `MaintenanceTeamMemberFactory`
    - _Requirements: 1.1, 1.2_

  - [x] 2.7 Write unit tests for `AssetMaintenanceTeam` (relasi)
    - **Relation test: `members()` HasMany, `manager()`/`branch()` BelongsTo**
    - **Validates: Requirements 1.1, 1.2, 1.3**

- [x] 3. Migration & Model `AssetMaintenance` (container)
  - [x] 3.1 Migration `create_asset_maintenances_table`
    - Kolom: `asset_id` (FK **unique**), `maintenance_team_id` (FK nullable), timestamps, soft delete
    - _Requirements: 2.1, 2.2_

  - [x] 3.2 Model `app/Models/Asset/Maintenance/AssetMaintenance.php`
    - Traits `DataTable, HasUlids, SoftDeletes` (BUKAN Submitable)
    - Relasi `asset(): BelongsTo`, `maintenanceTeam(): BelongsTo`, `tasks(): HasMany`
    - _Requirements: 2.1, 2.2, 2.3, 2.5_

  - [x] 3.3 Factory `AssetMaintenanceFactory`
    - _Requirements: 2.1_

  - [x] 3.4 Write unit tests for `AssetMaintenance` (relasi & unique constraint)
    - **Relation test: `asset()`, `maintenanceTeam()`, `tasks()`**
    - **Constraint test: 2 record `AssetMaintenance` dengan `asset_id` sama SHALL gagal (unique)**
    - **Validates: Requirements 2.1, 2.3**

- [x] 4. Checkpoint - Ensure Task 1-3 tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Migration & Model `AssetMaintenanceTask` (child, non-DataTable)
  - [x] 5.1 Migration `create_asset_maintenance_tasks_table`
    - Kolom: `asset_maintenance_id` (FK cascade), `task_name`, `maintenance_type`, `periodicity` (int, hari), `next_due_date` (date), `last_completion_date` (date nullable), `assign_to_id` (FK users nullable), `certificate_required` (bool default false), `description` (text nullable), timestamps, soft delete
    - _Requirements: 3.1_

  - [x] 5.2 Model `app/Models/Asset/Maintenance/AssetMaintenanceTask.php`
    - Traits `HasUlids, SoftDeletes` (BUKAN `DataTable`, BUKAN `Submitable`) â€” `$parentRelation = 'assetMaintenance'`
    - Relasi `assetMaintenance(): BelongsTo`, `assignTo(): BelongsTo`, `services(): HasMany` (ke AssetService via `asset_maintenance_task_id`)
    - Method `periodicityInDays(): int`
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 5.3 Factory `AssetMaintenanceTaskFactory`
    - _Requirements: 3.1_

  - [x] 5.4 Write unit tests for `AssetMaintenanceTask`
    - **No-DataTable test: model TIDAK memiliki route `assetMaintenanceTasks.*` terdaftar (assert route tidak ada)**
    - **Relation test: `assetMaintenance()`, `assignTo()`, `services()`**
    - **Validates: Requirements 3.1, 3.2**

- [x] 6. Migration & Model `AssetService` (Submitable, unified maintenance_task/repair)
  - [x] 6.1 Migration `create_asset_services_table`
    - Kolom: `code` (unique), `type` (string), `asset_id` (FK nullable), `asset_maintenance_task_id` (FK nullable), `failure_date` (datetime nullable), `completion_date` (datetime nullable), `capitalize_repair_cost` (bool default false), `increase_in_asset_life` (int nullable), `description` (text nullable), field standar Submitable (`status` json, `submitted_at`, `canceled_at`, `amended_from_id`, `revision_number`, `created_by_id`, `additional_data`, `is_example` + index, `branch_id`), timestamps, soft delete
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 6.2 Model `app/Models/Asset/AssetService.php`
    - Traits `DataTable, HasFactory, HasUlids, SoftDeletes, Submitable`; `$service = AssetServiceService::class`; `formComponent = 'Asset/Services/Form'`; `translateKey = 'asset.service'`; cast `type` ke `AssetServiceType`
    - Relasi `asset(): BelongsTo`, `assetMaintenanceTask(): BelongsTo`, `activities(): HasMany`, `consumedItems(): HasMany`
    - Accessor `resolvedAsset()`: `type=repair` â†’ `asset`, `type=maintenance_task` â†’ `assetMaintenanceTask.assetMaintenance.asset`
    - Method `isFullyChecked(): bool`
    - `configColumns` DataTable (code, type, status)
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 6.3 Factory `AssetServiceFactory`
    - _Requirements: 4.1_

  - [x] 6.4 Write unit tests for `AssetService`
    - **Relation test: `asset()`, `assetMaintenanceTask()`, `activities()`, `consumedItems()`**
    - **Accessor test: `resolvedAsset()` benar untuk kedua type**
    - **Cast test: `type` ter-cast ke enum `AssetServiceType`**
    - **Validates: Requirements 4.1, 4.2**

- [x] 7. Checkpoint - Ensure Task 5-6 tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Migration & Model `AssetServiceActivity`
  - [x] 8.1 Migration `create_asset_service_activities_table`
    - Kolom: `asset_service_id` (FK cascade), `action_date` (datetime), `pic_id` (FK users nullable), `description` (text), `is_done` (bool default false), timestamps, soft delete
    - _Requirements: 5.1_

  - [x] 8.2 Model `app/Models/Asset/AssetServiceActivity.php`
    - Traits `HasUlids, SoftDeletes`; `$parentRelation = 'assetService'`
    - Relasi `assetService(): BelongsTo`, `pic(): BelongsTo`
    - _Requirements: 5.1_

  - [x] 8.3 Factory `AssetServiceActivityFactory`
    - _Requirements: 5.1_

  - [x] 8.4 Write unit tests for `AssetServiceActivity` (relasi)
    - **Relation test: `assetService()`, `pic()`**
    - **Validates: Requirements 5.1**

- [x] 9. Migration & Model `AssetServiceConsumedItem`
  - [x] 9.1 Migration `create_asset_service_consumed_items_table`
    - Kolom: `asset_service_id` (FK cascade), `item_id` (FK items), `quantity` (decimal), `valuation_rate` (decimal), `total_value` (decimal), timestamps, soft delete
    - _Requirements: 7.1_

  - [x] 9.2 Model `app/Models/Asset/AssetServiceConsumedItem.php`
    - Traits `HasUlids, SoftDeletes`; `$parentRelation = 'assetService'`
    - Relasi `assetService(): BelongsTo`, `item(): BelongsTo`
    - `saving()` hook hitung `total_value = quantity * valuation_rate`
    - _Requirements: 7.1, 7.3_

  - [x] 9.3 Factory `AssetServiceConsumedItemFactory`
    - _Requirements: 7.1_

  - [x] 9.4 Write unit tests for `AssetServiceConsumedItem`
    - **Relation test: `assetService()`, `item()`**
    - **Computed test: `total_value` terhitung benar saat save**
    - **Validates: Requirements 7.1, 7.3**

- [x] 10. Checkpoint - Ensure Task 8-9 tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Event & Listener `AssetServiceCompleted`
  - [x] 11.1 Event `app/Events/Asset/AssetServiceCompleted.php`
    - Constructor `public readonly AssetService $assetService`
    - _Requirements: 6.1_

  - [x] 11.2 Listener `app/Listeners/Asset/Maintenance/ReactivateAssetFromService.php` (SYNC, bukan `ShouldQueue`)
    - `handle()`: resolve Asset via `$event->assetService->resolvedAsset()`, panggil `Asset::reactivate()`
    - _Requirements: 6.2_

  - [x] 11.3 Daftarkan listener di `EventServiceProvider`
    - `AssetServiceCompleted::class => [ReactivateAssetFromService::class]`
    - _Requirements: 6.2_

  - [x] 11.4 Write unit tests for `ReactivateAssetFromService`
    - **Listener test: dispatch `AssetServiceCompleted` (type=repair) â†’ `Asset::reactivate()` terpanggil, status `OUT_OF_ORDER` hilang jadi `ACTIVE`**
    - **Listener test: dispatch `AssetServiceCompleted` (type=maintenance_task) â†’ status `IN_MAINTENANCE` hilang jadi `ACTIVE`**
    - **Validates: Requirements 6.1, 6.2**

- [x] 12. Service `AssetMaintenanceService` (container, get-or-create + nested task)
  - [x] 12.1 Service `app/Services/Asset/Maintenance/AssetMaintenanceService.php` (implements `CrudService`)
    - `create(array $data)`: get-or-create by `asset_id`
    - `createTask(AssetMaintenance $am, array $data)`: buat `AssetMaintenanceTask`, panggil `AssetServiceService::generateForTask($task)`
    - `updateTask()`/`deleteTask()`: nested CRUD task dari halaman show AssetMaintenance
    - _Requirements: 2.4, 3.3, 3.4_

  - [x] 12.2 FormRequest `app/Http/Requests/Asset/AssetMaintenanceRequest.php`
    - Validasi nested `tasks` array
    - _Requirements: 2.4, 3.1_

  - [x] 12.3 Controller `app/Http/Controllers/Asset/AssetMaintenanceController.php`
    - Standard CRUD (bukan Submitable) â€” route via `resourceDetail('assetMaintenance', ..., isSubmmitable: false)`
    - _Requirements: 2.1, 8.1_

  - [x] 12.4 Write feature tests for `AssetMaintenanceService`
    - **Get-or-create test: create task pertama utk Asset tanpa AssetMaintenance existing â†’ AssetMaintenance otomatis terbuat**
    - **Nested task test: `createTask()` langsung menghasilkan 1 `AssetService` (type=maintenance_task, sudah approved)**
    - **Validates: Requirements 2.4, 3.3, 3.4**

- [x] 13. Checkpoint - Ensure Task 11-12 tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Service `AssetServiceService` (Submitable, inti alur)
  - [x] 14.1 `submit()`: cabang `type=repair` (validasi status terminal Asset, `checkApproval()` normal) vs `type=maintenance_task` (bypass `checkApproval()`, set status approved manual)
    - _Requirements: 4.4, 4.5, 4.6_

  - [x] 14.2 `onApproved()`: `type=repair` â†’ `Asset::setOutOfOrder()`; `type=maintenance_task` â†’ `Asset::setInMaintenance()`
    - _Requirements: 4.5, 4.6_

  - [x] 14.3 `complete()`: guard `isFullyChecked()` (throw `LogicException` jika belum), set `completion_date`, apply `capitalize_repair_cost` jika `type=repair`, dispatch `AssetServiceCompleted`, panggil `regenerateNextTask()` jika `type=maintenance_task`
    - _Requirements: 4.7, 5.3, 5.4, 6.1, 6.3, 6.4_

  - [x] 14.4 `generateForTask(AssetMaintenanceTask $task)`: create `AssetService` (`type=maintenance_task`) + langsung `submit()`
    - _Requirements: 3.4, 6.3_

  - [x] 14.5 `regenerateNextTask(AssetMaintenanceTask $task)`: update `last_completion_date`/`next_due_date` (+= periodicity), panggil `generateForTask()`
    - _Requirements: 6.3_

  - [x] 14.6 FormRequest `app/Http/Requests/Asset/AssetServiceRequest.php`
    - Validasi kondisional per `type` (Requirement 4.2, 4.3): `asset_maintenance_task_id` wajib jika maintenance_task, `asset_id`+`failure_date` wajib jika repair
    - _Requirements: 4.2, 4.3_

  - [x] 14.7 Controller `app/Http/Controllers/Asset/AssetServiceController.php`
    - Route via `resourceDetail('assetService', ..., isSubmmitable: true)` + action route `complete`
    - _Requirements: 4.1_

  - [x] 14.8 Write feature tests for `AssetServiceService`
    - **submit() test: type=repair ditolak jika Asset status terminal (scrapped/sold/dst)**
    - **submit() test: type=repair sukses â†’ status via approval chain, `Asset::setOutOfOrder()` terpanggil setelah approved**
    - **submit() test: type=maintenance_task bypass checkApproval(), langsung approved, `Asset::setInMaintenance()` terpanggil**
    - **complete() test: ditolak (LogicException) jika ada activity `is_done=false`**
    - **complete() test: type=repair + `capitalize_repair_cost=true` â†’ `Asset.additional_asset_cost` bertambah**
    - **complete() test: type=maintenance_task â†’ `AssetMaintenanceTask.next_due_date` terupdate DAN AssetService baru ter-generate (auto-approved)**
    - **complete() test: type=repair TIDAK generate AssetService baru**
    - **Validates: Requirements 4.4, 4.5, 4.6, 4.7, 5.3, 5.4, 6.1, 6.3, 6.4**

- [x] 15. Checkpoint - Ensure Task 14 tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 16. Activity Log gating & consumed items endpoint
  - [x] 16.1 Guard BE: create/update `AssetServiceActivity` hanya diizinkan jika `AssetService` status submitted+approved
    - Validasi di `AssetServiceActivityRequest` atau service layer
    - _Requirements: 5.2_

  - [x] 16.2 Write feature tests for Activity gating
    - **Gating test: create AssetServiceActivity pada AssetService status draft SHALL ditolak**
    - **Gating test: create AssetServiceActivity pada AssetService approved SHALL diterima**
    - **Validates: Requirements 5.2**

- [x] 17. Lang files
  - [x] 17.1 `lang/en/asset/service.php` dan `lang/id/asset/service.php`
    - title/add/new/delete, `type.*` labels, error messages (`checklist_not_complete`, `asset_status_terminal`)
    - _Requirements: semua_

  - [x] 17.2 `lang/en/asset/maintenance.php` dan `lang/id/asset/maintenance.php`
    - title/add/new/delete, field labels
    - _Requirements: semua_

  - [x] 17.3 Update `AssetTranslationParityTest` provider â€” tambah `service.php`, `maintenance.php`
    - _Requirements: semua_

- [x] 18. FE â€” AssetMaintenanceTeam pages
  - [x] 18.1 `resources/js/Pages/Asset/MaintenanceTeams/Form.jsx`, `Show.jsx`, `Index.jsx`
    - Form: team_name, manager, branch, FormTable members
    - _Requirements: 1.1, 1.2, 8.1_

- [x] 19. FE â€” AssetMaintenance show page (container + nested Task)
  - [x] 19.1 `resources/js/Pages/Asset/Maintenances/Show.jsx`
    - Header: asset, maintenance_team
    - Nested FormTable `AssetMaintenanceTask` (create/edit/delete inline, TANPA link ke halaman lain â€” sesuai Requirement 8.1)
    - Nested table daftar `AssetService` milik Asset ini (read-only list, link ke masing-masing show AssetService)
    - _Requirements: 3.2, 3.3, 8.1_

  - [x] 19.2 `resources/js/Pages/Asset/Maintenances/Index.jsx`
    - _Requirements: 2.1_

- [x] 20. FE â€” AssetService Form & Show (conditional by type)
  - [x] 20.1 `resources/js/Pages/Asset/Services/Form.jsx`
    - Field kondisional berdasar `type` (Requirement 8.2): maintenance_task fields read-only dari task terkait, repair fields (asset_id, failure_date, capitalize_repair_cost) khusus repair
    - _Requirements: 8.2_

  - [x] 20.2 `resources/js/Pages/Asset/Services/Show.jsx`
    - Tab/section Activity Log â€” disabled sebelum approved (Requirement 5.2), card UI dgn dialog (Requirement 8.3)
    - Tab Consumed Items
    - Dialog konfirmasi completion saat semua checklist `is_done=true` (Requirement 5.3, 5.4)
    - _Requirements: 5.2, 5.3, 5.4, 8.3_

  - [x] 20.3 `resources/js/Pages/Asset/Services/Index.jsx`
    - _Requirements: 4.1_

- [x] 21. Routing
  - [x] 21.1 Update `routes/web.php`
    - `resourceDetail('assetMaintenanceTeam', ..., isSubmmitable: false)`
    - `resourceDetail('assetMaintenance', ..., isSubmmitable: false)`
    - `resourceDetail('assetService', ..., isSubmmitable: true)` + route action `complete`
    - TIDAK ADA route utk `AssetMaintenanceTask` (Requirement 3.2, 8.1)
    - _Requirements: semua_

- [x] 22. Sidebar navigation
  - [x] 22.1 Update `resources/js/Components/Sidebar/AppSidebar.jsx`
    - Tambah "Maintenance Teams", "Asset Maintenance", "Asset Services" ke grup "Assets"
    - _Requirements: 8.1_

- [x] 23. Final checkpoint - Ensure all tests pass, no regression
  - Domain Asset tests (35 test): 100% PASS terisolasi dari bug pre-existing (lihat Notes).
  - Full suite: 1236 test, 485 error + 1 failure — SEMUA 485 error adalah cascade dari SATU root cause pre-existing (`PurchaseReceiptServiceFixedAssetDispatchTest::dispatches_event_only_for_fixed_asset_items_among_mixed_items`, `PurchaseReceiptService.php:157`, "Attempt to read property conversion_factor on null") yang meracuni transaksi SQLite utk seluruh test SETELAHNYA dalam proses yang sama ("cannot start a transaction within a transaction"). Dikonfirmasi 100% direproduksi dalam isolasi TANPA kode Spec 5 sama sekali — file test & service terakhir diubah SEBELUM sesi ini (commit `0531990`/`c1c4489`). 1 failure murni (`PrintPdfControllerTest`) cocok baseline lama. Nol test Spec 5 (`AssetService*`/`AssetMaintenance*`) muncul di error/failure list.
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tidak ada task optional (`[ ]*`) di spec ini â€” seluruh scope dari requirements.md bersifat wajib.
- `AssetMaintenanceTask` SENGAJA tidak memakai `DataTable`/route sendiri (Requirement 3.2) â€” jangan tergoda menambah `resourceDetail` untuknya.
- Listener `ReactivateAssetFromService` SYNC (bukan `ShouldQueue`) â€” konsisten keputusan Spec 4, karena hanya memanggil method status-transition ringan tanpa GL/retry-worthy work.
- `generateForTask()` langsung memanggil `submit()` â€” AssetService type=maintenance_task TIDAK PERNAH terlihat user dalam status draft (auto-submit instan saat digenerate).
- Constraint mutual-exclusivity `asset_id` XOR `asset_maintenance_task_id` divalidasi di FormRequest/Service layer, bukan DB CHECK constraint (konsisten pola codebase).

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1", "2.2"] },
    { "id": 2, "tasks": ["2.3", "2.4", "2.5", "2.6"] },
    { "id": 3, "tasks": ["2.7"] },
    { "id": 4, "tasks": ["3.1"] },
    { "id": 5, "tasks": ["3.2", "3.3"] },
    { "id": 6, "tasks": ["3.4"] },
    { "id": 7, "tasks": ["4"] },
    { "id": 8, "tasks": ["5.1"] },
    { "id": 9, "tasks": ["5.2", "5.3"] },
    { "id": 10, "tasks": ["5.4"] },
    { "id": 11, "tasks": ["6.1"] },
    { "id": 12, "tasks": ["6.2", "6.3"] },
    { "id": 13, "tasks": ["6.4"] },
    { "id": 14, "tasks": ["7"] },
    { "id": 15, "tasks": ["8.1", "9.1"] },
    { "id": 16, "tasks": ["8.2", "8.3", "9.2", "9.3"] },
    { "id": 17, "tasks": ["8.4", "9.4"] },
    { "id": 18, "tasks": ["10"] },
    { "id": 19, "tasks": ["11.1"] },
    { "id": 20, "tasks": ["11.2"] },
    { "id": 21, "tasks": ["11.3"] },
    { "id": 22, "tasks": ["11.4", "12.1"] },
    { "id": 23, "tasks": ["12.2", "12.3"] },
    { "id": 24, "tasks": ["12.4"] },
    { "id": 25, "tasks": ["13"] },
    { "id": 26, "tasks": ["14.1", "14.2", "14.3", "14.4", "14.5"] },
    { "id": 27, "tasks": ["14.6", "14.7"] },
    { "id": 28, "tasks": ["14.8"] },
    { "id": 29, "tasks": ["15"] },
    { "id": 30, "tasks": ["16.1"] },
    { "id": 31, "tasks": ["16.2"] },
    { "id": 32, "tasks": ["17.1", "17.2", "17.3"] },
    { "id": 33, "tasks": ["18.1", "19.1", "19.2", "20.1", "20.2", "20.3"] },
    { "id": 34, "tasks": ["21.1"] },
    { "id": 35, "tasks": ["22.1"] },
    { "id": 36, "tasks": ["23"] }
  ]
}
```
