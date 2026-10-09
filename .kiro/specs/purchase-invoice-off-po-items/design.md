# Design Document: Purchase Invoice — Item di Luar PO

## Overview

Setiap baris Purchase Invoice wajib menunjuk `PurchaseOrderItem` (`PurchaseInvoiceRequest.php:34`, `PurchaseInvoiceService::fillItemRelations` `:70-71`). Spec ini membuat invoice dapat menagih item di luar PO, melengkapi spec [`purchase-receipt-off-po-items`](../purchase-receipt-off-po-items/design.md): baris receipt berdiri sendiri di spec itu hanya bisa bernilai bila ada invoice yang menagihnya. Form memakai LinkModel multi-model ([`linkmodel-multi-model`](../linkmodel-multi-model/design.md)) dengan tiga sumber.

Spec ini juga menyentuh `PurchaseReceiptService` (ALUR-2 untuk baris berdiri sendiri). Purchase Invoice multi-model adalah spec kedua; Delivery Note dan Sales Invoice menyusul.

## Keputusan desain (hasil brainstorming)

1. **Jenis baris yang bisa ditagih (B):** (a) baris receipt berdiri sendiri, dan (b) item bebas (ItemVariant) yang belum diterima (invoice duluan).
2. **Pencocokan otomatis FIFO per PO + item** antara invoice item bebas dan baris receipt berdiri sendiri, urut tanggal, dibatasi sisa; tanpa tautan eksplisit.
3. **Over-bill diizinkan** untuk baris receipt seperti PO Item: sisa tanpa SLE menjadi SLE pending baru.
4. Status tagihan PO hanya menghitung PO Item; baris receipt dan item bebas tidak mengubahnya.

## Temuan penelusuran kode (fakta)

| # | Temuan | Dampak |
|---|--------|--------|
| 1 | `fillItemRelations` mengisi `item_id` dari PO Item; request mewajibkan `items.*.purchase_order_item.id` | Harus mendukung dua sumber lain |
| 2 | `onApproved`: `PurchaseOrderItemBillingChanged($poItem, ...)` dan `isAlreadyReceived = $poItem->received_quantity > 0` per baris | Baris tanpa PO Item harus dilewati dari event ini |
| 3 | `updatePendingSLEs` (setelah spec Purchase Receipt) mencocokkan SLE belum bernilai ke baris receipt via receipt + `item_id` + PO Item/`replaces`; over-bill membuat SLE pending dengan fallback dari `$poItem` | Perlu varian untuk baris receipt (fallback dari baris receipt) |
| 4 | `PurchaseInvoiceItem` sudah punya `allocated_qty` (dipakai ALUR-2 receipt) dan kolom morph `referenceable` yang tak dipakai service | `allocated_qty` dipakai ulang untuk item bebas |
| 5 | `PurchaseReceiptService::findInvoiceItemsForPoItem` mencari invoice item lewat `ModelConnection` PO -> Invoice dan `purchase_order_item_id` | Item bebas butuh pencarian berbasis `item_id` |
| 6 | Form invoice menghitung total dari `rawLines` yang `.filter((item) => item?.purchase_order_item)` (`Form.jsx:78-85`); sel `disabled={!dataRow?.purchase_order_item}` | Harus diperluas ke tiga sumber atau baris baru tak masuk total |
| 7 | Status tagihan PO dihitung dari `billed_quantity` PO Item (`PurchaseOrderService` bill status) | Tidak berubah untuk baris baru |

## Jenis baris

| Jenis | `purchase_order_item_id` | `purchase_receipt_item_id` | `item_id` dari |
|---|---|---|---|
| Normal | terisi | kosong | PO Item |
| Menagih baris receipt di luar PO | kosong | terisi | baris receipt |
| Item bebas (belum diterima) | kosong | kosong | input `item.id` |

## Data

Migrasi baru:
- `purchase_invoice_items.purchase_receipt_item_id` — ulid nullable, FK ke `purchase_receipt_items`.
- `purchase_receipt_items.billed_quantity` — double default 0.
- `purchase_receipt_items.purchase_order_id` — ulid nullable FK (denormalisasi dari receipt induk, diisi `PurchaseReceiptService` saat simpan, backfill di migrasi) agar dropdown baris receipt memfilter PO lewat kolom nyata.

Model: `PurchaseInvoiceItem::purchaseReceiptItem()`; `configColumns` mengabaikan FK baru; cast `billed_quantity` pada `PurchaseReceiptItem`.

## Validasi (`PurchaseInvoiceRequest` + lintas-baris)

