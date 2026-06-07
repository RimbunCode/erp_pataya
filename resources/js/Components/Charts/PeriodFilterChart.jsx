import { useMemo, useState } from "react";
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    XAxis,
    YAxis,
} from "recharts";
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    ChartLegend,
    ChartLegendContent,
} from "@/Components/ui/chart";
import {
    format,
    parseISO,
    startOfWeek,
    startOfMonth,
    startOfYear,
    eachDayOfInterval,
    eachWeekOfInterval,
    eachMonthOfInterval,
    subDays,
    subMonths,
    subYears,
} from "date-fns";
import { id } from "date-fns/locale";

const PERIODS = [
    { key: "weekly", label: "Mingguan" },
    { key: "monthly", label: "Bulanan" },
    { key: "yearly", label: "Tahunan" },
];

function aggregateData(rawPoints, period, dataKeys) {
    const now = new Date();
    let buckets = [];
    let groupFn;
    let labelFn;
    let range;

    if (period === "weekly") {
        const start = subDays(now, 27);
        range = eachWeekOfInterval({ start, end: now }, { weekStartsOn: 1 });
        groupFn = (d) => format(startOfWeek(d, { weekStartsOn: 1 }), "yyyy-MM-dd");
        labelFn = (key) => {
            const d = parseISO(key);
            return format(d, "dd MMM", { locale: id });
        };
        buckets = range.map((w) => format(w, "yyyy-MM-dd"));
    } else if (period === "monthly") {
        const start = subMonths(now, 11);
        range = eachMonthOfInterval({ start, end: now });
        groupFn = (d) => format(startOfMonth(d), "yyyy-MM");
        labelFn = (key) => format(parseISO(key + "-01"), "MMM yyyy", { locale: id });
        buckets = range.map((m) => format(m, "yyyy-MM"));
    } else {
        const start = subYears(now, 4);
        range = eachMonthOfInterval({ start, end: now })
            .filter((m) => m.getMonth() === 0)
            .concat([startOfYear(now)]);
        const years = [];
        for (let y = now.getFullYear() - 4; y <= now.getFullYear(); y++) {
            years.push(String(y));
        }
        groupFn = (d) => String(d.getFullYear());
        labelFn = (key) => key;
        buckets = years;
    }

    const grouped = {};
    buckets.forEach((b) => {
        grouped[b] = {};
        dataKeys.forEach((dk) => {
            grouped[b][dk.key] = 0;
        });
    });

    (rawPoints ?? []).forEach((point) => {
        if (!point.date) return;
        const d = parseISO(point.date);
        const bucketKey = groupFn(d);
        if (!(bucketKey in grouped)) return;
        dataKeys.forEach((dk) => {
            const val = Number(point[dk.key] ?? 0);
            grouped[bucketKey][dk.key] = (grouped[bucketKey][dk.key] ?? 0) + val;
        });
    });

    return buckets.map((b) => ({
        label: labelFn(b),
        ...grouped[b],
    }));
}

