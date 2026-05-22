import { useState } from "react";
import Icon from "@/Components/ui/Icon";
import { Avatar } from "@/Components/ui/avatar";
import StatusBadge from "@/Components/ui/StatusBadge";
import { Input, Select } from "@/Components/ui/FormControls";
import { fmtDate } from "../utils/format";

const PLAN_COLOR = {
  Enterprise:
    "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  Business: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  Starter: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

export default function TabOrganizations({ orgs, setOrgs }) {
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    name: "",
    email: "",
    contact: "",
    plan: "Starter",
  });
  const [selected, setSelected] = useState(null);

  const handleInvite = () => {
    if (!inviteForm.name || !inviteForm.email) return;
    const newOrg = {
      id: `ORG-${String(orgs.length + 1).padStart(3, "0")}`,
      name: inviteForm.name,
      email: inviteForm.email,
      avatar: inviteForm.name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase(),
      status: "invited",
      plan: inviteForm.plan,
      members: 0,
      activeLicenses: 0,
      invitedAt: new Date().toISOString(),
      invitedBy: "Super Admin",
      joinedAt: null,
      contactPerson: inviteForm.contact,
      phone: "",
    };
    setOrgs((p) => [...p, newOrg]);
    setInviteForm({ name: "", email: "", contact: "", plan: "Starter" });
    setShowInvite(false);
  };

  const selectedLive = selected
    ? (orgs.find((o) => o.id === selected.id) ?? selected)
    : null;

  return (
    <div className="flex gap-4 flex-1 overflow-hidden">
      <div className="flex-1 flex flex-col gap-4 overflow-hidden">
        {/* Invite Banner */}
        {!showInvite ? (
          <div className="bg-[var(--card)] border border-dashed border-[var(--primary)] rounded-xl px-5 py-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">
                Invite an Organization
              </p>
              <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                Send an invite link to an{" organization's"} email — {"they'll"}
                register themselves.
              </p>
            </div>
            <button
              onClick={() => setShowInvite(true)}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors shrink-0"
            >
              <Icon
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                cls="w-3.5 h-3.5"
              />
              Send Invite
            </button>
          </div>
        ) : (
          <div className="bg-[var(--card)] border border-[var(--primary)] rounded-xl px-5 py-4">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-bold text-[var(--foreground)]">
                New Organization Invite
              </p>
              <button
                onClick={() => setShowInvite(false)}
                className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              >
                <Icon d="M6 18L18 6M6 6l12 12" cls="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-[10px] text-[var(--muted-foreground)] font-semibold uppercase tracking-wider block mb-1">
                  Organization Name *
                </label>
                <Input
                  placeholder="PT / CV / etc."
                  value={inviteForm.name}
                  onChange={(e) =>
                    setInviteForm((p) => ({ ...p, name: e.target.value }))
                  }
                  className="w-full"
                />
              </div>
              <div>
                <label className="text-[10px] text-[var(--muted-foreground)] font-semibold uppercase tracking-wider block mb-1">
                  Email *
                </label>
                <Input
                  placeholder="admin@company.co.id"
                  value={inviteForm.email}
                  onChange={(e) =>
                    setInviteForm((p) => ({ ...p, email: e.target.value }))
                  }
                  className="w-full"
                />
              </div>
              <div>
                <label className="text-[10px] text-[var(--muted-foreground)] font-semibold uppercase tracking-wider block mb-1">
                  Contact Person
                </label>
                <Input
                  placeholder="Full name"
                  value={inviteForm.contact}
                  onChange={(e) =>
                    setInviteForm((p) => ({ ...p, contact: e.target.value }))
                  }
                  className="w-full"
                />
              </div>
              <div>
                <label className="text-[10px] text-[var(--muted-foreground)] font-semibold uppercase tracking-wider block mb-1">
                  Plan
                </label>
                <Select
                  value={inviteForm.plan}
                  onChange={(v) => setInviteForm((p) => ({ ...p, plan: v }))}
                >
                  <option>Starter</option>
                  <option>Business</option>
                  <option>Enterprise</option>
                </Select>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowInvite(false)}
                className="px-4 py-2 text-xs font-medium border border-[var(--border)] rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--secondary)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleInvite}
                disabled={!inviteForm.name || !inviteForm.email}
                className="px-4 py-2 text-xs font-semibold bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Send Invite
              </button>
            </div>
          </div>
        )}

        {/* Org cards grid */}
        <div className="flex-1 overflow-auto">
          <div className="grid grid-cols-2 gap-4">
            {orgs.map((org) => {
              const active = selectedLive?.id === org.id;
              return (
                <div
                  key={org.id}
                  onClick={() => setSelected(org)}
                  className={`bg-[var(--card)] border rounded-xl p-4 cursor-pointer transition-all ${active ? "border-[var(--primary)] ring-2 ring-[var(--primary)] ring-opacity-30" : "border-[var(--border)] hover:border-[var(--primary)]"}`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar initials={org.avatar} size="md" />
                      <div>
                        <p className="text-sm font-bold text-[var(--foreground)] leading-tight">
                          {org.name}
                        </p>
                        <p className="text-[10px] text-[var(--muted-foreground)]">
                          {org.email}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={org.status} />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold ${PLAN_COLOR[org.plan]}`}
                    >
                      {org.plan}
                    </span>
                    <span className="text-[10px] text-[var(--muted-foreground)]">
                      {org.members} members · {org.activeLicenses} licenses
                    </span>
                  </div>
                  <div className="mt-2 text-[10px] text-[var(--muted-foreground)]">
                    Invited {fmtDate(org.invitedAt)} by {org.invitedBy}
                    {org.joinedAt && (
                      <span> · Joined {fmtDate(org.joinedAt)}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Org detail */}
      {selectedLive && (
        <div className="w-72 shrink-0 bg-[var(--card)] border border-[var(--border)] rounded-xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
            <p className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-widest">
              Org Detail
            </p>
            <button
              onClick={() => setSelected(null)}
              className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            >
              <Icon d="M6 18L18 6M6 6l12 12" cls="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            <div className="flex items-center gap-3">
              <Avatar initials={selectedLive.avatar} size="md" />
              <div>
                <p className="text-sm font-bold text-[var(--foreground)]">
                  {selectedLive.name}
                </p>
                <StatusBadge status={selectedLive.status} />
              </div>
            </div>
            {[
              ["Email", selectedLive.email],
              ["Contact Person", selectedLive.contactPerson],
              ["Phone", selectedLive.phone || "—"],
              ["Plan", selectedLive.plan],
              ["Members", selectedLive.members],
              ["Active Licenses", selectedLive.activeLicenses],
              ["Invited At", fmtDate(selectedLive.invitedAt)],
              ["Invited By", selectedLive.invitedBy],
              ["Joined At", fmtDate(selectedLive.joinedAt)],
            ].map(([l, v]) => (
              <div key={l} className="flex justify-between items-start gap-2">
                <p className="text-[10px] text-[var(--muted-foreground)] shrink-0">
                  {l}
                </p>
                <p className="text-xs text-[var(--foreground)] text-right">
                  {v}
                </p>
              </div>
            ))}
            <div className="pt-2 space-y-2">
              <button className="w-full py-2.5 text-xs font-semibold bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors">
                Manage Licenses
              </button>
              <button className="w-full py-2 text-xs font-medium border border-[var(--border)] rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--secondary)] transition-colors">
                Resend Invite
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
