<?php

namespace Database\Seeders\PrintTemplates\Inventory;

use App\Models\Inventory\DeliveryNote;
use App\Models\Inventory\StockEntry;
use Database\Seeders\PrintTemplates\TemplateParts as P;

/**
 * Template cetak standar domain Inventory: Delivery Note dan Stock Entry.
 */
final class InventoryTemplates {
    /**
     * @return array<int, array{model: class-string, label: string, relations: array<int, string>, html: string}>
     */
    public static function definitions(): array {
        return [
            self::deliveryNote(),
            self::stockEntry(),
        ];
    }

    /**
     * Delivery Note: judul kiri + meta kanan di atas, header 3 kolom
     * (perusahaan, Bill To, Ship To), tabel item 4 kolom tanpa harga,
     * kotak Keterangan berbingkai, dan tanda tangan 3 kolom.
     */
    private static function deliveryNote(): array {
        return [
            'model'     => DeliveryNote::class,
            'label'     => 'Delivery Note',
            'relations' => [
                'customer',
                'customerBranch',
                'items',
                'items.item',
                'items.unit',
            ],
            'html' => P::document([
                P::titleBar('Delivery Note', [
                    ['Delivery No', '{{doc.code}}'],
                    ['Delivery Date', '{{formatDate doc.delivery_date "DD-MM-YYYY"}}'],
                ]),
                P::headerColumns([
                    P::companyBlock(),
                    P::billToBlock('doc.customer', 'doc.customer_branch', 'Bill To'),
                    P::shipToBlock('doc.customer', 'doc.customer_branch', 'Ship To'),
                ]),
                P::tableWithSummary('doc.items', [
                    ['label' => 'Part No', 'value' => '{{this.item.item_code}}'],
                    ['label' => 'Description', 'value' => '{{this.item.item_name}}{{#if this.description}}<div class="pre-line">{{this.description}}</div>{{/if}}'],
                    ['label' => 'Qty', 'value' => '{{formatNumber this.quantity 0}}', 'class' => 'col-qty'],
                    ['label' => 'Unit', 'value' => '{{this.unit.code}}'],
                ]),
                P::noteInline('Note', 'doc.external_note'),
                P::framedBox('<strong>Keterangan :</strong><div style="min-height:36px;"></div>'),
                P::mixedSignatures([
                    ['caption' => 'Prepared by', 'type' => 'creator'],
                    ['caption' => 'Approved by', 'type' => 'approver'],
                    ['caption' => 'Received by', 'type' => 'manual'],
                ]),
            ]),
        ];
    }

    /**
     * Stock Entry: jenis mutasi, tanggal terima, gudang asal dan tujuan per
     * baris, kuantitas, serta nilai barang masuk dan keluar.
     */
    private static function stockEntry(): array {
        return [
            'model'     => StockEntry::class,
            'label'     => 'Stock Entry',
            'relations' => [
                'branch',
                'items',
                'items.item',
                'items.unit',
                'items.sourceWarehouse',
                'items.targetWarehouse',
            ],
            'html' => P::document([
                P::title('Bukti Mutasi Stok'),
                P::meta([
                    ['Nomor', '{{doc.code}}'],
                    ['Tanggal', '{{doc.date}}'],
                    ['Jenis', '{{doc.type}}'],
                    ['Tanggal Diterima', '{{doc.received_date}}', 'doc.received_date'],
                    ['Cabang', '{{doc.branch.name}}', 'doc.branch'],
                ]),
                P::table('doc.items', [
                    ['label' => 'Barang', 'value' => '{{this.item.item_name}}'],
                    ['label' => 'Gudang Asal', 'value' => '{{this.source_warehouse.name}}'],
                    ['label' => 'Gudang Tujuan', 'value' => '{{this.target_warehouse.name}}'],
                    ['label' => 'Qty', 'value' => '{{this.quantity}}', 'class' => 'col-qty'],
                    ['label' => 'Satuan', 'value' => '{{this.unit.code}}'],
                    ['label' => 'Nilai', 'value' => '{{this.amount}}', 'class' => 'col-number'],
                ]),
                P::totals([
                    ['Nilai Keluar', '{{doc.total_outgoing_value}}'],
                    ['Nilai Masuk', '{{doc.total_incoming_value}}'],
                ]),
                P::note('Catatan', 'doc.notes'),
                P::signatures(),
            ]),
        ];
    }
}
