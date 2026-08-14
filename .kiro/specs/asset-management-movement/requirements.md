# Requirements Document

## Introduction

Modul Asset Management (mirip ERPNext) sudah punya Spec 1 (`asset-management-core` — Asset/AssetCategory/AssetLocation), Spec 2 (`asset-management-purchase-integration` — auto-create Asset dari Purchase), dan Spec 3 (`asset-management-depreciation` — kalkulasi depresiasi + posting GL). Ketiganya sudah selesai diimplementasikan.

Saat ini, satu-satunya cara mengubah `Asset.asset_location_id`/custodian adalah edit langsung field Asset — tidak ada jejak audit siapa yang memindahkan aset, kapan, dan dari/ke mana. Spec ini menambahkan `AssetMovement` sebagai dokumen submittable dedicated untuk mencatat perpindahan Asset (transfer internal, keluar sementara/issue, kembali/receipt), dengan approval chain sebelum efektif — konsisten pola `Submitable` yang dipakai Asset/SalesOrder/PurchaseOrder.

Spec ini SENGAJA dibatasi hanya pada mekanisme Movement generik. Fitur terkait yang semula direncanakan bergabung (AssetMaintenance/AssetRepair, Report, dan perbaikan sistem rental `SalesOrder.is_rent` dari Item-based ke Asset-based) DIPISAH menjadi spec-spec berikutnya (Spec 5 dan Spec 6) — rental fix khususnya menyentuh fitur produksi aktif (`rental-actual-duration`, sudah live, dipakai billing staff harian) sehingga butuh spec dan testing tersendiri, tidak digabung dengan pekerjaan Movement yang murni baru.

## Glossary

- **AssetMovement**: dokumen submittable header yang mencatat 1 kejadian perpindahan (bisa mencakup banyak Asset sekaligus lewat item).
- **AssetMovementItem**: baris child di dalam AssetMovement, 1 baris = 1 Asset yang dipindahkan.
- **Purpose**: jenis perpindahan — `issue` (Asset keluar dari lokasi internal ke lokasi lain, mis. dipinjamkan), `receipt` (Asset kembali), `transfer` (pindah antar lokasi internal), `transfer_and_issue` (kombinasi keduanya dalam 1 dokumen).
- **Custodian**: user yang menjadi penanggung jawab operasional Asset (field `custodian_id` di model Asset, sudah ada sejak Spec 1).

## Requirements

### Requirement 1: Model AssetMovement dan AssetMovementItem

**User Story:** As a Asset/Inventory staff, I want mencatat perpindahan Asset sebagai dokumen formal dengan detail per-Asset, so that ada jejak audit siapa memindahkan apa, kapan, dari mana ke mana.

#### Acceptance Criteria

1. THE system SHALL menyediakan model `AssetMovement` dengan field: `code` (via `FormatingSeries`), `purpose` (enum: `issue`/`receipt`/`transfer`/`transfer_and_issue`), `transaction_date`, `branch_id`, `reference_type`/`reference_id` (nullable, morphTo generik untuk integrasi dokumen pemicu di spec masa depan).
2. THE system SHALL menyediakan model `AssetMovementItem` sebagai child table dari `AssetMovement`, dengan field: `asset_id` (FK → Asset), `source_location_id`/`target_location_id` (FK nullable → AssetLocation), `from_custodian_id`/`to_custodian_id` (FK nullable → User).
3. THE `AssetMovement` model SHALL menggunakan trait `Submitable` penuh, termasuk approval chain wajib (`AssetMovementService implements SubmitableService`) — konsisten pola Asset/SalesOrder/PurchaseOrder.
4. WHEN 1 AssetMovement disimpan, THE system SHALL mengizinkan banyak `AssetMovementItem` sekaligus dalam 1 dokumen (1 Movement bisa memindahkan banyak Asset).

### Requirement 2: Validasi konsistensi lokasi per purpose

**User Story:** As a Asset staff, I want sistem menolak input source/target lokasi yang tidak sesuai kondisi Asset saat ini, so that data lokasi Asset tidak menjadi tidak konsisten akibat kesalahan input.

#### Acceptance Criteria

1. WHEN purpose = `transfer` atau `transfer_and_issue`, THE system SHALL mewajibkan `source_location_id` dan `target_location_id` terisi pada tiap `AssetMovementItem`.
2. WHEN purpose = `issue`, THE system SHALL mewajibkan `target_location_id` terisi (lokasi tujuan, termasuk lokasi eksternal yang direpresentasikan sebagai record `AssetLocation`).
3. WHEN purpose = `receipt`, THE system SHALL mewajibkan `source_location_id` terisi (lokasi asal Asset kembali).
4. THE system SHALL memvalidasi bahwa `source_location_id` pada tiap `AssetMovementItem` sama dengan `Asset.asset_location_id` milik Asset tersebut pada saat submit — JIKA berbeda, submit SHALL ditolak dengan pesan error yang jelas.
5. THE system SHALL memvalidasi bahwa Asset yang direferensikan di `AssetMovementItem` berstatus `ACTIVE` sebelum bisa disertakan dalam AssetMovement apapun — Asset berstatus lain (draft/scrapped/sold/in_maintenance/dst) SHALL ditolak.

