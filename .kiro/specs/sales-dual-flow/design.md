# Design: Sales Dual Flow

## 1. Ringkasan

Module Sales saat ini mendukung satu alur utama: **SalesOrder → DeliveryNote → SalesInvoice**.
Requirement baru: **ALUR-2: SO → SalesInvoice → DeliveryNote**, di mana Invoice bisa dibuat lebih dulu.

Kedua alur harus bisa hidup berdampingan. DeliveryNote dan SalesInvoice bisa dibuat >1 per SO.
Over/under deliver/bill diizinkan — ada tombol Sync untuk rekonsiliasi dan tombol Mark Done untuk finalisasi.

**Yang DIPERTAHANKAN:** Pencatatan SLE & GL pada `DeliveryNoteService.onApproved()` (FIFO COGS) dan `SalesInvoiceService.onApproved()` (AR/income) **tidak diubah**. Fitur baru murni layer administratif dual-flow.

## 2. Status Saat Ini

| Komponen                              | Status                                                          |
| ------------------------------------- | --------------------------------------------------------------- |
| `SalesOrder` + Items                  | ✅ Lengkap (field: delivered/billed qty sudah ada)             |
| `DeliveryNote` + Items                | ✅ Lengkap, ada `valuation_rates` untuk FIFO cost              |
| `DeliveryNoteService.onApproved()`    | ✅ **TIDAK DIUBAH** — SLE FIFO (`is_valuated`/valuasi final) + GL COGS |
| `SalesInvoice` + Items (Finances)     | ✅ Lengkap, ada rate/basic_amount/tax                          |
| `SalesInvoiceService.onApproved()`    | ✅ **TIDAK DIUBAH** — GL Receivable→Income + update billed_qty; tidak menyentuh SLE |
| `ModelConnection`                     | ✅ utk koneksi SO→DeliveryNote, SO→SalesInvoice                |
| `SalesOrderService` (sync/mark done)  | ❌ Belum ada — perlu `syncItems()`, `markDone()`, `updateSalesOrderStatus()` |
| Sync over/under deliver/bill          | ❌ Belum ada                                                    |
| GeneralLedger                         | ✅ Double-entry, polymorphic referenceable                      |
| StockLedgerEntry                      | ✅ Polymorphic, FIFO queue, `is_valuated`                       |

## 3. Prinsip Desain

1. **No breaking changes** — alur lama tetap berjalan
2. **Konsisten pattern Submitable** — `onApproved()` titik utama
3. **SLE/GL existing dipertahankan** — DeliveryNote tetap sumber cost (FIFO), Invoice tetap soal AR/income
4. **Invoice tidak menyentuh SLE** — beda dari Purchase; cost sudah final di Delivery
5. **Flexible qty** — mismatch deliver/bill diizinkan
6. **Sync manual** — tombol action di halaman show SO

## 4. Arsitektur

### 4a. Alur Accounting

**Poin kunci dari user:**

- **ALUR-1** (SO→DeliveryNote→SalesInvoice): SLE + GL COGS dibuat saat DeliveryNote approve (existing). GL AR/income dibuat saat SalesInvoice approve (existing).
- **ALUR-2** (SO→SalesInvoice→DeliveryNote): GL AR/income dibuat saat SalesInvoice approve (existing). SLE + GL COGS dibuat saat DeliveryNote approve (existing).
- **Di kedua alur, mekanisme SLE/GL existing TIDAK berubah.** Yang ditambah hanya tracking qty & status dua dimensi.

```
ALUR-1: SO → DeliveryNote → SalesInvoice

  [1] DeliveryNote approve:  (existing, TIDAK diubah)
      • update delivered_quantity (+) di SO item
      • FIFO picking → simpan valuation_rates di DeliveryNoteItem
      • Buat SLE: qty_change = -qty, is_valuated = true, change_in_stock_value = -amountPicked
      • Buat GL:  Credit Stock Asset / Debit COGS  (amountPicked)

  [2] SalesInvoice approve:  (existing, TIDAK diubah)
      • update billed_quantity (+) di SO item
      • Buat GL:  Debit Receivable (debit_account) / Credit Income (income_account)
      • TIDAK menyentuh SLE


ALUR-2: SO → SalesInvoice → DeliveryNote

  [1] SalesInvoice approve:  (existing, TIDAK diubah)
      • update billed_quantity (+) di SO item
      • Buat GL:  Debit Receivable / Credit Income
      • TIDAK membuat SLE (barang belum keluar)

  [2] DeliveryNote approve:  (existing, TIDAK diubah)
      • update delivered_quantity (+) di SO item
      • FIFO picking → SLE is_valuated = true + GL COGS
```

