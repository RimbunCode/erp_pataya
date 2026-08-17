# Requirements Document

## Introduction

Sumber: Audit manual di `https://erp.staging.ptpsn.co.id` (16 Agustus 2026) terhadap form Purchase Order dan Sales Order.

**Temuan inti (CONFIRMED, direproduksi dengan angka pasti):** Pada Purchase Order, dua item dengan tax rate berbeda (PPN 11% dan PPh 10%) menghasilkan `Jumlah Dasar` = 2.000.000, `Jumlah Pajak` = 210.000, `Total` = 2.210.000 sebelum diskon — benar. Setelah `Tingkat Diskon Tambahan` 10% diterapkan pada basis "Total Bersih": `Jumlah Dasar` **tetap** 2.000.000, `Jumlah Pajak` **tetap** 210.000, sementara `Total` berubah jadi 2.010.000 (`2.210.000 − 200.000`, potongan lump-sum dari total akhir). DPP dan pajak yang seharusnya menjadi basis legal — termasuk untuk Faktur Pajak — tidak pernah ikut dihitung ulang.

Investigasi kode (lihat `design.md`) mengonfirmasi akar masalah: `basic_amount` dan `tax_amount` pada `purchase_order_items`/`sales_order_items` adalah kolom **generated** (`storedAs()`) yang hanya bisa mengacu kolom lain di baris yang sama (`quantity`, `rate`, `tax_rate`). Diskon disimpan di level header (tabel `purchase_orders`/`sales_orders`), sehingga generated column tidak mungkin mengaksesnya. Backend (`Utils::countAmount()`) dan frontend (`AdditionalDiscount.jsx`) sama-sama hanya mengurangi diskon dari total akhir, tidak pernah merevisi basis per item. Purchase Order bahkan tidak me-render komponen diskon sama sekali (`AdditionalDiscount` di-import tapi tidak dipakai) — hanya Sales Order yang punya UI-nya, dengan bug yang sama.

Selain bug ini, audit menemukan gap struktural pada data model pajak dan pihak (party) yang menghalangi kepatuhan PPN Indonesia yang penuh: tabel `taxes` hanya punya `name`+`rate` (tidak bisa membedakan PPN vs PPh, tidak ada arah pemotongan/penambahan, tidak ada skema DPP Nilai Lain), `suppliers` tidak punya field NPWP sama sekali, dan `customers` punya field `vat` (freetext, tanpa validasi format) yang penamaannya tidak konsisten dengan Supplier.

**Relasi dengan spec lain:** Spec `invoice-dpp-adjustment` (selesai) sudah menambah `dpp_amount` pada `SalesInvoiceItem`/`PurchaseInvoiceItem` sebagai generated column dengan formula tetap `basic_amount * 11/12`, berlaku ke **semua** baris invoice tanpa syarat jenis pajak. Spec ini **tidak mengubah** hasil kerja itu di tabel invoice items. Namun Requirement 4 di sini menambah flag "DPP Nilai Lain 11/12" yang sifatnya **per tax record** (opsional, tidak semua PPN memakainya) — ini konsep yang lebih umum dari formula tetap di `invoice-dpp-adjustment`. Ketegangan ini dicatat eksplisit di Requirement 8 (Open Question) dan tidak diselesaikan sepihak oleh spec ini.

**Di luar scope:** perubahan pada `SalesInvoiceItem`/`PurchaseInvoiceItem` (sudah ditangani spec lain); backfill/migrasi data historis (lihat Requirement 8); pembuatan modul Faktur Pajak baru kecuali dikonfirmasi belum ada modul Invoice yang menaunginya (lihat Requirement 7, digated eksplisit); perbaikan performa frontend (chunk loading lambat, dicatat sebagai isu terpisah).

## Glossary

