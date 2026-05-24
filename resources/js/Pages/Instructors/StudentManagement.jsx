import MainLayout from "@/Layouts/MainLayout";
import { usePage } from "@inertiajs/react";
import { useState } from "react";
import StudentManagementModal from "./Components/StudentManagementModal";
import StudentManagementRow from "./Components/StudentManagementRow";
import StudentManagementStatCard from "./Components/StudentManagementStatCard";

function buildStatCards({ total, active, completed, pending }) {
  return [
    {
      label: "Total Students",
      value: total,
      sub: "Across all classes",
      key: "ALL",
      accentBorder: "border-border",
      accentDot: "bg-muted0",
      accentIcon: "bg-muted",
      icon: (
        <svg
          className="w-5 h-5 text-muted-foreground"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      ),
    },
    {
      label: "Active",
      value: active,
      sub: "Currently learning",
      key: "ACTIVE",
      accentBorder: "border-primary/50",
      accentDot: "bg-primary-soft0",
      accentIcon: "bg-primary-soft",
      icon: (
        <svg
          className="w-5 h-5 text-primary"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M13 10V3L4 14h7v7l9-11h-7z"
          />
        </svg>
      ),
    },
    {
      label: "Completed",
      value: completed,
      sub: "Finished all modules",
      key: "COMPLETED",
      accentBorder: "border-green-500",
      accentDot: "bg-green-500",
      accentIcon: "bg-green-50",
      icon: (
        <svg
          className="w-5 h-5 text-green-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
    },
    {
      label: "Pending",
      value: pending,
      sub: "Not yet started",
      key: "PENDING",
      accentBorder: "border-amber-400",
      accentDot: "bg-amber-400",
      accentIcon: "bg-amber-50",
      icon: (
        <svg
          className="w-5 h-5 text-amber-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
    },
  ];
}

export default function StudentManagement() {
  const { students = [], courses = ["All Courses"] } = usePage().props;

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterCourse, setFilterCourse] = useState("All Courses");
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const handleOpen = (student, index) => {
    setSelectedStudent(student);
    setSelectedIndex(index);
  };

  const handleClose = () => {
    setSelectedStudent(null);
  };

  const total = students.length;
  const active = students.filter(
    (student) => student.status === "ACTIVE",
  ).length;
  const completed = students.filter(
    (student) => student.status === "COMPLETED",
  ).length;
  const pending = students.filter(
    (student) => student.status === "PENDING",
  ).length;

  const filtered = students.filter((student) => {
    const matchSearch =
      student.name.toLowerCase().includes(search.toLowerCase()) ||
      student.email.toLowerCase().includes(search.toLowerCase());
    const matchStatus =
      filterStatus === "ALL" || student.status === filterStatus;
    const matchCourse =
      filterCourse === "All Courses" || student.course === filterCourse;

    return matchSearch && matchStatus && matchCourse;
  });

  const statCards = buildStatCards({ total, active, completed, pending });

  return (
    <>
      <MainLayout title="Student Management">
        <div className="p-8 space-y-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <h2 className="text-2xl font-black tracking-tight text-foreground uppercase">
                Student Management
              </h2>
              <p className="text-xs text-muted-foreground font-medium mt-0.5">
                Monitor and manage all your enrolled students.
              </p>
            </div>
            <button className="px-5 py-2.5 text-xs font-black tracking-widest uppercase bg-primary text-white rounded-xl hover:bg-primary-hover transition-all flex items-center gap-2 shadow-md shadow-primary/20">
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
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              Export CSV
            </button>
          </div>

          <div className="flex gap-4 flex-wrap">
            {statCards.map((card) => (
              <StudentManagementStatCard
                key={card.key}
                label={card.label}
                value={card.value}
                sub={card.sub}
                icon={card.icon}
                accentBorder={card.accentBorder}
                accentDot={card.accentDot}
                accentIcon={card.accentIcon}
                active={filterStatus === card.key}
                onClick={() =>
                  setFilterStatus(
                    filterStatus === card.key && card.key !== "ALL"
                      ? "ALL"
                      : card.key,
                  )
                }
              />
            ))}
          </div>

          <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-border flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-foreground uppercase tracking-widest">
                  All Students
                </span>
                <span className="px-2 py-0.5 bg-primary-soft text-primary text-[10px] font-black rounded-lg border border-primary/20">
                  {filtered.length}
                </span>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <select
                  value={filterCourse}
                  onChange={(e) => setFilterCourse(e.target.value)}
                  className="text-xs font-bold text-muted-foreground bg-muted border border-border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
                >
                  {courses.map((course) => (
                    <option key={course}>{course}</option>
                  ))}
                </select>
                <div className="relative">
                  <svg
                    className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2"
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
                    placeholder="Search student..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 pr-4 py-2 text-xs bg-muted border border-border rounded-xl w-48 focus:outline-none focus:ring-2 focus:ring-ring focus:bg-card transition-all placeholder-muted-foreground"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-[2fr_2fr_1fr_1fr_auto] gap-4 px-6 py-3 bg-muted/60 border-b border-border">
              {["Student", "Course", "Progress", "Status", ""].map(
                (header, index) => (
                  <span
                    key={`${header}-${index}`}
                    className="text-[10px] font-black tracking-widest text-muted-foreground uppercase"
                  >
                    {header}
                  </span>
                ),
              )}
            </div>

            {filtered.length > 0 ? (
              filtered.map((student, index) => (
                <StudentManagementRow
                  key={student.id}
                  student={student}
                  index={index}
                  onOpen={handleOpen}
                />
              ))
            ) : (
              <div className="py-16 flex flex-col items-center gap-3">
                <svg
                  className="w-10 h-10 text-muted-foreground"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                  No students found
                </p>
              </div>
            )}

            {filtered.length > 0 && (
              <div className="px-6 py-3 border-t border-border flex items-center justify-between">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  Showing {filtered.length} of {total} students
                </p>
                <div className="flex items-center gap-1">
                  {["Prev", "1", "2", "Next"].map((paginationItem) => (
                    <button
                      key={paginationItem}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-[10px] font-black text-muted-foreground hover:bg-primary-soft hover:text-primary transition-colors"
                    >
                      {paginationItem}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </MainLayout>

      <StudentManagementModal
        student={selectedStudent}
        index={selectedIndex}
        onClose={handleClose}
      />
    </>
  );
}
