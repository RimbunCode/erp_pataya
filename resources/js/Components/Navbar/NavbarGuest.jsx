import { memo, useMemo, useState } from "react";
import Link from "../Link";
import {
  useRolesSelectionModal,
  useRegisterModal,
} from "@/Layouts/GuestLayout";
import ToggleTheme from "../ToggleTheme";
import { router, usePage } from "@inertiajs/react";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";

export default memo(function NavbarGuest({ onLogout }) {
  const { auth } = usePage().props;
  const user = auth?.user;
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const openLogin = useRolesSelectionModal();
  const openRegister = useRegisterModal();

  const initials = user?.nickname
    ? user.nickname.slice(0, 1).toUpperCase()
    : (user?.name?.slice(0, 1).toUpperCase() ?? "?");

  const primaryRole =
    auth?.active_role ?? user?.roles?.[0] ?? user?.role ?? "student";

  const dashboardRoute =
    {
      student: "/student/dashboard",
      instructor: "/instructor/dashboard",
      organization: "/organization/dashboard",
      admin: "/admin/dashboard",
    }[primaryRole] ?? "/student/dashboard";

  const avatarSrc = useMemo(() => {
    if (!user?.image) return null;

    return (
      route("files.preview", user.image) +
      `?v=${new Date(user.updated_at).getTime()}`
    );
  }, [user?.image, user?.updated_at]);

  return (
    <header className="print:hidden sticky top-0 z-50 w-full bg-background border-b border-border shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link
          href={route("guest.home")}
          className="flex items-center gap-2 shrink-0"
        >
          <div className="w-9 h-9 rounded-lg bg-primary dark:bg-primary flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              className="w-5 h-5 text-primary-foreground"
              fill="currentColor"
            >
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" />
            </svg>
          </div>
          <div className="leading-tight">
            <div className="font-extrabold text-sm tracking-widest text-foreground uppercase">
              INKINDO JATIM
            </div>
            <div className="text-xs tracking-widest text-primary uppercase font-semibold">
              Learning Center
            </div>
          </div>
        </Link>

        {/* Nav Links */}
        <nav className="hidden md:flex items-center gap-6">
          {[
            { label: "HOME", href: route("guest.home") },
            { label: "TRAINING CATALOGUE", href: route("guest.training") },
            { label: "CERTIFICATE VERIFICATION", href: route("guest.verify") },
            { label: "ABOUT US", href: route("guest.about") },
            { label: "CONTACT US", href: route("guest.contact") },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-[11px] font-bold tracking-widest text-foreground hover:text-primary transition-colors uppercase"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Auth Buttons */}
        <div className="flex items-center gap-3 shrink-0">
          {(primaryRole === "admin" || primaryRole === "content_admin") && (
            <button
              onClick={() => {
                router.get(
                  window.location.pathname,
                  { liveEdit: "1" },
                  { preserveState: true, preserveScroll: true },
                );
              }}
              className="hidden md:flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase border border-primary/30 text-primary hover:bg-primary/10 px-3 py-1.5 rounded-lg transition-colors"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                />
              </svg>
              Edit Page
            </button>
          )}
          <ToggleTheme />
          {user ? (
            <>
              {/* Avatar + Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setDropdownOpen((v) => !v)}
                  className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-muted transition-colors"
                >
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
                  <div className="text-left hidden sm:block">
                    <p className="text-xs font-bold text-foreground leading-tight">
                      {user.name}
                    </p>
                    <p className="text-[9px] font-extrabold tracking-widest text-role-label uppercase">
                      {primaryRole}
                    </p>
                  </div>
                  <svg
                    className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>

                {/* Dropdown */}
                {dropdownOpen && (
                  <>
                    {/* Backdrop */}
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setDropdownOpen(false)}
                    />

                    <div className="absolute right-0 top-12 z-50 w-52 overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-xl">
                      {/* User info */}
                      <div className="border-b border-border bg-muted/40 px-4 py-3">
                        <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-0.5">
                          Signed in as
                        </p>
                        <p className="text-sm font-bold text-popover-foreground truncate">
                          {user.email}
                        </p>
                      </div>

                      {/* Menu items */}
                      <div className="py-1.5">
                        <Link
                          href={dashboardRoute}
                          onClick={() => setDropdownOpen(false)}
                          className="flex items-center gap-3 px-4 py-2.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
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
                          <span className="text-xs font-extrabold tracking-widest uppercase">
                            Dashboard
                          </span>
                        </Link>

                        <Link
                          href={route(`${primaryRole}.profile`)}
                          onClick={() => setDropdownOpen(false)}
                          className="flex items-center gap-3 px-4 py-2.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
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
                          <span className="text-xs font-extrabold tracking-widest uppercase">
                            Profile Settings
                          </span>
                        </Link>
                        <button
                          onClick={onLogout}
                          className="w-full flex items-center gap-2.5 px-4 py-3 text-xs font-bold tracking-widest uppercase text-destructive hover:bg-destructive/10 hover:text-destructive transition-all border-t border-border text-left"
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
                    </div>
                  </>
                )}
              </div>
            </>
          ) : (
            <>
              <button
                onClick={() => openLogin()}
                className="text-[11px] border border-primary px-4 py-2 rounded-md hover:bg-primary-soft hover:border-primary-hover font-bold tracking-widest text-foreground hover:text-primary-soft-foreground transition-colors uppercase cursor-pointer"
              >
                SIGN IN
              </button>
              <button
                onClick={() => openRegister()}
                className="bg-primary hover:bg-primary-hover text-primary-foreground text-[11px] font-bold tracking-widest uppercase px-4 py-2 rounded-md transition-colors cursor-pointer"
              >
                JOIN NOW
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
});
