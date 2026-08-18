# Requirements Document

## Introduction

Modul Asset Management (Spec 1: `asset-management-core`) sudah menyediakan model `Asset` dengan field depresiasi flat (`calculate_depreciation`, `depreciation_method`, `frequency_of_depreciation`, `total_number_of_depreciations`, `expected_value_after_useful_life`, dst) tapi belum ada mekanisme yang benar-benar menghitung dan memposting depresiasi tersebut. Spec ini (Spec 3 dari 4 fase modul Asset Management) menambahkan:

1. **Kalkulasi depresiasi otomatis** — mendukung 4 metode (Straight Line, Double Declining Balance, Written Down Value, Manual), dijadwalkan lewat `AssetDepreciationSchedule` (baris pre-computed per periode) yang digenerate saat Asset disetujui (`onApproved()`).
2. **Posting jurnal berkala** — Artisan command terjadwal harian yang memposting baris schedule yang jatuh tempo ke `GeneralLedger`, mengikuti pola posting existing (`StockEntryService`).
3. **Write-off saat scrap** — saat Asset di-`scrap()`, sisa baris schedule yang belum posting dibatalkan dan diposting 1 jurnal write-off final.
4. **Revaluasi manual** (`AssetValueAdjustment`) — dokumen submittable terpisah untuk koreksi nilai buku Asset di luar siklus depresiasi normal (mis. appraisal ulang), dengan jejak audit jurnal.

Spec ini murni backend + posting akuntansi — TIDAK termasuk halaman FE baru kecuali ditentukan lain di task (lihat catatan scope di Requirement 7).

## Glossary

- **Depreciation Schedule**: rangkaian baris (`AssetDepreciationSchedule`) yang merepresentasikan proyeksi jumlah depresiasi per periode ke depan untuk 1 Asset, digenerate sekali saat Asset disetujui.
- **Posting**: proses membuat pasangan entri `GeneralLedger` (debit + credit) yang saling seimbang untuk 1 transaksi akuntansi.
- **Write-off**: jurnal penghapusan sisa nilai buku Asset (Accumulated Depreciation vs Fixed Asset account) saat Asset di-scrap sebelum masa depresiasi selesai.
- **Nilai buku (book value)**: `total_asset_cost - accumulated_depreciation_amount` pada suatu titik waktu.
- **Salvage value**: `expected_value_after_useful_life` — nilai sisa minimum yang tidak boleh dilewati oleh akumulasi depresiasi.
- **AssetCategoryAccount**: child table `AssetCategory` (sudah ada dari Spec 1) yang menyimpan akun GL per branch, termasuk `accumulated_depreciation_account_id` dan `depreciation_expense_account_id`.

## Requirements

### Requirement 1: Generate Depreciation Schedule saat Asset Disetujui

**User Story:** As a Finance staff, I want jadwal depresiasi otomatis terbentuk begitu Asset disetujui, so that saya bisa melihat proyeksi susut nilai Asset ke depan tanpa hitung manual.

#### Acceptance Criteria

1. WHEN `Asset.onApproved()` dipanggil AND `calculate_depreciation === true`, THE system SHALL generate baris `AssetDepreciationSchedule` sejumlah `total_number_of_depreciations`, masing-masing dengan `schedule_date` berjarak `frequency_of_depreciation` bulan dari `depreciation_start_date` (atau `available_for_use_date` jika `depreciation_start_date` kosong).
2. WHEN `Asset.onApproved()` dipanggil AND `calculate_depreciation === false`, THE system SHALL NOT generate baris schedule apapun.
3. THE system SHALL menghitung `depreciation_amount` tiap baris sesuai `depreciation_method` yang dipilih (lihat Requirement 2).
4. THE system SHALL memastikan akumulasi `accumulated_depreciation_amount` pada baris terakhir TIDAK melebihi `total_asset_cost - expected_value_after_useful_life` (salvage value floor).
5. IF `asset_type` bukan `existing_asset`, THEN THE system SHALL mulai perhitungan dari `opening_accumulated_depreciation` dan `opening_number_of_booked_depreciations` sebagai basis awal (bukan dari nol).
6. EACH baris `AssetDepreciationSchedule` SHALL disimpan dengan `posted = false` secara default.

