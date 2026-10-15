# Gap Modul Laporan: App Lama vs App Baru

Dokumen ini mencatat **apa yang ada di modul laporan app lama (Pataya Sarana
Niaga) tapi belum ada datanya di app baru**. Tujuannya untuk bahan diskusi tim:
mana yang perlu ditambahkan ke app baru, mana yang memang sudah tidak dipakai.

Disusun 14 Oktober 2026, berdasarkan 7 screenshot laporan app lama dan
penelusuran skema database app baru.

Status tiap gap:

- `BLOKIR` : kolom/KPI di app lama tidak bisa ditampilkan sama sekali
- `TURUNAN`: tidak ada kolomnya, tapi nilainya bisa dihitung dari data lain
- `LABEL` : datanya ada, cuma beda penamaan atau perlu pemetaan

---

## Ringkasan

| # | Gap | Status | Laporan terdampak | Dampak |
|---|-----|--------|-------------------|--------|
| 1 | Harga jual master item | `BLOKIR` | Stok Persediaan | 4 kolom + 2 KPI hilang |
| 2 | PPH (-2%) | `BLOKIR` | Invoice Penjualan, Invoice Pembelian | 1 kolom hilang per laporan |
| 3 | Potongan Breakdown | `BLOKIR` | Invoice Penjualan | 1 kolom hilang |
| 4 | Potongan Pungutan PPN (-11%) | `BLOKIR` | Invoice Penjualan | 1 kolom hilang |
| 5 | Jenis invoice (jasa/sewa) | `BLOKIR` | Invoice Penjualan | 1 kolom hilang |
| 6 | Tgl. Terima Invoice | `BLOKIR` | Invoice Pembelian | 1 kolom hilang |
| 7 | Catatan mutasi stok | `BLOKIR` | Mutasi Stock | 1 kolom hilang |
| 8 | Jenis transaksi stok | `TURUNAN` | Mutasi Stock | perlu peta FQCN -> label |
| 9 | Nilai Barang Diterima | `TURUNAN` | Stok Persediaan | perlu definisi |
| 10 | Label "PPN 10%" hardcode | `LABEL` | Invoice Pembelian | app lama salah, app baru 11% |

---

## 1. Harga jual master item — `BLOKIR`

**Di app lama**: laporan Stok Persediaan punya kolom `Harga Jual(Rp)`,
`Nilai Jual(Rp)`, `Nilai Laba(Rp)`, `Persentase`, plus KPI
`Nilai Jual Barang Dipegang` dan `Nilai Laba Barang Dipegang`.

**Di app baru**: `item_variants` tidak punya kolom harga jual. Tidak ada tabel
price list. Harga jual hanya tercatat per transaksi
(`sales_order_items.price`, `sales_invoice_items.price`).

**Akibatnya**: margin dan nilai jual persediaan tidak bisa dihitung. Laporan
Stok Persediaan di app baru hanya bisa menampilkan kuantitas dan nilai modal
(`stocks.valuation_rate`).

**Kalau mau ditambahkan**: perlu kolom harga jual di `item_variants` (atau
tabel price list terpisah kalau harga berbeda per pelanggan/periode), form
input di master item, dan pengisian data awal untuk seluruh item.

**Pertanyaan untuk tim**: apakah margin per item memang dipantau lewat laporan
ini, atau cukup lewat laporan penjualan? Kalau harga jual berbeda per
pelanggan, kolom tunggal di master item tidak akan akurat.

---

## 2. PPH (-2%) — `BLOKIR`

**Di app lama**: Laporan Invoice Penjualan punya kolom `PPH (-2%)`, Laporan
Invoice Pembelian punya kolom `PPH 2%`.

**Di app baru**: tabel `taxes` hanya berisi dua baris: `PPN 11%` (rate 11) dan
`Tanpa Pajak` (rate 0). Model `Tax` hanya punya `name` dan `rate`, tanpa field
jenis pajak.

Pajak disimpan per baris item (`sales_invoice_items.tax_id`, `tax_rate`,
`tax_amount`), bukan sebagai kolom tetap di header invoice.

**Akibatnya**: tidak ada cara membedakan PPN dari PPH. Walau nanti ada baris
`Tax` bernama "PPh 23", laporan tidak bisa memisahkannya ke kolom sendiri
tanpa menebak dari nama.

**Kalau mau ditambahkan**: tambah field `type` (enum: ppn / pph / potongan) di
tabel `taxes`, lalu laporan mengelompokkan kolom berdasarkan field itu.
Transaksi lama perlu di-backfill.

