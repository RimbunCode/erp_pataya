import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Card, CardContent } from "./ui/card";

import BlockDescriptionTooltip from "@/Components/DashboardBlocks/BlockDescriptionTooltip";
import LoadingIcon from "@/Components/LoadingIcon";
import React from "react";
import { Separator } from "./ui/separator";
import axios from "axios";
import { formatNumber } from "@/lib/numberFormat";
import { resolveIcon } from "@/lib/deskIcons";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { usePage } from "@inertiajs/react";
import { useQuery } from "@tanstack/react-query";
import useInViewport from "@/Hooks/useInViewport";

// Feedback user: split dari DashboardChart.jsx — Number Card TIDAK butuh
// recharts sama sekali (bukan bar/line/pie, cuma 1 angka + delta persentase).
// Beda arsitektur dari Chart: backend NumberCardService::getValue() SUDAH
// mengembalikan {value, percentage} langsung (1 query agregat + 1 requery
// as-of-date), TIDAK ada time-series di-diff client-side lagi seperti dulu.
function NumberCardDisplay({ numberCard, filters = {} }) {
  const { t, currentLocale } = useLaravelReactI18n();
  const { preferences } = usePage().props;
  // Opsi C optimasi dashboard: tunda POST getValue sampai Card ini
  // mendekati viewport -- Desk dgn banyak block tidak langsung nembak N
  // request paralel begitu halaman dibuka. Ref nempel di <Card> ROOT (baris
  // di bawah), yang SELALU ter-render terlepas dari state loading.
  const cardRef = React.useRef(null);
  const isInView = useInViewport(cardRef);

  // Opsi L optimasi dashboard: TanStack Query gantikan axios+useEffect+
  // useState manual — dedup otomatis (2 NumberCardDisplay dgn id+filters
  // SAMA yang mount bersamaan cukup 1 request, bukan 2) & cache lintas
  // remount dalam window `staleTime` (lihat lib/queryClient.js), tanpa perlu
  // guard `cancelled` manual (TanStack Query sudah abaikan hasil query yang
  // sudah tidak relevan/unmounted). `enabled: isInView` gantikan early-return
  // manual opsi C — `isPending` otomatis true baik selagi NUNGGU viewport
  // MAUPUN selagi request aktif, jadi behavior "Memuat data..." sama persis.
  const { data, isPending, isError } = useQuery({
    queryKey: ["numberCard", numberCard.id, filters],
    queryFn: () =>
      axios
        .post(route("numberCards.getValue", numberCard.id), { filters })
        .then((res) => ({
          value: res.data?.value ?? 0,
          percentage: res.data?.percentage ?? null,
        })),
    enabled: isInView,
  });

  const loading = isPending;
  const value = data?.value ?? 0;
  const percentage = data?.percentage ?? null;

  // chart-compact-number-display: mode full DELEGASI ke NumberInput/
  // formatNumber via preferences.default_number_format (sumber tunggal
  // "angka penuh" yang SUDAH dipakai Table2/PrintTemplate di seluruh app —
  // BUKAN toLocaleString(locale) buatan sendiri). Mode compact tetap baru,
  // locale-nya ikut lang AKTIF APP (currentLocale()) krn kata singkatan
  // ("jt"/"rb" vs "K"/"M") itu soal bahasa, beda sumbu dari pattern
  // pemisah desimal company. Lihat lib/numberFormat.js.
  const fmt = (value) =>
    formatNumber(value, {
      full: numberCard.show_full_number,
      locale: currentLocale(),
      numberFormat: preferences?.default_number_format,
    });

  const isPositiveTrend = (percentage ?? 0) >= 0;
  const trendBadgeClass = isPositiveTrend
    ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
    : "bg-rose-500/10 text-rose-600 border border-rose-500/20";

  return (
    <Card
      ref={cardRef}
      className="w-full rounded-xl border bg-card shadow-sm"
      style={{ backgroundColor: numberCard.background_color || undefined }}
    >
      <CardContent className="flex flex-col gap-5 p-5">
        {/* Feedback user: icon + deskripsi (tooltip) mirip pola komponen
            lain (Quick List/Link Card/Section) — icon opsional, deskripsi
            opsional sbg tooltip di ikon info. */}
        <div className="flex items-center gap-2">
          {numberCard.icon && (
            <span className="flex size-4 shrink-0 items-center justify-center text-muted-foreground [&>svg]:size-4">
              {resolveIcon(numberCard.icon)}
            </span>
          )}
          <h3 className="text-muted-foreground text-sm font-medium">
            {numberCard.label}
          </h3>
          <BlockDescriptionTooltip description={numberCard.description} />
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <LoadingIcon className="size-4" />
            <span>Memuat data...</span>
          </div>
        ) : isError ? (
          <div className="text-sm text-destructive">Gagal memuat data.</div>
        ) : (
          <div className="space-y-2.5">
            <div className="flex items-center gap-2.5">
              <span
                className="text-2xl font-medium tracking-tight tabular-nums"
                style={{ color: numberCard.color || undefined }}
              >
                {fmt(value)}
              </span>
              {percentage !== null && (
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${trendBadgeClass}`}
                >
                  {isPositiveTrend ? (
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  ) : (
                    <ArrowDownRight className="h-3.5 w-3.5" />
                  )}
                  {Math.abs(percentage).toFixed(1)}%
                </span>
              )}
            </div>
            {percentage !== null && (
              <>
                <Separator />
                <div className="text-muted-foreground text-xs">
                  {t(
                    `settings.number_card.stats_time_intervals.${numberCard.stats_time_interval ?? "daily"}`,
                  )}
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
