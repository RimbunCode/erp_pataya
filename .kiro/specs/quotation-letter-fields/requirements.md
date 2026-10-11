# Requirements: Quotation Letter Fields

## Latar Belakang

Form Quotation saat ini (`resources/js/Pages/CRM/Quotations/Form.jsx`) hanya
menampung date, valid_until, customer, opportunity, dan daftar item sederhana
(item, quantity, price, description). PT Pataya Sarana Niaga memakai **tiga
jenis surat penawaran** yang berbeda bentuk, dan tidak satu pun tertampung
lengkap oleh struktur sekarang.

Rincian ketiga surat beserta seluruh field-nya didokumentasikan di
[`referensi-surat.md`](./referensi-surat.md). Ringkasnya:

| | Spare part & jasa | Unit baru | Sewa |
|---|---|---|---|
| Bahasa | Indonesia | Inggris | Inggris |
| Bentuk isi | Tabel banyak baris | Tabel 1 baris + blok spesifikasi | Daftar label-nilai, tanpa tabel |
| Ringkasan harga | Sub Total, PPN 11%, Total | Tanpa ringkasan, harga "Before PPN" | Tanpa ringkasan, PPN disebut di Note |
| Blok teks | Tidak ada | Terms & Conditions | Note, Term of Payment, Owner Obligation, Tenant Obligation |
| Halaman | 1 | 1 | 2 |

Selain itu, form Quotation saat ini **tidak dapat dibuka sama sekali**: menekan
"Tambah Quotation" menghasilkan React error #185.

## Tujuan

1. Form Quotation dapat dibuka tanpa error.
2. Quotation menyimpan seluruh informasi yang tercetak di ketiga jenis surat.
3. Hasil cetak PDF menyerupai surat aslinya untuk masing-masing jenis.
4. Perhitungan PPN mengikuti pola modul lain, dengan nilai default yang diatur
   satu kali di level perusahaan.

## Konteks: menggantikan Word

Ketiga surat selama ini **diketik manual di Microsoft Word**. Tidak ada sistem
sebelumnya yang perlu ditandingi fiturnya. Pembandingnya adalah pekerjaan
manual, dan itu menentukan apa yang layak dikerjakan:

**Yang bernilai dipindahkan ke sistem** — hal-hal yang di Word mahal atau rawan
salah:
1. Blok ketentuan yang panjang dan berulang (Owner/Tenant Obligation, Term of
   Payment) tidak perlu diketik ulang tiap penawaran.
2. Harga dan perkalian item tidak salah ketik.
3. Nomor surat dan data pelanggan terisi dari sistem.
4. Hasil cetak seragam, tidak tergantung siapa yang mengetik.

**Yang tidak perlu dikejar** — hal-hal yang di Word pun manual, sehingga
mengotomatiskannya tidak menghilangkan pekerjaan yang sudah ada:
terbilang, rincian biaya mob-demob, dan paragraf penutup. Ketiganya cukup
sebagai teks yang diketik, persis seperti sekarang.

Prinsip ini yang memangkas lingkup: setiap requirement harus mengalahkan Word,
bukan mengalahkan sistem ideal.

## Prinsip Desain

Tiga keputusan berikut menentukan bentuk seluruh requirement di bawah, dan
diambil setelah menelusuri kemampuan yang sudah ada di codebase:

**P1 — Perbedaan tata letak diselesaikan di template cetak, bukan di skema
database.** Tabel `print_templates` sudah mendukung banyak template per model
(`model` + `is_default`, terbukti dipakai PurchaseRequest yang punya dua
template), dengan HTML + CSS bebas dan `default_language` per template. Tiga
bentuk surat yang sangat berbeda cukup ditangani tiga template, bukan tiga
struktur data.

Konsekuensinya, ada **tiga lapis** yang perlu dibedakan dan tidak harus seragam:

| Lapis | Jumlah | Diatur di |
|---|---|---|
| Tabel database | satu untuk ketiga jenis | `quotations`, `quotation_items` |
| Tabel form pengisian | satu komponen, kolom menyesuaikan jenis | R9 |
| Tata letak cetak | tiga template berbeda | R8 |

