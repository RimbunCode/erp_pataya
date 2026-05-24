import { useEffect, useMemo, useState } from "react";
import { router } from "@inertiajs/react";
import Icon from "@/Components/ui/Icon";
import { Avatar } from "@/Components/ui/avatar";
import RoleBadge from "@/Components/ui/RoleBadge";
import StatusBadge from "@/Components/ui/StatusBadge";
import PermBadge from "@/Components/ui/PermBadge";
import EmptyState from "../components/EmptyState";
import { PERMISSION_GROUPS } from "../config/roles";
import { fmtDate, fmtTime } from "../utils/format";

const AVAILABLE_PERMISSION_KEYS = PERMISSION_GROUPS.map((group) => group.key);

export default function TabAdmins({
  admins,
  canManageAdminPermissions = false,
}) {
  const [selectedId, setSelectedId] = useState(null);
  const [draftPermissions, setDraftPermissions] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const selectedAdmin = useMemo(() => {
    if (!selectedId) {
      return null;
    }

    return admins.find((adminItem) => adminItem.id === selectedId) ?? null;
  }, [admins, selectedId]);

  useEffect(() => {
    if (!selectedAdmin) {
      setDraftPermissions([]);
      return;
    }

    setDraftPermissions(
      Array.isArray(selectedAdmin.permissions) ? selectedAdmin.permissions : [],
    );
  }, [selectedAdmin]);

  const togglePermission = (permissionKey) => {
    if (!canManageAdminPermissions) {
      return;
    }

    setDraftPermissions((prevPermissions) => {
      const nextSet = new Set(prevPermissions);
      const hasPermission = nextSet.has(permissionKey);

      if (hasPermission) {
        nextSet.delete(permissionKey);
      } else if (permissionKey === "super_admin") {
        return ["super_admin"];
      } else {
        nextSet.delete("super_admin");
        nextSet.add(permissionKey);
      }

      return [...nextSet];
    });
  };

  const handleSavePermissions = () => {
    if (!selectedAdmin || submitting || !canManageAdminPermissions) {
      return;
    }

    setSubmitting(true);
    router.patch(
      route("admin.user.admins.permissions", {
        user: selectedAdmin.id,
      }),
      {
        permissions: draftPermissions,
      },
      {
        preserveScroll: true,
        only: ["admins", "canManageAdminPermissions"],
        onFinish: () => {
          setSubmitting(false);
        },
      },
    );
  };

  return (
    <div className="flex gap-4 flex-1 overflow-hidden">
      <div className="flex-1 bg-[var(--card)] border border-[var(--border)] rounded-xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <p className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-widest">
            Admin Accounts ({admins.length})
          </p>
          <p className="text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-widest">
            {canManageAdminPermissions ? "Editable" : "Read Only"}
          </p>
        </div>

        <div className="flex-1 overflow-auto divide-y divide-[var(--border)]">
          {admins.length === 0 ? (
            <EmptyState
              icon="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              text="No admin data found"
            />
          ) : (
            admins.map((adminItem) => {
              const active = selectedAdmin?.id === adminItem.id;

              return (
                <div
                  key={adminItem.id}
                  onClick={() => setSelectedId(adminItem.id)}
                  className={`px-4 py-4 cursor-pointer transition-colors ${active ? "bg-[var(--primary-soft)]" : "hover:bg-[var(--background-accent)]"}`}
                >
                  <div className="flex items-start gap-3">
                    <Avatar initials={adminItem.avatar} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p
                          className={`text-xs font-semibold ${active ? "text-[var(--primary)]" : "text-[var(--foreground)]"}`}
                        >
                          {adminItem.name}
                        </p>
                        <RoleBadge role={adminItem.role} />
                        <StatusBadge status={adminItem.status} />
                      </div>
                      <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5 truncate">
                        {adminItem.email}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {adminItem.permissions.length > 0 ? (
                          adminItem.permissions.map((permissionName) => (
                            <PermBadge
                              key={permissionName}
                              pkey={permissionName}
                            />
                          ))
                        ) : (
                          <span className="text-[10px] text-[var(--muted-foreground)] italic">
                            No permissions
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {selectedAdmin && (
        <div className="w-80 shrink-0 bg-[var(--card)] border border-[var(--border)] rounded-xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
            <p className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-widest">
              Admin Detail
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
              <Avatar initials={selectedAdmin.avatar} size="md" />
              <div>
                <p className="text-sm font-bold text-[var(--foreground)]">
                  {selectedAdmin.name}
                </p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {selectedAdmin.email}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-1">
              <RoleBadge role={selectedAdmin.role} />
              <StatusBadge status={selectedAdmin.status} />
            </div>

            {[
              ["Admin ID", selectedAdmin.id],
              ["Created", fmtDate(selectedAdmin.createdAt)],
              [
                "Last Active",
                selectedAdmin.lastActive
                  ? `${fmtDate(selectedAdmin.lastActive)}, ${fmtTime(selectedAdmin.lastActive)}`
                  : "-",
              ],
            ].map(([label, value]) => (
              <div
                key={label}
                className="flex justify-between items-start gap-3"
              >
                <p className="text-[10px] text-[var(--muted-foreground)]">
                  {label}
                </p>
                <p className="text-xs text-[var(--foreground)] text-right">
                  {value}
                </p>
              </div>
            ))}

            <div>
              <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-widest font-semibold mb-2">
                Permissions
              </p>
              <div className="space-y-2">
                {AVAILABLE_PERMISSION_KEYS.map((permissionKey) => {
                  const permissionGroup = PERMISSION_GROUPS.find(
                    (group) => group.key === permissionKey,
                  );
                  const checked = draftPermissions.includes(permissionKey);

                  if (!permissionGroup) {
                    return null;
                  }

                  return (
                    <label
                      key={permissionKey}
                      className={`flex items-start gap-2 rounded-lg border border-[var(--border)] px-3 py-2 ${canManageAdminPermissions ? "cursor-pointer hover:bg-[var(--background-accent)]" : "opacity-70 cursor-default"}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={!canManageAdminPermissions || submitting}
                        onChange={() => togglePermission(permissionKey)}
                        className="mt-0.5"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[var(--foreground)]">
                          {permissionGroup.label}
                        </p>
                        <p className="text-[10px] text-[var(--muted-foreground)]">
                          {permissionGroup.desc}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          {canManageAdminPermissions && (
            <div className="px-5 py-3 border-t border-[var(--border)]">
              <button
                onClick={handleSavePermissions}
                disabled={submitting}
                className="w-full py-2.5 rounded-lg text-xs font-semibold bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? "Saving..." : "Save Permissions"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
