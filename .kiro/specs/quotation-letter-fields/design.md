# Design: Quotation Letter Fields

Rujukan: [`requirements.md`](./requirements.md) dan
[`referensi-surat.md`](./referensi-surat.md).

## Ringkasan Pendekatan

Tiga jenis surat ditangani **satu struktur data, satu form, tiga template
cetak**. Tidak ada tabel, model, atau komponen form terpisah per jenis.

| Lapis | Keputusan |
|---|---|
| Database | `quotations` + `quotation_items` + `quotation_sections` (baru), dipakai ketiga jenis |
| Form | satu `Form.jsx`, kolom `FormTable` menyesuaikan `type` |
| Cetak | tiga record `print_templates`, dipilih berdasar `type` |

Alasan lengkap ada di Prinsip Desain P1–P3 pada requirements.

---

## 1. Perubahan Database

### 1.1 `quotations` — kolom baru

Migration: `add_letter_fields_to_quotations_table`.

| Kolom | Tipe | Null | Keterangan |
|---|---|---|---|
| `type` | `string` | tidak | `spare_part` \| `new_unit` \| `rental`. Default `spare_part` agar data lama valid. |
| `attn` | `string` | ya | Nama PIC. Menampung "Bapak Faqih / Ibu Dwi" dan "Bp. Antok Jatmiko (General Manager LR 3 Surabaya)". |
| `subject` | `string` | ya | Perihal surat. |
| `issued_city` | `string` | ya | Kota terbit. Default dari preference `city`. |
| `introduction` | `text` | ya | Kalimat pengantar. |
| `basic_amount` | `double` | tidak | Sub Total, default 0. |
| `tax_amount` | `double` | tidak | Jumlah pajak, default 0. |

`amount` yang sudah ada tetap dipakai sebagai Total (`basic_amount +
tax_amount`), sehingga kolom yang sudah dipakai `configColumns` dan modul lain
tidak berubah artinya.

**Semua kolom baru `nullable` kecuali `type`.** Requirement menyebut sebagian
bersifat required (AC3.1, AC3.4), tetapi itu **divalidasi di FormRequest**,
bukan di level kolom. Alasannya: Quotation memakai trait `Submitable`, sehingga
dokumen berstatus draft harus dapat disimpan setengah jadi. Menjadikannya `NOT
NULL` juga akan menggagalkan migration pada data yang sudah ada.

### 1.2 `quotation_items` — kolom baru

Migration: `add_letter_fields_to_quotation_items_table`.

| Kolom | Tipe | Null | Keterangan |
|---|---|---|---|
| `item_unit_id` | `foreignUlid` → `item_units` | ya | `nullOnDelete`, mengikuti `sales_order_items`. |
| `remark` | `string` | ya | Lead time: "1-2 hari", "Unit Ready Jakarta". |
| `tax_id` | `foreignUlid` → `taxes` | ya | `nullOnDelete`. |
| `tax_rate` | `double` | tidak | Default 0. |
| `basic_amount` | `double` | tidak | Default 0. |
| `tax_amount` | `double` | tidak | Default 0. |

### 1.3 Perubahan `amount` pada `quotation_items` — perhatian khusus

Saat ini `amount` adalah **stored generated column** `quantity * price`
(migration `2026_07_13_090002`). Dengan hadirnya pajak, rumusnya menjadi
`basic_amount + tax_amount`.

Mengubah generated column tidak dapat dilakukan dengan `ALTER` biasa. Pola yang
sudah terbukti di repo ini adalah
`2026_08_16_130521_convert_sales_order_items_amounts_to_stored_columns`:

1. Baca nilai `amount` yang ada ke memori.
2. Drop `amount` (generated).
3. Tambah `basic_amount`, `tax_amount`, `amount` sebagai kolom biasa.
4. Tulis balik nilai lama ke `amount`, dan ke `basic_amount` (karena sebelum ada
   pajak, `basic_amount` = `amount`).

**Konsekuensi penting:** setelah konversi, `amount` **bukan lagi** kolom
terhitung otomatis. Nilainya harus dihitung di `QuotationService` (lihat 2.2).
Ini persis yang terjadi pada `sales_order_items`, jadi bukan penyimpangan pola.

Tiap `dropColumn` dijalankan di `Schema::table()` terpisah, sesuai catatan pada
migration SalesOrder: table-rebuild SQLite gagal bila masih ada generated column
lain yang mereferensikan kolom yang sedang di-drop.

### 1.4 `quotation_sections` — tabel baru

Migration: `create_quotation_sections_table`.