**Pertanyaan untuk tim**: apakah PPH memang dipotong di invoice, atau dicatat
terpisah di luar sistem?

---

## 3. Potongan Breakdown — `BLOKIR`

**Di app lama**: Laporan Invoice Penjualan punya kolom `Pot. Breakdown (-)`.
Pada data contoh nilainya 0 di semua baris yang terlihat.

**Di app baru**: tidak ada konsep potongan breakdown. `sales_invoices` punya
`discount_rate` dan `discount_amount`, tapi itu diskon biasa, bukan potongan
breakdown.

**Pertanyaan untuk tim**: apa arti "breakdown" di sini (potongan karena alat
rusak saat disewa?), dan apakah masih dipakai? Nilainya 0 di semua baris
contoh, mungkin fitur yang sudah tidak terpakai.

---

## 4. Potongan Pungutan PPN (-11%) — `BLOKIR`

**Di app lama**: Laporan Invoice Penjualan punya kolom
`Pot. Pungutan PPN (-11%)`. Pada data contoh nilainya 0 di semua baris yang
terlihat.

**Di app baru**: tidak ada. Sama seperti gap 2, akar masalahnya `taxes` tidak
punya jenis.

**Pertanyaan untuk tim**: ini terkait pemungut PPN (pelanggan BUMN/instansi
yang memungut sendiri PPN-nya). Apakah ada pelanggan seperti itu di app baru?
Kalau ya, perlu penanda di master pelanggan.

---

## 5. Jenis invoice (jasa / sewa) — `BLOKIR`

**Di app lama**: Laporan Invoice Penjualan punya kolom `Jenis` berisi nilai
seperti `jasa` dan `sewa`.

**Di app baru**: `sales_invoices` tidak punya field jenis. Yang mendekati:
`item_variants.type` (jenis item) dan `asset_services.type`, tapi keduanya di
level berbeda dan belum tentu artinya sama.

**Akibatnya**: invoice tidak bisa dikelompokkan jasa vs sewa.

**Kalau mau ditambahkan**: perlu diputuskan dulu apakah jenis ini melekat di
invoice, di sales order, atau diturunkan dari jenis item yang ditagih.

**Pertanyaan untuk tim**: jenis ini dipakai untuk apa? Kalau cuma untuk
memisah laporan, mungkin bisa diturunkan dari tipe item tanpa field baru.

---

## 6. Tgl. Terima Invoice — `BLOKIR`

**Di app lama**: Laporan Invoice Pembelian punya dua kolom tanggal terpisah:
`Tgl. Invoice` (tanggal di dokumen supplier) dan `Tgl. Terima Invoice`
(tanggal invoice diterima perusahaan). Pada data contoh keduanya sering
berbeda jauh, misalnya invoice bertanggal 26-11-2025 baru diterima 12-10-2026.

**Di app baru**: `purchase_invoices` hanya punya `date`. Ada `supplier_invoice`
(nomor invoice supplier) tapi tidak ada tanggal terimanya.

**Akibatnya**: tidak bisa memantau keterlambatan penerimaan invoice dari
supplier, padahal selisihnya bisa hampir setahun pada data contoh.

**Kalau mau ditambahkan**: satu kolom `received_date` di `purchase_invoices`
plus input di form. Relatif murah dibanding gap lain.

---

## 7. Catatan mutasi stok — `BLOKIR`

**Di app lama**: Laporan Mutasi Stok punya kolom `Catatan`. Pada data contoh
kolom ini kosong di semua baris yang terlihat.

**Di app baru**: `stock_ledger_entries` tidak punya kolom catatan.

**Pertanyaan untuk tim**: apakah kolom ini pernah terisi? Kalau kosong terus,
kemungkinan bisa dilewati. Kalau perlu, catatan bisa diambil dari dokumen
sumbernya (`referenceable`) ketimbang disimpan ulang di ledger.

---

## 8. Jenis transaksi stok — `TURUNAN`

**Di app lama**: Laporan Mutasi Stok punya kolom `Jenis Transaksi` berisi nilai
seperti `Internal Order` dan `Purchase`.

**Di app baru**: `stock_ledger_entries` tidak punya kolom jenis, tapi punya
`referenceable_type` berisi FQCN model sumber, misalnya
`App\Models\Purchase\PurchaseReceipt`.

**Bisa diturunkan**: perlu peta FQCN ke label Indonesia. Peta ini ditulis di
kode, bukan di database.

