# Design Document: fix-print-template-render-styling

## Overview

Gunakan wrapper class unik untuk setiap bagian template. HTML root `<body>` menjadi `<section class="pt-scope pt-scope--letterhead">` atau `<section class="pt-scope pt-scope--template">`. CSS `body` menjadi selector scope yang sesuai. Semua renderer menyusun urutan letter head lalu template, mengompilasi Handlebars dengan context sama, lalu memasang CSS dan layout print sama.

Tidak ada dependency baru. Bootstrap CDN hanya bertahan pada preview browser untuk kompatibilitas editor saat ini. Server tidak menambah link CDN karena engine PDF tidak dapat memuatnya.

## Components

### Source transformation

- JS module bersama dekat `PrintPreview` menyediakan transform HTML dan CSS serta layout stylesheet.
- PHP service kecil di `app/Services/Core/PrintTemplate/` menyediakan kontrak equivalent untuk server-side.
- HTML memakai regex tag-boundary `/<\\/?body\\b[^>]*>/i`; tidak pernah memakai `str_replace('body', ...)`.
- CSS parser minimal mengubah token `body` pada posisi selector. Bila selector berisi `body .items-table`, hasilnya `.pt-scope--template .items-table`.

### Layout stylesheet

Satu pembangun layout JS dipakai PrintPreview dan PreviewModal untuk:

- `PRINT_WRAPPER_OVERRIDES`
- `font-family`
- margin body
- `@page` size dan margin
- margin box nomor halaman

`PrintTemplateRenderService` membangun markup CSS counterpart dari nilai template yang sama.

### Preview modal

Modal menerima `columns` dari endpoint, bukan `dataTableColumns`. Formatter dan resolver currency dipindah dari `PrintPreview.jsx` ke module bersama. Context Handlebars mengikuti PrintPreview secara penuh. Karena example data tidak memiliki model Eloquent hidup, `document` memakai data dokumen example dan signature bernilai null bila endpoint tidak menyediakan nilai.

### Server render

`render()` mengompilasi HTML scoped dan mengembalikan `<style>...</style>` diikuti fragmen HTML. Context mempertahankan document Eloquent supaya helper signature server tetap berfungsi. CSS tidak bergantung Bootstrap.

### Relation tracking and data migration

Resolver relasi yang sudah ada mengubah segment menjadi `Str::camel()` lalu memeriksa method publik nol argumen dan memastikan return instance `Relation`. Tambahkan test coverage explicit untuk nama serialized. Migration memakai Query Builder, `chunkById`, JSON mentah, rerunnable, dan hanya mengubah template dengan model `App\\Models\\Finances\\SalesInvoice`.

Seeder Standar Sales Invoice mendeklarasikan `branch`, `currency`, `customer`, `customerBranch`, `salesOrder`, `items`, `items.item`, `items.unit`. Migration menormalisasi path tersimpan tanpa menghapus relasi custom.

## Data Flow

1. Renderer memilih scope letter head atau template.
2. HTML root dan selector CSS ditransformasikan aman.
3. Data dokumen diformat memakai kolom model map.
4. Handlebars menerima context seragam.
5. Browser iframe atau PDF menerima HTML dan CSS scoped.

## Testing Strategy

- PHP unit/feature: root replacement, tbody/text preservation, server CSS/layout, SalesInvoice currency, relasi snake_case, migration idempoten.
- Vitest unit: source transform dan formatter.
- Vitest RTL: PreviewModal menerima response preview, memformat `doc.amount`, dan merender context `columns`/signature.
- Existing PrintPreview RTL diperbarui untuk scope class.

## Risks

- Parser CSS penuh tidak tersedia tanpa dependency. Implementasi minimal hanya mendukung bentuk CSS GrapeJS yang sudah tersimpan. Selector tidak terduga ditahan apa adanya dan diuji dengan fixture aktual.
- Bootstrap class dapat muncul pada custom template. Tidak dimuat server-side sampai ada bukti class Bootstrap diperlukan. Upgrade path: setujui asset CSS lokal ter-version jika audit spesifik memerlukannya.
