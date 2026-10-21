# Tasks: Document Connection Coverage

## T01: Pemeriksaan Skema Sebelum Menulis Kode

Spec ini pernah ditulis dengan asumsi yang salah bahwa header dokumen punya
kolom `referenceable`. Ternyata tidak. Jangan ulangi polanya: periksa dulu.

- [x] 1. Untuk tiap dokumen pada tabel di requirements.md 2.3, periksa apakah
      tabel ITEM-nya punya `referenceable_type` dan `referenceable_id`
- [x] 2. Periksa `asset_service_consumed_items`, `asset_movement_items`, dan
      tabel item AssetValueAdjustment. Kalau tidak ada kolomnya, telusuri dari
      mana induk dokumen itu diketahui, atau simpulkan bahwa dokumen itu tidak
      punya induk
- [x] 3. Periksa data: berapa banyak baris item yang `referenceable`-nya terisi
      per tabel, dan tipe apa saja yang muncul. Ini menentukan apakah perbaikan
      akan berdampak nyata atau hanya berlaku untuk dokumen baru
- [x] 4. Catat hasilnya di `design.md` beserta mekanisme yang dipilih per
      dokumen. Dokumen yang ternyata tidak punya induk dikeluarkan dari cakupan,
      dengan alasannya ditulis

**CHECKPOINT**: Hentikan dan laporkan hasil T01 sebelum menulis kode. Kalau
ternyata sebagian besar dokumen tidak punya induk, cakupan spec ini menyusut
dan itu perlu diketahui user lebih dulu.

## T02: WorkOrder dan InternalOrder (FR1)

Keduanya sudah dipastikan punya item ber-`referenceable`.

- [x] 5. `WorkOrderService::submit()`: panggil `attachConnections()` per item
      yang punya `referenceable`, mengikuti pola
      `PurchaseOrderService::submit()` baris 303-318
- [x] 6. `InternalOrderService::submit()`: sama. Perhatikan `submit()` sudah
      membuka transaksi, jadi penempatannya harus di dalam transaksi itu
- [x] 7. Periksa apakah keduanya perlu memperbarui kolom agregat seperti
      `ordered_quantity` pada PO (lihat PurchaseOrderService baris 320-325).
      Kalau tidak ada padanannya, lewati dan catat
- [x] 8. Feature test per service: koneksi tertulis saat item punya induk,
      tidak tertulis saat tidak punya, tidak ganda saat submit berulang,
      koneksi tingkat dokumen muncul bukan hanya tingkat item

## T03: Dokumen Asset (FR2)

Cakupan ditentukan hasil T01.

- [x] 9. AssetService: terapkan mekanisme yang dipilih di T01
- [x] 10. AssetMovement: sama
- [x] 11. AssetValueAdjustment: sama (dikeluarkan dari cakupan, lihat T03 di design.md)
- [x] 12. Feature test per dokumen yang masuk cakupan
- [x] 13. Dokumen yang dikeluarkan dari cakupan: pastikan alasannya sudah
      tertulis di design.md, tidak ada perubahan kode untuknya

## T04: Retur (FR3)

- [x] 14. `PurchaseReceiptService`: saat retur disubmit, catat koneksi ke
      PurchaseReceipt yang diretur (`return_against_id`), selain koneksi ke
      PurchaseOrder yang sudah ada
- [x] 15. `DeliveryNoteService`: sama untuk `return_against_id`
- [x] 16. Feature test: retur muncul sebagai koneksi dokumen asalnya, koneksi
      lama tetap ada
- [x] 17. Verifikasi panel retur (`source` di RelationPanelService) tidak
      berubah perilakunya, tidak menampilkan baris ganda

## T05: Command Backfill (FR4)

- [x] 18. `php artisan make:command` untuk command backfill koneksi dokumen
- [x] 19. Backfill dari `referenceable` pada item, memakai `attachConnections()`
      yang sama agar bentuk barisnya identik dengan jalur submit
- [x] 20. Backfill dari kolom induk pada header: `purchase_order_id` pada
      PurchaseReceipt dan PurchaseInvoice, `sales_order_id` pada SalesInvoice
      dan DeliveryNote, `paymentable` pada PaymentEntry (DN memakai
      `referenceable` di header, lihat koreksi FR4 di design.md)
- [x] 21. Backfill dari `return_against_id`
- [x] 22. Mode `--dry-run`: laporkan tanpa menulis
- [x] 23. Pemrosesan per batch dengan `chunkById`, tidak memuat seluruh tabel
- [x] 24. Ringkasan jumlah baris per pasangan tipe di akhir
- [x] 25. Feature test: idempoten (dua kali jalan, jumlah baris sama),
      `--dry-run` tidak menulis, dokumen tanpa induk dilewati

## T06: Regresi dan Finalisasi (FR5)

- [x] 26. Test regresi: pasangan tipe yang sudah tercatat tetap sama bentuknya,
      payload `data` tingkat item tidak berubah, baris audit `sync` dan
      `mark_done` tidak terpengaruh
- [ ] 27. Jalankan `tests/Feature/Core`, `tests/Feature/Purchase`,
      `tests/Unit/Services`, dan test dokumen yang diubah
- [x] 28. `vendor/bin/pint --dirty --format agent` (dijalankan hanya pada berkas spec ini)
- [ ] 29. Verifikasi di browser: buka halaman AssetService, WorkOrder, dan
      InternalOrder yang punya dokumen turunan, pastikan panel relasi dan tab
      Connections terisi. Jalankan backfill lebih dulu bila dokumennya lama
      (login admin/admin)

## Catatan Pengerjaan

- T01 adalah checkpoint sungguhan. Spec ini sudah sekali salah karena menebak
  skema, jangan diulang.
- `attachConnections()` sudah ada dan sudah terbukti. Tugasnya memanggilnya,
  bukan menulis mekanisme baru.
- Pint dijalankan sekali di T06.
- Jangan commit tanpa diminta user.