**Catatan**: di database dev saat ini `referenceable_type` baru berisi
`PurchaseInvoice` dan `PurchaseReceipt` (data dev masih tipis). Daftar lengkap
jenis dokumen yang menulis ke ledger perlu ditelusuri dari kode, bukan dari
data.

---

## 9. Nilai Barang Diterima — `TURUNAN`

**Di app lama**: Laporan Stok Persediaan punya kolom `Nilai Barang
Diterima(Rp)`.

**Di app baru**: tidak ada kolom dengan nama itu. Kemungkinan artinya total
nilai barang yang pernah diterima (akumulasi penerimaan), yang bisa dihitung
dari `stock_ledger_entries` dengan `quantity_change > 0`.

**Pertanyaan untuk tim**: konfirmasi definisinya. Kalau maksudnya akumulasi
seumur hidup item, perlu diputuskan apakah dibatasi periode atau tidak, karena
laporan Stok Persediaan di app lama tidak punya filter tanggal.

---

## 10. Label "PPN 10%" hardcode — `LABEL`

**Di app lama**: header kolom Laporan Invoice Pembelian tertulis `PPN 10%`,
padahal tarif PPN sekarang 11%. Laporan Invoice Penjualan menulis `PPN 11%`.
Tidak konsisten, dan yang 10% sudah usang.

**Di app baru**: tarif tersimpan di `sales_invoice_items.tax_rate` /
`purchase_invoice_items.tax_rate` per baris.

**Rekomendasi**: di app baru label kolom cukup `PPN` tanpa angka, atau angkanya
diambil dari data. Jangan ditulis mati seperti app lama supaya tidak usang lagi
saat tarif berubah.

---

## Gap implementasi: tautan dokumen sumber

Bukan gap data, tapi keterbatasan DataTable2 yang ditemukan saat implementasi.

Kolom `isLink` di DataTable2 selalu menautkan ke `{model}.show` dengan **id baris**.
Baris laporan yang id-nya bukan id dokumen tujuan tidak bisa memakai `isLink`:

| Req | Kolom | Tujuan | Status |
|-----|-------|--------|--------|
| 9.7 | Jenis transaksi (Mutasi Stock) | dokumen sumber, tipe berbeda per baris | belum: butuh tautan per baris |
| 15.5 | Kode pekerjaan (Pemakaian Sparepart) | AssetService | belum: id baris = id SLE item konsumsi |
| 16.3 | Kode pekerjaan (Anggota Tim) | AssetService | belum: id baris = id aktivitas |

Yang sudah berfungsi lewat `isLink`: nomor SO (10.6), nomor PO (12.6), nomor
invoice penjualan dan pembelian, serta nomor AssetService di Monitoring Work Order
(karena id baris sama dengan id AssetService).

Rencana: tambah tipe kolom tautan yang menerima URL dari accessor (`url` per baris),
atau pakai `col.route` dengan parameter id dari kolom lain.

## Yang justru lebih lengkap di app baru

Beberapa hal yang tidak ada di laporan app lama tapi tersedia di app baru, dan
bisa dipertimbangkan untuk ditampilkan:

| Data | Tabel | Kegunaan untuk laporan |
|------|-------|------------------------|
| Cabang (branch) | hampir semua dokumen | filter / kolom per cabang |
| Mata uang + kurs | dokumen finance | laporan multi-currency |
| PIC pelaksana | `asset_service_activities.pic_id` | Laporan Anggota Tim |
| Tim maintenance | `maintenance_team_members` | Laporan Anggota Tim |
| Status dokumen terstruktur | `status` (json) di semua dokumen | filter status yang konsisten |
| Tanggal kerusakan / mulai / selesai | `asset_services` | lead time Monitoring WO |
| Nilai sparepart terpakai | `asset_service_consumed_items.total_value` | Laporan Pemakaian Sparepart |

---

## Catatan penamaan: Work Order

Di app baru, menu **"Work Orders" mengarah ke `AssetService`**, bukan ke model
`Service\WorkOrder`. `DeskSeeder` secara eksplisit menyembunyikan menu
`workOrders.*` dan mempromosikan `assetServices.*` dengan label "Work Orders".
Model `WorkOrder` lama masih ada (route dan data tidak dihapus), tapi tidak
muncul di menu.

Karena itu, laporan **Monitoring Work Order** dan **Laporan Pemakaian
Sparepart** di app baru harus menargetkan `AssetService`, bukan
`Service\WorkOrder`.
