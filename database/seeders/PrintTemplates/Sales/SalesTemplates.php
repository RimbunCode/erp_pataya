<?php

namespace Database\Seeders\PrintTemplates\Sales;

use App\Models\Sales\InternalOrder;
use App\Models\Sales\SalesOrder;
use Database\Seeders\PrintTemplates\TemplateParts as P;

/**
 * Template cetak standar domain Sales: Sales Order dan Internal Order.
 */
final class SalesTemplates {
    /**
     * @return array<int, array{model: class-string, label: string, relations: array<int, string>, html: string}>
     */
    public static function definitions(): array {
        return [
            self::salesOrder(),
            self::internalOrder(),
        ];
    }

    /**
     * Sales Order: HTML dan CSS ditulis langsung (bukan dirakit dari
     * `TemplateParts`) supaya lebar kolom tabel item tidak terpengaruh aturan
     * CSS bersama. Susunannya: identitas perusahaan di kiri dan judul + meta
     * di kanan, Bill To dan Ship To berdampingan, tabel item 8 kolom dengan
     * baris ringkasan menyatu, catatan, lalu tanda tangan 2 kolom.
     *
     * Mata uang memakai `doc.currency_code` (kode mentah) dan, di dalam
     * `{{#each doc.items}}`, ditulis `@root.doc.currency_code` karena
     * konteksnya sudah berpindah ke item (`doc.currency_code` di sana kosong
     * dan helper `formatCurrency` mengembalikan pesan error).
     */
    private static function salesOrder(): array {
        return [
            'model'     => SalesOrder::class,
            'label'     => 'Sales Order',
            'relations' => [
                'branch',
                'customer',
                'customerBranch',
                'items',
                'items.item',
                'items.unit',
            ],
            'html' => self::salesOrderHtml(),
            'css'  => self::salesOrderCss(),
        ];
    }

