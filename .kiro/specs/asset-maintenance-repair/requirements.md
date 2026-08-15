# Requirements Document

## Introduction

Modul Asset Management (Spec 1-4) sudah menangani siklus hidup dasar Asset (master data, integrasi Purchase, depresiasi, perpindahan lokasi/custodian). Spec 5 menambahkan domain **perawatan (maintenance) dan perbaikan (repair)** — dua aktivitas operasional yang membuat Asset keluar dari status `active` sementara waktu, lalu kembali lagi setelah pekerjaan selesai.

Sistem lama untuk kebutuhan serupa (`App\Models\Service\WorkOrder`) berbasis `ItemVariant` generik, tidak terhubung ke Asset sama sekali, dan pipeline-nya ke dokumen turunan (SO/Invoice/DeliveryNote/PR/PO) sudah rusak — field tracking kuantitas (`ordered_quantity`, `received_quantity`, dst) ada tapi tidak diisi oleh proses otomatis manapun. Spec 5 TIDAK memperbaiki pipeline itu (didefer ke Spec 6); fokusnya membangun fondasi model Asset-based yang bersih untuk maintenance dan repair, sebagai pengganti WorkOrder untuk skenario yang melibatkan Asset.

Selama brainstorming, ditemukan bahwa preventive maintenance (terjadwal, tim internal) dan corrective repair (insidental, akibat kerusakan) memiliki bentuk kerja aktual yang sangat mirip — keduanya butuh log aktivitas (siapa, kapan, apa yang dikerjakan), progress berbentuk checklist, dan bahan/part yang dipakai. Kesamaan ini digabung ke satu dokumen kerja `AssetService` (dengan pembeda `type`), TAPI jalur pembuatannya tetap berbeda: maintenance bersifat terjadwal/berulang (butuh lapisan template jadwal `AssetMaintenanceTask` sebelum `AssetService` dibuat), sedangkan repair bersifat insidental (langsung tertaut ke Asset, tanpa template jadwal maupun container).

## Glossary

- **AssetMaintenanceTeam**: Kelompok teknisi yang menangani perawatan banyak Asset sekaligus (beda dari `custodian_id` yang individual per-Asset).
- **AssetMaintenance**: Wadah tunggal per Asset (unique constraint) yang menaungi seluruh `AssetMaintenanceTask` untuk Asset tersebut. Bukan dokumen transaksional — murni container/grouping. Hanya relevan untuk jalur maintenance, TIDAK terlibat pada jalur repair.
- **AssetMaintenanceTask**: Child dari `AssetMaintenance`, berperan sebagai TEMPLATE jadwal perawatan berulang (`periodicity`, `next_due_date`, `assign_to_id`, `certificate_required`). Bukan DataTable — tidak punya halaman index/show/route sendiri, hanya dapat dibuat/diedit inline dari halaman show `AssetMaintenance`. Tiap kali periode jatuh tempo, task ini men-generate satu `AssetService` (`type=maintenance_task`).
- **AssetService**: Dokumen Submitable yang merepresentasikan pekerjaan kerja aktual — `type=maintenance_task` (digenerate dari satu `AssetMaintenanceTask`, tertaut via `asset_maintenance_task_id`) atau `type=repair` (dibuat langsung oleh user, tertaut langsung ke `asset_id`, tanpa melalui AssetMaintenance/AssetMaintenanceTask).
- **AssetServiceActivity**: Baris log kerja pada satu `AssetService` — sekaligus berfungsi sebagai item checklist (`is_done`). Hanya terlihat/dapat diisi setelah `AssetService` submitted dan approved.
- **AssetServiceConsumedItem**: Baris pencatatan biaya part/bahan yang dipakai dalam satu `AssetService` — pencatatan biaya saja, TIDAK memotong stok gudang (lihat Non-Goals).
- **Auto-approve**: Untuk `type=maintenance_task`, `submit()` melewati `checkApproval()` (mekanisme approval chain milik trait `Submitable`) dan langsung menetapkan status ke kondisi disetujui, baik saat dokumen pertama kali digenerate dari AssetMaintenanceTask maupun saat dokumen siklus berikutnya di-generate otomatis.

