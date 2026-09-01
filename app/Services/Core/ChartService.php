<?php

namespace App\Services\Core;

use App\Enums\Permission;
use App\Models\Core\Chart;
use App\Services\Core\CustomChartSource\CustomChartSourceRegistry;
use Carbon\Carbon;
use Illuminate\Support\Facades\Schema;

/**
 * Dispatcher 3 jalur TERPISAH TOTAL (mirror ERPNext `dashboard_chart.py::get()`):
 * time-series (count/sum/average + timeseries=true), group_by (kategorikal,
 * BUKAN per waktu — fix bug lama `WidgetController::getChartData()` yang
 * selalu jatuh ke count-by-time), heatmap. Ketiganya tidak saling memanggil.
 */
class ChartService {
    public function __construct(private CustomChartSourceRegistry $customSources) {}

    /** @param  array<string,mixed>  $filters filter tree (FilterEvaluator) */
    public function getData(Chart $chart, array $filters, PermissionChecker $checker, array $config = []): array {
        if ($chart->chart_source_type === 'custom') {
            return $this->customSources->resolve($chart->method, $filters);
        }

        if ($chart->chart_source_type === 'group_by') {
            return $this->getGroupByChartConfig($chart, $filters, $checker);
        }

        if ($chart->visual_type === 'heatmap') {
            return $this->getHeatmapChartConfig($chart, $filters, $config['heatmap_year'] ?? null);
        }

        return $this->getTimeSeriesChartConfig($chart, $filters, $config);
    }

    /**
     * Requirement 5: agregat per NILAI DISTINCT `group_by_based_on`
     * (BUKAN per periode waktu), urut desc, limit `number_of_groups`.
     */
    private function getGroupByChartConfig(Chart $chart, array $filters, PermissionChecker $checker): array {
        $modelClass = $chart->model_class;
        if (! $modelClass || ! class_exists($modelClass)) {
            return ['labels' => [], 'datasets' => []];
        }

        $table      = (new $modelClass)->getTable();
        $groupField = $chart->group_by_based_on;
        if (! $groupField) {
            return ['labels' => [], 'datasets' => []];
        }

        $columns = collect($modelClass::getColumns(1))->keyBy('name')->all();
        $meta    = $columns[$groupField] ?? null;

        // `group_by_based_on` bisa berupa nama RELASI (mis. 'dashboard', bukan
        // 'dashboard_id') — getColumns() meta relasi di-key by nama relasi,
        // bukan nama kolom FK fisik (lihat DashboardController::quickList()
        // pola yang sama). Kolom SQL asli utk GROUP BY tetap FK fisiknya.
        $sqlColumn = $groupField;
        if (($meta['type'] ?? null) === 'relation' && ! empty($meta['nameOfFunction'])) {
            $sqlColumn = (new $modelClass)->{$meta['nameOfFunction']}()->getForeignKeyName();
        }

        if (! Schema::hasColumn($table, $sqlColumn)) {
            return ['labels' => [], 'datasets' => []];
        }

        $query = $modelClass::query();
        (new FilterEvaluator($columns))->apply($query, $filters);

        $aggFunc  = $chart->group_by_type ?? 'count';
        $aggField = $aggFunc === 'count' ? '*' : $chart->aggregate_function_based_on;
        $alias    = 'agg_value';

        $selectRaw = match ($aggFunc) {
            'sum'     => "SUM({$aggField}) as {$alias}",
            'average' => "AVG({$aggField}) as {$alias}",
            default   => "COUNT(*) as {$alias}",
        };

        $rows = $query
            ->selectRaw("{$sqlColumn} as group_key, {$selectRaw}")
            ->groupBy($sqlColumn)
            ->orderByDesc($alias)
            ->when($chart->number_of_groups, fn ($q) => $q->limit($chart->number_of_groups))
            ->get();

        $labels = $this->resolveGroupLabels($rows->pluck('group_key')->all(), $meta, $checker);

        return [
            'labels'   => $labels,
            'datasets' => [['name' => $chart->chart_name, 'values' => $rows->pluck($alias)->map(fn ($v) => (float) $v)->all()]],
        ];
    }

