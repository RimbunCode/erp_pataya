import MainLayout from "@/Layouts/MainLayout";
import { useState, useMemo } from "react";

// ═══════════════════════════════════════════════════════════
// MOCK DATA — replace with API / React Query
// ═══════════════════════════════════════════════════════════
const MOCK_USERS = [
  {
    id: "USR-001",
    name: "Ahmad Fauzi",
    email: "ahmad.fauzi@email.com",
    avatar: "AF",
    role: "student",
    status: "active",
    joinedAt: "2025-01-15",
    enrolledCourses: 3,
    completedCourses: 1,
    totalSpent: 2400000,
  },
  {
    id: "USR-002",
    name: "Rina Marlina",
    email: "rina.m@email.com",
    avatar: "RM",
    role: "student",
    status: "active",
    joinedAt: "2025-02-03",
    enrolledCourses: 1,
    completedCourses: 0,
    totalSpent: 950000,
  },
  {
    id: "USR-003",
    name: "Budi Santoso",
    email: "budi.s@email.com",
    avatar: "BS",
    role: "instructor",
    status: "active",
    joinedAt: "2024-11-20",
    courses: 3,
    totalStudents: 412,
    totalEarnings: 18500000,
  },
  {
    id: "USR-004",
    name: "Siti Nur",
    email: "siti.nur@email.com",
    avatar: "SN",
    role: "instructor",
    status: "active",
    joinedAt: "2024-12-01",
    courses: 2,
    totalStudents: 289,
    totalEarnings: 11200000,
  },
  {
    id: "USR-005",
    name: "PT Wijaya Karya",
    email: "admin@wikagroup.co.id",
    avatar: "WK",
    role: "organization",
    status: "active",
    joinedAt: "2025-01-08",
    members: 24,
    activeLicenses: 20,
    plan: "Enterprise",
  },
  {
    id: "USR-006",
    name: "Yusuf Habibie",
    email: "yusuf.h@email.com",
    avatar: "YH",
    role: "student",
    status: "active",
    joinedAt: "2025-03-11",
    enrolledCourses: 2,
    completedCourses: 2,
    totalSpent: 1400000,
  },
  {
    id: "USR-007",
    name: "Dewi Puspita",
    email: "dewi.p@email.com",
    avatar: "DP",
    role: "student",
    status: "suspended",
    joinedAt: "2025-02-28",
    enrolledCourses: 1,
    completedCourses: 0,
    totalSpent: 1200000,
  },
  {
    id: "USR-008",
    name: "CV Bangun Nusantara",
    email: "info@bangunn.co.id",
    avatar: "BN",
    role: "organization",
    status: "active",
    joinedAt: "2025-04-01",
    members: 8,
    activeLicenses: 8,
    plan: "Business",
  },
  {
    id: "USR-009",
    name: "Adi Wijaya",
    email: "adi.w@email.com",
    avatar: "AW",
    role: "instructor",
    status: "active",
    joinedAt: "2024-10-15",
    courses: 1,
    totalStudents: 198,
    totalEarnings: 8900000,
  },
  {
    id: "USR-010",
    name: "Bagas Permana",
    email: "bagas.p@email.com",
    avatar: "BP",
    role: "student",
    status: "active",
    joinedAt: "2025-05-02",
    enrolledCourses: 0,
    completedCourses: 0,
    totalSpent: 0,
  },
  {
    id: "USR-011",
    name: "Laila Fitriani",
    email: "laila.f@email.com",
    avatar: "LF",
    role: "student",
    status: "pending",
    joinedAt: "2025-06-08",
    enrolledCourses: 0,
    completedCourses: 0,
    totalSpent: 0,
  },
  {
    id: "USR-012",
    name: "Rizky Aditya",
    email: "rizky.a@email.com",
    avatar: "RA",
    role: "student",
    status: "active",
    joinedAt: "2025-04-19",
    enrolledCourses: 2,
    completedCourses: 1,
    totalSpent: 1700000,
  },
];

