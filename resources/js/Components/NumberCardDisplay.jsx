import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Card, CardContent } from "./ui/card";

import LoadingIcon from "@/Components/LoadingIcon";
import React from "react";
import { Separator } from "./ui/separator";
import axios from "axios";
import { useLaravelReactI18n } from "laravel-react-i18n";

// Feedback user: split dari DashboardChart.jsx — Number Card TIDAK butuh
// recharts sama sekali (bukan bar/line/pie, cuma 1 angka + delta persentase).
// Beda arsitektur dari Chart: backend NumberCardService::getValue() SUDAH
// mengembalikan {value, percentage} langsung (1 query agregat + 1 requery
// as-of-date), TIDAK ada time-series di-diff client-side lagi seperti dulu.
function NumberCardDisplay({ numberCard, filters = {} }) {
  const { t } = useLaravelReactI18n();
  const [state, setState] = React.useState({ loading: true, value: 0, percentage: null, error: false });

  React.useEffect(() => {
    let cancelled = false;
    setState((prev) => ({ ...prev, loading: true, error: false }));

    axios
      .post(route("numberCards.getValue", numberCard.id), { filters })
      .then((res) => {
        if (cancelled) return;
        setState({ loading: false, value: res.data?.value ?? 0, percentage: res.data?.percentage ?? null, error: false });
      })
      .catch(() => {
        if (cancelled) return;
        setState((prev) => ({ ...prev, loading: false, error: true }));
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numberCard.id, JSON.stringify(filters)]);

  const formatNumber = (value) => {
    if (numberCard.show_full_number) {
      return Number(value ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
    }
    return Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(Number(value ?? 0));
  };

  const isPositiveTrend = (state.percentage ?? 0) >= 0;
  const trendBadgeClass = isPositiveTrend
    ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
    : "bg-rose-500/10 text-rose-600 border border-rose-500/20";

  return (
    <Card className="w-full rounded-xl border bg-card shadow-sm" style={{ backgroundColor: numberCard.background_color || undefined }}>
      <CardContent className="flex flex-col gap-5 p-5">
        <h3 className="text-muted-foreground text-sm font-medium">{numberCard.label}</h3>

        {state.loading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <LoadingIcon className="size-4" />
            <span>Memuat data...</span>
          </div>
        ) : state.error ? (
          <div className="text-sm text-destructive">Gagal memuat data.</div>
        ) : (
          <div className="space-y-2.5">
            <div className="flex items-center gap-2.5">
              <span
                className="text-2xl font-medium tracking-tight tabular-nums"
                style={{ color: numberCard.color || undefined }}
              >
                {formatNumber(state.value)}
              </span>
              {state.percentage !== null && (
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${trendBadgeClass}`}>
                  {isPositiveTrend ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                  {Math.abs(state.percentage).toFixed(1)}%
                </span>
              )}
            </div>
            {state.percentage !== null && (
              <>
                <Separator />
                <div className="text-muted-foreground text-xs">
                  {t(`settings.number_card.stats_time_intervals.${numberCard.stats_time_interval ?? "daily"}`)}
                </div>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default NumberCardDisplay;
