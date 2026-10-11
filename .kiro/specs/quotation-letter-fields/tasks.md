# Tasks: Quotation Letter Fields

> Status: `[ ]` todo · `[~]` queued · `[-]` in progress · `[x]` done
> Optional task ditandai `- [ ]* <id>`. **Pint/ESLint hanya dijalankan setelah SEMUA task selesai.**

Rujukan: [`requirements.md`](./requirements.md) · [`design.md`](./design.md) ·
[`referensi-surat.md`](./referensi-surat.md)

**Tahap 1** (T01–T09) sudah cukup untuk berhenti memakai Word.
**Tahap 2** (T10–T11) menambahkan perhitungan PPN otomatis.
Checkpoint di akhir tiap tahap: jalankan test suite, konfirmasi ke user.

---

## T01: Perbaikan React error #185

Perbaikan sudah diterapkan di working tree, tersisa verifikasi dan test.

- [x] 1. `resources/js/Pages/CRM/Quotations/Form.jsx`: `useFormPage` dipanggil dengan opsi kedua `{ trackDefaultValue: false }`, konsisten dengan PurchaseOrder/PurchaseReceipt/DeliveryNote (AC1.3)
- [x] 2. `Form.rtl.test.jsx`: test yang me-render form tambah (tanpa `defaultData`) dan memastikan tidak terjadi render berulang — assert komponen ter-render dan field `date` terisi (AC1.1, AC1.2)

## T02: Migration Dokumen & Item

- [x] 3. **TIDAK membuat Enum PHP.** `type` disimpan sebagai string biasa, mengikuti pola `discount_on` pada SalesOrder. Daftar nilai (`spare_part`/`new_unit`/`rental`) ditulis di komponen FE (T06.22) dan labelnya di berkas bahasa (T02.7). Lihat design 2.1
- [x] 4. Migration `add_letter_fields_to_quotations_table`: `type` (string, default `spare_part`, NOT NULL), `attn`, `subject`, `issued_city` (string nullable), `introduction` (text nullable), `basic_amount` + `tax_amount` (double default 0)
- [x] 5. Migration `add_letter_fields_to_quotation_items_table`: `item_unit_id` (foreignUlid → `item_units`, nullOnDelete), `remark` (string nullable), `tax_id` (foreignUlid → `taxes`, nullOnDelete), `tax_rate` + `basic_amount` + `tax_amount` (double default 0)
- [x] 6. Migration `convert_quotation_item_amount_to_stored_column`: baca nilai `amount` lama ke memori → drop `amount` (generated) → buat ulang `amount` sebagai kolom biasa → tulis balik nilai lama ke `amount` **dan** `basic_amount`. Tiap `dropColumn` di `Schema::table()` terpisah (catatan SQLite pada `convert_sales_order_items_amounts_to_stored_columns`). Lihat design 1.3
- [x] 7. `lang/id/crm/quotation.php` + `lang/en/crm/quotation.php`: kunci `type.spare_part`/`type.new_unit`/`type.rental`, label field header (`attn`, `subject`, `issued_city`, `introduction`), label kolom item (`remark`, `unit`, `part_no`, `tax`), label ringkasan (`basic_amount`, `tax_amount`)

## T03: Migration Blok Teks & Seeder

- [x] 8. Migration `create_quotation_sections_table`: `quotation_id` (cascadeOnDelete), `title` (string), `content` (text), `order` (unsignedSmallInteger default 0), `timestamps`, `softDeletes`
- [x] 9. Migration `create_quotation_section_templates_table`: `name`, `quotation_type` (string nullable), `title`, `content` (text), `order`, `timestamps`, `softDeletes`
- [x] 10. `app/Models/CRM/QuotationSection.php`: `$parentRelation = 'quotation'`, relasi `quotation()`, `$translateKey`, mengikuti bentuk `QuotationItem`
- [x] 11. `app/Models/CRM/QuotationSectionTemplate.php`: trait `DataTable`, `$configColumns` (name, quotation_type, title), `$translateKey`, `templateLink()` mengembalikan `:name`
- [x] 12. `database/seeders/QuotationSectionTemplateSeeder.php`: 5 template dengan isi **persis** dari `referensi-surat.md` — Terms & Conditions (`new_unit`); Note, Term of Payment, Owner Obligation, Tenant Obligation (`rental`). Idempoten via `updateOrCreate` berdasar `name` (AC5.7)
- [x] 13. `QuotationSectionTemplateSeeder` didaftarkan di `DatabaseSeeder`

## T04: Model & Relasi

- [x] 14. `app/Models/CRM/Quotation.php`: relasi `sections()` (`hasMany` + `orderBy('order')`); cast `basic_amount`/`tax_amount` → `float` (**`type` tidak di-cast**, string biasa); tambah `type` ke `$configColumns`; tambah `'sections'` ke `loadRelationsOnShow()`
- [x] 15. `app/Models/CRM/QuotationItem.php`: relasi `itemUnit()` (`belongsTo(ItemUnit::class, 'item_unit_id')`) dan `tax()` (`belongsTo(Tax::class)`); cast `tax_rate`/`basic_amount`/`tax_amount` → `float`
- [x] 16. `QuotationItem`: `$configColumns` untuk `basic_amount` dan `tax_amount` **wajib** memakai `'visibleFor' => self::PRICE_VISIBILITY` — keduanya dapat dipakai menghitung balik harga satuan (design 2.4, daftar risiko)

