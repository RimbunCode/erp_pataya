import MainLayout from "@/Layouts/MainLayout";
import { router, usePage } from "@inertiajs/react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const STATUS_LABEL = {
  draft: "Menunggu Penilaian Instruktur",
  submitted_instructor: "Menunggu Approval Admin",
  final: "Final",
};

function PassBadge({ isPassed }) {
  return isPassed ? (
    <span className="text-green-600 font-bold">Lulus</span>
  ) : (
    <span className="text-red-500 font-bold">Belum Lulus</span>
  );
}

export default function AdminEnrollmentEvaluationsShow() {
  const { course, evaluations = [], flash = {}, errors = {} } = usePage().props;
  const [selected, setSelected] = useState([]);

  useEffect(() => {
    if (flash?.success) toast.success(flash.success);
    if (errors?.enrollment_ids) toast.error(errors.enrollment_ids);
  }, [flash?.success, errors?.enrollment_ids]);

  const pendingRows = useMemo(
    () => evaluations.filter((row) => row.status === "submitted_instructor"),
    [evaluations],
  );
  const otherRows = useMemo(
    () => evaluations.filter((row) => row.status !== "submitted_instructor"),
    [evaluations],
  );

  const toggleRow = (enrollmentId) => {
    setSelected((prev) =>
      prev.includes(enrollmentId)
        ? prev.filter((id) => id !== enrollmentId)
        : [...prev, enrollmentId],
    );
  };

  const toggleAll = () => {
    setSelected((prev) =>
      prev.length === pendingRows.length ? [] : pendingRows.map((row) => row.enrollmentId),
    );
  };

  const handleSubmitFinal = () => {
    router.post(
      route("admin.enrollment-evaluations.submit-final", course.id),
      { enrollment_ids: selected },
      { onSuccess: () => setSelected([]) },
    );
  };

  return (
    <MainLayout title={`Review Evaluasi - ${course.title}`}>
      <div className="p-8 space-y-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-foreground uppercase">
              Review Evaluasi
            </h2>
            <p className="text-xs text-muted-foreground font-medium mt-0.5">{course.title}</p>
          </div>
          <button
            onClick={handleSubmitFinal}
            disabled={selected.length === 0}
            className="px-5 py-2.5 text-xs font-black tracking-widest uppercase bg-primary text-white rounded-xl hover:bg-primary-hover transition-all disabled:opacity-50"
          >
            Submit Final ({selected.length})
          </button>
        </div>

        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-6 py-3 border-b border-border bg-muted/40">
            <span className="text-[10px] font-black tracking-widest text-muted-foreground uppercase">
              Menunggu Approval ({pendingRows.length})
            </span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/60 border-b border-border text-left">
                <th className="px-6 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={pendingRows.length > 0 && selected.length === pendingRows.length}
                    onChange={toggleAll}
                    disabled={pendingRows.length === 0}
                  />
                </th>
                <th className="px-6 py-3 text-[10px] font-black tracking-widest text-muted-foreground uppercase">Peserta</th>
                <th className="px-6 py-3 text-[10px] font-black tracking-widest text-muted-foreground uppercase">Nilai Akhir</th>
                <th className="px-6 py-3 text-[10px] font-black tracking-widest text-muted-foreground uppercase">Grade</th>
                <th className="px-6 py-3 text-[10px] font-black tracking-widest text-muted-foreground uppercase">Lulus</th>
              </tr>
            </thead>
            <tbody>
              {pendingRows.map((row) => (
                <tr key={row.enrollmentId} className="border-b border-border last:border-0">
                  <td className="px-6 py-3">
                    <input
                      type="checkbox"
                      checked={selected.includes(row.enrollmentId)}
                      onChange={() => toggleRow(row.enrollmentId)}
                    />
                  </td>
                  <td className="px-6 py-3">
                    <div className="font-bold text-foreground">{row.studentName}</div>
                    <div className="text-xs text-muted-foreground">{row.studentEmail}</div>
                  </td>
                  <td className="px-6 py-3">{row.finalScore ?? "-"}</td>
                  <td className="px-6 py-3">{row.grade ?? "-"}</td>
                  <td className="px-6 py-3">
                    <PassBadge isPassed={row.isPassed} />
                  </td>
                </tr>
              ))}
              {pendingRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground text-xs uppercase font-bold">
                    Tidak ada evaluasi yang menunggu approval.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {otherRows.length > 0 && (
          <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="px-6 py-3 border-b border-border bg-muted/40">
              <span className="text-[10px] font-black tracking-widest text-muted-foreground uppercase">
                Lainnya ({otherRows.length})
              </span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/60 border-b border-border text-left">
                  <th className="px-6 py-3 text-[10px] font-black tracking-widest text-muted-foreground uppercase">Peserta</th>
                  <th className="px-6 py-3 text-[10px] font-black tracking-widest text-muted-foreground uppercase">Nilai Akhir</th>
                  <th className="px-6 py-3 text-[10px] font-black tracking-widest text-muted-foreground uppercase">Grade</th>
                  <th className="px-6 py-3 text-[10px] font-black tracking-widest text-muted-foreground uppercase">Lulus</th>
                  <th className="px-6 py-3 text-[10px] font-black tracking-widest text-muted-foreground uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {otherRows.map((row) => (
                  <tr key={row.enrollmentId} className="border-b border-border last:border-0">
                    <td className="px-6 py-3">
                      <div className="font-bold text-foreground">{row.studentName}</div>
                      <div className="text-xs text-muted-foreground">{row.studentEmail}</div>
                    </td>
                    <td className="px-6 py-3">{row.finalScore ?? "-"}</td>
                    <td className="px-6 py-3">{row.grade ?? "-"}</td>
                    <td className="px-6 py-3">
                      <PassBadge isPassed={row.isPassed} />
                    </td>
                    <td className="px-6 py-3">{STATUS_LABEL[row.status] ?? row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
