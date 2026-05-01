// resources/js/Layouts/DashboardLayout/Header.jsx

import Link from "@/Components/Link";

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
  return (
    <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-8 flex-shrink-0">
      {/* Left — title & breadcrumb */}
      <div>
        <h1 className="text-sm font-black tracking-widest text-gray-900 uppercase">
          {title}
        </h1>
        <p className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase">
          Dashboard <span className="mx-1">›</span> {breadcrumb}
        </p>
      </div>

      {/* Right — search + avatar */}
      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="relative">
          <svg
            className="w-4 h-4 text-gray-300 absolute left-3 top-1/2 -translate-y-1/2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="Search in dashboard..."
            className="pl-9 pr-4 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl w-56 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all placeholder-gray-300"
          />
        </div>

        {/* Avatar + dropdown */}
        <div className="flex items-center gap-3 relative">
          <div
            onClick={onToggleDropdown}
            className="flex items-center gap-3 cursor-pointer select-none hover:bg-gray-50 px-2 py-1 rounded-xl transition"
          >
            <div className="text-right">
              <p className="text-xs font-bold text-gray-800">{userName}</p>
              <p className="text-[9px] font-bold tracking-widest text-blue-500 uppercase">
                {roleLabel}
              </p>
            </div>
            <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-black">
              {initials}
            </div>
          </div>

          {/* Dropdown */}
          {profileDropdown && (
            <div className="absolute top-full right-0 mt-2 w-44 bg-white rounded-2xl border border-gray-100 shadow-xl overflow-hidden z-50">
              <Link
                href="/home"
                className="flex items-center gap-2.5 px-4 py-3 text-xs font-bold tracking-widest uppercase text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-all"
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
                href={`/${role}/profile`}
                className="flex items-center gap-2.5 px-4 py-3 text-xs font-bold tracking-widest uppercase text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-all border-t border-gray-50"
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
                className="w-full flex items-center gap-2.5 px-4 py-3 text-xs font-bold tracking-widest uppercase text-red-400 hover:text-red-500 hover:bg-red-50 transition-all border-t border-gray-50 text-left"
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