- Tiap baris wajib punya setidaknya satu dari `purchase_order_item.id`, `purchase_receipt_item.id`, atau `item.id`; bila lebih dari satu, **prioritas** PO Item > baris receipt > item (sama dengan `fillItemRelations`). Baris retur dapat membawa `item` dari relasi bersama `purchase_order_item`, jadi aturan "tepat satu" tidak dipakai.
- Baris receipt: milik receipt yang berelasi dengan PO invoice, bertipe berdiri sendiri (PO Item dan `replaces` kosong), receipt sudah di-approve.
- Item bebas: `item.id` bukan item PO mana pun pada PO tersebut (anti-bypass); `rate` wajib seperti baris lain.
- Over-bill baris receipt diizinkan (tanpa batas atas).
- Baris receipt dan item bebas membutuhkan `purchase_order.id`; invoice tanpa PO hanya memuat baris normal seperti sekarang.

## Service

`create`/`update`: `fillItemRelations` + `batchLoad` mendukung `purchase_receipt_item.id` (item dari baris receipt) dan `item.id`.

`onApproved` per jenis baris:
- **Normal:** tidak berubah.
- **Baris receipt:** tidak memicu `PurchaseOrderItemBillingChanged`; `billed_quantity` baris receipt naik (lock); SLE belum bernilai milik baris itu dinilai FIFO (varian `updatePendingSLEs` berbasis receipt + `item_id` + baris berdiri sendiri); sisa over-bill -> SLE pending baru (fallback item/gudang dari baris receipt); nilai masuk `totalStockGL`.
- **Item bebas:** cari baris receipt berdiri sendiri pada PO yang sama dengan `item_id` sama dan `qty − billed_quantity > 0` (urut tanggal receipt); bila ada, dinilai seperti baris receipt (receipt-duluan terselesaikan); bila belum ada, tidak ada SLE sekarang (menunggu receipt).

Sisi receipt (`PurchaseReceiptService::onApproved`, baris berdiri sendiri): coba ALUR-2 dulu — cari invoice item bebas yang sudah di-approve (PO sama via `ModelConnection`, `purchase_order_item_id` dan `purchase_receipt_item_id` kosong, `item_id` sama, `quantity − allocated_qty > 0`, urut tanggal invoice); alokasikan sebagai entri queue bernilai (rate invoice), naikkan `allocated_qty` invoice item dan `billed_quantity` baris receipt; sisa tetap belum bernilai.

GL: mekanisme tidak berubah (invoice: expense/credit penuh + Stock/SRNB dari `totalStockGL`; receipt: `totalRatesForGL` bila ada nilai).

Retur invoice: baris receipt membalik `billed_quantity` (minimal 0); item bebas hanya membalik GL (SLE tidak dibalik, perilaku yang ada).

## Form (`Finances/PurchaseInvoice/Form.jsx`)

- Kolom item: LinkModel multi-model — main `PurchaseOrderItem` ("Item PO"), sub 1 `PurchaseReceiptOffPoItem` ("Diterima di Luar PO"; model turunan `PurchaseReceiptItem` khusus dropdown karena `PurchaseReceiptItem::scopeLinkModel` sudah dipakai fitur Asset dan membatasi ke item aset tetap; scope: berdiri sendiri + receipt approved, filter PO lewat `purchase_order_id`), sub 2 `ItemVariant` ("Item Lainnya", `filters: {id: {notIn: [id varian PO]}}`).
- Pemetaan pilih opsi: PO Item seperti sekarang; baris receipt mengisi `purchase_receipt_item`, `item`, satuan, gudang (rate dikosongkan); item bebas mengisi `item` dan satuan default varian.
- `rawLines`, sel `disabled`, dan filter satuan memakai `hasSource(row)` (salah satu dari tiga sumber) agar baris baru ikut total (`net_amount`, `tax_amount`, `amount`).
- Payload: `items[].purchase_receipt_item.id` atau `items[].item.id`; controller edit/show memuat relasi baru; i18n id/en.

## Strategi pengujian

- **PHPUnit:** validasi tiga jenis baris (anti-bypass, receipt milik PO lain, over-bill); `onApproved` baris receipt (ALUR-1, over-bill, `billed_quantity`) dan item bebas (match FIFO, menunggu); sisi receipt ALUR-2 baris berdiri sendiri (`allocated_qty`, `billed_quantity`); retur baris receipt; status PO tak berubah; regresi test Purchase Invoice/Receipt yang ada. Memakai `initPermissions()` dan user ber-branch.
- **Vitest RTL:** konfigurasi dropdown (tiga sumber, `notIn`), efek memilih tiap jenis, total menghitung baris baru, bentuk payload.
- **Browser (build produksi):** (a) receipt berdiri sendiri lebih dulu lalu invoice menagihnya; (b) invoice item bebas lebih dulu lalu receipt datang. Cek nilai stok, `billed_quantity`, `allocated_qty`.

## Tidak termasuk (YAGNI)

Delivery Note dan Sales Invoice multi-model; status tagihan per baris receipt; "tutup baris PO"; retur yang membalik SLE; tautan eksplisit receipt-invoice.