- **DPP (Dasar Pengenaan Pajak)**: Basis/dasar nilai transaksi yang menjadi acuan perhitungan PPN, dihitung **setelah** semua potongan harga.
- **DPP Nilai Lain**: Skema DPP di mana nilai dasar pajak adalah persentase tertentu dari harga jual (bukan 100%). Untuk PPN 12% non-barang mewah: `DPP = 11/12 × Harga Jual`, menghasilkan tarif efektif 11%.
- **Diskon Tambahan**: Diskon di level dokumen (header) pada PO/SO, bukan diskon per baris item. Punya basis (`discount_on`: "Total Bersih" / "Total Keseluruhan") dan bisa diinput sebagai persentase (`discount_rate`) atau nominal (`discount_amount`).
- **Total Bersih**: Basis diskon = jumlah `basic_amount` semua baris (net, sebelum pajak).
- **Total Keseluruhan**: Basis diskon = jumlah (`basic_amount` + `tax_amount`) semua baris (gross, termasuk pajak).
- **PPN (Pajak Pertambahan Nilai)**: Pajak output/input yang **ditambahkan** ke nilai transaksi.
- **PPh (Pajak Penghasilan) pemotongan**: Pajak withholding (PPh 21/22/23/4(2)) yang **dipotong/dikurangkan** dari nilai yang dibayarkan ke counterparty — bukan ditambahkan ke total.
- **NPWP**: Nomor Pokok Wajib Pajak, 15 digit (format lama) atau 16 digit (format baru, untuk individu = NIK).
- **NITKU**: Nomor Identitas Tempat Kegiatan Usaha, identifier per lokasi usaha.
- **Faktur Pajak**: Dokumen bukti pungutan PPN sesuai UU PPN Pasal 13 ayat 5 jo. PER-03/PJ/2022.

## Requirements

### Requirement 1: Perbaikan kalkulasi Diskon Tambahan → DPP tereskalasi ke seluruh baris (CRITICAL)

**User Story:** As an Accounting staff (Bu Lia), I want saat saya menerapkan Diskon Tambahan pada PO/SO, nilai Jumlah Dasar (DPP) dan Jumlah Pajak ikut terhitung ulang berdasarkan basis yang sudah dipotong diskon, so that dokumen yang saya buat mencerminkan kewajiban pajak yang benar dan bisa dipertanggungjawabkan.

#### Acceptance Criteria

1. WHEN user menerapkan Diskon Tambahan dengan basis "Total Bersih" (persentase atau nominal), THE system SHALL mengalokasikan diskon secara pro-rata ke tiap baris berdasarkan proporsi `basic_amount` baris tersebut terhadap total `basic_amount`, mengurangi `basic_amount` tiap baris, lalu menghitung ulang `tax_amount` tiap baris dari `basic_amount` yang sudah dikurangi.
2. WHEN user menerapkan Diskon Tambahan dengan basis "Total Keseluruhan" (persentase atau nominal), THE system SHALL mengalokasikan diskon pro-rata berdasarkan proporsi (`basic_amount` + `tax_amount`) tiap baris, men-gross-down alokasi tersebut ke basis net (`alokasi / (1 + tax_rate baris)`) sebelum mengurangi `basic_amount` baris, lalu menghitung ulang `tax_amount` dari `basic_amount` baru.
3. THE system SHALL memastikan `Total = Jumlah Dasar + Jumlah Pajak` selalu benar, baik ada diskon maupun tidak.
4. THE system SHALL memastikan `Jumlah Dasar` (header) sama dengan penjumlahan `basic_amount` seluruh baris, dan `Jumlah Pajak` (header) sama dengan penjumlahan `tax_amount` seluruh baris, setelah diskon diterapkan.
5. WHEN discount adalah persentase, THE system SHALL menghasilkan `Total` akhir yang sama baik basis "Total Bersih" maupun "Total Keseluruhan" dipilih (properti linearitas) — keduanya hanya boleh berbeda pada nilai `Jumlah Diskon Tambahan` yang ditampilkan.
6. WHEN discount 100% diterapkan pada basis "Total Bersih", THE system SHALL menghasilkan `Jumlah Dasar` = 0 dan `Jumlah Pajak` = 0, tanpa division-by-zero atau nilai negatif.
7. THE system SHALL membulatkan tiap baris ke satuan minor mata uang, lalu mendorong sisa selisih pembulatan ke baris dengan nilai terbesar, sehingga invarian pada AC 3 dan AC 4 tetap terpenuhi setelah pembulatan.
8. THE system SHALL menolak diskon yang melebihi basis (basic_amount atau grand total, sesuai basis dipilih) — tidak boleh menghasilkan basis atau pajak negatif.

### Requirement 2: Reaktivitas kalkulasi di form PO dan SO

**User Story:** As an Accounting staff, I want ketiga field Jumlah Dasar, Jumlah Pajak, dan Total ikut berubah otomatis saat saya mengubah rate diskon, nominal diskon, atau basis diskon, so that saya tidak perlu menyimpan dulu untuk tahu angka yang benar.

#### Acceptance Criteria

