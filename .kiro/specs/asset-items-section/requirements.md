# Requirements Document

## Introduction

Revisi total atas spec ini. Implementasi pertama (asset_items partisi via `Item.is_fixed_asset`, sub-tabel nested `asset_lines`/`SalesInvoiceItemAsset`/`DeliveryNoteItemAsset`) sudah selesai dikerjakan dan lulus semua test, tapi user mengoreksi desainnya setelah lihat hasilnya:

1. "tidak perlu assets (plural) dalam items. cukup 1 field asset pada items" — hapus sub-tabel nested `asset_lines` (1 baris bisa berisi banyak Asset). Ganti jadi **1 kolom `asset_id` langsung per baris** — 1 baris = 1 Asset.
2. "item pada section asset ganti ke AssetLinkModel dan nama labelnya Asset" — field yang sebelumnya dipakai buat pilih ItemVariant/baris-sumber, sekarang tampilkan identitas Asset.
3. "tanpa source warehouse pada bagian section Asset Items" — kolom Source Warehouse dihapus dari section Asset Items (SO & DN).

**Klarifikasi model data yang mengoreksi pemahaman awal (kutipan user):**
> "contoh pada SalesOrderItem: item_id -> reference ke ItemVariant nullable, asset_id -> reference ke Asset nullable, referenceable -> ini reference ke dokumen sumber item ini berasal."

Jadi `item_id`, `asset_id`, dan `referenceable`/`sales_order_item_id` adalah **tiga kolom independen**:
- `item_id` (nullable) — diisi kalau baris itu barang biasa.
- `asset_id` (nullable, **kolom baru**) — diisi kalau baris itu aset tetap. Pengganti langsung mekanisme `asset_lines` lama.
- `referenceable` (DN, morphs, sudah ada) / `sales_order_item_id` (SI, sudah ada nullable) — tracking baris dokumen SUMBER, TIDAK berubah maknanya, TIDAK dihapus.

**Temuan penting saat diskusi ulang (diverifikasi baca kode langsung, bukan asumsi):**
- Field "item" di section Items DN/SI **BUKAN** field pilih ItemVariant langsung — itu `LinkModel`/`SalesOrderItemLinkModel` yang pilih baris `referenceable`/`sales_order_item` (SalesOrderItem/InternalOrderItem), lalu `item_id` di-derive backend dari baris itu (komentar kode: `// item TIDAK disimpan — item_id diambil backend dari referenceable`, `resources/js/Pages/Inventory/DeliveryNotes/Form.jsx:63`). Mekanisme ini **SUDAH SERAGAM** antara Items dan Asset Items (satu fungsi `buildItemColumns(kind)` dipakai keduanya, filter beda doang) — jadi TIDAK ada "auto-resolve khusus asset" yang perlu dibuat baru; field Asset Items TETAP pilih baris `referenceable`/`sales_order_item`, cuma **tampilan dropdown-nya** yang berubah (nunjukin identitas Asset, bukan ItemVariant).
- `templateLink()` (kontrak `App\Traits\LinkModel`) **statis**, tanpa akses row (dipanggil `$modelClass::templateLink()` sebelum row di-fetch, buat resolve eager-load — `DataTableColumnSelector::templateLinkPlaceholders()`). Tidak bisa diubah ke non-static: ~80 model pakai kontrak ini, breaks resolusi depends-on/eager-load app-wide.
- Solusi: token kondisional baru `:cond ? :whenTrue | :whenFalse` (plus nested via `(...)`) di `convertTemplateLink()` (`resources/js/lib/linkModelUtils.js`) — dieval SEBELUM substitusi token biasa. Terbukti (verifikasi node) **tidak butuh perubahan** di parser lain (`ModelController::templateLinkColumns`, `templateLinkPlaceholders`, search `__invoke`) karena ketiganya cuma regex ekstrak SETIAP token `:field`, dan tiap cabang ternary tetap ditulis dengan prefix `:` sendiri.
- `SalesOrderItem::templateLink()` ganti dari `:item` jadi `:asset_id ? :asset | :item`.
- **Blast radius domain event/listener aset yang TERLEWAT di spec versi pertama** (baru ketemu 2026-09-28 saat investigasi ulang): `AssetRentalDeliveryApproved`, `AssetRentalReturnApproved`, `AssetSoldViaDelivery`, `AssetSoldViaInvoice` semua bertipe `public readonly DeliveryNoteItemAsset|SalesInvoiceItemAsset $line` (child table lama). Listener (`SetAssetInRent`, `ReturnAssetFromRent`, `MarkAssetSoldFromDelivery`, `PostAssetDisposalGainLoss`) baca `$event->line->asset`/`->quantity`/`->id`. Menghapus child table **WAJIB** retype 4 event + adaptasi 4 listener ke `DeliveryNoteItem`/`SalesInvoiceItem` langsung (baca `asset_id`/`quantity` dari parent row). Spec versi pertama salah bilang "Logic event/listener aset ... tidak diubah" — itu SALAH untuk revisi ini.