Jenis `rental` adalah contoh paling jelas mengapa ketiganya dipisah: diisi lewat
tabel (R9), tetapi dicetak sebagai daftar label-nilai tanpa tabel (AC8.6), dan
tersimpan di `quotation_items` yang sama dengan dua jenis lain.

**P2 — Spesifikasi teknis memakai `description` yang sudah ada, tanpa kolom
atau tabel atribut baru.** Blok spesifikasi unit baru (Max Load Capacity,
Engine, Axle, dst.) dan atribut sewa (Capacity 45 ton, Stacking 5 high, Year
Built) adalah data yang **hanya dicetak** — tidak pernah difilter, diurutkan,
dijumlah, atau dicari. Data semacam itu tidak perlu dipecah menjadi kolom.
`items.description` dan `quotation_items.description` keduanya bertipe `text`
(64KB), jauh melebihi kebutuhan (blok terpanjang ~300 karakter).

**P3 — Nilai disalin dari master ke dokumen, bukan direferensikan.** Mengikuti
pola `SalesOrders/Form.jsx:165` yang menyalin `description` dari item ke baris
dokumen. Akibatnya, mengubah data master di kemudian hari tidak mengubah bunyi
penawaran yang sudah dikirim ke pelanggan.

## Non-Goals

- **Tambahan pajak 2% untuk jasa.** Diduga PPh Pasal 23, belum dikonfirmasi ke
  bagian keuangan Pataya. Perlu dipastikan apakah benar PPh 23, siapa yang
  memotong, dan apakah muncul di Quotation atau baru di Invoice. Desain tidak
  boleh menutup jalan untuk ini, tetapi implementasinya di luar lingkup spec.
- **Mengubah perhitungan pajak modul lain.** `active_tax_id` hanya menjadi
  sumber nilai default bagi Quotation pada spec ini.
- **Menambah kolom spesifikasi atau tabel atribut ke master Item.** Lihat P2.
- Mengubah alur approval, penomoran dokumen, atau konversi Quotation ke Sales
  Order.

---

## R1 — Perbaikan React error #185

**Sebagai** user yang membuka form tambah Quotation,
**saya ingin** halaman terbuka normal,
**supaya** saya bisa membuat penawaran.

- **AC1.1** Membuka form tambah Quotation tidak menghasilkan "Maximum update
  depth exceeded" (React error #185).
- **AC1.2** Field `date` tetap terisi otomatis dengan tanggal saat ini ketika
  form dibuka.
- **AC1.3** Pemanggilan `useFormPage` pada Quotation memakai opsi
  `{ trackDefaultValue: false }`, konsisten dengan PurchaseOrder,
  PurchaseReceipt, PurchaseRequest, DeliveryNote, PaymentEntry, dan
  InternalOrder.

**Penyebab.** `useFormPage` melacak perubahan `defaultValue`, dan guard
`lastResolvedSerializedRef` di `FormPage.jsx` membandingkan hasil
`JSON.stringify`. Nilai `new Date()` menghasilkan ISO string berbeda setiap
render (berbeda milidetik), sehingga guard tidak pernah cocok dan
`setResolvedDefaultValue` memicu render berulang tanpa henti.

---

## R2 — Jenis Quotation

**Sebagai** staf penjualan,
**saya ingin** memilih jenis penawaran saat membuat Quotation,
**supaya** form dan hasil cetak menyesuaikan jenisnya.

- **AC2.1** Tersedia kolom `type` pada `quotations` dengan tiga nilai:
  `spare_part`, `new_unit`, `rental`.
- **AC2.2** Jenis dipilih user saat membuat Quotation dan bersifat required.
- **AC2.3** Nilai disimpan sebagai **string biasa**, tanpa Enum PHP dan tanpa
  cast pada model. Daftar pilihan ditulis di komponen frontend dan labelnya di
  berkas bahasa, mengikuti pola `discount_on` pada SalesOrder
  (`AdditionalDiscount.jsx:130-137`, `lang/id/sales/salesOrder.php:69-72`).
