// resources/js/Layouts/DashboardLayout/Sidebar.jsx

import Link from "@/Components/Link";
import { navConfig, roleLabel } from "@/Components/Navbar/NavConfig";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { useMemo } from "react";
import { usePage } from "@inertiajs/react";

export default function MainSidebar({
  collapsed,
  onToggleCollapsed,
  userRoles,
  isMultiRole,
  currentPath,
  initials,
  userName,
  onLogout,
}) {
  const { auth } = usePage().props;
  const user = auth.user;

  const avatarSrc = useMemo(() => {
    if (!user.image) return null;

    return (
      route("files.preview", user.image) +
      `?v=${new Date(user.updated_at).getTime()}`
    );
  }, [user.image, user.updated_at]);
  return (
    <aside
      className={`flex-shrink-0 bg-background border-r-[0.5px] border-secondary flex flex-col transition-all duration-300 ${
        collapsed ? "w-20" : "w-64"
      }`}
    >
      {/* ── Logo ── */}
      <div className="h-16 flex items-center justify-between px-5 border-b border-gray-100">
        {!collapsed && (
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
              <svg
                className="w-5 h-5 text-white"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-extrabold tracking-widest text-gray-900 uppercase leading-tight">
                INKINDO
              </div>
              <div className="text-[9px] tracking-widest text-blue-600 uppercase font-semibold">
                LMS Portal
              </div>
            </div>
          </div>
        )}

        {collapsed && (
          <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center mx-auto">
            <svg
              className="w-5 h-5 text-white"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" />
            </svg>
          </div>
        )}

        {!collapsed && (
          <button
            onClick={() => onToggleCollapsed(true)}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-300 hover:text-gray-500 hover:bg-gray-50 transition-colors flex-shrink-0"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
              />
            </svg>
          </button>
        )}
      </div>

      {/* ── Nav ── */}
      <nav className="flex-1 px-3 py-5 flex flex-col gap-1 overflow-y-auto">
        {userRoles.map((r) => {
          const config = navConfig[r];
          if (!config) return null;

          return (
            <div key={r}>
              {/* Role group label */}
              {isMultiRole && !collapsed && (
                <div className="flex items-center gap-2 px-3 py-2 mt-3">
                  <span
                    className={`text-[9px] font-extrabold tracking-[2px] uppercase ${config.color}`}
                  >
                    {config.groupLabel}
                  </span>
                  <div className="flex-1 h-px bg-gray-100" />
                </div>
              )}

              {/* Expand button when collapsed */}
              {collapsed && (
                <button
                  onClick={() => onToggleCollapsed(false)}
                  className="w-full flex items-center justify-center py-2 mb-2 rounded-xl text-gray-300 hover:text-blue-500 hover:bg-blue-50 transition-colors"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M13 5l7 7-7 7M5 5l7 7-7 7"
                    />
                  </svg>
                </button>
              )}

              {/* Nav items */}
              {config.items.map((item) => {
                const isActive = currentPath === item.href;
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className={`flex items-center gap-3 px-3 py-3 rounded-xl text-xs font-bold tracking-widest uppercase transition-all duration-200
                      ${collapsed ? "justify-center" : ""}
                      ${
                        isActive
                          ? "bg-primary text-white shadow-md shadow-blue-200"
                          : "text-gray-400 hover:text-gray-700 hover:bg-gray-50"
                      }`}
                  >
                    <span
                      className={`flex-shrink-0 ${isActive ? "text-white" : "text-gray-400"}`}
                    >
                      {item.icon}
                    </span>
                    {!collapsed && (
                      <>
                        {item.label}
                        {isActive && (
                          <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white opacity-80" />
                        )}
                      </>
                    )}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
