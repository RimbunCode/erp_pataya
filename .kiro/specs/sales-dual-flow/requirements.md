# Requirements: Sales Dual Flow

## 1. Ringkasan

Sales Order memiliki 2 alur approval yang mungkin terjadi:

- **ALUR-1**: SO → DeliveryNote → SalesInvoice
- **ALUR-2**: SO → SalesInvoice → DeliveryNote

DeliveryNote dan SalesInvoice dapat dibuat >1 per SO.
Over/under deliver/bill diizinkan tanpa error.

**Yang DIPERTAHANKAN (tidak diubah):**

- `DeliveryNoteService.onApproved()` — pencatatan SLE (FIFO picking, `valuation_rates`) + GL COGS (Stock ↔ COGS) tetap seperti saat ini.
- `SalesInvoiceService.onApproved()` — pencatatan GL AR/income (Receivable ↔ Income) tetap seperti saat ini.

**Perbedaan kunci dari Purchase Dual Flow:**

- **SalesInvoice TIDAK menyentuh SLE.** Di Sales, cost/COGS sudah final (FIFO) saat DeliveryNote approve. Invoice hanya mencatat AR/income.
- **DeliveryNote SLE `is_valuated = true`** sejak dibuat — tidak ada fase pending seperti Purchase, karena valuasi cost sudah final di titik delivery.
- Karena itu **tidak ada** `allocated_qty` di SalesInvoiceItem dan **tidak ada** mekanisme split/valuasi SLE dari sisi Invoice.

Fitur baru yang ditambahkan murni layer administratif dual-flow: tracking qty deliver/bill, status array dua dimensi, `syncItems()` (rekonsiliasi + split item), dan tombol Mark Done.

## 2. Functional Requirements

### FR1: Dua Alur Dokumen

SalesOrder mendukung dua urutan dokumen secara berdampingan:

| Kondisi | Perilaku |
|---------|----------|
| DeliveryNote approve duluan (ALUR-1) | SLE + GL COGS dibuat oleh DeliveryNoteService (existing). `delivered_quantity` SO item bertambah. |
| SalesInvoice approve duluan (ALUR-2) | GL AR/income dibuat oleh SalesInvoiceService (existing). `billed_quantity` SO item bertambah. SLE belum dibuat. |

**Acceptance:**
- Kedua urutan bisa terjadi tanpa error
- DeliveryNote & SalesInvoice boleh dibuat >1 per SO

### FR2: SLE & GL Dipertahankan

**DeliveryNote (existing, TIDAK diubah):**
```
[DeliveryNote approve]
  • update delivered_quantity (+) di SO item
  • FIFO picking dari stock_queue → simpan valuation_rates di DeliveryNoteItem
  • Buat SLE: is_valuated = true, change_in_stock_value = -amountPicked
  • Buat GL: Credit Stock Asset / Debit COGS (jika ada cost picked)
```

**SalesInvoice (existing, TIDAK diubah, TIDAK menyentuh SLE):**
```
[SalesInvoice approve]
  • update billed_quantity (+) di SO item
  • Buat GL: Debit Receivable (debit_account) / Credit Income (income_account)
  • TIDAK membuat / mengubah SLE apapun
```

**Acceptance:**
- AC: DeliveryNote SLE memiliki `is_valuated = true`
- AC: SalesInvoice approve tidak membuat / mengubah StockLedgerEntry apapun

### FR3: Tracking Quantity

SalesOrderItem memiliki field yang diupdate otomatis (sudah ada di tabel):
- `delivered_quantity` → ditambah saat setiap DeliveryNote approve
- `billed_quantity` → ditambah saat setiap SalesInvoice approve
- `undelivered_quantity` = quantity - delivered_quantity (computed)
- `unbilled_quantity` = quantity - billed_quantity (computed)

Field computed BOLEH negatif (over-deliver/over-bill diizinkan).
Penambahan kumulatif — jika delivery=55 di SO qty=50, delivered=55.

**Field baru:** `parent_item_id` (nullable ULID FK self-referencing) di `sales_order_items` — untuk audit trail parent-child setelah sync split.

### FR4: Over/Under Deliver & Bill

Over/under deliver/bill diizinkan tanpa error — hanya indikator visual.

- Over-deliver (delivery=55, SO=50): status `OVER_DELIVERED`, tidak ada error
- Over-bill (invoice=60, SO=50): status `OVER_BILLED`, tidak ada error
- Under (delivery=30, invoice=30): valid

### FR5: Sync Items dengan Split

Tombol **Sync Items** di halaman Show SO. Fungsi:

1. Kumpulkan semua SalesInvoiceItems & DeliveryNoteItems terkait (via ModelConnection)
2. **Grouping per** `[rate, tax_id, tax_rate, source_warehouse_id]`
3. Jika hanya 1 group:
   - Update SO item dengan rate/tax/warehouse dari group
4. Jika >1 group (perbedaan source):
   - **Soft-delete** SO item lama
   - **Create N item baru** sesuai group:
     - qty = total dari source items di group itu
     - rate/tax/warehouse = dari group
     - `delivered_quantity`, `billed_quantity` = sum dari `source_delivery_item_ids` / `source_invoice_item_ids` di group tersebut
     - **`parent_item_id`** = id SO item lama (untuk audit trail)
5. **InvoiceItems & DeliveryItems TIDAK diubah** — FK `sales_order_item_id` / referenceable tetap reference ke SO item lama (asli)
6. Hitung ulang total amount SO

**Tujuan `parent_item_id`:** User dapat melihat history — SO item asli (soft-deleted) dan item-item hasil pecahan setelah sync, beserta hubungan parent-child di antara keduanya.

**AUDIT TRAIL:** ModelConnection dengan data `{type: "items_sync", splits: [...]}`