> **Catatan**: Tidak ada fase "pending SLE" dan tidak ada valuasi ulang dari sisi Invoice. Inilah perbedaan fundamental dengan Purchase Dual Flow.

### 4b. Deteksi Alur — Logika di Service

Tidak perlu branching valuasi (seperti Purchase). Service existing (`DeliveryNoteService`, `SalesInvoiceService`) sudah meng-increment `delivered_quantity`/`billed_quantity` di SO item. Yang ditambahkan: panggilan `SalesOrderService.updateSalesOrderStatus()` setelah qty terupdate, agar status dua dimensi (deliver & bill) tersinkron.

```
DeliveryNoteService.onApproved():  (existing + 1 baris tambahan opsional)
    ... logika SLE/GL existing TIDAK diubah ...
    increment delivered_quantity (existing)
    → updateSalesOrderStatus(salesOrder)   // sinkron status deliver dim

SalesInvoiceService.onApproved():  (existing + 1 baris tambahan opsional)
    ... logika GL AR/income existing TIDAK diubah ...
    increment billed_quantity (existing)
    → updateSalesOrderStatus(salesOrder)   // sinkron status bill dim
```

> Jika status sudah disinkron di service existing, langkah ini hanya memastikan dimensi `OVER_DELIVERED`/`OVER_BILLED` ikut diperhitungkan.

### 4c. Tracking Quantity — Over/Under

**SalesOrderItem** (existing):

- `quantity` — qty SO asli
- `delivered_quantity` — sum dari semua delivery note items
- `billed_quantity` — sum dari semua sales invoice items
- `undelivered_quantity` = quantity - delivered_quantity (computed, stored)
- `unbilled_quantity` = quantity - billed_quantity (computed, stored)

**Field baru:** `parent_item_id` (nullable ULID FK self-referencing ke `sales_order_items.id`, `nullOnDelete()`) — audit trail parent-child setelah sync split.

**Aturan**: Boleh mismatch. Over/under deliver/bill bukan error — indikator visual saja.

### 4d. Sync SO Items — Split per Source (Tombol Manual)

**Prinsip**: Saat sync, SO items **dipecah (split)** sesuai data dari tiap source dokumen (Invoice/Delivery) yang memiliki perbedaan.

**Contoh:**
```
SO Item #1: Item A, qty=50, price=5000

  Invoice #1: Item A qty=30 price=4500
  Invoice #2: Item A qty=20 price=6500

  → Setelah sync, SO Item #1 dipecah:
    SO Item #1.1: Item A, qty=30, price=4500  (dari Invoice #1)
    SO Item #1.2: Item A, qty=20, price=6500  (dari Invoice #2)
```

**Skenario Split:**
1. **Rate/price berbeda** antara Invoice → split per batch rate
2. **Tax berbeda** antara Invoice → split per batch tax
3. **Warehouse berbeda** antara Delivery → split per `source_warehouse_id`
4. **Qty over** → qty sisa yang tidak ter-cover source jadi item terpisah dengan price SO

**Prinsip FK tidak berubah:**
- Setelah split, `SalesInvoiceItem` (`sales_order_item_id`) dan `DeliveryNoteItem` (referenceable ke SalesOrderItem) **tetap** reference ke SO item lama (yang sudah di-soft-delete)
- Item SO baru menyimpan `parent_item_id` → id SO item asli
- `delivered_quantity` dan `billed_quantity` per item baru dihitung dari `source_delivery_item_ids` / `source_invoice_item_ids` masing-masing group

**SalesOrderService.syncItems():**