## Glossary

- **Baris Aset**: baris SO/SI/DN item yang `asset_id` terisi (`item_id` null).
- **Baris Biasa**: baris yang `item_id` terisi (`asset_id` null). Mutually exclusive dengan Baris Aset.
- **Payload `asset_items`**: array request terpisah dari `items`, digabung ke tabel `*_items` yang sama di service (mekanisme split-payload-satu-tabel ini TIDAK berubah dari spec pertama).
- **Token ternary templateLink**: `:cond ? :whenTrue | :whenFalse`, opsional nested via `(...)`. Lihat `resources/js/lib/linkModelUtils.js`.

## Requirements

### Requirement 1: Skema — `asset_id` kolom baru, `item_id` nullable, drop `asset_lines`

1. THE migration baru SHALL menambah kolom `asset_id` (nullable, FK `assets.id`, `nullOnDelete`) di `sales_order_items`, `sales_invoice_items`, `delivery_note_items`.
2. THE migration SHALL mengubah `item_id` di ketiga tabel itu jadi nullable (SO & DN saat ini NOT NULL; SI juga NOT NULL — cek ulang saat implementasi).
3. THE migration SHALL men-drop tabel `sales_invoice_item_assets` dan `delivery_note_item_assets` (child table `asset_lines`), beserta model `SalesInvoiceItemAsset`/`DeliveryNoteItemAsset`, relasi `assetLines()` di `SalesInvoiceItem`/`DeliveryNoteItem`, dan seluruh kode yang menyinkronkannya (`syncAssetLines()` di `DeliveryNoteService`/`SalesInvoiceService`).
4. THE model `SalesOrderItem`, `SalesInvoiceItem`, `DeliveryNoteItem` SHALL punya relasi `asset(): BelongsTo` baru (ke `App\Models\Asset\Asset`).

### Requirement 2: Event/listener domain aset — migrasi dari child-table-line ke parent-row

1. THE event `AssetRentalDeliveryApproved`, `AssetRentalReturnApproved` SHALL retype properti `$line` dari `DeliveryNoteItemAsset` ke `DeliveryNoteItem`.
2. THE event `AssetSoldViaDelivery` SHALL retype `$line` dari `DeliveryNoteItemAsset` ke `DeliveryNoteItem`.
3. THE event `AssetSoldViaInvoice` SHALL retype `$line` dari `SalesInvoiceItemAsset` ke `SalesInvoiceItem`.
4. THE listener `SetAssetInRent`, `ReturnAssetFromRent`, `MarkAssetSoldFromDelivery`, `PostAssetDisposalGainLoss` SHALL dibaca ulang dan disesuaikan supaya baca `asset`/`quantity`/`id` dari `DeliveryNoteItem`/`SalesInvoiceItem` (parent row), bukan child line.
5. THE `DeliveryNoteService::handleAssetDeliveryItem()` SHALL disederhanakan: TIDAK ADA LAGI pengecekan Σ quantity `asset_lines` vs quantity baris (tidak relevan lagi — 1 baris = 1 asset by construction); dispatch event SHALL 1× per baris (bila `asset_id` terisi), bukan 1× per child line.
6. THE `SalesInvoiceService::onApproved()` SHALL dispatch `AssetSoldViaInvoice` 1× per baris ber-`asset_id`, bukan loop `$item->assetLines`.
7. THE dampak lanjutan `PostAssetDisposalGainLoss` yang menulis `referenceable_type/id` (morph ke child line lama, dipakai entri GL/`AssetValueAdjustment`) SHALL diverifikasi & disesuaikan ke tipe row baru (`DeliveryNoteItem`/`SalesInvoiceItem`).