## T05: Service & Validasi

- [x] 17. `app/Services/CRM/QuotationService.php` — `fillRelations()`: tambah ekstraksi `tax_id` dan `item_unit_id` dari payload LinkModel, mengikuti pola `customer_id`/`opportunity_id`
- [x] 18. `QuotationService` — perhitungan amount di `create()` dan `update()`: hitung eksplisit per baris (`basic_amount = quantity * price`; `tax_amount = basic_amount * tax_rate / 100`; `amount = basic_amount + tax_amount`), akumulasi ke `quotations.basic_amount`/`tax_amount`/`amount`. Hapus `$itemModel->refresh()` yang tidak lagi diperlukan karena `amount` bukan generated column (design 2.2)
- [x] 19. `QuotationService`: sinkronisasi `sections` dengan pola sama seperti `items` — hapus yang tidak ada di payload, update yang ULID-nya valid, buat sisanya
- [x] 20. `app/Http/Requests/CRM/QuotationRequest.php`: aturan `type` (`Rule::in(['spare_part','new_unit','rental'])`, bukan `Rule::enum`), `attn` (required), `introduction` (required), `subject` + `valid_until` (`Rule::requiredIf` untuk `new_unit`/`rental`), `items.*.item_unit.id`, `items.*.remark`, `items.*.tax.id`, `sections.*` (design 2.3)
- [x] 21. `app/Http/Controllers/CRM/QuotationController.php` — `create()`: tambahkan `issued_city` dari `Preference::find('city')` dan `active_tax_id` ke `defaultData`

## T06: Form Header & Blok Teks (FE)

- [x] 22. `Form.jsx`: field `type` memakai komponen `Select` dengan `options={["spare_part","new_unit","rental"]}` dan `optionTrans="crm.quotation.columns.type.options"`, mengikuti `AdditionalDiscount.jsx:130-137`; plus `attn`, `subject`, `issued_city` (Input), `introduction` (Textarea). Field khusus jenis dirender kondisional mengikuti `Asset/Assets/Form.jsx:264`
- [x] 23. `resources/js/Pages/CRM/Quotations/QuotationSections.jsx`: daftar blok (tambah/hapus/urutkan), tiap blok berisi judul + `Textarea` isi
- [x] 24. `QuotationSections.jsx`: tombol "Ambil dari template" yang memuat blok sesuai `type` terpilih dan **menyalin** isinya ke dokumen (AC5.4)
- [x] 25. `QuotationSections.rtl.test.jsx`: tambah/hapus/urutkan blok; memuat dari template menyalin isi dan dapat diedit tanpa mengubah master

## T07: Tabel Item → FormTable (FE)

- [x] 26. `QuotationItems.jsx`: ganti penyusunan baris manual (`items.map()`) dengan `FormTable`, mengikuti pola `SalesOrders/Form.jsx` (design 3.2)
- [x] 27. `QuotationItems.jsx`: definisi kolom kondisional sesuai tabel AC9.4 — `item_code` hanya `spare_part`; `unit` bukan untuk `new_unit`; `remark` dan `amount` bukan untuk `rental`. Kolom falsy dibuang otomatis oleh `FormTable.jsx:571`
- [x] 28. `QuotationItems.jsx`: judul kolom dinamis via `title`/`titleTrans` — harga menjadi "Unit Price"/"Harga / unit"/"Harga / bulan", remark menjadi "Remark"/"Lead Time" (AC9.3)
- [x] 29. `QuotationItems.jsx`: `key` FormTable menyertakan jenis (`quotation-items-${type}`) supaya preferensi kolom tidak bocor antar jenis (AC9.6, daftar risiko)
- [x] 30. `QuotationItems.jsx`: kolom `description` memakai `Textarea` dan nilainya disalin dari item terpilih mengikuti `SalesOrders/Form.jsx:165` (AC4.4, AC4.5)
- [x] 31. `QuotationItems.rtl.test.jsx`: kolom yang tampil sesuai AC9.4 untuk ketiga jenis; judul kolom harga berubah mengikuti jenis
- [x] 32. `Form.rtl.test.jsx`: field kondisional muncul/hilang saat `type` diganti

## T08: Template Cetak

