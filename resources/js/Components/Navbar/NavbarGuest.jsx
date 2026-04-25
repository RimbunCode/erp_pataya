import { memo } from "react";
import Link from "../Link";
import {
  useRolesSelectionModal,
  useRegisterModal,
} from "@/Layouts/GuestLayout";
import ToggleTheme from "../ToggleTheme";

export default memo(function NavbarGuest() {
  const openLogin = useRolesSelectionModal();
  const openRegister = useRegisterModal();

  return (
    <header className="print:hidden sticky top-0 z-50 w-full bg-white dark:bg-gray-800 border-b border-gray-200 shadow-sm">
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
            { label: "HOME", href: "/guest" },
            {
              label: "TRAINING CATALOGUE",
              href: "/guest/training",
            },
            { label: "CERTIFICATE VERIFICATION", href: "/guest/verify" },
            { label: "ABOUT US", href: "/guest/about" },
            { label: "CONTACT US", href: "/guest/contact" },
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
        <div className="flex items-center gap-2 shrink-0">
          <ToggleTheme />
          <button
            onClick={openLogin}
            className="text-[11px] font-bold tracking-widest text-gray-700 hover:text-blue-600 transition-colors uppercase px-2"
          >
            SIGN IN
          </button>
          <button
            onClick={openRegister}
            className="bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold tracking-widest uppercase px-4 py-2 rounded-md transition-colors"
          >
            JOIN NOW
          </button>
        </div>
      </div>
    </header>
  );
});
