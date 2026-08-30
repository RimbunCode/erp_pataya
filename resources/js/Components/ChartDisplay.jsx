import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Label,
  LabelList,
  Line,
  LineChart,
  Pie,
  PieChart,
  Sector,
  XAxis,
  YAxis,
} from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "./ui/chart";
import React, { useEffect } from "react";

import LoadingIcon from "@/Components/LoadingIcon";
import axios from "axios";
import { formatNumber } from "@/lib/numberFormat";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { usePage } from "@inertiajs/react";

// Feedback user: split dari DashboardChart.jsx — Chart tetap pakai recharts
// (line/bar/pie/donut), Number Card (tanpa recharts) dipisah ke
// NumberCardDisplay.jsx. Data BUKAN lagi dari `widget`/`get-chart`, tapi
// `chart`/`charts.getData` — response shape beda tergantung
// chart_source_type: time-series [{period,total|average}], group_by
// {labels,datasets}, heatmap {timestampSecond: count}.
function ChartDisplay({ chart, filters = {} }) {
  const { currentLocale } = useLaravelReactI18n();
  const { preferences } = usePage().props;
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);
  const [activePeriod, setActivePeriod] = React.useState(null);

  const isGroupBy = chart.chart_source_type === "group_by";
  const isHeatmap = chart.visual_type === "heatmap";
  const metricKey = chart.chart_source_type === "average" ? "average" : "total";

  const palette = React.useMemo(
    () => ["#2563eb", "#16a34a", "#f97316", "#a855f7", "#e11d48", "#0ea5e9"],
    [],
  );

  const reload = React.useCallback(() => {
    setLoading(true);
    setError(false);
    axios
      .post(route("charts.getData", chart.id), { filters, config: {} })
      .then((res) => {
        setData(res.data ?? null);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [chart.id, JSON.stringify(filters)]);

  useEffect(() => {
    reload();
  }, [reload]);

  const seriesData = React.useMemo(() => {
    if (!data || isGroupBy || isHeatmap) return [];
    return Array.isArray(data) ? data : [];
  }, [data, isGroupBy, isHeatmap]);

  useEffect(() => {
    if (isGroupBy && data?.labels?.length) setActivePeriod(data.labels[0]);
    else if (seriesData.length) setActivePeriod(seriesData[0].period);
  }, [data, seriesData, isGroupBy]);

  const groupByRows = React.useMemo(() => {
    if (!isGroupBy || !data?.labels) return [];
    const values = data.datasets?.[0]?.values ?? [];
    return data.labels.map((label, i) => ({
      period: label,
      [metricKey]: values[i] ?? 0,
    }));
  }, [data, isGroupBy, metricKey]);

  const chartData = isGroupBy ? groupByRows : seriesData;

  const chartConfig = React.useMemo(
    () => ({
      [metricKey]: {
        label: chart.chart_name,
        color: chart?.color || palette[4],
      },
    }),
    [metricKey, chart.chart_name, chart?.color, palette],
  );

  const activeIndex = React.useMemo(
    () => chartData.findIndex((item) => item.period === activePeriod),
    [chartData, activePeriod],
  );

  const renderActiveShape = (props) => {
    const { outerRadius = 0, ...rest } = props;
    return <Sector {...rest} outerRadius={outerRadius + 8} />;
  };

  // chart-compact-number-display: mode full DELEGASI ke NumberInput/
  // formatNumber via preferences.default_number_format (sumber tunggal
  // "angka penuh" yang SUDAH dipakai Table2/PrintTemplate di seluruh app —
  // BUKAN toLocaleString(locale) buatan sendiri). Mode compact tetap baru,
  // locale-nya ikut lang AKTIF APP (currentLocale()) krn kata singkatan
  // ("jt"/"rb" vs "K"/"M") itu soal bahasa, beda sumbu dari pattern
  // pemisah desimal company. Lihat lib/numberFormat.js.
  const fmt = (value) =>
    formatNumber(value, {
      full: chart.show_full_number,
      locale: currentLocale(),
      numberFormat: preferences?.default_number_format,
    });

  // Replikasi markup default ChartTooltipContent (indicator dot + label +
  // value, lihat ui/chart.jsx) TAPI dengan value via fmt() — TIDAK boleh
  // cuma `return fmt(value)`, itu akan menghapus indicator dot & label.
  const tooltipFormatter = (value, name, item) => {
    const indicatorColor = item.payload?.fill || item.color;
    return (
      <>
        <div
          className="h-2.5 w-2.5 shrink-0 rounded-md border-[--color-border] bg-[--color-bg]"
          style={{
            "--color-bg": indicatorColor,
            "--color-border": indicatorColor,
          }}
        />
        <div className="flex flex-1 items-center justify-between leading-none">
          <span className="text-muted-foreground">{name}</span>
          <span className="font-mono font-medium tabular-nums text-foreground">
            {fmt(value)}
          </span>
        </div>
      </>
    );
  };

  const renderChart = () => {
    switch (chart.visual_type) {
      case "line":
        return (
          <LineChart accessibilityLayer data={chartData}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="period" tickLine tickMargin={10} axisLine />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={fmt}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  nameKey="period"
                  formatter={tooltipFormatter}
                />
              }
            />
            <Line
              type="monotone"
              dataKey={metricKey}
              stroke={chartConfig[metricKey].color}
              strokeWidth={3}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        );
      case "pie":
      case "donut": {
        const safeIndex = activeIndex >= 0 ? activeIndex : 0;
        const activeItem = chartData[safeIndex];
        const isDonut = chart.visual_type === "donut";
        return (
          <PieChart>
            <ChartTooltip
              content={
                <ChartTooltipContent
                  nameKey="period"
                  hideLabel
                  formatter={tooltipFormatter}
                />
              }
            />
            <Pie
              data={chartData}
              dataKey={metricKey}
              nameKey="period"
              cx="50%"
              cy="50%"
              innerRadius={isDonut ? 60 : 0}
              outerRadius={80}
              paddingAngle={3}
              strokeWidth={0}
              activeIndex={safeIndex}
              activeShape={renderActiveShape}
              onMouseEnter={(_, index) =>
                chartData[index]?.period &&
                setActivePeriod(chartData[index].period)
              }
            >
              {chartData.map((_entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={palette[index % palette.length]}
                />
              ))}
              {!isDonut && (
                <LabelList
                  dataKey="period"
                  className="fill-background"
                  stroke="none"
                  fontSize={12}
                />
              )}
              {isDonut && (
                <Label
                  content={({ viewBox }) => {
                    if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                      return (
                        <text
                          x={viewBox.cx}
                          y={viewBox.cy}
                          textAnchor="middle"
                          dominantBaseline="middle"
                        >
                          <tspan
                            x={viewBox.cx}
                            y={viewBox.cy}
                            className="fill-foreground text-xl font-bold"
                          >
                            {fmt(activeItem?.[metricKey] ?? 0)}
                          </tspan>
                          <tspan
                            x={viewBox.cx}
                            y={(viewBox.cy || 0) + 24}
                            className="fill-muted-foreground text-sm"
                          >
                            {activeItem?.period ?? ""}
                          </tspan>
                        </text>
                      );
                    }
                  }}
                />
              )}
            </Pie>
          </PieChart>
        );
      }
      default:
        return (
          <BarChart accessibilityLayer data={chartData}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="period" tickLine tickMargin={10} axisLine />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={fmt}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  nameKey="period"
                  formatter={tooltipFormatter}
                />
              }
            />
            <Bar
              dataKey={metricKey}
              name={chartConfig[metricKey].label}
              fill={chartConfig[metricKey].color}
              radius={4}
            />
          </BarChart>
        );
    }
  };

  return (
    <div>
      <h3 className="text-2xl font-semibold w-full pb-4">{chart.chart_name}</h3>

      {loading ? (
        <div className="flex h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
          <LoadingIcon className="size-4" />
          <span>Memuat data...</span>
        </div>
      ) : error ? (
        <div className="flex h-40 items-center justify-center text-sm text-destructive">
          Gagal memuat data.
        </div>
      ) : isHeatmap ? (
        <HeatmapCalendar
          data={data ?? {}}
          color={chart?.color || palette[4]}
          year={chart?.heatmap_year}
        />
      ) : (
        <ChartContainer className="w-full h-72" config={chartConfig}>
          {renderChart()}
        </ChartContainer>
      )}
    </div>
  );
}

