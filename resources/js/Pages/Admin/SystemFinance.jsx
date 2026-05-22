import MainLayout from "@/Layouts/MainLayout";
import { useState, useMemo } from "react";

// ─── MOCK DATA ────────────────────────────────────────────────────────────────
// Replace with API fetch / props / React Query as needed.
// Shape: PaymentRecord[]
const MOCK_PAYMENTS = [
  {
    id: "TRX-20250610-001",
    studentName: "Ahmad Fauzi",
    studentEmail: "ahmad.fauzi@email.com",
    avatar: "AF",
    courseName: "Structural BIM for Civil Engineers",
    courseCategory: "Civil Engineering",
    instructor: "Budi Santoso",
    amount: 850000,
    method: "Bank Transfer",
    bank: "BCA",
    refCode: "BCA8821039",
    submittedAt: "2025-06-10T09:14:00",
    status: "pending",
    proofUrl: "#",
  },
  {
    id: "TRX-20250610-002",
    studentName: "Rina Marlina",
    studentEmail: "rina.m@email.com",
    avatar: "RM",
    courseName: "AutoCAD 2D & 3D Mastery",
    courseCategory: "CAD & Design",
    instructor: "Reza Kurniawan",
    amount: 950000,
    method: "Bank Transfer",
    bank: "Mandiri",
    refCode: "MDR4490122",
    submittedAt: "2025-06-10T10:02:00",
    status: "pending",
    proofUrl: "#",
  },
  {
    id: "TRX-20250609-018",
    studentName: "Yusuf Habibie",
    studentEmail: "yusuf.h@email.com",
    avatar: "YH",
    courseName: "Ethics in Engineering Practice",
    courseCategory: "Professional Development",
    instructor: "Siti Nur",
    amount: 550000,
    method: "GoPay",
    bank: null,
    refCode: "GP09182736",
    submittedAt: "2025-06-09T14:30:00",
    status: "approved",
    proofUrl: "#",
  },
  {
    id: "TRX-20250609-017",
    studentName: "Dewi Puspita",
    studentEmail: "dewi.p@email.com",
    avatar: "DP",
    courseName: "Advanced Construction Management",
    courseCategory: "Management",
    instructor: "Adi Wijaya",
    amount: 1200000,
    method: "Bank Transfer",
    bank: "BNI",
    refCode: "BNI7721883",
    submittedAt: "2025-06-09T11:45:00",
    status: "approved",
    proofUrl: "#",
  },
  {
    id: "TRX-20250609-015",
    studentName: "Bagas Permana",
    studentEmail: "bagas.p@email.com",
    avatar: "BP",
    courseName: "Electrical Installation Standards",
    courseCategory: "Electrical",
    instructor: "Dewi Lestari",
    amount: 680000,
    method: "OVO",
    bank: null,
    refCode: "OVO3341872",
    submittedAt: "2025-06-09T08:20:00",
    status: "rejected",
    proofUrl: "#",
    rejectReason:
      "Transfer amount does not match. Student sent Rp 680.000 but registered amount is Rp 800.000.",
  },
  {
    id: "TRX-20250608-012",
    studentName: "Laila Fitriani",
    studentEmail: "laila.f@email.com",
    avatar: "LF",
    courseName: "Project Risk Assessment",
    courseCategory: "Management",
    instructor: "Fajar Hidayat",
    amount: 490000,
    method: "Bank Transfer",
    bank: "BCA",
    refCode: "BCA9901234",
    submittedAt: "2025-06-08T16:10:00",
    status: "pending",
    proofUrl: "#",
  },
  {
    id: "TRX-20250608-011",
    studentName: "Hendra Gunawan",
    studentEmail: "hendra.g@email.com",
    avatar: "HG",
    courseName: "Structural BIM for Civil Engineers",
    courseCategory: "Civil Engineering",
    instructor: "Budi Santoso",
    amount: 850000,
    method: "DANA",
    bank: null,
    refCode: "DNA5529001",
    submittedAt: "2025-06-08T13:55:00",
    status: "approved",
    proofUrl: "#",
  },
  {
    id: "TRX-20250607-009",
    studentName: "Sari Kusuma",
    studentEmail: "sari.k@email.com",
    avatar: "SK",
    courseName: "Geotechnical Engineering Fundamentals",
    courseCategory: "Civil Engineering",
    instructor: "Hendra Putra",
    amount: 720000,
    method: "Bank Transfer",
    bank: "Mandiri",
    refCode: "MDR3310987",
    submittedAt: "2025-06-07T10:00:00",
    status: "rejected",
    rejectReason:
      "Proof of payment expired. Please re-upload with today's receipt.",
    proofUrl: "#",
  },
  {
    id: "TRX-20250607-008",
    studentName: "Rizky Aditya",
    studentEmail: "rizky.a@email.com",
    avatar: "RA",
    courseName: "AutoCAD 2D & 3D Mastery",
    courseCategory: "CAD & Design",
    instructor: "Reza Kurniawan",
    amount: 950000,
    method: "GoPay",
    bank: null,
    refCode: "GP09283746",
    submittedAt: "2025-06-07T09:30:00",
    status: "approved",
    proofUrl: "#",
  },
];

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const STATUS_CFG = {
  pending: {
    label: "Pending",
    dot: "bg-amber-500",
    pill: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  },
  approved: {
    label: "Approved",
    dot: "bg-emerald-500",
    pill: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  },
  rejected: {
    label: "Rejected",
    dot: "bg-red-500",
    pill: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  },
};

