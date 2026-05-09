// resources/js/Layouts/DashboardLayout/index.jsx

import { useState } from "react";
import { usePage, router } from "@inertiajs/react";
import MasterLayout from "@/Layouts/MasterLayout";
import Sidebar from "@/Components/Sidebar/MainSidebar";
import MainNavbar from "@/Components/Navbar/MainNavbar";
import { roleLabel } from "@/Components/Navbar/NavConfig";

export default function MainLayout({
  children,
  title = "Dashboard",
  breadcrumb = "Dashboard",
}) {
  const { auth } = usePage().props;
  const user = auth?.user;
  const userRoles = user?.roles ?? [];
  const isMultiRole = userRoles.length > 1;
  const role = userRoles[0]?.name;

  const initials = user?.nickname
    ? user.nickname.slice(0, 1).toUpperCase()
    : (user?.name?.slice(0, 1).toUpperCase() ?? "?");

  const currentPath = window.location.pathname;

  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("sidebar_collapsed") === "true",
  );
  const [profileDropdown, setProfileDropdown] = useState(false);

  const handleToggleCollapsed = (value) => {
    setCollapsed(value);
    localStorage.setItem("sidebar_collapsed", value);
  };

  const handleLogout = () => router.post("/logout");

  return (
    <MasterLayout>
      <div className="flex h-screen bg-background-accent overflow-hidden">
        {/* ── Sidebar ── */}
        <Sidebar
          collapsed={collapsed}
          onToggleCollapsed={handleToggleCollapsed}
          userRoles={userRoles}
          isMultiRole={isMultiRole}
          currentPath={currentPath}
          initials={initials}
          userName={user?.name ?? "User"}
          role={role}
          roleLabel={roleLabel[role]}
          onLogout={handleLogout}
        />

        {/* ── Main ── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <MainNavbar
            title={title}
            breadcrumb={breadcrumb}
            initials={initials}
            userName={user?.name ?? "User"}
            profileDropdown={profileDropdown}
            onToggleDropdown={() => setProfileDropdown((prev) => !prev)}
            onLogout={handleLogout}
          />

          {/* Close dropdown on outside click */}
          {profileDropdown && (
            <div
              className="fixed inset-0 z-40"
              onClick={() => setProfileDropdown(false)}
            />
          )}

          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </MasterLayout>
  );
}
