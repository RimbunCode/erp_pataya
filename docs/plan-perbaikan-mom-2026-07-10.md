# Plan Perbaikan — Enhancement Request MoM 10 Juli 2026

> **Revisi:** 2026-07-18 — diverifikasi ulang terhadap kondisi repo di branch `fix/sales-tax-optional-dpp-rental` (basis `origin/dev-1` commit `27f2d124`, 18 Juli 2026). Perubahan dari versi asli ditandai dengan blok `> ⚠️ REVISI`.

Fokus dokumen ini: **perbaikan pada modul existing** saja. Fitur baru (notification system, asset location tracking, sparepart bekas, field work report, recurring billing, dashboard widget) sengaja dilangkahi dulu.

Sumber: Minutes of Meeting (MoM) Demo Aplikasi PTPSN 2.0 — 10.07.2026, bagian 3 (Enhancement Request).

---

## Ringkasan Verifikasi Repo

| MoM | Item | Kondisi Repo | Aksi |
|-----|------|--------------|------|
| E | Komponen pajak tidak wajib | `items.*.tax.id` masih `required` di SalesInvoiceRequest & SalesOrderRequest (BE) **dan** kolom `tax` ditandai `required: true` di FE | **Perbaikan 1** |
| E | Susunan invoice dengan DPP | Konsep DPP belum ada sama sekali (grep "dpp" di seluruh `app/` + `database/migrations/` = 0 hasil) | **Perbaikan 2** |
| D | Durasi sewa dari pemakaian aktual | Rental hanya simpan range `start_date`/`end_date` di SO (input manual); `DeliveryNoteService` hanya tracking reservasi (`rents`/`rented_quantity`), tidak ada kalkulasi durasi → nilai tagihan | **Perbaikan 3** |
| A | Approval Ronal/Roky/Lia + akses harga Bu Lia | `ApprovalScheme` fleksibel sudah ada; column security (`visibleFor`) sudah jalan untuk item harga SO/PO, **tapi belum untuk `stocks.valuation_rate`** | **Konfigurasi + 1 audit kecil** (Perbaikan 4, direvisi) |
| A | Status proses terpantau | `ApprovalInstance` + trait `Submitable` sudah ada, dipakai luas (StockEntry, SalesOrder, PurchaseOrder, SalesInvoice, PurchaseInvoice, DeliveryNote, PurchaseReceipt, PurchaseRequest, Quotation, dll) | Tidak perlu |
| B | Barang In/Out tercatat | `StockEntry` mendukung 4 tipe (`item_receipt`, `item_issue`, `item_transfer`, `item_consumption`) + `StockLedgerEntry` (quantity_change, valuation_rate, balance_stock_value) sudah lengkap | Tidak perlu |
| C | Email wajib untuk semua user | Kolom `users.email` non-nullable sejak migration awal (`0001_01_01_000000_create_users_table.php:16`), tidak ada migration lanjutan yang mengubahnya jadi nullable | Tidak perlu |

---

## Perbaikan 1 — Tax Opsional di Sales (Kecil, tanpa spec)

**Konteks MoM:** "Komponen PPh tidak lagi menjadi field wajib; tetap tersedia sebagai field opsional."
Di sistem, field pajak bersifat generik (model `Tax`). Yang saat ini wajib adalah pajak per item di jalur Sales — Purchase sudah opsional (dikonfirmasi: `PurchaseOrderRequest.php:47` dan `PurchaseInvoiceRequest.php:41` sama-sama `nullable`).

**Perubahan:**

- `app/Http/Requests/Finances/SalesInvoiceRequest.php:43` — `items.*.tax.id`: `required` → `nullable` *(baris terverifikasi persis, belum bergeser)*
- `app/Http/Requests/Sales/SalesOrderRequest.php:48` — `items.*.tax.id`: `required` → `nullable` *(baris terverifikasi persis, belum bergeser)*
- FE: `resources/js/Pages/Finances/SalesInvoice/Form.jsx` & `resources/js/Pages/Sales/SalesOrders/Form.jsx` — kalkulasi turunan `tax_rate`/`tax_amount` sudah null-safe (`item.tax?.rate ?? 0`, ditemukan di `SalesInvoice/Form.jsx:562` dan `SalesOrders/Form.jsx:565`, keduanya persis), **tidak perlu diubah**.
  > ⚠️ **REVISI:** plan asli meremehkan scope FE ini. Kolom `tax` di config kolom tabel **eksplisit ditandai `required: true`**:
  > - `SalesInvoice/Form.jsx:202` (blok `name: "tax"`, baris 200–206)
  > - `SalesOrders/Form.jsx:288` (blok `name: "tax"`, baris 286–290)
  >
  > Ini harus ikut diubah (hapus/set `false` flag `required`) — bukan cuma "diverifikasi", karena kalau tidak, form FE akan tetap memblokir submit tanpa tax walau backend sudah `nullable`.