    /**
     * Requirement 5.3: label relasi HANYA di-resolve kalau user punya
     * Select ke model relasinya — kalau tidak, nilai mentah (FK id) apa
     * adanya, TIDAK ada lookup ke model relasi sama sekali.
     *
     * Kolom `formStatus`/`formStatuses` (mis. `status`, JSON-array cast dari
     * enum FormStatus) ditangani TERPISAH: `GROUP BY` di getGroupByChartConfig()
     * mengelompokkan berdasar representasi JSON MENTAH per baris (mis.
     * `["draft"]`), bukan nilai status bersih — tanpa ini, label chart tampil
     * sebagai JSON mentah alih-alih "Draft". Dipetakan lewat `valueTrans`
     * milik kolom (metadata SAMA yang dipakai FE utk translate value biasa,
     * lihat getColumns() — utk `status` selalu `valueTrans: "status"`,
     * cocok dgn `FormStatus::label()`: `__("status.{value}")`).
     */
    private function resolveGroupLabels(array $rawKeys, ?array $columnMeta, PermissionChecker $checker): array {
        if (in_array($columnMeta['type'] ?? null, ['formStatus', 'formStatuses'], true) && ! empty($columnMeta['valueTrans'])) {
            return array_map(function ($k) use ($columnMeta) {
                if ($k === null) {
                    return 'Not Specified';
                }
                $decoded = json_decode((string) $k, true);
                $value   = is_array($decoded) ? ($decoded[0] ?? null) : $k;

                return $value !== null ? __("{$columnMeta['valueTrans']}.{$value}") : $k;
            }, $rawKeys);
        }

        if (($columnMeta['type'] ?? null) !== 'relation' || empty($columnMeta['related'])) {
            return array_map(fn ($k) => $k ?? 'Not Specified', $rawKeys);
        }

        $related = $columnMeta['related'];
        if (! $checker->can($related, Permission::Select)) {
            return array_map(fn ($k) => $k ?? 'Not Specified', $rawKeys);
        }

        if (! class_exists($related)) {
            return array_map(fn ($k) => $k ?? 'Not Specified', $rawKeys);
        }

        // Heuristik title field: templateLink() model relasi berbentuk ':field'
        // sederhana (mis. ':title', ':label') -> field itu dipakai sbg label.
        // Template majemuk (mis. Widget lama '<title>:name (:type)...') tidak
        // cocok pola ini, fallback ke id mentah (degradasi wajar, bukan bug).
        $template   = method_exists($related, 'templateLink') ? $related::templateLink() : null;
        $titleField = (is_string($template) && preg_match('/^:(\w+)$/', $template, $m)) ? $m[1] : null;

        if (! $titleField) {
            return array_map(fn ($k) => $k ?? 'Not Specified', $rawKeys);
        }

        $rows = $related::query()->whereIn((new $related)->getKeyName(), array_filter($rawKeys))->pluck($titleField, (new $related)->getKeyName());

        return array_map(fn ($k) => $k === null ? 'Not Specified' : ($rows[$k] ?? $k), $rawKeys);
    }

    /**
     * Requirement 6: count per hari dalam `heatmap_year`.
     */
    private function getHeatmapChartConfig(Chart $chart, array $filters, ?int $year): array {
        $modelClass = $chart->model_class;
        if (! $modelClass || ! class_exists($modelClass)) {
            return [];
        }

        $year      = $year ?? $chart->heatmap_year ?? (int) now()->format('Y');
        $dateField = $chart->based_on ?: 'created_at';
        $table     = (new $modelClass)->getTable();
        if (! Schema::hasColumn($table, $dateField)) {
            return [];
        }

        $query   = $modelClass::query();
        $columns = collect($modelClass::getColumns(1))->keyBy('name')->all();
        (new FilterEvaluator($columns))->apply($query, $filters);

        $rows = $query
            ->whereBetween($dateField, ["{$year}-01-01 00:00:00", "{$year}-12-31 23:59:59"])
            ->selectRaw("DATE({$dateField}) as day, COUNT(*) as total")
            ->groupBy('day')
            ->pluck('total', 'day');

        return $rows->mapWithKeys(fn ($total, $day) => [strtotime($day) => (int) $total])->all();
    }

