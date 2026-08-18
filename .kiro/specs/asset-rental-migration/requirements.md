# Requirements Document

## Introduction

Sistem rental SalesOrder saat ini (`SalesOrder.is_rent`) berbasis `ItemVariant` — gate kelayakan hardcode `$item->item->type == 'vehicle'` di `DeliveryNoteService.php:185`, tracking pengembalian via `DeliveryNote.return_against_id`. Item tracked by kuantitas agregat, bukan unit fisik individual — tidak bisa lacak unit spesifik (kondisi, custodian, riwayat) dan tidak terhubung ke nilai buku/depresiasi Asset.

Modul Asset Management (Spec 1-5) sudah menyediakan `Asset` sebagai representasi unit fisik individual dengan `AssetCategory.is_rentable`, `Item.is_fixed_asset` (Spec 2, arah Purchase→Asset), status lifecycle (`FormStatus`), dan method transisi status dedicated (`setOutOfOrder()`, `setInMaintenance()`, dst). Ketiga field ini BELUM terhubung ke gate rental SO manapun — dua sistem rental (Item-based lama, Asset-based baru) saat ini terpisah total.

**Keputusan arsitektur kunci (hasil brainstorming, revisi dari draft awal)**: `SalesOrder`/`SalesOrderItem` TIDAK BERUBAH SAMA SEKALI — tetap murni `ItemVariant`-based seperti sekarang. SO hanya menyatakan "baris ini butuh N unit dari Item fixed-asset X" (kuantitas), BUKAN menunjuk unit `Asset` fisik tertentu — identik dengan cara SO menangani barang stok biasa (unit/serial spesifik resolve di level DeliveryNote, bukan di SO). Unit `Asset` spesifik dipilih user BELAKANGAN, di level `DeliveryNoteItem` (dan `SalesInvoiceItem` untuk kasus jual-putus) lewat child table baru — BUKAN kolom `asset_id` langsung di `SalesOrderItem` (draft awal spec ini sempat mengusulkan itu, DIBATALKAN setelah dianalisis dari sudut pandang developer/user/bisnis: tidak perlu UI toggle Item/Asset di SO, konsisten mental model SO existing, tidak perlu mekanisme reservasi/booking Asset baru di level SO — availability dicek natural saat DN).

**Keputusan arsitektur kunci 2 — quantity parsial**: Satu `Asset` bisa punya `asset_quantity > 1` (Asset "bulk", mis. 50 kursi kantor dalam 1 baris Asset — lihat Spec 1 "Field Asset Utama"), diizinkan HANYA kalau kategori Asset punya `AssetCategory.allow_bulk_quantity = true` (field baru — **SUDAH DIIMPLEMENTASI** di sesi brainstorming ini, lihat Requirement 0). Karena satu `DeliveryNoteItem`/`SalesInvoiceItem` (kuantitas > 1) tidak bisa direpresentasikan 1 FK `asset_id` tunggal, dibutuhkan child table (`DeliveryNoteItemAsset`, `SalesInvoiceItemAsset`) berisi daftar Asset + kuantitas parsial per Asset yang mengisi baris tsb. `Asset` sendiri dapat 2 kolom counter baru (`rental_quantity`, `sold_quantity`) untuk mencegah over-transaksi lintas dokumen, dan status Asset dapat 2 case baru (`PARTIALLY_RENTED`, `PARTIALLY_SOLD`) untuk merepresentasikan kondisi campuran (sebagian keluar, sebagian masih available) — selaras prinsip array-status yang sudah diputuskan sejak Spec 1.

Untuk Asset rental (SELALU `asset_quantity=1`, dipaksa validasi existing sejak Spec 1), child table ini secara natural collapse jadi 1 baris (`quantity=1`) — behavior binary lama (ACTIVE↔IN_RENT) tetap berlaku tanpa perubahan tambahan untuk kasus paling umum ini.

Selama brainstorming ditemukan gap terkait: `Asset::sell()` (Spec 1) masih stub (`throw LogicException`) — belum ada spec yang mengimplementasikan alur jual-putus Asset. Karena mekanisme child table Asset yang sama dipakai baik untuk rental (`SalesOrder.is_rent=true`) maupun jual-putus (`SalesOrder.is_rent=false`), spec ini SEKALIGUS mengimplementasikan `Asset::sell()`.

**Di luar scope (didefer ke Spec 7 — AssetService billing/procurement, lihat memory `project_asset_management_module_plan`):**
- Integrasi `AssetService` (repair/maintenance) ke SalesOrder/SalesInvoice/DeliveryNote/InternalOrder/PurchaseRequest/PurchaseOrder.
- Migrasi/penggantian `App\Models\Service\WorkOrder`.
- Backfill data historis — SO rental Item-based yang sudah ada TETAP apa adanya, tidak dikonversi ke Asset.
- Mekanisme reservasi/booking Asset bertanggal (mis. "booked mulai tanggal X") — masalah calendar/booking beda kelas, bukan bagian spec ini (lihat Requirement 3).

