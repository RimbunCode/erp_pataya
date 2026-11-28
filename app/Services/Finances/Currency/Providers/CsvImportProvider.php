<?php

namespace App\Services\Finances\Currency\Providers;

use App\Models\Finances\ExchangeRate;
use App\Services\Finances\Currency\ExchangeRateRecorder;

/**
 * Penyedia kurs dari berkas CSV (Finance Fase 4, Requirement 1.4): validasi per baris, laporan galat dengan nomor
 * baris berkas, tanpa jaringan, `source = import`.
 *
 * Format: baris pertama header dengan kolom `from_currency_code,to_currency_code,rate_type,rate,rate_date`
 * (urutan bebas; kolom lain dan sel header kosong diabaikan; kelima kolom wajib itu tidak boleh dobel). Kurs ditulis
 * dengan TITIK sebagai pemisah desimal (`15500.25`); desimal koma (`15500,25`) dan pemisah ribuan tidak diterima dan
 * dilaporkan galat. Batas: 5 MB dan 50.000 baris data tak-kosong per impor (baris rusak ikut dihitung); nama berkas
 * menjadi `source_ref`. Pemisah `,` atau `;` (dideteksi dari header), BOM UTF-8 diabaikan, baris kosong dilewati.
 * Baris valid tetap tersimpan walau baris lain galat; impor ulang berkas yang sama idempoten. Galat yang dirinci
 * dibatasi `RateImportReport::MAX_ERRORS`.
 */
final class CsvImportProvider implements ExchangeRateProvider {
    public const COLUMNS = ['from_currency_code', 'to_currency_code', 'rate_type', 'rate', 'rate_date'];

    /** Batas ukuran berkas (5 MB) dan jumlah baris data (50.000); di atasnya impor ditolak seluruhnya. */
    public const MAX_BYTES = 5 * 1024 * 1024;

    public const MAX_ROWS = 50000;

    public function __construct(private readonly ExchangeRateRecorder $recorder) {}

    private function failed(string $message): RateImportReport {
        $report = new RateImportReport;
        $report->addError(0, $message);

        return $report;
    }

    public function source(): string {
        return ExchangeRate::SOURCE_IMPORT;
    }

    public function ingest(iterable $rows, ?string $sourceRef = null, ?string $createdById = null): RateImportReport {
        return $this->recorder->ingest($rows, $this->source(), $sourceRef, $createdById);
    }

    /**
     * Mengimpor berkas CSV di `$path`. Hanya `MAX_BYTES + 1` byte pertama dibaca; berkas lebih besar ditolak.
     */
    public function importFile(string $path, ?string $createdById = null): RateImportReport {
        $content = is_file($path) ? @file_get_contents($path, false, null, 0, self::MAX_BYTES + 1) : false;
        if ($content === false) {
            return $this->failed(__('finances/exchangeRate.errors.csv_unreadable'));
        }

        return $this->importString($content, basename($path), $createdById);
    }

    /**
     * Mengimpor isi CSV; `$sourceRef` biasanya nama berkas.
     */
    public function importString(string $csv, ?string $sourceRef = null, ?string $createdById = null): RateImportReport {
        if (\strlen($csv) > self::MAX_BYTES) {
            return $this->failed(__('finances/exchangeRate.errors.csv_too_large', ['max' => self::MAX_BYTES / 1024 / 1024]));
        }

        $csv = preg_replace('/^\xEF\xBB\xBF/', '', $csv) ?? $csv;
        $csv = str_replace(["\r\n", "\r"], "\n", $csv);

        $report     = new RateImportReport;
        $header     = null;
        $delimiter  = ',';
        $rows       = [];
        $dataLines  = 0;
        $lineNumber = 0;
        $length     = \strlen($csv);
        $offset     = 0;

        // Dipindai baris demi baris (tanpa memecah seluruh isi menjadi array jutaan elemen).
        while ($offset <= $length) {
            $end = strpos($csv, "\n", $offset);
            if ($end === false) {
                $end = $length;
            }
            $text   = substr($csv, $offset, $end - $offset);
            $offset = $end + 1;
            $lineNumber++;

            if (trim($text) === '') {
                continue;
            }

            if ($header === null) {
                $delimiter = substr_count($text, ';') > substr_count($text, ',') ? ';' : ',';
                $header    = array_map(static fn (?string $cell): string => strtolower(trim((string) $cell)), str_getcsv($text, $delimiter, '"', ''));

                if (array_diff(self::COLUMNS, $header) !== []) {
                    $report->addError($lineNumber, __('finances/exchangeRate.errors.csv_missing_header', ['columns' => implode(', ', self::COLUMNS)]));

                    return $report;
                }

                // Dobel hanya diperiksa di antara kolom wajib; sel kosong atau kolom tak dikenal diabaikan.
                $counts     = array_count_values(array_intersect($header, self::COLUMNS));
                $duplicated = array_keys(array_filter($counts, static fn (int $count): bool => $count > 1));
                if ($duplicated !== []) {
                    $report->addError($lineNumber, __('finances/exchangeRate.errors.csv_duplicate_header', ['columns' => implode(', ', $duplicated)]));

                    return $report;
                }

                continue;
            }

            // Semua baris data tak-kosong dihitung, termasuk baris rusak.
            if (++$dataLines > self::MAX_ROWS) {
                return $this->failed(__('finances/exchangeRate.errors.csv_too_many_rows', ['max' => self::MAX_ROWS]));
            }

            $cells = str_getcsv($text, $delimiter, '"', '');
            if (\count($cells) !== \count($header)) {
                // Pesan hanya diterjemahkan selama daftar galat belum penuh (terjemahan per baris mahal untuk berkas besar).
                if ($report->isFull()) {
                    $report->omittedErrors++;
                } else {
                    $report->addError($lineNumber, __('finances/exchangeRate.errors.csv_column_count', ['expected' => \count($header), 'actual' => \count($cells)]));
                }

                continue;
            }

            // Kolom ber-nama sama (kosong/tak dikenal) tidak memengaruhi kolom wajib; yang terakhir menang.
            $rows[$lineNumber] = array_combine($header, array_map(static fn (?string $cell): string => trim((string) $cell), $cells));
        }

        $result = $this->ingest($rows, $sourceRef, $createdById);
        foreach ($report->errors as $error) {
            $result->addError($error['line'], $error['message']);
        }
        $result->omittedErrors += $report->omittedErrors;
        usort($result->errors, static fn (array $a, array $b): int => $a['line'] <=> $b['line']);

        return $result;
    }
}
