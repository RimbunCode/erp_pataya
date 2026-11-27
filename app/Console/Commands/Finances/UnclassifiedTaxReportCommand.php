<?php

namespace App\Console\Commands\Finances;

use App\Models\Finances\Tax;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Melaporkan pajak yang masih `unclassified` beserta pemakaiannya (Finance Fase 3, Requirement 10.5). Sistem tidak
 * menebak klasifikasi pajak lama: akuntan menetapkan kategori dan perilaku tiap pajak, dan laporan ini
 * memprioritaskan pajak yang paling banyak dipakai. Hanya membaca; tidak mengubah data. Pajak terhapus lunak tidak
 * ikut (tidak dapat dipilih pada dokumen baru).
 */
class UnclassifiedTaxReportCommand extends Command {
    protected $signature   = 'finance:report-unclassified-taxes';
    protected $description = 'Laporkan pajak yang belum diklasifikasi (unclassified) beserta jumlah pemakaiannya pada dokumen dan pengaturan';

    /**
     * Sumber pemakaian per kolom laporan: tabel dan kolom yang merujuk `taxes.id`.
     *
     * @var array<string, list<array{table: string, column: string}>>
     */
    private const USAGE_SOURCES = [
        'sales_invoices'    => [['table' => 'sales_invoice_items', 'column' => 'tax_id']],
        'purchase_invoices' => [['table' => 'purchase_invoice_items', 'column' => 'tax_id']],
        'other_documents'   => [
            ['table' => 'sales_order_items', 'column' => 'tax_id'],
            ['table' => 'purchase_order_items', 'column' => 'tax_id'],
            ['table' => 'quotation_items', 'column' => 'tax_id'],
        ],
        'defaults' => [
            ['table' => 'sales_settings', 'column' => 'default_tax_id'],
            ['table' => 'purchase_settings', 'column' => 'default_tax_id'],
            ['table' => 'default_tax_rules', 'column' => 'tax_id'],
        ],
    ];

    public function handle(): int {
        $taxes = Tax::query()->where('category', Tax::CATEGORY_UNCLASSIFIED)->orderBy('name')->orderBy('id')->get();

        if ($taxes->isEmpty()) {
            $this->info('Semua pajak sudah diklasifikasi.');

            return self::SUCCESS;
        }

        $usage = [];
        foreach (self::USAGE_SOURCES as $group => $sources) {
            $usage[$group] = $this->countUsage($sources, $taxes->pluck('id')->all());
        }

        $rows = $taxes->map(static fn (Tax $tax): array => [
            $tax->name,
            $tax->rate,
            $usage['sales_invoices'][$tax->getKey()] ?? 0,
            $usage['purchase_invoices'][$tax->getKey()] ?? 0,
            $usage['other_documents'][$tax->getKey()] ?? 0,
            $usage['defaults'][$tax->getKey()] ?? 0,
        ])->sortByDesc(static fn (array $row): int => $row[2] + $row[3])->values()->all();

        $this->warn('Pajak belum diklasifikasi: ' . \count($rows) . '. Akuntan menetapkan kategori dan perilaku tiap pajak; sistem tidak menebak.');
        $this->table(['Pajak', 'Rate', 'Item invoice penjualan', 'Item invoice pembelian', 'Item dokumen lain', 'Rujukan default'], $rows);
        $this->newLine();
        $this->info('Laporan saja: tidak ada data yang diubah.');

        return self::SUCCESS;
    }

    /**
     * @param  list<array{table: string, column: string}>  $sources
     * @param  list<string>  $taxIds
     * @return array<string, int> jumlah rujukan per `tax_id`
     */
    private function countUsage(array $sources, array $taxIds): array {
        $totals = [];
        foreach ($sources as $source) {
            if (! Schema::hasTable($source['table']) || ! Schema::hasColumn($source['table'], $source['column'])) {
                continue;
            }

            $counts = DB::table($source['table'])
                ->select($source['column'] . ' as tax_id', DB::raw('COUNT(*) as total'))
                ->whereIn($source['column'], $taxIds)
                ->groupBy($source['column'])
                ->pluck('total', 'tax_id');

            foreach ($counts as $taxId => $total) {
                $totals[$taxId] = ($totals[$taxId] ?? 0) + (int) $total;
            }
        }

        return $totals;
    }
}
