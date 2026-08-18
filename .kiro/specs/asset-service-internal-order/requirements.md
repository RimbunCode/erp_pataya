# Requirements Document

## Introduction

Spec ini menutup sub-area kedua dari rencana besar "Spec 7" (AssetService billing/procurement integration): permintaan servis **internal** (non-customer) untuk `AssetService` (repair/maintenance, Spec 5), lewat `InternalOrder → DeliveryNote`. Ini adalah pasangan dari `asset-service-billing` (Spec 7a, yang menangani jalur customer via `SalesOrder → DeliveryNote → SalesInvoice`), dengan perbedaan kunci: `InternalOrder` **tidak punya customer sama sekali** (tabel `internal_orders` hanya berisi `date`), sehingga tidak ada billing/tagihan apapun — servis internal dianggap biaya operasional company (cost of doing business), konsisten dengan keputusan Spec 7a bahwa Asset company-owned yang tidak disewa/tidak punya ownership customer selesai tanpa ditagih.

**Konteks investigasi WorkOrder** (bukan scope implementasi spec ini, hanya latar belakang): `App\Models\Service\WorkOrder` adalah model legacy dari sistem lama sebelum `AssetService` ada — secara konsep setara dengan `AssetService` sekarang, tapi pipeline-nya tidak pernah selesai dibangun (6 kolom tracking kuantitas di `WorkOrderItem` — `ordered_quantity`, `required_quantity`, `received_quantity`, `ready_quantity`, `transferred_quantity`, `remaining_quantity` — tidak pernah diisi kode manapun; `WorkOrderService` cuma flip status draft→pending→in_progress→completed tanpa logic nyata). `WorkOrder` TIDAK terhubung ke Asset domain sama sekali (general labor+part fulfillment document). Keputusan user: **WorkOrder akan dihapus**, tapi baru setelah `AssetService` mencapai parity penuh lewat spec ini (InternalOrder) DAN spec Procurement (part kurang stok) berikutnya — penghapusan WorkOrder itu sendiri BUKAN bagian dari spec ini.

`InternalOrderItem.referenceable_type`/`referenceable_id` (morph generik) sudah ada sejak migration awal (`nullableUlidMorphs('referenceable')`), TIDAK pernah dipakai fitur apapun — berbeda dari `SalesOrderItem.referenceable` yang punya collision existing dengan fitur copy-item-dari-sumber (`mergeItems()`, Spec 7a). Aman dipakai langsung tanpa risiko.

## Glossary

- **Baris jasa**: satu `InternalOrderItem` yang `referenceable`-nya menunjuk ke sebuah `AssetService` — mewakili pekerjaan servis itu sendiri, tanpa nilai uang (tidak ada `price`/billing untuk InternalOrder).
- **Baris part**: satu `InternalOrderItem` yang `referenceable`-nya menunjuk ke sebuah `AssetServiceConsumedItem` — mewakili satu jenis part yang dipakai saat servis, 1:1 dengan row consumed item aslinya (sama seperti Spec 7a).

## Requirements

### Requirement 1: InternalOrderItem.referenceable

**User Story:** As a developer, I want InternalOrderItem punya cara merujuk ke AssetService/AssetServiceConsumedItem, so that permintaan servis internal bisa dibuat tanpa melibatkan SalesOrder/customer sama sekali.

#### Acceptance Criteria

1. THE InternalOrderItem SHALL memiliki relasi `referenceable(): MorphTo` (kolom DB sudah ada, TIDAK perlu migration baru).
2. WHEN `referenceable_type` diisi `App\Models\Asset\AssetService`, THE InternalOrderItem SHALL dianggap sebagai baris jasa servis.
3. WHEN `referenceable_type` diisi `App\Models\Asset\AssetServiceConsumedItem`, THE InternalOrderItem SHALL dianggap sebagai baris part, dan HARUS 1:1 terhadap satu row `AssetServiceConsumedItem` — SATU AssetServiceConsumedItem TIDAK boleh dipakai lebih dari satu baris manapun (baik `InternalOrderItem` maupun `SalesOrderItem`, gabungan lintas kedua tabel).
4. IF `referenceable_type` kosong (null), THEN THE InternalOrderItem SHALL berperilaku persis seperti sebelum spec ini ada — tidak ada perubahan perilaku existing.
5. THE InternalOrderItem.item_id SHALL tetap wajib diisi meskipun `referenceable` terisi, sama pola Spec 7a (baris jasa: ItemVariant pilihan manual; baris part: ItemVariant diturunkan dari `AssetServiceConsumedItem.item`).

### Requirement 2: Gating — InternalOrder hanya untuk AssetService yang sudah approved

**User Story:** As an Inventory/Service staff, I want sistem menolak pembuatan baris InternalOrder untuk AssetService yang belum disetujui, so that permintaan internal tidak dibuat untuk pekerjaan yang masih bisa berubah.

#### Acceptance Criteria

