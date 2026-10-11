<?php

namespace Database\Seeders;

use App\Models\Core\PrintTemplate;
use App\Models\CRM\Quotation;
use App\Models\User\Permission;
use Illuminate\Database\Seeder;

/**
 * Tiga template cetak Quotation, satu per jenis surat (spec quotation-letter-fields,
 * R8). Idempoten: dicocokkan berdasar `name`, aman dijalankan ulang.
 *
 * Template "Default - Quotation" lama diubah namanya menjadi varian spare part,
 * bukan diduplikasi, supaya relasi dan pilihan default yang sudah ada tetap utuh.
 *
 * Kop surat TIDAK ditulis ulang di sini: ketiganya memakai kop yang sama dengan
 * template Quotation sebelumnya lewat `letter_head_id` (AC8.11).
 */
class QuotationPrintTemplateSeeder extends Seeder {
    /** Nama template sebelum spec ini; diubah menjadi varian spare part. */
    public const LEGACY_NAME = 'Default - Quotation';

    /**
     * Relasi yang dimuat saat mencetak. Harus mencakup semua yang dipakai
     * markup di bawah, kalau tidak datanya kosong di hasil cetak.
     *
     * @var array<int, string>
     */
    private const USED_RELATIONS = [
        'customer',
        'items',
        'items.item',
        'items.itemUnit',
        'items.tax',
        'sections',
    ];

    /**
     * Run the database seeds.
     */
    public function run(): void {
        $existing = PrintTemplate::where('model', Quotation::class)
            ->whereIn('name', [self::LEGACY_NAME, Quotation::PRINT_TEMPLATE_BY_TYPE['spare_part']])
            ->orderByRaw('name = ? desc', [Quotation::PRINT_TEMPLATE_BY_TYPE['spare_part']])
            ->first();

        $letterHeadId = $existing?->letter_head_id ?? PrintTemplate::where('is_letter_head', true)
            ->where('is_default', true)
            ->value('id');
        $permission = Permission::where('model', Quotation::class)->first();

        $variants = [
            [
                'name'             => Quotation::PRINT_TEMPLATE_BY_TYPE['spare_part'],
                'default_language' => 'id',
                'html'             => $this->sparePartHtml(),
            ],
            [
                'name'             => Quotation::PRINT_TEMPLATE_BY_TYPE['new_unit'],
                'default_language' => 'en',
                'html'             => $this->newUnitHtml(),
            ],
            [
                'name'             => Quotation::PRINT_TEMPLATE_BY_TYPE['rental'],
                'default_language' => 'en',
                'html'             => $this->rentalHtml(),
            ],
        ];

        foreach ($variants as $variant) {
            $template = PrintTemplate::where('name', $variant['name'])->first();
            if (! $template && $variant['name'] === Quotation::PRINT_TEMPLATE_BY_TYPE['spare_part']) {
                $template = PrintTemplate::where('model', Quotation::class)
                    ->where('name', self::LEGACY_NAME)
                    ->first();
            }
            $template ??= new PrintTemplate;

            $template->fill([
                'name'             => $variant['name'],
                'model'            => Quotation::class,
                'name_model'       => $permission?->name ?? 'Quotations',
                'permission_id'    => $permission?->id ?? $existing?->permission_id,
                'is_letter_head'   => false,
                'letter_head_id'   => $letterHeadId,
                'default_language' => $variant['default_language'],
                'html'             => $variant['html'],
                'css'              => $this->css(),
                // Proyek GrapesJS lama tidak lagi sesuai dengan html baru; editor
                // membangunnya ulang dari html.
                'template'             => null,
                'used_relations'       => self::USED_RELATIONS,
                'paper'                => $template->paper ?? 'A4',
                'orientation'          => $template->orientation ?? 'portrait',
                'width'                => $template->width ?? 21,
                'height'               => $template->height ?? 29.7,
                'margin_top'           => $template->margin_top ?? 1.5,
                'margin_bottom'        => $template->margin_bottom ?? 1.5,
                'margin_left'          => $template->margin_left ?? 1.5,
                'margin_right'         => $template->margin_right ?? 1.5,
                'unit'                 => $template->unit ?? 'cm',
                'show_absolute_values' => false,
            ]);
            $template->save();
        }
    }

