# Tasks: Document Relation Panels

## T01: Kontrak Deklarasi Panel

- [x] 1. Buat trait `app/Traits/HasRelationPanel.php` berisi default
      `relationPanel(): array` (kembalikan `[]`) dan `relationPanelRow(): array`
      (kembalikan `['code' => $this->code]`)
- [x] 2. Tambahkan default `expectedRelationPanels(): array` yang mengembalikan
      `[]` di trait yang sama, agar model tanpa deklarasi tidak mendapat tab
- [x] 3. Pasang trait pada `App\Models\Model` base class; verifikasi tidak ada
      konflik nama method dengan trait lain yang sudah terpasang

## T02: RelationPanelService

- [x] 4. Buat `app/Services/Core/Connection/RelationPanelService.php` dengan
      method `build(Model $document): array`
- [x] 5. Implementasi langkah 1-3 (baca expected, query ModelConnection sekali,
      saring `reference_type` dengan `is_subclass_of(..., Model::class)`)
- [x] 6. Implementasi langkah 4-5 (muat record tujuan per tipe dengan satu
      `whereIn`, panggil `relationPanelRow()`, hitung `totals` dari kolom
      ber-`aggregate`)
- [x] 7. Implementasi langkah 6 (entri `is_empty: true` untuk tipe expected yang
      tidak punya koneksi)
- [x] 8. Implementasi langkah 7 (resolusi `action.url` lewat `route()` dengan
      `{id}` diganti, lewati entri bila permission tidak terpenuhi)
- [x] 9. Tulis unit test `tests/Unit/Services/Core/RelationPanelServiceTest.php`:
      payload lengkap, agregat sum, empty state, penyaringan baris `sync`,
      action tersembunyi tanpa permission
- [x] 9b. Penjagaan baris panel (FR8): `loadRecords()` dengan tiga lapis
      (permission `read`, `only_creator`, draft submitable). Memakai
      `Auth::user()`, bukan `request()->user()` yang selalu null di luar siklus
      HTTP. Rincian di design.md 3.7. Hasil: 12 test, 42 assertion.

## T03: Pengiriman Prop

- [x] 10. Tambahkan `'relationPanels' => Inertia::defer(...)` dengan grup defer
      sendiri bernama `relationPanels`. Koreksi lokasi: `showDetail()` ada di
      `app/Traits/DataTable.php:754`, bukan di `LinkModel`. `LinkModel` hanya
      memuat `markAsShowContext()` yang dipanggil dari sana
- [x] 11. Verifikasi prop `connections` yang sudah ada tidak berubah bentuk
      (FR4). Diff `DataTable.php`: 8 baris tambahan, nol penghapusan

## T04: Komponen Frontend

- [x] 12. Buat `resources/js/Pages/Core/Components/RelationPanel.jsx`: satu
      kartu panel — judul, tombol aksi, tabel, baris total, empty state
- [x] 13. Implementasi formatter kolom (`date` lewat `TZDate` + `format()`,
      `number` dan `currency` lewat helper di `@/lib/utils`)
- [x] 14. Buat `resources/js/Pages/Core/Components/RelationPanels.jsx`:
      `FormPageContent value="relations"` + `Deferred` + skeleton + map panel
- [x] 15. Tambahkan kunci terjemahan `core.form.relations`,
      `core.form.relation_empty` di file lang id dan en
- [x] 16. Tulis `RelationPanel.rtl.test.jsx`: render tabel dengan baris, baris
      total, empty state dengan tombol, empty state tanpa tombol
- [x] 17. Tulis `RelationPanels.rtl.test.jsx`: skeleton saat prop belum ada,
      daftar panel saat prop terisi

## T05: Verifikasi Koneksi PaymentEntry

- [x] 18. Periksa apakah koneksi langsung `PurchaseOrder -> PaymentEntry`
      tercatat di `model_connections`; kalau tidak, periksa jalur
      `PurchaseInvoice -> PaymentEntry`
- [x] 19. Catat hasilnya di design.md bagian 4; bila koneksi langsung tidak ada,
      keluarkan panel PaymentEntry dari tahap 1

**Hasil**: Koneksi langsung tidak ada dan tidak mungkin ada. Panel PaymentEntry
dikeluarkan dari tahap 1. Perilaku dikunci oleh test
`chain_stops_when_parent_has_no_referenceable_column` di
`tests/Feature/Core/DocumentConnectionTest.php`. Rinciannya di design.md
bagian 4.