## Requirements

### Requirement 1: AssetMaintenanceTeam sebagai master data tim

**User Story:** As an asset manager, I want mendaftarkan tim maintenance beserta anggotanya, so that AssetService type maintenance_task dapat ditugaskan ke tim yang tepat.

#### Acceptance Criteria

1. THE AssetMaintenanceTeam SHALL memiliki `team_name` (unik), `manager_id` (FK ke User, nullable), dan `branch_id`.
2. THE AssetMaintenanceTeam SHALL memiliki daftar anggota melalui child table `MaintenanceTeamMember` (field minimal `user_id`).
3. AssetMaintenanceTeam TIDAK menggunakan trait Submitable — merupakan master data CRUD biasa.

### Requirement 2: AssetMaintenance sebagai container per Asset (khusus jalur maintenance)

**User Story:** As an asset manager, I want setiap Asset memiliki satu wadah jadwal maintenance, so that seluruh AssetMaintenanceTask untuk Asset itu terkumpul dan mudah ditelusuri.

#### Acceptance Criteria

1. THE AssetMaintenance SHALL memiliki `asset_id` dengan constraint unique — satu Asset hanya boleh memiliki satu record AssetMaintenance.
2. THE AssetMaintenance SHALL memiliki `maintenance_team_id` (FK ke AssetMaintenanceTeam).
3. THE AssetMaintenance SHALL memiliki relasi hasMany ke AssetMaintenanceTask.
4. WHEN user membuat AssetMaintenanceTask baru untuk sebuah Asset yang belum memiliki AssetMaintenance, THE sistem SHALL membuat record AssetMaintenance secara otomatis (get-or-create), tanpa mengharuskan user membuat AssetMaintenance secara manual terlebih dahulu.
5. AssetMaintenance TIDAK menggunakan trait Submitable — merupakan container, bukan dokumen transaksional.
6. AssetMaintenance TIDAK terlibat pada jalur `AssetService` type=repair — repair tertaut langsung ke Asset (lihat Requirement 4).

### Requirement 3: AssetMaintenanceTask sebagai template jadwal (child AssetMaintenance, bukan DataTable)

**User Story:** As an asset manager, I want mendefinisikan jadwal perawatan berulang (mis. servis oli tiap bulan) langsung dari halaman Asset Maintenance, so that AssetService untuk tiap periode dibuat otomatis tanpa saya mengulang input jadwal secara manual.

#### Acceptance Criteria

1. THE AssetMaintenanceTask SHALL memiliki `asset_maintenance_id` (FK ke AssetMaintenance, parent), `task_name`, `maintenance_type`, `periodicity`, `next_due_date`, `last_completion_date` (nullable), `assign_to_id` (FK ke User, nullable), `certificate_required` (boolean), dan `description`.
2. AssetMaintenanceTask SHALL TIDAK menggunakan trait `DataTable` — tidak memiliki route/controller/halaman index maupun show sendiri.
3. THE AssetMaintenanceTask SHALL hanya dapat dibuat, diubah, atau dihapus melalui halaman show `AssetMaintenance` (nested form/table), bukan melalui endpoint mandiri.
4. WHEN AssetMaintenanceTask baru dibuat oleh user, THE sistem SHALL langsung men-generate satu `AssetService` pertama dengan `type = maintenance_task`, tertaut ke AssetMaintenanceTask tersebut via `asset_maintenance_task_id`. Generate untuk siklus-siklus berikutnya terjadi event-driven saat AssetService sebelumnya selesai (lihat Requirement 6.3), BUKAN dari pengecekan `next_due_date` terjadwal (tidak ada scheduled command pada Spec 5).

### Requirement 4: AssetService sebagai dokumen kerja gabungan maintenance_task dan repair

**User Story:** As a maintenance technician atau asset manager, I want satu dokumen yang bisa merepresentasikan pekerjaan maintenance terjadwal maupun perbaikan insidental, so that alur kerja, log aktivitas, dan pelaporan konsisten untuk kedua jenis pekerjaan tanpa duplikasi struktur.