### Requirement 3: Efek approval terhadap data Asset (Event/Listener)

**User Story:** As a System Administrator, I want perubahan lokasi/custodian Asset baru terjadi setelah AssetMovement disetujui penuh (bukan saat draft), so that data Asset selalu mencerminkan status yang sudah disahkan, konsisten dengan pola approval dokumen lain.

#### Acceptance Criteria

1. WHEN AssetMovement disetujui penuh (approval chain selesai, dalam transaksi yang sama dengan `Submitable::checkApproval()`), THE system SHALL dispatch event `AssetMovementApproved`.
2. THE system SHALL menangani event tersebut lewat listener `ShouldQueue` (`UpdateAssetLocationFromMovement`) yang, untuk tiap `AssetMovementItem`: mengupdate `Asset.asset_location_id` menjadi `target_location_id` (jika ada) dan `Asset.custodian_id` menjadi `to_custodian_id` (jika ada).
3. WHEN purpose = `issue` atau `transfer_and_issue`, THE listener SHALL menambahkan status `ISSUED` ke `Asset.status` (array `FormStatus`, tidak menghapus status lain yang relevan).
4. WHEN purpose = `receipt`, THE listener SHALL menghapus status `ISSUED` dari `Asset.status` jika ada, mengembalikan Asset ke kondisi dapat dipakai normal.
5. THE system SHALL TIDAK memperkenalkan status "in transit" — tidak ada state intermediate antara lokasi asal dan lokasi tujuan; efek lokasi terjadi sekaligus pada titik approval selesai.

### Requirement 4: Pencegahan draft Asset duplikat oleh user yang sama

**User Story:** As a Asset staff, I want sistem mengarahkan saya ke draft AssetMovement yang sudah ada untuk Asset yang sama (jika saya sendiri yang membuatnya), so that saya tidak membuat draft duplikat tanpa sadar untuk Asset yang sama.

#### Acceptance Criteria

1. WHEN user membuka form pembuatan AssetMovement baru dengan Asset tertentu sudah dipilih (mis. lewat parameter query), THE system SHALL memeriksa apakah ada `AssetMovement` lain yang: berstatus draft, dibuat oleh user yang sama (`created_by_id`), dan memiliki `AssetMovementItem` yang mereferensikan Asset yang sama.
2. IF ditemukan draft yang cocok, THEN THE system SHALL me-redirect user ke halaman show draft tersebut, bukan menampilkan form pembuatan baru.
3. THE system SHALL TIDAK mengunci Asset dari digunakan oleh AssetMovement draft milik user LAIN secara bersamaan — mekanisme ini murni pencegahan duplikasi oleh user yang sama, bukan penguncian data lintas user.

### Requirement 5: Cakupan FE dan lang

**User Story:** As a Asset staff, I want mengelola AssetMovement lewat antarmuka web standar (list, form, detail), so that saya bisa memakai fitur ini tanpa akses langsung ke database.

#### Acceptance Criteria

1. THE system SHALL menyediakan halaman Index (list dengan DataTable), Form (create/edit), dan Show (detail + aksi submit/approve/cancel) untuk AssetMovement, mengikuti pola FE Submitable existing (mis. `Asset/Assets`).
2. THE system SHALL mendaftarkan seluruh string lang baru yang dipakai (pesan error validasi, label field) ke `lang/en/asset/movement.php` dan `lang/id/asset/movement.php`.
3. THE system SHALL menambahkan item navigasi "Asset Movements" ke grup sidebar "Assets" yang sudah ada.

## Di Luar Cakupan (Explicit Non-Goals)

- AssetMaintenanceTeam/AssetMaintenance/AssetMaintenanceTask/AssetRepair — didefer ke Spec 5.
- Perbaikan sistem rental (`SalesOrder.is_rent` dari Item-based ke Asset-based) — didefer ke Spec 6, bergantung pada AssetMovement dari spec ini.
- Report (Asset Register, Movement History) — didefer sebagai pengembangan lanjutan tanpa nomor spec pasti, dicatat di memory project.
- Status "in transit"/tracking pengiriman fisik real-time — tidak dimodelkan, lihat Requirement 3.5.
- Penguncian Asset lintas user pada AssetMovement draft — lihat Requirement 4.3, hanya pencegahan duplikasi per-user.