- **AC2.4** Field yang hanya relevan untuk jenis tertentu dirender kondisional,
  mengikuti pola `Asset/Assets/Form.jsx:264` (`data?.ownership_type === ...`).
- **AC2.5** Quotation yang sudah tersimpan dapat diubah jenisnya. Data yang
  tidak relevan lagi tidak terhapus dari database.

> **Catatan lingkup.** Perbedaan form antar jenis dibuat seminimal mungkin.
> Semua jenis memakai form yang sama; `type` terutama menentukan **template
> cetak mana yang dipakai** (R8) dan blok mana yang diusulkan (AC5.4).
> Menyembunyikan field per jenis hanya dilakukan bila field itu benar-benar
> tidak berlaku, bukan sekadar jarang dipakai.

---

## R3 — Field header surat

**Sebagai** staf penjualan,
**saya ingin** mengisi tujuan, perihal, dan pengantar surat,
**supaya** surat tercetak lengkap tanpa diedit manual.

- **AC3.1** Tersedia field **Attn/Up** (nama PIC penerima). Dapat memuat lebih
  dari satu nama beserta jabatan, mis. "Bapak Faqih / Ibu Dwi" atau
  "Bp. Antok Jatmiko (General Manager LR 3 Surabaya)". Required untuk ketiga
  jenis.
- **AC3.2** Tersedia field **Subject** (perihal), mis. "Quotation New XCMG
  Diesel Reachstacker". Required untuk `new_unit` dan `rental`; opsional untuk
  `spare_part` (surat contoh tidak memuatnya).
- **AC3.3** Tersedia field **kota terbit**, dicetak sebagai "Surabaya,
  22 September 2026". Default diambil dari preference `city`, dapat diubah per
  dokumen.
- **AC3.4** Tersedia field **kalimat pengantar** (teks multi-baris). Required
  untuk ketiga jenis.
- **AC3.5** Field `valid_until` yang sudah ada dipakai untuk "Valid by".
  Required untuk `new_unit` dan `rental`.
- **AC3.6** Alamat pelanggan pada surat diambil dari data Customer yang sudah
  ada, bukan field baru.
- **AC3.7** Field lama yang tidak muncul di surat (`opportunity`,
  `referenceable`) tetap dipertahankan dan tidak berubah sifatnya.

---

## R4 — Baris item

**Sebagai** staf penjualan,
**saya ingin** mencatat satuan, spesifikasi, dan ketersediaan tiap item,
**supaya** pelanggan menerima informasi lengkap.

- **AC4.1** Tersedia kolom **Remark / Lead Time** per baris item (teks bebas).
  Menampung "1-2 hari" (spare part) maupun "Unit Ready Jakarta" (unit baru).
- **AC4.2** Tersedia pilihan **satuan** per baris item, mengikuti pola
  `item_unit_id` pada `sales_order_items`.
- **AC4.3** **Part No** ditampilkan dari `item_variants.item_code` yang sudah
  ada; tidak dibuat kolom baru.
- **AC4.4** Spesifikasi teknis ditulis pada `description` baris item. Nilai awal
  disalin dari `items.description` saat item dipilih (pola
  `SalesOrders/Form.jsx:165`), lalu dapat diedit per dokumen tanpa mengubah
  master.
- **AC4.5** `description` menerima input multi-baris, dan **pemisahan barisnya
  dipertahankan** saat disimpan, ditampilkan kembali di form, dan dicetak.
  Template cetak merender dengan `white-space: pre-line` atau padanannya,
  sehingga blok spesifikasi tidak melebur menjadi satu paragraf.
- **AC4.6** Kolom item yang sudah ada (item, quantity, price, description) tetap
  dipertahankan.
- **AC4.7** Untuk jenis `rental`, satu baris item merepresentasikan satu unit
  yang disewakan, dan atribut sewa (Year Built, Capacity, Stacking, SLA) ditulis
  sebagai baris-baris di dalam `description`. Tidak ada kolom khusus untuk
  atribut tersebut (lihat P2).