#### Acceptance Criteria

1. THE AssetService SHALL menggunakan trait Submitable dan field `type` (enum: `maintenance_task`, `repair`).
2. WHEN `type = maintenance_task`, THE AssetService SHALL memiliki `asset_maintenance_task_id` (FK ke AssetMaintenanceTask, wajib) DAN field `failure_date`/`capitalize_repair_cost` SHALL bernilai null. `asset_id` SHALL diturunkan dari `asset_maintenance_task_id.asset_maintenance.asset_id` (bukan diisi manual).
3. WHEN `type = repair`, THE AssetService SHALL memiliki `asset_id` (FK ke Asset, wajib, langsung — TIDAK melalui AssetMaintenance atau AssetMaintenanceTask) DAN field `failure_date` sebagai wajib, DAN field `asset_maintenance_task_id` SHALL bernilai null.
4. WHEN `type = repair` DAN AssetService `submit()` dipanggil, THE sistem SHALL memvalidasi Asset terkait TIDAK berstatus `work_in_progress`, `capitalized`, `fully_depreciated`, `sold`, `scrapped`, atau `canceled` — jika salah satu status tersebut aktif, submit SHALL ditolak dengan error.
5. WHEN `type = repair` DAN AssetService berhasil submit, THE sistem SHALL menjalankan approval chain normal (`checkApproval()`) DAN memanggil `Asset::setOutOfOrder()`.
6. WHEN `type = maintenance_task` DAN AssetService `submit()` dipanggil (baik saat pertama kali digenerate dari AssetMaintenanceTask maupun saat siklus berikutnya digenerate otomatis), THE sistem SHALL melewati `checkApproval()`, langsung menetapkan status ke kondisi disetujui, DAN memanggil `Asset::setInMaintenance()`.
7. IF `type = repair` DAN `capitalize_repair_cost = true` DAN AssetService dinyatakan selesai (lihat Requirement 6), THEN THE sistem SHALL menambahkan `total_repair_cost` ke `Asset.additional_asset_cost` DAN mengisi `Asset.increase_in_asset_life` jika disediakan.

### Requirement 5: AssetServiceActivity sebagai log kerja dan checklist

**User Story:** As a PIC/teknisi, I want mencatat setiap aktivitas yang dilakukan (tanggal, siapa, deskripsi) dan menandainya selesai satu per satu, so that progress pekerjaan transparan dan dapat dikonfirmasi sebelum dokumen ditutup.

#### Acceptance Criteria

1. THE AssetServiceActivity SHALL memiliki field `action_date`, `pic_id` (FK ke User), `description`, dan `is_done` (boolean, default false).
2. THE AssetServiceActivity SHALL hanya dapat diisi/diubah setelah AssetService berstatus submitted dan approved (baik `maintenance_task` yang auto-approve maupun `repair` yang melalui approval manual) — sebelum itu tab/section Activity Log SHALL tidak dapat diakses.
3. WHEN seluruh baris AssetServiceActivity pada satu AssetService memiliki `is_done = true`, THE sistem SHALL menampilkan dialog konfirmasi kepada user untuk menyatakan AssetService tersebut selesai.
4. THE AssetService SHALL dinyatakan selesai HANYA setelah user mengonfirmasi dialog pada Acceptance Criteria 3 — mencentang seluruh checklist saja TIDAK otomatis menyelesaikan dokumen tanpa konfirmasi eksplisit.

### Requirement 6: Penyelesaian AssetService dan efek ke Asset serta AssetMaintenanceTask

**User Story:** As an asset manager, I want status Asset otomatis kembali normal begitu pekerjaan maintenance/repair selesai dikonfirmasi, dan jadwal periode berikutnya otomatis terbentuk untuk maintenance, so that saya tidak perlu mengubah status Asset atau membuat AssetService berikutnya secara manual.

#### Acceptance Criteria

