# Requirements: Purchase Dual Flow

## 1. Ringkasan

Purchase Order memiliki 2 alur approval yang mungkin terjadi:

- **ALUR-1**: PO → PurchaseReceipt → PurchaseInvoice
- **ALUR-2**: PO → PurchaseInvoice → PurchaseReceipt

PurchaseReceipt dan PurchaseInvoice dapat dibuat >1 per PO.
PurchaseReceipt tidak perlu field harga — harga diambil dari Invoice/PO saat valuasi.
Over/under receipt/bill diizinkan tanpa error.

## 2. Functional Requirements

### FR1: PurchaseReceipt Tanpa Harga

PurchaseReceiptItem **tidak boleh** memiliki field rate/harga.
Harga ditentukan saat `onApproved()`:

| Kondisi | Sumber Rate |
|---------|-------------|
| Belum ada Invoice (ALUR-1) | Rate diperoleh dari PurchaseOrderItem (rate PO) |
| Sudah ada Invoice (ALUR-2) | Rate dari InvoiceItem (rate invoice), pecah per invoice |

**Acceptance:**
- Saat create receipt via UI/API, field rate tidak ada
- `onApproved()` tetap bisa menghitung nilai stock walau tanpa rate di input

### FR2: SLE Pending & Split Valuasi

Saat PurchaseReceipt di-approve, StockLedgerEntry (SLE) dibuat dengan aturan:

**ALUR-1 (Receipt duluan, belum ada Invoice):**
```
SLE: qty_change = +qty, change_in_stock_value = 0, is_valuated = false
GL: TIDAK dibuat saat Receipt approve
```
SLE menunggu valuasi. Saat Invoice approve nanti, SLE di-update.

**ALUR-2 (Invoice duluan, Receipt kemudian):**
```
SLE: qty_change = +qty, change_in_stock_value = rate_invoice × qty, is_valuated = true
GL: Debit Stock Asset / Credit SRNB (dengan rate invoice)
```

**SLE Split** — Jika ada >1 invoice dengan rate berbeda untuk 1 PO item:
```
Invoice #1: rate=4500, qty=30  → SLE#1: rate=4500, qty=30, valuated
Invoice #2: rate=6500, qty=20  → SLE#2: rate=6500, qty=20, valuated
Sisa receipt: qty=5            → SLE#3: qty=5, rate=PO, valuated (over)
```
Allokasi ke invoice tertua dulu (FIFO by date).

**Field baru di StockLedgerEntry:** `is_valuated` (boolean, default false)

### FR3: GL Accounting Dua Alur

**ALUR-1 (PO→Receipt→Invoice):**
```
[Receipt]  → SLE qty-only, NO GL
[Invoice]  → Debit Stock Asset / Credit SRNB  (rate invoice)
           → Debit SRNB / Credit AP            (rate invoice)
           → Update SLE: isi change_in_stock_value, valuation_rate
```

**ALUR-2 (PO→Invoice→Receipt):**
```
[Invoice]  → Debit SRNB / Credit AP  (rate invoice, seperti sekarang)
[Receipt]  → Debit Stock Asset / Credit SRNB  (rate invoice)
           → Buat SLE dengan valuasi penuh
```

**Return (credit note/debit note):**
- Reverse entry: Debit SRNB, Credit AP (untuk return invoice)
- Reverse SLE: quantity_change = -qty (untuk return receipt)

### FR4: Tracking Quantity

PurchaseOrderItem memiliki field yang diupdate otomatis:
- `received_quantity` → ditambah saat setiap Receipt approve
- `billed_quantity` → ditambah saat setiap Invoice approve
- `unreceived_quantity` = quantity - received_quantity (computed)
- `unbilled_quantity` = quantity - billed_quantity (computed)

Field computed BOLEH negatif (over-receipt/bill diizinkan).
Penambahan kumulatif — jika receipt=55 di PO qty=50, received=55.

### FR5: Sync Items dengan Split

Tombol **Sync** di halaman Show PO. Fungsi:

1. Kumpulkan semua InvoiceItems & ReceiptItems terkait
2. **Grouping per** `[rate, tax_id, tax_rate, target_warehouse_id]`
3. Jika hanya 1 group:
   - Update PO item dengan rate/tax/warehouse dari group