| Kolom | Tipe | Null | Keterangan |
|---|---|---|---|
| `id` | `ulid` primary | tidak | |
| `quotation_id` | `foreignUlid` → `quotations` | tidak | `cascadeOnDelete` |
| `title` | `string` | tidak | "Terms & Conditions", "Owner Obligation", dst. |
| `content` | `text` | tidak | Isi multi-baris, penomoran ditulis manual. |
| `order` | `unsignedSmallInteger` | tidak | Default 0. |
| `timestamps`, `softDeletes` | | | Mengikuti `quotation_items`. |

Struktur generik ini yang memenuhi AC5.3: menambah jenis blok baru cukup
menambah baris, tanpa migration.

### 1.5 `quotation_section_templates` — tabel baru

Migration: `create_quotation_section_templates_table`. Mengikuti bentuk
`payment_term_templates` (AC5.5).

| Kolom | Tipe | Null | Keterangan |
|---|---|---|---|
| `id` | `ulid` primary | tidak | |
| `name` | `string` | tidak | Nama template, tampil di daftar pilihan. |
| `quotation_type` | `string` | ya | Jenis yang mengusulkan blok ini. `null` = berlaku untuk semua jenis. |
| `title` | `string` | tidak | Judul blok yang akan disalin. |
| `content` | `text` | tidak | Isi yang akan disalin. |
| `order` | `unsignedSmallInteger` | tidak | Urutan usulan. |
| `timestamps`, `softDeletes` | | | |

`quotation_type` inilah yang memungkinkan AC5.4: saat jenis dipilih, blok yang
lazim untuk jenis itu diusulkan otomatis.

### 1.6 Seeder isi blok

`QuotationSectionTemplateSeeder` mengisi tabel di atas dengan bunyi persis dari
`referensi-surat.md` (AC5.7):

| `quotation_type` | `title` | Isi |
|---|---|---|
| `new_unit` | Terms & Conditions | 3 poin: terms of payment, warranty, validity |
| `rental` | Note | All price excluded/included, minimum sewa |
| `rental` | Term of Payment | 3 poin |
| `rental` | Owner Obligation | 4 poin |
| `rental` | Tenant Obligation | 6 poin |

Seeder bersifat idempoten (`updateOrCreate` berdasar `name`) agar aman
dijalankan ulang.

### 1.7 Preference `active_tax_id`

Tidak memerlukan migration: `preferences` adalah key-value store
(`key` primary, `value` text). Cukup ditulis lewat `CompanyController::update()`.

Record `Tax` bernama "PPN 11%" **sudah ada** di database
(`01m3ehdbt4qnsn3v5489ccx9y0`), sehingga tidak perlu seeder pajak.

---

## 2. Perubahan Backend

### 2.1 Nilai `type` — string biasa, tanpa Enum PHP

`type` disimpan sebagai **kolom string biasa**. Tidak dibuat Enum PHP, tidak ada
cast pada model, dan tidak ada aturan `Rule::enum` pada Request.

Mengikuti pola `discount_on` pada SalesOrder yang sudah dipakai di produksi:

| Lapis | Perlakuan |
|---|---|
| Database | kolom `string` |
| Model | tanpa cast |
| Request | `Rule::in(['spare_part', 'new_unit', 'rental'])` |
| Frontend | komponen `Select` dengan `options` berupa array string |
| Label | berkas bahasa, sebagai array bersarang di bawah `type.options` |

Daftar nilai ditulis di komponen frontend:

```jsx
<Select
  value={data.type}
  onValueChange={(val) => setData("type", val)}
  placeholder={t("crm.quotation.columns.type.placeholder")}
  optionTrans="crm.quotation.columns.type.options"
  options={["spare_part", "new_unit", "rental"]}
/>
```

Komponen `Select` mengambil label tiap opsi dari `<optionTrans>.<nilai>`, jadi
berkas bahasa cukup memuat:

```php
'type.options' => [
    'spare_part' => 'Spare Part & Jasa',
    'new_unit'   => 'Unit Baru',
    'rental'     => 'Kontrak Sewa',
],
```

Rujukan lengkap: `resources/js/Pages/Finances/Components/AdditionalDiscount.jsx:130-137`
dan `lang/id/sales/salesOrder.php:69-72`.

### 2.2 `QuotationService`

Perubahan pada `create()` dan `update()`:

**Perhitungan amount.** Saat ini menjumlahkan `$itemModel->amount` setelah
`refresh()`, karena `amount` adalah generated column. Setelah 1.3, `amount`
bukan lagi generated, sehingga perhitungan harus eksplisit per baris:

