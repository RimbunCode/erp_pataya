# Requirements Document

## Introduction

Diturunkan dari [design.md](design.md) (`design-first`). Purchase Receipt hanya menerima baris yang menunjuk PO Item. Spec ini membuat baris dapat berupa item di luar PO: menggantikan PO Item tertentu, atau berdiri sendiri. Form memakai LinkModel multi-model ([`linkmodel-multi-model`](../linkmodel-multi-model/requirements.md)).

## Glossary

- **Baris normal**: baris dengan `purchase_order_item_id`.
- **Baris substitusi**: baris tanpa PO Item, dengan `replaces_purchase_order_item_id` (X).
- **Baris berdiri sendiri**: baris tanpa PO Item dan tanpa `replaces_purchase_order_item_id`.
- **X**: PO Item yang digantikan. **Y**: ItemVariant yang benar-benar diterima.

## Requirements

### Requirement 1: Jenis baris dan data

1. THE sistem SHALL mendukung tiga jenis baris (normal, substitusi, berdiri sendiri).
2. THE `purchase_receipt_items` SHALL memiliki `replaces_purchase_order_item_id` (FK nullable) dan `replaced_quantity` (decimal nullable).
3. THE kolom lama (`purchase_order_item_id`, `item_id`) SHALL tidak berubah.

### Requirement 2: Validasi

1. Setiap baris SHALL memiliki tepat salah satu dari `purchase_order_item_id` atau `item.id`.
2. `replaces_purchase_order_item_id` SHALL hanya diterima bersama `item.id`, X SHALL milik PO yang sama, dan `replaced_quantity` SHALL > 0.
3. Item Y SHALL tidak sama dengan item PO Item mana pun pada PO tersebut.
4. `target_warehouse` SHALL wajib untuk baris di luar PO.
5. `replaced_quantity` (dijumlah lintas baris per X) SHALL tidak melebihi sisa X (`quantity − received_quantity`), divalidasi saat simpan dan ulang di bawah lock saat approve.

### Requirement 3: Approve baris substitusi

1. WHEN X sudah ditagih (`billed_quantity > 0`), THE sistem SHALL menilai Y dari invoice item X (ALUR-2) hingga `replaced_quantity` terpenuhi.
2. WHEN X belum ditagih, THE sistem SHALL memasukkan Y ke stok sebagai belum bernilai (`rate 0`, `is_valuated=false`, ALUR-1).
3. THE sistem SHALL menambah `X.received_quantity` sebesar `replaced_quantity` di bawah lock; bila sisa tak cukup THE sistem SHALL membatalkan approve dengan `ValidationException`.
4. THE sistem SHALL mengurangi `incomings` stok X sebesar `replaced_quantity` (satuan dasar) dan SHALL tidak mengubah `incomings` Y.
5. THE status PO SHALL dihitung ulang (event yang ada) sehingga X yang terpenuhi dapat menghasilkan RECEIVED.

### Requirement 4: Approve baris berdiri sendiri

1. THE sistem SHALL memasukkan Y ke stok sebagai belum bernilai (ALUR-1).
2. THE sistem SHALL tidak mengubah PO Item mana pun maupun `incomings`.

### Requirement 5: Posting GL

1. GL SHALL terposting hanya bila ada nilai (`totalRatesForGL > 0`), perilaku yang ada.

### Requirement 6: Retur

1. Untuk baris tanpa PO Item, tarif retur SHALL diambil dari entri queue stok yang `receipt_item_id`-nya sama dengan baris receipt asal.
2. Total GL retur SHALL dihitung di dalam loop dan SHALL tidak bergantung pada `purchaseOrderItem->rate`.
3. Retur baris substitusi SHALL membalik `X.received_quantity` proporsional (`replaced_quantity × qty_retur ÷ qty_asal`, minimal 0).

### Requirement 7: Hand-off Purchase Invoice

1. `updatePendingSLEs` SHALL mencocokkan baris receipt bila `purchase_order_item_id = X` atau `replaces_purchase_order_item_id = X`, sehingga baris substitusi ALUR-1 dinilai saat invoice X di-approve.
2. Menagih baris berdiri sendiri SHALL di luar spec ini.

### Requirement 8: Aset tetap

1. `FixedAssetItemApproved` dan `CreateAssetFromPurchase` SHALL tidak crash untuk baris tanpa `purchase_order_item`.

### Requirement 9: Form

1. Kolom item SHALL memakai LinkModel multi-model: main PO Item (`mainLabel` "Item PO"), sub ItemVariant ("Item Lainnya") dengan `filters: {id: {notIn: [...]}}` dari item PO.
2. WHEN opsi ItemVariant dipilih, baris SHALL menjadi baris di luar PO (`item` terisi, `purchase_order_item_id` null, satuan default varian).
3. THE form SHALL menyediakan kolom **Menggantikan** (aktif hanya baris di luar PO, filter PO & sisa > 0) dan **`replaced_quantity`** (default `min(qty baris, sisa X)`, dapat diubah); dikosongkan = berdiri sendiri.
4. Sel lain SHALL aktif bila ada PO Item atau `item`; filter satuan SHALL memakai `item_id` varian bila tak ada PO Item.
5. Payload SHALL membawa `items[].item.id`, `replaces_purchase_order_item_id`, `replaced_quantity`; edit/show SHALL memuat relasi baru; i18n id/en SHALL ditambah.

### Requirement 10: Kompatibilitas

1. Baris normal, retur normal, dan alur ALUR-1/ALUR-2 yang ada SHALL berperilaku identik; test PurchaseReceipt yang ada SHALL tetap lulus.
