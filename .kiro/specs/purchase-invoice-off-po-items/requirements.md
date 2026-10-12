# Requirements Document

## Introduction

Diturunkan dari [design.md](design.md) (`design-first`). Purchase Invoice hanya dapat menagih PO Item. Spec ini membuat invoice dapat menagih baris receipt berdiri sendiri dan item bebas yang belum diterima, melengkapi [`purchase-receipt-off-po-items`](../purchase-receipt-off-po-items/requirements.md).

## Glossary

- **Baris normal**: baris dengan `purchase_order_item_id`.
- **Baris receipt**: baris invoice dengan `purchase_receipt_item_id` (menagih baris receipt berdiri sendiri).
- **Item bebas**: baris invoice tanpa PO Item dan tanpa baris receipt, dengan `item.id` (ItemVariant).
- **Baris receipt berdiri sendiri**: baris `purchase_receipt_items` tanpa `purchase_order_item_id` dan tanpa `replaces_purchase_order_item_id`.

## Requirements

### Requirement 1: Jenis baris dan data

1. THE sistem SHALL mendukung tiga jenis baris invoice (normal, baris receipt, item bebas).
2. THE `purchase_invoice_items` SHALL memiliki `purchase_receipt_item_id` (FK nullable) dan THE `purchase_receipt_items` SHALL memiliki `billed_quantity` (double, default 0) dan `purchase_order_id` (FK nullable, diisi dari receipt induk).
3. THE kolom dan perilaku lama SHALL tidak berubah.

### Requirement 2: Validasi

1. Setiap baris SHALL memiliki setidaknya satu dari `purchase_order_item.id`, `purchase_receipt_item.id`, atau `item.id`; bila lebih dari satu, prioritas SHALL PO Item > baris receipt > item.
2. Baris receipt SHALL milik receipt yang berelasi dengan PO invoice, bertipe berdiri sendiri, dan receipt SHALL sudah di-approve.
3. Item bebas SHALL tidak sama dengan item PO Item mana pun pada PO tersebut, dan `rate` SHALL wajib.
4. Over-bill baris receipt SHALL diizinkan (tanpa batas atas).
5. Baris receipt dan item bebas SHALL membutuhkan `purchase_order.id`.

### Requirement 3: Approve baris receipt

1. THE sistem SHALL tidak memicu `PurchaseOrderItemBillingChanged` untuk baris ini.
2. THE sistem SHALL menaikkan `billed_quantity` baris receipt sebesar qty invoice (di bawah lock).
3. THE sistem SHALL menilai SLE belum bernilai milik baris itu secara FIFO dengan rate invoice, mencocokkan receipt + `item_id` + baris berdiri sendiri.
4. WHEN qty invoice melebihi SLE pending, THE sistem SHALL membuat SLE pending baru yang menunjuk invoice dengan item/gudang dari baris receipt.
5. Nilai yang dihasilkan SHALL masuk `totalStockGL`.

### Requirement 4: Approve item bebas

1. WHEN ada baris receipt berdiri sendiri pada PO yang sama dengan `item_id` sama dan `qty − billed_quantity > 0`, THE sistem SHALL menilainya FIFO (urut tanggal receipt) seperti Requirement 3.
2. WHEN belum ada baris receipt yang cocok, THE sistem SHALL tidak membuat SLE dan SHALL menunggu receipt.

### Requirement 5: Approve baris receipt berdiri sendiri (sisi receipt)

1. WHEN baris receipt berdiri sendiri di-approve, THE sistem SHALL terlebih dulu mencari invoice item bebas yang sudah di-approve (PO sama via `ModelConnection`, `purchase_order_item_id` dan `purchase_receipt_item_id` kosong, `item_id` sama, `quantity − allocated_qty > 0`, urut tanggal invoice).
2. THE sistem SHALL mengalokasikan sebagai entri queue bernilai (rate invoice), menaikkan `allocated_qty` invoice item dan `billed_quantity` baris receipt; sisa SHALL tetap belum bernilai.

### Requirement 6: GL dan status PO

1. Mekanisme GL SHALL tidak berubah (invoice: expense/credit penuh + Stock/SRNB dari `totalStockGL`; receipt: `totalRatesForGL` bila ada nilai).
2. Status tagihan PO SHALL hanya menghitung PO Item; baris receipt dan item bebas SHALL tidak mengubahnya.

### Requirement 7: Retur invoice

1. Retur baris receipt SHALL membalik `billed_quantity` baris itu (minimal 0).
2. Retur item bebas SHALL hanya membalik GL; SLE SHALL tidak dibalik.

### Requirement 8: Form

1. Kolom item SHALL memakai LinkModel multi-model: main PO Item ("Item PO"), sub `PurchaseReceiptOffPoItem` (model dropdown turunan `PurchaseReceiptItem`; "Diterima di Luar PO"; PO sama lewat `purchase_order_id`, berdiri sendiri, receipt approved), sub `ItemVariant` ("Item Lainnya", `notIn` id varian PO).
2. Memilih opsi PO Item SHALL seperti sekarang; opsi baris receipt SHALL mengisi `purchase_receipt_item`, `item`, satuan, gudang (rate dikosongkan); opsi item bebas SHALL mengisi `item` dan satuan default varian.
3. Perhitungan total (`rawLines`), sel `disabled`, dan filter satuan SHALL memakai "punya salah satu dari tiga sumber" sehingga baris baru ikut `net_amount`, `tax_amount`, `amount`.
4. Payload SHALL membawa `items[].purchase_receipt_item.id` atau `items[].item.id`; edit/show SHALL memuat relasi baru; i18n id/en SHALL ditambah.

### Requirement 9: Kompatibilitas

1. Baris normal, retur normal, ALUR-1/ALUR-2 PO Item, dan substitusi dari spec Purchase Receipt SHALL berperilaku identik; test Purchase Invoice dan Purchase Receipt yang ada SHALL tetap lulus.