const MOCK_ROLE_REQUESTS = [
  {
    id: "REQ-001",
    userId: "USR-001",
    userName: "Ahmad Fauzi",
    userEmail: "ahmad.fauzi@email.com",
    avatar: "AF",
    currentRole: "student",
    requestedRole: "instructor",
    submittedAt: "2025-06-09T10:30:00",
    status: "pending",
    portfolio: "https://portfolio.ahmadfauzi.com",
    linkedIn: "linkedin.com/in/ahmf",
    expertise: "Structural Engineering, BIM",
    experience: "5 years at PT Adhi Karya",
    reason:
      "I want to share my expertise in structural engineering with aspiring civil engineers across Indonesia.",
  },
  {
    id: "REQ-002",
    userId: "USR-006",
    userName: "Yusuf Habibie",
    userEmail: "yusuf.h@email.com",
    avatar: "YH",
    currentRole: "student",
    requestedRole: "instructor",
    submittedAt: "2025-06-08T14:00:00",
    status: "pending",
    portfolio: "https://yusufh.dev",
    linkedIn: "linkedin.com/in/yusufh",
    expertise: "Project Management, Risk Assessment",
    experience: "7 years, PMP certified",
    reason:
      "I have extensive experience managing large-scale infrastructure projects and would love to teach.",
  },
  {
    id: "REQ-003",
    userId: "USR-012",
    userName: "Rizky Aditya",
    userEmail: "rizky.a@email.com",
    avatar: "RA",
    currentRole: "student",
    requestedRole: "instructor",
    submittedAt: "2025-06-05T09:15:00",
    status: "approved",
    portfolio: "https://rizkyad.com",
    linkedIn: "linkedin.com/in/rizkyad",
    expertise: "AutoCAD, Civil 3D",
    experience: "4 years at Konsultan Maju Bersama",
    reason:
      "Teaching AutoCAD has been my passion. I've trained 50+ colleagues internally.",
    approvedBy: "Super Admin",
    approvedAt: "2025-06-06T11:00:00",
  },
  {
    id: "REQ-004",
    userId: "USR-010",
    userName: "Bagas Permana",
    userEmail: "bagas.p@email.com",
    avatar: "BP",
    currentRole: "student",
    requestedRole: "instructor",
    submittedAt: "2025-06-03T16:45:00",
    status: "rejected",
    portfolio: "",
    linkedIn: "",
    expertise: "General Engineering",
    experience: "1 year intern",
    reason: "I want to become an instructor.",
    rejectedBy: "Super Admin",
    rejectedAt: "2025-06-04T10:00:00",
    rejectReason:
      "Insufficient experience. Minimum 3 years required. Please reapply after gaining more professional experience.",
  },
];

const MOCK_ORGANIZATIONS = [
  {
    id: "ORG-001",
    name: "PT Wijaya Karya",
    email: "admin@wikagroup.co.id",
    avatar: "WK",
    status: "active",
    plan: "Enterprise",
    members: 24,
    activeLicenses: 20,
    invitedAt: "2025-01-05",
    invitedBy: "Super Admin",
    joinedAt: "2025-01-08",
    contactPerson: "Hendra Gunawan",
    phone: "+62 21 5552910",
  },
  {
    id: "ORG-002",
    name: "CV Bangun Nusantara",
    email: "info@bangunn.co.id",
    avatar: "BN",
    status: "active",
    plan: "Business",
    members: 8,
    activeLicenses: 8,
    invitedAt: "2025-03-28",
    invitedBy: "Admin Finance",
    joinedAt: "2025-04-01",
    contactPerson: "Dewi Lestari",
    phone: "+62 31 8881234",
  },
  {
    id: "ORG-003",
    name: "PT Hutama Karya",
    email: "hr@hutamakarya.co.id",
    avatar: "HK",
    status: "invited",
    plan: "Enterprise",
    members: 0,
    activeLicenses: 0,
    invitedAt: "2025-06-07",
    invitedBy: "Super Admin",
    joinedAt: null,
    contactPerson: "Fajar Hidayat",
    phone: "+62 21 7773333",
  },
  {
    id: "ORG-004",
    name: "Konsultan Maju Bersama",
    email: "office@kmb.co.id",
    avatar: "KM",
    status: "active",
    plan: "Starter",
    members: 3,
    activeLicenses: 3,
    invitedAt: "2025-05-10",
    invitedBy: "Super Admin",
    joinedAt: "2025-05-14",
    contactPerson: "Sari Kusuma",
    phone: "+62 24 6664444",
  },
];

const MOCK_ADMINS = [
  {
    id: "ADM-001",
    name: "Super Admin",
    email: "superadmin@inkindo.org",
    avatar: "SA",
    role: "super_admin",
    status: "active",
    permissions: [
      "manage_roles",
      "finance_admin",
      "course_admin",
      "user_admin",
      "content_admin",
      "super_admin",
    ],
    lastActive: "2025-06-10T09:00:00",
    createdAt: "2024-01-01",
  },
  {
    id: "ADM-002",
    name: "Eko Prasetyo",
    email: "eko.p@inkindo.org",
    avatar: "EP",
    role: "admin",
    status: "active",
    permissions: ["finance_admin"],
    lastActive: "2025-06-10T08:30:00",
    createdAt: "2024-06-15",
  },
  {
    id: "ADM-003",
    name: "Maya Sari",
    email: "maya.s@inkindo.org",
    avatar: "MS",
    role: "admin",
    status: "active",
    permissions: ["course_admin", "user_admin"],
    lastActive: "2025-06-09T16:00:00",
    createdAt: "2024-08-20",
  },
  {
    id: "ADM-004",
    name: "Tono Hartono",
    email: "tono.h@inkindo.org",
    avatar: "TH",
    role: "admin",
    status: "inactive",
    permissions: ["content_admin"],
    lastActive: "2025-05-20T11:00:00",
    createdAt: "2024-09-01",
  },
];