    private static function salesOrderHtml(): string {
        return <<<'HTML'
<body>
  <table class="so-head">
    <tr>
      <td class="so-head-left">
        <div class="so-party">
          <div class="so-party-title">Bill To</div>
          <p class="so-party-name">{{doc.customer.name}}</p>
          {{#if doc.customer_branch.billing_street}}
          <p>{{doc.customer_branch.billing_street}}</p>
          <p>{{doc.customer_branch.billing_city}} {{doc.customer_branch.billing_state}} {{doc.customer_branch.billing_zip_code}}</p>
          {{else}}
          {{#if doc.customer_branch.shipping_street}}
          <p>{{doc.customer_branch.shipping_street}}</p>
          <p>{{doc.customer_branch.shipping_city}} {{doc.customer_branch.shipping_state}} {{doc.customer_branch.shipping_zip_code}}</p>
          {{else}}
          <p>{{doc.customer.street}}</p>
          <p>{{doc.customer.city}} {{doc.customer.province}} {{doc.customer.zip_code}}</p>
          {{/if}}
          {{/if}}
          <p>{{doc.customer.phone}}</p>
          <p>{{doc.customer.email}}</p>
          <p>{{doc.customer.vat}}</p>
        </div>
        <div class="so-party">
          <div class="so-party-title">Ship To</div>
          <p class="so-party-name">{{doc.customer.name}}</p>
          {{#if doc.customer_branch.shipping_street}}
          <p>{{doc.customer_branch.shipping_street}}</p>
          <p>{{doc.customer_branch.shipping_city}} {{doc.customer_branch.shipping_state}} {{doc.customer_branch.shipping_zip_code}}</p>
          {{else}}
          <p>{{doc.customer.street}}</p>
          <p>{{doc.customer.city}} {{doc.customer.province}} {{doc.customer.zip_code}}</p>
          {{/if}}
          <p>{{doc.customer.phone}}</p>
        </div>
      </td>
      <td class="so-head-right">
        <div class="doc-title doc-title-right">Sales Order</div>
        <table class="so-meta" align="right">
          <tbody>
            <tr><td class="so-meta-label">Order No</td><td class="so-meta-sep">:</td><td class="so-meta-value">{{doc.code}}</td></tr>
            <tr><td class="so-meta-label">Order Date</td><td class="so-meta-sep">:</td><td class="so-meta-value">{{formatDate doc.date "DD-MM-YYYY"}}</td></tr>
            {{#if doc.branch}}<tr><td class="so-meta-label">Lokasi</td><td class="so-meta-sep">:</td><td class="so-meta-value">{{doc.branch.name}}</td></tr>{{/if}}
          </tbody>
        </table>
      </td>
    </tr>
  </table>

  <table class="so-items">
    <colgroup>
      <col style="width:11%;">
      <col style="width:24%;">
      <col style="width:6%;">
      <col style="width:6%;">
      <col style="width:14%;">
      <col style="width:11%;">
      <col style="width:12%;">
      <col style="width:16%;">
    </colgroup>
    <thead>
      <tr>
        <th>Part No</th>
        <th>Description</th>
        <th class="so-num">Qty</th>
        <th>Unit</th>
        <th class="so-num">Harga Barang</th>
        <th class="so-num">Discount</th>
        <th class="so-num">Pajak</th>
        <th class="so-num">Jumlah</th>
      </tr>
    </thead>
    <tbody>
      {{#each doc.items}}
      <tr>
        <td>{{this.item.item_code}}</td>
        <td>{{this.item.item_name}}{{#if this.description}}<div class="pre-line">{{this.description}}</div>{{/if}}</td>
        <td class="so-num">{{formatNumber this.quantity 0}}</td>
        <td>{{this.unit.code}}</td>
        <td class="so-num">{{formatCurrency this.price @root.doc.currency_code}}</td>
        <td class="so-num">{{formatCurrency this.discount_amount @root.doc.currency_code}}</td>
        <td class="so-num">{{formatCurrency this.tax_amount @root.doc.currency_code}}</td>
        <td class="so-num">{{formatCurrency this.amount @root.doc.currency_code}}</td>
      </tr>
      {{/each}}
      <tr class="so-summary">
        <td colspan="7" class="so-summary-label">Potongan</td>
        <td class="so-num">{{formatCurrency doc.discount_amount doc.currency_code}}</td>
      </tr>
      <tr class="so-summary so-grand-total">
        <td colspan="7" class="so-summary-label">Grand Total</td>
        <td class="so-num">{{formatCurrency doc.amount doc.currency_code}}</td>
      </tr>
    </tbody>
  </table>

  {{#if doc.external_note}}<div class="so-note"><b>Note :</b> <span class="pre-line">{{doc.external_note}}</span></div>{{/if}}

  <table class="approval-signatures">
    <tr>
      <td>
        <div class="approval-signature-caption">Dibuat oleh,</div>
        {{{approvalSignature role="creator" showName=true}}}
      </td>
      <td>
        <div class="approval-signature-caption">Disetujui oleh,</div>
        {{{approvalSignature role="approver" showName=true showDate=true}}}
      </td>
    </tr>
  </table>
</body>

HTML;
    }

    /**
     * CSS Sales Order. Jangan menaruh komentar CSS di berkas ini: pelingkup
     * selector (client dan server) memotong teks sebelum `{` pada koma, jadi
     * komentar berkoma merusak selector aturan di bawahnya dan aturan itu
     * dibuang browser. Kata "body" hanya untuk selector akar dokumen.
     */
    private static function salesOrderCss(): string {
        return <<<'CSS'
body {
  font-family: Arial, Helvetica, sans-serif;
  font-size: 11px;
  color: #1a1a1a;
  line-height: 1.35;
}

body table {
  font-size: inherit;
  line-height: inherit;
}

body p {
  margin: 0 0 1px 0;
}

body .so-head {
  width: 100%;
  border-collapse: collapse;
}

body .so-head td {
  vertical-align: top;
  padding: 0;
}

body .so-head {
  margin-bottom: 14px;
}

body .so-head-left {
  width: 55%;
}

body .so-head-right {
  width: 45%;
  text-align: right;
}

body .doc-title {
  font-size: 18px;
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 1px;
}

body .doc-title-right {
  text-align: right;
  margin: 0 0 8px 0;
}

body .so-meta {
  border-collapse: collapse;
  margin-left: auto;
}

body .so-meta td {
  padding: 2px 0 2px 4px;
  vertical-align: top;
  text-align: left;
}

body .so-meta .so-meta-label {
  font-weight: bold;
  white-space: nowrap;
}

body .so-meta .so-meta-sep {
  width: 8px;
  text-align: center;
}

body .so-party {
  margin: 0 14px 10px 0;
}

body .so-party-title {
  font-size: 9px;
  font-weight: bold;
  text-transform: uppercase;
  color: #555555;
  border-bottom: 1px solid #999999;
  padding-bottom: 2px;
  margin-bottom: 4px;
}

body .so-party-name {
  font-size: 11px;
  font-weight: bold;
  margin: 0 0 2px 0;
}

body .so-items {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  margin-bottom: 8px;
}

body .so-items th {
  background-color: #f0f0f0;
  border: 1px solid #999999;
  padding: 5px 4px;
  font-size: 8px;
  text-transform: uppercase;
  text-align: left;
}

body .so-items td {
  border: 1px solid #cccccc;
  padding: 5px 4px;
  font-size: 9px;
  vertical-align: top;
  overflow-wrap: anywhere;
}

body .so-items .so-num {
  text-align: right;
}

body .so-items td.so-num {
  font-size: 8.5px;
}

body .so-items tr.so-summary td {
  font-weight: bold;
  padding: 6px 4px;
}

body .so-items td.so-summary-label {
  text-align: right;
}

body .so-items tr.so-grand-total td {
  background-color: #e6e6e6;
  border-top: 2px solid #1a1a1a;
}

body .pre-line {
  white-space: pre-line;
}

body .so-note {
  margin: 8px 0 12px 0;
  font-size: 10px;
}

body .approval-signatures {
  width: 100%;
  border-collapse: collapse;
  margin-top: 24px;
  page-break-inside: avoid;
}

body .approval-signatures td {
  width: 50%;
  text-align: center;
  vertical-align: top;
  padding: 0 8px;
}

body .approval-signature-caption {
  font-size: 10px;
  margin-bottom: 4px;
}

body .approval-signature {
  display: inline-block;
  text-align: center;
}

body .approval-signature img {
  display: block;
  margin: 0 auto;
  max-width: 100%;
  max-height: 58px !important;
}
CSS;
    }

    /**
     * Internal Order: header 2 kolom (perusahaan di kiri, meta di kanan),
     * tabel item tanpa harga (Part No, Description, Qty, Unit, Note), dan
     * tanda tangan 2 kolom.
     */
    private static function internalOrder(): array {
        return [
            'model'     => InternalOrder::class,
            'label'     => 'Internal Order',
            'relations' => [
                'branch',
                'items',
                'items.item',
                'items.unit',
            ],
            'html' => P::document([
                P::titleRight('Internal Order'),
                P::headerColumns([
                    P::metaRight([
                        ['Order No', '{{doc.code}}'],
                        ['Order Date', '{{formatDate doc.date "DD-MM-YYYY"}}'],
                        ['Lokasi', '{{doc.branch.name}}', 'doc.branch'],
                    ]),
                ]),
                P::tableWithSummary('doc.items', [
                    ['label' => 'Part No', 'value' => '{{this.item.item_code}}'],
                    ['label' => 'Description', 'value' => '{{this.item.item_name}}'],
                    ['label' => 'Qty', 'value' => '{{formatNumber this.quantity 0}}', 'class' => 'col-qty'],
                    ['label' => 'Unit', 'value' => '{{this.unit.code}}'],
                    ['label' => 'Note', 'value' => '{{this.description}}'],
                ]),
                P::signatures('Dibuat oleh', 'Disetujui oleh'),
            ]),
        ];
    }
}
