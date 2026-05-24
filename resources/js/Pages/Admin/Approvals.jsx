import MainLayout from "@/Layouts/MainLayout";
import { router, usePage } from "@inertiajs/react";
import { useEffect, useMemo, useState } from "react";

const STATUS_CFG = {
  pending: {
    label: "Pending",
    pill: "bg-[var(--primary-soft)] text-[var(--primary-soft-foreground)]",
    dot: "bg-[var(--primary)]",
  },
  approved: {
    label: "Approved",
    pill: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  rejected: {
    label: "Rejected",
    pill: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
    dot: "bg-red-500",
  },
};

const fmtCurrency = (value) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));

const fmtDateTime = (iso) => {
  if (!iso) {
    return "-";
  }

  return new Date(iso).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const initials = (name) => {
  const parts = String(name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return "NA";
  }

  return `${parts[0][0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
};

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

export default function Approvals() {
  const { requests = [] } = usePage().props;
  const [activeFilter, setActiveFilter] = useState("pending");
  const [selectedId, setSelectedId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const defaultSelectionId = useMemo(() => {
    return (
      requests.find((item) => item.status === "pending")?.id ??
      requests[0]?.id ??
      null
    );
  }, [requests]);

  useEffect(() => {
    if (defaultSelectionId === null) {
      setSelectedId(null);
      return;
    }

    if (!selectedId || !requests.some((item) => item.id === selectedId)) {
      setSelectedId(defaultSelectionId);
    }
  }, [defaultSelectionId, requests, selectedId]);

  const counts = useMemo(
    () => ({
      all: requests.length,
      pending: requests.filter((item) => item.status === "pending").length,
      approved: requests.filter((item) => item.status === "approved").length,
      rejected: requests.filter((item) => item.status === "rejected").length,
    }),
    [requests],
  );

  const filtered = useMemo(() => {
    return requests.filter((item) => {
      const matchStatus =
        activeFilter === "all" || item.status === activeFilter;
      const keyword = searchQuery.trim().toLowerCase();

      if (!keyword) {
        return matchStatus;
      }

      const matchKeyword =
        item.title?.toLowerCase().includes(keyword) ||
        item.instructor?.toLowerCase().includes(keyword) ||
        item.category?.toLowerCase().includes(keyword);

      return matchStatus && matchKeyword;
    });
  }, [activeFilter, requests, searchQuery]);

  const selectedItem = useMemo(
    () => requests.find((item) => item.id === selectedId) ?? null,
    [requests, selectedId],
  );

  const closeRejectMode = () => {
    setRejectMode(false);
    setRejectReason("");
  };

  const handleApprove = () => {
    if (!selectedItem || selectedItem.status !== "pending" || submitting) {
      return;
    }

    setSubmitting(true);
    router.patch(
      route("admin.approval.approve", {
        coursePublishRequest: selectedItem.id,
      }),
      {},
      {
        preserveScroll: true,
        only: ["requests"],
        onSuccess: closeRejectMode,
        onFinish: () => setSubmitting(false),
      },
    );
  };

  const handleReject = () => {
    if (
      !selectedItem ||
      selectedItem.status !== "pending" ||
      !rejectReason.trim() ||
      submitting
    ) {
      return;
    }

    setSubmitting(true);
    router.patch(
      route("admin.approval.reject", {
        coursePublishRequest: selectedItem.id,
      }),
      {
        reason: rejectReason.trim(),
      },
      {
        preserveScroll: true,
        only: ["requests"],
        onSuccess: closeRejectMode,
        onFinish: () => setSubmitting(false),
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
                  COURSE APPROVALS
                </h1>
                <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
                  Review and decide publish requests from instructors.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
                <p className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                  Total Requests
                </p>
                <p className="text-2xl font-black text-[var(--foreground)] mt-3">
                  {counts.all}
                </p>
              </div>
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
                <p className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                  Pending
                </p>
                <p className="text-2xl font-black text-[var(--foreground)] mt-3">
                  {counts.pending}
                </p>
              </div>
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
                <p className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                  Approved
                </p>
                <p className="text-2xl font-black text-[var(--foreground)] mt-3">
                  {counts.approved}
                </p>
              </div>
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
                <p className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                  Rejected
                </p>
                <p className="text-2xl font-black text-[var(--foreground)] mt-3">
                  {counts.rejected}
                </p>
              </div>
            </div>

            <div className="flex gap-4 min-h-[420px]">
              <div className="flex-1 bg-[var(--card)] border border-[var(--border)] rounded-xl flex flex-col overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)]">
                  <div className="flex border border-[var(--border)] rounded-lg overflow-hidden text-xs font-semibold">
                    {["all", "pending", "approved", "rejected"].map(
                      (status) => (
                        <button
                          key={status}
                          onClick={() => setActiveFilter(status)}
                          className={`px-3 py-1.5 capitalize transition-colors ${
                            activeFilter === status
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
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search title, instructor, category..."
                    className="ml-auto text-xs border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--ring)] w-64"
                  />
                </div>

                <div className="flex-1 overflow-y-auto divide-y divide-[var(--border)]">
                  {filtered.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-sm text-[var(--muted-foreground)]">
                      No requests found
                    </div>
                  ) : (
                    filtered.map((item) => {
                      const active = selectedItem?.id === item.id;

                      return (
                        <div
                          key={item.id}
                          onClick={() => {
                            setSelectedId(item.id);
                            closeRejectMode();
                          }}
                          className={`flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-colors ${
                            active
                              ? "bg-[var(--primary-soft)]"
                              : "hover:bg-[var(--background-accent)]"
                          }`}
                        >
                          <div className="w-10 h-10 rounded-full bg-[var(--primary-soft)] text-[var(--primary)] text-xs font-bold flex items-center justify-center">
                            {initials(item.instructor)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p
                              className={`text-sm font-semibold truncate ${
                                active
                                  ? "text-[var(--primary)]"
                                  : "text-[var(--foreground)]"
                              }`}
                            >
                              {item.title}
                            </p>
                            <p className="text-xs text-[var(--muted-foreground)] truncate">
                              {item.instructor} - {item.category}
                            </p>
                          </div>
                          <div className="shrink-0 flex flex-col items-end gap-1">
                            <StatusBadge status={item.status} />
                            <span className="text-[10px] text-[var(--muted-foreground)]">
                              {fmtDateTime(item.submittedAt)}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {selectedItem && (
                <div className="w-80 shrink-0 bg-[var(--card)] border border-[var(--border)] rounded-xl flex flex-col overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
                    <p className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-widest">
                      Request Detail
                    </p>
                    <StatusBadge status={selectedItem.status} />
                  </div>

                  <div className="flex-1 overflow-y-auto">
                    <div className="px-5 py-4 border-b border-[var(--border)]">
                      <p className="text-sm font-bold text-[var(--foreground)] leading-snug">
                        {selectedItem.title}
                      </p>
                      <p className="text-xs text-[var(--muted-foreground)] mt-1">
                        {selectedItem.instructor} - {selectedItem.category}
                      </p>
                      <p className="text-xs text-[var(--muted-foreground)] mt-2">
                        Submitted: {fmtDateTime(selectedItem.submittedAt)}
                      </p>
                    </div>

                    <div className="px-5 py-4 border-b border-[var(--border)]">
                      <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-widest font-semibold mb-2">
                        Description
                      </p>
                      <p className="text-xs text-[var(--foreground)] leading-relaxed">
                        {selectedItem.description || "-"}
                      </p>
                    </div>

                    <div className="px-5 py-4 border-b border-[var(--border)] space-y-2.5">
                      <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-widest font-semibold">
                        Submitted Pricing Snapshot
                      </p>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-[var(--muted-foreground)]">
                          Base Price
                        </span>
                        <span className="text-xs font-semibold text-[var(--foreground)]">
                          {fmtCurrency(selectedItem.submittedPrice)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-[var(--muted-foreground)]">
                          Discount
                        </span>
                        <span className="text-xs font-semibold text-[var(--foreground)]">
                          {selectedItem.submittedDiscountType === "percentage"
                            ? `${selectedItem.submittedDiscount}%`
                            : fmtCurrency(selectedItem.submittedDiscount)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-[var(--muted-foreground)]">
                          Final Price
                        </span>
                        <span className="text-xs font-semibold text-[var(--foreground)]">
                          {fmtCurrency(selectedItem.submittedFinalPrice)}
                        </span>
                      </div>
                    </div>

                    {selectedItem.status !== "pending" && (
                      <div className="px-5 py-4 border-b border-[var(--border)] space-y-2">
                        <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-widest font-semibold">
                          Review Result
                        </p>
                        <p className="text-xs text-[var(--foreground)]">
                          Reviewed by {selectedItem.reviewedBy ?? "-"}
                        </p>
                        <p className="text-xs text-[var(--foreground)]">
                          Reviewed at {fmtDateTime(selectedItem.reviewedAt)}
                        </p>
                        {selectedItem.status === "rejected" && (
                          <p className="text-xs text-red-700 bg-red-500/10 dark:text-red-300 rounded-lg p-2.5 leading-relaxed">
                            {selectedItem.rejectReason ||
                              "No rejection reason."}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="p-4 border-t border-[var(--border)]">
                    {selectedItem.status === "pending" && !rejectMode && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => setRejectMode(true)}
                          disabled={submitting}
                          className="flex-1 py-2.5 text-xs font-semibold border border-[var(--border)] rounded-lg text-[var(--foreground)] hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-300 hover:border-red-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          Reject
                        </button>
                        <button
                          onClick={handleApprove}
                          disabled={submitting}
                          className="flex-1 py-2.5 text-xs font-semibold bg-[var(--primary)] text-[var(--primary-foreground)] rounded-lg hover:bg-[var(--primary-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          Approve
                        </button>
                      </div>
                    )}

                    {selectedItem.status === "pending" && rejectMode && (
                      <div className="space-y-2">
                        <textarea
                          value={rejectReason}
                          onChange={(event) =>
                            setRejectReason(event.target.value)
                          }
                          placeholder="Rejection reason (required)..."
                          rows={3}
                          className="w-full text-xs p-2.5 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={closeRejectMode}
                            disabled={submitting}
                            className="flex-1 py-2 text-xs font-medium border border-[var(--border)] rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--secondary)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleReject}
                            disabled={!rejectReason.trim() || submitting}
                            className="flex-1 py-2 text-xs font-semibold bg-red-600 text-white rounded-lg hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            Send
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
