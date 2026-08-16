# Design Document

## Investigasi kode (baseline sebelum perubahan)

### Frontend

- `resources/js/Pages/Purchase/PurchaseOrders/Form.jsx` — `mapItem` hitung `basic_amount`/`tax_amount` per baris (baris 531-539). Header `net_amount`/`tax_amount`/`amount` (baris 36-46) hanya jumlah array, **tidak ada** render `AdditionalDiscount` sama sekali (component di-import, tidak dipakai).
- `resources/js/Pages/Sales/SalesOrders/Form.jsx` — pola identik (baris 47-57, 562-570), TAPI merender `AdditionalDiscount` (baris 652-657). `amount` = `net_amount + tax_amount - discount_amount` (baris 56) — lump sum dari total, field header lain tidak reaktif.
- `resources/js/Pages/Finances/Components/AdditionalDiscount.jsx` — `setDiscount()` (baris 12-78) menghitung `discount_rate`/`discount_amount` dari basis `net_total` atau `grand_total`, hanya menyimpan ke state header. Tidak pernah menyentuh `data.items`.
- **Kesimpulan:** logika duplikat (bukan shared) antara PO dan SO untuk agregasi; `AdditionalDiscount` shared tapi cuma dipakai SO; PO tidak render diskon sama sekali.

### Backend

- `app/Utils.php::countAmount()` (baris 320-329) — satu-satunya titik kalkulasi diskon, dipanggil dari 3 tempat: `PurchaseOrderService::create()`, `PurchaseOrderService::update()`, `PurchaseOrderService::syncItems()`, dan `SalesOrderService` (pola sama). Semua hanya mengurangi `discount_amount` dari total akhir, tidak menyentuh item.
- `database/migrations/..._create_purchase_order_items_table.php` — `basic_amount` = `storedAs('quantity * rate')`, `tax_amount` = `storedAs('basic_amount * tax_rate / 100')`, `amount` = `storedAs('basic_amount + tax_amount')`. Sama pola di `sales_order_items`. **Generated column hanya bisa mengacu kolom di baris yang sama** — diskon ada di tabel parent (`purchase_orders`/`sales_orders`), jadi item **tidak mungkin** ikut hitung ulang tanpa mengubah kolom ini jadi non-generated.
- **Bug tambahan ditemukan** (bukan scope baru, harus diperbaiki karena ada di jalur yang sama): `PurchaseOrderService::update()` baris 160-163 menulis key `'total_amount'`/`'total_amount_base_currency'` ke `$purchaseOrder->update()`, padahal kolom & cast model bernama `amount`/`amount_base_currency` (lihat `create()` baris 100-102 yang benar pakai `amount`). Ini membuat `update()` PO **tidak pernah menyimpan total baru** — silent no-op field yang tidak exist di tabel akan diabaikan Eloquent. Diperbaiki sebagai bagian Task 1 karena langsung berada di fungsi yang direwrite.
- `app/Models/Finances/Tax.php` — `name` + `rate` (float) saja. Tidak ada kategori/arah.
- `suppliers` migration — tidak ada field NPWP/VAT sama sekali.
- `customers` migration — field `vat` (string, nullable, freetext, tanpa validasi).
- Modul Invoice (`SalesInvoiceItem`/`PurchaseInvoiceItem`) sudah ada dan sudah punya `dpp_amount` generated (`basic_amount * 11/12`, dari spec `invoice-dpp-adjustment`, selesai). Servicenya (`PurchaseInvoiceService`/`SalesInvoiceService`) **tidak** memakai `discount_on`/`countAmount` — jalur invoice terpisah dari jalur order, tidak kena bug ini.

## Arsitektur solusi

### Keputusan kunci 1 — Kalkulasi diskon pindah ke PHP, kolom item jadi non-generated

`basic_amount`, `tax_amount`, `amount` pada `purchase_order_items` dan `sales_order_items` diubah dari `storedAs()` jadi kolom `double` biasa. Nilainya dihitung di PHP (Service layer) dan ditulis eksplisit saat `create`/`update`/`syncItems`. Ini satu-satunya cara diskon header bisa memengaruhi baris — generated column secara struktural tidak bisa cross-row.

