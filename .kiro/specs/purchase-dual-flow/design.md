# Design: Purchase Dual Flow

## 1. Ringkasan

Module Purchase saat ini mendukung satu alur: **PurchaseOrder → PurchaseReceipt → PurchaseInvoice**.
Requirement baru: **ALUR-2: PO → PurchaseInvoice → PurchaseReceipt**, di mana Invoice bisa dibuat lebih dulu.

Kedua alur harus bisa hidup berdampingan. PurchaseReceipt dan PurchaseInvoice bisa dibuat >1 per PO.
Tidak perlu field harga di PurchaseReceipt. Over/under receipt/bill diizinkan — ada tombol Sync untuk rekonsiliasi.

## 2. Status Saat Ini

| Komponen                              | Status                                                          |
| ------------------------------------- | --------------------------------------------------------------- |
| `PurchaseOrder` + Items               | ✅ Lengkap (field: received/billed qty)                         |
| `PurchaseReceipt` + Items             | ✅ Tidak ada field rate/harga (sudah sesuai)                    |
| `PurchaseReceiptService.onApproved()` | ⚠️ **Harus diubah** — saat ini langsung buat GL+SLE dgn rate PO |
| `PurchaseInvoice` + Items (Finances)  | ✅ Lengkap, ada rate/basic_amount/tax                           |
| `PurchaseInvoiceService.onApproved()` | ✅ GL SRNB→AP + update billed_qty                               |
| `ModelConnection`                     | ✅ utk koneksi PO→Receipt, PO→Invoice                           |
| Sync over/under receipt/bill          | ❌ Belum ada                                                    |
| GeneralLedger                         | ✅ Double-entry, polymorphic referenceable                      |
| StockLedgerEntry                      | ✅ Polymorphic, FIFO queue                                      |

## 3. Prinsip Desain

1. **No breaking changes** — alur lama tetap berjalan
2. **Konsisten pattern Submitable** — `onApproved()` titik utama
3. **Harga berasal dari Invoice** — Receipt pakai rate Invoice jika sudah ada
4. **Flexible qty** — mismatch receipt/invoice diizinkan
5. **Sync manual** — tombol action di halaman show PO

## 4. Arsitektur

### 4a. Alur Accounting

**Poin kunci dari user:**

- **ALUR-1** (PO→Receipt→Invoice): SLE dibuat saat Receipt approve, **tapi qty only** (`change_in_stock_value = 0`). GL Stock/SRNB **ditunda** hingga Invoice approve, menggunakan rate dari Invoice.
- **ALUR-2** (PO→Invoice→Receipt): GL Invoice (SRNB→AP) dibuat saat Invoice approve seperti sekarang. SLE + GL Stock/SRNB dibuat saat Receipt approve, menggunakan rate dari Invoice.

```
ALUR-1: PO → Receipt → Invoice

  [1] Receipt approve:
      • update received_quantity (+)
      • Buat SLE: qty_change = +qty, change_in_stock_value = 0
        (valuasi menunggu invoice — nanti diupdate saat Invoice approve)
      • JANGAN buat GL di Receipt

  [2] Invoice approve (setelah receipt ada):
      • update billed_quantity (+)
      • Buat GL:  Debit Stock Asset          (rate Invoice × qty)
                  Credit SRNB
      • UPDATE SLE yang dibuat Receipt: isi change_in_stock_value,
        balance_stock_value, valuation_rate pakai rate Invoice
      • Buat GL:  Debit SRNB                 (rate Invoice × qty)
                  Credit Accounts Payable


ALUR-2: PO → Invoice → Receipt

  [1] Invoice approve:
      • update billed_quantity (+)
      • Buat GL:  Debit SRNB                 (rate Invoice × qty)
                  Credit Accounts Payable
      • JANGAN buat SLE (barang belum masuk)

  [2] Receipt approve (setelah invoice ada):
      • update received_quantity (+)
      • Buat SLE: qty_change = +qty, change_in_stock_value = rate Invoice × qty
      • Buat GL:  Debit Stock Asset          (rate Invoice × qty)
                  Credit SRNB
```

### 4b. Deteksi Alur — Logika di Service

**PurchaseReceiptService.onApproved():**

```
foreach item in receipt items:
    poItem = item.purchaseOrderItem

    if poItem.billed_quantity > 0:
        // ALUR-2: Invoice sudah approve duluan
        // Pakai rate dari Invoice (cari PurchaseInvoiceItem terkait)
        rate = findInvoiceRateForPoItem(poItem)
        Buat SLE: change_in_stock_value = rate × qty
        Buat GL:  Debit Stock Asset / Credit SRNB (rate × qty)
    else:
        // ALUR-1: Belum ada invoice
        Buat SLE: qty_change = +qty, change_in_stock_value = 0
        // GL ditunda — nanti dibuat saat Invoice approve
```