1. WHEN user membuat InternalOrderItem dengan `referenceable_type=AssetService`, THE sistem SHALL menolak jika `AssetService.status` TIDAK mengandung `FormStatus::APPROVED`.
2. WHEN user membuat InternalOrderItem dengan `referenceable_type=AssetServiceConsumedItem`, THE sistem SHALL menolak jika status AssetService pemilik consumed item tersebut TIDAK mengandung `FormStatus::APPROVED`.
3. THE validasi 1:1 pemakaian AssetServiceConsumedItem (Requirement 1.3) SHALL memeriksa GABUNGAN `SalesOrderItem` dan `InternalOrderItem` — satu consumed item yang sudah dipakai baris SalesOrderItem TIDAK boleh dipakai lagi oleh InternalOrderItem manapun, dan sebaliknya.

### Requirement 3: DeliveryNote — stok part & skip baris jasa

**User Story:** As an Inventory staff, I want DeliveryNote untuk InternalOrder memperlakukan baris part dan baris jasa AssetService persis sama seperti jalur SalesOrder, so that tidak ada logic ganda/tidak konsisten antara dua jalur.

#### Acceptance Criteria

1. THE `DeliveryNoteService::onApproved()` SHALL memperlakukan baris jasa (referenceable ke `AssetService`) yang berasal dari `InternalOrderItem` SAMA seperti dari `SalesOrderItem` — di-skip total dari Stock/StockLedgerEntry, hanya increment `delivered_quantity`.
2. **Perbaikan wajib**: kondisi existing di `DeliveryNoteService.php` (`$item->referenceable instanceof SalesOrderItem && ...`) SHALL diperluas menjadi `($item->referenceable instanceof SalesOrderItem || $item->referenceable instanceof InternalOrderItem) && ...` — TANPA perbaikan ini, baris jasa InternalOrder akan salah masuk jalur stock standar (bug).
3. WHEN DeliveryNote (berisi baris part InternalOrder, referenceable ke `AssetServiceConsumedItem`) di-approve, THE sistem SHALL mengurangi stok mengikuti mekanisme StockLedgerEntry standar (sudah otomatis lewat jalur existing `InternalOrderItem` sebagai `ItemVariant` biasa — tidak ada kode baru diperlukan di sini, hanya di poin 3.2).
4. Validasi `DeliveryNoteItem.quantity` tidak melebihi `AssetServiceConsumedItem.quantity` (sama seperti Spec 7a Requirement 8.1) SHALL berlaku juga untuk baris yang referenceable-nya berasal dari `InternalOrderItem`.

### Requirement 4: Tidak ada billing

**User Story:** As a developer, I want memastikan tidak ada mekanisme billing apapun untuk InternalOrder, so that jelas InternalOrder murni permintaan internal tanpa nilai uang.

#### Acceptance Criteria

1. THE InternalOrder/InternalOrderItem SHALL TIDAK mendapat kolom `price`/billing apapun (sudah demikian, tidak berubah).
2. THE spec ini SHALL TIDAK membuat SalesInvoice atau dokumen billing apapun dari InternalOrder.
3. THE `AssetService.bill_to_renter`/`customer_id`/`customer_branch_id` (Spec 7a) SHALL TIDAK relevan/tidak dipakai sama sekali di jalur InternalOrder — AssetService yang diminta lewat InternalOrder selalu dianggap tanpa billing, terlepas dari `bill_to_renter`.

### Requirement 5: Batas domain Asset (sama Spec 7a)

**User Story:** As a developer, I want AssetService dan AssetServiceConsumedItem tetap tidak mengetahui dokumen transaksi Sales/Inventory apapun, so that domain boundary tetap konsisten dengan Spec 7a.

#### Acceptance Criteria

1. THE AssetService/AssetServiceConsumedItem model SHALL TIDAK mendapat field/relasi baru yang menunjuk ke InternalOrder/InternalOrderItem/DeliveryNote apapun.
2. Semua relasi/referensi SHALL berasal dari sisi Sales/Inventory (InternalOrderItem, DeliveryNoteItem) menunjuk KE Asset domain, bukan sebaliknya.

## Non-Goals

1. Penghapusan `WorkOrder` (model, controller, route, FE) — keputusan sudah diambil (hapus), tapi eksekusinya DITUNDA sampai spec Procurement (sub-area berikutnya) juga selesai. Investigasi WorkOrder di dokumen ini murni konteks/latar belakang.
2. Perbaikan pipeline quantity `WorkOrderItem` (`ordered_quantity` dst) — tidak relevan lagi karena WorkOrder akan dihapus, bukan diperbaiki.
3. Procurement otomatis (PurchaseRequest/PurchaseOrder) untuk part kurang stok — spec terpisah berikutnya.
4. Perubahan pada `InternalOrder`/`InternalOrderItem` untuk kasus ItemVariant biasa (non-referenceable) — perilaku existing harus 100% tidak berubah.
5. UI/FE untuk memilih "jenis permintaan" (internal vs customer) di satu form gabungan — InternalOrder dan SalesOrder tetap dokumen terpisah seperti sekarang, user memilih dokumen mana yang dibuat, bukan toggle dalam 1 form.