export default function PeriodFilterChart({
    title,
    rawData = [],
    dataKeys = [],
    chartConfig = {},
    type = "area",
    formatValue,
    className = "",
    height = 220,
}) {
    const [period, setPeriod] = useState("monthly");

    const chartData = useMemo(
        () => aggregateData(rawData, period, dataKeys),
        [rawData, period, dataKeys],
    );

    const hasData = chartData.some((row) =>
        dataKeys.some((dk) => Number(row[dk.key] ?? 0) > 0),
    );

    const tickFormatter = formatValue ?? ((v) => v.toLocaleString("id-ID"));

    return (
        <div className={`bg-card rounded-2xl border border-border shadow-sm p-6 ${className}`}>
            <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
                <h3 className="text-xs font-black tracking-widest text-foreground uppercase">
                    {title}
                </h3>
                <div className="flex items-center gap-1 bg-muted rounded-xl p-1">
                    {PERIODS.map((p) => (
                        <button
                            key={p.key}
                            type="button"
                            onClick={() => setPeriod(p.key)}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black tracking-widest uppercase transition-all ${
                                period === p.key
                                    ? "bg-background text-foreground shadow-sm border border-border"
                                    : "text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
            </div>

            {!hasData ? (
                <div
                    className="flex items-center justify-center text-muted-foreground text-xs font-medium"
                    style={{ height }}
                >
                    Belum ada data untuk periode ini
                </div>
            ) : (
                <ChartContainer config={chartConfig} className="w-full" style={{ height }}>
                    {type === "bar" ? (
                        <BarChart
                            data={chartData}
                            margin={{ top: 4, right: 4, left: -16, bottom: 0 }}
                        >
                            <CartesianGrid
                                strokeDasharray="3 3"
                                stroke="var(--border)"
                                vertical={false}
                            />
                            <XAxis
                                dataKey="label"
                                tick={{
                                    fontSize: 10,
                                    fill: "var(--muted-foreground)",
                                    fontWeight: 600,
                                }}
                                axisLine={false}
                                tickLine={false}
                                interval="preserveStartEnd"
                            />
                            <YAxis
                                tick={{
                                    fontSize: 10,
                                    fill: "var(--muted-foreground)",
                                    fontWeight: 600,
                                }}
                                axisLine={false}
                                tickLine={false}
                                tickFormatter={tickFormatter}
                            />
                            <ChartTooltip
                                content={
                                    <ChartTooltipContent
                                        formatter={
                                            formatValue
                                                ? (value) => formatValue(value)
                                                : undefined
                                        }
                                    />
                                }
                            />
                            {dataKeys.length > 1 && (
                                <ChartLegend content={<ChartLegendContent />} />
                            )}
                            {dataKeys.map((dk) => (
                                <Bar
                                    key={dk.key}
                                    dataKey={dk.key}
                                    fill={`var(--color-${dk.key})`}
                                    radius={[4, 4, 0, 0]}
                                    maxBarSize={48}
                                />
                            ))}
                        </BarChart>
                    ) : (
                        <AreaChart
                            data={chartData}
                            margin={{ top: 4, right: 4, left: -16, bottom: 0 }}
                        >
                            <defs>
                                {dataKeys.map((dk) => (
                                    <linearGradient
                                        key={dk.key}
                                        id={`grad-${dk.key}`}
                                        x1="0"
                                        y1="0"
                                        x2="0"
                                        y2="1"
                                    >
                                        <stop
                                            offset="5%"
                                            stopColor={`var(--color-${dk.key})`}
                                            stopOpacity={0.25}
                                        />
                                        <stop
                                            offset="95%"
                                            stopColor={`var(--color-${dk.key})`}
                                            stopOpacity={0.02}
                                        />
                                    </linearGradient>
                                ))}
                            </defs>
                            <CartesianGrid
                                strokeDasharray="3 3"
                                stroke="var(--border)"
                                vertical={false}
                            />
                            <XAxis
                                dataKey="label"
                                tick={{
                                    fontSize: 10,
                                    fill: "var(--muted-foreground)",
                                    fontWeight: 600,
                                }}
                                axisLine={false}
                                tickLine={false}
                                interval="preserveStartEnd"
                            />
                            <YAxis
                                tick={{
                                    fontSize: 10,
                                    fill: "var(--muted-foreground)",
                                    fontWeight: 600,
                                }}
                                axisLine={false}
                                tickLine={false}
                                tickFormatter={tickFormatter}
                            />
                            <ChartTooltip
                                content={
                                    <ChartTooltipContent
                                        formatter={
                                            formatValue
                                                ? (value) => formatValue(value)
                                                : undefined
                                        }
                                    />
                                }
                            />
                            {dataKeys.length > 1 && (
                                <ChartLegend content={<ChartLegendContent />} />
                            )}
                            {dataKeys.map((dk) => (
                                <Area
                                    key={dk.key}
                                    type="monotone"
                                    dataKey={dk.key}
                                    stroke={`var(--color-${dk.key})`}
                                    strokeWidth={2.5}
                                    fill={`url(#grad-${dk.key})`}
                                    dot={false}
                                    activeDot={{
                                        r: 5,
                                        fill: `var(--color-${dk.key})`,
                                        stroke: "var(--card)",
                                        strokeWidth: 2,
                                    }}
                                />
                            ))}
                        </AreaChart>
                    )}
                </ChartContainer>
            )}
        </div>
    );
}
