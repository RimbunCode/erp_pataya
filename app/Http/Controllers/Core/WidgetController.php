<?php

namespace App\Http\Controllers\Core;

use App\Http\Controllers\Controller;
use App\Http\Requests\Core\WidgetRequest;
use App\Models\Core\Widget;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class WidgetController extends Controller {
    public function __construct(Request $request) {
        parent::__construct($request, Widget::class);
    }

    protected function enforcePermission(string $method): ?string {
        return match ($method) {
            'getChartData' => 'select',
            default        => null,
        };
    }

    /**
     * Display a listing of the resource.
     */
    public function index(Request $request) {
        $this->setBreadcrumbs();
        Widget::dataTable($request);

        return Inertia::render(
            'Settings/Widget/Index',
        );
    }

    /**
     * Show the form for creating a new resource.
     */
    public function getChartData(Request $request, Widget $widget): JsonResponse {
        $model     = $widget->model_class;
        $config    = $request->config;
        $startDate = $config['dateRange']['from'];
        $endDate   = $config['dateRange']['to'];
        $interval  = match ($widget->time_interval ?? $request->input('time_interval')) {
            'daily', 'day' => 'day',
            'weekly', 'week' => 'week',
            'monthly', 'month' => 'month',
            'quarterly', 'quarter' => 'quarter',
            'yearly', 'year' => 'year',
            default => 'month',
        };
        $locale      = $request->user()?->locale ?? app()->getLocale();
        $timeBasedOn = $widget->time_based_on;

        $periodExpression = match ($interval) {
            'day'     => "DATE_FORMAT($timeBasedOn, '%Y-%m-%d')",
            'week'    => "DATE_FORMAT($timeBasedOn, '%x-%v')",
            'month'   => "DATE_FORMAT($timeBasedOn, '%Y-%m')",
            'quarter' => "CONCAT(DATE_FORMAT($timeBasedOn, '%Y'), '-Q', QUARTER($timeBasedOn))",
            'year'    => "DATE_FORMAT($timeBasedOn, '%Y')",
            default   => "DATE_FORMAT($timeBasedOn, '%Y-%m')",
        };
        $valueBasedOn = $widget->value_based_on;
        $query        = $model::query();
        $metricAlias  = $widget->calculation_type === 'average' ? 'average' : 'total';
        switch ($widget->calculation_type) {
            case 'count':
                $query->selectRaw("{$periodExpression} as period, COUNT(*) as total");
                break;
            case 'sum':
                $query->selectRaw("{$periodExpression} as period, SUM($valueBasedOn) as total");
                break;
            case 'average':
                $query->selectRaw("{$periodExpression} as period, AVG($valueBasedOn) as average");
                break;
            case 'group_by':
                $query->selectRaw("{$periodExpression} as period, COUNT(*) as total");
                break;
        }

        if ($startDate && $endDate) {
            $query->whereBetween($timeBasedOn, [$startDate, $endDate]);
        }
        $data = $query
            ->groupBy('period')
            ->orderBy('period')
            ->get();

        $shouldFillEmptyPeriods = in_array((string) $widget->type, ['bar', 'line'], true);
        $periodKeys             = $shouldFillEmptyPeriods
          ? $this->buildPeriodKeys($startDate, $endDate, $interval)
          : [];

        if ($periodKeys !== []) {
            $rowsByPeriod = $data->keyBy('period');
            $data         = collect($periodKeys)->map(function (string $periodKey) use ($rowsByPeriod, $interval, $locale, $metricAlias, $widget) {
                $row = $rowsByPeriod->get($periodKey);

                return [
                    'period'     => $this->formatPeriod($periodKey, $interval, $locale),
                    $metricAlias => $this->resolveMetricValue($row, $metricAlias, (string) $widget->calculation_type),
                ];
            });
        } else {
            $data = $data->map(function ($row) use ($interval, $locale, $metricAlias, $widget) {
                return [
                    'period'     => $this->formatPeriod((string) $row->period, $interval, $locale),
                    $metricAlias => $this->resolveMetricValue($row, $metricAlias, (string) $widget->calculation_type),
                ];
            });
        }

        return response()->json($data);
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

    private function resolveMetricValue(?object $row, string $metricAlias, string $calculationType): int|float {
        if ($row === null) {
            return 0;
        }

        $metricValue = $row->{$metricAlias} ?? null;

        if (! is_numeric($metricValue)) {
            return 0;
        }

        if (in_array($calculationType, ['count', 'group_by'], true)) {
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

    public function create() {
        $this->setBreadcrumbs();

        return Inertia::render('Settings/Widget/Show');
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(WidgetRequest $request) {
        $data = $request->validated();
        DB::beginTransaction();
        $data['model_id']      = $data['model']['id'];
        $data['model_class']   = $data['model']['model'];
        $data['created_by_id'] = $request->user()->id;
        $widget                = Widget::create($data);
        $widget->logForCreated();
        DB::commit();

        return redirect()->back()->with('id', $widget->id);
    }

    /**
     * Display the specified resource.
     */
    public function show(Widget $widget) {
        $this->setBreadcrumbs($widget);
        $widget->showDetail();

        return Inertia::render('Settings/Widget/Show', [
            'widget' => function () use ($widget) {
                $widget->loadRelations();

                return $widget;
            },
        ]);
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(Widget $widget) {
        //
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(WidgetRequest $request, Widget $widget) {
        $data = $request->validated();
        DB::beginTransaction();
        $data['model_id']      = $data['model']['id'];
        $data['model_class']   = $data['model']['model'];
        $data['created_by_id'] = $request->user()->id;
        $widget->fillForUpdate($data);
        $widget->logForUpdated();
        DB::commit();

        return redirect()->back();
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Widget $widget) {
        DB::beginTransaction();
        $widget->logForDeleted();
        $widget->delete();
        DB::commit();

        return redirect()->back();
    }
}