File berubah: `tests/Feature/Core/DocumentConnectionTest.php`,
`.kiro/specs/document-relation-panels/design.md`,
`.kiro/specs/document-relation-panels/requirements.md`.

**CHECKPOINT**: Hentikan dan laporkan hasil T05 sebelum lanjut ke T06.

## T06: Tahap 1 — PurchaseOrder

- [x] 20. Tambahkan `relationPanel()` + `relationPanelRow()` di
      `app/Models/Purchase/PurchaseReceipt.php` (kolom: code, date,
      total_quantity)
- [x] 21. Tambahkan `relationPanel()` + `relationPanelRow()` di
      `app/Models/Finances/PurchaseInvoice.php` (kolom: code, date, total)
- [x] 22. Tambahkan `expectedRelationPanels()` di
      `app/Models/Purchase/PurchaseOrder.php` dengan aksi create receipt dan
      create invoice
- [x] 23. Pasang `<RelationPanels />` di
      `resources/js/Pages/Purchase/PurchaseOrders/Show.jsx`, dengan syarat
      `purchaseOrder?.submitted_at` (FR6)
- [x] 24. Tambahkan kunci terjemahan panel purchase di file lang id dan en
- [x] 25. Tulis feature test: PO dengan receipt menghasilkan prop
      `relationPanels` berisi panel terisi; PO tanpa invoice menghasilkan panel
      `is_empty` dengan action
- [x] 26. Tulis assertion jumlah query untuk membuktikan tidak ada N+1 (FR7)

**CHECKPOINT**: Jalankan test suite backend dan frontend yang terkait sebelum
lanjut ke T07.

## T07: Tahap 2 — SalesOrder

- [x] 27. Tambahkan `relationPanel()` + `relationPanelRow()` di
      `app/Models/Finances/SalesInvoice.php` (kolom: code, date, total)
- [x] 28. Tambahkan `relationPanel()` + `relationPanelRow()` di
      `app/Models/Inventory/DeliveryNote.php` (kolom: code, status,
      total_quantity)
- [x] 29. Tambahkan `expectedRelationPanels()` di
      `app/Models/Sales/SalesOrder.php` dengan aksi create invoice dan create
      delivery
- [x] 30. Pasang `<RelationPanels />` di
      `resources/js/Pages/Sales/SalesOrders/Show.jsx`
- [x] 31. Tambahkan kunci terjemahan panel sales di file lang id dan en
- [x] 32. Tulis feature test untuk SalesOrder

## T08: Tahap 3 — AssetService

- [x] 33. Tambahkan `relationPanel()` + `relationPanelRow()` di
      `app/Models/Purchase/PurchaseRequest.php` (kolom: code, status)
- [x] 34. Tambahkan `relationPanel()` + `relationPanelRow()` di
      `app/Models/Purchase/PurchaseOrder.php` (kolom: code, status) — model ini
      menjadi tujuan relasi dari AssetService
- [x] 35. Tambahkan `relationPanel()` + `relationPanelRow()` di
      `app/Models/Sales/InternalOrder.php` (kolom: code, status)
- [x] 36. Tambahkan `expectedRelationPanels()` di
      `app/Models/Asset/AssetService.php` dengan aksi create PR, PO, SO, IO
      (empat, sesuai dropdown Actions di Show.jsx)
- [x] 37. Pasang `<RelationPanels />` di
      `resources/js/Pages/Asset/Services/Show.jsx`; pertahankan dropdown Actions
      yang sudah ada
- [x] 38. Tambahkan kunci terjemahan panel asset di file lang id dan en
- [x] 39. Tulis feature test untuk AssetService

## T11: Tahap 4 — Tujuh Halaman Sisanya

Satu panel per halaman, mengikuti pola T06. Tiap langkah mencakup
`expectedRelationPanels()` di model sumber, `relationPanel()` +
`relationPanelRow()` di model tujuan bila belum ada, pemasangan
`<RelationPanels />` di Show.jsx, kunci terjemahan, dan feature test.

Route dan parameter `ref` diambil dari dropdown Actions yang sudah ada di tiap
Show.jsx, jangan dikarang.

