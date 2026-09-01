# Design Document: Asset Service Billing Reference Flow

## Overview

Redesain UX referensi billing `AssetService`/`AssetServiceConsumedItem` pada `SalesOrder` dan `InternalOrder`. Implementasi hari ini (spec `asset-service-billing` Req 4.5/7.1-7.2/9.2) menaruh picker `referenceable` opsional di level BARIS (`SalesOrderItem`/`InternalOrderItem` FormTable) — user manual memilih `AssetService` (baris jasa) atau `AssetServiceConsumedItem` (baris part) lewat toggle nested LinkModel per baris.

Redesain ini memindahkan entry point ke level DOKUMEN: SalesOrder/InternalOrder dibuat DARI sebuah `AssetService` tertentu (lewat flow "create from source" baru, meniru pola existing Quotation/WorkOrder), yang lalu mengendalikan filter Item dan auto-fill baris secara otomatis. Kolom picker per-baris dihapus sepenuhnya.

## Tidak Ada Kolom/Migration Baru

Field `referenceable_type`/`referenceable_id` (level DOKUMEN, bukan level baris) yang SUDAH ADA di `sales_orders` dan `internal_orders` — saat ini dipakai untuk mencatat "order ini dibuat dari Quotation/WorkOrder", ditampilkan read-only di FE sebagai "Reference To" (`t("sales.salesOrder.columns.reference_to")`) — DIPAKAI ULANG untuk kasus AssetService juga. Kedua use-case ini saling eksklusif pada praktiknya, jadi field yang sama merepresentasikan keduanya, dibedakan lewat nilai class `referenceable_type` saat dibaca. Perilaku/tampilan field ini di FE TIDAK BERUBAH (tetap render `LinkModel` read-only) — tidak ada perubahan FE untuk field itu sendiri.

## Entry Point Baru

Tambah tombol di `resources/js/Pages/Asset/Services/Show.jsx` ("Buat Sales Order" / "Buat Internal Order") yang mengarah ke `route('salesOrders.create', {ref: 'assetService/{id}'})` dan padanannya untuk InternalOrder.

## Backend — Controller `create()`

Tambah `case 'assetService':` baru pada switch `$modelOri` di `SalesOrderController::create()` dan `InternalOrderController::create()` (di samping case existing untuk ref type lain), mengeset:

- `defaultData['referenceable_type'] = AssetService::class`
- `defaultData['referenceable_id'] = $svc->id`
- `defaultData['referenceable'] = $svc`
- `defaultData['items']` di-prefill dari `$svc->consumedItems`, meniru pola `PurchaseRequestController::create()` case `'assetService'` yang sudah ada dan berfungsi: setiap consumedItem dipetakan jadi baris dengan `id` (generated), `item` (ItemVariant milik consumedItem), `quantity`, `unit`, `referenceable` (consumedItem itu sendiri), `referenceable_type: AssetServiceConsumedItem::class`, `referenceable_id`.

## FE — Hapus Kolom Per-Baris

Hapus sepenuhnya kolom FormTable "Asset Service (opsional)" (`referenceable`) dari `resources/js/Pages/Sales/SalesOrders/Form.jsx` dan `resources/js/Pages/Sales/InternalOrders/Form.jsx`, termasuk kode picker `AssetServiceLinkModel`/`AssetServiceConsumedItemLinkModel` hari ini, helper `resolveAssetServiceBillingCustomer()`, dan konstanta `ASSET_SERVICE_BILLING_CUSTOMER_WITH`. Logic ini DIPINDAH (lihat bagian relokasi di bawah), bukan dibuang.

## FE — Filter Kolom Item

Saat `data.referenceable_type === AssetService::class` (referensi level header sudah diset), filter `ItemVariantLinkModel` (kolom "Item" baris) supaya hanya menampilkan ItemVariant yang:
- Item induknya `type=service` (kategori Jasa/Service), ATAU
- id-nya termasuk dalam daftar `item_id` milik `consumedItems` AssetService header.

## FE — Aturan Lock Baris