## Glossary

- **Item Fixed-Asset**: `ItemVariant` yang `Item.is_fixed_asset = true` (field existing sejak Spec 2) — SO tetap pilih ini seperti barang biasa, tapi baris DN/SI-nya nanti butuh child table Asset.
- **DeliveryNoteItemAsset / SalesInvoiceItemAsset**: Child table baru — daftar Asset spesifik + kuantitas parsial yang mengisi satu baris `DeliveryNoteItem`/`SalesInvoiceItem`. Sum kuantitas child harus sama dengan kuantitas baris induk.
- **Baris Rental**: Child row Asset pada DN/SI dari SO dengan `is_rent = true` — Asset diharapkan kembali (ada DN retur menyusul).
- **Baris Jual-Putus**: Child row Asset pada DN/SI dari SO dengan `is_rent = false` — Asset terjual permanen, tidak ada retur.
- **Available Quantity**: `Asset.asset_quantity - Asset.rental_quantity - Asset.sold_quantity` (accessor turunan, tidak disimpan) — sisa kuantitas Asset yang belum disewakan/dijual, dipakai sbg satu-satunya guard availability.
- **Serah-terima Fisik**: peran `DeliveryNote` untuk baris Asset (rental maupun jual-putus) — dokumen bukti kirim/kembali, TANPA logic Stock/StockLedgerEntry (beda dari baris barang biasa yang tetap decrement Stock).

## Requirements

### Requirement 0: AssetCategory.allow_bulk_quantity (SUDAH DIIMPLEMENTASI)

**User Story:** As an Asset manager, I want menandai kategori Asset mana yang boleh punya kuantitas lebih dari 1 per baris, so that aturan kuantitas eksplisit per kategori, bukan implisit dari flag lain.

#### Acceptance Criteria

1. THE AssetCategory SHALL memiliki kolom `allow_bulk_quantity` (boolean, default false).
2. THE Asset SHALL menolak (`LogicException`) `asset_quantity > 1` KECUALI kategorinya `allow_bulk_quantity = true` — validasi ini MENGGANTIKAN validasi lama yang mengizinkan kuantitas > 1 secara implisit untuk semua kategori non-rentable.
3. Status: SUDAH DIIMPLEMENTASI (migration, model cast, validasi `Asset::booted()`, `AssetCategoryRequest`, lang en/id, FE checkbox `Categories/Form.jsx`, test unit) — lihat commit terkait.

### Requirement 1: DeliveryNoteItem mendukung child table Asset (rental maupun jual-putus)

**User Story:** As a Warehouse/Sales staff, I want memilih Asset spesifik (bisa lebih dari satu, dengan kuantitas parsial) saat membuat DeliveryNote untuk baris Item fixed-asset, so that unit fisik yang disewakan/dijual tertelusur individual meski SO cuma menyatakan kuantitas.

#### Acceptance Criteria

1. THE DeliveryNoteItem SHALL memiliki relasi child table baru `DeliveryNoteItemAsset` (`asset_id`, `quantity`) — TIDAK ADA kolom `asset_id` langsung di `DeliveryNoteItem` maupun `SalesOrderItem`.
2. WHEN baris DeliveryNoteItem berasal dari Item fixed-asset (`Item.is_fixed_asset = true`), THE sistem SHALL memvalidasi `sum(DeliveryNoteItemAsset.quantity)` pada baris tsb SAMA DENGAN `DeliveryNoteItem.quantity` sebelum submit.
3. WHEN child row `asset_id` dipilih, THE sistem SHALL memvalidasi: (a) `Asset.assetCategory.is_rentable = true`, (b) `Asset.item_id` cocok dengan Item pada baris induk, (c) `quantity` yang diminta TIDAK melebihi `Asset` available quantity saat itu (lihat Glossary) — baris DITOLAK jika salah satu gagal.
4. THE gate rental lama (`$item->item->type == 'vehicle'` di `DeliveryNoteService.php:185`) SHALL dihapus total — validasi kelayakan sepenuhnya berpindah ke Acceptance Criteria 3(a).
5. WHEN DeliveryNoteItem memiliki child `DeliveryNoteItemAsset` (satu atau lebih), THE sistem SHALL TIDAK membuat/mengubah `StockLedgerEntry` untuk baris tersebut — logic Stock sepenuhnya di-skip.
6. THE sistem SHALL TIDAK mengubah logic Stock/StockLedgerEntry untuk `DeliveryNoteItem` dari Item bukan fixed-asset — perilaku existing dipertahankan penuh.
7. WHEN DeliveryNote retur dibuat (create-from-source dari DN pengiriman awal), THE sistem SHALL menyalin `DeliveryNoteItemAsset` (asset_id + quantity) dari DN asal — user TIDAK memilih ulang Asset, tapi BOLEH mengurangi `quantity` per baris (retur sebagian).

