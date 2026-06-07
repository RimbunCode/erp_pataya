# Tutorial 2 — Membuat Item & Variant

> Membuat produk yang bisa dipakai di transaksi. **Penting:** transaksi memilih *Variant* (SKU), bukan Item master.

## Konsep

```
Item (master) ──< ItemVariant (SKU) ──< Stock (per warehouse)
```

Detail: [Inventory · Item & Variant](../modules/inventory.md#item--variant) · [Database · Item & ItemVariant](../database.md#item--itemvariant) · [Model · ItemVariant](../models.md#itemvariant).

## Langkah 1 — Buat Item

Menu **Inventory → Items → Tambah**.

| Field | Catatan |
|---|---|
| `code`, `name` | Identitas item |
| `category` | Pilih via [CategoryLinkModel](../frontend.md#peta-linkmodel-relasi-ui) |
| `default_unit` | Satuan dasar |
| `is_stock_item` | Aktifkan jika stok di-track |
| `format_variant` | Pola nama variant otomatis |

- Halaman: `Pages/Inventory/Items/Form.jsx` (+ sub-form `FormDetail`, `FormVariant`, `FormBarcodes`, `FormStockLevels`).
- Route: `POST /items` (`items.store`). Lihat [Routes · Inventory](../routes.md#10-inventory).

## Langkah 2 — Tambah Unit Konversi (opsional)

Tab **Units** pada form item → tambah `ItemUnit` (mis. 1 BOX = 12 PCS).

## Langkah 3 — Definisikan Variant

Tab **Variant**. Kombinasikan `Attribute` (mis. Warna: Merah/Biru) → sistem generate `ItemVariant` per kombinasi.

- Tiap variant punya `code` (SKU), stok, dan barcode sendiri.
- Halaman: `FormVariant.jsx`, `ShowVariant.jsx`.

## Langkah 4 — Barcode (opsional)

Tab **Barcodes** → `ItemBarcode` per variant + unit.

## Langkah 5 — Stok Awal

Stok **tidak** diisi manual di form item. Gunakan **Stock Entry** tipe `receive`:

→ Inventory → Stock Entries → tipe penerimaan. Lihat [Inventory · Stock Entry](../modules/inventory.md#stock-entry).

## Verifikasi

- Buka variant → tab stok menampilkan posisi per warehouse (relasi `stocks`).
- Variant kini muncul di [`ItemVariantLinkModel`](../frontend.md#peta-linkmodel-relasi-ui) saat membuat SO/PO.

## Berikutnya

→ [Tutorial 3 — Alur Penjualan](03-alur-penjualan.md) · [Tutorial 4 — Alur Pembelian](04-alur-pembelian.md)

---

*Lihat: [Inventory](../modules/inventory.md) · [Frontend · Inventory](../frontend.md#inventory)*
