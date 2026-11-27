<?php

namespace App\Services\Finances\Tax;

use App\Models\Core\Currency;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Penjelasan pajak sebuah dokumen yang disimpan saat disetujui sebagai `tax_breakdown` (Finance Fase 3,
 * Requirement 5.3). Bagian A: angka dokumen tidak diubah; kolom hitung item tetap sumber kebenaran, jadi snapshot
 * HANYA menjelaskan nilai yang sudah tersimpan (`TaxEngine::describePersisted()`), menandai komponen yang tidak
 * punya versi sebagai legacy (Requirement 5.5), dan memberi peringatan bila engine menghitung lebih dari satu minor
 * unit berbeda untuk sebuah baris.
 *
 * Tidak mengenal model dokumen: pemanggil menyerahkan item bergaya model dengan atribut `tax_id`, `basic_amount`,
 * `discount_amount`, `tax_rate`, `dpp_amount`, `tax_amount`, `withholding_amount`, `tax_rule_version_id`.
 */
final class DocumentTaxSnapshot {
    /** Kode peringatan pada snapshot yang gagal dibangun (Q-P3-6). */
    public const FAILURE_WARNING = 'snapshot_build_failed';

    private const DEFAULT_MINOR_UNIT = 2;

    public function __construct(private readonly TaxEngine $engine) {}

    /**
     * Null bila tak ada baris yang berpajak.
     *
     * @param  iterable<Model>  $items
     * @param  CarbonInterface  $date  tanggal dokumen
     * @param  int  $minorUnit  minor unit mata uang dokumen (nilai item disimpan dalam mata uang dokumen)
     */
    public function build(iterable $items, CarbonInterface $date, int $minorUnit): ?TaxResult {
        $inputs    = [];
        $persisted = [];

        foreach ($items as $item) {
            if (blank($item->tax_id)) {
                continue;
            }

            $ref             = (string) $item->getKey();
            $netBase         = (float) $item->basic_amount - (float) $item->discount_amount;
            $inputs[]        = new TaxInput((string) $item->tax_id, $netBase, $date, $minorUnit, $ref);
            $persisted[$ref] = [
                'tax_rate'   => (float) $item->tax_rate,
                'dpp_amount' => (float) $item->dpp_amount,
                // Pajak potong (`withholding`) disimpan di `withholding_amount`, pajak penambah di `tax_amount`
                // (Bagian B, Requirement 12.4); salah satunya selalu 0 sehingga jumlahnya adalah nilai komponen.
                'tax_amount'      => (float) $item->tax_amount + (float) ($item->withholding_amount ?? 0),
                'rule_version_id' => $item->tax_rule_version_id,
            ];
        }

        return $inputs === [] ? null : $this->engine->describePersisted($inputs, $persisted);
    }

    /**
     * Seperti `build()`, tetapi kegagalan membangun snapshot TIDAK boleh memblokir approve (Q-P3-6, 2026-11-27):
     * snapshot hanya penjelasan. Galat ditangkap, dicatat ke log (id dokumen dan pajak, tanpa trace di data
     * dokumen), dan snapshot diganti kerangka kosong dengan peringatan `snapshot_build_failed`. Null bila tak ada
     * baris berpajak. Angka dokumen tidak tersentuh.
     *
     * @param  iterable<Model>  $items
     * @return array<string, mixed>|null
     */
    public function buildOrDescribeFailure(iterable $items, CarbonInterface $date, int $minorUnit, string $documentType, string $documentId): ?array {
        $items = $items instanceof Collection ? $items : collect($items);

        try {
            return $this->build($items, $date, $minorUnit)?->toArray();
        } catch (Throwable $e) {
            Log::warning('tax.snapshot_build_failed', [
                'document_type' => $documentType,
                'document_id'   => $documentId,
                'tax_ids'       => $items->pluck('tax_id')->filter()->unique()->values()->all(),
                'exception'     => $e::class,
                'message'       => $e->getMessage(),
            ]);

            return [
                'minor_unit'        => $minorUnit,
                'components'        => [],
                'total_additive'    => '0',
                'total_withholding' => '0',
                'explanation'       => [],
                'warnings'          => [self::FAILURE_WARNING],
            ];
        }
    }

    /**
     * Minor unit mata uang dokumen; 2 bila mata uang tak diketahui.
     */
    public static function minorUnitFor(?string $currencyCode): int {
        if ($currencyCode === null) {
            return self::DEFAULT_MINOR_UNIT;
        }

        $minorUnit = Currency::query()->withoutGlobalScopes()->whereKey($currencyCode)->value('minor_unit');

        return $minorUnit === null ? self::DEFAULT_MINOR_UNIT : (int) $minorUnit;
    }
}