### FR6: Mark Done

Tombol **Mark Done** di halaman Show SO. Fungsi:

1. **Validasi**: untuk setiap SO item, `delivered_quantity == billed_quantity`
2. Jika ada mismatch → **ValidationException** (`mismatches`) daftar item yang tidak match:
   ```
   {item_name, delivered_qty, billed_qty}
   ```
3. Jika semua match → jalankan `syncItems()` → status SO = COMPLETED

**Edge case validasi:**
- Over-deliver (delivery=55, SO=50): Wajib ada invoice dengan qty=55 juga
- Over-bill (invoice=60, SO=50): Wajib ada delivery dengan qty=60 juga
- Under (delivery=30, invoice=30): valid, SO COMPLETED

### FR7: Over/Under Visual Indicators

Di halaman Show SO, untuk setiap item:
- `Δ deliver` = delivered_quantity - quantity → positif=hijau(over), negatif=merah(under)
- `Δ bill` = billed_quantity - quantity → positif=hijau(over), negatif=merah(under)
- **Chip status** per item: Over-deliver / Under-deliver / Over-bill / Under-bill / Match

Tombol Sync & Mark Done muncul di header.

### FR8: Status SO Baru

Status untuk SalesOrder (disimpan sebagai array JSON via Submitable):

| Status | Kondisi |
|--------|---------|
| `TO_DELIVER` | delivered_qty == 0 (existing) |
| `PARTIALLY_DELIVERED` | 0 < delivered_qty < quantity (existing) |
| `DELIVERED` | delivered_qty >= quantity & delta==0 (existing) |
| `OVER_DELIVERED` | delivered_qty > quantity (**baru** di FormStatus enum) |
| `TO_BILL` | billed_qty == 0 (existing) |
| `PARTIALLY_BILLED` | 0 < billed_qty < quantity (existing) |
| `BILLED` | billed_qty >= quantity & delta==0 (existing) |
| `OVER_BILLED` | billed_qty > quantity (existing) |
| `COMPLETED` | via Mark Done, delivery==invoice, semua item match (existing) |

## 3. Non-functional Requirements

| NFR | Deskripsi |
|-----|-----------|
| NFR1 | Semua database operation di `DB::transaction` |
| NFR2 | Sync & Mark Done menggunakan `lockForUpdate` untuk cegah race condition |
| NFR3 | GL & SLE tidak berubah retroaktif — sync hanya update data SO |
| NFR4 | ModelConnection audit trail untuk semua sync & mark done |
| NFR5 | **SalesInvoiceService tidak menyentuh SLE; DeliveryNoteService & SalesInvoiceService GL/SLE existing tidak diubah** |

## 4. Acceptance Criteria

| AC | Deskripsi |
|----|-----------|
| AC1 | DeliveryNote approve: SLE dibuat dengan `is_valuated=true`, GL COGS dibuat (existing, tidak berubah) |
| AC2 | SalesInvoice approve: GL AR/income dibuat (existing), SLE TIDAK dibuat/diubah |
| AC3 | ALUR-1 (DN→SI): delivered_quantity lalu billed_quantity terupdate; status dua dimensi |
| AC4 | ALUR-2 (SI→DN): billed_quantity lalu delivered_quantity terupdate; status dua dimensi |
| AC5 | >1 DeliveryNote per SO item: delivered_quantity akumulasi |
| AC6 | >1 SalesInvoice per SO item: billed_quantity akumulasi |
| AC7 | Sync: item SO dipecah sesuai group [rate, tax, warehouse] |
| AC8 | Sync: SO item baru menyimpan `parent_item_id` ke item lama; FK di InvoiceItems/DeliveryItems TIDAK berubah |
| AC9 | Mark Done: validasi gagal (delivered≠billed) → ValidationException dengan mismatches |
| AC10 | Mark Done: validasi sukses → sync + status COMPLETED |
| AC11 | Over-deliver: status OVER_DELIVERED, tidak ada error |
| AC12 | Over-bill: status OVER_BILLED, tidak ada error |

## 5. Constraints

- **DeliveryNoteService.onApproved() tidak diubah** — SLE FIFO + GL COGS tetap
- **SalesInvoiceService.onApproved() tidak diubah** — GL AR/income tetap; tidak menyentuh SLE
- **SalesInvoiceItem tidak ditambah field `allocated_qty`** — tidak relevan di Sales
- **StockLedgerEntry tidak ditambah/diubah field** — DeliveryNote SLE sudah `is_valuated=true` (tidak ada fase pending)
- Status SO tetap backward-compatible (existing status tidak dihapus)
- `OVER_DELIVERED` ditambah ke `FormStatus` enum (bukan migration — status disimpan sebagai JSON string)
- Migration `add_*` tidak dibuat terpisah — field `parent_item_id` digabung ke `create_sales_order_items_table` (sistem belum production, akan `migrate:fresh`)

## 6. Catatan Domain — Asimetri vs Purchase

Purchase Dual Flow membutuhkan `is_valuated=false` (pending SLE) dan `allocated_qty` karena **cost barang baru diketahui dari Invoice (harga beli)**. Di Sales kebalikannya — **cost/COGS sudah dikunci FIFO saat DeliveryNote approve** (tersimpan di `valuation_rates`), sedangkan Invoice hanya soal harga jual (AR/income). Oleh karena itu:

- **AC13**: DeliveryNote SLE selalu langsung `is_valuated=true` (tidak pernah pending)
- **AC14**: SalesInvoice approve tidak pernah membuat, men-split, atau memvaluasi SLE
- **AC15**: Tidak ada `allocated_qty`, tidak ada `updatePendingSLEs`, tidak ada koreksi `stock_queue` dari sisi Sales Invoice
