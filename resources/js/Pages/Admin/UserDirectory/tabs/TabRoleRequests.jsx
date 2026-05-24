import { useMemo, useState } from "react";
import { router } from "@inertiajs/react";
import Icon from "@/Components/ui/Icon";
import { Avatar } from "@/Components/ui/avatar";
import RoleBadge from "@/Components/ui/RoleBadge";
import { STATUS_CFG } from "../config/status";
import EmptyState from "../components/EmptyState";
import { fmtDate } from "../utils/format";

const FILTERS = ["all", "pending", "approved", "rejected"];

export default function TabRoleRequests({ requests }) {
  const [filter, setFilter] = useState("pending");
  const [selectedId, setSelectedId] = useState(null);
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const filtered = useMemo(() => {
    if (filter === "all") {
      return requests;
    }

    return requests.filter((requestItem) => requestItem.status === filter);
  }, [filter, requests]);

  const counts = useMemo(
    () => ({
      all: requests.length,
      pending: requests.filter(
        (requestItem) => requestItem.status === "pending",
      ).length,
      approved: requests.filter(
        (requestItem) => requestItem.status === "approved",
      ).length,
      rejected: requests.filter(
        (requestItem) => requestItem.status === "rejected",
      ).length,
    }),
    [requests],
  );

  const selectedRequest = useMemo(() => {
    if (!selectedId) {
      return null;
    }

    return (
      requests.find((requestItem) => requestItem.id === selectedId) ?? null
    );
  }, [requests, selectedId]);

  const closeRejectMode = () => {
    setRejectMode(false);
    setRejectReason("");
  };

  const handleApprove = () => {
    if (!selectedRequest || submitting) {
      return;
    }

    setSubmitting(true);
    router.patch(
      route("admin.user.requests.approve", {
        roleRequest: selectedRequest.id,
      }),
      {},
      {
        preserveScroll: true,
        only: ["users", "requests", "admins"],
        onSuccess: () => {
          closeRejectMode();
        },
        onFinish: () => {
          setSubmitting(false);
        },
      },
    );
  };

  const handleReject = () => {
    if (!selectedRequest || !rejectReason.trim() || submitting) {
      return;
    }

    setSubmitting(true);
    router.patch(
      route("admin.user.requests.reject", {
        roleRequest: selectedRequest.id,
      }),
      {
        reason: rejectReason.trim(),
      },
      {
        preserveScroll: true,
        only: ["users", "requests", "admins"],
        onSuccess: () => {
          closeRejectMode();
        },
        onFinish: () => {
          setSubmitting(false);
        },
      },
    );
  };

  return (
    <div className="flex gap-4 flex-1 overflow-hidden">
      <div className="flex-1 bg-[var(--card)] border border-[var(--border)] rounded-xl flex flex-col overflow-hidden">
        <div className="flex border-b border-[var(--border)] px-4">
          {FILTERS.map((filterKey) => (
            <button
              key={filterKey}
              onClick={() => setFilter(filterKey)}
              className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider transition-colors relative capitalize ${filter === filterKey ? "text-[var(--primary)]" : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"}`}
            >
              {filterKey}
              <span
                className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] ${filter === filterKey ? "bg-[var(--primary-soft)] text-[var(--primary)]" : "bg-[var(--secondary)] text-[var(--muted-foreground)]"}`}
              >
                {counts[filterKey]}
              </span>
              {filter === filterKey && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--primary)] rounded-t" />
              )}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-[var(--border)]">
          {filtered.length === 0 ? (
            <EmptyState
              icon="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              text="No requests found"
            />
          ) : (
            filtered.map((requestItem) => {
              const active = selectedRequest?.id === requestItem.id;
              const statusConfig =
                STATUS_CFG[requestItem.status] ?? STATUS_CFG.pending;

              return (
                <div
                  key={requestItem.id}
                  onClick={() => {
                    setSelectedId(requestItem.id);
                    closeRejectMode();
                  }}
                  className={`flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-colors ${active ? "bg-[var(--primary-soft)]" : "hover:bg-[var(--background-accent)]"}`}
                >
                  <Avatar initials={requestItem.avatar} />
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-xs font-semibold truncate ${active ? "text-[var(--primary)]" : "text-[var(--foreground)]"}`}
                    >
                      {requestItem.userName}
                    </p>
                    <p className="text-[10px] text-[var(--muted-foreground)] truncate">
                      {requestItem.userEmail}
                    </p>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${statusConfig.pill}`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`}
                      />
                      {statusConfig.label}
                    </span>
                    <span className="text-[10px] text-[var(--muted-foreground)]">
                      {fmtDate(requestItem.submittedAt)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {selectedRequest && (
        <div className="w-80 shrink-0 bg-[var(--card)] border border-[var(--border)] rounded-xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
            <p className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-widest">
              Request Detail
            </p>
            <button
              onClick={() => {
                setSelectedId(null);
                closeRejectMode();
              }}
              className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            >
              <Icon d="M6 18L18 6M6 6l12 12" cls="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="px-5 py-4 border-b border-[var(--border)]">
              <div className="flex items-center gap-3 mb-2">
                <Avatar initials={selectedRequest.avatar} size="md" />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[var(--foreground)] truncate">
                    {selectedRequest.userName}
                  </p>
                  <p className="text-xs text-[var(--muted-foreground)] truncate">
                    {selectedRequest.userEmail}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <RoleBadge role={selectedRequest.currentRole} />
                <Icon
                  d="M13 7l5 5m0 0l-5 5m5-5H6"
                  cls="w-3 h-3 text-[var(--muted-foreground)]"
                />
                <RoleBadge role={selectedRequest.requestedRole} />
              </div>
            </div>

            <div className="px-5 py-4 border-b border-[var(--border)] space-y-3">
              <div>
                <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold">
                  Submitted At
                </p>
                <p className="text-xs text-[var(--foreground)] mt-0.5">
                  {fmtDate(selectedRequest.submittedAt)}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold">
                  Reason
                </p>
                <p className="text-xs text-[var(--foreground)] mt-0.5 leading-relaxed">
                  {selectedRequest.reason}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold">
                  Proof File
                </p>
                {selectedRequest.proofUrl ? (
                  <a
                    href={selectedRequest.proofUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block text-xs font-semibold text-[var(--primary)] hover:underline"
                  >
                    {selectedRequest.proofFileName ?? "Open proof file"}
                  </a>
                ) : (
                  <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                    No proof file.
                  </p>
                )}
              </div>
            </div>

            {selectedRequest.status === "approved" && (
              <div className="px-5 py-4 border-b border-[var(--border)]">
                <p className="text-xs text-emerald-600 dark:text-emerald-300 font-medium leading-relaxed">
                  Approved by {selectedRequest.approvedBy ?? "-"} on{" "}
                  {fmtDate(selectedRequest.approvedAt)}
                </p>
              </div>
            )}

            {selectedRequest.status === "rejected" && (
              <div className="px-5 py-4 border-b border-[var(--border)]">
                <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-widest font-semibold mb-1.5">
                  Rejection Note
                </p>
                <p className="text-xs text-red-700 dark:text-red-300 leading-relaxed bg-red-500/10 rounded-lg p-3">
                  {selectedRequest.rejectReason ?? "-"}
                </p>
                <p className="text-[11px] text-[var(--muted-foreground)] mt-2">
                  Rejected by {selectedRequest.rejectedBy ?? "-"} on{" "}
                  {fmtDate(selectedRequest.rejectedAt)}
                </p>
              </div>
            )}
          </div>

          <div className="p-4 border-t border-[var(--border)]">
            {selectedRequest.status === "pending" && !rejectMode && (
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

            {selectedRequest.status === "pending" && rejectMode && (
              <div className="space-y-2">
                <textarea
                  value={rejectReason}
                  onChange={(event) => setRejectReason(event.target.value)}
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

            {selectedRequest.status !== "pending" && (
              <div
                className={`flex items-center justify-center gap-2 py-2.5 rounded-lg ${selectedRequest.status === "approved" ? "bg-emerald-100 dark:bg-emerald-500/15" : "bg-red-100 dark:bg-red-500/15"}`}
              >
                <span
                  className={`text-xs font-semibold ${selectedRequest.status === "approved" ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"}`}
                >
                  Request{" "}
                  {selectedRequest.status === "approved"
                    ? "Approved"
                    : "Rejected"}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
