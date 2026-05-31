export const ROLE_CFG = {
  student: {
    label: "Student",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  },
  instructor: {
    label: "Instructor",
    color:
      "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  },
  organization: {
    label: "Organization",
    color:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
  admin: {
    label: "Admin",
    color:
      "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  },
  super_admin: {
    label: "Super Admin",
    color: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  },
};

export const PERMISSION_GROUPS = [
  {
    key: "finance_admin",
    label: "Finance Admin",
    desc: "Approve enrollment payments",
    color:
      "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  },
  {
    key: "course_admin",
    label: "Course Admin",
    desc: "Approve/reject course submissions",
    color:
      "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  },
  {
    key: "user_admin",
    label: "User Admin",
    desc: "Manage role requests & organizations",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  },
  {
    key: "content_admin",
    label: "Content Admin",
    desc: "Manage Guest and landing page content",
    color:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
  {
    key: "super_admin",
    label: "Super Admin",
    desc: "Full access + manage admin permissions",
    color: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  },
];