Migration per tabel:
```php
Schema::table('purchase_order_items', function (Blueprint $table) {
    $table->dropColumn(['amount', 'tax_amount', 'basic_amount']); // urutan: yang bergantung duluan
    $table->double('basic_amount')->default(0)->after('rate');
    $table->double('tax_amount')->default(0)->after('basic_amount');
    $table->double('amount')->default(0)->after('tax_amount');
});
```
`down()`: kembalikan sebagai `storedAs()` seperti semula (simetris, ikuti pola migration `invoice-dpp-adjustment` task 2.1 untuk urutan drop/re-add yang aman di SQLite).

### Keputusan kunci 2 — Satu service kalkulasi PHP dipakai PO & SO (bukan duplikat lagi)

Buat `app/Services/Shared/DocumentDiscountCalculator.php` (nama final ditentukan saat implementasi, cek konvensi namespace `Services/` yang ada — kemungkinan `app/Services/Finances/` lebih konsisten dengan lokasi `Tax` model). Fungsi utama:

```php
class DocumentDiscountCalculator {
    /**
     * @param array<int, array{basic_amount: float, tax_rate: float}> $lines
     * @return array<int, array{basic_amount: float, tax_amount: float, amount: float}>
     */
    public static function allocate(array $lines, ?string $discountOn, float $discountRate, float $discountAmount): array {
        // 1. Tentukan D (nominal diskon absolut) dari discountAmount jika latestDiscountKey == amount,
        //    atau dari discountRate * basis jika latestDiscountKey == rate.
        // 2. Basis Total Bersih: basis = sum(basic_amount); alokasi_i = D * (basic_amount_i / basis)
        //    new_basic_i = basic_amount_i - alokasi_i
        // 3. Basis Total Keseluruhan: basis = sum(basic_amount + tax_amount_pra_diskon);
        //    gross_i = basic_amount_i + tax_amount_pra_diskon_i
        //    alokasi_i = D * (gross_i / basis)
        //    reduksi_basic_i = alokasi_i / (1 + tax_rate_i/100)
        //    new_basic_i = basic_amount_i - reduksi_basic_i
        // 4. tax_amount_i = new_basic_i * tax_rate_i / 100
        // 5. Rounding: bulatkan tiap baris ke 2 desimal (atau minor unit currency dokumen),
        //    dorong residual ke baris dengan basic_amount terbesar agar sum() tetap presisi.
        // 6. Guard: D tidak boleh > basis; hasil new_basic_i tidak boleh < 0 (clamp + validasi upstream).
    }
}
```

Dipanggil dari `PurchaseOrderService::create()/update()/syncItems()` dan `SalesOrderService::create()/update()/syncItems()` menggantikan loop `$basicAmount += $item->basic_amount` polos — sekarang tiap item di-`update()` ulang dengan `basic_amount`/`tax_amount`/`amount` hasil alokasi, baru header `amount` dihitung dari total yang sudah teralokasi (bukan lagi lewat `Utils::countAmount` yang mengurangi lump-sum — fungsi itu **dipensiunkan** untuk PO/SO, header `amount` tinggal `sum(item.amount)`).

`Utils::countAmount()` **tidak dihapus** (kemungkinan dipakai tempat lain) — cek pemakaian lain sebelum keputusan hapus/deprecate saat task berjalan; jika hanya dipakai 2 service ini, deprecate dengan comment atau hapus dan update pemanggil.

### Keputusan kunci 3 — Frontend cermin logika PHP untuk live-preview

`AdditionalDiscount.jsx` dan kedua Form.jsx perlu fungsi JS yang menghasilkan angka **identik** dengan PHP (untuk live preview sebelum save). Opsi: tulis fungsi alokasi murni di `resources/js/lib/utils.js` (atau file baru `resources/js/lib/discountAllocation.js`) yang mengikuti algoritma yang sama persis (termasuk aturan rounding), dipakai baik oleh `AdditionalDiscount.jsx` (untuk hitung ulang `data.items` via `setData`) maupun ditampilkan di header PO/SO. Ini menghindari drift render-vs-persisted (Requirement 3.4) karena kedua sisi jalankan algoritma yang sama, bukan algoritma berbeda yang kebetulan cocok.

PO Form.jsx: tambah render `<AdditionalDiscount ... />` yang sudah di-import tapi belum dipakai (Requirement 2.4).

### Keputusan kunci 4 — Kategori Tax