1. WHEN AssetService dikonfirmasi selesai (Requirement 5.4), THE sistem SHALL men-dispatch event `AssetServiceCompleted`.
2. THE sistem SHALL mendaftarkan listener sinkron (bukan queued) untuk `AssetServiceCompleted` yang memanggil `Asset::reactivate()` pada Asset terkait.
3. WHEN `type = maintenance_task` DAN AssetService dikonfirmasi selesai, THE sistem SHALL memperbarui `AssetMaintenanceTask.last_completion_date` (waktu konfirmasi) DAN men-generate satu AssetService baru dengan `type = maintenance_task` tertaut ke AssetMaintenanceTask yang sama, dengan `next_due_date` pada AssetMaintenanceTask dihitung ulang dari `last_completion_date` ditambah `periodicity`, DAN AssetService baru tersebut SHALL melalui alur auto-approve (Requirement 4.6).
4. WHEN `type = repair` DAN AssetService dikonfirmasi selesai, THE sistem TIDAK men-generate AssetService baru maupun AssetMaintenanceTask — repair adalah kejadian tunggal, bukan siklus berulang.

### Requirement 7: AssetServiceConsumedItem sebagai pencatatan biaya part

**User Story:** As an asset manager, I want mencatat item/part apa saja yang dipakai dalam satu pekerjaan maintenance atau repair beserta biayanya, so that saya dapat melihat total biaya pekerjaan meski belum ada integrasi stok penuh.

#### Acceptance Criteria

1. THE AssetServiceConsumedItem SHALL memiliki field `item_id` (FK ke Item), `quantity`, `valuation_rate`, dan `total_value` (computed = quantity × valuation_rate).
2. THE AssetServiceConsumedItem SHALL tersedia untuk kedua `type` (`maintenance_task` dan `repair`).
3. THE sistem TIDAK membuat StockLedgerEntry atau memotong stok gudang saat AssetServiceConsumedItem ditambahkan — murni pencatatan biaya (lihat Non-Goals).

### Requirement 8: Form dan tampilan FE mengikuti struktur dan type

**User Story:** As a user, I want form dan tabel menampilkan field yang relevan sesuai jenis pekerjaan dan level hierarki (AssetMaintenance/AssetMaintenanceTask/AssetService), so that saya tidak melihat field yang membingungkan/tidak relevan dan alur input mengikuti struktur data yang benar.

#### Acceptance Criteria

1. THE halaman show AssetMaintenance SHALL menampilkan nested form/table untuk mengelola AssetMaintenanceTask (create/edit/delete inline), sesuai Requirement 3.3 — TIDAK ada halaman/route index atau show terpisah untuk AssetMaintenanceTask.
2. THE Form AssetService SHALL menampilkan field secara kondisional berdasarkan `type` — field khusus `maintenance_task` (ditampilkan read-only dari AssetMaintenanceTask terkait: periodicity, next_due_date, assign_to_id, certificate_required) disembunyikan saat `type=repair`, dan sebaliknya field khusus `repair` (asset_id, failure_date, completion_date, capitalize_repair_cost) disembunyikan saat `type=maintenance_task`.
3. THE Activity Log SHALL ditampilkan dalam bentuk card yang dapat dibuka sebagai dialog, sesuai keputusan desain (lihat Requirement 5.2 untuk gating akses).

## Non-Goals (Di Luar Cakupan Spec 5)

Requirement berikut secara eksplisit TIDAK termasuk dalam Spec 5, didefer ke Spec 6:

1. **Integrasi SalesOrder/Invoice/DeliveryNote** untuk penagihan repair/maintenance ke customer.
2. **Integrasi InternalOrder/DeliveryNote** untuk permintaan internal.
3. **Integrasi PurchaseRequest/PurchaseOrder** untuk pengadaan part yang kurang stok.
4. **Pemotongan stok riil (StockLedgerEntry)** untuk AssetServiceConsumedItem — Spec 5 hanya mencatat biaya.
5. **Migrasi/penggantian `App\Models\Service\WorkOrder`** — WorkOrder existing tetap ada dan tidak disentuh Spec 5; investigasi root cause pipeline yang rusak dan desain penggantinya dilakukan di Spec 6.