**PurchaseInvoiceService.onApproved():**

```
foreach item in invoice items:
    poItem = item.purchaseOrderItem

    if poItem.received_quantity > 0:
        // ALUR-1: Receipt sudah approve duluan
        // Cari SLE yang sudah dibuat Receipt, update valuasinya
        sle = findPendingSleForPoItem(poItem)
        UPDATE sle: change_in_stock_value = rate × qty
                     valuation_rate = rate

        // Buat GL Stock/SRNB
        Buat GL: Debit Stock Asset / Credit SRNB (rate × qty)

    // Buat GL SRNB/AP (untuk kedua alur)
    Buat GL: Debit SRNB / Credit Accounts Payable (rate × qty)
```

### 4c. SLE Pending — Bagaimana Tracking SLE yang Belum Di-valuasi

Setiap SLE sudah punya `referenceable` (morph ke PurchaseReceipt). Tapi kita perlu tracking SLE mana yang belum di-valuasi.

**Pilih field `is_valuated`** (boolean, default false) — lebih eksplisit. Jadi `true` saat Invoice approve update SLE.

Untuk mencari SLE yang pending saat Invoice approve:

```
PurchaseReceiptItem → referenceable (ke PurchaseReceipt) → SLE dengan referenceable_id = Receipt ID
```

### 4c-bis. stock_queue — Format Diperkaya

Setiap entry di `stock_queue` (JSON di tabel `stocks`) kini menyimpan metadata tambahan untuk pencarian yang lebih presisi:

```json
{
  "rate": 4500,
  "quantity": 30,
  "is_valuated": false,
  "sle_id": "01JXXXXX",
  "receipt_item_id": "01JYYYYY"
}
```

**Alasan:** Sebelumnya saat Invoice approve (ALUR-1), koreksi queue entry dilakukan heuristik berdasarkan `rate` — rentan salah jika ada 2 batch dengan rate identik. Dengan `sle_id`, lookup menjadi exact match: cari entry dengan `sle_id` = id SLE pending, update `rate` + `is_valuated` langsung.

**Pola pembuatan queue entry (3 langkah):**
```
1. Push queue entry sementara dengan sle_id = null
2. Update Stock (quantity + stock_queue) → refresh → data Stock sudah final
3. Buat SLE menggunakan data Stock final (quantity_after_transaction, balance_stock_value)
4. Patch queue entry terakhir: isi sle_id dengan id SLE yang baru dibuat
```

**`is_valuated` di queue** memungkinkan reporting/frontend membedakan stok yang sudah "final price" (dari invoice) vs masih estimasi rate PO.

### 4d. Tracking Quantity — Over/Under

**PurchaseOrderItem** (existing):

- `quantity` — qty PO asli
- `received_quantity` — sum dari semua receipt items
- `billed_quantity` — sum dari semua invoice items
- `unreceived_quantity` = quantity - received_quantity (computed)
- `unbilled_quantity` = quantity - billed_quantity (computed)

**Aturan**: Boleh mismatch. Over/under receipt/bill bukan error — indikator visual saja.

### 4e. Sync PO Items — Split per Source (Tombol Manual)

**Prinsip**: Saat sync, PO items **dipecah (split)** sesuai data dari tiap source dokumen (Invoice/Receipt) yang memiliki perbedaan.

**Contoh:**
```
PO Item #1: Item A, qty=50, rate=5000

  Invoice #1: Item A qty=30 rate=4500
  Invoice #2: Item A qty=20 rate=6500

  → Setelah sync, PO Item #1 dipecah:
    PO Item #1.1: Item A, qty=30, rate=4500  (dari Invoice #1)
    PO Item #1.2: Item A, qty=20, rate=6500  (dari Invoice #2)
```

**Skenario Split:**
1. **Rate berbeda** antara Invoice → split per batch rate
2. **Tax berbeda** antara Invoice → split per batch tax
3. **Warehouse berbeda** antara Receipt → split per warehouse
4. **Qty over** → qty sisa yang tidak ter-cover source jadi item terpisah dengan rate PO

**Prinsip FK tidak berubah:**
- Setelah split, `PurchaseInvoiceItem` dan `PurchaseReceiptItem` **tetap** reference ke `purchase_order_item_id` lama (yang sudah di-soft-delete)
- Item PO baru menyimpan `parent_item_id` → id PO item asli, sehingga user dapat menelusuri history
- `received_quantity` dan `billed_quantity` per item baru dihitung proporsional dari `source_receipt_item_ids` / `source_invoice_item_ids` masing-masing group