```
1. Kumpulkan semua DeliveryNote terkait (via ModelConnection)
2. Kumpulkan semua SalesInvoice terkait (via ModelConnection)
3. Untuk setiap SO Item:
   a. Kumpulkan source items (SalesInvoiceItems + DeliveryNoteItems)
      - Group by [rate/price, tax_id, tax_rate, source_warehouse_id]
      - Setiap group: {qty, rate, tax_id, tax_rate, warehouse_id,
                       source_invoice_item_ids[], source_delivery_item_ids[]}
   b. Jika 1 group → update SO item biasa (rate/tax/warehouse sesuai group)
   c. Jika >1 group → PECAH SO ITEM:
      - Soft-delete SO item lama
      - Buat N SO item baru:
        * qty = sum qty dari source items di group
        * price/tax/warehouse = dari group
        * parent_item_id = id SO item lama
        * delivered_quantity = SUM qty dari source_delivery_item_ids
        * billed_quantity = SUM qty dari source_invoice_item_ids
      - FK di InvoiceItems & DeliveryItems TIDAK diubah
4. Hitung ulang amount per item & total SO header
5. updateSalesOrderStatus(SO)  (termasuk OVER_DELIVERED / OVER_BILLED)
6. ModelConnection audit trail {type:"items_sync", splits:[...]}
```

**Trigger**: Tombol "Sync Items" di halaman Show SalesOrder.

**Syarat muncul tombol:**
- Ada mismatch calculated vs actual qty
- ATAU ada invoice/delivery dengan rate/tax/warehouse berbeda dari SO

> **Note**: Split bersifat **destruktif** — SO item lama di-soft-delete, diganti item baru. Pastikan ada konfirmasi user. Sync tetap manual.

### 4e. Mark Done — Finalisasi SO

**Tombol "Mark Done"** di halaman Show SO. Fungsinya: validasi delivery==invoice + sync + update status COMPLETED.

**Logika:**
```
markDone(SalesOrder):

1. Kumpulkan semua DeliveryNote & SalesInvoice terkait
2. Untuk setiap SalesOrderItem:
   - total_delivered_qty = SUM qty dari DeliveryNoteItem
   - total_billed_qty = SUM qty dari SalesInvoiceItem
   - Jika total_delivered_qty ≠ total_billed_qty → VALIDASI GAGAL
     → kumpulkan ke mismatches[]
3. Jika mismatches tidak kosong → throw ValidationException(['mismatches' => ...])
4. VALIDASI LULUS → jalankan syncItems()
5. Update status SO: ganti [TO_DELIVER, PARTIALLY_DELIVERED, DELIVERED,
   OVER_DELIVERED, TO_BILL, PARTIALLY_BILLED, BILLED, OVER_BILLED] → COMPLETED
6. ModelConnection log {type:"mark_done"}
```

**Response jika gagal (ValidationException `mismatches`):**
```json
{
  "mismatches": [
    { "item_name": "Item A", "delivered_qty": 55, "billed_qty": 30 },
    { "item_name": "Item B", "delivered_qty": 10, "billed_qty": 10 }
  ]
}
```

**Validasi khusus (edge case):**
- Item A delivery=55, invoice=30 → ❌ gagal (tidak match)
- Item A delivery=55, invoice=55 → ✅ sukses
- Over-deliver (delivery=55, SO qty=50): wajib ada invoice dengan qty yg sama (55)
- Over-bill (invoice=60, SO qty=50): wajib ada delivery dengan qty yg sama (60)
- Under (delivery=30, invoice=30): ✅ valid, status tetap COMPLETED

### 4f. updateSalesOrderStatus() — Dua Dimensi Independen

Status disimpan sebagai array JSON (Submitable). Update dimensi deliver & bill secara independen via `Utils::replaceStatus()`.

```
updateSalesOrderStatus(SalesOrder):
  totalQty       = SUM item.quantity
  totalDelivered = SUM item.delivered_quantity
  totalBilled    = SUM item.billed_quantity

  // Dimensi DELIVER
  if totalDelivered == 0:            status → TO_DELIVER
  elif totalDelivered > totalQty:    status → OVER_DELIVERED
  elif totalDelivered < totalQty:    status → PARTIALLY_DELIVERED
  else:                              status → DELIVERED

  // Dimensi BILL (pola sama)
  if totalBilled == 0:               status → TO_BILL
  elif totalBilled > totalQty:       status → OVER_BILLED
  elif totalBilled < totalQty:       status → PARTIALLY_BILLED
  else:                              status → BILLED
```

## 5. Perubahan File

### Migration

Field baru digabung langsung ke migration `create_*` (tidak ada `add_*` terpisah) — sistem belum production, akan `migrate:fresh`.

