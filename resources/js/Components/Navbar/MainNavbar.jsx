// resources/js/Layouts/DashboardLayout/Header.jsx

import Link from "@/Components/Link";
import { usePage } from "@inertiajs/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/Components/ui/avatar";
import { useMemo } from "react";
import ToggleTheme from "../ToggleTheme";

export default function MainNavbar({
  title,
  breadcrumb,
  initials,
  userName,
  role,
  roleLabel,
  profileDropdown,
  onToggleDropdown,
  onLogout,
}) {
  const { auth } = usePage().props;
  const user = auth.user;

  const normalizedRoles = useMemo(() => {
    if (!Array.isArray(user?.roles)) {
      return [];
    }

    return user.roles
      .map((roleItem) =>
        typeof roleItem === "string" ? roleItem : roleItem?.name,
      )
      .filter(Boolean);
  }, [user?.roles]);

  const activeRole = role ?? normalizedRoles[0] ?? "student";
  const displayRole = roleLabel ?? normalizedRoles.join(", ");

  const avatarSrc = useMemo(() => {
    if (!user.image) {
      return null;
    }

    return (
      route("files.preview", user.image) +
      `?v=${new Date(user.updated_at).getTime()}`
    );
  }, [user.image, user.updated_at]);

  return (
    <header className="h-16 bg-background border-b border-border flex items-center justify-between px-8 flex-shrink-0">
      {/* Left - title & breadcrumb */}
      <div>
        <h1 className="text-sm font-black tracking-widest text-foreground uppercase">
          {title}
        </h1>
        <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
          Dashboard <span className="mx-1">/</span> {breadcrumb}
        </p>
      </div>

      {/* Right - search + avatar */}
      <div className="flex items-center gap-4">
        <ToggleTheme />

        {/* Avatar + dropdown */}
        <div className="flex items-center gap-3 relative">
          <div
            onClick={onToggleDropdown}
            className="flex items-center gap-3 cursor-pointer select-none hover:bg-primary-soft px-2 py-1 rounded-xl transition"
          >
            <div className="text-right">
              <p className="text-xs font-bold text-foreground">{userName}</p>
              <p className="text-[9px] font-bold tracking-widest text-role-label uppercase">
                {displayRole}
              </p>
            </div>
            <Avatar className="w-9 h-9 rounded-full overflow-hidden bg-primary flex items-center justify-center">
              <AvatarImage
                src={avatarSrc}
                alt={user?.name}
                className="w-full h-full object-cover"
              />

              <AvatarFallback className="bg-primary text-primary-foreground text-sm font-black">
                {initials}
              </AvatarFallback>
            </Avatar>
          </div>

          {/* Dropdown */}
          {profileDropdown && (
            <div className="absolute top-full right-0 mt-2 w-44 bg-card rounded-2xl border border-border shadow-xl overflow-hidden z-50">
              <Link
                href="/home"
                className="flex items-center gap-2.5 px-4 py-3 text-xs font-bold tracking-widest uppercase text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
              >
                <svg
                  className="w-4 h-4 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                  />
                </svg>
                Home
              </Link>

              <Link
                href={`/${activeRole}/profile`}
                className="flex items-center gap-2.5 px-4 py-3 text-xs font-bold tracking-widest uppercase text-muted-foreground hover:text-foreground hover:bg-muted transition-all border-t border-border"
              >
                <svg
                  className="w-4 h-4 flex-shrink-0"
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
                Edit Profile
              </Link>

              <button
                onClick={onLogout}
                className="w-full flex items-center gap-2.5 px-4 py-3 text-xs font-bold tracking-widest uppercase text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-all border-t border-border text-left"
              >
                <svg
                  className="w-4 h-4 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
