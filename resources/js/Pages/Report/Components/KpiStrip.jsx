import { usePage } from "@inertiajs/react";

import { formatNumber } from "@/lib/numberFormat";

// Strip angka ringkasan di atas tabel laporan. Item yang tidak dikirim backend
// tidak ditampilkan (Req 3.5), jadi tidak ada nol yang menyesatkan. Item hasil hitung ulang
// diberi penanda (Req 5.7).
export default function KpiStrip({ items = [] }) {
  const { preferences } = usePage().props;
  const numberFormat = preferences?.default_number_format;

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {items.map((item) => (
        <div key={item.key} className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">{item.label}</div>
          <div className="text-xl font-semibold tabular-nums">
            {item.type === "number"
              ? new Intl.NumberFormat(undefined, {
                  maximumFractionDigits: 2,
                }).format(item.value)
              : formatNumber(item.value, { full: true, numberFormat })}
          </div>
          {item.recounted && (
            <div className="text-xs text-muted-foreground">Dihitung ulang</div>
          )}
        </div>
      ))}
    </div>
  );
}