const PERMISSION_GROUPS = [
  {
    key: "finance_admin",
    label: "Finance Admin",
    desc: "Approve enrollment payments",
    color:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  },
  {
    key: "course_admin",
    label: "Course Admin",
    desc: "Approve/reject course submissions",
    color:
      "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  },
  {
    key: "user_admin",
    label: "User Admin",
    desc: "Manage role requests & organizations",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  },
  {
    key: "super_admin",
    label: "Super Admin",
    desc: "Full access + manage admin permissions",
    color: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  },
];

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════
const fmt = (n) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
const fmtDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";
const fmtTime = (iso) =>
  iso
    ? new Date(iso).toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

const ROLE_CFG = {
  student: {
    label: "Student",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  },
  instructor: {
    label: "Instructor",
    color:
      "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  },
  organization: {
    label: "Organization",
    color:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  },
  admin: {
    label: "Admin",
    color:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  },
  super_admin: {
    label: "Super Admin",
    color: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  },
};

const STATUS_CFG = {
  active: {
    label: "Active",
    dot: "bg-emerald-500",
    pill: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  },
  suspended: {
    label: "Suspended",
    dot: "bg-red-500",
    pill: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  },
  pending: {
    label: "Pending",
    dot: "bg-amber-500",
    pill: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  },
  inactive: {
    label: "Inactive",
    dot: "bg-slate-400",
    pill: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  },
  invited: {
    label: "Invited",
    dot: "bg-sky-500",
    pill: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  },
  approved: {
    label: "Approved",
    dot: "bg-emerald-500",
    pill: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  },
  rejected: {
    label: "Rejected",
    dot: "bg-red-500",
    pill: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  },
};

// ═══════════════════════════════════════════════════════════
// SHARED UI
// ═══════════════════════════════════════════════════════════
function Icon({ d, cls = "w-4 h-4" }) {
  return (
    <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d={d}
      />
    </svg>
  );
}
function Avatar({ initials, size = "sm", color }) {
  const sz = {
    sm: "w-8 h-8 text-xs",
    md: "w-10 h-10 text-sm",
    lg: "w-12 h-12 text-base",
  }[size];
  return (
    <div
      className={`${sz} ${color ?? "bg-[var(--primary-soft)] text-[var(--primary)]"} rounded-full flex items-center justify-center font-bold shrink-0`}
    >
      {initials}
    </div>
  );
}
function StatusBadge({ status }) {
  const c = STATUS_CFG[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${c.pill}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}
function RoleBadge({ role }) {
  const c = ROLE_CFG[role] ?? ROLE_CFG.student;
  return (
    <span
      className={`px-2 py-0.5 rounded text-[11px] font-semibold ${c.color}`}
    >
      {c.label}
    </span>
  );
}
function PermBadge({ pkey }) {
  const p = PERMISSION_GROUPS.find((g) => g.key === pkey);
  if (!p) return null;
  return (
    <span
      className={`px-2 py-0.5 rounded text-[10px] font-semibold ${p.color}`}
    >
      {p.label}
    </span>
  );
}
function Input({ placeholder, value, onChange, className = "" }) {
  return (
    <input
      type="text"
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      className={`text-xs border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--ring)] ${className}`}
    />
  );
}
function Select({ value, onChange, children, className = "" }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`text-xs border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--ring)] ${className}`}
    >
      {children}
    </select>
  );
}
function EmptyState({ icon, text }) {
  return (
    <div className="flex flex-col items-center justify-center h-40 text-[var(--muted-foreground)] gap-2">
      <Icon d={icon} cls="w-8 h-8 opacity-30" />
      <p className="text-xs">{text}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// DETAIL DRAWER (user profile)
// ═══════════════════════════════════════════════════════════
function UserDrawer({ user, onClose, onSuspend, onActivate }) {
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
            {user.status === "active" ? (
              <button
                onClick={() => onSuspend(user.id)}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/30 transition-colors"
              >
                <Icon
                  d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                  cls="w-3.5 h-3.5"
                />
                Suspend Account
              </button>
            ) : (
              <button
                onClick={() => onActivate(user.id)}
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

// ═══════════════════════════════════════════════════════════
// TAB: ALL USERS
// ═══════════════════════════════════════════════════════════
function TabAllUsers({ users, setUsers }) {
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

// ═══════════════════════════════════════════════════════════
// TAB: ROLE REQUESTS
// ═══════════════════════════════════════════════════════════
function TabRoleRequests({ requests, setRequests }) {
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

// ═══════════════════════════════════════════════════════════
// TAB: ORGANIZATIONS
// ═══════════════════════════════════════════════════════════
function TabOrganizations({ orgs, setOrgs }) {
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

  const PLAN_COLOR = {
    Enterprise:
      "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
    Business:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    Starter:
      "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  };

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
                Send an invite link to an organization's email — they'll
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
              />{" "}
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

// ═══════════════════════════════════════════════════════════
// TAB: ADMINS & PERMISSIONS
// ═══════════════════════════════════════════════════════════
function TabAdmins({ admins, setAdmins }) {
  const [selected, setSelected] = useState(null);
  const [showNewAdmin, setShowNewAdmin] = useState(false);
  const [newForm, setNewForm] = useState({
    name: "",
    email: "",
    permissions: [],
  });
  const [editPerms, setEditPerms] = useState(null); // id being edited

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

// ═══════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════
export default function UserDirectory() {
  const [activeTab, setActiveTab] = useState("users");
  const [users, setUsers] = useState(MOCK_USERS);
  const [requests, setRequests] = useState(MOCK_ROLE_REQUESTS);
  const [orgs, setOrgs] = useState(MOCK_ORGANIZATIONS);
  const [admins, setAdmins] = useState(MOCK_ADMINS);

  const pendingRequests = requests.filter((r) => r.status === "pending").length;

  const TABS = [
    {
      key: "users",
      label: "All Users",
      badge: users.length,
      d: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z",
    },
    {
      key: "requests",
      label: "Role Requests",
      badge: pendingRequests,
      d: "M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z",
      urgent: true,
    },
    {
      key: "orgs",
      label: "Organizations",
      badge: orgs.length,
      d: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
    },
    {
      key: "admins",
      label: "Admins",
      badge: admins.length,
      d: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
    },
  ];

  return (
    <MainLayout>
      <div
        data-role="admin"
        className="flex h-screen bg-[var(--background)] overflow-hidden"
      >
        {/* MAIN */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Body */}
          <div className="flex-1 overflow-hidden flex flex-col p-6 gap-5">
            {/* Heading + stat pills */}
            <div className="flex items-start justify-between shrink-0">
              <div>
                <h1 className="text-3xl font-black text-[var(--foreground)] tracking-tight">
                  USER DIRECTORY
                </h1>
                <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
                  Manage all users, role requests, organizations, and admin
                  permissions.
                </p>
              </div>
              <div className="flex gap-2">
                {[
                  [
                    "Students",
                    users.filter((u) => u.role === "student").length,
                    "text-blue-600 bg-blue-50 dark:bg-blue-950/40",
                  ],
                  [
                    "Instructors",
                    users.filter((u) => u.role === "instructor").length,
                    "text-violet-600 bg-violet-50 dark:bg-violet-950/40",
                  ],
                  [
                    "Organizations",
                    orgs.length,
                    "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40",
                  ],
                  [
                    "Admins",
                    admins.length,
                    "text-amber-600 bg-amber-50 dark:bg-amber-950/40",
                  ],
                ].map(([l, v, c]) => (
                  <div
                    key={l}
                    className={`px-3 py-2 rounded-xl text-center ${c}`}
                  >
                    <p className="text-lg font-black leading-none">{v}</p>
                    <p className="text-[10px] font-semibold mt-0.5">{l}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-[var(--border)] shrink-0">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-2 px-5 py-3 text-xs font-semibold uppercase tracking-wider transition-colors relative ${activeTab === tab.key ? "text-[var(--primary)]" : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"}`}
                >
                  <Icon d={tab.d} cls="w-3.5 h-3.5" />
                  {tab.label}
                  <span
                    className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                      tab.urgent && tab.badge > 0
                        ? "bg-amber-500 text-white"
                        : activeTab === tab.key
                          ? "bg-[var(--primary-soft)] text-[var(--primary)]"
                          : "bg-[var(--secondary)] text-[var(--muted-foreground)]"
                    }`}
                  >
                    {tab.badge}
                  </span>
                  {activeTab === tab.key && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--primary)] rounded-t" />
                  )}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-hidden">
              {activeTab === "users" && (
                <TabAllUsers users={users} setUsers={setUsers} />
              )}
              {activeTab === "requests" && (
                <TabRoleRequests
                  requests={requests}
                  setRequests={setRequests}
                />
              )}
              {activeTab === "orgs" && (
                <TabOrganizations orgs={orgs} setOrgs={setOrgs} />
              )}
              {activeTab === "admins" && (
                <TabAdmins admins={admins} setAdmins={setAdmins} />
              )}
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