**Baris hasil PRE-FILL** (dari `consumedItems` via flow create-from-ref):
- Field Item: locked/disabled.
- Field Quantity: locked/disabled.
- Price: tetap PREFILLED tapi user-editable (perilaku Req 9.2 existing: `price = valuation_rate`, user tetap bisa ubah manual).
- Source Warehouse: field normal, TIDAK locked, TIDAK diprefill khusus — user isi manual seperti biasa.

**Baris yang ditambahkan MANUAL oleh user** (via Item picker yang sudah difilter):
- Kalau ItemVariant yang dipilih `type=service` → auto-set `referenceable_type=AssetService`, `referenceable_id=<id AssetService header>`; baris ini TIDAK di-lock (user masih bisa ganti item jasa lain).
- Kalau ItemVariant yang dipilih cocok TEPAT SATU `AssetServiceConsumedItem` milik AssetService header (diasumsikan selalu tidak ambigu — tidak ada desain untuk menangani banyak kecocokan; kasus itu dianggap dicegah di tempat lain, mis. validasi masa depan yang mencegah ItemVariant duplikat antar consumedItem dalam satu AssetService) → auto-link `referenceable_type=AssetServiceConsumedItem`, `referenceable_id=<consumed item tsb>`, auto-fill quantity+price dari situ, dan begitu resolve dengan cara ini, baris tsb LANGSUNG menerima perlakuan lock yang SAMA seperti baris pre-fill (Item + Quantity locked), demi konsistensi terlepas dari bagaimana baris itu sampai ke state tersebut.

## FE — Relokasi Logic Auto-Fill Hari Ini

Logic 4.5 (derivasi item/unit/conversion_factor), 7.1-7.2 (prefill customer), dan 9.2 (prefill price, SalesOrder saja — InternalOrderItem tidak punya field `price`) — ATURAN RESOLUSI SAMA seperti yang dibangun hari ini — sekarang dipicu dari `onValueChange` kolom Item (`ItemVariantLinkModel`), bukan dari picker referenceable per-baris (yang dihapus).

Batasan kedalaman `with` 2-segmen (didokumentasikan di memory `reference_linkmodel_search_endpoint_constraints.md`) tetap berlaku: untuk "baris part" (item yang cocok ke consumedItem), hanya path prefill customer `bill_to_renter` (`assetService.customer`/`assetService.customerBranch`, 2 segmen) yang reliable; path `ownership_customer` butuh 3 segmen (`assetService.asset.ownershipCustomer`) dan TIDAK reliable didukung — batasan yang sama seperti implementasi hari ini, dibawa terus tanpa perubahan. Untuk "baris jasa" (item `type=service`, langsung terhubung ke AssetService header), kedua path (bill_to_renter DAN ownership_customer) tetap bekerja karena keduanya maksimal 2 segmen dari root AssetService.

## Backend — Validasi Tidak Berubah

`SalesOrderRequest::validateAssetServiceReferenceables()` (cek status approved pada AssetService/consumedItem terkait, dan constraint uniqueness 1:1 untuk AssetServiceConsumedItem lintas SalesOrderItem+InternalOrderItem) TIDAK PERLU perubahan — validasi ini bekerja pada nilai `items.*.referenceable.type/id` apapun yang datang di request payload, terlepas dari flow UI mana yang menghasilkannya (auto-derive client-side sekarang, vs manual-pick sebelumnya).

## Scope

SalesOrder DAN InternalOrder mendapat redesain ini SEKALIGUS (tidak bertahap).

## Testing Strategy

- Feature test controller `create()` case `'assetService'` untuk kedua controller: verifikasi `referenceable_type`/`referenceable_id`/`items` ter-prefill benar dari `consumedItems`.
- Feature test FE-level (RTL) untuk filter Item: hanya menampilkan ItemVariant `type=service` atau anggota `consumedItems`.
- Feature test lock behavior: baris pre-fill dan baris manual-resolved-to-consumedItem sama-sama locked Item+Quantity; baris manual `type=service` tidak locked.
- Regression: `SalesOrderRequest`/`InternalOrderRequest` validasi tetap lulus tanpa perubahan (test existing dari spec `asset-service-billing`).
