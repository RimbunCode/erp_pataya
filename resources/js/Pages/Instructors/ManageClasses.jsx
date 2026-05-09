import MainLayout from "@/Layouts/MainLayout";
import { useState } from "react";
import { router } from "@inertiajs/react";

import CreateCourseModal from "./Components/CreateCourseModal";
import CourseCard from "./Components/CourseCard";
import CourseRow from "./Components/CourseRow";
import CourseStats from "./Components/CourseStats";
import CourseToolbar from "./Components/CourseToolbar";

export default function ManageClasses({
  courses = [],
  categories = [],
  filters: initialFilters = {},
}) {
  const [viewMode, setViewMode] = useState("grid");
  const [search, setSearch] = useState(initialFilters.search ?? "");
  const [filterStatus, setFilterStatus] = useState(
    initialFilters.status ?? "all",
  );
  const [showCreate, setShowCreate] = useState(false);

  const applyFilter = (key, value) => {
    const next = { search, status: filterStatus, [key]: value };

    if (key === "status") setFilterStatus(value);
    if (key === "search") setSearch(value);

    router.get(route("instructor.classes.index"), next, {
      preserveState: true,
      replace: true,
    });
  };

  return (
    <MainLayout title="Manage Classes" breadcrumb="Classes">
      <div className="p-8 flex flex-col gap-6">
        {/* HEADER */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-black uppercase">Manage Classes</h2>
            <p className="text-sm text-gray-400 mt-1">
              Create and manage your training courses.
            </p>
          </div>

          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-5 py-3 text-xs font-extrabold tracking-widest uppercase bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md shadow-blue-200 hover:-translate-y-0.5 transition-all"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4v16m8-8H4"
              />
            </svg>
            Create Course
          </button>
        </div>

        {/* STATS */}
        <CourseStats courses={courses} />

        {/* TOOLBAR */}
        <CourseToolbar
          search={search}
          setSearch={setSearch}
          filterStatus={filterStatus}
          setFilterStatus={setFilterStatus}
          applyFilter={applyFilter}
          viewMode={viewMode}
          setViewMode={setViewMode}
        />

        {/* LIST */}
        {viewMode === "grid" ? (
          <div className="grid grid-cols-3 gap-5">
            {courses.map((c) => (
              <CourseCard key={c.id} course={c} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {courses.map((c) => (
              <CourseRow key={c.id} course={c} />
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <CreateCourseModal
          categories={categories}
          onClose={() => setShowCreate(false)}
        />
      )}
    </MainLayout>
  );
}
