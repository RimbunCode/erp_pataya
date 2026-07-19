# Requirements Document

## Introduction

Sumber: Minutes of Meeting (MoM) Demo Aplikasi PTPSN 2.0 — 10.07.2026, bagian 3 (Enhancement Request), poin D: "Durasi sewa dihitung berdasarkan penggunaan aktual sejak hari pertama."

**Kondisi kode saat ini (diverifikasi 2026-07-18):**
- `SalesOrder`: flag `is_rent` (boolean), range `start_date`/`end_date` (disimpan sebagai `rent_date.from`/`rent_date.to` di FE) — **diinput manual** oleh user saat membuat SO, bukan hasil kalkulasi.
- `DeliveryNoteService::updateDeliveredQuantity()` (baris 189-267 di `app/Services/Inventory/DeliveryNoteService.php`): untuk item rental (`is_rent && item.type == 'vehicle'`), sistem hanya mencatat **reservasi ketersediaan stok** lewat `Stock::updateDetails()` (tipe `rents`) dan `rented_quantity` — ini bukan pencatatan durasi, murni mekanisme locking stok.
- `DeliveryNote` punya kolom `delivery_date` dan `return_against_id` (self-referencing FK) — pengembalian barang rental dicatat sebagai `DeliveryNote` baru yang mereferensikan `DeliveryNote` pengiriman awal lewat `return_against_id`. `DeliveryNoteItem` punya `returnAgainstItem` + `returned_quantity`, sehingga **pengembalian sebagian per-item sudah didukung** di level data.
- `SalesInvoiceService.php` **sama sekali tidak menyebut "rent"** — tidak ada logic apapun terkait kalkulasi durasi atau rate sewa. Invoice rental dibuat sepenuhnya manual: user mengisi `price` per item sendiri.
- Tidak ada field "rate per hari" di `sales_order_items` maupun tabel manapun — hanya `price` (total, diasumsikan diisi manual sebagai harga sewa keseluruhan saat ini).

**Keputusan (dikonfirmasi pengguna):**
- Satuan billing dasar: **harian**, tapi rate yang diinput user tetap **rate bulanan** (kebiasaan bisnis rental — harga disepakati per bulan), dikonversi ke harian saat kalkulasi.
- Perlakuan hari pengembalian: **dihitung penuh** (bukan pro-rata, bukan dikecualikan). Contoh: barang keluar 1 Agustus, kembali 5 Agustus → durasi = 5 hari (1, 2, 3, 4, 5 Agustus), bukan 4 hari.
- Formula konversi bulanan → harian: `1 bulan = 30 hari`. Durasi **> 30 hari dihitung per bulan penuh + sisa hari** (bukan linear `monthly_rate / 30 × total_hari`) — mis. 45 hari sewa = 1× `monthly_rate` (30 hari pertama) + 15 hari sisa × `(monthly_rate / 30)`.
- Field rate: **`price` yang sudah ada di `sales_order_items` dipakai sebagai rate bulanan** untuk item rental (`is_rent = true`) — tidak ada kolom baru. Untuk item non-rental, `price` tetap bermakna seperti sekarang (harga per unit/total, tidak berubah).

Spec ini menambahkan kalkulasi durasi sewa aktual (dari tanggal `DeliveryNote` pengiriman sampai tanggal `DeliveryNote` pengembalian, atau sampai tanggal cut-off billing bila belum kembali), dan memakainya untuk membantu pembuatan Sales Invoice dari SO rental.

**Di luar scope (sesuai plan MoM):**
- Recurring billing otomatis (tagihan periode berikutnya berdasarkan due date) — fitur baru terpisah, di-skip.
- Perubahan pada Purchase Order/Purchase Invoice — rental hanya berlaku di sisi Sales.

## Glossary

- **Durasi Aktual**: jumlah hari sewa dihitung dari tanggal serah terima (`DeliveryNote.delivery_date` pengiriman) sampai tanggal pengembalian (`DeliveryNote.delivery_date` pada DN dengan `return_against_id` terisi) atau tanggal cut-off billing jika belum ada pengembalian, dengan hari pertama dan hari terakhir (pengembalian) sama-sama dihitung penuh.
- **Rate Bulanan**: nilai sewa per 30 hari per item rental, disimpan di kolom `price` (item dengan `is_rent = true`).
- **Rate Harian (turunan)**: `rate bulanan / 30` — dipakai untuk menghitung sisa hari di luar kelipatan 30 hari penuh, bukan disimpan sebagai field terpisah.
- **Cut-off Billing**: tanggal akhir yang dipilih user secara manual, dipakai untuk menghitung durasi berjalan ketika barang belum dikembalikan saat invoice dibuat.

## Requirements

### Requirement 1: Kalkulasi durasi sewa aktual per item

**User Story:** As a Sales/Billing staff, I want sistem menghitung otomatis berapa hari sebuah item rental sudah/sedang disewa berdasarkan tanggal serah terima dan pengembalian aktual, so that saya tidak perlu menghitung manual dan potensi kesalahan hitung berkurang.

#### Acceptance Criteria

