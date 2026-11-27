# Implementation Plan: Finance Multi Tax per Item

## Overview

Urutan: (1) mode multi value `LinkModel`, (2) skema + model + migrasi data, (3) aturan kombinasi, (4) perhitungan + alokasi diskon, (5) jurnal, (6) snapshot/Faktur Pajak/cetak, (7) request + service, (8) form, (9) skenario S2 dan checkpoint. Lint/Pint sekali di akhir (CLAUDE.md).

**Prasyarat**: Fase 3 Tax Engine selesai dan ter-merge ke `feat/finance-engine` (PR #334, #335, #336). Pertanyaan Q-MT-1 s.d. Q-MT-10 (requirements.md) dijawab pemilik produk sebelum Task 1 dimulai; terutama Q-MT-1 (nasib `LinkModel` multi value) dan Q-MT-2 (lingkup). Branch baru dari `origin/feat/finance-engine` terbaru, PR base `feat/finance-engine`, label `skip-deploy` bila belum siap deploy.

**Aturan eksekusi**:
- Item satu pajak harus identik byte-demi-byte dengan perilaku sebelum spek ini; jalankan test pajak existing di setiap task.
- Hanya `InvoiceItemTaxCalculator` boleh menulis pivot dan agregat item.
- Jangan mengubah SO/PO/Quotation/DN (Q-MT-2).
- Task bertanda `*` opsional; konfirmasi sebelum dilewati.

## Tasks

- [ ] 1. LinkModel mode multi value (Requirement 9)
  - [ ] 1.1 Telaah ulang `LinkModel.jsx`, `AdvanceSearchDialog.jsx`, `useAdvanceSearchModel.js`, `trimToLinkModelPayload.js`; putuskan bentuk prop `multiple` (Q-MT-1)
    - _Requirements: 9.1_
  - [ ] 1.2 Implementasi `multiple` pada `LinkModel` (value array objek, toggle, chip, urutan terjaga, popover tetap terbuka); tolak kombinasi dengan `subModels`
    - _Requirements: 9.1, 9.2, 9.4_
  - [ ] 1.3 Seleksi banyak baris di `AdvanceSearchDialog`/`useAdvanceSearchModel`; `trimToLinkModelPayload` per elemen
    - _Requirements: 9.3_
  - [ ] 1.4 `TaxLinkModel` meneruskan `multiple` dan `filters`
    - _Requirements: 9.5_
  - [ ] 1.5 Tes RTL `LinkModel.multiple.rtl.test.jsx` + regresi mode tunggal dan multi-model
    - _Requirements: 9.6_

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

- [ ] 9. Skenario S2 dan checkpoint
  - [ ] 9.1 Test end-to-end S2 (PPN 12% + PPh 23 2% satu baris jasa): header NET, jurnal, Faktur Pajak, snapshot, cetak; ulangi untuk PI
    - _Requirements: 12.5_
  - [ ] 9.2 Checkpoint: full test suite PHP dan Vitest, konfirmasi ke user; Pint/ESLint sekali; catat keputusan Q-MT di `docs/prd/finance-decision-log.md` dan runbook deploy
    - _Requirements: 12.1_