**PurchaseOrderService.syncItems():**

```
1. Kumpulkan semua PurchaseReceipt terkait (via ModelConnection)
2. Kumpulkan semua PurchaseInvoice terkait (via ModelConnection)
3. Buat master list:

   a. Untuk setiap PO Item, kumpulkan semua source items (InvoiceItems + ReceiptItems):
      - Group by [rate, tax_id, tax_rate, target_warehouse_id]
      - Setiap group menjadi: {qty, rate, tax_id, tax_rate, warehouse_id,
                               source_invoice_item_ids[], source_receipt_item_ids[]}
   
   b. Jika hanya ada 1 group → update PO item biasa (rate/tax/warehouse sesuai group)
   
   c. Jika ada >1 group dengan konfigurasi berbeda → PECAH PO ITEM:
      - Hapus PO item lama (soft delete)
      - Buat N PO item baru sesuai jumlah group:
        * qty = sum qty dari source items di group itu
        * rate = rate dari group
        * tax_id/tax_rate = dari group
        * target_warehouse_id = dari group
        * parent_item_id = id PO item lama (untuk audit trail & history)
        * received_quantity = SUM qty dari source_receipt_item_ids di group ini
        * billed_quantity = SUM qty dari source_invoice_item_ids di group ini
      - FK di InvoiceItems & ReceiptItems TIDAK diubah (tetap ke item lama)
   
   d. Jika ada qty yang tidak ter-cover source manapun (sisa over):
      - Buat PO item tambahan dengan qty = sisa, rate = rate PO asli, parent_item_id = id lama

4. Hitung ulang amount per item: basic_amount = rate × qty, tax_amount = basic_amount × tax_rate/100

5. Hitung ulang total PO header: amount = Utils::countAmount(...)

6. Update status PO (dengan OVER_RECEIVED / OVER_BILLED jika over)

7. Simpan ModelConnection audit trail:
   {
     "type": "items_sync",
     "timestamp": now(),
     "splits": [
       {
         "original_po_item_id": "ulid_lama",
         "new_po_item_id": "ulid_baru_1",
         "rate": 4500,
         "qty": 30
       }
     ]
   }
```

**Trigger**: Tombol "Sync Items" di halaman Show PurchaseOrder.

**Syarat muncul tombol:**
- Ada mismatch calculated vs actual qty
- ATAU ada invoice/receipt dengan rate/tax/warehouse berbeda dari PO
- ATAU ada dokumen baru yang perlu direkonsiliasi

> **Note**: Split bersifat **destruktif** — PO item lama di-soft-delete, diganti item baru. Pastikan ada konfirmasi user. Sync tetap manual, tidak otomatis.

### 4f. ModelConnection Enhancement

Saat ini ModelConnection dibuat di `submit()` tanpa data. Enhancement:

```json
{
  "items": [
    { "po_item_id": "ulid_po_item", "qty": 55, "rate": 5000 },
    { "po_item_id": "ulid_po_item", "qty": 20, "rate": 6000 }
  ]
}
```

Memudahkan sync — receipt/invoice mana yang terkait dengan PO item mana, dengan rate dan qty.

### 4g. Mark Done — Finalisasi PO

**Tombol "Mark Done"** di halaman Show PO. Fungsinya: melakukan sync + validasi receipt/invoice match + update status COMPLETED.

**Logika:**
```
markDone(PurchaseOrder):

1. Kumpulkan semua PurchaseReceipt & PurchaseInvoice terkait
2. Untuk setiap PurchaseOrderItem:
   - total_received_qty = SUM qty dari PurchaseReceiptItem
   - total_billed_qty = SUM qty dari PurchaseInvoiceItem
   - Jika total_received_qty ≠ total_billed_qty → VALIDASI GAGAL
     → return error: "Qty receipt dan invoice untuk item X tidak sama"
3. VALIDASI LULUS → jalankan syncItems() (split items jika perlu)
4. Update status PO: COMPLETED / DONE
5. Buat ModelConnection log:
   { "type": "mark_done", "timestamp": now() }
```

**Response jika gagal:**
```json
{
  "success": false,
  "message": "Qty receipt dan invoice tidak sama untuk beberapa item",
  "mismatches": [
    { "item": "Item A", "received_qty": 55, "billed_qty": 30 },
    { "item": "Item B", "received_qty": 10, "billed_qty": 10 }
  ]
}
```