```
basic_amount = quantity * price
tax_amount   = basic_amount * tax_rate / 100
amount       = basic_amount + tax_amount
```

Lalu diakumulasi ke dokumen: `quotations.basic_amount`, `tax_amount`, dan
`amount`. Panggilan `$itemModel->refresh()` menjadi tidak perlu untuk keperluan
ini dan dihapus, karena nilainya sudah dihitung sebelum disimpan.

**`fillRelations()`** ditambah `tax_id` dan `item_unit_id` dari payload
LinkModel, mengikuti pola `customer_id`/`opportunity_id` yang sudah ada.

**Sinkronisasi sections.** Menambahkan penanganan `quotation_sections` dengan
pola yang sama seperti `items`: hapus yang tidak ada di payload, update yang
ULID-nya valid, buat yang baru.

**Default `tax_id`.** Dibaca dengan
`Preference::find('active_tax_id')?->value` (AC7.3), mengikuti
`SalesOrderService::create()` yang membaca `default_currency_id`. Nilai ini
dikirim ke frontend lewat controller, bukan dipaksakan di service, agar user
tetap dapat mengubahnya per baris (AC6.6).

### 2.3 `QuotationRequest`

Aturan baru:

```php
'type'                 => ['required', Rule::in(['spare_part', 'new_unit', 'rental'])],
'attn'                 => ['required', 'string', 'max:255'],
'subject'              => [
    Rule::requiredIf(fn () => in_array($this->input('type'), ['new_unit', 'rental'])),
    'nullable', 'string', 'max:255',
],
'issued_city'          => ['nullable', 'string', 'max:255'],
'introduction'         => ['required', 'string'],
'valid_until'          => [
    Rule::requiredIf(fn () => in_array($this->input('type'), ['new_unit', 'rental'])),
    'nullable', 'date', 'after_or_equal:date',
],
'items.*.item_unit.id' => ['nullable', 'string', 'exists:item_units,id'],
'items.*.remark'       => ['nullable', 'string', 'max:255'],
'items.*.tax.id'       => ['nullable', 'string', 'exists:taxes,id'],
'sections'             => ['nullable', 'array'],
'sections.*.title'     => ['required', 'string', 'max:255'],
'sections.*.content'   => ['required', 'string'],
'sections.*.order'     => ['nullable', 'integer', 'min:0'],
```

`valid_until` yang sudah ada diubah menjadi conditional required (AC3.5).
`Rule::requiredIf` dipilih daripada `required_if` string agar kondisinya terbaca
jelas dan tidak bergantung pada penulisan nilai di dalam string.

### 2.4 Model

**`Quotation`**: tambah relasi `sections()` (`hasMany`, `orderBy('order')`),
cast `basic_amount`/`tax_amount` ke `float`. `type` **tidak** di-cast, karena
disimpan sebagai string biasa (lihat 2.1).
Tambahkan `type` ke `configColumns` agar dapat difilter di daftar, dan
`'sections'` ke `loadRelationsOnShow()`.

**`QuotationItem`**: tambah relasi `itemUnit()` dan `tax()`, cast `tax_rate`,
`basic_amount`, `tax_amount` ke `float`.

> **Perhatian keamanan data.** `QuotationItem` memiliki konstanta
> `PRICE_VISIBILITY` yang membatasi siapa dapat melihat `price` dan `amount`.
> Kolom `basic_amount` dan `tax_amount` **wajib memakai `visibleFor` yang sama**,
> karena keduanya dapat dipakai menghitung balik harga satuan. Melewatkan ini
> membocorkan harga kepada peran yang tidak berhak.

**`QuotationSection`** (baru): model sederhana dengan `$parentRelation =
'quotation'`, mengikuti `QuotationItem`.

**`QuotationSectionTemplate`** (baru): model master dengan trait `DataTable`,
mengikuti `Tax` dan `PaymentTermTemplate`.

### 2.5 `QuotationController`

**`create()`**: menambahkan `issued_city` dari preference `city` dan
`active_tax_id` ke `defaultData`.

**`print()`**: **di-override** untuk memilih template berdasar `type` (AC8.2).
`Controller::print()` menerima `?PrintTemplate $printTemplate` dan hanya jatuh
ke `is_default` bila argumen kosong (`Controller.php:356-363`), sehingga
override cukup meresolusi template lalu memanggil `parent::print()`. Controller
dasar yang dipakai seluruh modul tidak perlu diubah.

Pemetaan `type` → template memakai nama template yang tetap:
`Default - Quotation Spare Part`, `Default - Quotation New Unit`,
`Default - Quotation Rental`. Bila template untuk suatu jenis tidak ditemukan,
jatuh ke perilaku lama (`is_default`), sehingga pencetakan tidak pernah gagal
total.

