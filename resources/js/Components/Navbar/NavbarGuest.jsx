import { memo, useMemo, useState } from "react";
import Link from "../Link";
import {
  useRolesSelectionModal,
  useRegisterModal,
} from "@/Layouts/GuestLayout";
import ToggleTheme from "../ToggleTheme";
import { router, usePage } from "@inertiajs/react";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";

export default memo(function NavbarGuest() {
  const { auth } = usePage().props;
  const user = auth?.user;
  const isLoggedIn = !!user;
  const baseUrl = isLoggedIn ? "/home" : "/guest";
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const openLogin = useRolesSelectionModal();
  const openRegister = useRegisterModal();

  const initials = user?.nickname
    ? user.nickname.slice(0, 1).toUpperCase()
    : (user?.name?.slice(0, 1).toUpperCase() ?? "?");

  const primaryRole = user?.roles?.[0] ?? user?.role ?? "student";

  const dashboardRoute =
    {
      student: "/student/dashboard",
      instructor: "/instructor/dashboard",
      organization: "/organization/dashboard",
      admin: "/admin/dashboard",
    }[primaryRole] ?? "/student/dashboard";

  const handleLogout = () => {
    setDropdownOpen(false);
    router.post("/logout");
  };

  const avatarSrc = useMemo(() => {
    if (!user?.image) return null;

    return (
      route("files.preview", user.image) +
      `?v=${new Date(user.updated_at).getTime()}`
    );
  }, [user?.image, user?.updated_at]);

  return (
    <header className="print:hidden sticky top-0 z-50 w-full bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/guest" className="flex items-center gap-2 shrink-0">
          <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              className="w-5 h-5 text-white"
              fill="currentColor"
            >
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" />
            </svg>
          </div>
          <div className="leading-tight">
            <div className="font-extrabold text-sm tracking-widest text-gray-900 uppercase">
              INKINDO
            </div>
            <div className="text-[9px] tracking-widest text-blue-600 uppercase font-semibold">
              Learning Center
            </div>
          </div>
        </Link>

        {/* Nav Links */}
        <nav className="hidden md:flex items-center gap-6">
          {[
            { label: "HOME", href: `${baseUrl}` },
            { label: "TRAINING CATALOGUE", href: `${baseUrl}/training` },
            { label: "CERTIFICATE VERIFICATION", href: `${baseUrl}/verify` },
            { label: "ABOUT US", href: `${baseUrl}/about` },
            { label: "CONTACT US", href: `${baseUrl}/contact` },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-[11px] font-bold tracking-widest text-gray-700 hover:text-blue-600 transition-colors uppercase"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Auth Buttons */}
        <div className="flex items-center gap-3 shrink-0">
          {user ? (
            <>
              {/* Notification bell */}
              <button className="relative w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-50 transition-colors">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                </svg>
                {/* Notification dot */}
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500" />
              </button>

              {/* Avatar + Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setDropdownOpen((v) => !v)}
                  className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  <Avatar className="w-9 h-9 rounded-full overflow-hidden bg-blue-600 flex items-center justify-center">
                    <AvatarImage
                      src={avatarSrc}
                      alt={user?.name}
                      className="w-full h-full object-cover"
                    />

                    <AvatarFallback className="bg-blue-600 text-white text-sm font-black">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="text-left hidden sm:block">
                    <p className="text-xs font-bold text-gray-800 leading-tight">
                      {user.name}
                    </p>
                    <p className="text-[9px] font-extrabold tracking-widest text-blue-500 uppercase">
                      {primaryRole}
                    </p>
                  </div>
                  <svg
                    className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`}
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

                    <div className="absolute right-0 top-12 z-50 bg-white border border-gray-100 rounded-2xl shadow-xl w-52 overflow-hidden">
                      {/* User info */}
                      <div className="px-4 py-3 border-b border-gray-100">
                        <p className="text-[10px] font-bold tracking-widest text-gray-400 uppercase mb-0.5">
                          Signed in as
                        </p>
                        <p className="text-sm font-bold text-gray-800 truncate">
                          {user.email}
                        </p>
                      </div>

                      {/* Menu items */}
                      <div className="py-1.5">
                        <Link
                          href={dashboardRoute}
                          onClick={() => setDropdownOpen(false)}
                          className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors"
                        >
                          <svg
                            className="w-4 h-4 text-gray-400"
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
                          <span className="text-xs font-extrabold tracking-widest text-gray-700 uppercase">
                            Dashboard
                          </span>
                        </Link>

                        <Link
                          href="/student/profile"
                          onClick={() => setDropdownOpen(false)}
                          className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors"
                        >
                          <svg
                            className="w-4 h-4 text-gray-400"
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
                          <span className="text-xs font-extrabold tracking-widest text-gray-700 uppercase">
                            Profile Settings
                          </span>
                        </Link>
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
                className="text-[11px] font-bold tracking-widest text-gray-700 hover:text-blue-600 transition-colors uppercase px-2"
              >
                SIGN IN
              </button>
              <button
                onClick={() => openRegister()}
                className="bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold tracking-widest uppercase px-4 py-2 rounded-md transition-colors"
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