### Requirement 2: Kalkulasi 4 Metode Depresiasi

**User Story:** As a Finance staff, I want sistem mendukung berbagai metode depresiasi standar akuntansi, so that saya bisa memilih metode yang sesuai kebijakan perusahaan per kategori Asset.

#### Acceptance Criteria

1. IF `depreciation_method === 'straight_line'`, THEN THE system SHALL menghitung `depreciation_amount` sama besar tiap periode = `(total_asset_cost - expected_value_after_useful_life) / total_number_of_depreciations`.
2. IF `depreciation_method === 'double_declining_balance'`, THEN THE system SHALL menghitung `depreciation_amount` = `nilai_buku_awal_periode * (2 / total_number_of_depreciations)`, dengan `nilai_buku_awal_periode` menurun tiap periode.
3. IF `depreciation_method === 'written_down_value'`, THEN THE system SHALL menghitung `depreciation_amount` = `nilai_buku_awal_periode * rate_of_depreciation`.
4. IF `depreciation_method === 'manual'`, THEN THE system SHALL TIDAK menggenerate `depreciation_amount` otomatis — baris schedule dibuat kosong (`depreciation_amount = 0`) dan menunggu input manual dari user sebelum posting.
5. THE system SHALL menyediakan calculator terpisah per metode (mis. class/strategy per method) agar tiap metode dapat diuji secara independen.
6. IF `daily_prorata_based === true` AND periode pertama tidak dimulai tepat di awal bulan, THEN THE system SHALL menghitung `depreciation_amount` periode pertama secara pro-rata harian.

### Requirement 3: Posting Berkala ke General Ledger

**User Story:** As a Finance staff, I want jurnal depresiasi terposting otomatis sesuai jadwal, so that laporan keuangan selalu mencerminkan nilai buku Asset terkini tanpa kerja manual berulang.

#### Acceptance Criteria

1. THE system SHALL menyediakan Artisan command terjadwal (harian) yang mencari semua baris `AssetDepreciationSchedule` dengan `posted = false AND schedule_date <= today`.
2. FOR EACH baris due, THE system SHALL memposting sepasang `GeneralLedger` (debit `depreciationExpenseAccount`, credit `accumulatedDepreciationAccount`) sebesar `depreciation_amount`, mengikuti pola `referenceable_type`/`referenceable_id` menunjuk `AssetDepreciationSchedule`.
3. THE system SHALL mengambil akun GL dari `Asset.assetCategory.accounts` (`AssetCategoryAccount`) yang sesuai `Asset.branch`.
4. IF `AssetCategoryAccount` untuk branch Asset tidak ditemukan, THEN THE system SHALL skip baris tersebut, mencatat log peringatan, DAN TIDAK menghentikan pemrosesan baris/Asset lain dalam batch yang sama.
5. WHEN posting berhasil, THE system SHALL menandai baris `posted = true` DAN mengisi `journal_entry_id`.
6. THE system SHALL memposting TANPA melalui approval workflow (`checkApproval()`) — posting berjalan langsung dalam 1 database transaction per baris.
7. WHEN seluruh baris schedule milik 1 Asset berstatus `posted = true`, THE system SHALL mengubah `Asset.status` menjadi `FULLY_DEPRECIATED` DAN memperbarui `Asset.is_fully_depreciated = true`.
8. THE command SHALL bersifat idempotent — dijalankan berkali-kali pada hari yang sama TIDAK menghasilkan posting duplikat.

### Requirement 4: Write-off saat Scrap