| Tabel (migration create)              | Field yang ditambah                                                                                              |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `create_sales_order_items_table`      | `parent_item_id` nullable ULID FK self-referencing + `nullOnDelete()` — audit trail parent-child setelah sync split |

### Enum

| File               | Perubahan                                              |
| ------------------ | ------------------------------------------------------ |
| `app/FormStatus.php` | Tambah case `OVER_DELIVERED = 'over_delivered'` (enum-only, bukan migration) |

### Backend Services

| File                                              | Perubahan                                                                                                       |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `app/Services/Sales/SalesOrderService.php`        | Method baru `syncItems()` (split per group source), `markDone()` (validasi + sync + COMPLETED), `updateSalesOrderStatus()` (deliver & bill dim) |
| `app/Models/Sales/SalesOrderItem.php`             | Tambah relasi `parentItem()` (belongsTo self) dan `childItems()` (hasMany self)                                |

### Controllers & Routes

| File                                               | Perubahan                                   |
| -------------------------------------------------- | ------------------------------------------- |
| `app/Http/Controllers/Sales/SalesOrderController.php` | Action baru `syncItems(SalesOrder)`, `markDone(SalesOrder)` |
| `routes/web.php`                                   | Route baru `POST sales-orders/{id}/sync-items`, `POST sales-orders/{id}/mark-done` |

### Frontend

| File                                              | Perubahan                                                       |
| ------------------------------------------------- | --------------------------------------------------------------- |
| `resources/js/Pages/Sales/SalesOrders/Show.jsx`   | Tambah kolom tracking qty (Qty SO \| Delivered \| Billed \| Δ Deliver \| Δ Bill) + indikator over/under + chip status + tombol Sync Items & Mark Done + modal konfirmasi dengan tabel mismatch |

### Tidak berubah (DIPERTAHANKAN)

- `DeliveryNoteService.onApproved()` — SLE FIFO + GL COGS **tidak diubah**
- `SalesInvoiceService.onApproved()` — GL AR/income **tidak diubah**, tidak menyentuh SLE
- `SalesInvoice` + `SalesInvoiceItem` — **tidak ditambah** `allocated_qty`
- `StockLedgerEntry` — tidak ditambah/diubah field (DeliveryNote SLE sudah `is_valuated=true`)
- `stocks.stock_queue` — tidak ada koreksi dari sisi Sales Invoice
- GeneralLedger model tidak berubah

## 6. Detail Service Logic

### SalesOrderService.syncItems() — Rekonsiliasi