---

## R5 — Blok teks bebas

**Sebagai** staf penjualan,
**saya ingin** menyusun blok-blok ketentuan pada surat,
**supaya** syarat penawaran tercantum tanpa mengetik ulang setiap kali.

- **AC5.1** Tersedia tabel `quotation_sections` dengan sekurang-kurangnya:
  `quotation_id`, judul blok, isi (teks multi-baris), dan urutan tampil.
- **AC5.2** Satu Quotation dapat memiliki nol sampai banyak blok, dengan urutan
  yang dapat diatur user.
- **AC5.3** Mekanisme ini menampung seluruh blok pada ketiga surat: Terms &
  Conditions (unit baru), serta Note, Term of Payment, Owner Obligation, dan
  Tenant Obligation (sewa). Menambah jenis blok baru tidak memerlukan migration.
- **AC5.4** Tersedia master **template blok** yang dapat dipilih saat menyusun
  Quotation. Isi template **disalin** ke Quotation (pola P3), lalu dapat diedit
  bebas tanpa mengubah master. Saat jenis Quotation dipilih, blok yang lazim
  untuk jenis itu **diusulkan otomatis** sehingga staf tidak perlu memilih satu
  per satu.
- **AC5.5** Master template blok mengikuti pola `payment_term_templates` yang
  sudah ada: tabel master dengan `name` dan isi.
- **AC5.7** Blok dari ketiga surat contoh (Terms & Conditions unit baru; Note,
  Term of Payment, Owner Obligation, Tenant Obligation sewa) **disediakan
  sebagai data awal** lewat seeder, dengan isi persis seperti di
  `referensi-surat.md`. Ini yang menghilangkan pekerjaan mengetik ulang dari
  Word, sehingga bernilai sejak hari pertama dipakai.
- **AC5.6** Isi blok menerima input multi-baris dengan penomoran manual (mis.
  "1.", "2."), dan pemisahan barisnya dipertahankan saat dicetak, sebagaimana
  AC4.5.

---

## R6 — Perhitungan PPN

**Sebagai** staf penjualan,
**saya ingin** PPN terhitung otomatis pada penawaran yang memerlukannya,
**supaya** total penawaran benar tanpa hitung manual.

- **AC6.1** Setiap baris item menyimpan `tax_id` dan `tax_rate`, mengikuti pola
  `sales_order_items`.
- **AC6.2** Baris item menyimpan `basic_amount` (quantity x price), `tax_amount`,
  dan `amount` (basic_amount + tax_amount).
- **AC6.3** Untuk jenis `spare_part`, hasil cetak menampilkan **Sub Total**,
  **jumlah pajak**, dan **Total**.
- **AC6.4** Untuk jenis `new_unit` dan `rental`, hasil cetak **tidak**
  menampilkan baris ringkasan tersebut; keterangan pajak disampaikan lewat judul
  kolom harga ("Before PPN") atau blok Note. Nilai `tax_id`/`tax_rate` tetap
  disimpan agar dapat diwariskan bila Quotation dikonversi ke dokumen lain.
- **AC6.5** Saat baris item baru ditambahkan, `tax_id` terisi otomatis dari
  preference `active_tax_id` (lihat R7). User tidak perlu memilih apa pun untuk
  kasus normal.
- **AC6.6** User tetap dapat mengubah pajak per baris bila diperlukan.
- **AC6.7** Label pajak yang tercetak mengikuti nama pajak terpilih (mis.
  "PPN 11%"), bukan teks yang ditulis mati di kode.

---

## R7 — Pajak aktif global

**Sebagai** admin,
**saya ingin** menetapkan satu pajak aktif untuk seluruh aplikasi,
**supaya** staf tidak perlu memilih pajak di setiap transaksi.

- **AC7.1** Tersedia preference baru **`active_tax_id`** yang menunjuk satu
  record pada tabel `taxes`. Record "PPN 11%" sudah ada di database, tidak perlu
  seeder baru.