    /**
     * Requirement 4: pindah apa adanya dari `WidgetController::getChartData()`
     * lama — bucket per `time_interval` dalam rentang `timespan`.
     */
    private function getTimeSeriesChartConfig(Chart $chart, array $filters, array $config): array {
        $modelClass = $chart->model_class;
        if (! $modelClass || ! class_exists($modelClass)) {
            return [];
        }

        $startDate = $config['dateRange']['from'] ?? null;
        $endDate   = $config['dateRange']['to'] ?? null;
        $interval  = match ($chart->time_interval) {
            'daily', 'day' => 'day',
            'weekly', 'week' => 'week',
            'monthly', 'month' => 'month',
            'quarterly', 'quarter' => 'quarter',
            'yearly', 'year' => 'year',
            default => 'month',
        };
        $locale      = $config['locale'] ?? app()->getLocale();
        $timeBasedOn = $chart->based_on;

        $periodExpression = match ($interval) {
            'day'     => "DATE_FORMAT($timeBasedOn, '%Y-%m-%d')",
            'week'    => "DATE_FORMAT($timeBasedOn, '%x-%v')",
            'month'   => "DATE_FORMAT($timeBasedOn, '%Y-%m')",
            'quarter' => "CONCAT(DATE_FORMAT($timeBasedOn, '%Y'), '-Q', QUARTER($timeBasedOn))",
            'year'    => "DATE_FORMAT($timeBasedOn, '%Y')",
            default   => "DATE_FORMAT($timeBasedOn, '%Y-%m')",
        };
        $valueBasedOn = $chart->value_based_on;
        $query        = $modelClass::query();
        $columns      = collect($modelClass::getColumns(1))->keyBy('name')->all();
        (new FilterEvaluator($columns))->apply($query, $filters);

        $metricAlias = $chart->chart_source_type === 'average' ? 'average' : 'total';
        switch ($chart->chart_source_type) {
            case 'count':
                $query->selectRaw("{$periodExpression} as period, COUNT(*) as total");
                break;
            case 'sum':
                $query->selectRaw("{$periodExpression} as period, SUM($valueBasedOn) as total");
                break;
            case 'average':
                $query->selectRaw("{$periodExpression} as period, AVG($valueBasedOn) as average");
                break;
        }

        if ($startDate && $endDate) {
            $query->whereBetween($timeBasedOn, [$startDate, $endDate]);
        }
        $data = $query->groupBy('period')->orderBy('period')->get();

        $shouldFillEmptyPeriods = in_array((string) $chart->visual_type, ['bar', 'line'], true);
        $periodKeys             = $shouldFillEmptyPeriods
            ? $this->buildPeriodKeys($startDate, $endDate, $interval)
            : [];

        if ($periodKeys !== []) {
            $rowsByPeriod = $data->keyBy('period');
            $data         = collect($periodKeys)->map(function (string $periodKey) use ($rowsByPeriod, $interval, $locale, $metricAlias, $chart) {
                $row = $rowsByPeriod->get($periodKey);

                return [
                    'period'     => $this->formatPeriod($periodKey, $interval, $locale),
                    $metricAlias => $this->resolveMetricValue($row, $metricAlias, (string) $chart->chart_source_type),
                ];
            });
        } else {
            $data = $data->map(function ($row) use ($interval, $locale, $metricAlias, $chart) {
                return [
                    'period'     => $this->formatPeriod((string) $row->period, $interval, $locale),
                    $metricAlias => $this->resolveMetricValue($row, $metricAlias, (string) $chart->chart_source_type),
                ];
            });
        }

        return $data->all();
    }