```php
public function syncItems(SalesOrder $salesOrder): array
{
    return DB::transaction(function () use ($salesOrder) {
        $salesOrder->loadMissing('items');

        $deliveryIds = ModelConnection::where('model_type', SalesOrder::class)
            ->where('model_id', $salesOrder->id)
            ->where('reference_type', DeliveryNote::class)
            ->pluck('reference_id');

        $invoiceIds = ModelConnection::where('model_type', SalesOrder::class)
            ->where('model_id', $salesOrder->id)
            ->where('reference_type', SalesInvoice::class)
            ->pluck('reference_id');

        $syncLog = [];

        foreach ($salesOrder->items as $soItem) {
            $invItems = SalesInvoiceItem::whereIn('sales_invoice_id', $invoiceIds)
                ->where('sales_order_item_id', $soItem->id)->get();

            // DeliveryNoteItem referenceable → SalesOrderItem
            $delItems = DeliveryNoteItem::whereIn('delivery_note_id', $deliveryIds)
                ->where('referenceable_type', SalesOrderItem::class)
                ->where('referenceable_id', $soItem->id)->get();

            if ($invItems->isEmpty() && $delItems->isEmpty()) {
                continue;
            }

            // Group: key = "price|tax_id|tax_rate|warehouse_id"
            $groups = collect();

            foreach ($invItems as $ii) {
                $key      = "{$ii->price}|{$ii->tax_id}|{$ii->tax_rate}|{$soItem->source_warehouse_id}";
                $existing = $groups->get($key, [
                    'qty' => 0, 'price' => $ii->price, 'tax_id' => $ii->tax_id,
                    'tax_rate' => $ii->tax_rate, 'warehouse_id' => $soItem->source_warehouse_id,
                    'source_invoice_item_ids' => [], 'source_delivery_item_ids' => [],
                ]);
                $existing['qty'] += $ii->quantity;
                $existing['source_invoice_item_ids'][] = $ii->id;
                $groups->put($key, $existing);
            }

            foreach ($delItems as $di) {
                $wh  = $di->source_warehouse_id ?? $soItem->source_warehouse_id;
                $key = "{$soItem->price}|{$soItem->tax_id}|{$soItem->tax_rate}|{$wh}";
                $existing = $groups->get($key, [
                    'qty' => 0, 'price' => $soItem->price, 'tax_id' => $soItem->tax_id,
                    'tax_rate' => $soItem->tax_rate, 'warehouse_id' => $wh,
                    'source_invoice_item_ids' => [], 'source_delivery_item_ids' => [],
                ]);
                $existing['qty'] += $di->quantity;
                $existing['source_delivery_item_ids'][] = $di->id;
                $groups->put($key, $existing);
            }

            if ($groups->count() === 1) {
                $g = $groups->first();
                $soItem->update([
                    'price' => $g['price'], 'tax_id' => $g['tax_id'],
                    'tax_rate' => $g['tax_rate'], 'source_warehouse_id' => $g['warehouse_id'],
                ]);
                $syncLog[] = ['action' => 'update', 'so_item_id' => $soItem->id, 'price' => $g['price']];
            } else {
                $parentId = $soItem->id;
                $soItem->delete(); // soft delete

                foreach ($groups as $g) {
                    $newItem = $soItem->replicate()->fill([
                        'quantity' => $g['qty'], 'price' => $g['price'],
                        'tax_id' => $g['tax_id'], 'tax_rate' => $g['tax_rate'],
                        'source_warehouse_id' => $g['warehouse_id'],
                        'delivered_quantity' => 0, 'billed_quantity' => 0,
                        'parent_item_id' => $parentId,
                    ]);
                    $newItem->id = (string) Str::ulid();
                    $newItem->save();

                    $newDelivered = empty($g['source_delivery_item_ids']) ? 0
                        : DeliveryNoteItem::whereIn('id', $g['source_delivery_item_ids'])->sum('quantity');
                    $newBilled = empty($g['source_invoice_item_ids']) ? 0
                        : SalesInvoiceItem::whereIn('id', $g['source_invoice_item_ids'])->sum('quantity');
                    $newItem->update([
                        'delivered_quantity' => $newDelivered,
                        'billed_quantity'    => $newBilled,
                    ]);

                    $syncLog[] = [
                        'action' => 'split', 'original_so_item_id' => $parentId,
                        'new_so_item_id' => $newItem->id, 'price' => $g['price'], 'qty' => $g['qty'],
                    ];
                }
            }
        }

        // Rekalkulasi total SO
        $salesOrder->load('items');
        $basicAmount = $salesOrder->items->sum('basic_amount');
        $taxAmount   = $salesOrder->items->sum('tax_amount');
        $salesOrder->update([
            'amount' => Utils::countAmount($basicAmount, $taxAmount,
                $salesOrder->discount_on, $salesOrder->discount_amount),
        ]);

        $this->updateSalesOrderStatus($salesOrder);

        ModelConnection::create([
            'model_type' => SalesOrder::class, 'model_id' => $salesOrder->id,
            'reference_type' => 'sync', 'reference_id' => (string) Str::ulid(),
            'data' => ['type' => 'items_sync', 'timestamp' => now()->toISOString(), 'splits' => $syncLog],
        ]);

        return $syncLog;
    });
}
```

### SalesOrderService.markDone() — Validasi + Sync + Finalisasi