### 2.6 `CompanyController`

Mengikuti persis pola `default_currency_id` (AC7.2):

- `index()`: resolve `active_tax_id` menjadi object `Tax` untuk LinkModel.
- `update()`: ekstrak `id` dari payload LinkModel sebelum disimpan. Berbeda dari
  `default_currency_id` dan `country_id` yang memakai `code` dan di-`strtoupper`,
  `active_tax_id` memakai `id` ULID apa adanya, sehingga ditangani terpisah dari
  loop `$codeField` yang ada.

---

## 3. Perubahan Frontend

### 3.1 `Form.jsx`

**Perbaikan R1** (sudah diterapkan): `useFormPage` dipanggil dengan
`{ trackDefaultValue: false }`.

**Field baru**: `type` (Select), `attn`, `subject`, `issued_city` (Input),
`introduction` (Textarea). Field yang hanya berlaku sebagian jenis dirender
kondisional mengikuti `Asset/Assets/Form.jsx:264`.

**Ringkasan**: `basic_amount`, `tax_amount`, `amount` menggantikan perhitungan
`amount` yang sekarang memakai `useMemo` + `calculateArray`. Ditampilkan hanya
untuk `spare_part` (AC6.3, AC6.4).

### 3.2 `QuotationItems.jsx` → `FormTable`

Komponen saat ini menyusun baris secara manual dengan `items.map()`. Untuk
memenuhi R9 (kolom kondisional, judul dinamis, preferensi kolom per jenis),
komponen ini **diganti memakai `FormTable`**, seperti SalesOrder.

Ini bukan sekadar penyesuaian gaya: `FormTable` sudah menyediakan tiga hal yang
diminta R9 dan tidak dimiliki implementasi manual saat ini:

| Kebutuhan | Dukungan `FormTable` |
|---|---|
| Kolom kondisional | `.filter((col) => col)` pada `FormTable.jsx:571` — definisi kolom falsy dibuang, sehingga `type === "rental" && {...}` berlaku langsung |
| Judul kolom dinamis | `col.titleTrans ? t(col.titleTrans) : col.title` pada `FormTable.jsx:1284` |
| Preferensi kolom per user | `getFromLocalStorage(key)` pada `FormTable.jsx:583` |

**Definisi kolom** mengikuti tabel AC9.4. Contoh bentuknya:

```js
const columns = [
  type === "spare_part" && { name: "item_code", titleTrans: "...part_no" },
  { name: "item", titleTrans: "...item", required: true },
  { name: "description", titleTrans: "...description" },
  { name: "quantity", titleTrans: "...quantity", required: true },
  type !== "new_unit" && { name: "unit", titleTrans: "...unit" },
  { name: "price", title: priceColumnTitle },
  type !== "rental" && { name: "remark", title: remarkColumnTitle },
  type !== "rental" && { name: "amount", titleTrans: "...amount" },
];
```

`priceColumnTitle` dan `remarkColumnTitle` diturunkan dari `type`, memenuhi
AC9.3.

> **Wajib: `key` menyertakan jenis** (AC9.6). `FormTable` menyimpan preferensi
> kolom di localStorage per `key`. Bila ketiga jenis berbagi `key` yang sama,
> preferensi dari satu jenis terbawa ke jenis lain dan menyembunyikan kolom yang
> seharusnya tampil. Gunakan `key={`quotation-items-${type}`}`.

**Deskripsi multi-baris** (AC4.5): kolom `description` memakai `Textarea`, dan
nilai `description` disalin dari item terpilih mengikuti
`SalesOrders/Form.jsx:165`.

### 3.3 Komponen blok teks

Komponen baru `QuotationSections.jsx`: daftar blok yang dapat ditambah, dihapus,
dan diurutkan, masing-masing dengan judul dan `Textarea` isi.

Tombol "Ambil dari template" memuat blok dari
`quotation_section_templates` sesuai `type` terpilih, lalu **menyalin** isinya
(AC5.4). Setelah disalin, isi menjadi milik dokumen dan perubahannya tidak
mempengaruhi master.

### 3.4 `Settings/Company`

Menambah satu `LinkModel` untuk memilih `active_tax_id`, mengikuti field
`default_currency_id` yang sudah ada di halaman tersebut.

---

## 4. Template Cetak

Tiga record pada `print_templates` dengan `model = App\Models\CRM\Quotation`.
Template "Default - Quotation" yang sudah ada disesuaikan menjadi varian
`spare_part` (AC8.1).

