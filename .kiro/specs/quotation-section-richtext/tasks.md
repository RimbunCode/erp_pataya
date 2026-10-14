# Tasks: Quotation Section Rich Text + Save as Template

> Status: `[ ]` todo · `[~]` queued · `[-]` in progress · `[x]` done
> Optional task ditandai `- [ ]* <id>`. **Pint/ESLint hanya dijalankan setelah SEMUA task selesai.**

Rujukan: [`requirements.md`](./requirements.md) · [`design.md`](./design.md)

---

## T01: Migration, Model, & Backend Dual Storage + Endpoint Save Template

- [x] 1. Buat migration `add_content_json_to_quotation_sections_and_templates_table` untuk menambahkan kolom `content_json` (`json`, `nullable`) pada tabel `quotation_sections` dan `quotation_section_templates` (AC2.1, AC2.2)
- [x] 2. Tambahkan cast `'content_json' => 'array'` pada `app/Models/CRM/QuotationSection.php` dan `app/Models/CRM/QuotationSectionTemplate.php` (AC2.3)
- [x] 3. Perbarui `app/Http/Requests/CRM/QuotationRequest.php` untuk menerima `'sections.*.content_json' => ['nullable', 'array']` dan menormalisasi `sections.*.content` yang hanya berisi tag HTML kosong (`<p></p>`) menjadi string kosong di `prepareForValidation()` agar validasi `required` tetap menolak editor kosong (AC2.5)
- [x] 4. Perbarui `app/Services/CRM/QuotationService.php` (`syncSections()`) untuk menyimpan `content_json` bersama `title`, `content`, dan `order` (AC2.6)
- [x] 5. Buat FormRequest `app/Http/Requests/CRM/QuotationSectionTemplateRequest.php` dan tambahkan endpoint `storeSectionTemplate` pada `app/Http/Controllers/CRM/QuotationController.php` beserta `enforcePermission('storeSectionTemplate')`, pembaruan query `sectionTemplates()` agar memuat `content_json`, dan registrasi route `POST /quotation-section-templates` (`quotation-section-templates.store`) di `routes/web.php` (AC2.4, AC3.5, AC3.7)
- [x] 6. Tambahkan kunci terjemahan baru untuk pilih template per blok, prompt simpan template setelah edit, dan dialog simpan template di `lang/id/crm/quotation.php` dan `lang/en/crm/quotation.php` (AC3.1, AC3.3, AC4.2)

## T02: Print Template & Backend Tests

- [x] 7. Perbarui `database/seeders/QuotationPrintTemplateSeeder.php` agar `sections()` merender `{{{this.content}}}` (unescaped HTML) dan tambahkan aturan CSS `.letter-section-content p, ol, ul` agar daftar bernomor/bullet tampil rapi sekaligus tetap kompatibel dengan plain text `pre-line` (AC5.1, AC5.2)
- [x] 8. Tambahkan feature test di `tests/Feature/CRM/QuotationSectionTest.php` dan `tests/Feature/CRM/QuotationPrintTemplateTest.php` untuk penyimpanan `content_json`, penolakan HTML kosong `<p></p>`, endpoint `quotation-section-templates.store`, dan rendering HTML rich text pada cetakan (AC2.1–AC2.6, AC3.5, AC5.1)

## T03: Peningkatan `TiptapEditor` & Integrasi `QuotationSections` (FE)

- [x] 9. Perbarui `resources/js/Components/TiptapEditor.jsx`:
  - Dukung props `readOnly`, `disabled`, dan `onBlur` (sembunyikan `MenuBar` dan `BubbleMenu` saat read-only, teruskan `editable: !isReadOnly` ke editor) (AC1.3, AC3.1)
  - Buat fungsi `normalizeTiptapContent(value)` agar string plain text multiline (`\n`) dikonversi menjadi paragraf HTML `<p>...</p>` tanpa melebur baris baru (AC1.5)
  - Kirim `""` sebagai `html` pada `onValueChange` saat `editor.isEmpty` bernilai `true` (AC1.4, AC2.5)
  - Tambahkan unit test untuk `normalizeTiptapContent` di `resources/js/Components/TiptapEditor.test.js`
- [x] 10. Perbarui `resources/js/Pages/CRM/Quotations/QuotationSections.jsx`:
  - Perbarui `copyTemplatesToSections()` agar menyalin `content_json` (AC4.1, AC4.3)
  - Ganti `<Textarea>` dengan `<TiptapEditor>` yang menyimpan `content_json` dan `content` (AC1.1, AC1.2, AC1.4)
  - Tambahkan pemilih template per blok untuk memuat/mengganti isi blok dari daftar template yang tersedia (AC4.2)
  - Lacak perubahan inline per blok dan tampilkan pilihan kontekstual selesai edit (*"Simpan perubahan ini sebagai template baru?"* — **Simpan sebagai Template Baru** / **Tidak**) serta tombol simpan template beserta dialog konfirmasinya (`POST /quotation-section-templates`) (AC3.1–AC3.6)
- [x] 11. Perbarui dan tambahkan test interaksi UI di `resources/js/Pages/CRM/Quotations/QuotationSections.rtl.test.jsx` untuk pengeditan inline dengan TipTap, memilih template per blok, munculnya prompt setelah selesai edit (`blur`), mengabaikan prompt, dan menyimpan sebagai template baru (AC1.1–AC1.5, AC3.1–AC3.6, AC4.1–AC4.3)

## T04: Checkpoint & Code Quality

- [x] 12. Jalankan seluruh test terkait (`QuotationSectionTest`, `QuotationPrintTemplateTest`, `TiptapEditor.test.js`, `QuotationSections.rtl.test.jsx`), lalu jalankan `vendor/bin/pint --dirty --format agent` dan `npm run lint`
