import { usePage } from "@inertiajs/react";
import axios from "axios";
import { useState } from "react";

import ConsistencyWarning from "./ConsistencyWarning";
import KpiStrip from "./KpiStrip";

// Kerangka seragam semua laporan: peringatan konsistensi, bar filter, tombol unduh, strip KPI,
// grafik (opsional), lalu tabel data (Req 1.1 dan 1.2).
//
// Kunci laporan dan izin hitung ulang dibaca dari props halaman, jadi halaman laporan cukup
// meneruskan filter, KPI, konsistensi, grafik, dan tabel.
export default function ReportLayout({
  kpi = [],
  consistency = null,
  filters = null,
  chart = null,
  children,
}) {
  const { report, canRecount = false } = usePage().props;
  const [recounted, setRecounted] = useState(null);

  // Hasil hitung ulang menggantikan nilai KPI yang kuncinya sama, dan diberi penanda (Req 5.7).
  const kpiItems = recounted
    ? kpi.map((item) =>
        recounted.values[item.key] !== undefined
          ? { ...item, value: recounted.values[item.key], recounted: true }
          : item,
      )
    : kpi;

  // Filter aktif ikut dibawa lewat query string halaman, supaya export dan hitung ulang
  // memakai filter yang sama dengan tabel (Req 4.1).
  async function recount() {
    const { data } = await axios.get(
      window.route("reports.recount", { report: report.key }) +
        window.location.search,
      { headers: { Accept: "application/json" } },
    );
    setRecounted(data);
  }

  function exportUrl(format) {
    return (
      window.route("reports.export", { report: report.key, format }) +
      window.location.search
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {consistency && (
        <ConsistencyWarning
          {...consistency}
          canRecount={canRecount}
          onRecount={recount}
        />
      )}
      {filters}
      <div className="flex flex-wrap justify-end gap-2">
        <a
          href={exportUrl("pdf")}
          className="inline-flex items-center rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
        >
          Unduh PDF
        </a>
        <a
          href={exportUrl("csv")}
          className="inline-flex items-center rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
        >
          Unduh CSV
        </a>
      </div>
      <KpiStrip items={kpiItems} />
      {chart}
      {children}
    </div>
  );
}