1. THE system SHALL menghitung durasi sewa aktual per item sebagai selisih hari antara tanggal `DeliveryNote` pengiriman (delivery_date) dan tanggal `DeliveryNote` pengembalian (delivery_date pada DN dengan `return_against_id` mengarah ke DN pengiriman terkait), dengan kedua tanggal ujung dihitung penuh (inklusif).
2. WHEN item rental belum dikembalikan (belum ada `DeliveryNote` retur terkait) DAN user sedang membuat Sales Invoice, THE system SHALL meminta user memilih tanggal cut-off billing secara manual, dipakai sebagai tanggal akhir sementara untuk durasi berjalan.
3. WHEN pengembalian dilakukan sebagian (partial return, sebagian quantity item kembali lebih dulu dari sisanya), THE system SHALL menghitung durasi terpisah untuk quantity yang sudah kembali (durasi = tanggal kirim s/d tanggal retur parsial) dan quantity yang masih tersisa (durasi berjalan, cut-off billing manual).

### Requirement 2: Kalkulasi amount dari rate bulanan dan durasi aktual

**User Story:** As a Sales/Billing staff, I want sistem menghitung total tagihan rental dari rate bulanan (yang sudah biasa diinput) dan durasi aktual, so that saya tidak perlu mengonversi manual dari bulanan ke harian.

#### Acceptance Criteria

1. THE system SHALL menggunakan kolom `price` pada item Sales Order dengan `is_rent = true` sebagai rate bulanan (nilai sewa per 30 hari) — tidak ada kolom baru ditambahkan.
2. WHEN durasi aktual (Requirement 1) kurang dari atau sama dengan 30 hari, THE system SHALL menghitung amount sebagai `price / 30 × durasi_aktual`.
3. WHEN durasi aktual lebih dari 30 hari, THE system SHALL menghitung amount sebagai `(jumlah_bulan_penuh × price) + (sisa_hari × (price / 30))`, dengan `jumlah_bulan_penuh = floor(durasi_aktual / 30)` dan `sisa_hari = durasi_aktual mod 30`.
4. THE system SHALL menerapkan formula ini hanya untuk item dengan `is_rent = true` pada SO — item non-rental SHALL TIDAK terpengaruh formula ini sama sekali (`price` tetap dipakai apa adanya seperti sekarang).

### Requirement 3: Prefill amount saat membuat Sales Invoice dari SO rental

**User Story:** As a Billing staff (Bu Lia), I want saat membuat Sales Invoice dari Sales Order rental, nilai tagihan per item terisi otomatis berdasarkan rate bulanan dan durasi aktual, so that proses billing rental lebih cepat dan konsisten dengan pemakaian sebenarnya.

#### Acceptance Criteria

1. WHEN user membuat Sales Invoice dari Sales Order rental (via alur create-from-source yang sudah ada), THE system SHALL mengisi `price` per item invoice dengan hasil kalkulasi Requirement 2 sebagai nilai awal (prefill), bukan nilai final yang tidak bisa diubah.
2. THE system SHALL tetap mengizinkan user mengubah nilai prefill tersebut secara manual sebelum submit invoice (konsisten dengan pola field `price` yang sudah editable di form Sales Invoice saat ini).
3. IF Sales Order bukan rental (`is_rent = false`), THEN alur pembuatan Sales Invoice SHALL tidak berubah sama sekali dari perilaku saat ini.

### Requirement 4: Tampilan durasi dan status sewa di SO

**User Story:** As a Sales/Billing staff, I want melihat durasi sewa yang sudah berjalan beserta statusnya untuk item rental langsung di halaman Sales Order, so that saya bisa memantau status sewa tanpa menghitung manual dari tanggal-tanggal delivery note.

#### Acceptance Criteria

1. THE Sales Order Show page SHALL menampilkan durasi aktual (hari) per item rental, dihitung dari Requirement 1.
2. THE system SHALL menampilkan indikator status "Berjalan" untuk item rental yang belum dikembalikan (durasi masih bisa bertambah), dan "Selesai" untuk item yang sudah dikembalikan penuh — ditampilkan sebagai badge/label di samping angka durasi.
3. WHEN item mengalami pengembalian sebagian (Requirement 1.3), THE system SHALL menampilkan badge status "Sebagian Selesai" — ringkas tanpa breakdown detail quantity per status di tampilan utama.

### Requirement 5: Tidak mengubah cakupan existing

**User Story:** As a System Administrator, I want perubahan ini tidak mempengaruhi flow Sales Order/Delivery Note non-rental maupun fitur rental yang sudah berjalan (reservasi stok), so that risiko regresi minimal.

#### Acceptance Criteria

1. THE system SHALL TIDAK mengubah logic reservasi stok rental yang sudah ada di `DeliveryNoteService` (`Stock::updateDetails` tipe `rents`, `rented_quantity`) — durasi dihitung sebagai lapisan terpisah, bukan pengganti mekanisme reservasi.
2. THE system SHALL TIDAK mengubah alur Sales Order/Delivery Note/Sales Invoice untuk item non-rental.
3. Recurring billing otomatis SHALL TIDAK termasuk dalam spec ini (sesuai keputusan plan MoM — fitur baru terpisah).
