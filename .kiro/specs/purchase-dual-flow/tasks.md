# Tasks: Purchase Dual Flow

## T01: Migration — Field Baru Database

- [x] 1. Buat migration `add_is_valuated_to_stock_ledger_entries`: tambah `is_valuated` boolean default false di StockLedgerEntry
- [x] 2. Buat migration `add_allocated_qty_to_purchase_invoice_items`: tambah `allocated_qty` decimal 16,2 default 0 di PurchaseInvoiceItem
- [x] 3. Buat migration `add_completed_status_to_purchase_orders`: update CAST/status field untuk dukung COMPLETED, OVER_RECEIVED, OVER_BILLED
- [x] 4. Update model casts dan computed attributes untuk field baru
- [x] 56. Buat migration `add_parent_item_id_to_purchase_order_items`: tambah `parent_item_id` nullable ULID FK self-referencing ke `purchase_order_items.id`, `nullOnDelete()`
- [x] 57. Update model `PurchaseOrderItem`: tambah relasi `parentItem()` (belongsTo self) dan `childItems()` (hasMany self)

## T02: PurchaseReceiptService — onApproved Dual Flow

- [x] 5. `onApproved()`: deteksi alur (cek `billed_quantity > 0` untuk ALUR-2)
- [x] 6. ALUR-1: buat SLE dengan `is_valuated=false`, `change_in_stock_value=0`, jangan buat GL
- [x] 7. ALUR-2: cari InvoiceItems terkait per PO item, alokasi qty ke invoice tertua dulu (FIFO)
- [x] 8. ALUR-2: buat SLE split per rate invoice, `is_valuated=true`
- [x] 9. ALUR-2: buat GL (Debit Stock Asset / Credit SRNB) dengan rate invoice
- [x] 10. ALUR-2: update `allocated_qty` di InvoiceItem yang sudah dipakai
- [x] 11. Over-receipt (sisa qty tanpa invoice): SLE qty-only, `is_valuated=false`
- [x] 12. Update `received_quantity` di PO item setelah proses
- [x] 13. Update status PO

## T03: PurchaseInvoiceService — onApproved Update SLE

- [x] 14. `onApproved()`: deteksi alur (cek `received_quantity > 0` untuk ALUR-1)
- [x] 15. ALUR-1: cari SLE pending (`is_valuated=false`) via referenceable ke PurchaseReceipt
- [x] 16. ALUR-1: split SLE per rate invoice — copy sebagian, update sebagian
- [x] 17. ALUR-1: update `change_in_stock_value`, `valuation_rate`, `balance_stock_value`, `is_valuated=true`
- [x] 18. ALUR-1: buat GL Stock Asset / SRNB
- [x] 19. Over-bill (qty invoice > pending SLE): buat SLE baru `is_valuated=false`
- [x] 20. GL SRNB / AP tetap dibuat (untuk kedua alur)

## T04: PurchaseOrderService — Sync Items

- [x] 21. Method `syncItems()`: kumpulkan semua InvoiceItems & ReceiptItems via ModelConnection
- [x] 22. Grouping per `[rate, tax_id, tax_rate, target_warehouse_id]`
- [x] 23. Jika 1 group → update PO item biasa
- [x] 24. Jika >1 group → soft-delete PO item lama, create N item baru
- [x] 25. **Update reference**: InvoiceItems & ReceiptItems `purchase_order_item_id` → PO item baru
- [x] 26. Rekalkulasi total amount PO header
- [x] 27. Update status PO (termasuk OVER_RECEIVED/OVER_BILLED)
- [x] 28. Buat ModelConnection audit trail

## T05: PurchaseOrderService — Mark Done

- [x] 29. Method `markDone()`: validasi `received_qty == billed_qty` per item
- [x] 30. Jika mismatch → throw ValidationException dengan detail mismatches
- [x] 31. Jika semua match → panggil `syncItems()`, update status COMPLETED
- [x] 32. Buat ModelConnection audit trail `{type: "mark_done"}`

## T06: Controller & Routes

- [x] 33. `PurchaseOrderController`: action `syncItems(PurchaseOrder)` → return syncLog
- [x] 34. `PurchaseOrderController`: action `markDone(PurchaseOrder)` → return success/mismatch
- [x] 35. Route `POST purchase-orders/{id}/sync-items`
- [x] 36. Route `POST purchase-orders/{id}/mark-done`

## T07: Frontend — PurchaseOrder Show

- [x] 37. Tambah kolom tracking qty: Qty PO | Received | Billed | Δ Receipt | Δ Bill
- [x] 38. Indikator visual over/under (hijau/merah) + chip status per item
- [x] 39. Tombol **Sync Items** — muncul jika ada mismatch qty/rate/tax/warehouse
- [x] 40. Modal Sync — preview diff before/after items split, konfirmasi
- [x] 41. Tombol **Mark Done** — trigger validasi receipt==invoice
- [x] 42. Toast warning jika Mark Done gagal — tampilkan daftar mismatches
- [x] 43. Toast success jika Sync/Mark Done berhasil — reload halaman

## T08: Frontend — PurchaseReceipt Form

- [x] 44. Pastikan form create/edit PurchaseReceipt **tidak ada** field rate/harga
- [x] 45. Tampilkan rate dari PO sebagai info read-only jika diperlukan

## T09: Testing

- [x] 46. Unit test ALUR-1: receipt approve → SLE pending (`is_valuated=false`), no GL
- [x] 47. Unit test ALUR-1: invoice approve → SLE updated (`is_valuated=true`), GL Stock+SRNB+AP
- [x] 48. Unit test ALUR-2: invoice approve → GL SRNB+AP, no SLE
- [x] 49. Unit test ALUR-2: receipt approve → SLE+GL Stock/SRNB dengan rate invoice
- [x] 50. Unit test: multi invoice rate berbeda → SLE split sesuai rate
- [x] 51. Unit test: sync items → split PO items per group [rate, tax, warehouse]
- [x] 52. Unit test: sync → FK InvoiceItems/ReceiptItems TIDAK berubah, item baru simpan `parent_item_id`
- [x] 53. Unit test: mark done success → status COMPLETED
- [x] 54. Unit test: mark done qty mismatch → ValidationException + detail mismatches
- [x] 55. Unit test: over-receipt/over-bill → status OVER_RECEIVED/OVER_BILLED

## T10: stock_queue Enrichment

- [x] 58. `PurchaseReceiptService.onApproved()`: setiap queue entry tambah `sle_id`, `is_valuated`, `receipt_item_id` — pakai pola 4-langkah (push null → update Stock → buat SLE → patch sle_id)
- [x] 59. `PurchaseInvoiceService.updatePendingSLEs()`: koreksi queue via lookup `sle_id` (bukan heuristik by rate) → update `rate` + `is_valuated=true` pada entry yang tepat
- [x] 60. `PurchaseInvoiceService`: tambah update `stock_queue` di Stock saat valuasi ALUR-1 — sebelumnya tidak ada update sama sekali
