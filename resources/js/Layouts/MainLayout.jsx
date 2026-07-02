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
  const page = usePage();
  const { auth } = page.props;
  const user = auth?.user;
  const userRoles = (user?.roles ?? [])
    .map((roleItem) =>
      typeof roleItem === "string" ? roleItem : roleItem?.name,
    )
    .filter(Boolean);

  const initials = user?.nickname
    ? user.nickname.slice(0, 1).toUpperCase()
    : (user?.name?.slice(0, 1).toUpperCase() ?? "?");

  const currentPath = (page.url ?? "/").split("?")[0];
  const currentPathSegment = currentPath.split("/").filter(Boolean)[0];
  const activeRole = userRoles.includes(auth?.active_role)
    ? auth.active_role
    : userRoles.includes(currentPathSegment)
      ? currentPathSegment
      : (userRoles[0] ?? "student");

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
          activeRole={activeRole}
          currentPath={currentPath}
          onLogout={handleLogout}
        />

        {/* ── Main ── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <MainNavbar
            title={title}
            breadcrumb={breadcrumb}
            initials={initials}
            userName={user?.name ?? "User"}
            role={activeRole}
            roleLabel={roleLabel[activeRole]}
            userRoles={userRoles}
            currentUrl={page.url ?? "/"}
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

          <main className="flex-1 overflow-y-auto bg-[var(--background)]">{children}</main>
        </div>
      </div>
    </MasterLayout>
  );
}
