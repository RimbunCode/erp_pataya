# Tasks: Sales Dual Flow

## T01: Migration & Enum — Field/Status Baru

- [x] 1. Update migration `create_sales_order_items_table`: tambah `parent_item_id` nullable ULID FK self-referencing ke `sales_order_items.id`, `nullOnDelete()`
- [x] 2. Tambah case `OVER_DELIVERED = 'over_delivered'` di `app/FormStatus.php` (enum-only, bukan migration)
- [x] 3. Update model `SalesOrderItem`: tambah relasi `parentItem()` (belongsTo self) dan `childItems()` (hasMany self)
- [x] 4. Pastikan label status `over_delivered` tersedia di file lang `status.*`

## T02: SalesOrderService — Status Dua Dimensi

- [x] 5. Method `updateSalesOrderStatus(SalesOrder)`: hitung totalQty, totalDelivered, totalBilled
- [x] 6. Dimensi DELIVER: 0→TO_DELIVER, >qty→OVER_DELIVERED, partial→PARTIALLY_DELIVERED, ==→DELIVERED
- [x] 7. Dimensi BILL: 0→TO_BILL, >qty→OVER_BILLED, partial→PARTIALLY_BILLED, ==→BILLED
- [x] 8. Update status array via `Utils::replaceStatus()` — dua dimensi independen
- [x] 9. Panggil `updateSalesOrderStatus()` setelah `delivered_quantity`/`billed_quantity` terupdate (dari DeliveryNote/SalesInvoice approve)

## T03: SalesOrderService — Sync Items

- [x] 12. Method `syncItems(SalesOrder)`: kumpulkan SalesInvoiceItems & DeliveryNoteItems via ModelConnection
- [x] 13. Grouping per `[price, tax_id, tax_rate, source_warehouse_id]`
- [x] 14. DeliveryNoteItem dicari via `referenceable_type=SalesOrderItem` + `referenceable_id=soItem.id`
- [x] 15. Jika 1 group → update SO item biasa (price/tax/warehouse)
- [x] 16. Jika >1 group → soft-delete SO item lama, create N item baru dengan `parent_item_id`
- [x] 17. `delivered_quantity`/`billed_quantity` item baru dihitung dari `source_delivery_item_ids`/`source_invoice_item_ids`
- [x] 18. **FK Invoice/Delivery items TIDAK diubah** — tetap reference ke SO item lama
- [x] 19. Rekalkulasi total amount SO header
- [x] 20. Panggil `updateSalesOrderStatus()` (termasuk OVER_DELIVERED/OVER_BILLED)
- [x] 21. Buat ModelConnection audit trail `{type: "items_sync", splits: [...]}`

## T04: SalesOrderService — Mark Done

- [x] 24. Method `markDone(SalesOrder)`: validasi `delivered_qty == billed_qty` per item
- [x] 25. Jika mismatch → throw `ValidationException(['mismatches' => [{item_name, delivered_qty, billed_qty}]])`
- [x] 26. Jika semua match → panggil `syncItems()`
- [x] 27. Update status SO → COMPLETED via `Utils::replaceStatus()` (hapus status deliver & bill)
- [x] 28. Buat ModelConnection audit trail `{type: "mark_done"}`

## T05: Controller & Routes

- [x] 31. `SalesOrderController`: action `syncItems(SalesOrder)` → return syncLog (back with success)
- [x] 32. `SalesOrderController`: action `markDone(SalesOrder)` → return success; catch ValidationException → back withErrors
- [x] 33. Route `POST sales-orders/{salesOrder}/sync-items`
- [x] 34. Route `POST sales-orders/{salesOrder}/mark-done`

## T06: Frontend — SalesOrder Show

- [x] 37. Tambah kolom tracking qty: Qty SO | Delivered | Billed | Δ Deliver | Δ Bill
- [x] 38. Indikator visual over/under (hijau/merah) + chip status per item (Over/Under deliver/bill, Match)
- [x] 39. Tombol **Sync Items** — muncul jika ada mismatch qty/price/tax/warehouse
- [x] 40. Modal konfirmasi Sync — peringatan tindakan tidak bisa dibatalkan
- [x] 41. Tombol **Mark Done** — trigger validasi delivered==billed
- [x] 42. Modal konfirmasi Mark Done + tampilkan tabel mismatch jika `errors.mismatches`
- [x] 43. Toast success jika Sync/Mark Done berhasil — reload halaman

## T07: Frontend — SalesOrder Form (verifikasi)

- [x] 45. Pastikan form create/edit SalesOrder tetap menampilkan qty/price seperti sekarang (tidak ada perubahan field harga)
- [x] 46. Pastikan kolom delivered/billed read-only di tampilan detail

## T08: Testing

- [x] 48. Unit test ALUR-1 (DN→SI): DeliveryNote approve → SLE `is_valuated=true` + GL COGS (existing, tidak berubah)
- [x] 49. Unit test ALUR-1: SalesInvoice approve → GL AR/income, **tidak ada SLE baru/berubah**
- [x] 50. Unit test ALUR-2 (SI→DN): SalesInvoice approve → GL AR/income, no SLE
- [x] 51. Unit test ALUR-2: DeliveryNote approve → SLE `is_valuated=true` + GL COGS
- [x] 52. Unit test: status dua dimensi — delivered/billed update → TO_DELIVER/PARTIALLY/DELIVERED & TO_BILL/PARTIALLY/BILLED
- [x] 53. Unit test: over-deliver/over-bill → status OVER_DELIVERED/OVER_BILLED, tidak ada error
- [x] 54. Unit test: syncItems → split SO items per group [price, tax, warehouse]
- [x] 55. Unit test: sync → FK Invoice/Delivery items TIDAK berubah, item baru simpan `parent_item_id`
- [x] 56. Unit test: markDone success (delivered==billed) → status COMPLETED
- [x] 57. Unit test: markDone mismatch → ValidationException + detail mismatches
- [x] 58. Unit test regresi: pastikan DeliveryNoteService & SalesInvoiceService onApproved output SLE/GL identik dengan sebelum fitur (tidak berubah)