1. WHEN user mengubah `Tingkat Diskon Tambahan` (persentase), THE system SHALL merecompute `Jumlah Dasar`, `Jumlah Pajak`, dan `Total` secara reaktif di form, mengikuti Requirement 1.
2. WHEN user mengubah `Jumlah Diskon Tambahan` (nominal langsung), THE system SHALL merecompute ketiga field yang sama, dan menghitung ulang `Tingkat Diskon Tambahan` yang setara.
3. WHEN user mengubah `Terapkan Diskon Tambahan Pada` (basis), THE system SHALL merecompute ketiga field sesuai basis baru tanpa perlu user mengubah rate/nominal lagi.
4. THE Purchase Order Baru form SHALL menampilkan komponen Diskon Tambahan (saat ini di-import tapi tidak dirender) sehingga PO punya kapabilitas diskon dokumen yang sama dengan Sales Order.
5. THE system SHALL menerapkan logika kalkulasi diskon yang sama (bukan implementasi terpisah/duplikat) pada PO dan SO — lihat design.md untuk keputusan konsolidasi.

### Requirement 3: Persistensi nilai terkalkulasi ke database

**User Story:** As a System Administrator, I want nilai DPP dan pajak yang sudah benar tersimpan ke database saat dokumen disimpan, bukan hanya tampil benar di layar, so that data yang dipakai laporan pajak dan Faktur Pajak di masa depan akurat.

#### Acceptance Criteria

1. WHEN dokumen PO/SO disimpan (create atau update) dengan Diskon Tambahan aktif, THE system SHALL menyimpan `basic_amount` dan `tax_amount` per baris yang sudah dikurangi diskon (bukan nilai pra-diskon) ke database.
2. THE system SHALL mengubah `basic_amount`/`tax_amount`/`amount` pada `purchase_order_items` dan `sales_order_items` dari generated column (`storedAs()`) menjadi kolom biasa yang dihitung dan ditulis oleh Service layer, karena generated column secara struktural tidak bisa mengacu diskon di level header (baris berbeda).
3. WHEN item baris ditambah, dihapus, atau diubah quantity/rate/tax setelah diskon header sudah diisi, THE system SHALL menghitung ulang alokasi diskon dan menyimpan ulang `basic_amount`/`tax_amount` seluruh baris yang terdampak.
4. THE system SHALL memvalidasi bahwa hasil GET/reload dokumen setelah save menampilkan angka yang identik dengan yang terlihat sebelum save (tidak ada drift antara nilai render dan nilai persisted).

### Requirement 4: Kategori pajak dan arah pemotongan/penambahan

**User Story:** As an Accounting staff, I want master Pajak bisa membedakan PPN (ditambahkan ke total) dari PPh (dipotong dari pembayaran ke counterparty), so that dokumen yang memakai kombinasi PPN dan PPh menghasilkan total yang benar arahnya.

#### Acceptance Criteria

1. THE system SHALL menambah field kategori/jenis pajak pada model `Tax`, minimal membedakan: `PPN standar`, `PPN barang mewah`, dan `PPh (pemotongan)` dengan sub-tipe (21/22/23/4(2)).
2. THE system SHALL menambah field yang menentukan arah pajak: **additive** (ditambahkan ke Total, seperti PPN) atau **withholding** (dipotong dari nilai dibayar ke counterparty, seperti PPh) pada tiap record `Tax`.
3. WHEN baris dokumen memakai tax record berkategori withholding, THE system SHALL mengeluarkan nilainya dari `Jumlah Pajak` yang menambah Total, dan menampilkannya sebagai deduksi terpisah ("pemotongan/pemungutan") yang tidak mengubah DPP maupun angka PPN yang akan masuk Faktur Pajak.
4. THE system SHALL menambah flag "DPP Nilai Lain (11/12)" pada record `Tax` berkategori PPN, yang bila aktif menghitung `DPP = 11/12 × basic_amount_setelah_diskon` sebelum tarif pajak diterapkan.
5. THE system SHALL menyediakan (seed) minimal satu record default `PPN 12% (DPP Nilai Lain 11/12)` agar sistem tidak berjalan tanpa tipe PPN sama sekali.
6. WHEN satu baris dokumen memakai tax record dengan flag DPP Nilai Lain aktif dan `basic_amount` (setelah diskon) = 12.000.000, THE system SHALL menghasilkan DPP = 11.000.000 dan PPN = 1.320.000.

### Requirement 5: Identitas pajak pada Supplier

