# Design Document: Sales Order — Asset di Kolom Item (multi-model)

## Overview

Spec `asset-items-section` memisahkan form Sales Order menjadi dua `FormTable`: **Items** (`ItemVariantLinkModel`, filter `item.is_fixed_asset=false`) dan **Asset Items** (`AssetLinkModel`). Keduanya disimpan ke `sales_order_items` yang sama (`item_id` XOR `asset_id`). Dengan LinkModel multi-model ([`linkmodel-multi-model`](../linkmodel-multi-model/design.md)), pemisahan itu tidak lagi perlu: satu tabel Items dengan kolom item berisi dua model, ItemVariant (utama) dan Asset (sub model).

Hanya Sales Order. Delivery Note dan Sales Invoice (section Asset Items masing-masing, dan rencana sub model ItemVariant + Asset di kolom item mereka) menjadi spec lanjutan terpisah karena membutuhkan keputusan stok, event rental/jual, dan GL.

## Keputusan desain

1. Satu `items[]`; setiap baris memuat tepat satu dari `item.id` atau `asset.id`. Key `asset_items` dihapus dari payload SO.
2. Filter `item.is_fixed_asset=false` pada model utama dipertahankan: item aset tetap hanya dipilih lewat sub model Asset (1 baris = 1 Asset).
3. Perilaku baris Asset tidak berubah: tanpa Unit dan Source Warehouse, Tax wajib, `quantity` min 1, aturan rental `Asset.is_rentable`.
4. Show menampilkan satu tabel item.

## Temuan penelusuran kode (fakta)

| # | Temuan | Dampak |
|---|--------|--------|
| 1 | `SalesOrderRequest` punya rule `items.*` (dengan `items.*.asset.id` prohibited) dan cermin `asset_items.*`; `withValidator` memakai `AssetItemsRules::validateCombinedMinimum/rejectLegacyAssetLines/validateMembership` dengan `itemBuckets()` | Rule digabung ke `items.*`; bucket `asset_items` hilang di SO |
| 2 | `SalesOrderService` baris 59-60 sudah menyimpan `asset_id` dari `asset.id` dan memaksa unit null; baris 110 dan 144 memanggil `AssetItemPartitioner::mergePayload` | Hanya panggilan merge dihapus |
| 3 | `SalesOrderController::create` memanggil `partitionDefaultItems()`; `show` memanggil `AssetItemPartitioner::apply` | Kedua pemisahan dihapus untuk SO (jalur edit diperiksa saat implementasi) |
| 4 | `SalesOrder::rentalDurations` menggabungkan `items` + `assetItems` bila relasi `assetItems` dimuat | Cukup memakai `items` |
| 5 | `Show.jsx` memakai `getAllItems(salesOrder)` | Cukup `salesOrder.items` |
| 6 | `SalesOrderItem::templateLink()` sudah `:asset_id ? :asset \| :item` | Label baris Asset sudah benar |
| 7 | `AssetItemPartitioner`, `AssetItemsRules`, `lib/assetItems.js` dipakai juga oleh Sales Invoice dan Delivery Note | Tidak dihapus; hanya dilepas dari SO |
| 8 | DN/SI membuat baris Asset lewat create-from-SO dengan filter `asset_id != null` | Tidak terpengaruh, data SO tetap memuat `asset_id` |

## Backend

`SalesOrderRequest`:
- `items.*.item.id`: `required_without:items.*.asset.id`, `prohibits:items.*.asset.id`; `items.*.asset.id`: `required_without:items.*.item.id`, `ExistsExcludingTrashed('assets')`. Baris tanpa keduanya atau dengan keduanya ditolak.
- Baris dengan `asset.id`: `quantity` min 1, `tax.id` wajib, `unit` dan `source_warehouse.id` prohibited (seperti rule `asset_items.*` sekarang). Baris dengan `item.id`: rule `items.*` sekarang berlaku (termasuk `validateSourceWarehouseRequired`).
- Rule `asset_items.*`, `itemBuckets()`, dan pemanggilan `AssetItemsRules` dihapus dari SO; minimal satu baris tetap diwajibkan.

`SalesOrderService`: hapus `AssetItemPartitioner::mergePayload` di `create` dan `update`. `SalesOrderController`: hapus `partitionDefaultItems` dan `AssetItemPartitioner::apply`. `SalesOrder::rentalDurations` memakai `items`.

## Frontend (`Sales/SalesOrders/Form.jsx`, `Show.jsx`)

- Hapus `AssetItemsSection` dan `FormTable` kedua; `buildItemColumns(kind)` jadi `itemColumns` tunggal; `getAllItems`/`allocationContext` tidak dipakai di SO (total dan alokasi diskon dari `data.items`).
- Kolom item: `ItemVariantLinkModel` dengan `subModels=[{ model: "App\\Models\\Asset\\Asset", label (Asset), group: ["ownership"], fields: ["item_id"] }]`; filter model utama tetap `buildItemFilters("item")`.
- Sub model Asset memakai `filters: { status: { jsonContains: ["active"] }, ...(is_rent ? { is_rentable: true } : {}) }` (pola `status.jsonContains` sama dengan `Asset/Services/Form.jsx`); penegakan di backend tetap lewat validasi rental `submit()` yang sudah ada.
- Memilih opsi ItemVariant: patch yang ada, ditambah `asset: null`. Memilih opsi Asset: `{ asset, item: null, unit: null, conversion_factor: 1, source_warehouse: null, quantity: 1 }`.
- Nilai kolom: `dataRow.asset ?? dataRow.item`. Sel `unit`, `source_warehouse`, `available_quantity` nonaktif untuk baris Asset; Tax tetap wajib.
- Payload: `items[].item.id` atau `items[].asset.id`. Prefill create-from-source (WorkOrder/Quotation/AssetService) tidak lagi dipisah.
- `Show.jsx`: satu tabel dari `salesOrder.items`; Sync Items dan durasi rental dari `items`.

## Strategi pengujian

- **PHPUnit:** `SalesOrderRequestAssetItemsTest` dan `SalesOrderServiceAssetItemsTest` memakai bentuk payload baru; tambah kasus baris dengan `item` + `asset` sekaligus dan tanpa keduanya (422); asset non-rentable pada SO rental; regresi test SO lain.
- **Vitest RTL:** `Form.rtl.test.jsx` (konfigurasi `subModels`, memilih opsi Asset/ItemVariant, sel nonaktif, total satu tabel), `Show.rtl.test.jsx` (satu tabel).
- **Browser (build produksi):** SO dengan baris ItemVariant + Asset; SO rental dengan Asset; create-from-SO ke DN dan SI masih menarik baris Asset; Show.

## Tidak termasuk (YAGNI)

Delivery Note dan Sales Invoice (hapus section Asset Items dan sub model ItemVariant + Asset di kolom item mereka) — spec lanjutan; backward-compat payload `asset_items` untuk SO; filter tambahan di backend untuk ItemVariant aset tetap (tetap hanya di FE seperti sekarang).
