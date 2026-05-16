// resources/js/Layouts/DashboardLayout/Sidebar.jsx

import Link from "@/Components/Link";
import { navConfig } from "@/Components/Navbar/NavConfig";

export default function MainSidebar({
  collapsed,
  onToggleCollapsed,
  activeRole,
  currentPath,
  onLogout,
}) {
  const config = navConfig[activeRole];

  return (
    <aside
      className={`flex-shrink-0 bg-sidebar border-r border-sidebar-border text-sidebar-foreground flex flex-col transition-all duration-300 ${
        collapsed ? "w-20" : "w-64"
      }`}
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-5 border-b border-border">
        {!collapsed && (
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-extrabold tracking-widest text-foreground uppercase leading-tight">
                INKINDO JATIM
              </div>
              <div className="text-[9px] tracking-widest text-role-label uppercase font-semibold">
                LMS Portal
              </div>
            </div>
          </div>
        )}

        {collapsed && (
          <div className="w-9 h-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center mx-auto">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" />
            </svg>
          </div>
        )}

        {!collapsed && (
          <button
            onClick={() => onToggleCollapsed(true)}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex-shrink-0"
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

      {/* Nav */}
      <nav className="flex-1 px-3 py-5 flex flex-col gap-1 overflow-y-auto">
        {config && !collapsed && (
          <div className="flex items-center gap-2 px-3 py-2 mt-3">
            <span
              className={`text-[9px] font-extrabold tracking-[2px] uppercase ${config.color}`}
            >
              {config.groupLabel}
            </span>
            <div className="flex-1 h-px bg-border" />
          </div>
        )}

        {config && collapsed && (
          <button
            onClick={() => onToggleCollapsed(false)}
            className="w-full flex items-center justify-center py-2 mb-2 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary-soft transition-colors"
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

        {config?.items.map((item) => {
          const isActive = currentPath === item.href;
          return (
            <Link
              key={item.key}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={`flex items-center gap-3 px-3 py-3 rounded-xl text-xs font-bold tracking-widest uppercase transition-all duration-200 ${
                collapsed ? "justify-center" : ""
              } ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <span
                className={`flex-shrink-0 ${
                  isActive ? "text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                {item.icon}
              </span>
              {!collapsed && (
                <>
                  {item.label}
                  {isActive && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary-foreground opacity-80" />
                  )}
                </>
              )}
            </Link>
          );
        })}
      </nav>
      {/* Logout Button */}
      <div className="px-3 py-4 border-t border-sidebar-border">
        <button
          onClick={onLogout}
          className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-xs font-bold tracking-widest uppercase transition-all duration-200 text-muted-foreground hover:text-destructive hover:bg-destructive/10 ${
            collapsed ? "justify-center" : ""
          }`}
        >
          <span className="flex-shrink-0">
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
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1"
              />
            </svg>
          </span>
          {!collapsed && "Logout"}
        </button>
      </div>
    </aside>
  );
}