- **AC7.2** Pilihan pajak aktif diatur pada halaman **Company Details**
  (`Settings/Company`), mengikuti pola `default_currency_id`: di-resolve menjadi
  object pada `CompanyController::index()` dan diekstrak dari payload LinkModel
  pada `CompanyController::update()`.
- **AC7.3** Nilainya dibaca di Service layer dengan pola
  `Preference::find('active_tax_id')?->value`, sebagaimana `default_currency_id`
  dibaca di `SalesOrderService` dan lainnya.
- **AC7.4** Bila `active_tax_id` belum diatur, baris item baru tidak memiliki
  pajak (`tax_rate` 0) dan form tetap berfungsi tanpa error.
- **AC7.5** Perubahan pajak aktif **tidak** mengubah Quotation yang sudah
  tersimpan. Nilai `tax_id` dan `tax_rate` pada baris item tetap seperti saat
  dokumen dibuat.

---

## R8 — Template cetak PDF

**Sebagai** staf penjualan,
**saya ingin** mencetak Quotation sesuai bentuk surat jenisnya,
**supaya** dokumen bisa langsung dikirim ke pelanggan.

- **AC8.1** Tersedia **tiga template cetak** untuk model
  `App\Models\CRM\Quotation`, satu per jenis. Template "Default - Quotation" yang
  sudah ada pada tabel `print_templates` disesuaikan menjadi salah satunya.
- **AC8.2** Template yang dipakai saat mencetak menyesuaikan `type` Quotation.
- **AC8.3** Ketiga template memuat: kota + tanggal, tujuan (nama + alamat
  pelanggan), Attn/Up, nomor dokumen, dan kalimat pengantar. Subject dan Valid by
  ditampilkan bila terisi.
- **AC8.4** Template `spare_part` menampilkan tabel dengan kolom: No, Part No,
  Description, Quantity, Unit, Unit Price, Amount, Remark, diikuti baris Sub
  Total, pajak, dan Total.
- **AC8.5** Template `new_unit` menampilkan tabel dengan kolom: Equipment Type,
  Model, QTY, harga per unit, Lead Time. Judul kolom harga dapat memuat lokasi
  penyerahan (mis. "DDP Marunda Jakarta /Unit(IDR) Before PPN") dan **tidak
  ditulis mati** di template.
- **AC8.6** Template `rental` menampilkan **daftar label-nilai**, bukan tabel,
  sesuai bentuk surat aslinya.
- **AC8.7** Blok-blok dari `quotation_sections` dicetak berurutan sesuai
  urutannya, dengan judul blok tercetak sebagai heading.
- **AC8.8** Ketiga template memuat paragraf penutup, salam ("Hormat kami" /
  "With kind regards"), nama perusahaan, dan blok tanda tangan.
- **AC8.9** Blok tanda tangan memakai helper `{{approvalSignature}}` dari spec
  [`approval-signature`](../approval-signature/requirements.md), termasuk
  perilaku fallback teks nama + tanggal bila penandatangan belum punya TTD.
- **AC8.10** Nama, jabatan, dan nomor HP penandatangan tercetak untuk jenis
  `new_unit` dan `rental`. Untuk `spare_part`, hanya nama (sesuai surat contoh).
- **AC8.11** Kop surat dan footer mengikuti mekanisme kop yang sudah ada
  ("Kop Surat Default" dengan `is_letter_head`), tidak diduplikasi ke dalam
  template Quotation.
- **AC8.12** Bahasa tiap template diatur lewat `default_language` pada
  `print_templates`: Indonesia untuk `spare_part`, Inggris untuk `new_unit` dan
  `rental`. Tidak ada kolom bahasa pada `quotations`.

---

## R9 — Tabel item di form pengisian

**Sebagai** staf penjualan,
**saya ingin** tabel pengisian item hanya menampilkan kolom yang relevan dengan
jenis penawaran,
**supaya** saya tidak bingung dengan kolom yang tidak dipakai.