**User Story:** As an Accounting staff, I want data Supplier mencatat NPWP dan NITKU, so that Faktur Pajak Masukan (input VAT) bisa dibuat dengan data pihak penjual yang lengkap dan valid.

#### Acceptance Criteria

1. THE system SHALL menambah field `npwp` pada model dan tabel `Supplier`.
2. THE system SHALL menambah field `nitku` pada model dan tabel `Supplier`.
3. THE system SHALL memvalidasi format `npwp`: 15 digit (format lama) atau 16 digit (format baru), dengan masking/format tampilan yang konsisten.

### Requirement 6: Konsistensi identitas pajak pada Customer

**User Story:** As an Accounting staff, I want field pajak Customer memakai penamaan dan struktur yang sama dengan Supplier, so that saya tidak perlu mengingat konvensi berbeda antar dua master data yang serupa.

#### Acceptance Criteria

1. THE system SHALL merename field `vat` pada `Customer` menjadi `npwp`, dengan migrasi yang memindahkan data existing tanpa kehilangan nilai.
2. THE system SHALL menambah field `nitku` terpisah pada `Customer`, sejajar dengan Supplier.
3. THE system SHALL menerapkan validasi format yang sama seperti Requirement 5.3 pada field `npwp` Customer.

### Requirement 7: Data model Faktur Pajak (GATED — konfirmasi scope sebelum implementasi)

**User Story:** As an Accounting staff, I want dokumen Sales/Purchase Invoice bisa menyimpan data Faktur Pajak yang lengkap, so that saya bisa menghasilkan Faktur Pajak yang sah sesuai PER-03/PJ/2022 tanpa mengetik ulang di aplikasi e-Faktur.

#### Acceptance Criteria

1. SEBELUM implementasi requirement ini dimulai, THE team SHALL mengonfirmasi ke product owner apakah modul Sales/Purchase Invoice yang sudah ada (`SalesInvoiceItem`/`PurchaseInvoiceItem`, sudah punya `dpp_amount` dari spec `invoice-dpp-adjustment`) adalah tempat yang tepat untuk field Faktur Pajak, atau apakah sudah ada inisiatif lain yang menaunginya.
2. IF dikonfirmasi in-scope, THEN THE system SHALL menambah field kode transaksi Faktur Pajak (pilihan: 01, 02, 03, 04, 07, 08, 09, 10) pada level dokumen invoice.
3. IF dikonfirmasi in-scope, THEN THE system SHALL menambah field nomor seri Faktur Pajak dengan format `2 digit kode transaksi + 1 digit kode status + 13 digit serial` (contoh: `010.000-26.00000001`), dengan range yang dialokasikan dikonfigurasi (bukan auto-generate bebas di luar alokasi DJP).
4. IF dikonfirmasi in-scope, THEN THE system SHALL menyimpan breakdown DPP/PPN/PPnBM per invoice, bersumber dari kalkulasi yang sudah benar hasil Requirement 1 dan 4.
5. IF tidak dikonfirmasi in-scope pada saat spec ini diimplementasi, THEN requirement ini SHALL ditunda ke spec terpisah dan tidak memblokir Requirement 1–6.

### Requirement 8: Pertanyaan terbuka yang wajib disurfaced, bukan diputuskan sepihak

**User Story:** As a Product Owner, I want keputusan bisnis yang berdampak pada data historis dieskalasi ke saya, so that tidak ada asumsi yang salah diterapkan diam-diam ke transaksi yang sudah ada.

#### Acceptance Criteria

1. THE team SHALL mengajukan (bukan memutuskan sendiri) strategi migrasi untuk record `Tax` existing setelah kategori PPN/PPh ditambahkan pada Requirement 4 — defaulting yang salah bisa membalik arah PPh dari additive jadi deductive pada dokumen historis.
2. THE team SHALL mengajukan (bukan memutuskan sendiri) apakah transaksi tersimpan yang sudah punya diskon (dengan DPP/pajak yang salah akibat bug Requirement 1) di-backfill-recalculate atau dibiarkan sebagai catatan historis yang beku.
3. THE team SHALL mendokumentasikan ketegangan antara formula `dpp_amount = basic_amount × 11/12` tetap (dari spec `invoice-dpp-adjustment`, berlaku ke semua baris invoice) dengan flag "DPP Nilai Lain" per-tax-record yang bersifat opsional (Requirement 4.4) — dan mengajukan ke product owner apakah keduanya perlu diselaraskan menjadi satu mekanisme.