### Requirement 3: Partisi payload disederhanakan (tanpa lookup ItemVariant→Item)

1. THE `AssetItemPartitioner` (atau penggantinya) SHALL mempartisi baris berdasarkan keberadaan `asset.id`/`item.id` di payload baris itu sendiri, TANPA query lookup `Item.is_fixed_asset` via `ItemVariant`.
2. THE partisi saat load dokumen (show/edit) SHALL berdasarkan `asset_id`/`item_id` kolom row, bukan flag `is_fixed_asset`.

### Requirement 4: Validasi backend `asset_items.*.asset.id`

1. THE FormRequest SO/SI/DN SHALL memvalidasi `asset_items.*.asset.id` (exists di `assets`), bukan `asset_items.*.item.id`.
2. IF baris di `items` mengisi `asset.id` (bukan `item.id`), THEN THE FormRequest SHALL menolaknya — dan sebaliknya untuk `asset_items`.
3. Aturan minimal-1-baris-gabungan (SO, SI) dan rule lain yang sudah ada di spec pertama TIDAK berubah.

### Requirement 5: Field UI section Asset Items

1. IN SO, THE field "item" di section Asset Items SHALL diganti `AssetLinkModel` (pilih Asset langsung), label "Asset", mengisi `asset_id`. Kolom Source Warehouse SHALL dihapus dari section ini.
2. IN DN & SI, THE field "item" di section Asset Items SHALL TETAP LinkModel/`SalesOrderItemLinkModel` yang pilih baris `referenceable`/`sales_order_item` (mekanisme TIDAK berubah — lihat catatan "Temuan penting" di atas) — HANYA filter (`asset_id` presence, bukan `item.item.is_fixed_asset` lookup) dan tampilan (`templateLink` ternary) yang berubah.
3. IN DN, THE kolom Source Warehouse SHALL dihapus dari section Asset Items (SI sudah tanpa kolom itu).
4. THE sub-tabel nested `asset_lines` SHALL dihapus total dari FE (DN & SI Form.jsx) — diganti kolom `asset` tunggal per baris (SO) atau tetap field referenceable-picker yang sudah ada (DN/SI, tampilan berubah).
5. THE section Asset Items SHALL tidak menampilkan atau meminta Unit; service SHALL menyimpan `item_unit_id = null` untuk baris dengan `asset_id`, tanpa mengubah data Unit baris Items.
6. IN SO dan SI, THE kolom Tax Asset Items SHALL tampil dan wajib diisi seperti Tax pada Items; DN mengikuti Items DN yang tidak memiliki kolom Tax.
7. IF SO ditandai sebagai rental, THEN baris Asset dengan `is_rentable=true` SHALL dapat memenuhi validasi bahwa order berisi objek rental; validasi ItemVariant `vehicle` yang sudah ada SHALL tetap berlaku.

### Requirement 6: Kompatibilitas & migrasi test

1. THE seluruh test yang menyinggung `asset_lines`/`SalesInvoiceItemAsset`/`DeliveryNoteItemAsset` (backend & FE) SHALL dihapus atau ditulis ulang mengikuti skema baru.
2. THE test listener aset (`SetAssetInRentTest`, `ReturnAssetFromRentTest`, `MarkAssetSoldFromDeliveryTest`, `PostAssetDisposalGainLossTest`) SHALL diperbarui ke tipe event baru.
3. THE test `linkModelUtils.test.js` untuk token ternary SUDAH ADA dan lulus (tidak perlu diulang, sudah dikerjakan sebelum spec ini ditulis ulang).

## Di luar scope (tidak berubah dari spec pertama)

- `InternalOrder` dan dokumen Purchase* — Asset Items section DN hanya aktif saat `reference_to.model === SalesOrder` (InternalOrder tidak pernah punya `asset_id`).
- Fitur invoice dari Payment Schedule Terms (`rental-invoice-period-terms`, spec terpisah, ditunda).
- Reservasi stok rental, logic approve/cancel/amend, posting GL selain yang disebut Requirement 2.
