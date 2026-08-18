# Modul Asset Management (Fase 1)

## Gambaran Umum

Modul Asset Management menyediakan fitur pelacakan aset tetap (fixed asset) — kendaraan, mesin, peralatan, gedung — sebagai unit fisik individual yang dapat dilacak kepemilikan, lokasi, kondisi, dan nilai bukunya. Modul ini dibangun secara bertahap dalam 5 fase; **Fase 1 (ini)** membangun fondasi model data.

## Fase Pengembangan

| Fase | Status | Cakupan |
|---|---|---|
| 1 — Core | ✅ Implementasi | Asset, AssetCategory, AssetLocation |
| 2 — Purchase Integration | 🔜 Planned | `Item.is_fixed_asset`, auto-create dari PR/PI |
| 3 — Depreciation | 🔜 Planned | Kalkulasi + posting GL + AssetValueAdjustment |
| 4 — Movement + Maintenance + Rental | 🔜 Planned | AssetMovement, Maintenance, Repair, perbaikan rental |
| 5 — Capitalization | 🔜 Planned | Composite Asset, CWIP |

## Model

### Asset
Entitas utama — 1 baris = 1 unit aset (atau 1 kelompok unit identik, lihat `asset_quantity`).

**Field kunci**:
- `asset_name`, `code` (FormatingSeries)
- `asset_category_id` → AssetCategory, `asset_location_id` → AssetLocation
- `asset_type` enum: `existing_asset`, `composite_asset`, `composite_component`
- `ownership_type` enum: `company`, `supplier`, `customer` — 3 FK terpisah (bukan polymorphic)
- `gross_purchase_amount`, `additional_asset_cost`, `total_asset_cost` (computed accessor)
- Field depresiasi flat (single-book, tanpa child table)
- Field asuransi (6 kolom nullable)
- `status` via `FormStatusesCast` (array, Submitable trait)

**Siklus hidup dokumen**: Draft → submit (approval) → Active → Scrap/Sell/Maintenance/OutOfOrder

**Branch**: Asset tidak punya `branch_id` sendiri — cabang diturunkan dari `AssetLocation.branch_id`.

### AssetCategory
Kategori flat (bukan tree). Field kunci: `category_name` (unique), `is_rentable`, `non_depreciable_category`, `enable_cwip_accounting`. Child table `AssetCategoryAccount` — akun GL per Branch.

### AssetLocation
Hierarki pohon via trait `TreeView` (nested set `lft`/`rgt`/`depth`). Field kunci: `location_name` (unique), `parent_id`, `is_group`, `branch_id` (HasBranch).

## Arsitektur

```
app/Models/Asset/{Asset, AssetCategory, AssetCategoryAccount, AssetLocation}.php
app/Services/Asset/AssetService.php              (SubmitableService)
app/Http/Controllers/Asset/{Asset, AssetCategory, AssetLocation}Controller.php
app/Http/Requests/Asset/{Asset, AssetCategory, AssetLocation}Request.php
app/Enums/{AssetType, AssetOwnershipType}.php     (+ FormStatus extended)
database/migrations/2026_08_08_00000{1-4}_create_asset_*.php
```

## Pola yang Di-reuse

- `TreeView` — nested set (dari Account/Finances)
- `Submitable` — siklus dokumen + approval chain (dari SalesOrder/PurchaseOrder)
- `HasBranch` — scope per cabang (dari Warehouse)
- `DataTable` / `HasUlids` / `SoftDeletes` / `HasExampleData` — trait standar codebase

## Business Flow

1. **Pencatatan**: User buat Asset via form → draft → submit → approval → Active
2. **Operasional**: Setelah Active, Asset bisa berubah status via aksi eksplisit (scrap, maintenance, out-of-order)
3. **Penghapusan**: `AssetCategory`/`AssetLocation` tidak bisa dihapus (soft/hard) jika masih direferensikan Asset aktif

## Catatan Teknis

- `total_asset_cost` adalah computed accessor (bukan kolom fisik)
- Ownership menggunakan 3 FK terpisah + enum, BUKAN polymorphic
- Guard hapus lokasi di-registrasi di `static::boot()` SEBELUM `parent::boot()` (TreeView's deleting return false)
- Semua model wajib punya kolom `is_example` (global scope dari `HasExampleData` trait)
