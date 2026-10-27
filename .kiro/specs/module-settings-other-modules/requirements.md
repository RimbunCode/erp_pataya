# Requirements Document

## Introduction

Spec ketiga program **Konfigurasi Modul** (lihat `docs/prd/module-settings-prd.md`). Setelah fondasi setting dan default Purchase/Sales/Inventory, modul lain masih memuat nilai yang diisi manual berulang. Spec ini mengumpulkan setting modul lain **yang didukung bukti kode**:

| Modul | Bukti di kode | Setting kandidat |
|---|---|---|
| Asset | `asset_categories` memiliki `default_depreciation_method`, `default_frequency_of_depreciation`, `default_total_number_of_depreciations` per kategori | Default untuk kategori **baru** |
| CRM / Sales | `quotations.valid_until` (tanggal) | Masa berlaku Quotation (hari) |
| Helpdesk | `tickets` memiliki `type`, `priority`, `due_date` | Default tipe, prioritas, dan batas hari |
| Service | `work_orders` memiliki pelanggan, item jasa, tanggal | **Dikeluarkan** (D-O2, 2026-10-27): kajian Task 1 tidak menemukan nilai berulang |

User dan Report **tidak** diusulkan: tidak ditemukan nilai berulang yang membutuhkan setting; keduanya baru dikaji bila ada permintaan nyata.