**Validasi khusus (edge case):**
- Item A receipt=55, invoice=30 → ❌ gagal (tidak match)
- Item A receipt=55, invoice=55 → ✅ sukses
- Over-receipt (receipt=55, PO qty=50): wajib ada invoice dengan qty yg sama (55)
- Over-bill (invoice=60, PO qty=50): wajib ada receipt dengan qty yg sama (60)
- Under-receipt/bill (receipt=30, invoice=30): ✅ valid, status tetap COMPLETED

## 5. Perubahan File

### Migration

Semua field baru digabung langsung ke migration `create_*` masing-masing tabel (tidak ada migration `add_*` terpisah) — karena sistem belum production dan akan `migrate:fresh`.

| Tabel (migration create)                                        | Field yang ditambah                                                                                                     |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `create_stock_ledger_entries_table`                             | `is_valuated` boolean default false — tracking apakah SLE sudah tervaluasi dari invoice                                |
| `create_purchase_invoice_items_table`                           | `allocated_qty` double default 0 — tracking qty yang sudah dialokasikan ke SLE (ALUR-2 FIFO)                           |
| `create_purchase_order_items_table`                             | `parent_item_id` nullable ULID FK self-referencing + `nullOnDelete()` — audit trail parent-child setelah sync split    |

### Backend Services

| File                                               | Perubahan                                                                                                               |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `app/Services/Purchase/PurchaseReceiptService.php` | `onApproved()`: deteksi alur-2 (billed_qty>0); ALUR-1 hanya buat SLE tanpa valuasi; ALUR-2 buat SLE+GL dgn rate Invoice |
| `app/Services/Finances/PurchaseInvoiceService.php` | `onApproved()`: deteksi alur-1 (received_qty>0); cari SLE pending & update valuasi; buat GL Stock/SRNB + SRNB/AP        |
| `app/Services/Purchase/PurchaseOrderService.php`   | Method baru `syncItems()` — pecah PO items per group source; `markDone()` — validasi + sync + status COMPLETED |

### Controllers & Routes

| File                                                        | Perubahan                                   |
| ----------------------------------------------------------- | ------------------------------------------- |
| `app/Http/Controllers/Purchase/PurchaseOrderController.php` | Action baru `syncItems(PurchaseOrder)`, `markDone(PurchaseOrder)` |
| `routes/web.php`                                            | Route baru `POST purchase-orders/{id}/sync-items`, `POST purchase-orders/{id}/mark-done` |

### Frontend

| File                                                  | Perubahan                                                      |
| ----------------------------------------------------- | -------------------------------------------------------------- |
| `resources/js/Pages/Purchase/PurchaseOrders/Show.jsx` | Tambah kolom tracking qty + indikator over/under + tombol Sync + modal konfirmasi dengan diff changes |
| `resources/js/Pages/Purchase/PurchaseOrders/SyncModal.jsx` | Modal untuk preview perubahan sebelum sync: tampilkan side-by-side before/after comparison |

### Tidak berubah

- PurchaseReceipt tetap tanpa field rate
- PurchaseInvoice tetap seperti sekarang
- Model PurchaseReceiptItem tidak berubah
- Model PurchaseInvoiceItem tidak berubah
- GeneralLedger model tidak berubah
- StockLedgerEntry model tidak berubah (hanya migration tambah field)

## 6. Detail Service Logic

### PurchaseReceiptService.onApproved() — Alur baru