**User Story:** As a Finance staff, I want sisa nilai buku Asset otomatis dihapuskan secara akuntansi saat Asset di-scrap, so that laporan keuangan tidak menyisakan nilai buku aset yang sudah tidak ada.

#### Acceptance Criteria

1. WHEN `Asset::scrap()` dipanggil AND terdapat baris `AssetDepreciationSchedule` dengan `posted = false`, THE system SHALL membatalkan (menghapus atau menandai canceled) seluruh baris tersebut.
2. WHEN `Asset::scrap()` dipanggil AND `is_depreciable === true` AND sisa nilai buku > 0, THE system SHALL memposting 1 pasang jurnal write-off (debit `accumulatedDepreciationAccount` sisa, credit `fixedAssetAccount`) sebesar sisa nilai buku.
3. THE system SHALL menyimpan referensi jurnal write-off ke `Asset.journal_entry_for_scrap_id`.
4. IF `is_depreciable === false` ATAU sisa nilai buku = 0, THEN THE system SHALL TIDAK memposting jurnal write-off apapun.

### Requirement 5: Asset Value Adjustment (Revaluasi Manual)

**User Story:** As a Finance staff, I want mencatat revaluasi nilai Asset secara manual dengan jejak audit, so that koreksi nilai buku (appraisal, kerusakan mendadak) tercatat resmi di General Ledger tanpa mengubah histori transaksi lama.

#### Acceptance Criteria

1. THE system SHALL menyediakan model `AssetValueAdjustment` submittable dengan field: `asset_id`, `date`, `current_asset_value` (read-only, snapshot saat draft dibuat), `new_asset_value`, `difference_amount` (computed = `new_asset_value - current_asset_value`), `difference_account_id`, `journal_entry_id` (read-only), `branch_id`.
2. WHEN `AssetValueAdjustment.submit()` dipanggil, THE system SHALL memposting 1 pasang jurnal (`difference_amount` antara `difference_account_id` dan akun nilai Asset terkait) DAN mengisi `journal_entry_id`.
3. WHEN `AssetValueAdjustment` berhasil submit, THE system SHALL memperbarui nilai buku Asset terkait sesuai `new_asset_value`.
4. THE system SHALL TIDAK mengizinkan field `gross_purchase_amount`/nilai buku Asset diubah langsung di luar jalur `AssetValueAdjustment` setelah Asset submitted (di luar scope validasi baru — dicatat sebagai referensi arsitektur, bukan constraint teknis baru di spec ini).

### Requirement 6: Non-Scope — Amend Asset

**User Story:** As a developer, I want kejelasan bahwa amend() Asset tidak perlu ditangani khusus di spec ini, so that tidak ada kerja sia-sia menangani skenario yang secara arsitektur tidak dapat terjadi.

#### Acceptance Criteria

1. THE system SHALL TIDAK memerlukan penanganan khusus interaksi `AssetDepreciationSchedule`/GL dengan `Asset::amend()`, KARENA `Asset::canCancel()` selalu `false` DAN tombol Amend pada FE hanya muncul untuk status `canceled`/`rejected`, sehingga Asset secara praktis tidak pernah mencapai state yang memicu amend melalui alur UI normal.

### Requirement 7: Scope Frontend

**User Story:** As a developer, I want batasan scope FE jelas, so that implementasi tidak melebar ke luar kebutuhan inti (posting otomatis backend).

#### Acceptance Criteria

1. THE system SHALL TIDAK menambahkan halaman Inertia baru untuk `AssetDepreciationSchedule` (read-only, cukup ditampilkan sebagai bagian relasi di `Asset/Assets/Show.jsx` jika diperlukan pada task implementasi).
2. THE system SHALL menyediakan minimal 1 halaman Inertia untuk `AssetValueAdjustment` (Index + Form/Show) mengikuti pola submittable existing, KARENA ini dokumen yang dibuat manual oleh user (bukan hasil generate otomatis).