- [x] 56. `PurchaseRequest` -> PurchaseOrder
- [x] 57. `PurchaseInvoice` -> PaymentEntry
- [x] 58. `SalesInvoice` -> PaymentEntry
- [x] 59. `WorkOrder` -> PurchaseRequest
- [x] 60. `Quotation` -> SalesOrder
- [x] 61. `Opportunity` -> Quotation
- [x] 62. `InternalOrder` -> DeliveryNote
- [x] 63. `relationPanel()` untuk model tujuan yang belum punya: PaymentEntry
      (code, metode, total), SalesOrder, DeliveryNote, Quotation, InternalOrder
- [x] 64. Feature test per halaman: panel terisi dan panel kosong dengan aksi

## T12: Tahap 5 — Panel Retur

Desain di design.md 3.6b. Retur memakai `source`, bukan ModelConnection.

- [x] 65. `RelationPanelService`: dukung key `source` pada entri
      `expectedRelationPanels()`. Bila ada, baris diambil dari method itu
      (mengembalikan query builder) dan `ModelConnection` dilewati. Penjagaan
      `loadRecords()` tetap diterapkan
- [x] 66. Unit test: panel bersumber `source` tetap melewati ketiga lapis
      penjagaan, dan tidak memicu query ModelConnection
- [x] 67. `PurchaseReceipt`: `returnRows()` dari relasi `returnAgainst` terbalik,
      plus `expectedRelationPanels()` dengan aksi create retur
- [x] 68. `DeliveryNote`: sama, memakai `return_against_id`
- [x] 69. Pasang `<RelationPanels />` di `PurchaseReceipts/Show.jsx` dan
      `DeliveryNotes/Show.jsx`
- [x] 70. Kunci terjemahan panel retur
- [x] 71. Feature test: retur muncul di panel dokumen asalnya, panel kosong saat
      belum ada retur

## T10: Rincian Item per Baris (FR7a, FR7b)

Diminta setelah verifikasi visual tahap 1. Desainnya di design.md 3.6a.

- [x] 45. Tambahkan `relationPanelDetail()` dan `relationPanelDetailRows()` ke
      trait `HasRelationPanel`, keduanya default kosong
- [x] 46. `RelationPanelService`: muat `relationPanelDetail()['eager']` bersama
      eager panel, isi `detail_columns` dan `detail_rows` per baris. Tanpa
      deklarasi, kedua key tidak ikut dikirim
- [x] 47. `RelationPanelService`: baca `remainder` dari `expectedRelationPanels()`,
      panggil method yang disebut `rows`, sertakan di payload panel. Blok
      dilewati bila barisnya kosong
- [x] 48. Unit test: expand terisi, model tanpa deklarasi tidak dapat key detail,
      remainder kosong tidak dikirim, jumlah query tidak bertambah per baris
- [x] 49. `RelationPanel.jsx`: baris dengan `detail_rows` dapat kontrol
      buka/tutup, isinya tabel item. Blok remainder di bawah tabel utama
- [x] 50. RTL test: buka/tutup baris, baris tanpa detail tidak punya kontrol,
      blok remainder muncul dan menghilang sesuai data
- [x] 51. `PurchaseReceipt`: `relationPanelDetail()` + `relationPanelDetailRows()`,
      nama item dari relasi `item` (ItemVariant), bukan kolom `item_name`
- [x] 52. `PurchaseInvoice`: sama, kolom item dan qty
- [x] 53. `PurchaseOrder`: `remainder` pada kedua panel, memakai
      `unreceivedItemRows()` dan `unbilledItemRows()`
- [x] 54. Kunci terjemahan untuk kolom detail dan judul blok remainder
- [x] 55. Feature test: expand receipt berisi item PO, remainder muncul saat ada
      sisa dan hilang saat lengkap

## T09: Finalisasi

- [ ] 40. Jalankan `vendor/bin/pint --dirty --format agent`
- [ ] 41. Jalankan `npm run lint:fix`
- [ ] 42. Jalankan seluruh test backend dan frontend yang terkait fitur ini
- [ ] 43. Verifikasi visual di browser untuk ketiga dokumen (login admin/admin).
      Dikerjakan user, bukan agent. Panduan tahap 1 ada di
      `verifikasi-visual-t06.md`
- [ ] 44. Jalankan `graphify update .` bila tool tersedia

## Catatan Pengerjaan

- Tahap 1 (T06) membuktikan polanya. Bila selama T06 kontrak di T01/T02 terasa
  canggung, perbaiki kontraknya sebelum lanjut ke T07, jangan ditumpuk.
- Lint dan Pint dijalankan sekali di T09, bukan per task.