```php
public function onApproved(PurchaseReceipt $purchaseReceipt): void
{
    DB::transaction(function () use ($purchaseReceipt) {
        $items = $purchaseReceipt->items()->with('purchaseOrderItem')->get();
        $totalRates = 0;
        $isReturn = $purchaseReceipt->return_against_id !== null;

        foreach ($items as $item) {
            $poItem = $item->purchaseOrderItem;
            if (!$poItem) continue;

            $qty = $item->quantity * $item->conversion_factor;
            $isAlreadyBilled = $poItem->billed_quantity > 0;

            if ($isAlreadyBilled && !$isReturn) {
                // === ALUR-2: Invoice sudah approve duluan ===
                // Cari rate dari Invoice item terkait
                // Untuk multiple invoice, pecah SLE sesuai rate invoice
                $invoiceItems = $this->findInvoiceItems($poItem);
                foreach ($invoiceItems as $invoiceItem) {
                    $rate = $invoiceItem->rate;
                    $invoiceQty = min($qty, $invoiceItem->quantity - $invoiceItem->allocated_qty);
                    if ($invoiceQty <= 0) continue;

                    // SLE dengan valuasi penuh untuk qty dari invoice ini
                    $sle = $this->createStockLedgerEntry(
                        $item, $invoiceQty, $rate,
                        referenceable: $purchaseReceipt
                    );
                    $sle->update(['is_valuated' => true]);

                    // GL: Debit Stock / Credit SRNB untuk portion ini
                    $totalRates += $rate * $invoiceQty;
                    $qty -= $invoiceQty;
                    $invoiceItem->increment('allocated_qty', $invoiceQty);

                    if ($qty <= 0) break;
                }

                // Sisa qty jika masih ada (over-receipt) → SLE qty-only, valuasi nanti
                if ($qty > 0) {
                    $this->createStockLedgerEntry(
                        $item, $qty, rate: 0,
                        change_in_stock_value: 0,
                        referenceable: $purchaseReceipt
                    );
                }

            } else {
                // === ALUR-1: Belum ada invoice ===
                // SLE qty-only (tanpa valuasi)
                $this->createStockLedgerEntry(
                    $item, $qty, rate: 0,
                    change_in_stock_value: 0,
                    referenceable: $purchaseReceipt
                );
                // SLE di-mark pending — nanti diupdate saat Invoice approve
                // GL TIDAK dibuat sekarang
            }

            // Update received_qty di PO item (selalu, untuk kedua alur)
            $poItem->increment('received_quantity', $item->quantity);
        }

        if ($totalRates > 0) {
            // Buat GL hanya untuk ALUR-2 yang punya rate
            $this->createGL($purchaseReceipt, $totalRates, $isReturn);
        }

        // Update status PO
        $this->updatePOStatus($purchaseReceipt->purchaseOrder);
    });
}

private function findInvoiceRate(PurchaseOrderItem $poItem, PurchaseReceiptItem $receiptItem): float
{
    // Cari PurchaseInvoiceItem terbaru yang terkait dengan POItem ini
    // via PurchaseInvoiceItem::where('purchase_order_item_id', $poItem->id)
    //   ->whereHas('purchaseInvoice', fn($q) => $q->approved())
    //   ->latest()
    //   ->value('rate')
    // Fallback ke PO rate jika tidak ketemu
}
```

### PurchaseInvoiceService.onApproved() — Tambahan

```php
public function onApproved(PurchaseInvoice $purchaseInvoice): void
{
    DB::transaction(function () use ($purchaseInvoice) {
        $items = $purchaseInvoice->items()->with('purchaseOrderItem')->get();
        $totalSRNB = 0;
        $isReturn = $purchaseInvoice->return_against_id !== null;

        foreach ($items as $item) {
            $poItem = $item->purchaseOrderItem;
            if (!$poItem) continue;

            $qty = $item->quantity;
            $rate = $item->rate;

            if ($isReturn) {
                // Return handling... (existing logic)
            } else {
                $poItem->increment('billed_quantity', $qty);
            }

            $isAlreadyReceived = $poItem->received_quantity > 0;

            if ($isAlreadyReceived && !$isReturn) {
                // === ALUR-1: Receipt sudah approve duluan ===
                // Cari SLE yang pending (belum di-valuasi) untuk POItem ini
                $pendingSLE = StockLedgerEntry::where('referenceable_type', PurchaseReceipt::class)
                    ->where('is_valuated', false)
                    ->whereHasMorph('referenceable', [PurchaseReceipt::class], function ($q) use ($poItem) {
                        $q->whereHas('items', fn($q) => $q->where('purchase_order_item_id', $poItem->id));
                    })
                    ->get();

                // Pecah per qty invoice — setiap invoice rate berbeda -> SLE terpisah
                $remainingQty = $qty;
                foreach ($pendingSLE as $sle) {
                    if ($remainingQty <= 0) break;

                    $sleQty = $sle->quantity_change; // qty asli di SLE
                    $allocateQty = min($sleQty, $remainingQty);

                    // Copy SLE menjadi terpisah per rate invoice
                    if ($allocateQty < $sleQty) {
                        // Bagi SLE: sebagian untuk rate invoice ini, sisa tetap pending
                        $newSle = $sle->replicate();
                        $newSle->quantity_change = $allocateQty;
                        $newSle->change_in_stock_value = $rate * $allocateQty;
                        $newSle->valuation_rate = $rate;
                        $newSle->balance_stock_value = $this->calculateFIFOBalance($newSle);
                        $newSle->is_valuated = true;
                        $newSle->save();

                        // Kurangi SLE lama
                        $sle->quantity_change -= $allocateQty;
                        $sle->save();
                    } else {
                        // SLE utuh di-update
                        $sle->update([
                            'change_in_stock_value' => $rate * $allocateQty,
                            'valuation_rate' => $rate,
                            'balance_stock_value' => $this->calculateFIFOBalance($sle),
                            'is_valuated' => true,
                        ]);
                    }

                    $remainingQty -= $allocateQty;
                    $totalSRNB += $rate * $allocateQty;
                }

                // Jika masih ada qty invoice yang belum teralokasi (over-bill) → buat SLE baru
                if ($remainingQty > 0) {
                    $newSle = StockLedgerEntry::create([
                        // ... attributes untuk qty tanpa valuasi (pending)
                        'change_in_stock_value' => 0,
                        'is_valuated' => false,
                    ]);
                }
            }

            // === GL: Debit Stock Asset / Credit SRNB (hanya jika ALUR-1) ===
            if ($totalSRNB > 0) {
                $this->createStockGL($purchaseInvoice, $totalSRNB, $isReturn);
            }
        }

        // === GL: Debit SRNB / Credit AP (selalu, untuk kedua alur) ===
        $this->createAPGL($purchaseInvoice, $amount, $isReturn);

        // Update PO status
        $this->updatePOStatus($purchaseInvoice->purchaseOrder);
    });
}
```

