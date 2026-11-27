# Implementation Plan: Finance Multi Tax per Item

## Overview

Urutan: (1) mode multi value `LinkModel` dengan chip + penyelarasan `MultiSelect`, (2) skema + model + migrasi data, (3) aturan kombinasi, (4) perhitungan + alokasi diskon, (5) jurnal, (6) snapshot/Faktur Pajak/cetak, (7) request + service, (8) form invoice, (9) order/quotation, (10) form order/quotation, (11) pajak default item, (12) skenario S2 dan checkpoint. Lint/Pint sekali di akhir (CLAUDE.md).

**Prasyarat**: Fase 3 Tax Engine selesai dan ter-merge ke `feat/finance-engine` (PR #334, #335, #336). Pertanyaan Q-MT-1 sudah diputuskan (2026-11-28: bangun di `LinkModel`, chip, klik label membuka detail, `MultiSelect` mengikuti). Q-MT-2 s.d. Q-MT-5, Q-MT-8 s.d. Q-MT-11 sudah diputuskan (2026-11-28). Yang MASIH terbuka dan memblokir task terkait: Q-MT-6 (pajak atas pajak, Task 4), Q-MT-7 (definisi `dpp_amount`, Task 4.3 dan 6.2), Q-MT-12 (perhitungan order, Task 9), Q-MT-13 (prioritas default, Task 11). Branch baru dari `origin/feat/finance-engine` terbaru, PR base `feat/finance-engine`, label `skip-deploy` bila belum siap deploy.

**Aturan eksekusi**:
- Item satu pajak harus identik byte-demi-byte dengan perilaku sebelum spek ini; jalankan test pajak existing di setiap task.
- Hanya `InvoiceItemTaxCalculator` boleh menulis pivot dan agregat item.
- Delivery Note dan Purchase Receipt tidak berubah. Task 9-11 (order, form order, default item) dikerjakan setelah Task 2-8 stabil dan dapat dirilis terpisah.
- Task bertanda `*` opsional; konfirmasi sebelum dilewati.

## Tasks

- [ ] 1. LinkModel mode multi value dan chip (Requirement 9, 13; Q-MT-1 diputuskan)
  - [ ] 1.1 Telaah ulang `LinkModel.jsx` (navigasi baris ~1074-1106, `navAllowed`, `routeId`, `keyRoute`), `AdvanceSearchDialog.jsx`, `useAdvanceSearchModel.js`, `trimToLinkModelPayload.js`; tetapkan bentuk prop `multiple`
    - _Requirements: 9.1_
  - [ ] 1.2 Ekstrak logika navigasi ke fungsi bersama per-opsi (`resolveNavigation(option)`: izin, `disabledNavigation`, `customNavigation`, rute `.show`); mode tunggal memakainya tanpa perubahan perilaku (test regresi dulu)
    - _Requirements: 9.3, 9.4, 9.8_
  - [ ] 1.3 Komponen bersama `ChipList.jsx` (label + X terpisah, label non-tautan bila tak diizinkan, truncate + tooltip, wrap, `disabled`/`readOnly`, penanda diff) + test RTL
    - _Requirements: 9.3-9.6, 13.3_
  - [ ] 1.4 `LinkModel` `multiple`: value array, toggle, popover tetap terbuka, urutan terjaga, chip dengan navigasi, `valueBefore` per chip; tolak `multiple` + `subModels`
    - _Requirements: 9.1, 9.2, 9.5, 9.8, 9.9_
  - [ ] 1.5 Seleksi banyak baris di `AdvanceSearchDialog`/`useAdvanceSearchModel`; `trimToLinkModelPayload` per elemen; `TaxLinkModel` meneruskan `multiple` dan `filters`
    - _Requirements: 9.7, 9.9_
  - [ ] 1.6 `MultiSelect` memakai `ChipList` (chip per nilai, "Semua" satu chip, navigasi opt-in lewat `navigation`), pertahankan `valueBefore`, `changeOnBlur`, `delimiters`, paste, `showAllOption`, `defaultValue`, clear; audit visual 7 konsumen; perbarui `MultiSelect.rtl.test.jsx`, `ValueField.rtl.test.jsx`, `Inventory/Items/Form.rtl.test.jsx` (menunggu Q-MT-11)
    - _Requirements: 13.1-13.6_
  - [ ] 1.7 Tes RTL `LinkModel.multiple.rtl.test.jsx` (pilih, X, urutan, klik label membuka tab baru/`customNavigation`, non-tautan saat tak diizinkan, `disabled`/`readOnly`, filter, advance search) + regresi mode tunggal dan multi-model
    - _Requirements: 9.10_

- [ ] 2. Skema, model, migrasi data (Requirement 1, 7)
  - [ ] 2.1 Migrasi `sales_invoice_item_taxes` dan `purchase_invoice_item_taxes` (unik item+pajak, FK, `position`, kolom hitung) + `down()`
    - _Requirements: 1.1, 1.2, 1.6_
  - [ ] 2.2 Model `SalesInvoiceItemTax`/`PurchaseInvoiceItemTax`, relasi `taxLines()`/`taxes()` pada item, `configColumns`, test `initPermissions()`
    - _Requirements: 11.1, 11.5, 12.3_
  - [ ] 2.3 Migrasi data backfill (satu baris per item ber-`tax_id`) dengan pra-pemeriksaan paritas, idempoten, `down()`
    - _Requirements: 7.1-7.4_
  - [ ] 2.4 Jaring pengaman baca: item ber-`tax_id` tanpa pivot diperlakukan satu pajak
    - _Requirements: 7.6_
  - [ ] 2.5 Test skema dan migrasi data (backfill, paritas gagal, ulang, down)
    - _Requirements: 7.1-7.5_

- [ ] 3. Aturan kombinasi (Requirement 2)
  - [ ] 3.1 `ItemTaxSelection` (duplikat, >1 `ppn_standard`, batas N) + pesan id/en
    - _Requirements: 2.1-2.5_
  - [ ] 3.2 Unit test kombinasi
    - _Requirements: 2.1-2.6_

- [ ] 4. Perhitungan dan alokasi diskon (Requirement 3, 4)
  - [ ] 4.1 `DocumentDiscountCalculator`: `taxes[]` per baris, Σ penambah, kompatibel bentuk lama; test net_total/grand_total satu vs banyak pajak
    - _Requirements: 4.1-4.4_
  - [ ] 4.2 `DocumentTaxRules`: resolve versi untuk semua pajak (`items.{i}.taxes.{j}`), `lineParameters`, `assertStoredVersionsCurrent` membaca pivot
    - _Requirements: 5.6, 8.5_
  - [ ] 4.3 `InvoiceItemTaxCalculator`: `TaxInput` per pasangan (`lineRef` gabungan), tulis pivot dan agregat item, hapus pivot yang tak dipilih
    - _Requirements: 1.5, 3.1-3.7_
  - [ ] 4.4 `InvoiceBilledValueResolver`: tarif baris = Σ penambah
    - _Requirements: 8.6_
  - [ ] 4.5 Test calculator (satu pajak identik, PPN+PPh, dua penambah, `per_document` lintas pajak, header NET)
    - _Requirements: 3.4, 3.7, 12.1_

- [ ] 5. Jurnal (Requirement 5)
  - [ ] 5.1 `InvoiceTaxComponentsBuilder` membaca pivot (`build`, `withholdingComponents`), `lineShares` per item; eager load
    - _Requirements: 5.1, 12.2_
  - [ ] 5.2 Perluas `TaxJournalSplitTest` dan test posting SI/PI: invarian seimbang, retur, cutover, peran `withholding_*`
    - _Requirements: 5.2-5.5_

- [ ] 6. Snapshot, Faktur Pajak, cetak, laporan (Requirement 6, 11)
  - [ ] 6.1 `DocumentTaxSnapshot` per baris pivot; `TaxBreakdownPanel` memecah `line_ref`; `UnclassifiedTaxUsage` dan `UnclassifiedTaxReportCommand` dari pivot
    - _Requirements: 6.1, 6.2, 6.5_
  - [ ] 6.2 Test Faktur Pajak: PPN+PPh, PPh tidak masuk PPN pada jalur snapshot dan fallback
    - _Requirements: 6.3, 6.4_
  - [ ] 6.3 `InvoicePrintTotals` dari pivot; atribut cetak `tax_names`/`tax_rates`; perbarui template standar `FinancesTemplates`
    - _Requirements: 11.3, 11.4_
  - [ ] 6.4 Audit view laporan (`report_*_view`) dan dokumentasikan keterbatasan (Q-MT-9)
    - _Requirements: 11.2_

- [ ] 7. Request dan service (Requirement 8)
  - [ ] 7.1 `SalesInvoiceRequest`/`PurchaseInvoiceRequest`: `taxes`, normalisasi `tax`, `ValidatesRowTaxRequired`, aturan kombinasi, buang kolom hitung
    - _Requirements: 8.1-8.4_
  - [ ] 7.2 `fillItemRelations()` SI/PI: isi cermin Pajak Utama, kirim `taxes` ke calculator; `update()` sinkron pivot; retur dan off-source item
    - _Requirements: 1.4, 1.5, 5.4_
  - [ ] 7.3 Test request dan service (normalisasi, mass assignment, kombinasi terlarang, pajak tanpa versi, update draft menambah/menghapus pajak)
    - _Requirements: 2.5, 8.1-8.5_

- [ ] 8. Form Sales/Purchase Invoice (Requirement 10)
  - [ ] 8.1 `lib/taxRules.js`: `rulesOf`; `lib/discountAllocation.js` versi array; test
    - _Requirements: 10.2, 10.7_
  - [ ] 8.2 `SalesInvoice/Form.jsx` dan `PurchaseInvoice/Form.jsx`: `TaxLinkModel` multiple, state `taxes`, `mapItem`, header, kolom DPP (Req 12.8), galat per baris, pemetaan dari SO/PO/DN
    - _Requirements: 10.1, 10.3, 10.5, 10.6_
  - [ ] 8.3 Panel ringkasan pajak per pajak; `taxRuleVersions` tetap
    - _Requirements: 10.4_
  - [ ] 8.4 Perbarui `Form.rtl.test.jsx` SI/PI dengan kasus banyak pajak
    - _Requirements: 10.7_

- [ ] 9. Quotation, Sales Order, Purchase Order (Requirement 14; menunggu Q-MT-12)
  - [ ] 9.1 Migrasi pivot `quotation_item_taxes`, `sales_order_item_taxes`, `purchase_order_item_taxes` + backfill berparitas + `down()`; model dan relasi
    - _Requirements: 14.1, 14.10, 7.1-7.4_
  - [ ] 9.2 Perhitungan order/quotation sesuai Q-MT-12 (A: `InvoiceItemTaxCalculator` diparameterisasi untuk kolom harga order; B: hitung sederhana per pajak); `DocumentDiscountCalculator::applyToItems()` mengikuti
    - _Requirements: 14.2, 14.3_
  - [ ] 9.3 `SalesOrderService`, `PurchaseOrderService`, `QuotationService`: normalisasi `taxes`, cermin Pajak Utama, sinkron pivot, `keepTaxRate` per pajak, aturan kombinasi di FormRequest masing-masing
    - _Requirements: 14.1, 14.6, 8.1-8.4_
  - [ ] 9.4 Alur order ke invoice: kunci pengelompokan himpunan `tax_id`, invoice membawa seluruh pajak; Quotation ke SO salin utuh; `InvoiceBilledValueResolver` sesuai keputusan
    - _Requirements: 14.4, 14.5, 14.7_
  - [ ] 9.5 Test order/quotation (satu pajak identik, banyak pajak, order ke invoice, toleransi penagihan, migrasi)
    - _Requirements: 14.1-14.11, 12.1_

- [ ] 10. Form Quotation, Sales Order, Purchase Order (Requirement 14.8-14.9)
  - [ ] 10.1 `SalesOrders/Form.jsx`, `PurchaseOrders/Form.jsx` (+ `purchaseOrderAmounts.js`, `FromRequests/draftData.js`, `reviewData.js`), `CRM/Quotations/QuotationItems.jsx` memakai `TaxLinkModel multiple` dan hitung klien bersama
    - _Requirements: 14.8_
  - [ ] 10.2 Pastikan `AdditionalDiscount.jsx` dan `lib/taxRules.js` tetap utuh untuk satu pajak; perbarui test form order dan quotation
    - _Requirements: 14.9_

- [ ] 11. Pajak default per item master (Requirement 15; menunggu Q-MT-13)
  - [ ] 11.1 Migrasi `item_default_taxes` + model relasi `salesDefaultTaxes()`/`purchaseDefaultTaxes()` pada `Item` + `configColumns` + `initPermissions()`
    - _Requirements: 15.1, 15.9_
  - [ ] 11.2 `ItemRequest`/`ItemService`: terima dan sinkron `default_sales_taxes`/`default_purchase_taxes` (aturan kombinasi, urutan)
    - _Requirements: 15.1, 15.2_
  - [ ] 11.3 `DocumentDefaultsResolver::resolveForItems()` memakai default item sesuai prioritas Q-MT-13, satu query massal, filter pajak terhapus
    - _Requirements: 15.3, 15.4, 15.7, 15.8_
  - [ ] 11.4 Form Item: dua `TaxLinkModel multiple`; `lib/documentDefaults.js` (`applyToNewLine`/`useDocumentDefaults`) mengisi `taxes` array pada seluruh form dokumen
    - _Requirements: 15.1, 15.5, 15.6_
  - [ ] 11.5 Test (simpan default, kombinasi, prioritas, prefill di SO/SI/PO/PI/Quotation, pajak default terhapus)
    - _Requirements: 15.10_

- [ ] 12. Skenario S2 dan checkpoint
  - [ ] 12.1 Test end-to-end S2 (PPN 12% + PPh 23 2% satu baris jasa): header NET, jurnal, Faktur Pajak, snapshot, cetak; ulangi untuk PI; tambahkan rantai Quotation ke SO ke SI dengan pajak default item
    - _Requirements: 12.5, 14.4, 15.5_
  - [ ] 12.2 Checkpoint: full test suite PHP dan Vitest, konfirmasi ke user; Pint/ESLint sekali; catat keputusan Q-MT di `docs/prd/finance-decision-log.md` dan runbook deploy
    - _Requirements: 12.1_
