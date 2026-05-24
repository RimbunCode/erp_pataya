import MainLayout from "@/Layouts/MainLayout";
import { router, usePage } from "@inertiajs/react";
import { useMemo, useState } from "react";

const STATUS_CFG = {
  pending: {
    label: "Pending",
    dot: "bg-[var(--primary)]",
    pill: "bg-[var(--primary-soft)] text-[var(--primary-soft-foreground)]",
  },
  approved: {
    label: "Approved",
    dot: "bg-emerald-500",
    pill: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
  rejected: {
    label: "Rejected",
    dot: "bg-red-500",
    pill: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
  },
};

const METHOD_COLOR = {
  "Bank Transfer":
    "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  "Virtual Account":
    "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
  QRIS: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
};

const fmt = (n) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);

const fmtDate = (iso) => {
  if (!iso) {
    return "-";
  }

  return new Date(iso).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const fmtTime = (iso) => {
  if (!iso) {
    return "-";
  }

  return new Date(iso).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

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

function Avatar({ initials }) {
  return (
    <div className="w-8 h-8 rounded-full bg-[var(--primary-soft)] text-[var(--primary)] flex items-center justify-center text-xs font-bold shrink-0">
      {initials}
    </div>
  );
}

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.pending;

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
      className={`px-2 py-0.5 rounded text-[11px] font-semibold ${METHOD_COLOR[method] ?? "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300"}`}
    >
      {method}
    </span>
  );
}