> **Catatan**: `findInvoiceRate()` perlu implementasi yang robust. Jika ada multiple invoice per PO item, ambil rate dari invoice item terbaru. Jika tidak ada invoice sama sekali untuk PO item tersebut, fallback ke rate PO.

### PurchaseOrderService.syncItems() — Rekonsiliasi komprehensif

```php
public function syncItems(PurchaseOrder $purchaseOrder): array
{
    return DB::transaction(function () use ($purchaseOrder) {
        // Load source dokumen terapprove
        $receiptIds = ModelConnection::where('model_type', PurchaseOrder::class)
            ->where('model_id', $purchaseOrder->id)
            ->where('reference_type', PurchaseReceipt::class)
            ->get()->pluck('reference_id');

        $invoiceIds = ModelConnection::where('model_type', PurchaseOrder::class)
            ->where('model_id', $purchaseOrder->id)
            ->where('reference_type', PurchaseInvoice::class)
            ->get()->pluck('reference_id');

        $syncLog = [];
        $newItems = []; // kumpulan item baru hasil split

        foreach ($purchaseOrder->items as $poItem) {
            // === KUMPULKAN SOURCE ITEMS ===
            $invItems = PurchaseInvoiceItem::whereIn('purchase_invoice_id', $invoiceIds)
                ->where('purchase_order_item_id', $poItem->id)->get();
            $recItems = PurchaseReceiptItem::whereIn('purchase_receipt_id', $receiptIds)
                ->where('purchase_order_item_id', $poItem->id)->get();

            // === GROUP: [rate, tax_id, tax_rate, target_warehouse_id] ===
            $groups = collect();

            // Group dari invoice items
            foreach ($invItems as $ii) {
                $key = "{$ii->rate}|{$ii->tax_id}|{$ii->tax_rate}";
                $groups->put($key, [
                    'qty' => ($groups->get($key)['qty'] ?? 0) + $ii->quantity,
                    'rate' => $ii->rate,
                    'tax_id' => $ii->tax_id,
                    'tax_rate' => $ii->tax_rate,
                    'warehouse_id' => $poItem->target_warehouse_id, // fallback PO
                    'source_invoice_item_ids' => array_merge(
                        $groups->get($key)['source_invoice_item_ids'] ?? [], [$ii->id]
                    ),
                ]);
            }

            // Group dari receipt items (bedakan warehouse)
            foreach ($recItems as $ri) {
                $wh = $ri->target_warehouse_id ?? $poItem->target_warehouse_id;
                $key = "{$poItem->rate}|{$poItem->tax_id}|{$poItem->tax_rate}|{$wh}";
                $groups->put($key, [
                    'qty' => ($groups->get($key)['qty'] ?? 0) + $ri->quantity,
                    'rate' => $poItem->rate,
                    'tax_id' => $poItem->tax_id,
                    'tax_rate' => $poItem->tax_rate,
                    'warehouse_id' => $wh,
                    'source_receipt_item_ids' => array_merge(
                        $groups->get($key)['source_receipt_item_ids'] ?? [], [$ri->id]
                    ),
                ]);
            }

            if ($groups->isEmpty()) {
                continue; // tidak ada change
            }

            // === DECIDE: UPDATE or SPLIT? ===
            if ($groups->count() === 1) {
                // Hanya 1 group → UPDATE langsung
                $g = $groups->first();
                $poItem->update([
                    'rate' => $g['rate'],
                    'tax_id' => $g['tax_id'],
                    'tax_rate' => $g['tax_rate'],
                    'target_warehouse_id' => $g['warehouse_id'],
                    'basic_amount' => $g['rate'] * $poItem->quantity,
                    'tax_amount' => ($g['rate'] * $poItem->quantity) * ($g['tax_rate'] / 100),
                    'amount' => ($g['rate'] * $poItem->quantity) * (1 + $g['tax_rate'] / 100),
                ]);
                $newItems[] = $poItem;
                $syncLog[] = ['action' => 'update', 'po_item_id' => $poItem->id, 'group' => $g];
            } else {
                // >1 group → SPLIT: soft-delete old, create new items
                $parentId = $poItem->id;
                $poItem->delete(); // soft delete

                foreach ($groups as $g) {
                    $newItem = $poItem->replicate()->fill([
                        'quantity' => $g['qty'],
                        'rate' => $g['rate'],
                        'tax_id' => $g['tax_id'],
                        'tax_rate' => $g['tax_rate'],
                        'target_warehouse_id' => $g['warehouse_id'],
                        'received_quantity' => 0,
                        'billed_quantity' => 0,
                        'basic_amount' => $g['rate'] * $g['qty'],
                        'tax_amount' => ($g['rate'] * $g['qty']) * ($g['tax_rate'] / 100),
                        'amount' => ($g['rate'] * $g['qty']) * (1 + $g['tax_rate'] / 100),
                        'referenceable_type' => PurchaseOrder::class,
                        'referenceable_id' => $purchaseOrder->id,
                    ]);
                    $newItem->save();
                    $newItems[] = $newItem;

                    // === UPDATE REFERENCE dari Invoice/Receipt items ke PO item baru ===
                    if (isset($g['source_invoice_item_ids'])) {
                        PurchaseInvoiceItem::whereIn('id', $g['source_invoice_item_ids'])
                            ->update(['purchase_order_item_id' => $newItem->id]);
                    }
                    if (isset($g['source_receipt_item_ids'])) {
                        PurchaseReceiptItem::whereIn('id', $g['source_receipt_item_ids'])
                            ->update(['purchase_order_item_id' => $newItem->id]);
                    }

                    $syncLog[] = [
                        'action' => 'split', 
                        'original_po_item_id' => $parentId,
                        'new_po_item_id' => $newItem->id,
                        'group' => $g,
                        'updated_invoice_items' => $g['source_invoice_item_ids'] ?? [],
                        'updated_receipt_items' => $g['source_receipt_item_ids'] ?? [],
                    ];
                }
            }
        }

        // === RECALCULATE TOTAL & UPDATE STATUS ===
        $purchaseOrder->load('items');
        $totalBasic = $purchaseOrder->items->sum('basic_amount');
        $totalTax = $purchaseOrder->items->sum('tax_amount');
        $purchaseOrder->update([
            'amount' => Utils::countAmount($totalBasic, $totalTax,
                $purchaseOrder->discount_on, $purchaseOrder->discount_amount),
        ]);
        $this->updatePOStatus($purchaseOrder);

        // === AUDIT TRAIL ===
        ModelConnection::create([
            'model_type' => PurchaseOrder::class,
            'model_id' => $purchaseOrder->id,
            'reference_type' => 'sync',
            'reference_id' => (string) Str::ulid(),
            'data' => [
                'type' => 'items_sync',
                'timestamp' => now()->toISOString(),
                'splits' => $syncLog,
            ],
        ]);

        // Kembalikan diff untuk ditampilkan di FE
        return $syncLog;
    });
}
```

