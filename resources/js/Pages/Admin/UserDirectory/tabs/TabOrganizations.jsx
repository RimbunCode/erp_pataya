import { useMemo, useState } from "react";
import Icon from "@/Components/ui/Icon";
import { Avatar, AvatarFallback } from "@/Components/ui/avatar";
import StatusBadge from "@/Components/ui/StatusBadge";
import EmptyState from "../components/EmptyState";
import InviteOrganizationModal from "../components/InviteOrganizationModal";
import ReviewOrganizationDialog from "../components/ReviewOrganizationDialog";
import { fmtDate, fmtTime } from "../utils/format";

const SECTION_KEYS = ["submitted", "invited", "approved", "rejected"];
const SECTION_LABELS = {
  submitted: "Pending Review",
  invited: "Invited",
  approved: "Approved",
  rejected: "Rejected",
};

function OrgAvatar({ name }) {
  const initials = (name ?? "?")
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <Avatar className="w-8 h-8 text-[10px]">
      <AvatarFallback>{initials}</AvatarFallback>
    </Avatar>
  );
}

export default function TabOrganizations({ orgs = [], orgsMeta = null }) {
  const [selectedId, setSelectedId] = useState(null);
  const [showInvite, setShowInvite] = useState(false);
  const [showReview, setShowReview] = useState(false);

  const grouped = useMemo(() => {
    const buckets = {};
    for (const key of SECTION_KEYS) {
      buckets[key] = [];
    }
    for (const org of orgs) {
      if (buckets[org.status]) {
        buckets[org.status].push(org);
      }
    }
    return buckets;
  }, [orgs]);

  const selectedOrg = useMemo(
    () => orgs.find((o) => o.id === selectedId) ?? null,
    [orgs, selectedId],
  );

  return (
    <div className="flex gap-4 flex-1 overflow-hidden">
      {/* LEFT — list panel */}
      <div className="flex-1 bg-[var(--card)] border border-[var(--border)] rounded-xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <p className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-widest">
            Organizations ({orgs.length})
          </p>
          <button
            onClick={() => setShowInvite(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)] transition-colors"
          >
            <Icon d="M12 4v16m8-8H4" cls="w-3.5 h-3.5" />
            Invite
          </button>
        </div>

        <div className="flex-1 overflow-auto divide-y divide-[var(--border)]">
          {orgs.length === 0 ? (
            <EmptyState
              icon="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              text="No organizations yet. Send an invitation to get started."
            />
          ) : (
            SECTION_KEYS.map((sectionKey) => {
              const items = grouped[sectionKey];
              if (items.length === 0) {
                return null;
              }

              return (
                <div key={sectionKey}>
                  <div className="px-4 py-2 bg-[var(--background-accent)] sticky top-0 z-10">
                    <p className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-widest">
                      {SECTION_LABELS[sectionKey]} ({items.length})
                    </p>
                  </div>
                  <div className="divide-y divide-[var(--border)]">
                    {items.map((org) => {
                      const active = selectedId === org.id;
                      return (
                        <div
                          key={org.id}
                          onClick={() => setSelectedId(org.id)}
                          className={`px-4 py-3.5 cursor-pointer transition-colors ${active ? "bg-[var(--primary-soft)]" : "hover:bg-[var(--background-accent)]"}`}
                        >
                          <div className="flex items-start gap-3">
                            <OrgAvatar name={org.organizationName} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p
                                  className={`text-xs font-semibold truncate ${active ? "text-[var(--primary)]" : "text-[var(--foreground)]"}`}
                                >
                                  {org.organizationName}
                                </p>
                                <StatusBadge status={org.status} />
                                {org.isExpired && (
                                  <span className="text-[9px] font-bold uppercase text-red-500">
                                    Expired
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5 truncate">
                                {org.email} &middot; {org.contactPerson}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT — detail panel */}
      {selectedOrg && (
        <div className="w-80 shrink-0 bg-[var(--card)] border border-[var(--border)] rounded-xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
            <p className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-widest">
              Organization Detail
            </p>
            <button
              onClick={() => setSelectedId(null)}
              className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            >
              <Icon d="M6 18L18 6M6 6l12 12" cls="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            <div className="flex items-center gap-3">
              <OrgAvatar name={selectedOrg.organizationName} />
              <div className="min-w-0">
                <p className="text-sm font-bold text-[var(--foreground)] truncate">
                  {selectedOrg.organizationName}
                </p>
                <p className="text-xs text-[var(--muted-foreground)] truncate">
                  {selectedOrg.email}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-1">
              <StatusBadge status={selectedOrg.status} />
              {selectedOrg.isExpired && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300">
                  Expired
                </span>
              )}
            </div>

            <div className="space-y-2">
              {[
                ["Contact Person", selectedOrg.contactPerson],
                ["Address", selectedOrg.address],
                ["Phone", selectedOrg.phone],
                ["Website", selectedOrg.website],
                ["Industry", selectedOrg.industry],
                ["Employees", selectedOrg.employeeCount],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex justify-between items-start gap-3"
                >
                  <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider shrink-0">
                    {label}
                  </p>
                  <p className="text-xs text-[var(--foreground)] text-right truncate">
                    {value || "—"}
                  </p>
                </div>
              ))}
            </div>

            <hr className="border-[var(--border)]" />

            <div className="space-y-2">
              {[
                ["Invited By", selectedOrg.invitedBy],
                [
                  "Invited At",
                  selectedOrg.invitedAt
                    ? `${fmtDate(selectedOrg.invitedAt)}, ${fmtTime(selectedOrg.invitedAt)}`
                    : null,
                ],
                [
                  "Submitted At",
                  selectedOrg.submittedAt
                    ? `${fmtDate(selectedOrg.submittedAt)}, ${fmtTime(selectedOrg.submittedAt)}`
                    : null,
                ],
                ["Reviewed By", selectedOrg.reviewedBy],
                [
                  "Reviewed At",
                  selectedOrg.reviewedAt
                    ? `${fmtDate(selectedOrg.reviewedAt)}, ${fmtTime(selectedOrg.reviewedAt)}`
                    : null,
                ],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex justify-between items-start gap-3"
                >
                  <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider shrink-0">
                    {label}
                  </p>
                  <p className="text-xs text-[var(--foreground)] text-right">
                    {value || "—"}
                  </p>
                </div>
              ))}

              {selectedOrg.rejectionReason && (
                <div>
                  <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider mb-1">
                    Rejection Reason
                  </p>
                  <p className="text-xs text-red-500 italic">
                    {selectedOrg.rejectionReason}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="px-5 py-3 border-t border-[var(--border)]">
            <button
              onClick={() => setShowReview(true)}
              className="w-full py-2.5 rounded-lg text-xs font-semibold bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)] transition-colors"
            >
              {selectedOrg.status === "submitted"
                ? "Review Submission"
                : selectedOrg.status === "invited"
                  ? "Manage Invitation"
                  : "View Details"}
            </button>
          </div>
        </div>
      )}

      {showInvite && (
        <InviteOrganizationModal onClose={() => setShowInvite(false)} />
      )}
      {showReview && selectedOrg && (
        <ReviewOrganizationDialog
          org={selectedOrg}
          onClose={() => setShowReview(false)}
        />
      )}
    </div>
  );
}
import Icon from "@/Components/ui/Icon";

export default function TabOrganizations({ orgs = [], orgsMeta = null }) {
  const isReady = Boolean(orgsMeta?.ready);

  return (
    <div className="flex-1 bg-[var(--card)] border border-[var(--border)] rounded-xl p-6 overflow-auto">
      <div className="max-w-3xl">
        <p className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-widest">
          Organizations
        </p>
        <h2 className="mt-2 text-xl font-black text-[var(--foreground)] tracking-tight uppercase">
          Backend Integration {isReady ? "Ready" : "Pending"}
        </h2>
        <p className="mt-2 text-sm text-[var(--muted-foreground)] leading-relaxed">
          {orgsMeta?.message ??
            "Organizations tab is currently a placeholder and will be connected to backend data in the next implementation phase."}
        </p>

        <div className="mt-6 rounded-xl border border-dashed border-[var(--border)] bg-[var(--background-accent)] p-6">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--secondary)] flex items-center justify-center">
              <Icon
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                cls="w-5 h-5 text-[var(--muted-foreground)]"
              />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-[var(--foreground)]">
                Placeholder Mode
              </p>
              <p className="mt-1 text-xs text-[var(--muted-foreground)] leading-relaxed">
                Existing data count:{" "}
                <span className="font-semibold text-[var(--foreground)]">
                  {orgs.length}
                </span>
                . CRUD actions are intentionally disabled until organization
                endpoints are implemented.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