| Template | `default_language` | Bentuk isi |
|---|---|---|
| `Default - Quotation Spare Part` | `id` | Tabel + Sub Total / PPN / Total |
| `Default - Quotation New Unit` | `en` | Tabel tanpa ringkasan |
| `Default - Quotation Rental` | `en` | Daftar label-nilai, tanpa tabel |

Bagian yang sama pada ketiganya: kota + tanggal, tujuan, Attn/Up, nomor,
pengantar, blok `sections` berurutan, penutup, dan tanda tangan lewat
`{{approvalSignature}}` (AC8.9).

**Multi-baris** (AC4.5, AC5.6): elemen yang menampilkan `description` dan
`sections.*.content` memakai `white-space: pre-line`, agar blok spesifikasi dan
daftar bernomor tidak melebur menjadi satu paragraf.

**Kop surat** memakai mekanisme `is_letter_head` yang sudah ada dan tidak
diduplikasi ke dalam ketiga template (AC8.11).

---

## 5. Urutan Migration

Urutan penting karena 1.3 mengubah kolom yang dipakai 1.2:

1. `add_letter_fields_to_quotations_table`
2. `add_letter_fields_to_quotation_items_table` — kolom baru, termasuk
   `basic_amount` dan `tax_amount`
3. `convert_quotation_item_amount_to_stored_column` — drop `amount` generated,
   buat ulang sebagai kolom biasa, tulis balik nilai lama
4. `create_quotation_sections_table`
5. `create_quotation_section_templates_table`

Seluruh kolom pajak dibuat pada tahap 1 walaupun R6/R7 dikerjakan pada tahap 2,
agar tabel yang sama tidak diubah dua kali (lihat Urutan Pengerjaan pada
requirements).

---

## 6. Rencana Pengujian

Mengikuti aturan repo: PHPUnit untuk backend, Vitest untuk frontend, test
di-co-locate dengan sumbernya.

### Backend

| Berkas | Cakupan |
|---|---|
| `QuotationLetterFieldsTest` | Simpan & muat field header; validasi conditional `subject`/`valid_until` per jenis (AC3.2, AC3.5) |
| `QuotationTaxCalculationTest` | `basic_amount`/`tax_amount`/`amount` per baris dan akumulasi dokumen; `tax_rate` 0 saat `active_tax_id` kosong (AC7.4); nilai tersimpan tidak berubah saat pajak aktif diganti (AC7.5) |
| `QuotationSectionTest` | Tambah, urutkan, hapus blok; penyalinan dari template tidak mengubah master (AC5.4) |
| `QuotationPrintTemplateTest` | Pemilihan template per `type`; fallback ke `is_default` bila template jenis tidak ada (AC8.2) |
| `QuotationItemPriceVisibilityTest` | `basic_amount` dan `tax_amount` tersembunyi bagi peran tanpa izin harga (lihat peringatan di 2.4) |

Migration 1.3 diverifikasi lewat test yang menyimpan Quotation dengan item
sebelum dan sesudah, memastikan nilai `amount` lama tidak hilang.

### Frontend

| Berkas | Jenis | Cakupan |
|---|---|---|
| `Form.rtl.test.jsx` | RTL | Form terbuka tanpa error #185 (AC1.1); field kondisional muncul/hilang per jenis |
| `QuotationItems.rtl.test.jsx` | RTL | Kolom tampil sesuai AC9.4 untuk ketiga jenis; judul kolom harga berubah (AC9.3) |
| `QuotationSections.rtl.test.jsx` | RTL | Tambah/hapus/urutkan blok; muat dari template |

Test render memakai sufiks `.rtl.test.jsx` sesuai `vitest.config.js`; tanpa
sufiks ini test berjalan di environment `node` dan gagal dengan `document is not
defined`.

---

## 7. Risiko

| Risiko | Penanganan |
|---|---|
| Migration 1.3 menghilangkan nilai `amount` yang sudah ada | Baca nilai lama ke memori sebelum drop, tulis balik setelah kolom dibuat; ditutup test migration |
| `basic_amount`/`tax_amount` membocorkan harga | Wajib memakai `visibleFor: PRICE_VISIBILITY` (2.4) |
| Preferensi kolom `FormTable` bocor antar jenis | `key` menyertakan `type` (AC9.6) |
| Penggantian `QuotationItems.jsx` ke `FormTable` mengubah perilaku yang sudah dipakai | Test RTL yang sudah ada (`Form.rtl.test.jsx`) dijalankan sebelum dan sesudah |
| Template jenis belum dibuat saat fitur dipakai | Fallback ke `is_default` (2.5), pencetakan tetap berhasil |