Migration tambah ke tabel `taxes`:
```php
$table->string('category')->default('ppn_standard'); // ppn_standard | ppn_luxury | pph_21 | pph_22 | pph_23 | pph_4_2
$table->enum('behavior', ['additive', 'withholding'])->default('additive');
$table->boolean('use_dpp_nilai_lain')->default(false);
```
`Tax` model: tambah `category`/`behavior`/`use_dpp_nilai_lain` ke `$casts` dan `$configColumns`. Seeder baru/`TaxSeeder` (cek apakah sudah ada seeder Tax; kalau belum, buat) — insert `PPN 12% (DPP Nilai Lain 11/12)` dengan `rate=12, category=ppn_standard, behavior=additive, use_dpp_nilai_lain=true`.

Kalkulasi per baris saat `use_dpp_nilai_lain = true`: `dpp_i = basic_amount_i_setelah_diskon * 11/12`, lalu `tax_amount_i = dpp_i * tax_rate/100` (bukan langsung dari `basic_amount_i_setelah_diskon`). Ini masuk ke `DocumentDiscountCalculator` sebagai langkah tambahan setelah alokasi diskon, per baris, dicabang oleh flag tax record baris tsb.

Baris dengan `behavior = withholding`: dikeluarkan dari `tax_amount` yang dijumlah ke header pajak/Total. Perlu kolom baru di level header PO/SO (`withholding_amount`, tampil terpisah) — lihat tasks.md untuk detail field.

### Keputusan kunci 5 — Party fields

`suppliers`: tambah `npwp` (string, nullable), `nitku` (string, nullable). Validasi format di FormRequest: regex 15 digit **atau** 16 digit, format `\d{15}` atau `\d{16}` (raw digit, masking di FE saja — jangan simpan dengan separator supaya query/compare konsisten, ikuti pola field lain yang disimpan raw + diformat di render).

`customers`: rename `vat` → `npwp` (migration `renameColumn`, cek FE/BE reference ke `vat` sebelum rename — grep dulu saat implementasi), tambah `nitku` baru. Validasi sama seperti Supplier.

### Faktur Pajak (Requirement 7, gated)

Tidak didesain detail di sini sampai Requirement 7.1 dikonfirmasi. Jika in-scope, breakdown DPP/PPN/PPnBM disimpan di level `SalesInvoice`/`PurchaseInvoice` (header) sebagai kolom baru, bersumber dari agregasi item yang sudah benar (memakai `DocumentDiscountCalculator` yang sama jika invoice juga punya diskon dokumen — cek dulu apakah invoice punya `discount_on` sendiri atau mewarisi dari SO/PO asal).

## Test strategy

- **Unit test PHP**: `DocumentDiscountCalculator` — seluruh Case A-F di requirements.md Part 5 (acceptance test dari audit), plus edge case rounding (baris dengan basic_amount ganjil sehingga alokasi pro-rata tidak bulat).
- **Unit test JS**: fungsi alokasi di `resources/js/lib/` — sama test case, pastikan output PHP dan JS identik (bisa cross-check nilai literal yang sama di kedua test suite).
- **Feature test Laravel**: `PurchaseOrderService`/`SalesOrderService` create+update dengan diskon, assert `basic_amount`/`tax_amount` per item di DB setelah save match hasil kalkulasi, plus assert header `amount` benar.
- **E2E (Dusk/Playwright)**: isi form PO dengan 2 item beda tax rate, set diskon 10% Total Bersih, assert `Jumlah Dasar`/`Jumlah Pajak`/`Total` di layar match Case B, submit, reload, assert angka sama (Requirement 3.4).
- Rounding & invariant assertions (`Total == DPP + Tax`, `Σline == header`) di-assert di **setiap** test case di atas, bukan hanya sekali.

## Migration & rollout notes (bukan keputusan, disurfaced ke PO — lihat Requirement 8)

- Existing `purchase_order_items`/`sales_order_items` rows: setelah kolom jadi non-generated, nilai existing perlu di-backfill dengan formula lama dulu (`quantity*rate`, dst) via migration `up()` sebelum drop generated — supaya tidak ada NULL. Setelah itu, dokumen dengan diskon existing akan **tetap** menampilkan DPP/pajak lama (frozen) sampai dokumen tsb di-edit ulang dan disimpan (karena migration tidak menjalankan alokasi ulang, hanya konversi tipe kolom) — kecuali diputuskan sebaliknya oleh PO (Requirement 8.2).