    private function buildPeriodKeys(?string $startDate, ?string $endDate, string $interval): array {
        if (empty($startDate) || empty($endDate)) {
            return [];
        }

        try {
            $start = Carbon::parse($startDate);
            $end   = Carbon::parse($endDate);
        } catch (\Throwable) {
            return [];
        }

        if ($start->greaterThan($end)) {
            [$start, $end] = [$end, $start];
        }

        [$cursor, $rangeEnd] = match ($interval) {
            'day'     => [$start->copy()->startOfDay(), $end->copy()->endOfDay()],
            'week'    => [$start->copy()->startOfWeek(Carbon::MONDAY), $end->copy()->endOfWeek(Carbon::SUNDAY)],
            'month'   => [$start->copy()->startOfMonth(), $end->copy()->endOfMonth()],
            'quarter' => [$start->copy()->startOfQuarter(), $end->copy()->endOfQuarter()],
            'year'    => [$start->copy()->startOfYear(), $end->copy()->endOfYear()],
            default   => [$start->copy()->startOfMonth(), $end->copy()->endOfMonth()],
        };

        $periodKeys = [];

        while ($cursor->lessThanOrEqualTo($rangeEnd)) {
            $periodKeys[] = $this->resolvePeriodKey($cursor, $interval);
            $cursor       = match ($interval) {
                'day'     => $cursor->copy()->addDay(),
                'week'    => $cursor->copy()->addWeek(),
                'month'   => $cursor->copy()->addMonthNoOverflow(),
                'quarter' => $cursor->copy()->addQuarterNoOverflow(),
                'year'    => $cursor->copy()->addYear(),
                default   => $cursor->copy()->addMonthNoOverflow(),
            };
        }

        return array_values(array_unique($periodKeys));
    }

    private function resolvePeriodKey(Carbon $date, string $interval): string {
        return match ($interval) {
            'day'     => $date->format('Y-m-d'),
            'week'    => $date->format('o-W'),
            'month'   => $date->format('Y-m'),
            'quarter' => "{$date->format('Y')}-Q{$date->quarter}",
            'year'    => $date->format('Y'),
            default   => $date->format('Y-m'),
        };
    }

    private function resolveMetricValue(?object $row, string $metricAlias, string $chartSourceType): int|float {
        if ($row === null) {
            return 0;
        }

        $metricValue = $row->{$metricAlias} ?? null;

        if (! is_numeric($metricValue)) {
            return 0;
        }

        if ($chartSourceType === 'count') {
            return (int) $metricValue;
        }

        return (float) $metricValue;
    }

    private function formatPeriod(string $period, string $interval, string $locale): string {
        try {
            return match ($interval) {
                'day'     => Carbon::createFromFormat('Y-m-d', $period)->locale($locale)->translatedFormat('d M Y'),
                'week'    => $this->formatWeekPeriod($period, $locale),
                'month'   => Carbon::createFromFormat('Y-m', $period)->locale($locale)->translatedFormat('M Y'),
                'quarter' => $this->formatQuarterPeriod($period, $locale),
                'year'    => Carbon::createFromFormat('Y', $period)->locale($locale)->translatedFormat('Y'),
                default   => $period,
            };
        } catch (\Throwable) {
            return $period;
        }
    }

    private function formatWeekPeriod(string $period, string $locale): string {
        [$year, $week] = array_pad(explode('-', $period), 2, null);

        if ($year === null || $week === null) {
            return $period;
        }

        $startOfWeek = Carbon::now()->setISODate((int) $year, (int) $week)->locale($locale)->startOfWeek();
        $endOfWeek   = (clone $startOfWeek)->endOfWeek();

        return "{$startOfWeek->translatedFormat('d M')} - {$endOfWeek->translatedFormat('d M Y')}";
    }

    private function formatQuarterPeriod(string $period, string $locale): string {
        if (! str_contains($period, '-Q')) {
            return $period;
        }

        [$year, $quarter] = explode('-Q', $period);
        $quarter          = (int) $quarter;

        if ($quarter < 1 || $quarter > 4) {
            return $period;
        }

        return "Q{$quarter} {$year}";
    }
}
