import { useEffect, useState } from "react";
import Icon from "@/Components/ui/Icon";
import { Avatar } from "@/Components/ui/avatar";
import RoleBadge from "@/Components/ui/RoleBadge";
import StatusBadge from "@/Components/ui/StatusBadge";
import { fmt, fmtDate, fmtTime } from "../utils/format";

export default function UserDrawer({
  user,
  onClose,
  onDeactivate,
  onActivate,
  statusProcessing = false,
}) {
  const [deactivateMode, setDeactivateMode] = useState(false);
  const [deactivateReason, setDeactivateReason] = useState("");

  useEffect(() => {
    setDeactivateMode(false);
    setDeactivateReason("");
  }, [user?.id, user?.status]);

  if (!user) return null;

  const isStudent = user.role === "student";
  const isInstructor = user.role === "instructor";
  const isOrg = user.role === "organization";

  return (
    <div className="w-80 shrink-0 bg-[var(--card)] border border-[var(--border)] rounded-xl flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
        <p className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-widest">
          User Profile
        </p>
        <button
          onClick={onClose}
          className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
        >
          <Icon d="M6 18L18 6M6 6l12 12" cls="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Identity */}
        <div className="px-5 py-5 border-b border-[var(--border)]">
          <div className="flex items-start gap-3 mb-3">
            <Avatar initials={user.avatar} size="lg" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-[var(--foreground)]">
                {user.name}
              </p>
              <p className="text-xs text-[var(--muted-foreground)] truncate">
                {user.email}
              </p>
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                <RoleBadge role={user.role} />
                <StatusBadge status={user.status} />
              </div>
            </div>
          </div>
          <div className="text-[10px] text-[var(--muted-foreground)]">
            ID:{" "}
            <span className="font-mono text-[var(--foreground)]">
              {user.id}
            </span>
          </div>
          <div className="text-[10px] text-[var(--muted-foreground)] mt-0.5">
            Joined:{" "}
            <span className="text-[var(--foreground)]">
              {fmtDate(user.joinedAt)}
            </span>
          </div>
        </div>

        {user.status === "inactive" && (
          <div className="px-5 py-4 border-b border-[var(--border)]">
            <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-widest font-semibold mb-2">
              Inactive Detail
            </p>
            <p className="text-xs text-[var(--foreground)] leading-relaxed">
              {user.inactiveReason ?? "-"}
            </p>
            {user.inactiveByName && (
              <p className="text-[10px] text-[var(--muted-foreground)] mt-2">
                By {user.inactiveByName}
              </p>
            )}
            {user.inactiveAt && (
              <p className="text-[10px] text-[var(--muted-foreground)] mt-2">
                Set at {fmtDate(user.inactiveAt)} {fmtTime(user.inactiveAt)}
              </p>
            )}
          </div>
        )}

        {/* Role-specific stats */}
        <div className="px-5 py-4 border-b border-[var(--border)]">
          <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-widest font-semibold mb-3">
            {isStudent
              ? "Learning Stats"
              : isInstructor
                ? "Teaching Stats"
                : "Organization Stats"}
          </p>
          {isStudent && (
            <div className="grid grid-cols-3 gap-2">
              {[
                ["Enrolled", user.enrolledCourses],
                ["Completed", user.completedCourses],
                ["Spent", fmt(user.totalSpent)],
              ].map(([l, v]) => (
                <div
                  key={l}
                  className="bg-[var(--background-accent)] rounded-lg p-2.5 text-center"
                >
                  <p className="text-[10px] text-[var(--muted-foreground)]">
                    {l}
                  </p>
                  <p className="text-xs font-bold text-[var(--foreground)] mt-0.5 truncate">
                    {v}
                  </p>
                </div>
              ))}
            </div>
          )}
          {isInstructor && (
            <div className="grid grid-cols-3 gap-2">
              {[
                ["Courses", user.courses],
                ["Students", user.totalStudents],
                ["Earnings", fmt(user.totalEarnings)],
              ].map(([l, v]) => (
                <div
                  key={l}
                  className="bg-[var(--background-accent)] rounded-lg p-2.5 text-center"
                >
                  <p className="text-[10px] text-[var(--muted-foreground)]">
                    {l}
                  </p>
                  <p className="text-xs font-bold text-[var(--foreground)] mt-0.5 truncate">
                    {v}
                  </p>
                </div>
              ))}
            </div>
          )}
          {isOrg && (
            <div className="grid grid-cols-3 gap-2">
              {[
                ["Members", user.members],
                ["Licenses", user.activeLicenses],
                ["Plan", user.plan],
              ].map(([l, v]) => (
                <div
                  key={l}
                  className="bg-[var(--background-accent)] rounded-lg p-2.5 text-center"
                >
                  <p className="text-[10px] text-[var(--muted-foreground)]">
                    {l}
                  </p>
                  <p className="text-xs font-bold text-[var(--foreground)] mt-0.5 truncate">
                    {v}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="px-5 py-4">
          <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-widest font-semibold mb-3">
            Quick Actions
          </p>
          <div className="space-y-2">
            <button className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--background-accent)] transition-colors">
              <Icon
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                cls="w-3.5 h-3.5"
              />
              Send Email
            </button>
            <button className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--background-accent)] transition-colors">
              <Icon
                d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                cls="w-3.5 h-3.5"
              />
              Reset Password
            </button>
            {user.status === "active" && !deactivateMode && (
              <button
                onClick={() => setDeactivateMode(true)}
                disabled={statusProcessing}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/30 transition-colors"
              >
                <Icon
                  d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                  cls="w-3.5 h-3.5"
                />
                Deactivate Account
              </button>
            )}
            {user.status === "active" && deactivateMode && (
              <div className="rounded-lg border border-red-200 p-2.5 bg-red-50/70 dark:border-red-900 dark:bg-red-950/20">
                <p className="text-[10px] text-red-600 dark:text-red-300 font-semibold uppercase tracking-wider mb-1.5">
                  Reason (required)
                </p>
                <textarea
                  value={deactivateReason}
                  onChange={(event) => setDeactivateReason(event.target.value)}
                  rows={3}
                  placeholder="Explain why this account is inactive..."
                  className="w-full text-xs p-2.5 rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                />
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => {
                      setDeactivateMode(false);
                      setDeactivateReason("");
                    }}
                    disabled={statusProcessing}
                    className="flex-1 py-2 text-xs font-medium border border-[var(--border)] rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--secondary)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (!deactivateReason.trim()) {
                        return;
                      }

                      onDeactivate(user.id, deactivateReason.trim());
                    }}
                    disabled={!deactivateReason.trim() || statusProcessing}
                    className="flex-1 py-2 text-xs font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Confirm
                  </button>
                </div>
              </div>
            )}
            {user.status !== "active" && (
              <button
                onClick={() => onActivate(user.id)}
                disabled={statusProcessing}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium border border-emerald-200 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-900 dark:hover:bg-emerald-950/30 transition-colors"
              >
                <Icon
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  cls="w-3.5 h-3.5"
                />
                Activate Account
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
