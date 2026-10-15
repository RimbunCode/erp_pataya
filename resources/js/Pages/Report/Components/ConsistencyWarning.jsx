import axios from "axios";
import { useState } from "react";

import { Button } from "@/Components/ui/button";

// Banner peringatan saat KPI laporan tidak cocok dengan isi tabel.
// Tombol "Laporkan masalah ini" tampil untuk semua pengguna yang melihat banner.
// Tombol "Hitung ulang akurat" hanya tampil bila canRecount (izin administratif, Req 5.5).
export default function ConsistencyWarning({
  reportName,
  kpiRows,
  tableRows,
  filter = {},
  canRecount = false,
  onRecount = null,
}) {
  const [submitting, setSubmitting] = useState(false);
  const [ticketCode, setTicketCode] = useState(null);
  const [failed, setFailed] = useState(false);
  const [recounting, setRecounting] = useState(false);
  const [recountFailed, setRecountFailed] = useState(false);

  async function reportIssue() {
    setSubmitting(true);
    setFailed(false);
    try {
      const { data } = await axios.post(window.route("reports.issues.store"), {
        report: reportName,
        kpi_rows: kpiRows,
        table_rows: tableRows,
        filter,
        url: window.location.href,
      });
      setTicketCode(data.ticketCode);
    } catch {
      setFailed(true);
    } finally {
      setSubmitting(false);
    }
  }

  async function recount() {
    setRecounting(true);
    setRecountFailed(false);
    try {
      await onRecount();
    } catch {
      setRecountFailed(true);
    } finally {
      setRecounting(false);
    }
  }

  return (
    <div
      role="alert"
      className="flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
    >
      <p>
        Angka KPI ({kpiRows} baris) tidak cocok dengan isi tabel ({tableRows}{" "}
        baris). Angka yang ditampilkan mungkin tidak akurat.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {ticketCode ? (
          <span>
            Ticket {ticketCode} berhasil dibuat dan diteruskan ke tim IT.
          </span>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={submitting}
            onClick={reportIssue}
          >
            Laporkan masalah ini
          </Button>
        )}
        {canRecount && onRecount && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={recounting}
            onClick={recount}
          >
            Hitung ulang akurat
          </Button>
        )}
        {failed && <span>Gagal membuat Ticket. Coba lagi.</span>}
        {recountFailed && <span>Gagal menghitung ulang. Coba lagi.</span>}
      </div>
    </div>
  );
}
