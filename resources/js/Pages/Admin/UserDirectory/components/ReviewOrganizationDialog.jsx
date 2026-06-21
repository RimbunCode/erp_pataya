import { useState } from "react";
import { router } from "@inertiajs/react";
import Icon from "@/Components/ui/Icon";

export default function ReviewOrganizationDialog({ org, onClose }) {
  const [mode, setMode] = useState(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleAction = (action) => {
    if (action === "reject" && !reason.trim()) return;

    setSubmitting(true);
    router.patch(
      route("admin.user.organizations.review", { invitation: org.id }),
      {
        action,
        reason: action === "reject" ? reason : null,
      },
      {
        preserveScroll: true,
        only: ["orgs"],
        onFinish: () => {
          setSubmitting(false);
          onClose();
        },
      },
    );
  };

  const handleResend = () => {
    setSubmitting(true);
    router.post(
      route("admin.user.organizations.resend", { invitation: org.id }),
      {},
      {
        preserveScroll: true,
        only: ["orgs"],
        onFinish: () => {
          setSubmitting(false);
          onClose();
        },
      },
    );
  };

  const handleCancel = () => {
    if (!confirm("Are you sure you want to cancel this invitation?")) return;
    setSubmitting(true);
    router.delete(
      route("admin.user.organizations.destroy", { invitation: org.id }),
      {
        preserveScroll: true,
        only: ["orgs"],
        onFinish: () => {
          setSubmitting(false);
          onClose();
        },
      },
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-background/70 backdrop-blur-sm">
      <div className="bg-card text-card-foreground rounded-2xl border border-border shadow-2xl w-full max-w-lg p-6 relative max-h-[85vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
        >
          <Icon d="M6 18L18 6M6 6l12 12" cls="w-5 h-5" />
        </button>

        <h2 className="text-lg font-black text-foreground uppercase tracking-tight mb-1">
          {org.organizationName}
        </h2>
        <p className="text-xs text-muted-foreground mb-4">{org.email}</p>

        {mode === null && (
          <div className="space-y-3">
            {org.status === "submitted" && (
              <>
                <div className="rounded-lg border border-border p-4 space-y-2">
                  <p className="text-xs font-semibold text-foreground uppercase tracking-widest">
                    Organization Details
                  </p>
                  {[
                    ["Contact Person", org.contactPerson],
                    ["Address", org.address || "—"],
                    ["Phone", org.phone || "—"],
                    ["Website", org.website || "—"],
                    ["Industry", org.industry || "—"],
                    ["Employees", org.employeeCount || "—"],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-3">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                        {label}
                      </span>
                      <span className="text-xs text-foreground text-right max-w-[200px] truncate">
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAction("approve")}
                    disabled={submitting}
                    className="flex-1 py-2.5 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                  >
                    {submitting ? "Processing..." : "Approve & Create Account"}
                  </button>
                  <button
                    onClick={() => setMode("reject")}
                    disabled={submitting}
                    className="flex-1 py-2.5 rounded-lg text-xs font-bold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                  >
                    Reject
                  </button>
                </div>
              </>
            )}

            {org.status === "invited" && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  This organization has been invited but hasn't completed their
                  profile yet.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleResend}
                    disabled={submitting}
                    className="flex-1 py-2.5 rounded-lg text-xs font-bold bg-primary text-primary-foreground hover:bg-primary-hover disabled:opacity-50 transition-colors"
                  >
                    {submitting ? "Sending..." : "Resend Email"}
                  </button>
                  <button
                    onClick={handleCancel}
                    disabled={submitting}
                    className="flex-1 py-2.5 rounded-lg text-xs font-bold border border-border text-foreground hover:bg-background-accent disabled:opacity-50 transition-colors"
                  >
                    Cancel Invitation
                  </button>
                </div>
                {org.isExpired && (
                  <p className="text-xs text-destructive font-semibold">
                    This invitation has expired. Resend to extend validity.
                  </p>
                )}
              </div>
            )}

            {org.status === "approved" && (
              <div className="space-y-2">
                <p className="text-sm text-emerald-600 font-semibold">
                  This organization has been approved and the account is active.
                </p>
                {org.reviewedBy && (
                  <p className="text-xs text-muted-foreground">
                    Reviewed by {org.reviewedBy}
                  </p>
                )}
              </div>
            )}

            {org.status === "rejected" && (
              <div className="space-y-2">
                <p className="text-sm text-red-600 font-semibold">
                  This registration was rejected.
                </p>
                {org.rejectionReason && (
                  <p className="text-xs text-muted-foreground italic">
                    Reason: {org.rejectionReason}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {mode === "reject" && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Rejection Reason (required)
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-red-500/30"
                placeholder="Explain why this registration is being rejected..."
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleAction("reject")}
                disabled={submitting || !reason.trim()}
                className="flex-1 py-2.5 rounded-lg text-xs font-bold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? "Rejecting..." : "Confirm Rejection"}
              </button>
              <button
                onClick={() => setMode(null)}
                className="flex-1 py-2.5 rounded-lg text-xs font-bold border border-border text-foreground hover:bg-background-accent transition-colors"
              >
                Back
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