// Kalender heatmap ala GitHub-contributions — recharts TIDAK punya primitive
// ini (Requirement 6.3), jadi grid SVG manual: kolom = minggu, baris = hari.
function HeatmapCalendar({ data, color, year }) {
  const targetYear = year || new Date().getFullYear();
  const start = new Date(targetYear, 0, 1);
  const end = new Date(targetYear, 11, 31);

  const days = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    days.push(new Date(d));
  }

  const maxCount = Math.max(
    1,
    ...Object.values(data).map((v) => Number(v) || 0),
  );
  const cellSize = 12;
  const gap = 3;
  const firstDayOffset = start.getDay();

  const opacityFor = (count) => {
    if (!count) return 0.08;
    return 0.25 + 0.75 * Math.min(1, count / maxCount);
  };

  const weeks = Math.ceil((days.length + firstDayOffset) / 7);

  return (
    <div className="overflow-x-auto">
      <svg
        width={weeks * (cellSize + gap) + gap}
        height={7 * (cellSize + gap) + gap}
        role="img"
        aria-label={`Heatmap ${targetYear}`}
      >
        {days.map((day, i) => {
          const index = i + firstDayOffset;
          const week = Math.floor(index / 7);
          const dow = index % 7;
          // Backend hitung key via PHP strtotime('Y-m-d') di timezone server
          // (APP_TIMEZONE=UTC) — pakai Date.UTC (bukan waktu lokal browser)
          // supaya batas hari cocok persis, tidak geser di timezone non-UTC.
          const key =
            Date.UTC(day.getFullYear(), day.getMonth(), day.getDate()) / 1000;
          const count = data[key] ?? 0;
          return (
            <rect
              key={i}
              x={week * (cellSize + gap) + gap}
              y={dow * (cellSize + gap) + gap}
              width={cellSize}
              height={cellSize}
              rx={2}
              fill={color}
              opacity={opacityFor(count)}
            >
              <title>{`${day.toLocaleDateString()}: ${count}`}</title>
            </rect>
          );
        })}
      </svg>
    </div>
  );
}

export default ChartDisplay;