### Requirement 2: Transisi status & kuantitas Asset — rental

**User Story:** As an Asset manager, I want status dan kuantitas available Asset otomatis mencerminkan kondisi sedang disewakan atau sudah kembali, so that saya tidak perlu update manual dan availability Asset akurat termasuk untuk Asset kuantitas > 1.

#### Acceptance Criteria

1. THE Asset SHALL memiliki kolom `rental_quantity` (decimal, default 0) dan method `addRentedQuantity(float $quantity)` / `removeRentedQuantity(float $quantity)`.
2. WHEN DeliveryNote (bukan retur) untuk child row rental (SO `is_rent = true`) di-approve, THE sistem SHALL dispatch event per child row DAN listener sinkron SHALL memanggil `Asset::addRentedQuantity($row->quantity)`.
3. WHEN DeliveryNote retur untuk child row rental di-approve, THE sistem SHALL dispatch event per child row DAN listener sinkron SHALL memanggil `Asset::removeRentedQuantity($row->quantity)`.
4. THE status Asset SHALL mengandung `FormStatus::ACTIVE` SELAMA available quantity > 0, DITAMBAH `FormStatus::PARTIALLY_RENTED` (case baru) kalau `rental_quantity > 0` DAN available quantity masih > 0. WHEN available quantity mencapai 0 karena rental, THE status SHALL berisi `FormStatus::IN_RENT` (TANPA `ACTIVE`) — bukan case baru, status existing sejak sebelum modul Asset.
5. THE Asset::addRentedQuantity() SHALL menolak (`LogicException`) jika `quantity` yang diminta melebihi available quantity Asset saat itu — SATU-SATUNYA titik guard availability rental (tidak ada reservasi di level SO).

### Requirement 3: Implementasi Asset::sell() — jual putus dengan kuantitas parsial

**User Story:** As a Sales/Finance staff, I want menjual Asset (termasuk sebagian dari Asset berkuantitas > 1) lewat alur SalesOrder yang sudah dikenal, so that penjualan Asset konsisten dengan alur penjualan barang lain dan tercatat gain/loss on disposal-nya secara proporsional.

#### Acceptance Criteria

1. THE Asset SHALL memiliki kolom `sold_quantity` (decimal, default 0) dan method `addSoldQuantity(float $quantity)` — MENGGANTIKAN stub `Asset::sell()` lama (`throw LogicException`), signature method lama tetap dipertahankan sbg one-shot alias (jual seluruh sisa available quantity sekaligus).
2. WHEN DeliveryNote untuk child row jual-putus (SO `is_rent = false`) di-approve, THE sistem SHALL dispatch event per child row DAN listener sinkron SHALL memanggil `Asset::addSoldQuantity($row->quantity)` — HANYA mengubah `sold_quantity`/status Asset, TIDAK menghitung gain/loss atau posting GL pada titik ini.
3. THE SalesInvoiceItem SHALL memiliki child table `SalesInvoiceItemAsset` (`asset_id`, `quantity`), NULLABLE/boleh kosong saat SalesInvoice dibuat — SalesInvoice TETAP boleh disubmit dan di-approve walau child table masih kosong (billing tidak diblokir menunggu DeliveryNote/operasional gudang).
4. WHEN SalesInvoice di-approve DAN child row `SalesInvoiceItemAsset` sudah terisi saat itu, THE sistem SHALL dispatch event per child row untuk kalkulasi gain/loss (lihat Acceptance Criteria 6).
5. WHEN SalesInvoice SUDAH approved sebelumnya (child table kosong/sebagian) DAN child row baru ditambahkan kemudian (manual atau otomatis ter-link dari DeliveryNoteItemAsset yang match), THE sistem SHALL mendeteksi penambahan row baru pada SalesInvoice yang sudah approved DAN dispatch event yang sama seperti Acceptance Criteria 4 — TIDAK memerlukan re-approval SalesInvoice.
6. WHEN event dari Acceptance Criteria 4 atau 5 diterima, THE listener (queue) SHALL menghitung gain/loss on disposal secara PROPORSIONAL terhadap `quantity` child row (harga jual proporsional dikurangi `Asset::bookValue()` proporsional terhadap `quantity / Asset.asset_quantity`), mengisi `GlPostingStatus`, dan posting jurnal ke akun GL — mengikuti pola `scrap()`/`PostScrapWriteOff` (Spec 1/3) yang sudah ada. `Asset.disposal_date` SHALL diisi HANYA ketika available quantity Asset mencapai 0 (seluruh kuantitas sudah terjual).
7. THE Asset::addSoldQuantity() SHALL menolak (`LogicException`) jika `quantity` yang diminta melebihi available quantity Asset saat itu.
8. THE status Asset SHALL mengandung `FormStatus::ACTIVE` selama available quantity > 0, ditambah `FormStatus::PARTIALLY_SOLD` (case baru) kalau `sold_quantity > 0` dan available quantity masih > 0 — sama pola dengan Requirement 2.4, dan BOLEH terjadi kombinasi `[ACTIVE, PARTIALLY_RENTED, PARTIALLY_SOLD]` sekaligus untuk Asset yang sebagiannya disewa DAN sebagiannya dijual.
9. IF proses dari titik manapun (DN, atau listener gain/loss SI) dipicu berulang untuk child row yang SAMA (retry/race), THEN THE sistem SHALL TIDAK memproses efek samping (increment counter, posting GL) lebih dari satu kali per child row — dijamin guard idempotency per-row (bukan per-Asset).

