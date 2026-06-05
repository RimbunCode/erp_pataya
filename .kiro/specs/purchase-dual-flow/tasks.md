# Tasks: Purchase Dual Flow

## T01: Migration — Field Baru Database

- [ ] 1. Buat migration `add_is_valuated_to_stock_ledger_entries`: tambah `is_valuated` boolean default false di StockLedgerEntry
- [ ] 2. Buat migration `add_allocated_qty_to_purchase_invoice_items`: tambah `allocated_qty` decimal 16,2 default 0 di PurchaseInvoiceItem
- [ ] 3. Buat migration `add_completed_status_to_purchase_orders`: update CAST/status field untuk dukung COMPLETED, OVER_RECEIVED, OVER_BILLED
- [ ] 4. Update model casts dan computed attributes untuk field baru

## T02: PurchaseReceiptService — onApproved Dual Flow

- [ ] 5. `onApproved()`: deteksi alur (cek `billed_quantity > 0` untuk ALUR-2)
- [ ] 6. ALUR-1: buat SLE dengan `is_valuated=false`, `change_in_stock_value=0`, jangan buat GL
- [ ] 7. ALUR-2: cari InvoiceItems terkait per PO item, alokasi qty ke invoice tertua dulu (FIFO)
- [ ] 8. ALUR-2: buat SLE split per rate invoice, `is_valuated=true`
- [ ] 9. ALUR-2: buat GL (Debit Stock Asset / Credit SRNB) dengan rate invoice
- [ ] 10. ALUR-2: update `allocated_qty` di InvoiceItem yang sudah dipakai
- [ ] 11. Over-receipt (sisa qty tanpa invoice): SLE qty-only, `is_valuated=false`
- [ ] 12. Update `received_quantity` di PO item setelah proses
- [ ] 13. Update status PO

## T03: PurchaseInvoiceService — onApproved Update SLE

- [ ] 14. `onApproved()`: deteksi alur (cek `received_quantity > 0` untuk ALUR-1)
- [ ] 15. ALUR-1: cari SLE pending (`is_valuated=false`) via referenceable ke PurchaseReceipt
- [ ] 16. ALUR-1: split SLE per rate invoice — copy sebagian, update sebagian
- [ ] 17. ALUR-1: update `change_in_stock_value`, `valuation_rate`, `balance_stock_value`, `is_valuated=true`
- [ ] 18. ALUR-1: buat GL Stock Asset / SRNB
- [ ] 19. Over-bill (qty invoice > pending SLE): buat SLE baru `is_valuated=false`
- [ ] 20. GL SRNB / AP tetap dibuat (untuk kedua alur)

## T04: PurchaseOrderService — Sync Items

- [ ] 21. Method `syncItems()`: kumpulkan semua InvoiceItems & ReceiptItems via ModelConnection
- [ ] 22. Grouping per `[rate, tax_id, tax_rate, target_warehouse_id]`
- [ ] 23. Jika 1 group → update PO item biasa
- [ ] 24. Jika >1 group → soft-delete PO item lama, create N item baru
- [ ] 25. **Update reference**: InvoiceItems & ReceiptItems `purchase_order_item_id` → PO item baru
- [ ] 26. Rekalkulasi total amount PO header
- [ ] 27. Update status PO (termasuk OVER_RECEIVED/OVER_BILLED)
- [ ] 28. Buat ModelConnection audit trail

## T05: PurchaseOrderService — Mark Done

- [ ] 29. Method `markDone()`: validasi `received_qty == billed_qty` per item
- [ ] 30. Jika mismatch → throw ValidationException dengan detail mismatches
- [ ] 31. Jika semua match → panggil `syncItems()`, update status COMPLETED
- [ ] 32. Buat ModelConnection audit trail `{type: "mark_done"}`

## T06: Controller & Routes

- [ ] 33. `PurchaseOrderController`: action `syncItems(PurchaseOrder)` → return syncLog
- [ ] 34. `PurchaseOrderController`: action `markDone(PurchaseOrder)` → return success/mismatch
- [ ] 35. Route `POST purchase-orders/{id}/sync-items`
- [ ] 36. Route `POST purchase-orders/{id}/mark-done`

## T07: Frontend — PurchaseOrder Show

- [ ] 37. Tambah kolom tracking qty: Qty PO | Received | Billed | Δ Receipt | Δ Bill
- [ ] 38. Indikator visual over/under (hijau/merah) + chip status per item
- [ ] 39. Tombol **Sync Items** — muncul jika ada mismatch qty/rate/tax/warehouse
- [ ] 40. Modal Sync — preview diff before/after items split, konfirmasi
- [ ] 41. Tombol **Mark Done** — trigger validasi receipt==invoice
- [ ] 42. Toast warning jika Mark Done gagal — tampilkan daftar mismatches
- [ ] 43. Toast success jika Sync/Mark Done berhasil — reload halaman

## T08: Frontend — PurchaseReceipt Form

- [ ] 44. Pastikan form create/edit PurchaseReceipt **tidak ada** field rate/harga
- [ ] 45. Tampilkan rate dari PO sebagai info read-only jika diperlukan

## T09: Testing

- [ ] 46. Unit test ALUR-1: receipt approve → SLE pending (`is_valuated=false`), no GL
- [ ] 47. Unit test ALUR-1: invoice approve → SLE updated (`is_valuated=true`), GL Stock+SRNB+AP
- [ ] 48. Unit test ALUR-2: invoice approve → GL SRNB+AP, no SLE
- [ ] 49. Unit test ALUR-2: receipt approve → SLE+GL Stock/SRNB dengan rate invoice
- [ ] 50. Unit test: multi invoice rate berbeda → SLE split sesuai rate
- [ ] 51. Unit test: sync items → split PO items per group [rate, tax, warehouse]
- [ ] 52. Unit test: sync → update reference InvoiceItems/ReceiptItems ke PO item baru
- [ ] 53. Unit test: mark done success → status COMPLETED
- [ ] 54. Unit test: mark done qty mismatch → ValidationException + detail mismatches
- [ ] 55. Unit test: over-receipt/over-bill → status OVER_RECEIVED/OVER_BILLED
