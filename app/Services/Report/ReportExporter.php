<?php

namespace App\Services\Report;

use App\Models\Model;
use Dompdf\Dompdf;
use Dompdf\Options;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

/**
 * Export laporan ke PDF dan CSV (spec modul-laporan, Req 7).
 *
 * PDF memakai dompdf, mesin yang sudah dipakai PdfExportService sebagai cadangan, tanpa
 * dependensi baru. CSV memakai fputcsv bawaan PHP. Kedua format memuat nama laporan, filter
 * aktif, dan waktu pembuatan di bagian atas (Req 7.3), serta seluruh baris hasil filter (Req 7.2).
 */
final class ReportExporter {
    /**
     * @param  array<string, string>  $filterSummary
     * @param  array<string, int|float>  $kpi  label KPI => nilai
     * @param  Collection<int, Model>  $rows
     */
    public function csv(ReportDefinition $definition, array $filterSummary, array $kpi, Collection $rows): string {
        // Ditulis ke memori, bukan streamDownload: response streaming tidak mendukung withCookie()
        // yang dipakai LanguageMiddleware.
        $out = fopen('php://temp', 'w+');

        // BOM supaya Excel membaca UTF-8 dengan benar.
        fwrite($out, "\xEF\xBB\xBF");

        fputcsv($out, [$definition->title]);
        fputcsv($out, [__('report.export.generated_at'), now()->format('d-m-Y H:i')]);
        fputcsv($out, [__('report.export.filter'), $this->filterText($filterSummary)]);
        fputcsv($out, []);

        // Baris KPI di atas header tabel (Req 7.6).
        foreach ($kpi as $label => $value) {
            fputcsv($out, [$label, $value]);
        }
        fputcsv($out, []);

        fputcsv($out, array_values($definition->columns));
        foreach ($rows as $row) {
            fputcsv($out, $this->cells($definition, $row, csv: true));
        }

        rewind($out);
        $content = stream_get_contents($out);
        fclose($out);

        return $content;
    }

    /**
     * @param  array<string, string>  $filterSummary
     * @param  array<string, int|float>  $kpi
     * @param  Collection<int, Model>  $rows
     */
    public function pdf(ReportDefinition $definition, array $filterSummary, array $kpi, Collection $rows): string {
        $html = view('reports.export', [
            'title'       => $definition->title,
            'generatedAt' => now()->format('d-m-Y H:i'),
            'filter'      => $this->filterText($filterSummary),
            'kpi'         => collect($kpi)->map(fn ($value) => $this->number((float) $value))->all(),
            'columns'     => array_values($definition->columns),
            'rows'        => $rows->map(fn ($row) => $this->cells($definition, $row, csv: false))->all(),
        ])->render();

        $options = new Options;
        $options->setIsRemoteEnabled(false);
        $options->setIsHtml5ParserEnabled(true);

        $dompdf = new Dompdf($options);
        $dompdf->loadHtml($html);
        $dompdf->setPaper('A4', 'landscape');
        $dompdf->render();

        return $dompdf->output();
    }

    public function filename(ReportDefinition $definition, string $extension): string {
        return Str::slug($definition->key) . '-' . now()->format('Ymd-His') . '.' . $extension;
    }

    /**
     * @param  Model  $row
     * @return list<string>
     */
    private function cells(ReportDefinition $definition, $row, bool $csv): array {
        $cells = [];
        foreach (array_keys($definition->columns) as $field) {
            $cells[] = $this->cell($row->{$field}, $csv);
        }

        return $cells;
    }

    private function cell(mixed $value, bool $csv): string {
        if ($value === null) {
            return '';
        }
        if ($value instanceof \DateTimeInterface) {
            return $value->format('d-m-Y H:i');
        }
        if (is_int($value)) {
            return (string) $value;
        }
        if (is_float($value) || (is_string($value) && is_numeric($value) && str_contains($value, '.'))) {
            return $csv ? number_format((float) $value, 2, '.', '') : $this->number((float) $value);
        }

        return (string) $value;
    }

    private function number(float $value): string {
        return number_format($value, 2, ',', '.');
    }

    /**
     * @param  array<string, string>  $filterSummary
     */
    private function filterText(array $filterSummary): string {
        if ($filterSummary === []) {
            return __('report.issue.no_filter');
        }

        $parts = [];
        foreach ($filterSummary as $label => $value) {
            $parts[] = "{$label}: {$value}";
        }

        return implode('; ', $parts);
    }
}