function DetailDrawer({ item, onClose, onApprove, onReject }) {
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  if (!item) return null;

  const rejectionHistory = Array.isArray(item.rejectionHistory)
    ? item.rejectionHistory
    : [];

  return (
    <div className="w-80 shrink-0 bg-[var(--card)] border border-[var(--border)] rounded-xl flex flex-col overflow-hidden">
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
        <div className="px-5 py-4 border-b border-[var(--border)]">
          <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-widest font-semibold mb-2.5">
            Student
          </p>
          <div className="flex items-center gap-3">
            <Avatar initials={item.avatar} />
            <div>
              <p className="text-sm font-bold text-[var(--foreground)]">
                {item.studentName}
              </p>
              <p className="text-xs text-[var(--muted-foreground)]">
                {item.studentEmail}
              </p>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-b border-[var(--border)]">
          <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-widest font-semibold mb-2.5">
            Course
          </p>
          <p className="text-sm font-semibold text-[var(--foreground)] leading-snug">
            {item.courseName}
          </p>
          <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
            {item.courseCategory} - {item.instructor}
          </p>
        </div>

        <div className="px-5 py-4 border-b border-[var(--border)]">
          <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-widest font-semibold mb-3">
            Payment Info
          </p>
          <div className="space-y-2.5">
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs text-[var(--muted-foreground)]">
                Transaction ID
              </p>
              <p className="text-xs text-[var(--foreground)] text-right">
                {item.id}
              </p>
            </div>
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs text-[var(--muted-foreground)]">Amount</p>
              <p className="text-xs font-bold text-[var(--foreground)] text-right">
                {fmt(item.amount)}
              </p>
            </div>
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs text-[var(--muted-foreground)]">Method</p>
              <MethodBadge method={item.method} />
            </div>
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs text-[var(--muted-foreground)]">
                Reference Code
              </p>
              <p className="text-xs text-[var(--foreground)] text-right">
                {item.refCode}
              </p>
            </div>
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs text-[var(--muted-foreground)]">
                Submitted
              </p>
              <p className="text-xs text-[var(--foreground)] text-right">
                {fmtDate(item.submittedAt)}, {fmtTime(item.submittedAt)}
              </p>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-b border-[var(--border)]">
          <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-widest font-semibold mb-2.5">
            Student Note
          </p>
          <p className="text-xs text-[var(--foreground)] leading-relaxed bg-[var(--background-accent)] rounded-lg p-3">
            {item.studentNote?.trim()
              ? item.studentNote
              : "No note provided by student."}
          </p>
        </div>

        <div className="px-5 py-4 border-b border-[var(--border)]">
          <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-widest font-semibold mb-3">
            Proof of Payment
          </p>
          <a
            href={item.proofUrl}
            target="_blank"
            rel="noreferrer"
            className="border border-dashed border-[var(--border)] rounded-xl p-4 flex flex-col items-center gap-2 bg-[var(--background-accent)] cursor-pointer hover:bg-[var(--secondary)] transition-colors"
          >
            <Icon
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              cls="w-8 h-8 text-[var(--muted-foreground)]"
            />
            <p className="text-xs text-[var(--muted-foreground)]">
              Click to view uploaded receipt
            </p>
            <span className="text-[11px] font-semibold text-[var(--primary)] underline">
              {item.proofFileName ?? "Open proof"}
            </span>
          </a>
        </div>

        {item.status === "rejected" && item.rejectReason && (
          <div className="px-5 py-4 border-b border-[var(--border)]">
            <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-widest font-semibold mb-2">
              Rejection Note
            </p>
            <p className="text-xs text-red-700 dark:text-red-300 leading-relaxed bg-red-500/10 rounded-lg p-3">
              {item.rejectReason}
            </p>
          </div>
        )}

        {rejectionHistory.length > 0 && (
          <div className="px-5 py-4 border-b border-[var(--border)] space-y-2.5">
            <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-widest font-semibold">
              Rejection History
            </p>
            {rejectionHistory.map((historyItem, index) => (
              <div
                key={historyItem.id ?? `${item.id}-rejection-${index}`}
                className="rounded-lg border border-red-500/20 bg-red-500/5 p-3"
              >
                <p className="text-xs text-red-700 dark:text-red-300 leading-relaxed">
                  {historyItem.reason ?? "-"}
                </p>
                <p className="text-[11px] text-[var(--muted-foreground)] mt-2">
                  Rejected by {historyItem.reviewedBy ?? "-"} on{" "}
                  {fmtDate(historyItem.reviewedAt ?? historyItem.submittedAt)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-4 border-t border-[var(--border)]">
        {item.status === "pending" && !rejectMode && (
          <div className="flex gap-2">
            <button
              onClick={() => setRejectMode(true)}
              className="flex-1 py-2.5 text-xs font-semibold border border-[var(--border)] text-[var(--foreground)] rounded-lg hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-300 hover:border-red-500/30 transition-colors"
            >
              Reject
            </button>
            <button
              onClick={() => onApprove(item.id)}
              className="flex-1 py-2.5 text-xs font-semibold bg-[var(--primary)] text-[var(--primary-foreground)] rounded-lg hover:bg-[var(--primary-hover)] transition-colors"
            >
              Confirm Payment
            </button>
          </div>
        )}

        {item.status === "pending" && rejectMode && (
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
                onClick={() => {
                  if (!rejectReason.trim()) return;
                  onReject(item.id, rejectReason.trim());
                }}
                disabled={!rejectReason.trim()}
                className="flex-1 py-2 text-xs font-semibold bg-red-600 text-white rounded-lg hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Send Rejection
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SystemFinance() {
  const { payments = [] } = usePage().props;
  const [selectedId, setSelectedId] = useState(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterMethod, setFilterMethod] = useState("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("newest");

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
        .reduce((sum, payment) => sum + payment.amount, 0),
    [payments],
  );

  const pendingRevenue = useMemo(
    () =>
      payments
        .filter((p) => p.status === "pending")
        .reduce((sum, payment) => sum + payment.amount, 0),
    [payments],
  );

  const methodOptions = useMemo(() => {
    return [
      ...new Set(payments.map((payment) => payment.method).filter(Boolean)),
    ];
  }, [payments]);

  const filtered = useMemo(() => {
    let list = payments;

    if (filterStatus !== "all") {
      list = list.filter((payment) => payment.status === filterStatus);
    }

    if (filterMethod !== "all") {
      list = list.filter((payment) => payment.method === filterMethod);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (payment) =>
          payment.studentName.toLowerCase().includes(q) ||
          payment.courseName.toLowerCase().includes(q) ||
          payment.id.toLowerCase().includes(q) ||
          payment.refCode.toLowerCase().includes(q),
      );
    }

    if (sortBy === "newest") {
      list = [...list].sort(
        (a, b) => new Date(b.submittedAt) - new Date(a.submittedAt),
      );
    }

    if (sortBy === "oldest") {
      list = [...list].sort(
        (a, b) => new Date(a.submittedAt) - new Date(b.submittedAt),
      );
    }

    if (sortBy === "highest") {
      list = [...list].sort((a, b) => b.amount - a.amount);
    }

    if (sortBy === "lowest") {
      list = [...list].sort((a, b) => a.amount - b.amount);
    }

    return list;
  }, [payments, filterMethod, filterStatus, search, sortBy]);

  const selectedPayment = useMemo(() => {
    if (!selectedId) return null;

    return payments.find((payment) => payment.id === selectedId) ?? null;
  }, [payments, selectedId]);

  const handleApprove = (id) => {
    router.patch(
      route("admin.finance.approve", { payment: id }),
      {},
      {
        preserveScroll: true,
        only: ["payments"],
      },
    );
  };

  const handleReject = (id, reason) => {
    router.patch(
      route("admin.finance.reject", { payment: id }),
      { reason },
      {
        preserveScroll: true,
        only: ["payments"],
      },
    );
  };

  return (
    <MainLayout>
      <div
        data-role="admin"
        className="flex h-screen bg-[var(--background)] overflow-hidden"
      >
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-auto p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-black text-[var(--foreground)] tracking-tight">
                  SYSTEM FINANCE
                </h1>
                <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
                  Manage enrollment payment confirmations from students.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
                <p className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider leading-tight">
                  Confirmed Revenue
                </p>
                <p className="text-2xl font-black text-[var(--foreground)] leading-none mt-3">
                  {fmt(totalRevenue)}
                </p>
                <p className="text-xs font-medium mt-1.5 text-emerald-600 dark:text-emerald-300">
                  {counts.approved} transactions
                </p>
              </div>
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
                <p className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider leading-tight">
                  Pending Amount
                </p>
                <p className="text-2xl font-black text-[var(--foreground)] leading-none mt-3">
                  {fmt(pendingRevenue)}
                </p>
                <p className="text-xs font-medium mt-1.5 text-[var(--primary)]">
                  {counts.pending} awaiting review
                </p>
              </div>
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
                <p className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider leading-tight">
                  Total Transactions
                </p>
                <p className="text-2xl font-black text-[var(--foreground)] leading-none mt-3">
                  {counts.all}
                </p>
                <p className="text-xs font-medium mt-1.5 text-[var(--muted-foreground)]">
                  All time
                </p>
              </div>
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
                <p className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider leading-tight">
                  Rejected Payments
                </p>
                <p className="text-2xl font-black text-[var(--foreground)] leading-none mt-3">
                  {counts.rejected}
                </p>
                <p className="text-xs font-medium mt-1.5 text-red-600 dark:text-red-300">
                  Need revision
                </p>
              </div>
            </div>

            <div className="flex gap-4" style={{ minHeight: "420px" }}>
              <div className="flex-1 bg-[var(--card)] border border-[var(--border)] rounded-xl flex flex-col overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)]">
                  <div className="flex border border-[var(--border)] rounded-lg overflow-hidden text-xs font-semibold">
                    {["all", "pending", "approved", "rejected"].map(
                      (status) => (
                        <button
                          key={status}
                          onClick={() => setFilterStatus(status)}
                          className={`px-3 py-1.5 capitalize transition-colors ${
                            filterStatus === status
                              ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                              : "text-[var(--muted-foreground)] hover:bg-[var(--secondary)]"
                          }`}
                        >
                          {status === "all"
                            ? `All (${counts.all})`
                            : `${status.charAt(0).toUpperCase() + status.slice(1)} (${counts[status]})`}
                        </button>
                      ),
                    )}
                  </div>

                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by student, course, trx, ref..."
                    className="ml-auto text-xs border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--ring)] w-64"
                  />

                  <select
                    value={filterMethod}
                    onChange={(e) => setFilterMethod(e.target.value)}
                    className="text-xs border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                  >
                    <option value="all">All Methods</option>
                    {methodOptions.map((method) => (
                      <option key={method} value={method}>
                        {method}
                      </option>
                    ))}
                  </select>

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

                <div className="flex-1 overflow-auto">
                  <table
                    className="w-full text-sm"
                    style={{ tableLayout: "fixed" }}
                  >
                    <colgroup>
                      <col style={{ width: "200px" }} />
                      <col style={{ width: "180px" }} />
                      <col style={{ width: "110px" }} />
                      <col style={{ width: "110px" }} />
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
                        ].map((header) => (
                          <th
                            key={header}
                            className="text-left px-4 py-3 text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-widest"
                          >
                            {header}
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
                            No transactions found
                          </td>
                        </tr>
                      ) : (
                        filtered.map((payment) => {
                          const isActive = selectedId === payment.id;

                          return (
                            <tr
                              key={payment.id}
                              onClick={() => setSelectedId(payment.id)}
                              className={`cursor-pointer transition-colors ${
                                isActive
                                  ? "bg-[var(--primary-soft)]"
                                  : "hover:bg-[var(--background-accent)]"
                              }`}
                            >
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2 min-w-0">
                                  <Avatar initials={payment.avatar} />
                                  <div className="min-w-0">
                                    <p
                                      className={`text-xs font-semibold truncate ${
                                        isActive
                                          ? "text-[var(--primary)]"
                                          : "text-[var(--foreground)]"
                                      }`}
                                    >
                                      {payment.studentName}
                                    </p>
                                    <p className="text-[10px] text-[var(--muted-foreground)] truncate">
                                      {payment.id}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <p className="text-xs text-[var(--foreground)] truncate font-medium">
                                  {payment.courseName}
                                </p>
                                <p className="text-[10px] text-[var(--muted-foreground)] truncate">
                                  {payment.instructor}
                                </p>
                              </td>
                              <td className="px-4 py-3">
                                <p className="text-xs font-bold text-[var(--foreground)]">
                                  {fmt(payment.amount)}
                                </p>
                              </td>
                              <td className="px-4 py-3">
                                <MethodBadge method={payment.method} />
                              </td>
                              <td className="px-4 py-3">
                                <p className="text-xs text-[var(--foreground)]">
                                  {fmtDate(payment.submittedAt)}
                                </p>
                                <p className="text-[10px] text-[var(--muted-foreground)]">
                                  {fmtTime(payment.submittedAt)}
                                </p>
                              </td>
                              <td className="px-4 py-3">
                                <StatusBadge status={payment.status} />
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

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
                </div>
              </div>

              {selectedPayment && (
                <DetailDrawer
                  item={selectedPayment}
                  onClose={() => setSelectedId(null)}
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