- [x] 33. Sesuaikan template "Default - Quotation" yang sudah ada menjadi varian `spare_part`: kota + tanggal, tujuan, Attn, nomor, pengantar, tabel (No, Part No, Description, Quantity, Unit, Unit Price, Amount, Remark), Sub Total / pajak / Total, blok `sections`, penutup, `{{approvalSignature}}` (AC8.3, AC8.4)
- [x] 34. Template `Default - Quotation New Unit` (`default_language: en`): tabel Equipment Type / Model / QTY / harga / Lead Time, **tanpa** baris ringkasan; judul kolom harga dapat memuat lokasi penyerahan dan tidak ditulis mati (AC8.5) **Catatan:** lokasi penyerahan belum punya sumber data di skema, jadi judul kolom harga generik ("Unit Price (IDR) Before PPN").
- [x] 35. Template `Default - Quotation Rental` (`default_language: en`): daftar label-nilai **tanpa tabel**, sesuai bentuk surat asli (AC8.6) **Catatan:** label "Rent price" generik, tanpa nama kota (belum ada sumber data).
- [x] 36. Ketiga template: elemen `description` dan `sections.*.content` memakai `white-space: pre-line` agar blok spesifikasi dan daftar bernomor tidak melebur (AC4.5, AC5.6)
- [x] 37. `QuotationController::print()`: override yang meresolusi `PrintTemplate` berdasar `type`, lalu memanggil `parent::print()`. Fallback ke `is_default` bila template jenis tidak ditemukan (design 2.5, AC8.2)
- [x] 38. Seeder/migration data untuk ketiga template, idempoten berdasar `name`

## T09: Test Backend Tahap 1

- [x] 39. `tests/Feature/CRM/QuotationLetterFieldsTest.php`: simpan & muat field header; `subject` dan `valid_until` wajib untuk `new_unit`/`rental` tetapi opsional untuk `spare_part` (AC3.2, AC3.5)
- [x] 40. `tests/Feature/CRM/QuotationSectionTest.php`: tambah/urutkan/hapus blok; penyalinan dari template tidak mengubah master (AC5.4)
- [x] 41. `tests/Feature/CRM/QuotationPrintTemplateTest.php`: template terpilih sesuai `type`; fallback ke `is_default` saat template jenis tidak ada (AC8.2)
- [x] 42. `tests/Feature/CRM/QuotationItemPriceVisibilityTest.php`: `basic_amount` dan `tax_amount` tidak terlihat bagi peran tanpa izin harga (design 2.4)
- [x] 43. Test migration: Quotation dengan item yang dibuat sebelum migration T02.6 tetap memiliki nilai `amount` yang sama sesudahnya (daftar risiko)

> **CHECKPOINT TAHAP 1 — STOP.** Jalankan `php artisan test --compact` dan
> `npm run test`. Ketiga surat sudah dapat dibuat dan dicetak dari sistem.
> Konfirmasi ke user sebelum lanjut tahap 2.

---

## T10: Pajak Aktif Global

- [ ] 44. `app/Http/Controllers/Core/CompanyController.php` — `index()`: resolve `active_tax_id` menjadi object `Tax` untuk LinkModel, mengikuti perlakuan `default_currency_id`
- [ ] 45. `CompanyController` — `update()`: ekstrak `id` dari payload LinkModel `active_tax_id`. Ditangani **terpisah** dari loop `$codeField` karena memakai ULID apa adanya, bukan `code` yang di-`strtoupper` (design 2.6)
- [ ] 46. `resources/js/Pages/Settings/Company.jsx`: `LinkModel` pemilih pajak aktif, mengikuti field `default_currency_id` yang sudah ada
- [ ] 47. `QuotationController::create()` / `QuotationItems.jsx`: baris item baru memakai `tax_id` dari `active_tax_id`; bila preference kosong, `tax_rate` 0 dan form tetap berjalan (AC6.5, AC7.4)

## T11: Ringkasan PPN & Test Tahap 2

- [ ] 48. `Form.jsx`: ringkasan `basic_amount` / `tax_amount` / `amount` menggantikan perhitungan `useMemo` + `calculateArray` yang ada; hanya ditampilkan untuk `spare_part` (AC6.3, AC6.4)
- [ ] 49. Template `spare_part`: label pajak mengikuti nama `Tax` terpilih (mis. "PPN 11%"), bukan teks yang ditulis mati (AC6.7)
- [ ] 50. `tests/Feature/CRM/QuotationTaxCalculationTest.php`: `basic_amount`/`tax_amount`/`amount` per baris dan akumulasi dokumen; `tax_rate` 0 saat `active_tax_id` kosong (AC7.4); mengganti pajak aktif **tidak** mengubah Quotation tersimpan (AC7.5)

> **CHECKPOINT TAHAP 2 — STOP.** Jalankan test suite penuh, lalu
> `vendor/bin/pint --dirty --format agent` dan `npm run lint`.
> Konfirmasi ke user.

---

## Catatan Pengerjaan

- **Lint/Pint hanya di akhir**, bukan per task.
- Test render FE **wajib** bersufiks `.rtl.test.jsx`; tanpa itu berjalan di
  environment `node` dan gagal dengan `document is not defined`.
- Urutan migration T02.4 → T02.5 → T02.6 tidak boleh ditukar: T02.6 mengubah
  kolom yang dibuat T02.5.
- Seluruh kolom pajak dibuat pada tahap 1 walaupun dipakai pada tahap 2, agar
  tabel yang sama tidak diubah dua kali.
- **OQ1 masih terbuka** (pajak 2% untuk jasa, menunggu konfirmasi keuangan) dan
  tidak termasuk task mana pun.
