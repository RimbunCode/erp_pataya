import { useState } from "react";
import Icon from "@/Components/ui/Icon";
import { Avatar } from "@/Components/ui/avatar";
import RoleBadge from "@/Components/ui/RoleBadge";
import StatusBadge from "@/Components/ui/StatusBadge";
import { Input } from "@/Components/ui/FormControls";
import PermBadge from "@/Components/ui/PermBadge";
import { PERMISSION_GROUPS } from "../config/roles";
import { fmtDate, fmtTime } from "../utils/format";

export default function TabAdmins({ admins, setAdmins }) {
  const [selected, setSelected] = useState(null);
  const [showNewAdmin, setShowNewAdmin] = useState(false);
  const [newForm, setNewForm] = useState({
    name: "",
    email: "",
    permissions: [],
  });
  const [editPerms, setEditPerms] = useState(null);

  const togglePerm = (adminId, perm) => {
    setAdmins((p) =>
      p.map((a) => {
        if (a.id !== adminId || a.role === "super_admin") return a;
        const has = a.permissions.includes(perm);
        return {
          ...a,
          permissions: has
            ? a.permissions.filter((x) => x !== perm)
            : [...a.permissions, perm],
        };
      }),
    );
  };

  const handleCreate = () => {
    if (!newForm.name || !newForm.email) return;
    setAdmins((p) => [
      ...p,
      {
        id: `ADM-${String(p.length + 1).padStart(3, "0")}`,
        name: newForm.name,
        email: newForm.email,
        avatar: newForm.name
          .split(" ")
          .map((w) => w[0])
          .join("")
          .slice(0, 2)
          .toUpperCase(),
        role: "admin",
        status: "active",
        permissions: newForm.permissions,
        lastActive: null,
        createdAt: new Date().toISOString().slice(0, 10),
      },
    ]);
    setNewForm({ name: "", email: "", permissions: [] });
    setShowNewAdmin(false);
  };

  const selectedLive = selected
    ? (admins.find((a) => a.id === selected.id) ?? selected)
    : null;

  return (
    <div className="flex gap-4 flex-1 overflow-hidden">
      <div className="flex-1 flex flex-col gap-4 overflow-hidden">
        {/* New Admin form */}
        {showNewAdmin && (
          <div className="bg-[var(--card)] border border-[var(--primary)] rounded-xl px-5 py-4 shrink-0">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-bold text-[var(--foreground)]">
                Create New Admin
              </p>
              <button
                onClick={() => setShowNewAdmin(false)}
                className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              >
                <Icon d="M6 18L18 6M6 6l12 12" cls="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-[10px] text-[var(--muted-foreground)] font-semibold uppercase tracking-wider block mb-1">
                  Full Name *
                </label>
                <Input
                  placeholder="Admin name"
                  value={newForm.name}
                  onChange={(e) =>
                    setNewForm((p) => ({ ...p, name: e.target.value }))
                  }
                  className="w-full"
                />
              </div>
              <div>
                <label className="text-[10px] text-[var(--muted-foreground)] font-semibold uppercase tracking-wider block mb-1">
                  Email *
                </label>
                <Input
                  placeholder="admin@inkindo.org"
                  value={newForm.email}
                  onChange={(e) =>
                    setNewForm((p) => ({ ...p, email: e.target.value }))
                  }
                  className="w-full"
                />
              </div>
            </div>
            <div className="mb-3">
              <label className="text-[10px] text-[var(--muted-foreground)] font-semibold uppercase tracking-wider block mb-2">
                Permission Groups
              </label>
              <div className="flex flex-wrap gap-2">
                {PERMISSION_GROUPS.filter((g) => g.key !== "super_admin").map(
                  (g) => {
                    const has = newForm.permissions.includes(g.key);
                    return (
                      <button
                        key={g.key}
                        onClick={() =>
                          setNewForm((p) => ({
                            ...p,
                            permissions: has
                              ? p.permissions.filter((x) => x !== g.key)
                              : [...p.permissions, g.key],
                          }))
                        }
                        className={`px-2.5 py-1 rounded text-xs font-semibold border transition-colors ${has ? `${g.color} border-transparent` : "border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--secondary)]"}`}
                      >
                        {g.label}
                      </button>
                    );
                  },
                )}
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowNewAdmin(false)}
                className="px-4 py-2 text-xs font-medium border border-[var(--border)] rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--secondary)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!newForm.name || !newForm.email}
                className="px-4 py-2 text-xs font-semibold bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Create Admin
              </button>
            </div>
          </div>
        )}

        {/* Admin list */}
        <div className="flex-1 bg-[var(--card)] border border-[var(--border)] rounded-xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
            <p className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-widest">
              Admin Accounts ({admins.length})
            </p>
            <button
              onClick={() => setShowNewAdmin(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors"
            >
              <Icon d="M12 4v16m8-8H4" cls="w-3.5 h-3.5" /> New Admin
            </button>
          </div>
          <div className="flex-1 overflow-auto divide-y divide-[var(--border)]">
            {admins.map((admin) => {
              const isEditing = editPerms === admin.id;
              const active = selectedLive?.id === admin.id;
              return (
                <div
                  key={admin.id}
                  className={`px-4 py-4 transition-colors ${active ? "bg-[var(--primary-soft)]" : "hover:bg-[var(--background-accent)]"}`}
                >
                  <div
                    className="flex items-start gap-3 cursor-pointer"
                    onClick={() => setSelected(admin)}
                  >
                    <Avatar initials={admin.avatar} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p
                          className={`text-xs font-semibold ${active ? "text-[var(--primary)]" : "text-[var(--foreground)]"}`}
                        >
                          {admin.name}
                        </p>
                        <RoleBadge role={admin.role} />
                        <StatusBadge status={admin.status} />
                      </div>
                      <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">
                        {admin.email}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {admin.permissions.map((p) => (
                          <PermBadge key={p} pkey={p} />
                        ))}
                        {admin.permissions.length === 0 && (
                          <span className="text-[10px] text-[var(--muted-foreground)] italic">
                            No permissions assigned
                          </span>
                        )}
                      </div>
                    </div>
                    {admin.role !== "super_admin" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditPerms(isEditing ? null : admin.id);
                        }}
                        className="shrink-0 px-2.5 py-1.5 text-[10px] font-semibold border border-[var(--border)] rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--secondary)] transition-colors"
                      >
                        {isEditing ? "Done" : "Edit Perms"}
                      </button>
                    )}
                  </div>

                  {/* Inline permission editor */}
                  {isEditing && (
                    <div className="mt-3 ml-10 p-3 bg-[var(--background-accent)] rounded-xl border border-[var(--border)]">
                      <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-widest font-semibold mb-2">
                        Toggle Permission Groups
                      </p>
                      <div className="space-y-2">
                        {PERMISSION_GROUPS.filter(
                          (g) => g.key !== "super_admin",
                        ).map((g) => {
                          const has = admin.permissions.includes(g.key);
                          return (
                            <div
                              key={g.key}
                              className="flex items-center justify-between"
                            >
                              <div>
                                <p className="text-xs font-semibold text-[var(--foreground)]">
                                  {g.label}
                                </p>
                                <p className="text-[10px] text-[var(--muted-foreground)]">
                                  {g.desc}
                                </p>
                              </div>
                              <button
                                onClick={() => togglePerm(admin.id, g.key)}
                                className={`w-10 h-5 rounded-full transition-colors relative ${has ? "bg-[var(--primary)]" : "bg-[var(--border)]"}`}
                              >
                                <span
                                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${has ? "translate-x-5" : "translate-x-0.5"}`}
                                />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Admin detail */}
      {selectedLive && (
        <div className="w-72 shrink-0 bg-[var(--card)] border border-[var(--border)] rounded-xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
            <p className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-widest">
              Admin Detail
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
                <p className="text-xs text-[var(--muted-foreground)]">
                  {selectedLive.email}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              <RoleBadge role={selectedLive.role} />
              <StatusBadge status={selectedLive.status} />
            </div>
            {[
              ["Admin ID", selectedLive.id],
              ["Created", fmtDate(selectedLive.createdAt)],
              [
                "Last Active",
                selectedLive.lastActive
                  ? `${fmtDate(selectedLive.lastActive)}, ${fmtTime(selectedLive.lastActive)}`
                  : "—",
              ],
            ].map(([l, v]) => (
              <div key={l} className="flex justify-between">
                <p className="text-[10px] text-[var(--muted-foreground)]">
                  {l}
                </p>
                <p className="text-xs text-[var(--foreground)]">{v}</p>
              </div>
            ))}
            <div>
              <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-widest font-semibold mb-2">
                Permissions
              </p>
              <div className="flex flex-wrap gap-1.5">
                {selectedLive.permissions.map((p) => (
                  <PermBadge key={p} pkey={p} />
                ))}
              </div>
              {selectedLive.permissions.length === 0 && (
                <p className="text-xs text-[var(--muted-foreground)] italic">
                  No permissions
                </p>
              )}
            </div>
            {selectedLive.role !== "super_admin" && (
              <div className="pt-2 space-y-2">
                <button className="w-full py-2 text-xs font-medium border border-red-200 text-red-600 rounded-lg hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/30 transition-colors">
                  Revoke All Permissions
                </button>
                <button className="w-full py-2 text-xs font-medium border border-[var(--border)] text-[var(--muted-foreground)] rounded-lg hover:bg-[var(--secondary)] transition-colors">
                  Deactivate Admin
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
