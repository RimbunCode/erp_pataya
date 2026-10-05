# Design Document: Purchase Receipt — Item di Luar PO

## Overview

Saat ini setiap baris Purchase Receipt wajib menunjuk `PurchaseOrderItem` (`PurchaseReceiptRequest.php:32`), dan `PurchaseReceiptService` membaca `item_id`, `rate`, serta status PO dari PO Item itu. Spec ini membuat baris dapat berupa **item di luar PO**, dipilih lewat LinkModel multi-model (spec [`linkmodel-multi-model`](../linkmodel-multi-model/design.md), sudah diimplementasi): main `PurchaseOrderItem`, sub `ItemVariant`.

Kasus pemicu: Purchase Invoice untuk PO Item **X** sudah di-approve; barang yang datang ternyata **item Y** (bukan X), supplier menolak retur, sehingga Y harus masuk stok lewat Purchase Receipt.

Spec ini hanya Purchase Receipt (+ perbaikan minimal di sisi Purchase Invoice agar substitusi bisa dinilai). Purchase Invoice, Sales Invoice, dan Delivery Note multi-model adalah spec terpisah berikutnya (urutan: Purchase Invoice, Delivery Note, Sales Invoice).

## Keputusan desain (hasil brainstorming)

1. **Satu spec per form**, dimulai dari Purchase Receipt.
2. **Dua mode baris di luar PO:**
   - *Menggantikan PO Item X* — nilai stok Y dari invoice item X bila sudah ada (ALUR-2), bila belum Y masuk belum bernilai (ALUR-1).
   - *Berdiri sendiri* — selalu belum bernilai sampai ada invoice yang menagihnya (spec Purchase Invoice).
3. **X dianggap terpenuhi** oleh substitusi: `received_quantity` X bertambah sebesar `replaced_quantity` (dibatasi sisa X), sehingga status PO dapat menjadi RECEIVED. Dapat diaudit lewat kolom baris dan dibalik saat retur.
4. Tidak ada rate manual di baris receipt dan tidak memakai harga acuan ItemVariant (tidak ada angka perkiraan).

## Temuan penelusuran kode (fakta)

| # | Temuan | Dampak |
|---|--------|--------|
| 1 | `purchase_receipt_items.purchase_order_item_id` sudah **nullable** di migrasi (`2025_11_15_093555_create_purchase_receipt_items_table.php`); model `PurchaseReceiptItem` sudah punya `item()` ke `ItemVariant` via `item_id` | Skema dasar siap; tidak perlu mengubah kolom lama |
| 2 | `PurchaseReceiptService::fillItemRelations` (`:43`) membaca `item_id` dari `$purchaseOrderItems[purchase_order_item_id]->item_id` | Harus mendukung `item.id` dari input |
| 3 | `onApproved`: ALUR-2 (`isAlreadyBilled = $poItem->billed_quantity > 0`) mengalokasikan dari `findInvoiceItemsForPoItem` (`:439`); ALUR-1 menulis queue `rate = $poItem->rate`, `is_valuated=false`, SLE `valuation_rate=0` | Dipakai ulang untuk substitusi memakai X sebagai kunci |
| 4 | Retur memakai `$poItem->rate` (`:215`), `$poItem->decrement('received_quantity')` (`:232`), dan total GL retur `purchaseOrderItem->rate` (`:418`) | Null untuk baris tanpa PO Item; harus diganti |
| 5 | `$stock->updateDetails('decrement','incomings', PO code, qty)` (`:358/:377`) | Reservasi barang masuk milik item PO; substitusi harus melepas reservasi X, bukan Y |
| 6 | Status PO dihitung dari agregat `received_quantity` vs `quantity` (`PurchaseOrderService.php:416-431`); tidak ada "tutup baris PO" | Substitusi harus menaikkan `received_quantity` X |
| 7 | `PurchaseInvoiceService::updatePendingSLEs` (`:377-393`) menemukan SLE belum bernilai lewat `items.purchase_order_item_id = X` | Baris substitusi (PO Item null) terlewat -> perlu `OR replaces_purchase_order_item_id = X` |
| 8 | `FixedAssetItemApproved` / `CreateAssetFromPurchase::findAssetFromRelatedReceipt` memakai `purchase_order_item_id` | Harus tidak crash bila null |

## Jenis baris

| Jenis | `purchase_order_item_id` | `replaces_purchase_order_item_id` | `item_id` dari |
|---|---|---|---|
| Normal | terisi | kosong | PO Item |
| Menggantikan X | kosong | terisi (X) | input `item.id` (ItemVariant Y) |
| Berdiri sendiri | kosong | kosong | input `item.id` |

## Data

Migrasi baru pada `purchase_receipt_items`:
- `replaces_purchase_order_item_id` ulid nullable, FK ke `purchase_order_items` (nullOnDelete tidak dipakai; soft delete model).
- `replaced_quantity` decimal nullable — kuantitas X (satuan X) yang dianggap terpenuhi.

Model `PurchaseReceiptItem`: relasi `replacesPurchaseOrderItem()`, `configColumns` mengabaikan kolom FK baru (pola `purchaseOrderItem`).