```php
public function markDone(SalesOrder $salesOrder): array
{
    return DB::transaction(function () use ($salesOrder) {
        $salesOrder->items()->lockForUpdate()->get();

        $deliveryIds = ModelConnection::where('model_type', SalesOrder::class)
            ->where('model_id', $salesOrder->id)
            ->where('reference_type', DeliveryNote::class)->pluck('reference_id');
        $invoiceIds = ModelConnection::where('model_type', SalesOrder::class)
            ->where('model_id', $salesOrder->id)
            ->where('reference_type', SalesInvoice::class)->pluck('reference_id');

        $mismatches = [];
        foreach ($salesOrder->items as $soItem) {
            $deliveredQty = DeliveryNoteItem::whereIn('delivery_note_id', $deliveryIds)
                ->where('referenceable_type', SalesOrderItem::class)
                ->where('referenceable_id', $soItem->id)->sum('quantity');
            $billedQty = SalesInvoiceItem::whereIn('sales_invoice_id', $invoiceIds)
                ->where('sales_order_item_id', $soItem->id)->sum('quantity');

            if ((float) $deliveredQty !== (float) $billedQty) {
                $mismatches[] = [
                    'item_name'     => $soItem->item?->name,
                    'delivered_qty' => $deliveredQty,
                    'billed_qty'    => $billedQty,
                ];
            }
        }

        if (! empty($mismatches)) {
            throw ValidationException::withMessages(['mismatches' => $mismatches]);
        }

        $syncLog = $this->syncItems($salesOrder);

        $salesOrder->update([
            'status' => Utils::replaceStatus($salesOrder->status, [
                FormStatus::TO_DELIVER, FormStatus::PARTIALLY_DELIVERED, FormStatus::DELIVERED, FormStatus::OVER_DELIVERED,
                FormStatus::TO_BILL, FormStatus::PARTIALLY_BILLED, FormStatus::BILLED, FormStatus::OVER_BILLED,
            ], FormStatus::COMPLETED),
        ]);

        ModelConnection::create([
            'model_type' => SalesOrder::class, 'model_id' => $salesOrder->id,
            'reference_type' => 'mark_done', 'reference_id' => (string) Str::ulid(),
            'data' => ['type' => 'mark_done', 'timestamp' => now()->toISOString(), 'sync_log' => $syncLog],
        ]);

        return ['success' => true, 'sync_log' => $syncLog];
    });
}
```

## 7. Keputusan Desain Final

| #   | Issue                                     | Keputusan                                                                                                       |
| --- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 1   | SLE saat SalesInvoice approve             | **Tidak menyentuh SLE** — cost sudah final di DeliveryNote (FIFO). Beda dari Purchase.                          |
| 2   | `is_valuated` di DeliveryNote SLE         | Selalu `true` sejak dibuat — tidak ada fase pending. SLE existing tidak diubah.                                |
| 3   | `allocated_qty` di SalesInvoiceItem       | **Tidak ditambah** — tidak relevan karena Invoice tak memvaluasi SLE.                                          |
| 4   | Status SO over-deliver/bill               | Tambah `OVER_DELIVERED` ke `FormStatus` enum; `OVER_BILLED` sudah ada.                                         |
| 5   | Validasi Mark Done                        | `delivered_quantity === billed_quantity` per item; mismatch → `ValidationException(['mismatches'])`           |
| 6   | FK InvoiceItem/DeliveryItem setelah sync  | **Tidak diubah** — tetap ke SO item lama (soft-deleted); item baru simpan `parent_item_id`; qty dihitung dari `source_*_item_ids` per group |
| 7   | Migration strategy                        | Gabung `parent_item_id` ke `create_sales_order_items_table` (bukan `add_*`); status baru enum-only            |
| 8   | Workflow spec                             | design-first (mirror purchase-dual-flow)                                                                       |

## 8. Risiko & Mitigasi

| Risiko | Mitigasi |
|---|---|
| Sync race condition | DB transaction + lockForUpdate |
| **Sync mengubah price/pecah item** — GL sudah final berdasarkan dokumen lama | GL & SLE tetap pakai nilai saat approval; split hanya untuk administrasi SO, tidak retroaktif ke GL/SLE |
| **Multiple source conflict** | Split items per group [price, tax, warehouse]; setiap group jadi SO item terpisah |
| **Soft-delete SO item saat split** — item baru perlu tahu asal-usulnya | Item baru menyimpan `parent_item_id` → id item lama; FK di Invoice/Delivery items TIDAK diubah; qty dihitung dari `source_*_item_ids` per group |
| **Warehouse mismatch** | Delivery dengan `source_warehouse_id` berbeda → group terpisah → split SO item |
| **Tax/price mismatch** | Invoice dengan tax/price berbeda → group terpisah → split SO item |
| **Tidak sengaja menyentuh SLE/GL existing** | Constraint eksplisit: DeliveryNoteService & SalesInvoiceService `onApproved()` TIDAK diubah; hanya tambah panggilan `updateSalesOrderStatus()` jika perlu |
