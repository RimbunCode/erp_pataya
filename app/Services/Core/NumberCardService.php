<?php

namespace App\Services\Core;

use App\Models\Core\NumberCard;
use App\Services\Core\CustomChartSource\CustomChartSourceRegistry;
use Carbon\Carbon;
use Illuminate\Support\Facades\Schema;

/**
 * Mirror ERPNext `frappe/desk/doctype/number_card/number_card.py` `get_result()` /
 * `get_percentage_difference()` — SATU query agregat langsung (bukan agregasi
 * dari bucket time-series, beda dari `ChartService`), delta persentase lewat
 * requery TERPISAH dengan cutoff `created_at` (bukan diff antar-bucket).
 */
class NumberCardService {
    public function __construct(private CustomChartSourceRegistry $customSources) {}

    /** @param  array<string,mixed>  $filters  filter tree (FilterEvaluator) */
    public function getValue(NumberCard $card, array $filters = []): float {
        if ($card->source_type === 'custom') {
            $result = $this->customSources->resolve($card->method, $filters);

            return (float) ($result['value'] ?? 0);
        }

        return $this->aggregate($card, $filters);
    }

    /**
     * IF pembanding hasilnya 0, THEN null (bukan pembagian oleh nol) — Requirement 2.3.
     */
    public function getPercentageDifference(NumberCard $card, array $filters, float $result): ?float {
        if (! $card->show_percentage_stats) {
            return null;
        }

        $asOfDate = $this->resolveAsOfDate($card->stats_time_interval);
        $previous = $this->aggregate($card, $filters, $asOfDate);

        if ($previous == 0.0) {
            return null;
        }

        if ($result == $previous) {
            return 0.0;
        }

        return (($result / $previous) - 1) * 100.0;
    }

    private function aggregate(NumberCard $card, array $filters, ?Carbon $asOfDate = null): float {
        $modelClass = $card->model_class;
        if (! $modelClass || ! class_exists($modelClass)) {
            return 0.0;
        }

        $table = (new $modelClass)->getTable();
        $query = $modelClass::query();

        $columns = collect($modelClass::getColumns(1))->keyBy('name')->all();
        (new FilterEvaluator($columns))->apply($query, $filters);

        if ($asOfDate !== null && Schema::hasColumn($table, 'created_at')) {
            $query->where('created_at', '<=', $asOfDate);
        }

        $column = $card->function === 'count' ? '*' : $card->aggregate_function_based_on;

        $value = match ($card->function) {
            'sum'     => $query->sum($column),
            'average' => $query->average($column),
            'minimum' => $query->min($column),
            'maximum' => $query->max($column),
            default   => $query->count(),
        };

        return (float) ($value ?? 0);
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
