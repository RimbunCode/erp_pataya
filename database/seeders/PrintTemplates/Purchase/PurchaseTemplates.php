<?php

namespace Database\Seeders\PrintTemplates\Purchase;

use App\Models\Purchase\PurchaseOrder;
use App\Models\Purchase\PurchaseReceipt;
use App\Models\Purchase\PurchaseRequest;
use Database\Seeders\PrintTemplates\TemplateParts as P;

/**
 * Template cetak standar domain Purchase: Purchase Request, Purchase Order,
 * dan Purchase Receipt.
 */
final class PurchaseTemplates {
    /**
     * @return array<int, array{model: class-string, label: string, relations: array<int, string>, html: string}>
     */
    public static function definitions(): array {
        return [
            self::purchaseRequest(),
            self::purchaseOrder(),
            self::purchaseReceipt(),
        ];
    }

    /**
     * Permintaan pembelian: barang yang diminta, tanggal dibutuhkan, dan
     * alasan/keperluan per baris. Tanpa pemasok dan tanpa harga.
     */
    private static function purchaseRequest(): array {
        return [
            'model'     => PurchaseRequest::class,
            'label'     => 'Purchase Request',
            'relations' => [
                'items',
                'items.item',
                'items.unit',
            ],
            'html' => P::document([
                P::title('Permintaan Pembelian'),
                P::meta([
                    ['Nomor', '{{doc.code}}'],
                    ['Tanggal', '{{doc.date}}'],
                    ['Dibutuhkan Pada', '{{doc.required_date}}', 'doc.required_date'],
                ]),
                P::table('doc.items', [
                    ['label' => 'Barang yang Diminta', 'value' => '{{this.item.item_name}}'],
                    ['label' => 'Qty', 'value' => '{{this.quantity}}', 'class' => 'col-qty'],
                    ['label' => 'Satuan', 'value' => '{{this.unit.code}}'],
                    ['label' => 'Dibutuhkan Pada', 'value' => '{{this.required_date}}'],
                    ['label' => 'Alasan / Keperluan', 'value' => '{{this.description}}'],
                ]),
                P::note('Catatan', 'doc.external_note'),
                P::signatures(),
            ]),
        ];
    }

    /**
     * Pesanan pembelian: header 3 kolom (perusahaan, pemasok, meta kanan),
     * tabel item mulai dari Part No dengan baris ringkasan menyatu, dan
     * tanda tangan 3 kolom (Requested by, Approved by, Accepted / Agreed by).
     */
    private static function purchaseOrder(): array {
        return [
            'model'     => PurchaseOrder::class,
            'label'     => 'Purchase Order',
            'relations' => [
                'branch',
                'supplier',
                'items',
                'items.item',
                'items.unit',
            ],
            'html' => P::document([
                P::titleRight('Purchase Order'),
                P::headerColumns([
                    P::companyBlock(),
                    P::partyBlock('doc.supplier'),
                    P::metaRight([
                        ['Order No', '{{doc.code}}'],
                        ['Order Date', '{{formatDate doc.date "DD-MM-YYYY"}}'],
                        ['Delivery Date', '{{formatDate doc.required_date "DD-MM-YYYY"}}', 'doc.required_date'],
                        ['Location', '{{doc.branch.name}}', 'doc.branch'],
                    ]),
                ]),
                P::tableWithSummary('doc.items', [
                    ['label' => 'Part No', 'value' => '{{this.item.item_code}}'],
                    ['label' => 'Description', 'value' => '{{this.item.item_name}}{{#if this.description}}<div class="pre-line">{{this.description}}</div>{{/if}}'],
                    ['label' => 'Qty', 'value' => '{{formatNumber this.quantity 0}}', 'class' => 'col-qty'],
                    ['label' => 'Unit', 'value' => '{{this.unit.code}}'],
                    ['label' => 'Harga Barang', 'value' => '{{formatCurrency this.rate doc.currency_code}}', 'class' => 'col-number'],
                    ['label' => 'Discount', 'value' => '{{formatCurrency this.discount_amount doc.currency_code}}', 'class' => 'col-number'],
                    ['label' => 'Pajak', 'value' => '{{formatCurrency this.tax_amount doc.currency_code}}', 'class' => 'col-number'],
                    ['label' => 'Jumlah', 'value' => '{{formatCurrency this.amount doc.currency_code}}', 'class' => 'col-number'],
                ], [
                    ['Potongan', '{{formatCurrency doc.discount_amount doc.currency_code}}'],
                    ['Grand Total', '{{formatCurrency doc.amount doc.currency_code}}'],
                ]),
                P::noteInline('Note', 'doc.external_note'),
                P::mixedSignatures([
                    ['caption' => 'Requested by', 'type' => 'creator'],
                    ['caption' => 'Approved by', 'type' => 'approver'],
                    ['caption' => 'Accepted / Agreed by', 'type' => 'manual'],
                ]),
            ]),
        ];
    }

    /**
     * Penerimaan barang: header 3 kolom (perusahaan, Vendor, meta kanan),
     * tabel item 4 kolom tanpa harga, dan tanda tangan 2 kolom
     * (Received by, Acknowledge by).
     */
    private static function purchaseReceipt(): array {
        return [
            'model'     => PurchaseReceipt::class,
            'label'     => 'Purchase Receipt',
            'relations' => [
                'supplier',
                'purchaseOrder',
                'items',
                'items.item',
                'items.unit',
            ],
            'html' => P::document([
                P::titleRight('Purchase Receipt'),
                P::headerColumns([
                    P::companyBlock(),
                    P::partyBlock('doc.supplier', 'Vendor'),
                    P::metaRight([
                        ['Receive No', '{{doc.code}}'],
                        ['Receive Date', '{{formatDate doc.date "DD-MM-YYYY"}}'],
                        ['Order No', '{{doc.purchase_order.code}}', 'doc.purchase_order'],
                        ['Order Date', '{{formatDate doc.purchase_order.date "DD-MM-YYYY"}}', 'doc.purchase_order'],
                    ]),
                ]),
                P::tableWithSummary('doc.items', [
                    ['label' => 'Part No', 'value' => '{{this.item.item_code}}'],
                    ['label' => 'Description', 'value' => '{{this.item.item_name}}{{#if this.description}}<div class="pre-line">{{this.description}}</div>{{/if}}'],
                    ['label' => 'Qty', 'value' => '{{formatNumber this.quantity 0}}', 'class' => 'col-qty'],
                    ['label' => 'Unit', 'value' => '{{this.unit.code}}'],
                ]),
                P::noteInline('Note', 'doc.external_note'),
                P::mixedSignatures([
                    ['caption' => 'Received by', 'type' => 'creator'],
                    ['caption' => 'Acknowledge by', 'type' => 'approver'],
                ]),
            ]),
        ];
    }
}
