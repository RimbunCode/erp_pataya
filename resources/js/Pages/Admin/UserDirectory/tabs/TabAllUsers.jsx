import { useState, useMemo } from "react";
import Icon from "@/Components/ui/Icon";
import { Avatar } from "@/Components/ui/avatar";
import RoleBadge from "@/Components/ui/RoleBadge";
import StatusBadge from "@/Components/ui/StatusBadge";
import { Input, Select } from "@/Components/ui/FormControls";
import EmptyState from "../components/EmptyState";
import UserDrawer from "../components/UserDrawer";
import { fmtDate } from "../utils/format";

export default function TabAllUsers({ users, setUsers }) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState(null);

  const filtered = useMemo(() => {
    let list = users;
    if (roleFilter !== "all") list = list.filter((u) => u.role === roleFilter);
    if (statusFilter !== "all")
      list = list.filter((u) => u.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.id.toLowerCase().includes(q),
      );
    }
    return list;
  }, [users, roleFilter, statusFilter, search]);

  const selectedLive = selected
    ? (users.find((u) => u.id === selected.id) ?? selected)
    : null;

  const handleSuspend = (id) => {
    setUsers((p) =>
      p.map((u) => (u.id === id ? { ...u, status: "suspended" } : u)),
    );
    setSelected((p) => (p?.id === id ? { ...p, status: "suspended" } : p));
  };

  const handleActivate = (id) => {
    setUsers((p) =>
      p.map((u) => (u.id === id ? { ...u, status: "active" } : u)),
    );
    setSelected((p) => (p?.id === id ? { ...p, status: "active" } : p));
  };

  return (
    <div className="flex gap-4 flex-1 overflow-hidden">
      <div className="flex-1 bg-[var(--card)] border border-[var(--border)] rounded-xl flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border)] flex-wrap">
          <div className="relative flex-1 min-w-40">
            <Icon
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              cls="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
            />
            <Input
              placeholder="Search name, email, ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 w-full"
            />
          </div>
          <Select value={roleFilter} onChange={setRoleFilter}>
            <option value="all">All Roles</option>
            <option value="student">Student</option>
            <option value="instructor">Instructor</option>
            <option value="organization">Organization</option>
          </Select>
          <Select value={statusFilter} onChange={setStatusFilter}>
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="pending">Pending</option>
          </Select>
          <button className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors ml-auto">
            <Icon d="M12 4v16m8-8H4" cls="w-3.5 h-3.5" /> Add User
          </button>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm" style={{ tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: "220px" }} />
              <col style={{ width: "80px" }} />
              <col style={{ width: "90px" }} />
              <col style={{ width: "100px" }} />
              <col style={{ width: "80px" }} />
            </colgroup>
            <thead className="sticky top-0 bg-[var(--card)] z-10">
              <tr className="border-b border-[var(--border)]">
                {["User", "Role", "Status", "Joined", "Action"].map((h) => (
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
                  <td colSpan={5}>
                    <EmptyState
                      icon="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                      text="No users found"
                    />
                  </td>
                </tr>
              ) : (
                filtered.map((u) => {
                  const active = selectedLive?.id === u.id;
                  return (
                    <tr
                      key={u.id}
                      onClick={() => setSelected(u)}
                      className={`cursor-pointer transition-colors ${active ? "bg-[var(--primary-soft)]" : "hover:bg-[var(--background-accent)]"}`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <Avatar initials={u.avatar} />
                          <div className="min-w-0">
                            <p
                              className={`text-xs font-semibold truncate ${active ? "text-[var(--primary)]" : "text-[var(--foreground)]"}`}
                            >
                              {u.name}
                            </p>
                            <p className="text-[10px] text-[var(--muted-foreground)] truncate">
                              {u.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <RoleBadge role={u.role} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={u.status} />
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs text-[var(--foreground)]">
                          {fmtDate(u.joinedAt)}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelected(u);
                          }}
                          className="text-xs text-[var(--primary)] font-medium hover:underline"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 border-t border-[var(--border)]">
          <p className="text-xs text-[var(--muted-foreground)]">
            Showing{" "}
            <span className="font-semibold text-[var(--foreground)]">
              {filtered.length}
            </span>{" "}
            of{" "}
            <span className="font-semibold text-[var(--foreground)]">
              {users.length}
            </span>{" "}
            users
          </p>
        </div>
      </div>

      {selectedLive && (
        <UserDrawer
          user={selectedLive}
          onClose={() => setSelected(null)}
          onSuspend={handleSuspend}
          onActivate={handleActivate}
        />
      )}
    </div>
  );
}
