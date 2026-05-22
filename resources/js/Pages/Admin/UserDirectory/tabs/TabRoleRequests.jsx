import { useState } from "react";
import Icon from "@/Components/ui/Icon";
import { Avatar } from "@/Components/ui/avatar";
import RoleBadge from "@/Components/ui/RoleBadge";
import { STATUS_CFG } from "../config/status";
import EmptyState from "../components/EmptyState";
import { fmtDate } from "../utils/format";

export default function TabRoleRequests({ requests, setRequests }) {
  const [filter, setFilter] = useState("pending");
  const [selected, setSelected] = useState(null);
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const filtered =
    filter === "all" ? requests : requests.filter((r) => r.status === filter);
  const counts = {
    all: requests.length,
    pending: requests.filter((r) => r.status === "pending").length,
    approved: requests.filter((r) => r.status === "approved").length,
    rejected: requests.filter((r) => r.status === "rejected").length,
  };

  const selectedLive = selected
    ? (requests.find((r) => r.id === selected.id) ?? selected)
    : null;

  const handleApprove = (id) => {
    setRequests((p) =>
      p.map((r) =>
        r.id === id
          ? {
              ...r,
              status: "approved",
              approvedBy: "Super Admin",
              approvedAt: new Date().toISOString(),
            }
          : r,
      ),
    );
  };

  const handleReject = (id, reason) => {
    setRequests((p) =>
      p.map((r) =>
        r.id === id
          ? {
              ...r,
              status: "rejected",
              rejectedBy: "Super Admin",
              rejectedAt: new Date().toISOString(),
              rejectReason: reason,
            }
          : r,
      ),
    );
    setRejectMode(false);
    setRejectReason("");
  };

  return (
    <div className="flex gap-4 flex-1 overflow-hidden">
      {/* List */}
      <div className="flex-1 bg-[var(--card)] border border-[var(--border)] rounded-xl flex flex-col overflow-hidden">
        {/* Filter tabs */}
        <div className="flex border-b border-[var(--border)] px-4">
          {["all", "pending", "approved", "rejected"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider transition-colors relative capitalize ${filter === f ? "text-[var(--primary)]" : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"}`}
            >
              {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
              <span
                className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] ${filter === f ? "bg-[var(--primary-soft)] text-[var(--primary)]" : "bg-[var(--secondary)] text-[var(--muted-foreground)]"}`}
              >
                {counts[f]}
              </span>
              {filter === f && (
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
            filtered.map((req) => {
              const active = selectedLive?.id === req.id;
              const sc = STATUS_CFG[req.status];
              return (
                <div
                  key={req.id}
                  onClick={() => {
                    setSelected(req);
                    setRejectMode(false);
                    setRejectReason("");
                  }}
                  className={`flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-colors ${active ? "bg-[var(--primary-soft)]" : "hover:bg-[var(--background-accent)]"}`}
                >
                  <Avatar initials={req.avatar} />
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-xs font-semibold truncate ${active ? "text-[var(--primary)]" : "text-[var(--foreground)]"}`}
                    >
                      {req.userName}
                    </p>
                    <p className="text-[10px] text-[var(--muted-foreground)] truncate">
                      {req.expertise}
                    </p>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${sc.pill}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                      {sc.label}
                    </span>
                    <span className="text-[10px] text-[var(--muted-foreground)]">
                      {fmtDate(req.submittedAt)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Detail */}
      {selectedLive && (
        <div className="w-80 shrink-0 bg-[var(--card)] border border-[var(--border)] rounded-xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
            <p className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-widest">
              Request Detail
            </p>
            <button
              onClick={() => setSelected(null)}
              className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            >
              <Icon d="M6 18L18 6M6 6l12 12" cls="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* Applicant */}
            <div className="px-5 py-4 border-b border-[var(--border)]">
              <div className="flex items-center gap-3 mb-2">
                <Avatar initials={selectedLive.avatar} size="md" />
                <div>
                  <p className="text-sm font-bold text-[var(--foreground)]">
                    {selectedLive.userName}
                  </p>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {selectedLive.userEmail}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <RoleBadge role={selectedLive.currentRole} />
                <Icon
                  d="M13 7l5 5m0 0l-5 5m5-5H6"
                  cls="w-3 h-3 text-[var(--muted-foreground)]"
                />
                <RoleBadge role={selectedLive.requestedRole} />
              </div>
            </div>

            {/* Details */}
            <div className="px-5 py-4 border-b border-[var(--border)] space-y-3">
              {[
                ["Expertise", selectedLive.expertise],
                ["Experience", selectedLive.experience],
                ["Portfolio", selectedLive.portfolio || "—"],
                ["LinkedIn", selectedLive.linkedIn || "—"],
              ].map(([l, v]) => (
                <div key={l}>
                  <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold">
                    {l}
                  </p>
                  <p className="text-xs text-[var(--foreground)] mt-0.5">{v}</p>
                </div>
              ))}
              <div>
                <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold">
                  Reason
                </p>
                <p className="text-xs text-[var(--foreground)] mt-0.5 leading-relaxed italic">
                  "{selectedLive.reason}"
                </p>
              </div>
            </div>

            {selectedLive.status === "approved" && (
              <div className="px-5 py-4 border-b border-[var(--border)]">
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                  Approved by {selectedLive.approvedBy} on{" "}
                  {fmtDate(selectedLive.approvedAt)}
                </p>
              </div>
            )}
            {selectedLive.status === "rejected" && (
              <div className="px-5 py-4 border-b border-[var(--border)]">
                <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-widest font-semibold mb-1.5">
                  Rejection Note
                </p>
                <p className="text-xs text-red-600 dark:text-red-400 leading-relaxed bg-red-50 dark:bg-red-950/30 rounded-lg p-3">
                  {selectedLive.rejectReason}
                </p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="p-4 border-t border-[var(--border)]">
            {selectedLive.status === "pending" && !rejectMode && (
              <div className="flex gap-2">
                <button
                  onClick={() => setRejectMode(true)}
                  className="flex-1 py-2.5 text-xs font-semibold border border-[var(--border)] rounded-lg text-[var(--foreground)] hover:bg-red-50 hover:text-red-600 hover:border-red-200 dark:hover:bg-red-950/30 transition-colors"
                >
                  Reject
                </button>
                <button
                  onClick={() => handleApprove(selectedLive.id)}
                  className="flex-1 py-2.5 text-xs font-semibold bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors"
                >
                  Approve
                </button>
              </div>
            )}
            {selectedLive.status === "pending" && rejectMode && (
              <div className="space-y-2">
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Rejection reason (required)..."
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
                    onClick={() => handleReject(selectedLive.id, rejectReason)}
                    disabled={!rejectReason.trim()}
                    className="flex-1 py-2 text-xs font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Send
                  </button>
                </div>
              </div>
            )}
            {selectedLive.status !== "pending" && (
              <div
                className={`flex items-center justify-center gap-2 py-2.5 rounded-lg ${selectedLive.status === "approved" ? "bg-emerald-50 dark:bg-emerald-950/30" : "bg-red-50 dark:bg-red-950/30"}`}
              >
                <span
                  className={`text-xs font-semibold ${selectedLive.status === "approved" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
                >
                  Request{" "}
                  {selectedLive.status === "approved" ? "Approved" : "Rejected"}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
