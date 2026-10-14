# Implementation Plan: fix-print-template-render-styling

## Tasks

- [x] 1. Shared JS print render utilities
  - [x] 1.1 Extract formatter and currency resolver from `PrintPreview.jsx`.
  - [x] 1.2 Add safe HTML root and CSS selector scoping helpers.
  - [x] 1.3 Add shared print layout stylesheet builder.
  - [x] 1.4 Add unit tests for transform and formatting.

- [x] 2. Browser render integration
  - [x] 2.1 Update `PrintPreview.jsx` to use shared utilities and isolated scopes.
  - [x] 2.2 Update `PreviewModal.jsx` to use full context, formatted example data, isolated scopes, and shared layout CSS.
  - [x] 2.3 Update preview endpoint contract only where required for columns/context.
  - [x] 2.4 Add/update RTL tests for PrintPreview and PreviewModal.

- [x] 3. Server-side render integration
  - [x] 3.1 Add safe scoped HTML/CSS transformation in PrintTemplate services.
  - [x] 3.2 Include scoped CSS, wrapper overrides, font, margins, `@page`, and page numbers in `render()`.
  - [x] 3.3 Add PHPUnit coverage for valid tbody, preserved text, and stylesheet output.

- [x] 4. Currency and relations
  - [x] 4.1 Mark four SalesInvoice amounts as `currency`.
  - [x] 4.2 Add SalesInvoice currency config/render tests.
  - [x] 4.3 Add explicit snake_case relation resolution tests.
  - [x] 4.4 Add data migration normalizing stored Sales Invoice `used_relations` and update standard seeder relation list.
  - [x] 4.5 Add idempotent migration/seeder tests.

- [x] 5. Validation checkpoint
  - [x] 5.1 Run focused PHPUnit tests.
  - [x] 5.2 Run focused Vitest tests.
  - [x] 5.3 Run `vendor/bin/pint --dirty --format agent`.
  - [x] 5.4 Run `npm run lint`.
  - [x] 5.5 PDF dan `AttachGeneratedPdfJob` diuji otomatis. Verifikasi visual browser tertunda karena CLI `browser-use` tidak terpasang.
