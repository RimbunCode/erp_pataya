import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatNumber } from "@/lib/numberFormat";
import { usePage } from "@inertiajs/react";

// Grafik garis satu seri per tanggal (Req 1.2). Rentang tanpa data menampilkan
// keterangan, bukan grafik kosong yang membingungkan.
export default function ReportLineChart({ title, series = [], valueLabel }) {
  const { preferences } = usePage().props;
  const numberFormat = preferences?.default_number_format;

  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-card p-4">
      <div className="text-sm font-medium">{title}</div>
      {series.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          Tidak ada data pada rentang ini.
        </div>
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={series}
              margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => formatNumber(value, { numberFormat })}
                width={80}
              />
              <Tooltip
                formatter={(value) => [
                  formatNumber(value, { full: true, numberFormat }),
                  valueLabel,
                ]}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#2563eb"
                strokeWidth={2}
                dot={false}
                name={valueLabel}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
