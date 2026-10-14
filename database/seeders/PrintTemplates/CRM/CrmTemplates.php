<?php

namespace Database\Seeders\PrintTemplates\CRM;

use App\Models\CRM\Quotation;
use Database\Seeders\PrintTemplates\TemplateParts as P;

/**
 * Template cetak standar domain CRM: Quotation (surat penawaran).
 *
 * Satu template untuk semua jenis surat. Template per jenis (spare part,
 * new unit, rental) tetap dikelola QuotationPrintTemplateSeeder.
 */
final class CrmTemplates {
    /**
     * @return array<int, array{model: class-string, label: string, relations: array<int, string>, html: string}>
     */
    public static function definitions(): array {
        return [
            self::quotation(),
        ];
    }

    /**
     * Surat penawaran: kota dan tanggal terbit, tujuan dan Attn, perihal,
     * kalimat pembuka, barang dengan harga, pajak, dan butir ketentuan.
     */
    private static function quotation(): array {
        return [
            'model'     => Quotation::class,
            'label'     => 'Quotation',
            'relations' => [
                'customer',
                'items',
                'items.item',
                'items.itemUnit',
                'sections',
            ],
            'html' => P::document([
                '  <div style="text-align:right;margin-bottom:12px;">{{#if doc.issued_city}}{{doc.issued_city}}, {{/if}}{{doc.issued_date}}</div>',
                P::meta([
                    ['Kepada', '<b>{{doc.customer.name}}</b><br>{{doc.customer.street}}<br>{{doc.customer.city}} {{doc.customer.province}} {{doc.customer.zip_code}}'],
                    ['Attn', '{{doc.attn}}'],
                    ['Nomor', '{{doc.code}}'],
                    ['Perihal', '{{doc.subject}}', 'doc.subject'],
                    ['Berlaku hingga', '{{doc.valid_until}}', 'doc.valid_until'],
                ]),
                '  <div class="pre-line" style="margin:12px 0;">{{doc.introduction}}</div>',
                P::table('doc.items', [
                    ['label' => 'Barang', 'value' => '{{this.item.item_name}}<div class="pre-line">{{this.description}}</div>'],
                    ['label' => 'Qty', 'value' => '{{this.quantity}}', 'class' => 'col-qty'],
                    ['label' => 'Satuan', 'value' => '{{this.item_unit.code}}'],
                    ['label' => 'Harga', 'value' => '{{this.price}}', 'class' => 'col-number'],
                    ['label' => 'Jumlah', 'value' => '{{this.basic_amount}}', 'class' => 'col-number'],
                ]),
                P::totals([
                    ['Sub Total', '{{doc.basic_amount}}'],
                    ['Pajak', '{{doc.tax_amount}}'],
                    ['Total', '{{doc.amount}}'],
                ]),
                "  {{#each doc.sections}}\n"
                    . "  <div class=\"letter-section\">\n"
                    . "    <div class=\"letter-section-title\">{{this.title}}</div>\n"
                    . "    <div class=\"letter-section-content\">{{this.content}}</div>\n"
                    . "  </div>\n"
                    . '  {{/each}}',
                P::signatures(),
            ]),
        ];
    }
}