### PurchaseOrderService.markDone() — Validasi + Sync + Finalisasi

```php
public function markDone(PurchaseOrder $purchaseOrder): array
{
    return DB::transaction(function () use ($purchaseOrder) {
        // === VALIDASI: qty receipt = qty invoice per item ===
        $receiptIds = ModelConnection::where('model_type', PurchaseOrder::class)
            ->where('model_id', $purchaseOrder->id)
            ->where('reference_type', PurchaseReceipt::class)
            ->get()->pluck('reference_id');

        $invoiceIds = ModelConnection::where('model_type', PurchaseOrder::class)
            ->where('model_id', $purchaseOrder->id)
            ->where('reference_type', PurchaseInvoice::class)
            ->get()->pluck('reference_id');

        $mismatches = [];

        foreach ($purchaseOrder->items as $poItem) {
            $receivedQty = PurchaseReceiptItem::whereIn('purchase_receipt_id', $receiptIds)
                ->where('purchase_order_item_id', $poItem->id)
                ->sum('quantity');

            $billedQty = PurchaseInvoiceItem::whereIn('purchase_invoice_id', $invoiceIds)
                ->where('purchase_order_item_id', $poItem->id)
                ->sum('quantity');

            if ($receivedQty != $billedQty) {
                $mismatches[] = [
                    'item_name' => $poItem->item_name,
                    'received_qty' => $receivedQty,
                    'billed_qty' => $billedQty,
                ];
            }
        }

        if (!empty($mismatches)) {
            throw new \Exception(json_encode([
                'success' => false,
                'message' => 'Qty receipt dan invoice tidak sama untuk beberapa item',
                'mismatches' => $mismatches,
            ]));
        }

        $syncLog = $this->syncItems($purchaseOrder);

        $purchaseOrder->update(['status' => [FormStatus::COMPLETED]]);

        ModelConnection::create([
            'model_type' => PurchaseOrder::class,
            'model_id' => $purchaseOrder->id,
            'reference_type' => 'mark_done',
            'reference_id' => (string) Str::ulid(),
            'data' => [
                'type' => 'mark_done',
                'timestamp' => now()->toISOString(),
                'sync_log' => $syncLog,
            ],
        ]);

        return ['success' => true, 'message' => 'PO selesai', 'sync_log' => $syncLog];
    });
}
```