const METHOD_COLOR = {
  "Bank Transfer":
    "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  GoPay:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  OVO: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  DANA: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const fmt = (n) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
const fmtTime = (iso) =>
  new Date(iso).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });

// ─── SUB-COMPONENTS ───────────────────────────────────────────────────────────
function Avatar({ initials, size = "sm" }) {
  const sz = size === "sm" ? "w-8 h-8 text-xs" : "w-10 h-10 text-sm";
  return (
    <div
      className={`${sz} rounded-full bg-[var(--primary-soft)] text-[var(--primary)] flex items-center justify-center font-bold shrink-0`}
    >
      {initials}
    </div>
  );
}

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${cfg.pill}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function MethodBadge({ method }) {
  return (
    <span
      className={`px-2 py-0.5 rounded text-[11px] font-semibold ${METHOD_COLOR[method] ?? "bg-slate-100 text-slate-600"}`}
    >
      {method}
    </span>
  );
}

function Icon({ d, cls = "w-4 h-4" }) {
  return (
    <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d={d}
      />
    </svg>
  );
}

// ─── DETAIL DRAWER ────────────────────────────────────────────────────────────
function DetailDrawer({ item, onClose, onApprove, onReject }) {
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  if (!item) return null;
  const current = item; // caller passes updated item

  const handleReject = () => {
    if (!rejectReason.trim()) return;
    onReject(current.id, rejectReason.trim());
    setRejectMode(false);
    setRejectReason("");
  };

  return (
    <div className="w-80 shrink-0 bg-[var(--card)] border border-[var(--border)] rounded-xl flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
        <p className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-widest">
          Payment Detail
        </p>
        <button
          onClick={onClose}
          className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
        >
          <Icon d="M6 18L18 6M6 6l12 12" cls="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Student */}
        <div className="px-5 py-4 border-b border-[var(--border)]">
          <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-widest font-semibold mb-2.5">
            Student
          </p>
          <div className="flex items-center gap-3">
            <Avatar initials={current.avatar} size="md" />
            <div>
              <p className="text-sm font-bold text-[var(--foreground)]">
                {current.studentName}
              </p>
              <p className="text-xs text-[var(--muted-foreground)]">
                {current.studentEmail}
              </p>
            </div>
          </div>
        </div>

        {/* Course */}
        <div className="px-5 py-4 border-b border-[var(--border)]">
          <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-widest font-semibold mb-2.5">
            Course
          </p>
          <p className="text-sm font-semibold text-[var(--foreground)] leading-snug">
            {current.courseName}
          </p>
          <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
            {current.courseCategory} · {current.instructor}
          </p>
        </div>

        {/* Payment Info */}
        <div className="px-5 py-4 border-b border-[var(--border)]">
          <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-widest font-semibold mb-3">
            Payment Info
          </p>
          <div className="space-y-2.5">
            {[
              { label: "Transaction ID", value: current.id },
              { label: "Amount", value: fmt(current.amount), bold: true },
              {
                label: "Method",
                value: <MethodBadge method={current.method} />,
              },
              { label: "Bank / Wallet", value: current.bank ?? current.method },
              { label: "Reference Code", value: current.refCode },
              {
                label: "Submitted",
                value: `${fmtDate(current.submittedAt)}, ${fmtTime(current.submittedAt)}`,
              },
            ].map(({ label, value, bold }) => (
              <div
                key={label}
                className="flex items-start justify-between gap-2"
              >
                <p className="text-xs text-[var(--muted-foreground)] shrink-0">
                  {label}
                </p>
                <p
                  className={`text-xs text-right ${bold ? "font-bold text-[var(--foreground)]" : "text-[var(--foreground)]"}`}
                >
                  {value}
                </p>
              </div>
            ))}
          </div>

          {/* Amount highlight */}
          <div className="mt-4 bg-[var(--background-accent)] rounded-xl p-3 flex items-center justify-between">
            <p className="text-xs text-[var(--muted-foreground)]">
              Total Amount
            </p>
            <p className="text-lg font-black text-[var(--foreground)]">
              {fmt(current.amount)}
            </p>
          </div>
        </div>

        {/* Proof of Payment */}
        <div className="px-5 py-4 border-b border-[var(--border)]">
          <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-widest font-semibold mb-3">
            Proof of Payment
          </p>
          <div className="border border-dashed border-[var(--border)] rounded-xl p-4 flex flex-col items-center gap-2 bg-[var(--background-accent)] cursor-pointer hover:bg-[var(--secondary)] transition-colors">
            <Icon
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              cls="w-8 h-8 text-[var(--muted-foreground)]"
            />
            <p className="text-xs text-[var(--muted-foreground)]">
              Click to view uploaded receipt
            </p>
            <span className="text-[11px] font-semibold text-[var(--primary)] underline">
              bukti_transfer_{current.refCode}.jpg
            </span>
          </div>
        </div>

        {/* Reject Reason if rejected */}
        {current.status === "rejected" && current.rejectReason && (
          <div className="px-5 py-4 border-b border-[var(--border)]">
            <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-widest font-semibold mb-2">
              Rejection Note
            </p>
            <p className="text-xs text-red-600 dark:text-red-400 leading-relaxed bg-red-50 dark:bg-red-950/30 rounded-lg p-3">
              {current.rejectReason}
            </p>
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div className="p-4 border-t border-[var(--border)]">
        {current.status === "pending" && !rejectMode && (
          <div className="flex gap-2">
            <button
              onClick={() => setRejectMode(true)}
              className="flex-1 py-2.5 text-xs font-semibold border border-[var(--border)] text-[var(--foreground)] rounded-lg hover:bg-red-50 hover:text-red-600 hover:border-red-200 dark:hover:bg-red-950/30 transition-colors"
            >
              Reject
            </button>
            <button
              onClick={() => onApprove(current.id)}
              className="flex-1 py-2.5 text-xs font-semibold bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors"
            >
              Confirm Payment
            </button>
          </div>
        )}

        {current.status === "pending" && rejectMode && (
          <div className="space-y-2">
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason for rejection (required)..."
              rows={3}
              className="w-full text-xs p-2.5 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setRejectMode(false);
                  setRejectReason("");
                }}
                className="flex-1 py-2 text-xs font-medium border border-[var(--border)] rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--secondary)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={!rejectReason.trim()}
                className="flex-1 py-2 text-xs font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Send Rejection
              </button>
            </div>
          </div>
        )}

        {current.status === "approved" && (
          <div className="flex items-center justify-center gap-2 py-2.5 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg">
            <Icon
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              cls="w-4 h-4 text-emerald-600 dark:text-emerald-400"
            />
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              Payment Confirmed
            </span>
          </div>
        )}

        {current.status === "rejected" && (
          <div className="flex items-center justify-center gap-2 py-2.5 bg-red-50 dark:bg-red-950/30 rounded-lg">
            <Icon
              d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
              cls="w-4 h-4 text-red-600 dark:text-red-400"
            />
            <span className="text-xs font-semibold text-red-600 dark:text-red-400">
              Payment Rejected
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function SystemFinance() {
  const [payments, setPayments] = useState(MOCK_PAYMENTS);
  const [selected, setSelected] = useState(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterMethod, setFilterMethod] = useState("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("newest");

  // ── derived counts
  const counts = useMemo(
    () => ({
      all: payments.length,
      pending: payments.filter((p) => p.status === "pending").length,
      approved: payments.filter((p) => p.status === "approved").length,
      rejected: payments.filter((p) => p.status === "rejected").length,
    }),
    [payments],
  );

  const totalRevenue = useMemo(
    () =>
      payments
        .filter((p) => p.status === "approved")
        .reduce((s, p) => s + p.amount, 0),
    [payments],
  );

  const pendingRevenue = useMemo(
    () =>
      payments
        .filter((p) => p.status === "pending")
        .reduce((s, p) => s + p.amount, 0),
    [payments],
  );

  // ── filtered + sorted list
  const filtered = useMemo(() => {
    let list = payments;
    if (filterStatus !== "all")
      list = list.filter((p) => p.status === filterStatus);
    if (filterMethod !== "all")
      list = list.filter((p) => p.method === filterMethod);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.studentName.toLowerCase().includes(q) ||
          p.courseName.toLowerCase().includes(q) ||
          p.id.toLowerCase().includes(q) ||
          p.refCode.toLowerCase().includes(q),
      );
    }
    if (sortBy === "newest")
      list = [...list].sort(
        (a, b) => new Date(b.submittedAt) - new Date(a.submittedAt),
      );
    if (sortBy === "oldest")
      list = [...list].sort(
        (a, b) => new Date(a.submittedAt) - new Date(b.submittedAt),
      );
    if (sortBy === "highest")
      list = [...list].sort((a, b) => b.amount - a.amount);
    if (sortBy === "lowest")
      list = [...list].sort((a, b) => a.amount - b.amount);
    return list;
  }, [payments, filterStatus, filterMethod, search, sortBy]);

  // ── handlers
  const handleApprove = (id) => {
    setPayments((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: "approved" } : p)),
    );
    setSelected((prev) =>
      prev?.id === id ? { ...prev, status: "approved" } : prev,
    );
  };

  const handleReject = (id, reason) => {
    setPayments((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, status: "rejected", rejectReason: reason } : p,
      ),
    );
    setSelected((prev) =>
      prev?.id === id
        ? { ...prev, status: "rejected", rejectReason: reason }
        : prev,
    );
  };

  // keep selected in sync with payment state
  const selectedLive = selected
    ? (payments.find((p) => p.id === selected.id) ?? selected)
    : null;

  return (
    <MainLayout>
      <div
        data-role="admin"
        className="flex h-screen bg-[var(--background)] overflow-hidden"
      >
        {/* ── MAIN ────────────────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Body */}
          <div className="flex-1 overflow-auto p-6 space-y-5">
            {/* Page heading */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-black text-[var(--foreground)] tracking-tight">
                  SYSTEM FINANCE
                </h1>
                <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
                  Manage enrollment payment confirmations from students.
                </p>
              </div>
              <div className="flex gap-2">
                <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-[var(--border)] text-[var(--foreground)] bg-[var(--card)] rounded-lg hover:bg-[var(--secondary)] transition-colors">
                  <Icon
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    cls="w-4 h-4"
                  />
                  Export
                </button>
                <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors">
                  <Icon
                    d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    cls="w-4 h-4"
                  />
                  Finance Report
                </button>
              </div>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-4 gap-4">
              {[
                {
                  label: "Confirmed Revenue",
                  value: fmt(totalRevenue),
                  sub: `${counts.approved} transactions`,
                  subColor: "text-emerald-500",
                  d: "M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M12 7h.01M9 3H5a2 2 0 00-2 2v16a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2h-4M9 3a2 2 0 002 2h2a2 2 0 002-2M9 3a2 2 0 012-2h2a2 2 0 012 2",
                },
                {
                  label: "Pending Amount",
                  value: fmt(pendingRevenue),
                  sub: `${counts.pending} awaiting review`,
                  subColor: "text-amber-500",
                  d: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
                },
                {
                  label: "Total Transactions",
                  value: counts.all,
                  sub: "All time",
                  subColor: "text-[var(--muted-foreground)]",
                  d: "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z",
                },
                {
                  label: "Rejected Payments",
                  value: counts.rejected,
                  sub: "Need revision",
                  subColor: "text-red-500",
                  d: "M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z",
                },
              ].map((card) => (
                <div
                  key={card.label}
                  className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4"
                >
                  <div className="flex items-start justify-between mb-3">
                    <p className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider leading-tight">
                      {card.label}
                    </p>
                    <div className="w-8 h-8 rounded-lg bg-[var(--primary-soft)] flex items-center justify-center shrink-0">
                      <Icon d={card.d} cls="w-4 h-4 text-[var(--primary)]" />
                    </div>
                  </div>
                  <p className="text-2xl font-black text-[var(--foreground)] leading-none">
                    {card.value}
                  </p>
                  <p className={`text-xs font-medium mt-1.5 ${card.subColor}`}>
                    {card.sub}
                  </p>
                </div>
              ))}
            </div>

            {/* Table + Detail */}
            <div className="flex gap-4" style={{ minHeight: "420px" }}>
              {/* Table */}
              <div className="flex-1 bg-[var(--card)] border border-[var(--border)] rounded-xl flex flex-col overflow-hidden">
                {/* Table toolbar */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)]">
                  {/* Status filter tabs */}
                  <div className="flex border border-[var(--border)] rounded-lg overflow-hidden text-xs font-semibold">
                    {["all", "pending", "approved", "rejected"].map((s) => (
                      <button
                        key={s}
                        onClick={() => setFilterStatus(s)}
                        className={`px-3 py-1.5 capitalize transition-colors ${
                          filterStatus === s
                            ? "bg-[var(--primary)] text-white"
                            : "text-[var(--muted-foreground)] hover:bg-[var(--secondary)]"
                        }`}
                      >
                        {s === "all"
                          ? `All (${counts.all})`
                          : `${s.charAt(0).toUpperCase() + s.slice(1)} (${counts[s]})`}
                      </button>
                    ))}
                  </div>

                  {/* Method filter */}
                  <select
                    value={filterMethod}
                    onChange={(e) => setFilterMethod(e.target.value)}
                    className="ml-auto text-xs border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                  >
                    <option value="all">All Methods</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="GoPay">GoPay</option>
                    <option value="OVO">OVO</option>
                    <option value="DANA">DANA</option>
                  </select>

                  {/* Sort */}
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="text-xs border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                  >
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                    <option value="highest">Highest Amount</option>
                    <option value="lowest">Lowest Amount</option>
                  </select>
                </div>

                {/* Table scroll wrapper */}
                <div className="flex-1 overflow-auto">
                  <table
                    className="w-full text-sm"
                    style={{ tableLayout: "fixed" }}
                  >
                    <colgroup>
                      <col style={{ width: "200px" }} />
                      <col style={{ width: "180px" }} />
                      <col style={{ width: "110px" }} />
                      <col style={{ width: "90px" }} />
                      <col style={{ width: "100px" }} />
                      <col style={{ width: "90px" }} />
                    </colgroup>
                    <thead className="sticky top-0 bg-[var(--card)] z-10">
                      <tr className="border-b border-[var(--border)]">
                        {[
                          "Student",
                          "Course",
                          "Amount",
                          "Method",
                          "Date",
                          "Status",
                        ].map((h) => (
                          <th
                            key={h}
                            className="text-left px-4 py-3 text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-widest"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {filtered.length === 0 ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="text-center py-16 text-[var(--muted-foreground)]"
                          >
                            <div className="flex flex-col items-center gap-2">
                              <Icon
                                d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                                cls="w-8 h-8 opacity-30"
                              />
                              <p className="text-xs">No transactions found</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        filtered.map((p) => {
                          const isActive = selectedLive?.id === p.id;
                          return (
                            <tr
                              key={p.id}
                              onClick={() => setSelected(p)}
                              className={`cursor-pointer transition-colors ${
                                isActive
                                  ? "bg-[var(--primary-soft)]"
                                  : "hover:bg-[var(--background-accent)]"
                              }`}
                            >
                              {/* Student */}
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2 min-w-0">
                                  <Avatar initials={p.avatar} />
                                  <div className="min-w-0">
                                    <p
                                      className={`text-xs font-semibold truncate ${isActive ? "text-[var(--primary)]" : "text-[var(--foreground)]"}`}
                                    >
                                      {p.studentName}
                                    </p>
                                    <p className="text-[10px] text-[var(--muted-foreground)] truncate">
                                      {p.id}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              {/* Course */}
                              <td className="px-4 py-3">
                                <p className="text-xs text-[var(--foreground)] truncate font-medium">
                                  {p.courseName}
                                </p>
                                <p className="text-[10px] text-[var(--muted-foreground)] truncate">
                                  {p.instructor}
                                </p>
                              </td>
                              {/* Amount */}
                              <td className="px-4 py-3">
                                <p className="text-xs font-bold text-[var(--foreground)]">
                                  {fmt(p.amount)}
                                </p>
                              </td>
                              {/* Method */}
                              <td className="px-4 py-3">
                                <MethodBadge method={p.method} />
                              </td>
                              {/* Date */}
                              <td className="px-4 py-3">
                                <p className="text-xs text-[var(--foreground)]">
                                  {fmtDate(p.submittedAt)}
                                </p>
                                <p className="text-[10px] text-[var(--muted-foreground)]">
                                  {fmtTime(p.submittedAt)}
                                </p>
                              </td>
                              {/* Status */}
                              <td className="px-4 py-3">
                                <StatusBadge status={p.status} />
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Table footer */}
                <div className="px-4 py-3 border-t border-[var(--border)] flex items-center justify-between">
                  <p className="text-xs text-[var(--muted-foreground)]">
                    Showing{" "}
                    <span className="font-semibold text-[var(--foreground)]">
                      {filtered.length}
                    </span>{" "}
                    of{" "}
                    <span className="font-semibold text-[var(--foreground)]">
                      {payments.length}
                    </span>{" "}
                    transactions
                  </p>
                  <div className="flex gap-1">
                    <button className="px-3 py-1.5 text-xs border border-[var(--border)] rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--secondary)] transition-colors">
                      ← Prev
                    </button>
                    <button className="px-3 py-1.5 text-xs border border-[var(--border)] rounded-lg bg-[var(--primary)] text-white">
                      1
                    </button>
                    <button className="px-3 py-1.5 text-xs border border-[var(--border)] rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--secondary)] transition-colors">
                      Next →
                    </button>
                  </div>
                </div>
              </div>

              {/* Detail Drawer */}
              {selectedLive && (
                <DetailDrawer
                  item={selectedLive}
                  onClose={() => setSelected(null)}
                  onApprove={handleApprove}
                  onReject={handleReject}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