**Status dokumen:** tervalidasi ulang pada 2026-10-27 (Task 1 selesai setelah `module-settings-foundation` dan `module-conditional-defaults` masuk `dev-1` lewat PR #267). Pemilik produk menyetujui ketiga setting (D-O1); Service dikeluarkan (D-O2). Lihat **Catatan Keputusan** di bawah.

**Prinsip:** nilai berawal netral (kosong/null) sehingga merge tidak mengubah perilaku; default hanya mengisi dokumen/data **baru** dan dapat diubah.

**Prasyarat:** `module-settings-foundation` selesai. Tidak bergantung pada Finance Engine atau `module-defaults-and-controls`.

**Di luar scope:**
- Akun fallback Asset: dimiliki Finance P2 (akun default peran pada profil), tidak diduplikasi ke `asset_settings`.
- Jadwal dan posting penyusutan (perintah dan listener Asset yang ada).
- Kebijakan kata sandi, preferensi per user, default periode laporan (tanpa bukti kebutuhan).

## Glossary

- **Default kategori aset**: nilai awal metode, frekuensi, dan jumlah penyusutan saat membuat kategori aset baru.
- **Masa berlaku Quotation**: jumlah hari dari tanggal Quotation ke `valid_until`.
- **Default tiket**: tipe, prioritas, dan batas hari yang mengisi tiket baru.

## Requirements

### Requirement 1: Setting Asset (default kategori baru)

**User Story:** Sebagai admin aset, saya ingin default penyusutan untuk kategori baru, so that kategori baru tidak perlu mengisi parameter yang sama berulang.

#### Acceptance Criteria

1. THE sistem SHALL membuat tabel `asset_settings` dengan kolom `default_depreciation_method` (string nullable), `default_frequency_of_depreciation` (unsignedInteger nullable), dan `default_total_number_of_depreciations` (unsignedInteger nullable). `AssetCategoryRequest` hanya memvalidasi metode sebagai `nullable|string` dan dua angka sebagai `integer` (tanpa daftar opsi), sehingga `rules()` setting memakai: metode ∈ {`straight_line`, `double_declining_balance`, `written_down_value`, `manual`} (kunci yang dikenali `DepreciationMethodFactory`), frekuensi dan jumlah `integer` minimal 1 (diverifikasi Task 1.1, 2026-10-27).
2. WHEN form kategori aset **baru** dibuka, THE form SHALL mengisi ketiga field dari setting bila kosong; kategori yang sudah ada tidak berubah.
3. THE user SHALL tetap dapat mengubah nilai pada kategori.
4. THE `asset_settings` SHALL tidak memuat akun; fallback akun Asset dimiliki Finance P2.

### Requirement 2: Masa berlaku Quotation

**User Story:** Sebagai sales, saya ingin tanggal berlaku Quotation terisi otomatis, so that tidak perlu menghitung manual.

#### Acceptance Criteria

1. THE `sales_settings` SHALL menambah kolom `quotation_validity_days` (unsignedSmallInteger nullable; null = tidak diisi otomatis).
2. WHEN Quotation baru dibuat dan `valid_until` kosong, THE form SHALL mengisinya dengan `date + quotation_validity_days` dan memperbaruinya mengikuti perubahan `date` selama user belum mengubah `valid_until` secara manual.
3. THE Quotation yang sudah ada SHALL tidak diubah.
4. THE validasi `valid_until` pada `QuotationRequest` SHALL tidak berubah: wajib hanya untuk tipe `new_unit` dan `rental`, opsional untuk `spare_part`, dan harus `after_or_equal:date` (diverifikasi Task 1.2, 2026-10-27). Pengisian otomatis berlaku untuk semua tipe, termasuk `spare_part` yang sebelumnya boleh kosong; user tetap dapat mengosongkannya.

### Requirement 3: Default tiket Helpdesk

**User Story:** Sebagai petugas helpdesk, saya ingin tipe, prioritas, dan batas waktu tiket terisi default, so that tiket dibuat lebih cepat.

#### Acceptance Criteria

1. THE sistem SHALL membuat tabel `helpdesk_settings` dengan `default_type` dan `default_priority` (string nullable) dan `default_due_days` (unsignedSmallInteger nullable). Opsi tiket tidak punya enum atau konstanta: daftarnya ditulis langsung sebagai `in:` pada `TicketRequest` dan `TicketResponseRequest` (tipe `bug_problem`, `task`, `question`, `other`; prioritas `low`, `medium`, `high`, `critical`; diverifikasi Task 1.3, 2026-10-27). `rules()` setting memakai daftar yang sama.
2. WHEN tiket baru dibuat, THE form SHALL mengisi tipe dan prioritas dari setting bila kosong, dan `due_date` dari `start_date + default_due_days` bila kosong.
3. THE tiket yang sudah ada SHALL tidak diubah dan nilai tetap dapat diubah user.
4. IF opsi tipe/prioritas pada setting sudah tidak valid, THEN THE default SHALL tidak mengisi apa pun dan halaman setting menampilkan peringatan.

### Requirement 4: Kajian setting Service (ditutup, dikeluarkan dari spec ini)

**User Story:** Sebagai pemilik produk, saya ingin kepastian ada atau tidaknya setting yang berguna pada modul Service, so that tidak ada setting spekulatif.

#### Acceptance Criteria

1. THE Task 1.4 SHALL mengkaji alur Work Order dan memutuskan apakah ada nilai berulang yang pantas dijadikan setting. **Hasil (2026-10-27):** `WorkOrderRequest` hanya memuat tanggal, pelanggan, cabang pelanggan, item jasa, daftar item, dan catatan; tidak ada gudang, pajak, atau termin yang berulang, dan tidak ada setting yang terbukti dibutuhkan.
2. THE Service SHALL dikeluarkan dari spec ini (D-O2); tidak ada kolom atau tabel setting Service yang dibuat. Setting Service baru ditambahkan sebagai requirement baru hanya bila ada kebutuhan nyata.

### Requirement 5: Halaman setting dan menu

**User Story:** Sebagai admin, saya ingin setting modul-modul ini tampil di tempat yang konsisten, so that mudah ditemukan.

#### Acceptance Criteria

1. THE sistem SHALL menyediakan halaman **Asset Settings** dan **Helpdesk Settings** memakai `ModuleSettingsPage`, terdaftar di registry dengan desk (Core + desk modulnya); masa berlaku Quotation ditempatkan di halaman **Sales Settings** (tab Default).
2. THE menu SHALL mengikuti aturan fondasi (satu item per desk datar, lebih dari satu submenu).
3. THE masa berlaku Quotation SHALL berada pada halaman Sales Settings (Req 5.1) sehingga tidak ada halaman setting CRM terpisah dan enum `Domain` yang tidak memuat CRM tidak berdampak pada spec ini (Q-S2 tidak berlaku, 2026-10-27).
4. THE izin, audit, dan terjemahan mengikuti spec fondasi; komponen baru memiliki test `.rtl.test.jsx`.

### Requirement 6: Non-fungsional

#### Acceptance Criteria

1. THE perubahan SHALL tidak mengubah perilaku selama setting kosong; test regresi form kategori aset, Quotation, dan tiket tetap hijau.
2. THE migrasi SHALL aditif dengan `down()`; pembacaan lewat `SettingsService`.
3. THE kunci terjemahan baru tersedia di `lang/id` dan `lang/en`.

## Catatan Keputusan

| ID | Keputusan | Tanggal | Alasan | Disetujui |
|---|---|---|---|---|
| D-O1 | Ketiga setting dikerjakan: default kategori Asset, masa berlaku Quotation, default tiket Helpdesk (menutup Q-O1) | 2026-10-27 | Kebutuhan dikonfirmasi pemilik produk setelah validasi Task 1 | Pemilik produk |
| D-O2 | Service dikeluarkan dari spec ini; Requirement 4 ditutup tanpa setting | 2026-10-27 | Kajian Task 1.4 tidak menemukan nilai berulang pada Work Order | Pemilik produk |

## Pertanyaan

| ID | Pertanyaan | Status |
|---|---|---|
| Q-S2 | Desk untuk setting CRM/Report (tidak ada `Domain` CRM/Report) | Tidak berlaku: masa berlaku Quotation berada di Sales Settings (Req 5.3) |
| Q-O1 | Apakah ketiga setting memang dibutuhkan? | Selesai: D-O1 |
| Q-O2 | Apakah ada setting User/Report yang dibutuhkan? | Terbuka, di luar scope sekarang |
