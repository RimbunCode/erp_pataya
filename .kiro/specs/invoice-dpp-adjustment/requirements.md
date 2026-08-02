# Requirements Document

## Introduction

Sumber: Minutes of Meeting (MoM) Demo Aplikasi PTPSN 2.0 — 10.07.2026, bagian 3 (Enhancement Request), poin E: "Penyesuaian susunan Invoice baru dengan adanya DPP (Dasar Pengenaan Pajak)."

Saat ini, `SalesInvoiceItem` dan `PurchaseInvoiceItem` tidak memiliki konsep DPP sama sekali. Struktur yang ada hanya `basic_amount` (quantity × price), `tax_rate`, dan `tax_amount` (basic_amount × tax_rate / 100) — PPN dihitung langsung dari basic amount penuh, tanpa langkah DPP di antaranya.

**Keputusan (dikonfirmasi pengguna):**
- DPP berlaku untuk **semua dokumen invoice** — Sales Invoice **dan** Purchase Invoice, tanpa pengecualian per jenis transaksi.
- Skema yang dipakai adalah **DPP Nilai Lain** secara seragam: `DPP = basic_amount × 11/12` (≈ 91,67%), sesuai skema PPN 12% agar tarif efektif tetap 11% dari nilai transaksi. Tidak ada campuran skema (bukan DPP biasa untuk sebagian transaksi dan Nilai Lain untuk sebagian lain) — satu formula konstan berlaku ke semua item invoice.

Spec ini menambahkan kolom/derivasi DPP pada invoice (Sales & Purchase), dan menyesuaikan tampilan (Form/Show/print template) agar urutan baku Indonesia — Subtotal → DPP → PPN → Total — tampak jelas di invoice.

**Di luar scope:** perubahan pada Sales Order/Purchase Order (DPP hanya untuk susunan Invoice sesuai MoM), fitur baru yang tidak disebut MoM (recurring billing, dsb).

## Glossary

- **DPP (Dasar Pengenaan Pajak)**: Dasar Pengenaan Pajak — nilai yang menjadi basis perhitungan PPN.
- **DPP Nilai Lain**: Skema DPP di mana nilainya dihitung sebagai persentase tertentu dari nilai transaksi, bukan 100%. Untuk spec ini: `basic_amount × 11/12`, berlaku seragam ke semua invoice (Sales & Purchase).
- **Basic Amount**: Nilai transaksi sebelum pajak per item invoice (quantity × price), sudah ada di sistem saat ini.
- **Tax Amount**: Nominal PPN. Sebelum spec ini: `basic_amount * tax_rate / 100`. Setelah spec ini: `dpp_amount * tax_rate / 100`.

## Requirements

### Requirement 1: Kolom/derivasi DPP pada Invoice Item (Sales & Purchase)

**User Story:** As an Accounting staff (Bu Lia), I want setiap item Sales Invoice dan Purchase Invoice memiliki nilai DPP yang eksplisit, so that saya bisa menyusun laporan pajak sesuai format yang diminta PTPSN tanpa menghitung manual.

#### Acceptance Criteria

1. THE system SHALL menyimpan nilai DPP (`dpp_amount`) per item pada `SalesInvoiceItem` dan `PurchaseInvoiceItem`, terpisah dari `basic_amount`.
2. THE system SHALL menghitung `dpp_amount = basic_amount × 11/12` untuk setiap item invoice, tanpa pengecualian jenis transaksi (skema DPP Nilai Lain berlaku seragam).
3. THE system SHALL menghitung `tax_amount` dari DPP (bukan dari `basic_amount` langsung): `tax_amount = dpp_amount * tax_rate / 100`.
4. THE system SHALL menyimpan `dpp_amount` sebagai stored/derived column (mengikuti pola `basic_amount` dan `tax_amount` yang sudah ada, mis. `storedAs()` pada migration) agar konsisten dan tidak perlu dihitung ulang di setiap query.

### Requirement 2: Tampilan susunan Invoice dengan DPP

**User Story:** As an Accounting staff, I want tampilan Form dan Show Sales Invoice maupun Purchase Invoice menampilkan urutan Subtotal → DPP → PPN → Total, so that struktur invoice sesuai kelaziman dokumen pajak Indonesia dan mudah diverifikasi.

#### Acceptance Criteria

1. THE Sales Invoice Show page dan Purchase Invoice Show page SHALL menampilkan baris DPP di antara Subtotal (jumlah basic_amount semua item) dan PPN (jumlah tax_amount semua item).
2. WHEN user membuka Form Sales Invoice atau Purchase Invoice (create/edit), THE system SHALL menampilkan kolom/nilai DPP per item secara read-only (diturunkan otomatis dari `basic_amount × 11/12`, bukan diinput manual).
3. THE system SHALL tetap menampilkan `tax_amount` dan `total_amount` sebagaimana konvensi yang sudah ada, dengan DPP sebagai baris tambahan, bukan pengganti.

### Requirement 3: Penyesuaian print template invoice

**User Story:** As an Accounting staff, I want dokumen cetak (PDF/print) Sales Invoice dan Purchase Invoice menampilkan susunan DPP yang baru, so that dokumen fisik yang diserahkan ke customer/supplier/otoritas pajak sesuai format yang benar.

#### Acceptance Criteria

1. THE print template Sales Invoice dan Purchase Invoice SHALL menampilkan baris DPP mengikuti urutan Subtotal → DPP → PPN → Total.
2. THE system SHALL memastikan variabel/placeholder DPP tersedia di modul PrintTemplate sehingga template existing dapat di-update tanpa migrasi struktural pada engine print.

### Requirement 4: Migrasi data invoice existing

**User Story:** As a System Administrator, I want data Sales Invoice dan Purchase Invoice yang sudah ada sebelum perubahan ini tetap konsisten, so that laporan historis tidak menampilkan DPP kosong/salah.

#### Acceptance Criteria

1. WHEN migration dijalankan pada data existing, THE system SHALL mem-backfill nilai DPP setiap invoice item lama (Sales & Purchase) dengan formula yang sama: `dpp_amount = basic_amount × 11/12`.
2. THE migration SHALL bersifat idempotent (aman dijalankan ulang tanpa merusak data yang sudah di-backfill).
3. THE system SHALL mempertahankan `tax_amount` sebagai generated/stored column dengan formula baru berbasis DPP (`dpp_amount * tax_rate / 100`), dan formula baru ini berlaku seragam untuk **seluruh baris**, termasuk invoice yang sudah ada sebelum migration. **Keputusan (dikonfirmasi pengguna, merevisi keputusan sebelumnya):** nilai `tax_amount` pada invoice historis boleh ikut bergeser mengikuti formula baru — pergeseran ini dianggap dapat diterima karena murni penyesuaian basis perhitungan (dari `basic_amount` ke `dpp_amount`), bukan perubahan substantif pada kebijakan pajak.