Requirement ini mengatur **form pengisian**, berbeda dari R8 yang mengatur hasil
cetak. Bentuk keduanya tidak harus sama: jenis `rental` diisi lewat tabel tetapi
dicetak sebagai daftar label-nilai (AC8.6).

- **AC9.1** Ketiga jenis memakai satu komponen `FormTable` yang sama. Tidak
  dibuat komponen atau form terpisah per jenis.
- **AC9.2** Kolom yang tidak berlaku untuk suatu jenis **tidak ditampilkan**.
  Memakai kemampuan `FormTable` yang sudah ada: definisi kolom bernilai falsy
  dibuang oleh `.filter((col) => col)` di `FormTable.jsx:571`, sehingga pola
  `type === "rental" && { name: ... }` berlaku langsung.
- **AC9.3** Judul kolom dapat menyesuaikan jenis, memakai properti `title` atau
  `titleTrans` yang sudah didukung (`FormTable.jsx:1284`). Untuk `rental`, judul
  kolom harga menyatakan satuan waktunya (mis. "Harga / bulan") agar tidak
  tertukar dengan harga satuan.
- **AC9.4** Pembagian kolom per jenis:

  | Kolom | `spare_part` | `new_unit` | `rental` |
  |---|---|---|---|
  | Part No | tampil | sembunyi | sembunyi |
  | Description | tampil | tampil | tampil |
  | Quantity | tampil | tampil | tampil |
  | Unit | tampil | sembunyi | tampil |
  | Harga | "Unit Price" | "Harga / unit" | "Harga / bulan" |
  | Remark | "Remark" | "Lead Time" | sembunyi |
  | Amount | tampil | tampil | sembunyi |

- **AC9.5** Jenis `rental` **tetap memakai tabel** dan dapat memuat lebih dari
  satu unit, meski surat contoh hanya memuat satu. Keputusan ini diambil agar
  penawaran sewa multi-unit tidak memaksa pembuatan surat terpisah.
- **AC9.6** Kunci penyimpanan preferensi kolom di localStorage (`key` pada
  `FormTable`, lihat `FormTable.jsx:583`) **menyertakan jenis Quotation**.
  Tanpa ini, preferensi kolom dari satu jenis akan terbawa ke jenis lain dan
  menyembunyikan kolom yang seharusnya tampil.
- **AC9.7** Seluruh jenis menulis ke tabel `quotation_items` yang sama. Tidak
  ada tabel item terpisah per jenis.

## Urutan Pengerjaan

Disusun agar staf berhenti memakai Word secepat mungkin, bukan menunggu seluruh
requirement rampung.

**Tahap 1 — bisa berhenti dari Word.** R1 (perbaikan error), R2 (jenis), R3
(field header), R4 (baris item), R5 (blok teks + seeder isi ketiga surat), R8
(tiga template cetak), R9 (kolom form per jenis). Setelah tahap ini, ketiga
surat dapat dibuat dan dicetak dari sistem.

**Tahap 2 — merapikan.** R6 (perhitungan PPN) dan R7 (pajak aktif global).
Sampai tahap ini selesai, jumlah pajak pada surat `spare_part` masih dapat
ditulis di blok teks seperti di Word, sehingga tahap 1 tetap dapat dipakai.

Pemisahan ini berlaku untuk urutan task, bukan untuk skema database: kolom
pajak pada R6 tetap dibuat sejak migration tahap 1 agar tidak ada migration
susulan yang mengubah tabel yang sama dua kali.

## Ketergantungan Antar-Branch

**`{{approvalSignature}}` belum tersedia di branch ini.** Helper itu ada di
branch `feat/approval-signature` (tiga berkas: `Controller.php`,
`AttachGeneratedPdfJob.php`, `PrintTemplateRenderService.php`) dan belum
di-merge ke `dev-1`.

Ketiga template cetak Quotation tetap memanggilnya sesuai AC8.9, tetapi selama
helper belum ada, lightncandy memperlakukannya sebagai variabel biasa sehingga
slot tanda tangan tercetak kosong. Blok tanda tangan baru berfungsi setelah
`feat/approval-signature` masuk ke `dev-1`. Tidak ada perubahan yang perlu
dilakukan pada template saat itu terjadi.