## 7. Keputusan Desain Final

| #   | Issue                                      | Keputusan                                                                                                                                  |
| --- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Mapping SLE ke receipt item                | Cari via referenceable (morph ke PurchaseReceipt) — tanpa field baru di SLE                                                               |
| 2   | Multiple invoice rate berbeda              | **Pecah SLE** — qty dialokasikan ke invoice tertua dulu (FIFO by date)                                                                    |
| 3   | Sisa qty over (tidak ter-cover invoice)    | Valuasi pakai **rate PO**                                                                                                                  |
| 4   | Status PO over-receipt/bill               | Tambah status: `OVER_RECEIVED`, `OVER_BILLED`                                                                                             |
| 5   | Koreksi `stock_queue` saat Invoice approve | Lookup by `sle_id` di queue entry (bukan heuristik by rate) — presisi, tidak false-positive jika ada 2 batch rate sama                    |
| 6   | FK InvoiceItem/ReceiptItem setelah sync    | **Tidak diubah** — tetap ke PO item lama (soft-deleted); item baru simpan `parent_item_id`; qty dihitung dari `source_*_item_ids` per group |
| 7   | Migration strategy                         | Gabung ke `create_*` (bukan `add_*` terpisah) — sistem belum production, akan `migrate:fresh`                                             |

## 8. Risiko & Mitigasi

| Risiko | Mitigasi |
|---|---|
| Negative quantity di stock queue | FIFO sudah handle negative quantity untuk return |
| Sync race condition | DB transaction + lockForUpdate |
| **Sync mengubah rate/pecah item** — GL sudah final berdasarkan rate approval lama | GL tetap pakai rate saat approval; split hanya untuk future accounting, tidak retroaktif |
| **Multiple source conflict** | Split items per group [rate, tax, warehouse]; setiap group jadi PO item terpisah |
| **Soft-delete PO item saat split** — item baru perlu tahu asal-usulnya | Item baru menyimpan `parent_item_id` → id item lama; FK di InvoiceItems/ReceiptItems TIDAK diubah; qty dihitung proporsional dari `source_*_item_ids` per group |
| **Warehouse mismatch** | Receipt dengan warehouse berbeda → group terpisah → split PO item ke warehouse masing-masing |
| **Tax rate mismatch** | Invoice dengan tax berbeda → group terpisah → split PO item |

### Frontend Sync Modal Flow

1. **Tombol Sync** muncul jika:
   - `received_quantity` di PO ≠ SUM qty di PurchaseReceiptItem
   - `billed_quantity` di PO ≠ SUM qty di PurchaseInvoiceItem
   - Ada receipt/invoice dengan rate berbeda dari PO
   - Ada tax/warehouse mismatch

2. **Modal Sync** menampilkan:
   - **Items table** dengan kolom:
     - Item | Qty PO | Qty Received (current) | Qty Received (after) | Δ
     - Rate PO | Rate Invoice Avg | Rate After Sync | Δ
     - Tax/warehouse diff
   - **Summary card**: Berapa items akan diupdate, berapa akan over/under
   - **Confirm button**: "Sync Items" (proceed), "Cancel"

3. **On confirm** → POST `/purchase-orders/{id}/sync-items`
   - Show loading spinner
   - On success: reload page dengan toast success
   - On error: show error details
