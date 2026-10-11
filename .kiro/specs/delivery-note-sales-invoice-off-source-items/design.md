# Design Document: Delivery Note dan Sales Invoice — Item di Luar Sales Order

## Overview

Delivery Note (DN) dan Sales Invoice (SI) kini memakai dua `FormTable` (Items dan Asset Items, spec `asset-items-section`) yang keduanya mengambil baris dari dokumen sumber: `referenceable` (SalesOrderItem/InternalOrderItem) di DN dan `sales_order_item` di SI. Spec ini menyatukan keduanya menjadi satu tabel Items dengan LinkModel multi-model ([`linkmodel-multi-model`](../linkmodel-multi-model/design.md)): model utama = baris SO, sub model = ItemVariant dan Asset, sehingga baris di luar SO dapat disimpan. Mengikuti spec Sales Order [`sales-order-asset-in-items-column`](../sales-order-asset-in-items-column/design.md) dan pola Purchase Receipt/Invoice.

Satu spec untuk DN dan SI; urutan pengerjaan DN dulu, lalu SI.

## Keputusan desain (hasil brainstorming)

1. **Asset bebas = dijual.** Baris Asset di luar SO di DN memicu `AssetSoldViaDelivery`, di SI `AssetSoldViaInvoice`. Rental hanya lewat baris SO sumber (`is_rent`).
2. **Header DN tetap wajib menunjuk SO atau Internal Order.** Baris bebas hanyalah tambahan pada DN itu; tidak menaikkan `delivered_quantity` dan tidak ikut status pengiriman SO/IO. Header SI mengikuti perilaku sekarang (`sales_order.id` nullable).
3. **SI tidak menyentuh stok** (seperti sekarang); stok barang fisik dipotong oleh DN. Baris ItemVariant bebas di SI hanya menagih (GL), tanpa SLE.
4. **Baris bebas tidak menaikkan `billed_quantity` SO.** Penagihan baris bebas DN dilakukan dengan baris bebas di SI.
5. **Retur:** baris ItemVariant bebas boleh diretur; baris Asset bebas tidak (event retur yang ada khusus rental).
6. Satu `items[]` di payload DN/SI; key `asset_items` dihapus. Aturan prioritas bila baris membawa lebih dari satu sumber: baris SO > item > asset.

## Temuan penelusuran kode (fakta)

| # | Temuan | Dampak |
|---|--------|--------|
| 1 | `DeliveryNoteRequest`: `referenceable_id`/`referenceable_type` header dan `items.*.referenceable_id`/`_type` wajib; `asset_items.*.referenceable_type` hanya `SalesOrderItem`; `assetIdsOf()` menurunkan `asset_id` dari SalesOrderItem lewat DB; `validateAssetItemsAreRentable` mewajibkan semua baris asset rentable | Baris bebas membawa `item.id`/`asset.id`; aturan rentable hanya untuk baris asset dari SO |
| 2 | `delivery_note_items.referenceable` adalah `ulidMorphs` (NOT NULL) | Migrasi: nullable |
| 3 | `DeliveryNoteService::onApproved` melempar `RuntimeException` bila `$item->referenceable` kosong, menaikkan `delivered_quantity` SO per baris, dan memicu event aset dari `handleAssetDeliveryItem` (sewa vs jual dari `referenceable->salesOrder->is_rent`) | Baris bebas melewati `delivered_quantity` dan menentukan jenis event dari `asset_id` (jual) |
| 4 | `DeliveryNoteService::fillItemRelations` mengisi `item_id`/`asset_id` dari baris sumber (`batchLoadReferenceableItems`) | Baris bebas mengisi dari `item.id`/`asset.id` input |
| 5 | `SalesInvoiceRequest`: header `sales_order.id` nullable; `items.*.sales_order_item.id` wajib; `asset_items.*` cermin | `sales_order_item.id` jadi salah satu dari tiga sumber |
| 6 | `SalesInvoiceService::fillItemRelations` mengisi `item_id`/`asset_id` dari SalesOrderItem; `onApproved` memicu `SalesOrderItemBillingChanged` per baris dan `AssetSoldViaInvoice` bila `asset_id`; SI tidak punya logika stok | Baris bebas: lewati `SalesOrderItemBillingChanged`; event aset tetap |
| 7 | `sales_invoice_items.sales_order_item_id` sudah nullable | Tanpa migrasi untuk SI (periksa `item_id` nullable) |
| 8 | Form DN/SI: `buildItemColumns(kind)` dua kali, `partitionRowsByAssetId` untuk prefill create-from-SO dan retur, `AssetItemsSection`, `getAllItems`/`allocationContext` | Satu `itemColumns`; partisi dihapus |
| 9 | `lib/assetItems.js`, `AssetItemPartitioner`, `AssetItemsRules`, `AssetItemsSection` kini hanya dipakai DN/SI (SO sudah dilepas) | Dihapus bila tak ada pemakai lagi setelah spec ini |

## Data