    private function css(): string {
        return <<<'CSS'
/*
 * CSS template cetak Quotation. Selector memakai tag pembungkus dokumen dengan
 * sengaja: saat dirender, kata itu diganti literal menjadi "main" (dokumen) atau
 * "div" (kop surat), jadi kata tersebut tidak boleh dipakai di tempat lain.
 */
body {
  font-family: Arial, Helvetica, sans-serif;
  font-size: 12px;
  color: #1a1a1a;
  line-height: 1.4;
}

body .letterhead {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  border-bottom: 2px solid #1a1a1a;
  padding-bottom: 8px;
  margin-bottom: 16px;
}

body .letterhead-company-name {
  font-size: 20px;
  font-weight: bold;
  text-transform: uppercase;
  margin: 0 0 4px 0;
}

body .letterhead-address {
  font-size: 11px;
  color: #333333;
  margin: 0;
}

body .letterhead-contact {
  font-size: 11px;
  color: #333333;
  text-align: right;
  margin: 0;
}

body .letter-date {
  text-align: right;
  margin-bottom: 12px;
}

body .letter-meta {
  margin-bottom: 12px;
}

body .kv {
  display: grid;
  grid-template-columns: 130px 14px 1fr;
  padding: 2px 0;
}

body .kv-value {
  min-width: 0;
}

/* Isi teks bebas: pemisah baris dan penomoran manual harus tetap terbaca. */
body .pre-line {
  white-space: pre-line;
}

body .letter-intro {
  margin: 12px 0;
  white-space: pre-line;
}

body .letter-subject {
  font-weight: bold;
  text-align: center;
  margin: 12px 0 8px 0;
}

body .items-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 12px;
}

body .items-table th {
  background-color: #f0f0f0;
  border: 1px solid #999999;
  padding: 6px;
  font-size: 11px;
  text-align: left;
}

body .items-table td {
  border: 1px solid #cccccc;
  padding: 6px;
  font-size: 12px;
  vertical-align: top;
}

body .items-table .col-no {
  width: 30px;
  text-align: center;
}

body .items-table .col-qty,
body .items-table .col-number {
  text-align: right;
}

body .totals {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 16px;
}

body .totals-table {
  border-collapse: collapse;
  min-width: 260px;
}

body .totals-table td {
  padding: 4px 6px;
  font-size: 12px;
}

body .totals-table .totals-label {
  text-align: left;
  color: #444444;
}

body .totals-table .totals-value {
  text-align: right;
  font-weight: bold;
}

body .totals-table .grand-total td {
  border-top: 2px solid #1a1a1a;
  font-size: 14px;
  padding-top: 6px;
}

body .item-block {
  margin-bottom: 12px;
}

body .item-heading {
  font-weight: bold;
  margin: 12px 0 4px 0;
}

body .letter-section {
  margin-top: 12px;
  page-break-inside: avoid;
}

body .letter-section-title {
  font-weight: bold;
  margin-bottom: 2px;
}

body .letter-section-content {
  white-space: pre-line;
}

body .closing {
  margin-top: 24px;
  page-break-inside: avoid;
}

body .closing p {
  margin: 0 0 4px 0;
}

body .closing-company {
  font-weight: bold;
}

body .signature-slot {
  min-height: 70px;
  margin: 6px 0;
}
CSS;
    }

    /**
     * Bagian kepala yang sama untuk ketiga jenis: nomor, tujuan, dan Attn/Up.
     * Label ditulis sesuai bahasa surat (id untuk spare part, en untuk lainnya).
     *
     * @param  array{to: string, attn: string, no: string, subject: string, validBy: string}  $labels
     */
    private function header(array $labels): string {
        return <<<HTML
  <div class="letter-date">{{#if doc.issued_city}}{{doc.issued_city}}, {{/if}}{{doc.issued_date}}</div>

  <div class="letter-meta">
    <div class="kv"><span>{$labels['to']}</span><span>:</span><span class="kv-value"><b>{{doc.customer.name}}</b><br>{{doc.customer.street}}<br>{{doc.customer.city}} {{doc.customer.province}} {{doc.customer.zip_code}}</span></div>
    <div class="kv"><span>{$labels['attn']}</span><span>:</span><span class="kv-value">{{doc.attn}}</span></div>
    {{#if doc.subject}}<div class="kv"><span>{$labels['subject']}</span><span>:</span><span class="kv-value">{{doc.subject}}</span></div>{{/if}}
    {{#if doc.valid_until}}<div class="kv"><span>{$labels['validBy']}</span><span>:</span><span class="kv-value">{{doc.valid_until}}</span></div>{{/if}}
    <div class="kv"><span>{$labels['no']}</span><span>:</span><span class="kv-value">{{doc.code}}</span></div>
  </div>
HTML;
    }

    /**
     * Blok teks bebas, berurutan sesuai `order`, judul sebagai heading (AC8.7).
     * Paragraf penutup memakai blok yang sama: bila tidak ada, tidak tercetak.
     */
    private function sections(): string {
        return <<<'HTML'
  {{#each doc.sections}}
  <div class="letter-section">
    <div class="letter-section-title">{{this.title}}</div>
    <div class="letter-section-content">{{this.content}}</div>
  </div>
  {{/each}}
HTML;
    }

    private function closing(string $greeting): string {
        return <<<HTML
  <div class="closing">
    <p>{$greeting}</p>
    <p class="closing-company">{{companyDetail "company_name"}}</p>
    <div class="signature-slot">{{{approvalSignature showName=true}}}</div>
  </div>
HTML;
    }

    private function sparePartHtml(): string {
        $header = $this->header([
            'to'      => 'To',
            'attn'    => 'Attn',
            'no'      => 'No',
            'subject' => 'Perihal',
            'validBy' => 'Berlaku hingga',
        ]);
        $sections = $this->sections();
        $closing  = $this->closing('Hormat kami,');

        return <<<HTML
<body>
{$header}

  <p>Yth {{doc.attn}},</p>
  <div class="letter-intro">{{doc.introduction}}</div>

  <table class="items-table">
    <thead>
      <tr>
        <th class="col-no">No</th>
        <th>Part No</th>
        <th>Description</th>
        <th class="col-qty">Quantity</th>
        <th>Unit</th>
        <th class="col-number">Unit Price Rp</th>
        <th class="col-number">Amount Rp</th>
        <th>Remark</th>
      </tr>
    </thead>
    <tbody>
      {{#each doc.items}}
      <tr>
        <td class="col-no">{{this.idx}}</td>
        <td>{{this.item.item_code}}</td>
        <td>{{this.item.item_name}}<div class="pre-line">{{this.description}}</div></td>
        <td class="col-qty">{{this.quantity}}</td>
        <td>{{this.item_unit.code}}</td>
        <td class="col-number">{{this.price}}</td>
        <td class="col-number">{{this.basic_amount}}</td>
        <td>{{this.remark}}</td>
      </tr>
      {{/each}}
    </tbody>
  </table>

  <div class="totals">
    <table class="totals-table">
      <tr>
        <td class="totals-label">Sub Total</td>
        <td class="totals-value">{{doc.basic_amount}}</td>
      </tr>
      <tr>
        <td class="totals-label">{{#each doc.items}}{{#if @first}}{{#if this.tax.name}}{{this.tax.name}}{{else}}PPN{{/if}}{{/if}}{{/each}}</td>
        <td class="totals-value">{{doc.tax_amount}}</td>
      </tr>
      <tr class="grand-total">
        <td class="totals-label">Total</td>
        <td class="totals-value">{{doc.amount}}</td>
      </tr>
    </table>
  </div>

{$sections}

{$closing}
</body>
HTML;
    }

    private function newUnitHtml(): string {
        $header = $this->header([
            'to'      => 'To',
            'attn'    => 'Up',
            'no'      => 'No',
            'subject' => 'Subject',
            'validBy' => 'Valid by',
        ]);
        $sections = $this->sections();
        $closing  = $this->closing('With kind regards,');

        return <<<HTML
<body>
{$header}

  <div class="letter-intro">{{doc.introduction}}</div>

  <div class="letter-subject">{{doc.subject}}</div>
  <table class="items-table">
    <thead>
      <tr>
        <th>Equipment Type</th>
        <th>Model</th>
        <th class="col-qty">QTY</th>
        <th class="col-number">Unit Price (IDR) Before PPN</th>
        <th>Lead Time</th>
      </tr>
    </thead>
    <tbody>
      {{#each doc.items}}
      <tr>
        <td>{{this.item.item_name}}</td>
        <td class="pre-line">{{this.description}}</td>
        <td class="col-qty">{{this.quantity}}</td>
        <td class="col-number">{{this.price}}</td>
        <td>{{this.remark}}</td>
      </tr>
      {{/each}}
    </tbody>
  </table>

{$sections}

{$closing}
</body>
HTML;
    }

    private function rentalHtml(): string {
        $header = $this->header([
            'to'      => 'To',
            'attn'    => 'Up',
            'no'      => 'No',
            'subject' => 'Subject',
            'validBy' => 'Valid by',
        ]);
        $sections = $this->sections();
        $closing  = $this->closing('With kind regards,');

        return <<<HTML
<body>
{$header}

  <div class="letter-intro">{{doc.introduction}}</div>

  <div class="item-heading">Item Description</div>
  {{#each doc.items}}
  <div class="item-block">
    <div class="kv"><span>Name of product</span><span>:</span><span class="kv-value">{{this.item.item_name}}</span></div>
    <div class="kv"><span>Description</span><span>:</span><span class="kv-value pre-line">{{this.description}}</span></div>
    <div class="kv"><span>Quantity</span><span>:</span><span class="kv-value">{{this.quantity}} {{this.item_unit.code}}</span></div>
    <div class="kv"><span>Rent price</span><span>:</span><span class="kv-value">Rp. {{this.price}},- / month / unit</span></div>
  </div>
  {{/each}}

{$sections}

{$closing}
</body>
HTML;
    }
}