- Backend service: verifikasi `SalesInvoiceService`/`SalesOrderService` tidak ada asumsi tax selalu terisi *(belum diverifikasi detail — cek saat implementasi, bukan blocker rencana)*

**Test:** update/tambah feature test submit sales order & sales invoice tanpa tax → sukses, `tax_amount = 0`.

**Estimasi:** ±4 file (bertambah 1 dari revisi FE required-flag). Langsung dikerjakan tanpa spec.

---

## Perbaikan 2 — Susunan Invoice dengan DPP (Perlu spec)

**Konteks MoM:** "Penyesuaian susunan Invoice baru dengan adanya DPP (Dasar Pengenaan Pajak)."
Tidak ada konsep DPP di codebase (dikonfirmasi ulang: 0 match untuk "dpp" case-insensitive di `app/` dan `database/migrations/`). Struktur invoice item saat ini:

- Sales: migration `database/migrations/2025_10_18_081017_create_sales_invoice_items_table.php` — kolom `tax_id` (nullable FK), `tax_rate` (double, default 0), `basic_amount` (`storedAs('quantity * price')`), `tax_amount` (`storedAs('basic_amount * tax_rate / 100')`).
- Purchase: migration `database/migrations/2025_12_07_085509_create_purchase_invoice_items_table.php` — struktur serupa ditambah kolom `amount`.

**Scope spec (usulan nama: `invoice-dpp-adjustment`, tipe `feature`):**

1. Kolom/derivasi DPP pada `SalesInvoiceItem` (dan `PurchaseInvoiceItem` bila diperlukan), termasuk skenario **DPP Nilai Lain (11/12)** sesuai regulasi PPN 12%.
2. Konfigurasi per-tax atau per-invoice: apakah DPP = basic amount penuh atau nilai lain.
3. Tampilan DPP di Form/Show invoice (subtotal → DPP → PPN → total).
4. Penyesuaian print template invoice (modul `PrintTemplate`) agar susunan baru muncul di cetakan.
5. Migrasi data invoice existing (backfill DPP = basic_amount).

**Titik sentuh:** migration, `SalesInvoice`/`SalesInvoiceItem` model, `SalesInvoiceService`, FE Form/Show, print template, test.

**Open question (tanyakan ke PTPSN):** apakah DPP Nilai Lain berlaku untuk semua transaksi atau hanya jenis tertentu?

---

## Perbaikan 3 — Durasi Sewa Berdasarkan Pemakaian Aktual (Perlu spec)

**Konteks MoM:** "Durasi sewa dihitung berdasarkan penggunaan aktual sejak hari pertama."
Kondisi sekarang (diverifikasi ulang):

- `SalesOrder` model (`app/Models/Sales/SalesOrder.php:24-26`): cast `is_rent` (boolean), `start_date`/`end_date` (datetime), plus accessor virtual `rentDate()` (baris 42-53) yang menggabungkan keduanya jadi `{from, to}`. Migration `2025_07_26_100804_create_sales_orders_table.php:21,23,24`.
- FE `SalesOrders/Form.jsx:361-380`: checkbox `is_rent`, lalu `DatetimePicker type="daterange"` — **input manual**, tidak ada kalkulasi otomatis.
- `DeliveryNoteService.php:189-267` *(⚠️ REVISI baris: plan asli menyebut 193-271; bergeser tipis akibat commit terbaru `9d604a3e` & `b9177a1d` yang merefactor item selection & bug fix lain, bukan perubahan struktural pada logic rental itu sendiri)*: tracking `rents` (baris 226) + `rented_quantity` (baris 259) per stock saat serah terima — ini reservasi ketersediaan, bukan kalkulasi durasi.
- Dikonfirmasi: tidak ada kata kunci `duration`/`durasi`/`diffInDays`/`diffIn*` di `SalesOrderService.php` maupun `SalesInvoiceService.php`. Referensi `is_rent` di `SalesOrderService.php` (baris 224, 234-235, 252) hanya untuk validasi ketersediaan stok, bukan kalkulasi tagihan. `SalesInvoiceService.php` tidak menyebut "rent" sama sekali.

Kesimpulan: klaim "belum ada kalkulasi durasi → nilai tagihan; invoice rental dibuat manual dari SO" **terkonfirmasi akurat**, tidak perlu revisi.

**Scope spec (usulan nama: `rental-actual-duration`, tipe `feature`):**

1. Definisi "penggunaan aktual": mulai dari tanggal serah terima (delivery note) — hari pertama terhitung penuh.
2. Kalkulasi durasi berjalan (aktual vs rencana) per item rental di SO/Show.
3. Saat pembuatan invoice dari SO rental: prefill amount berdasarkan durasi aktual (tanggal DN keluar s/d tanggal pengembalian atau tanggal cut-off billing).
4. Handling pengembalian sebagian (sebagian item kembali lebih dulu).