### Requirement 4: RentalDurationService dan SalesOrder tidak berubah

**User Story:** As a System Administrator, I want fitur durasi sewa aktual yang sudah live, dan struktur SalesOrder yang sudah ada, tidak terpengaruh migrasi ini, so that risiko regresi pada fitur billing dan alur SO yang sudah dipakai staff minimal.

#### Acceptance Criteria

1. THE `RentalDurationService::calculateDuration()` SHALL TIDAK dimodifikasi sama sekali — tetap membaca relasi `SalesOrderItem::deliveryNoteItems()` dan `DeliveryNote.delivery_date` apa adanya, tidak peduli ada/tidaknya child table Asset pada baris.
2. THE `SalesInvoiceController::create()` prefill amount rental (dari spec `rental-actual-duration`) SHALL tetap berfungsi identik.
3. THE `app/Models/Sales/SalesOrder.php`, `SalesOrderItem.php`, `SalesOrderRequest.php`, dan `resources/js/Pages/Sales/SalesOrders/Form.jsx` SHALL TIDAK mendapat perubahan kode apapun dari spec ini.

### Requirement 5: Tidak mengubah cakupan existing

**User Story:** As a System Administrator, I want migrasi ini tidak mempengaruhi flow SalesOrder/DeliveryNote/SalesInvoice untuk baris barang biasa (non-Asset), so that risiko regresi minimal pada fitur produksi yang sudah berjalan.

#### Acceptance Criteria

1. THE sistem SHALL TIDAK mengubah logic Stock/StockLedgerEntry untuk `DeliveryNoteItem` dari Item bukan fixed-asset.
2. THE sistem SHALL TIDAK mengubah `AssetMovement` (Spec 4) — tetap digunakan hanya untuk perpindahan internal (Issue/Receipt/Transfer), TIDAK dipakai untuk alur rental/jual Sales.
3. Data SalesOrder/DeliveryNote rental Item-based existing (dibuat sebelum spec ini) SHALL TIDAK di-backfill atau dikonversi — dibiarkan apa adanya, tetap bisa dibaca untuk laporan historis.
4. THE sistem TIDAK melakukan reservasi/booking Asset apapun di level SalesOrder — konflik availability antar-dokumen terdeteksi natural saat DeliveryNote submit (Requirement 1.3c, 2.5, 3.7), bukan mekanisme baru di SO (lihat Introduction, Non-Goals).

## Non-Goals (Di Luar Cakupan Spec 6)

1. **Integrasi AssetService (repair/maintenance) ke SO/SI/DN/InternalOrder/PR/PO** — didefer ke Spec 7.
2. **Migrasi/penggantian `App\Models\Service\WorkOrder`** — didefer ke Spec 7.
3. **Backfill data historis** rental Item-based ke Asset.
4. **Recurring billing otomatis** — sudah eksplisit di luar scope `rental-actual-duration`, tetap di luar scope di sini.
5. **AssetMovement untuk alur Sales** — rental/jual Asset TIDAK memakai `AssetMovement`, memakai `DeliveryNote` dengan child table Asset (lihat Requirement 1).
6. **Perubahan apapun pada `SalesOrder`/`SalesOrderItem`** — lihat Requirement 4.3.
7. **Mekanisme reservasi/booking Asset bertanggal** — lihat Requirement 5.4 dan Introduction.
8. **UI `AssetCategoryAccount` yang belum ada sejak Spec 1** (`fixed_asset_account`, dst, termasuk `gain_loss_disposal_account_id` baru) — tetap diisi manual via seeder/tinker untuk testing, spec terpisah kalau perlu UI lengkap.
