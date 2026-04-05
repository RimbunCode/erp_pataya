import React, { useEffect } from "react";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "./ui/chart";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Separator } from "./ui/separator";
import { ArrowDownRight, ArrowUpRight, FilterIcon } from "lucide-react";
import DatetimePicker from "./DatetimePicker";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  Cell,
  Label,
  Sector,
  LabelList,
} from "recharts";
import axios from "axios";
import Select from "./Select";
import { useLaravelReactI18n } from "laravel-react-i18n";

function DashboardChart({ widget }) {
  const { t } = useLaravelReactI18n();
  const [data, setData] = React.useState([]);
  const [activePeriod, setActivePeriod] = React.useState(null);

  useEffect(() => {
    if (data?.length) setActivePeriod(data[0].period);
  }, [data]);

  const activeIndex = React.useMemo(
    () => data.findIndex((item) => item.period === activePeriod),
    [data, activePeriod],
  );

  const renderActiveShape = (props) => {
    const { outerRadius = 0, ...rest } = props;
    return <Sector {...rest} outerRadius={outerRadius + 8} />;
  };

  const palette = React.useMemo(
    () => ["#2563eb", "#16a34a", "#f97316", "#a855f7", "#e11d48", "#0ea5e9"],
    [],
  );

  const metricKey = widget.calculation_type === "average" ? "average" : "total";

  const metricLabel =
    widget.value_based_on ||
    widget.calculation_type ||
    t("settings.widget.columns.value_based_on");

  const chartConfig = React.useMemo(
    () => ({
      [metricKey]: {
        label: metricLabel,
        color: widget?.config?.color || palette[4],
      },
    }),
    [metricKey, metricLabel, palette, widget?.config?.color],
  );

  const getDateRange = (timespan) => {
    const now = new Date();
    const start = new Date(now);
    const end = new Date(now);

    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    switch (timespan) {
      case "last_week": {
        const currentWeekStart = new Date(now);
        const dayOffset = (currentWeekStart.getDay() + 6) % 7;

        currentWeekStart.setDate(currentWeekStart.getDate() - dayOffset);
        currentWeekStart.setHours(0, 0, 0, 0);

        start.setTime(currentWeekStart.getTime());
        start.setDate(start.getDate() - 7);

        end.setTime(currentWeekStart.getTime());
        end.setMilliseconds(-1);
        break;
      }

      case "last_month": {
        start.setFullYear(now.getFullYear(), now.getMonth() - 1, 1);
        end.setFullYear(now.getFullYear(), now.getMonth(), 0);
        break;
      }

      case "last_quarter": {
        const quarterMonth = Math.floor(now.getMonth() / 3) * 3;

        start.setFullYear(now.getFullYear(), quarterMonth - 3, 1);
        end.setFullYear(now.getFullYear(), quarterMonth, 0);
        break;
      }

      case "last_year": {
        start.setMonth(now.getMonth() - 11, 1);
        break;
      }
      default:
        return null;
    }

    return { from: start, to: end };
  };
  const initialTimespan = widget.timespan ?? "last_month";

  const [config, setConfig] = React.useState({
    timespan: initialTimespan,
    dateRange: getDateRange(initialTimespan),
  });

  const canLoad =
    !!widget.time_based_on &&
    !!config?.dateRange?.from &&
    !!config?.dateRange?.to;

  const isMonthlyInterval = ["monthly", "month"].includes(
    widget?.time_interval,
  );

  const xAxisProps = isMonthlyInterval
    ? {
        interval: 0,
        angle: -35,
        textAnchor: "end",
        height: 70,
        minTickGap: 0,
      }
    : {
        interval: "preserveStartEnd",
      };

  const formatDateTimeForRequest = (date) => {
    if (!(date instanceof Date)) {
      return date;
    }

    const pad = (value) => String(value).padStart(2, "0");

    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  };

  const normalizeDateRangeForRequest = (dateRange) => {
    if (!dateRange?.from || !dateRange?.to) {
      return dateRange;
    }

    return {
      from: formatDateTimeForRequest(dateRange.from),
      to: formatDateTimeForRequest(dateRange.to),
    };
  };

  const reloadData = () => {
    if (!canLoad) {
      return;
    }

    const requestConfig = {
      ...config,
      dateRange: normalizeDateRangeForRequest(config.dateRange),
    };

    axios
      .post(route("get-chart", widget.id), {
        config: requestConfig,
      })
      .then((res) => {
        console.log(res.data);
        setData(res.data ?? []);
      })
      .catch((err) => {
        console.log(err);
      });
  };

  useEffect(() => {
    const refresh = setTimeout(() => {
      reloadData();
    }, 500);
    return () => {
      clearTimeout(refresh);
    };
  }, [config, canLoad]);

  const aggregatedValue = React.useMemo(() => {
    if (!data?.length) {
      return 0;
    }

    const values = data
      .map((item) => Number(item?.[metricKey]) || 0)
      .filter((value) => !Number.isNaN(value));

    if (widget.calculation_type === "average") {
      const total = values.reduce((acc, value) => acc + value, 0);

      return values.length ? total / values.length : 0;
    }

    return values.reduce((acc, value) => acc + value, 0);
  }, [data, metricKey, widget.calculation_type]);

  const formatNumber = (value) =>
    Number(value ?? 0).toLocaleString(undefined, {
      maximumFractionDigits: 2,
    });

  const latestMetricValue = React.useMemo(() => {
    if (!data?.length) {
      return 0;
    }

    return Number(data[data.length - 1]?.[metricKey]) || 0;
  }, [data, metricKey]);

  const previousMetricValue = React.useMemo(() => {
    if (!data?.length || data.length < 2) {
      return 0;
    }

    return Number(data[data.length - 2]?.[metricKey]) || 0;
  }, [data, metricKey]);

  const metricDeltaPercentage = React.useMemo(() => {
    if (previousMetricValue === 0) {
      if (latestMetricValue === 0) {
        return 0;
      }

      return latestMetricValue > 0 ? 100 : -100;
    }

    return (
      ((latestMetricValue - previousMetricValue) /
        Math.abs(previousMetricValue)) *
      100
    );
  }, [latestMetricValue, previousMetricValue]);

  const isPositiveTrend = metricDeltaPercentage >= 0;
  const trendBadgeClass = isPositiveTrend
    ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
    : "bg-rose-500/10 text-rose-600 border border-rose-500/20";

  const comparisonPeriodLabel =
    data?.length >= 2
      ? data[data.length - 2]?.period
      : t("settings.widget.timespans.last_month");

  const renderTooltip = () => (
    <ChartTooltip
      wrapperClassName="bg-background! border-none! rounded-md"
      content={
        <ChartTooltipContent
          color={chartConfig[metricKey].color}
          formatter={(value, _name, item) => {
            const color = item?.payload?.fill || chartConfig[metricKey].color;

            return (
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                  style={{
                    backgroundColor: color,
                  }}
                />
                <span className="text-xs font-medium" style={{ color }}>
                  {item?.payload?.period || chartConfig[metricKey].label}
                </span>
                <span
                  className="font-mono font-semibold tabular-nums text-xs"
                  style={{ color }}
                >
                  {formatNumber(value)}
                </span>
              </div>
            );
          }}
        />
      }
    />
  );

  const renderChart = () => {
    switch (widget.type) {
      case "line":
        return (
          <LineChart accessibilityLayer data={data}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="period"
              tickLine={true}
              tickMargin={10}
              axisLine={true}
              {...xAxisProps}
            />
            {renderTooltip()}
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
      case "pie": {
        const safeIndex = activeIndex >= 0 ? activeIndex : 0;

        return (
          <PieChart>
            <ChartTooltip
              content={<ChartTooltipContent nameKey="period" hideLabel />}
            />
            <Pie
              data={data}
              dataKey={metricKey}
              nameKey="period"
              cx="50%"
              cy="50%"
              innerRadius={widget.type === "pie" ? 0 : 60}
              outerRadius={80}
              paddingAngle={3}
              strokeWidth={0}
              activeIndex={safeIndex}
              activeShape={renderActiveShape}
              onMouseEnter={(_, index) =>
                data[index]?.period && setActivePeriod(data[index].period)
              }
            >
              {data.map((_entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={palette[index % palette.length]}
                />
              ))}
              {widget.type === "pie" && (
                <LabelList
                  dataKey="period"
                  className="fill-background"
                  stroke="none"
                  fontSize={12}
                  formatter={(value) =>
                    chartConfig[value]?.label ? chartConfig[value].label : value
                  }
                />
              )}
            </Pie>
          </PieChart>
        );
      }
      case "doughnut": {
        const safeIndex = activeIndex >= 0 ? activeIndex : 0;
        const activeItem = data[safeIndex];

        return (
          <PieChart>
            <ChartTooltip
              content={<ChartTooltipContent nameKey="period" hideLabel />}
            />
            <Pie
              data={data}
              dataKey={metricKey}
              nameKey="period"
              cx="50%"
              cy="50%"
              innerRadius={widget.type === "pie" ? 0 : 60}
              outerRadius={80}
              paddingAngle={3}
              strokeWidth={0}
              activeIndex={safeIndex}
              activeShape={renderActiveShape}
              onMouseEnter={(_, index) =>
                data[index]?.period && setActivePeriod(data[index].period)
              }
            >
              {data.map((_entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={palette[index % palette.length]}
                />
              ))}
              {widget.type === "pie" && (
                <LabelList
                  dataKey="period"
                  className="fill-background"
                  stroke="none"
                  fontSize={12}
                  formatter={(value) =>
                    chartConfig[value]?.label ? chartConfig[value].label : value
                  }
                />
              )}
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
                          {formatNumber(activeItem?.[metricKey] ?? 0)}
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
            </Pie>
          </PieChart>
        );
      }
      default:
        return (
          <BarChart accessibilityLayer data={data}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="period"
              tickLine={true}
              tickMargin={10}
              axisLine={true}
              {...xAxisProps}
            />
            <ChartTooltip
              wrapperClassName="bg-background! border-none! rounded-md"
              content={
                <ChartTooltipContent
                  color={chartConfig[metricKey].color}
                  formatter={(value) => (
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                        style={{
                          backgroundColor: chartConfig[metricKey].color,
                        }}
                      />
                      <span
                        className="text-xs font-medium"
                        style={{ color: chartConfig[metricKey].color }}
                      >
                        {chartConfig[metricKey].label}
                      </span>
                      <span
                        className="font-mono font-semibold tabular-nums text-xs"
                        style={{ color: chartConfig[metricKey].color }}
                      >
                        {Number(value).toLocaleString()}
                      </span>
                    </div>
                  )}
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

  const isCard = widget.type === "card";
  const timespanOptions = [
    "last_week",
    "last_month",
    "last_quarter",
    "last_year",
    "custom",
  ];

  const handleTimespanChange = (val) => {
    setConfig((prev) => ({
      ...prev,
      timespan: val,
      dateRange:
        val === "custom" ? null : (getDateRange(val) ?? prev.dateRange),
    }));
  };

  return (
    <div>
      {!isCard && (
        <div className="flex items-center pb-4 gap-4 justify-between">
          <h3 className="text-2xl font-semibold w-full">{widget.title}</h3>
          <div className="flex items-center pb-4 gap-4 justify-end">
            <Button variant="outline">
              <FilterIcon />
            </Button>
            <Select
              value={config?.timespan}
              onValueChange={handleTimespanChange}
              optionTrans="settings.widget.timespans"
              options={timespanOptions}
            />
            {config.timespan === "custom" && (
              <DatetimePicker
                type="daterange"
                value={config.dateRange}
                onValueChange={(val) =>
                  setConfig((prev) => ({ ...prev, dateRange: val }))
                }
              />
            )}
          </div>
        </div>
      )}
      {isCard ? (
        <Card className="w-full rounded-xl border bg-card shadow-sm">
          <CardContent className="flex flex-col gap-5 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h3 className="text-muted-foreground text-sm font-medium">
                {widget.title}
              </h3>
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={config?.timespan}
                  onValueChange={handleTimespanChange}
                  optionTrans="settings.widget.timespans"
                  options={timespanOptions}
                />
                {config.timespan === "custom" && (
                  <DatetimePicker
                    type="daterange"
                    value={config.dateRange}
                    onValueChange={(val) =>
                      setConfig((prev) => ({ ...prev, dateRange: val }))
                    }
                  />
                )}
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center gap-2.5">
                <span className="text-foreground text-2xl font-medium tracking-tight tabular-nums">
                  {formatNumber(aggregatedValue)}
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${trendBadgeClass}`}
                >
                  {isPositiveTrend ? (
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  ) : (
                    <ArrowDownRight className="h-3.5 w-3.5" />
                  )}
                  {Math.abs(metricDeltaPercentage).toFixed(1)}%
                </span>
              </div>

              <Separator />

              <div className="text-muted-foreground text-xs">
                Vs previous period:{" "}
                <span className="text-foreground font-medium tabular-nums">
                  {formatNumber(previousMetricValue)} ({comparisonPeriodLabel})
                </span>
              </div>
            </div>

            {!canLoad && (
              <div className="text-xs text-muted-foreground">
                {t("settings.widget.columns.time_based_on")} belum diatur.
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <ChartContainer className="w-full h-72" config={chartConfig}>
          {renderChart()}
        </ChartContainer>
      )}
    </div>
  );
}

export default DashboardChart;
