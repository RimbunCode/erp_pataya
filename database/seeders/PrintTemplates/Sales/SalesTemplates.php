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
     * Sales Order: header 3 kolom (perusahaan, Bill To + Ship To, meta kanan),
     * tabel item mulai dari Part No dengan baris ringkasan menyatu, dan
     * tanda tangan 2 kolom.
     */
    private static function salesOrder(): array {
        return [
            'model'     => SalesOrder::class,
            'label'     => 'Sales Order',
            'relations' => [
                'branch',
                'currency',
                'customer',
                'customerBranch',
                'items',
                'items.item',
                'items.unit',
            ],
            'html' => P::document([
                P::titleRight('Sales Order'),
                P::headerColumns([
                    P::companyBlock(),
                    P::billToBlock('doc.customer', 'doc.customer_branch', 'Bill To') . "\n" . P::shipToBlock('doc.customer', 'doc.customer_branch', 'Ship To'),
                    P::metaRight([
                        ['Order No', '{{doc.code}}'],
                        ['Order Date', '{{formatDate doc.date "DD-MM-YYYY"}}'],
                        ['Lokasi', '{{doc.branch.name}}', 'doc.branch'],
                    ]),
                ]),
                P::tableWithSummary('doc.items', [
                    ['label' => 'Part No', 'value' => '{{this.item.item_code}}'],
                    ['label' => 'Description', 'value' => '{{this.item.item_name}}{{#if this.description}}<div class="pre-line">{{this.description}}</div>{{/if}}'],
                    ['label' => 'Qty', 'value' => '{{formatNumber this.quantity 0}}', 'class' => 'col-qty'],
                    ['label' => 'Unit', 'value' => '{{this.unit.code}}'],
                    ['label' => 'Harga Barang', 'value' => '{{formatCurrency this.price doc.currency.code}}', 'class' => 'col-number'],
                    ['label' => 'Discount', 'value' => '{{formatCurrency this.discount_amount doc.currency.code}}', 'class' => 'col-number'],
                    ['label' => 'Pajak', 'value' => '{{formatCurrency this.tax_amount doc.currency.code}}', 'class' => 'col-number'],
                    ['label' => 'Jumlah', 'value' => '{{formatCurrency this.amount doc.currency.code}}', 'class' => 'col-number'],
                ], [
                    ['Potongan', '{{formatCurrency doc.discount_amount doc.currency.code}}'],
                    ['Grand Total', '{{formatCurrency doc.amount doc.currency.code}}'],
                ]),
                P::noteInline('Note', 'doc.external_note'),
                P::signatures('Dibuat oleh', 'Disetujui oleh'),
            ]),
        ];
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
                    P::companyBlock(),
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