4. Jika >1 group (perbedaan source):
   - **Soft-delete** PO item lama
   - **Create N item baru** sesuai group:
     - qty = total dari source items di group itu
     - rate/tax/warehouse = dari group
     - `received_quantity`, `billed_quantity` = sesuai kalkulasi
5. **Update reference** InvoiceItems & ReceiptItems → `purchase_order_item_id` diarahkan ke PO item baru yang sesuai
6. Hitung ulang total amount PO

**AUDIT TRAIL:** ModelConnection dengan data `{type: "items_sync", splits: [...]}`

### FR6: Mark Done

Tombol **Mark Done** di halaman Show PO. Fungsi:

1. **Validasi**: untuk setiap PO item, `received_quantity == billed_quantity`
2. Jika ada mismatch → **toast warning** daftar item yang tidak match:
   ```
   {item_name, received_qty, billed_qty}
   ```
3. Jika semua match → jalankan `syncItems()` → status PO = COMPLETED

**Edge case validasi:**
- Over-receipt (receipt=55, PO=50): Wajib ada invoice dengan qty=55 juga
- Over-bill (invoice=60, PO=50): Wajib ada receipt dengan qty=60 juga
- Under (receipt=30, invoice=30): ✅ valid, PO COMPLETED

### FR7: Over/Under Visual Indicators

Di halaman Show PO, untuk setiap item:
- `Δ receipt` = received_quantity - quantity → positif=hijau(over), negatif=merah(under)
- `Δ bill` = billed_quantity - quantity → positif=hijau(over), negatif=merah(under)
- **Chip status** per item: Over-receipt / Under-receipt / Over-bill / Under-bill / Match

Tombol Sync & Mark Done muncul di header.

### FR8: Status PO Baru

Tambah status untuk PurchaseOrder:

| Status | Kondisi |
|--------|---------|
| `TO_RECEIVE` | received_qty == 0 (existing) |
| `PARTIALLY_RECEIVED` | 0 < received_qty < quantity |
| `RECEIVED` | received_qty >= quantity & delta==0 |
| `OVER_RECEIVED` | received_qty > quantity |
| `TO_BILL` | billed_qty == 0 (existing) |
| `PARTIALLY_BILLED` | 0 < billed_qty < quantity |
| `BILLED` | billed_qty >= quantity & delta==0 |
| `OVER_BILLED` | billed_qty > quantity |
| `COMPLETED` | via Mark Done, receipt==invoice, semua item match |

## 3. Non-functional Requirements

| NFR | Deskripsi |
|-----|-----------|
| NFR1 | Semua database operation di `DB::transaction` |
| NFR2 | Sync & Mark Done menggunakan `lockForUpdate` untuk cegah race condition |
| NFR3 | GL tidak berubah retroaktif — sync hanya update data PO |
| NFR4 | ModelConnection audit trail untuk semua sync & mark done |

## 4. Acceptance Criteria

| AC | Deskripsi |
|----|-----------|
| AC1 | Receipt approve tanpa invoice: SLE dibuat tanpa valuasi, GL tidak dibuat |
| AC2 | Invoice approve setelah receipt: SLE di-update, GL Stock+SRNB+AP dibuat |
| AC3 | Invoice approve tanpa receipt: GL SRNB+AP dibuat, SLE tidak dibuat |
| AC4 | Receipt approve setelah invoice: SLE+GL Stock/SRNB dibuat dengan rate invoice |
| AC5 | >1 invoice per PO item: SLE split per rate invoice |
| AC6 | >1 receipt per PO item: received_quantity akumulasi |
| AC7 | Sync: item PO dipecah sesuai group [rate, tax, warehouse] |
| AC8 | Sync: InvoiceItems dan ReceiptItems refer ke PO item baru |
| AC9 | Mark Done: validasi gagal → toast warning |
| AC10 | Mark Done: validasi sukses → sync + status COMPLETED |
| AC11 | Over-receipt: status OVER_RECEIVED, tidak ada error |
| AC12 | Over-bill: status OVER_BILLED, tidak ada error |

## 5. Constraints

- PurchaseReceiptItem tidak boleh ditambah field harga
- Tidak mengubah struktur PurchaseInvoice yang sudah ada
- Status PO tetap backward-compatible (existing status tidak dihapus)
- SLE tetap polymorphic (referenceable ke PurchaseReceipt)
