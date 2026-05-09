export default function CourseToolbar({
  viewMode,
  setViewMode,
  search,
  setSearch,
  filterStatus,
  applyFilter,
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
        {["all", "published", "draft"].map((f) => (
          <button
            key={f}
            onClick={() => applyFilter("status", f)}
            className={`px-4 py-2 text-[10px] font-extrabold tracking-widest uppercase rounded-lg transition-all capitalize
                  ${filterStatus === f ? "bg-white text-blue-600 shadow-sm" : "text-gray-400 hover:text-gray-600"}`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3">
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
            placeholder="Search courses..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) =>
              e.key === "Enter" && applyFilter("search", search)
            }
            className="pl-9 pr-4 py-2.5 text-xs bg-white border border-gray-200 rounded-xl w-48 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder-gray-300"
          />
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
          {["grid", "list"].map((v) => (
            <button
              key={v}
              onClick={() => setViewMode(v)}
              className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${viewMode === v ? "bg-white text-blue-600 shadow-sm" : "text-gray-400 hover:text-gray-600"}`}
            >
              {v === "grid" ? (
                <svg
                  className="w-4 h-4"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M3 3h7v7H3zm11 0h7v7h-7zM3 14h7v7H3zm11 0h7v7h-7z" />
                </svg>
              ) : (
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
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
