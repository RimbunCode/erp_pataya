import React from "react";

export const AUTH_ROLE_DEFINITIONS = {
  student: {
    key: "student",
    label: "Student",
    desc: "Access your courses, track progress, and get certified.",
    iconBg: "bg-blue-100 dark:bg-blue-500/20",
    iconColor: "text-blue-700 dark:text-blue-300",
  },
  instructor: {
    key: "instructor",
    label: "Instructor",
    desc: "Create courses, manage students, and view earnings.",
    iconBg: "bg-violet-100 dark:bg-violet-500/20",
    iconColor: "text-violet-700 dark:text-violet-300",
  },
  organization: {
    key: "organization",
    label: "Organization",
    desc: "Manage affiliate trainers and corporate training.",
    iconBg: "bg-emerald-100 dark:bg-emerald-500/20",
    iconColor: "text-emerald-700 dark:text-emerald-300",
  },
  admin: {
    key: "admin",
    label: "Admin",
    desc: "System-wide management, approvals, and CMS.",
    iconBg: "bg-slate-200 dark:bg-slate-500/20",
    iconColor: "text-slate-700 dark:text-slate-300",
  },
};

export function getAuthRole(roleKey) {
  const normalizedKey =
    typeof roleKey === "string" ? roleKey.toLowerCase().trim() : "";
  const roleDefinition = AUTH_ROLE_DEFINITIONS[normalizedKey];

  if (!roleDefinition) {
    return null;
  }

  return {
    ...roleDefinition,
    icon: <RoleIcon roleKey={normalizedKey} className="w-6 h-6" />,
    smallIcon: <RoleIcon roleKey={normalizedKey} className="w-4 h-4" />,
  };
}

export function pickAuthRoles(roleKeys) {
  if (!Array.isArray(roleKeys)) {
    return [];
  }

  return roleKeys
    .map((roleKey) => getAuthRole(roleKey))
    .filter((roleDefinition) => roleDefinition !== null);
}

function RoleIcon({ roleKey, className }) {
  if (roleKey === "student") {
    return (
      <svg
        className={className}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 14l9-5-9-5-9 5 9 5z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 14l6.16-3.422A12.083 12.083 0 0112 21.5a12.083 12.083 0 01-6.16-10.922L12 14z"
        />
      </svg>
    );
  }

  if (roleKey === "instructor") {
    return (
      <svg
        className={className}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
        />
      </svg>
    );
  }

  if (roleKey === "organization") {
    return (
      <svg
        className={className}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
        />
      </svg>
    );
  }

  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
      />
    </svg>
  );
}