## Cacat yang Ditemukan di Luar Lingkup

Dua hal ditemukan saat mengerjakan spec ini. Keduanya sudah ada sebelumnya dan
tidak disebabkan pekerjaan ini.

**C1 — Quotation tidak dapat disimpan lewat HTTP (sudah diperbaiki).**
`QuotationRequest` memakai `FormRequest` biasa, sehingga `branch` aktif tidak
ikut di data tervalidasi. Format kode `@[branch_code]/QTN-@[iiii]/@[yy]` lalu
melempar "Relation 'branch.code' could not be resolved". Diperbaiki dengan
`extends BaseFormRequest`, sama seperti `SalesOrderRequest`. Perbaikan ini di
luar daftar task tetapi tanpanya seluruh fitur tidak dapat dipakai.

**C2 — Render PDF sisi server gagal untuk helper berbentuk arrow function
(BELUM diperbaiki).** `PrintTemplateRenderService::helpers()` mendefinisikan
helper dengan `fn () =>`, dan lightncandy gagal meng-eval kodenya:
`ParseError: syntax error, unexpected token "=>"`.

Terbukti pada PurchaseOrder, modul yang tidak disentuh spec ini, dan berkasnya
tidak berubah sejak commit lint di `dev-1`. Yang terdampak adalah `render()`
sisi server (lampiran PDF otomatis) untuk template yang memakai `companyDetail`,
termasuk kop surat. Pencetakan manual dari browser tidak terpengaruh.

Di luar lingkup spec ini. Perlu spec atau perbaikan tersendiri, dan dampaknya
lintas modul.

## Open Questions

- **OQ1** Tambahan pajak 2% untuk jasa: apakah benar PPh Pasal 23? Dipotong oleh
  pelanggan atau ditambahkan ke tagihan? Muncul sejak Quotation atau baru di
  Invoice? Perlu konfirmasi bagian keuangan sebelum dibuat spec tersendiri.
- **OQ2** ~~Dari mana penandatangan diambil?~~ **Terjawab.** Helper
  `{{approvalSignature}}` dari spec `approval-signature`. Lihat AC8.9.
- **OQ3** ~~Nomor surat sewa berakhiran `-R`, perlukah penomoran per jenis?~~
  **Di luar lingkup.** Tabel `formating_series` memiliki `model` bersifat
  **unique**, artinya satu format per model dan bukan per jenis. Membedakan
  format nomor antar jenis Quotation mensyaratkan perubahan pada mekanisme
  penomoran yang dipakai seluruh modul, sehingga harus menjadi spec tersendiri.
  Untuk sekarang ketiga jenis memakai satu format nomor yang sama. Bila akhiran
  `-R` wajib ada, staf dapat menambahkannya manual seperti di Word.
- **OQ4** ~~Paragraf penutup: di template atau per dokumen?~~ **Terjawab.**
  Paragraf penutup menjadi salah satu blok `quotation_sections`, dengan isi awal
  dari template per jenis. Tidak perlu kolom tersendiri, dan staf tetap bisa
  mengubahnya seperti di Word.
- **OQ5** ~~Biaya mob-demob disimpan sebagai angka?~~ **Terjawab.** Cukup teks
  di dalam blok Note. Di Word pun diketik manual, jadi menyimpannya sebagai
  angka tidak menghilangkan pekerjaan yang ada. Bila kelak dibutuhkan untuk
  konversi ke kontrak sewa, dapat ditambahkan saat modul kontrak dibuat.
- **OQ6** ~~Terbilang otomatis?~~ **Terjawab.** Diketik manual di dalam kolom
  harga atau blok Note, seperti praktik sekarang di Word. Terbilang otomatis
  berbahasa Inggris memerlukan helper tersendiri dan hanya dipakai satu jenis
  surat, sehingga tidak sepadan untuk tahap ini.
