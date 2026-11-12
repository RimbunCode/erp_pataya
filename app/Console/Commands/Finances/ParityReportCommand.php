<?php

namespace App\Console\Commands\Finances;

use App\Enums\PostingDocumentType;
use App\Models\Finances\PostingParityLog;
use Carbon\CarbonImmutable;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;
use Throwable;

/**
 * Ringkasan hasil parity mode `shadow` per jenis dokumen (Finance Fase 2, Requirement 6.7): jumlah match, rounding,
 * config_diff, mismatch, dan engine_error. Dipakai pemilik produk sebagai bukti sebelum memindahkan jenis dokumen ke
 * mode `on` (Requirement 7.2). Hanya membaca.
 */
class ParityReportCommand extends Command {
    protected $signature = 'finance:parity-report
        {--type= : Batasi pada satu jenis dokumen (mis. sales_invoice)}
        {--since= : Hanya catatan sejak tanggal ini (Y-m-d)}';
    protected $description = 'Ringkas hasil parity posting engine (mode shadow) per jenis dokumen';

    public function handle(): int {
        $type = $this->option('type');
        if ($type !== null && ! \in_array($type, PostingDocumentType::values(), true)) {
            $this->error("Jenis dokumen tidak dikenal: {$type}. Pilihan: " . implode(', ', PostingDocumentType::values()));

            return self::FAILURE;
        }

        $since = null;
        if ($this->option('since') !== null) {
            try {
                $input = (string) $this->option('since');
                $since = CarbonImmutable::createFromFormat('!Y-m-d', $input);
                if ($since === false || $since->format('Y-m-d') !== $input) {
                    throw new InvalidArgumentException('Invalid date.');
                }
            } catch (Throwable) {
                $this->error('Format --since tidak valid; gunakan Y-m-d.');

                return self::FAILURE;
            }
        }

        $rows = PostingParityLog::query()
            ->when($type !== null, fn ($query) => $query->where('document_type', $type))
            ->when($since !== null, fn ($query) => $query->where('created_at', '>=', $since))
            ->select('document_type', 'status', DB::raw('count(*) as total'))
            ->groupBy('document_type', 'status')
            ->get();

        $statuses = [
            PostingParityLog::STATUS_MATCH,
            PostingParityLog::STATUS_ROUNDING,
            PostingParityLog::STATUS_CONFIG_DIFF,
            PostingParityLog::STATUS_MISMATCH,
            PostingParityLog::STATUS_ENGINE_ERR,
        ];

        $byType = [];
        foreach ($rows as $row) {
            $byType[$row->document_type][$row->status] = (int) $row->total;
        }

        if ($byType === []) {
            $this->info('Tidak ada catatan parity pada rentang ini.');

            return self::SUCCESS;
        }

        ksort($byType);
        $table = [];
        foreach ($byType as $documentType => $counts) {
            $table[] = [
                $documentType,
                ...array_map(static fn (string $status): int => $counts[$status] ?? 0, $statuses),
                array_sum($counts),
            ];
        }

        $this->table(['Jenis dokumen', ...$statuses, 'total'], $table);

        return self::SUCCESS;
    }
}
