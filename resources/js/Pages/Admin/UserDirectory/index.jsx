import { useState } from "react";
import MainLayout from "@/Layouts/MainLayout";
import Icon from "@/Components/ui/Icon";
import { useUserDirectory } from "./hooks/useUserDirectory";
import TabAllUsers from "./tabs/TabAllUsers";
import TabRoleRequests from "./tabs/TabRoleRequests";
import TabOrganizations from "./tabs/TabOrganizations";
import TabAdmins from "./tabs/TabAdmins";

const TABS = [
  {
    key: "users",
    label: "All Users",
    d: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z",
  },
  {
    key: "requests",
    label: "Role Requests",
    d: "M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z",
    urgent: true,
  },
  {
    key: "orgs",
    label: "Organizations",
    d: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
  },
  {
    key: "admins",
    label: "Admins",
    d: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
  },
];

export default function UserDirectory() {
  const [activeTab, setActiveTab] = useState("users");
  const {
    users,
    requests,
    orgs,
    orgsMeta,
    admins,
    pendingRequests,
    canManageAdminPermissions,
  } = useUserDirectory();

  return (
    <MainLayout>
      <div
        data-role="admin"
        className="flex h-screen bg-[var(--background)] overflow-hidden"
      >
        <div className="flex-1 flex flex-col overflow-hidden">
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
                    "text-blue-700 bg-blue-100 dark:bg-blue-500/15 dark:text-blue-300",
                  ],
                  [
                    "Instructors",
                    users.filter((u) => u.role === "instructor").length,
                    "text-violet-700 bg-violet-100 dark:bg-violet-500/15 dark:text-violet-300",
                  ],
                  [
                    "Organizations",
                    orgs.length,
                    "text-emerald-700 bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-300",
                  ],
                  [
                    "Admins",
                    admins.length,
                    "text-amber-700 bg-amber-100 dark:bg-amber-500/15 dark:text-amber-300",
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
                      tab.urgent &&
                      (tab.key === "requests" ? pendingRequests : 0) > 0
                        ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                        : activeTab === tab.key
                          ? "bg-[var(--primary-soft)] text-[var(--primary)]"
                          : "bg-[var(--secondary)] text-[var(--muted-foreground)]"
                    }`}
                  >
                    {tab.key === "users" && users.length}
                    {tab.key === "requests" && pendingRequests}
                    {tab.key === "orgs" && orgs.length}
                    {tab.key === "admins" && admins.length}
                  </span>
                  {activeTab === tab.key && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--primary)] rounded-t" />
                  )}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-hidden">
              {activeTab === "users" && <TabAllUsers users={users} />}
              {activeTab === "requests" && (
                <TabRoleRequests requests={requests} />
              )}
              {activeTab === "orgs" && (
                <TabOrganizations orgs={orgs} orgsMeta={orgsMeta} />
              )}
              {activeTab === "admins" && (
                <TabAdmins
                  admins={admins}
                  canManageAdminPermissions={canManageAdminPermissions}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