**Catatan:** Recurring billing otomatis (tagihan periode berikutnya by due date) = **fitur baru, di-skip** sesuai keputusan. Spec ini hanya membereskan cara hitung durasinya.

**Titik sentuh:** `SalesOrderService`, `DeliveryNoteService`, `SalesInvoiceService`, FE SalesOrder/SalesInvoice, test.

**Open question (tanyakan ke PTPSN):** satuan billing (harian/bulanan), dan perlakuan hari pengembalian (dihitung penuh atau tidak).

---

## Perbaikan 4 — Konfigurasi Approval & Akses Harga (Tanpa coding, + 1 audit kecil)

**Konteks MoM:** approval Pak Ronal (proses tertentu), Pak Roky (PO & item), Bu Lia (billing + akses harga).

- **Approval:** `ApprovalScheme` (`app/Models/Core/ApprovalScheme.php`) sudah configurable — punya `permission_id`, `trigger_on`, `config` (JSON), relasi `steps()` ke `ApprovalSchemeStep` (dengan `is_advanced`, morph `approver()`, `hasMany` approvers). `ApprovalInstance` + trait `Submitable` dipakai luas di model transaksional.
  > ⚠️ **REVISI kecil:** infra ini datang dari spec `approval-auto-approve-multi-approver` (43/44 task selesai, 1 task tersisa: "Konfirmasi ke user sebelum menjalankan full test suite" — bukan blocker implementasi, hanya checkpoint yang belum di-run), **bukan** dari spec `linkmodel-column-security` seperti tertulis di plan asli (dua spec tertukar di draft awal).
  Aksi: setup skema di aplikasi — PO & item → Roky, billing → Lia, proses tertentu → Ronal. Dilakukan saat implementasi/training, bukan di kode.

- **Akses harga:** infra column security (`visibleFor`) dari spec `linkmodel-column-security` (7/7 task selesai — dikonfirmasi akurat). Dikonfirmasi aktif di:
  - `sales_order_items.price` — `app/Models/Sales/SalesOrderItem.php:71` (`visibleFor => self::PRICE_VISIBILITY`)
  - `purchase_order_items.rate` — `app/Models/Purchase/PurchaseOrderItem.php:58` (`visibleFor => self::PRICE_VISIBILITY`)
  - Juga aktif di `PurchaseInvoiceItem.php` dan `SalesInvoiceItem.php` (kolom harga terkait), digate lewat `ModelController.php:220-248` + `PermissionChecker.php`.

  > ⚠️ **REVISI — temuan audit:** `stocks.valuation_rate` **belum** menggunakan `visibleFor`. Dicek langsung di `app/Models/Inventory/Stock.php` — kolom ini bahkan tidak terdaftar sama sekali di `$configColumns` (baris 59-92), hanya ada sebagai cast float biasa (baris 23) yang di-set di beberapa method internal (baris 44, 51). Karena `valuation_rate` adalah harga pokok/HPP stok — data sensitif serupa `price`/`rate` — ini kandidat kuat untuk ditambahkan `visibleFor` dengan pola yang sama seperti `PRICE_VISIBILITY` di `SalesOrderItem`/`PurchaseOrderItem`.
  >
  > Aksi: tambahkan `visibleFor` untuk `valuation_rate` di `Stock.php` sebagai bagian dari Perbaikan 4 — perubahan kecil (~1 file), bisa dikerjakan bersamaan dengan Perbaikan 1 tanpa perlu spec terpisah. Perlu konfirmasi role/permission mana yang boleh melihat (kemungkinan sama dengan `PRICE_VISIBILITY`, atau role khusus inventory/finance — tanyakan ke user).

---

## Urutan Eksekusi

1. **Perbaikan 1** — langsung, tanpa spec (kecil). *(scope FE bertambah: hapus `required: true` di config kolom `tax`, bukan cuma verifikasi null-safety)*
2. **Perbaikan 4 (audit `valuation_rate`)** — bisa digabung sekaligus dengan langkah 1 karena sama-sama kecil dan tanpa spec.
3. **Perbaikan 2** — buat spec `invoice-dpp-adjustment` → requirements → design → tasks → implement.
4. **Perbaikan 3** — buat spec `rental-actual-duration` → requirements → design → tasks → implement.
5. **Perbaikan 4 (approval)** — sisanya konfigurasi saat implementasi/training, bukan coding.

Dua open question di atas sebaiknya dikonfirmasi ke PTPSN sebelum spec #2 dan #3 difinalkan. Tambahan: konfirmasi role yang berhak melihat `valuation_rate` sebelum audit Perbaikan 4 dieksekusi.
