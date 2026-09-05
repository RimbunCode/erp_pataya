<?php

namespace App\Services\Core;

use App\Models\Core\NumberCard;
use App\Services\Core\CustomChartSource\CustomChartSourceRegistry;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Schema;

/**
 * Mirror ERPNext `frappe/desk/doctype/number_card/number_card.py` `get_result()` /
 * `get_percentage_difference()` — delta persentase lewat cutoff `created_at`
 * (bukan diff antar-bucket time-series, beda dari `ChartService`).
 */
class NumberCardService {
    /**
     * Optimasi dashboard: redam query agregat berulang lintas-request/user —
     * TTL pendek (bukan lama seperti DataTableConfigCache) krn nilainya data
     * transaksional yang wajar berubah, bukan metadata statis.
     */
    protected int $cacheDuration = 120;

    public function __construct(private CustomChartSourceRegistry $customSources) {}

    /** @param  array<string,mixed>  $filters  filter tree (FilterEvaluator) */
    public function getValue(NumberCard $card, array $filters = []): float {
        if ($card->source_type === 'custom') {
            $result = $this->customSources->resolve($card->method, $filters);

            return (float) ($result['value'] ?? 0);
        }

        return $this->computeResult($card, $filters)['value'];
    }

    /**
     * IF pembanding hasilnya 0, THEN null (bukan pembagian oleh nol) — Requirement 2.3.
     */
    public function getPercentageDifference(NumberCard $card, array $filters, float $result): ?float {
        if (! $card->show_percentage_stats) {
            return null;
        }

        $previous = $this->computeResult($card, $filters)['previous'];

        if ($previous === null || $previous == 0.0) {
            return null;
        }

        if ($result == $previous) {
            return 0.0;
        }

        return (($result / $previous) - 1) * 100.0;
    }

    /**
     * Requirement F (optimasi query): `value` (agregat penuh) & `previous`
     * (agregat as-of-cutoff, dipakai delta persentase) dihitung DALAM SATU
     * QUERY via conditional aggregation (`CASE WHEN ... THEN col END`) —
     * bukan 2 query terpisah seperti sebelumnya. `getValue()` &
     * `getPercentageDifference()` satu-satunya caller nyata
     * (`NumberCardController::getValue()`) SELALU dipanggil berpasangan
     * dengan filters yang sama — hasil di-cache SEBAGAI SATU ENTRI supaya
     * panggilan kedua baca dari cache yang baru ditulis panggilan pertama
     * dalam request yang sama, bukan query ulang.
     *
     * `previous` tetap dihitung (bukan null) walau model tidak punya kolom
     * `created_at` — cutoff jatuh ke `1=1` (previous == value, mirror
     * perilaku lama `aggregate()` yang diam-diam skip WHERE cutoff-nya).
     *
     * @param  array<string,mixed>  $filters
     * @return array{value: float, previous: ?float}
     */
    private function computeResult(NumberCard $card, array $filters): array {
        $modelClass = $card->model_class;
        if (! $modelClass || ! class_exists($modelClass)) {
            return ['value' => 0.0, 'previous' => null];
        }

        $cacheKey = 'number_card_result:' . $card->id . ':' . $card->updated_at?->timestamp
            . ':' . md5(json_encode($filters));

        return Cache::remember($cacheKey, $this->cacheDuration, function () use ($card, $modelClass, $filters) {
            $table = (new $modelClass)->getTable();
            $query = $modelClass::query();

            $columns = collect($modelClass::getColumns(1))->keyBy('name')->all();
            (new FilterEvaluator($columns))->apply($query, $filters);

            $column = $card->function === 'count' ? '*' : $card->aggregate_function_based_on;

            if (! $card->show_percentage_stats) {
                return ['value' => $this->runAggregate($query, $card->function, $column), 'previous' => null];
            }

            $hasCreatedAt = Schema::hasColumn($table, 'created_at');
            $cutoffSql    = $hasCreatedAt ? 'created_at <= ?' : '1=1';
            $bindings     = $hasCreatedAt
                ? [$this->resolveAsOfDate($card->stats_time_interval)->toDateTimeString()]
                : [];

            $expr = $this->conditionalAggregateExpression($card->function, $column);
            $row  = $query
                ->selectRaw(
                    \sprintf($expr, '1=1') . ' as value, ' . \sprintf($expr, $cutoffSql) . ' as previous',
                    $bindings,
                )
                ->first();

            return [
                'value'    => (float) ($row->value ?? 0),
                'previous' => (float) ($row->previous ?? 0),
            ];
        });
    }

    private function runAggregate(Builder $query, string $function, string $column): float {
        $value = match ($function) {
            'sum'     => $query->sum($column),
            'average' => $query->average($column),
            'minimum' => $query->min($column),
            'maximum' => $query->max($column),
            default   => $query->count(),
        };

        return (float) ($value ?? 0);
    }

    /**
     * `%s` diisi kondisi CASE WHEN (`1=1` utk "value" tanpa cutoff,
     * `created_at <= ?` utk "previous"). NULL dari cabang ELSE implisit
     * dikecualikan otomatis oleh SUM/AVG/MIN/MAX/COUNT SQL — semantik SAMA
     * dgn menjalankan query WHERE terpisah per kondisi.
     */
    private function conditionalAggregateExpression(string $function, string $column): string {
        $inner = $function === 'count' ? '1' : $column;
        $agg   = match ($function) {
            'sum'     => 'SUM',
            'average' => 'AVG',
            'minimum' => 'MIN',
            'maximum' => 'MAX',
            default   => 'COUNT',
        };

        return "{$agg}(CASE WHEN %s THEN {$inner} END)";
    }

    private function resolveAsOfDate(?string $interval): Carbon {
        $now = now();

        return match ($interval) {
            'weekly'  => $now->copy()->subWeek(),
            'monthly' => $now->copy()->subMonthNoOverflow(),
            'yearly'  => $now->copy()->subYear(),
            default   => $now->copy()->subDay(), // daily
        };
    }
}
