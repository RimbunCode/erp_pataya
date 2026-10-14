<?php

namespace Database\Seeders\PrintTemplates\Service;

use App\Models\Service\WorkOrder;
use Database\Seeders\PrintTemplates\TemplateParts as P;

/**
 * Template cetak standar domain Service: Work Order.
 */
final class ServiceTemplates {
    /**
     * @return array<int, array{model: class-string, label: string, relations: array<int, string>, html: string}>
     */
    public static function definitions(): array {
        return [
            self::workOrder(),
        ];
    }

    /**
     * Perintah kerja: pelanggan, layanan, waktu mulai dan selesai, uraian
     * pekerjaan, dan barang yang dibutuhkan beserta kuantitasnya.
     */
    private static function workOrder(): array {
        return [
            'model'     => WorkOrder::class,
            'label'     => 'Work Order',
            'relations' => [
                'customer',
                'itemService',
                'items',
                'items.item',
                'items.unit',
            ],
            'html' => P::document([
                P::title('Perintah Kerja'),
                P::meta([
                    ['Nomor', '{{doc.code}}'],
                    ['Tanggal', '{{doc.date}}'],
                    ['Layanan', '{{doc.item_service.item_name}}'],
                    ['Mulai', '{{doc.started_at}}', 'doc.started_at'],
                    ['Selesai', '{{doc.completed_at}}', 'doc.completed_at'],
                ]),
                P::party('Pelanggan', 'doc.customer'),
                '  {{#if doc.external_note}}<div class="section-title">Uraian Pekerjaan</div><div class="pre-line">{{doc.external_note}}</div>{{/if}}',
                '  <div class="section-title">Barang Dibutuhkan</div>',
                P::table('doc.items', [
                    ['label' => 'Barang', 'value' => '{{this.item.item_name}}'],
                    ['label' => 'Qty', 'value' => '{{this.quantity}}', 'class' => 'col-qty'],
                    ['label' => 'Satuan', 'value' => '{{this.unit.code}}'],
                    ['label' => 'Keterangan', 'value' => '{{this.description}}'],
                ]),
                P::signatures(),
            ]),
        ];
    }
}