- Migrasi `delivery_note_items`: `referenceable_type`/`referenceable_id` nullable (ganti `ulidMorphs` NOT NULL via `->nullable()->change()`; periksa dukungan SQLite pada test, lihat pola migrasi `down()` yang kompatibel SQLite). Pastikan `item_id` nullable (baris asset).
- `sales_invoice_items`: pastikan `item_id` nullable; `sales_order_item_id` sudah nullable.

## Validasi

`DeliveryNoteRequest` (satu `items[]`):
- Tiap baris tepat satu sumber: `referenceable_id` (+ `referenceable_type` SalesOrderItem/InternalOrderItem), `item.id` (ItemVariant), atau `asset.id`; prioritas baris SO > item > asset.
- Baris SO: aturan sekarang (`source_warehouse`, `unit`, `quantity`, batas consumed item, rentable bila asset dari SO).
- Baris `item.id`: `source_warehouse.id`, `unit.id`, `quantity` min 1 wajib; tanpa batas atas dari SO.
- Baris `asset.id`: `quantity` min 1; `unit` dan `source_warehouse` tidak boleh ada; tidak wajib rentable.
- Retur (`return_against`): baris `asset.id` bebas ditolak.
- Header SO/IO tetap wajib.

`SalesInvoiceRequest` (satu `items[]`): tiga sumber dengan prioritas sama; baris bebas wajib `price` dan `tax`; `unit` wajib untuk `item.id`, dilarang untuk `asset.id`; retur baris `asset.id` bebas ditolak.

## Service

`DeliveryNoteService`: `fillItemRelations` mengisi `item_id`/`asset_id` dari input untuk baris bebas; `onApproved`: baris bebas melewati `increment/decrement('delivered_quantity')`; baris `item.id` memotong stok + SLE + valuation seperti baris biasa; baris `asset_id` bebas memicu `AssetSoldViaDelivery`; status pengiriman SO/IO hanya dari baris SO.
`SalesInvoiceService`: `fillItemRelations` mengisi dari input; `onApproved`: baris bebas tanpa `SalesOrderItemBillingChanged`; GL mencakup baris bebas; `AssetSoldViaInvoice` bila `asset_id`.

## Form (`DeliveryNotes/Form.jsx`, `Finances/SalesInvoice/Form.jsx`)

- Hapus `AssetItemsSection` dan tabel kedua; satu `itemColumns`; `getAllItems`/`allocationContext`/`partitionRowsByAssetId` tidak dipakai.
- Kolom item: LinkModel multi-model; utama = baris SO (`SalesOrderItemLinkModel`, tanpa filter `asset_id` sehingga baris item dan asset dari SO muncul bersama), sub model ItemVariant (`item.is_fixed_asset=false`) dan Asset (aktif; tidak ikut baris SO yang sama).
- Memilih opsi SO: mengisi `referenceable`/`sales_order_item` seperti sekarang. Memilih opsi ItemVariant/Asset: sumber SO dikosongkan; Asset tanpa unit/gudang, qty 1.
- Sel nonaktif memakai "punya salah satu dari tiga sumber".
- Prefill create-from-SO dan retur tidak lagi dipartisi.

## Pengamanan baris di luar dokumen sumber

Harga dan pajak baris bebas berasal dari input (tidak ada master harga jual), jadi:
- Izin tambahan `manage_off_source_items` (`extraPermissions()` pada `DeliveryNote` dan `SalesInvoice`, label di `lang/*/user/role.php`); `OffSourceItemRules::validatePermission` menolak baris bebas tanpa izin, dan form menyembunyikan sub model (`usePermission`). Role yang sudah ada tidak otomatis memilikinya: perlu diberikan.
- `OffSourceItemRules::validateFreeAssets`: Asset bebas berstatus `active` dan belum ada di DN (atau SI) submitted lain.
- `OffSourceItemRules::validateSourceBelongsToHeader`: baris SO/IO harus milik dokumen header.

## Strategi pengujian

- **PHPUnit:** validasi tiga sumber dan prioritas (DN dan SI); `onApproved` DN: baris ItemVariant bebas (stok turun, `delivered_quantity` SO tetap), baris Asset bebas (`AssetSoldViaDelivery`), baris SO tak berubah; SI: baris bebas tanpa `SalesOrderItemBillingChanged`, GL, `AssetSoldViaInvoice`; retur ItemVariant bebas diterima, retur Asset bebas ditolak; regresi test DN/SI/Asset yang ada (sesuaikan bentuk payload).
- **Vitest RTL:** konfigurasi `subModels` DN dan SI, memilih tiap jenis, sel nonaktif, total, payload satu `items[]`.
- **Browser (build produksi):** DN dengan baris SO + ItemVariant bebas + Asset bebas (cek stok dan status asset); SI dengan baris bebas; create-from-SO dan retur masih jalan.

## Tidak termasuk (YAGNI)

DN tanpa header SO/IO; rental untuk Asset bebas; SI yang memotong stok; retur Asset bebas; menautkan baris bebas DN ke baris bebas SI secara otomatis.
