<?php

namespace Database\Seeders\PrintTemplates\Asset;

use App\Models\Asset\Asset;
use App\Models\Asset\AssetMovement;
use App\Models\Asset\AssetService;
use App\Models\Asset\AssetValueAdjustment;
use Database\Seeders\PrintTemplates\TemplateParts as P;

/**
 * Template cetak standar domain Asset: Asset, Asset Movement, Asset Service,
 * dan Asset Value Adjustment.
 */
final class AssetTemplates {
    /**
     * @return array<int, array{model: class-string, label: string, relations: array<int, string>, html: string}>
     */
    public static function definitions(): array {
        return [
            self::asset(),
            self::assetMovement(),
            self::assetService(),
            self::assetValueAdjustment(),
        ];
    }

    /**
     * Kartu aset: identitas, lokasi, perolehan, dan parameter penyusutan.
     */
    private static function asset(): array {
        return [
            'model'     => Asset::class,
            'label'     => 'Asset',
            'relations' => [
                'assetCategory',
                'assetLocation',
            ],
            'html' => P::document([
                P::title('Kartu Aset'),
                P::meta([
                    ['Kode', '{{doc.code}}'],
                    ['Nama Aset', '{{doc.asset_name}}'],
                    ['Kategori', '{{doc.asset_category.category_name}}'],
                    ['Lokasi', '{{doc.asset_location.location_name}}'],
                    ['Jenis Aset', '{{doc.asset_type}}'],
                    ['Jumlah', '{{doc.asset_quantity}}'],
                ]),
                '  <div class="section-title">Perolehan</div>',
                P::meta([
                    ['Tanggal Pembelian', '{{doc.purchase_date}}', 'doc.purchase_date'],
                    ['Tersedia Dipakai Sejak', '{{doc.available_for_use_date}}', 'doc.available_for_use_date'],
                    ['Nilai Pembelian Bersih', '{{doc.net_purchase_amount}}'],
                    ['Nilai Perolehan Kotor', '{{doc.gross_purchase_amount}}'],
                    ['Biaya Tambahan', '{{doc.additional_asset_cost}}', 'doc.additional_asset_cost'],
                ]),
                '  <div class="section-title">Penyusutan</div>',
                P::meta([
                    ['Metode', '{{doc.depreciation_method}}', 'doc.depreciation_method'],
                    ['Mulai Disusutkan', '{{doc.depreciation_start_date}}', 'doc.depreciation_start_date'],
                    ['Frekuensi (bulan)', '{{doc.frequency_of_depreciation}}', 'doc.frequency_of_depreciation'],
                    ['Jumlah Penyusutan', '{{doc.total_number_of_depreciations}}', 'doc.total_number_of_depreciations'],
                    ['Nilai Sisa', '{{doc.expected_value_after_useful_life}}', 'doc.expected_value_after_useful_life'],
                ]),
                P::signatures(),
            ]),
        ];
    }

    /**
     * Mutasi aset: tujuan, tanggal, dan per baris lokasi serta penanggung
     * jawab asal dan tujuan.
     */
    private static function assetMovement(): array {
        return [
            'model'     => AssetMovement::class,
            'label'     => 'Asset Movement',
            'relations' => [
                'branch',
                'items',
                'items.asset',
                'items.sourceLocation',
                'items.targetLocation',
                'items.fromCustodian',
                'items.toCustodian',
            ],
            'html' => P::document([
                P::title('Mutasi Aset'),
                P::meta([
                    ['Nomor', '{{doc.code}}'],
                    ['Tujuan', '{{doc.purpose}}'],
                    ['Tanggal', '{{doc.transaction_date}}'],
                    ['Cabang', '{{doc.branch.name}}', 'doc.branch'],
                ]),
                P::table('doc.items', [
                    ['label' => 'Aset', 'value' => '{{this.asset.asset_name}}'],
                    ['label' => 'Qty', 'value' => '{{this.quantity}}', 'class' => 'col-qty'],
                    ['label' => 'Lokasi Asal', 'value' => '{{this.source_location.location_name}}'],
                    ['label' => 'Lokasi Tujuan', 'value' => '{{this.target_location.location_name}}'],
                    ['label' => 'PJ Asal', 'value' => '{{this.from_custodian.name}}'],
                    ['label' => 'PJ Tujuan', 'value' => '{{this.to_custodian.name}}'],
                ]),
                P::signatures(),
            ]),
        ];
    }

    /**
     * Servis aset (Work Order): header 3 kolom (perusahaan, pelanggan, meta
     * kanan dengan Unit Number & Brand), tabel barang dikonsumsi tanpa harga,
     * catatan, dan tanda tangan 2 kolom (Requested by, Approved by).
     */
    private static function assetService(): array {
        return [
            'model'     => AssetService::class,
            'label'     => 'Asset Service',
            'relations' => [
                'asset',
                'branch',
                'customer',
                'consumedItems',
                'consumedItems.item',
                'consumedItems.itemUnit',
            ],
            'html' => P::document([
                P::titleRight('Work Order'),
                P::headerColumns([
                    P::companyBlock(),
                    P::partyBlock('doc.customer'),
                    P::metaRight([
                        ['WO No', '{{doc.code}}'],
                        ['WO Date', '{{formatDate doc.start_date "DD-MM-YYYY"}}', 'doc.start_date'],
                        ['Unit Number', '{{doc.asset.code}}', 'doc.asset'],
                        ['Brand', '{{doc.asset.asset_name}}', 'doc.asset'],
                        ['Location', '{{doc.branch.name}}', 'doc.branch'],
                    ]),
                ]),
                P::tableWithSummary('doc.consumed_items', [
                    ['label' => 'Part No', 'value' => '{{this.item.item_code}}'],
                    ['label' => 'Description', 'value' => '{{this.item.item_name}}'],
                    ['label' => 'Qty', 'value' => '{{formatNumber this.quantity 0}}', 'class' => 'col-qty'],
                    ['label' => 'Unit', 'value' => '{{this.item_unit.code}}'],
                    ['label' => 'Note', 'value' => ''],
                ]),
                P::noteInline('Note', 'doc.description'),
                P::mixedSignatures([
                    ['caption' => 'Requested by', 'type' => 'creator'],
                    ['caption' => 'Approved by', 'type' => 'approver'],
                ]),
            ]),
        ];
    }

    /**
     * Penyesuaian nilai aset: aset yang disesuaikan, nilai sebelum, dan nilai sesudah.
     */
    private static function assetValueAdjustment(): array {
        return [
            'model'     => AssetValueAdjustment::class,
            'label'     => 'Asset Value Adjustment',
            'relations' => [
                'asset',
            ],
            'html' => P::document([
                P::title('Penyesuaian Nilai Aset'),
                P::meta([
                    ['Nomor', '{{doc.code}}'],
                    ['Tanggal', '{{doc.date}}'],
                    ['Aset', '{{doc.asset.asset_name}}'],
                ]),
                P::totals([
                    ['Nilai Aset Saat Ini', '{{doc.current_asset_value}}'],
                    ['Nilai Aset Baru', '{{doc.new_asset_value}}'],
                ]),
                P::signatures(),
            ]),
        ];
    }
}
