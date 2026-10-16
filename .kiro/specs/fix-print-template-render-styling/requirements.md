# Requirements Document: fix-print-template-render-styling

## Introduction

Satu template cetak tampil berbeda pada halaman dokumen, editor GrapeJS, modal pratinjau editor, dan PDF server-side. Akar masalah terverifikasi: root `<body>` tersimpan di HTML template, selector CSS diprefix `body`, transformasi tag tidak aman, CSS tidak ikut render server-side, dan modal memakai context Handlebars berbeda.

## Decisions

- Root HTML diubah hanya pada tag `<body ...>` pembuka/penutup, bukan substring `body`.
- Letter head memakai `.pt-scope--letterhead`; dokumen memakai `.pt-scope--template`.
- CSS selector `body` ditransformasikan ke scope masing-masing. Teks, string CSS, nama class, nilai properti, dan `<tbody>` tidak berubah.
- PDF server-side tidak memuat Bootstrap CDN. Audit template belum membuktikan kebutuhan Bootstrap; wkhtmltopdf dan Dompdf juga tidak dapat memakai CDN saat ini.
- Hanya `SalesInvoice` diubah menjadi `currency`. Kandidat lain dicatat di luar scope.

## Requirements

### Requirement 1: Scoped source aman dan terisolasi

**User Story:** Sebagai pengguna, saya ingin semua jalur render memakai struktur dan selector yang sama agar hasil cetak konsisten.

#### Acceptance Criteria

1. HTML template SHALL mengubah hanya root `<body ...>` dan `</body>` menjadi elemen scope dengan class yang ditentukan.
2. Transformasi SHALL mempertahankan `<tbody>`, teks `body`, dan nilai atribut tanpa perubahan.
3. CSS SHALL mengganti token selector `body` saja, bukan kata dalam string, class, atau nilai properti.
4. CSS letter head SHALL hanya berlaku di `.pt-scope--letterhead`.
5. CSS dokumen SHALL hanya berlaku di `.pt-scope--template`.
6. Halaman dokumen, modal editor, dan server-side SHALL memakai kontrak transformasi yang sama.

### Requirement 2: Render server-side lengkap

**User Story:** Sebagai pengguna, saya ingin PDF attachment dan email memakai styling template yang sama dengan pratinjau.

#### Acceptance Criteria

1. `PrintTemplateRenderService::render()` SHALL menghasilkan HTML scoped beserta `<style>`.
2. `<style>` SHALL memuat CSS template, CSS letter head, `PRINT_WRAPPER_OVERRIDES`, font, margin, ukuran halaman, dan aturan nomor halaman.
3. HTML tabel SHALL tetap mengandung `<tbody>` yang valid.
4. Render server-side SHALL tidak bergantung pada Bootstrap CDN.

### Requirement 3: Modal pratinjau editor setara halaman dokumen

**User Story:** Sebagai editor template, saya ingin modal memakai data dan format yang sama dengan halaman dokumen.

#### Acceptance Criteria

1. Modal SHALL memakai `formatData()` bersama sebelum Handlebars compile.
2. Context modal SHALL berisi `lang`, `modelDoc`, `columns`, `company`, `docInfo`, `document`, `doc`, `approvalSignature`, dan `creatorSignature`.
3. Endpoint preview SHALL mengembalikan kolom dalam map model ke field, kompatibel dengan formatter.
4. Modal SHALL menggunakan scoped HTML/CSS dan layout print yang sama dengan halaman dokumen.

### Requirement 4: Currency Sales Invoice

**User Story:** Sebagai pengguna, saya ingin nominal total Sales Invoice memakai simbol currency yang benar.

#### Acceptance Criteria

1. Kolom `amount`, `paid_amount`, `outstanding_amount`, dan `discount_amount` pada SalesInvoice SHALL bertipe `currency`.
2. Format print SHALL menghasilkan prefix currency ketika currency tersedia.
3. Dampak DataTable, filter, grouping, dan export SHALL dipertahankan karena tipe `number` dan `currency` sama-sama diperlakukan numerik oleh jalur tersebut.

### Requirement 5: Relasi serialized snake_case

**User Story:** Sebagai pengguna template, saya ingin token relasi snake_case tetap eager-loaded dengan method Eloquent camelCase.

#### Acceptance Criteria

1. Validasi relasi SHALL mencoba method camelCase tiap segmen dan tetap membuktikan hasilnya instance `Relation`.
2. Properti biasa seperti `external_note` SHALL tidak diperlakukan sebagai relasi tanpa validasi method relation.
3. `customer_branch` SHALL teresolusi menjadi `customerBranch`; `sales_order` menjadi `salesOrder`.
4. Migration data SHALL menormalisasi setiap segmen `used_relations` Sales Invoice tersimpan ke camelCase, mempertahankan relasi custom, dan memastikan `currency` ada.
5. Seeder template Standar Sales Invoice SHALL mendeklarasikan `currency`.

### Requirement 6: Verifikasi

#### Acceptance Criteria

1. PHPUnit SHALL menguji scoping root body, tbody, teks body, CSS scope, render style, currency, dan relasi snake_case.
2. Vitest RTL SHALL menguji context dan formatting modal.
3. Jalur test relevan SHALL lulus sebelum task ditandai selesai.
4. Pint dan ESLint SHALL dijalankan setelah seluruh task implementasi selesai.

## Out of Scope

- Mengubah tipe currency pada `PurchaseInvoice`, `SalesOrder`, `PurchaseOrder`, atau `PaymentEntry`.
- Menambah dependency atau salinan Bootstrap lokal.
- Memperbaiki template custom di luar normalisasi relation path Sales Invoice.