## Validasi (`PurchaseReceiptRequest` + aturan lintas-baris)

- `items.*.purchase_order_item_id`: `required_without:items.*.item.id`; `items.*.item.id`: `required_without:items.*.purchase_order_item_id`, `exists` `item_variants` (excluding trashed). Tepat salah satu.
- `items.*.replaces_purchase_order_item_id`: hanya bersama `item.id`; X milik `purchase_order.id` yang sama; `items.*.replaced_quantity` wajib > 0 bila `replaces...` terisi.
- Item Y tidak boleh sama dengan item mana pun pada PO (anti-bypass dedupe dropdown).
- `items.*.target_warehouse.id` wajib untuk baris di luar PO.
- `replaced_quantity` tidak melebihi sisa X (`quantity − received_quantity`), dijumlah lintas baris untuk X yang sama; dicek ulang di bawah lock saat approve.

## Service

`create`/`update`: `fillItemRelations` mengambil `item_id` dari PO Item (baris normal) atau `item.id` (di luar PO); menyimpan `replaces_purchase_order_item_id` & `replaced_quantity`.

`onApproved` per jenis baris:
- **Normal:** tidak berubah.
- **Menggantikan X:** `isAlreadyBilled` dibaca dari X (lock). Sudah ditagih -> ALUR-2 dengan `findInvoiceItemsForPoItem(X)` hingga `replaced_quantity` terpenuhi; belum -> ALUR-1 (queue rate 0 / `is_valuated=false`). `X.received_quantity += replaced_quantity`; sisa tak cukup -> `ValidationException` + rollback (pola `missingDefaultUom`). `incomings` stok X dikurangi `replaced_quantity` (setelah konversi ke satuan dasar stok X); `incomings` Y tidak disentuh.
- **Berdiri sendiri:** ALUR-1 saja; tidak menyentuh PO Item maupun `incomings`.
- `PurchaseOrderReceiveStatusRecalculationRequested` tetap dipicu setelah loop. GL hanya bila `totalRatesForGL > 0`.

Retur (`return_against`):
- Baris tanpa PO Item: tarif dari entri queue stok dengan `receipt_item_id` = id baris receipt asal; total GL retur dihitung di dalam loop (bukan `purchaseOrderItem->rate`).
- Baris substitusi membalik `X.received_quantity` proporsional (`replaced_quantity × qty_retur ÷ qty_asal`, minimal 0).
- Memakai null-safe untuk `$poItem`.

Hand-off Purchase Invoice (minimal, dalam spec ini): `updatePendingSLEs` mencocokkan baris receipt bila `purchase_order_item_id = X` **atau** `replaces_purchase_order_item_id = X`. Menagih baris berdiri sendiri = spec Purchase Invoice.

Aset tetap: `FixedAssetItemApproved`/`CreateAssetFromPurchase` null-safe terhadap `purchase_order_item`.

## Form (`PurchaseReceipts/Form.jsx`)

- Kolom item: `PurchaseOrderItemLinkModel` dengan `mainLabel="Item PO"` dan `subModels=[{model: ItemVariant, label: "Item Lainnya", filters: {id: {notIn: <id ItemVariant semua PO Item>}}, ...}]`; id dihitung dari `data.purchase_order.items`.
- Pilih opsi PO Item: pemetaan baris seperti sekarang. Pilih opsi ItemVariant: baris di luar PO (`item` terisi, `purchase_order_item_id` null, satuan default varian).
- Kolom baru **Menggantikan** (LinkModel PO Item, aktif hanya baris di luar PO, filter `purchase_order_id` & sisa > 0) dan **`replaced_quantity`** (default `min(qty baris, sisa X)`, bisa diubah). Kosong = berdiri sendiri.
- Sel yang `disabled` bila `purchase_order_item_id` kosong kini aktif bila ada PO Item **atau** `item`; filter satuan memakai `item_id` varian bila tak ada PO Item.
- Payload: `items[].item.id`, `replaces_purchase_order_item_id`, `replaced_quantity`.
- Controller edit/show memuat relasi baru; i18n id/en.

## Strategi pengujian

- **PHPUnit:** validasi (positif/negatif, bypass, melebihi sisa, lintas-baris); `onApproved` tiga jenis baris (ALUR-1 & ALUR-2 substitusi, `received_quantity` X, `incomings` X, status PO, GL); retur substitusi & berdiri sendiri; `updatePendingSLEs` mencocokkan substitusi; listener aset tak crash. Memakai `initPermissions()` dan user ber-branch (catatan test project).
- **Vitest RTL:** konfigurasi dropdown, efek pilih varian pada baris, kolom Menggantikan aktif/nonaktif, bentuk payload.
- **Browser (build produksi):** kasus penuh (PO -> Invoice approve -> Receipt pengganti -> approve; cek nilai stok dari invoice & status PO) + varian ALUR-1.

## Tidak termasuk (YAGNI)

Purchase Invoice menagih baris berdiri sendiri; Purchase Invoice/Sales Invoice/Delivery Note multi-model; "tutup baris PO"; rate manual atau harga acuan di receipt.
