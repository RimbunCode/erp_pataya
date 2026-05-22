import MainLayout from "@/Layouts/MainLayout";
import { useState } from "react";

const approvalData = [
  {
    id: 1,
    title: "Structural BIM for Civil Engineers",
    instructor: "Budi Santoso",
    category: "Civil Engineering",
    submitted: "2025-06-10",
    type: "New Course",
    status: "pending",
    thumbnail: "SB",
    color: "bg-blue-100 text-blue-700",
    description:
      "A comprehensive course covering Building Information Modeling fundamentals applied to structural civil engineering projects.",
    modules: 12,
    duration: "24 hours",
    price: "Rp 850.000",
  },
  {
    id: 2,
    title: "Ethics in Engineering Practice",
    instructor: "Siti Nur",
    category: "Professional Development",
    submitted: "2025-06-09",
    type: "New Course",
    status: "pending",
    thumbnail: "EE",
    color: "bg-violet-100 text-violet-700",
    description:
      "Explores ethical frameworks and decision-making in engineering, aligned with Indonesian professional standards.",
    modules: 8,
    duration: "16 hours",
    price: "Rp 550.000",
  },
  {
    id: 3,
    title: "Advanced Construction Management",
    instructor: "Adi Wijaya",
    category: "Management",
    submitted: "2025-06-08",
    type: "New Course",
    status: "pending",
    thumbnail: "AC",
    color: "bg-emerald-100 text-emerald-700",
    description:
      "Advanced techniques in project scheduling, cost estimation, and risk management for large-scale construction projects.",
    modules: 15,
    duration: "32 hours",
    price: "Rp 1.200.000",
  },
  {
    id: 4,
    title: "AutoCAD 2D & 3D Mastery",
    instructor: "Reza Kurniawan",
    category: "CAD & Design",
    submitted: "2025-06-07",
    type: "Course Update",
    status: "approved",
    thumbnail: "AM",
    color: "bg-amber-100 text-amber-700",
    description:
      "Complete AutoCAD training from 2D drafting basics to advanced 3D modeling for architecture and engineering.",
    modules: 20,
    duration: "40 hours",
    price: "Rp 950.000",
  },
  {
    id: 5,
    title: "Geotechnical Engineering Fundamentals",
    instructor: "Hendra Putra",
    category: "Civil Engineering",
    submitted: "2025-06-06",
    type: "New Course",
    status: "rejected",
    thumbnail: "GE",
    color: "bg-rose-100 text-rose-700",
    description:
      "Foundation design, soil mechanics, and site investigation methods for civil engineering practice.",
    modules: 10,
    duration: "20 hours",
    price: "Rp 720.000",
  },
  {
    id: 6,
    title: "Electrical Installation Standards",
    instructor: "Dewi Lestari",
    category: "Electrical",
    submitted: "2025-06-05",
    type: "New Course",
    status: "approved",
    thumbnail: "EI",
    color: "bg-cyan-100 text-cyan-700",
    description:
      "Comprehensive guide to PLN installation standards and safety regulations for residential and commercial buildings.",
    modules: 9,
    duration: "18 hours",
    price: "Rp 680.000",
  },
  {
    id: 7,
    title: "Project Risk Assessment",
    instructor: "Fajar Hidayat",
    category: "Management",
    submitted: "2025-06-04",
    type: "Course Update",
    status: "pending",
    thumbnail: "PR",
    color: "bg-indigo-100 text-indigo-700",
    description:
      "Systematic identification, analysis, and mitigation of risks in engineering and construction projects.",
    modules: 7,
    duration: "14 hours",
    price: "Rp 490.000",
  },
];

const statusConfig = {
  pending: {
    label: "Pending",
    class:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    dot: "bg-amber-500",
    icon: "⏳",
  },
  approved: {
    label: "Approved",
    class:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    dot: "bg-emerald-500",
    icon: "✓",
  },
  rejected: {
    label: "Rejected",
    class: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    dot: "bg-red-500",
    icon: "✗",
  },
};

export default function Approvals() {
  const [activeFilter, setActiveFilter] = useState("all");
  const [selectedItem, setSelectedItem] = useState(approvalData[0]);
  const [searchQuery, setSearchQuery] = useState("");
  const [localData, setLocalData] = useState(approvalData);

  const counts = {
    all: localData.length,
    pending: localData.filter((d) => d.status === "pending").length,
    approved: localData.filter((d) => d.status === "approved").length,
    rejected: localData.filter((d) => d.status === "rejected").length,
  };

  const filtered = localData.filter((d) => {
    const matchFilter = activeFilter === "all" || d.status === activeFilter;
    const matchSearch =
      d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.instructor.toLowerCase().includes(searchQuery.toLowerCase());
    return matchFilter && matchSearch;
  });

  const handleApprove = (id) => {
    setLocalData((prev) =>
      prev.map((d) => (d.id === id ? { ...d, status: "approved" } : d)),
    );
    if (selectedItem?.id === id)
      setSelectedItem((prev) => ({ ...prev, status: "approved" }));
  };

  const handleReject = (id) => {
    setLocalData((prev) =>
      prev.map((d) => (d.id === id ? { ...d, status: "rejected" } : d)),
    );
    if (selectedItem?.id === id)
      setSelectedItem((prev) => ({ ...prev, status: "rejected" }));
  };

  return (
    <MainLayout>
      <div
        data-role="admin"
        className="flex h-screen bg-[var(--background)] overflow-hidden font-sans"
      >
        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Page Body */}
          <div className="flex-1 overflow-auto p-6">
            {/* Page Title */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-3xl font-black text-[var(--foreground)] tracking-tight">
                  ACCOUNT APPROVAL
                </h1>
                <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
                  Review and manage user accounts and their approval status
                </p>
              </div>
              <div className="flex gap-2">
                <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-[var(--border)] text-[var(--foreground)] bg-[var(--card)] rounded-lg hover:bg-[var(--secondary)] transition-colors">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z"
                    />
                  </svg>
                  Filter
                </button>
                <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                    />
                  </svg>
                  Export
                </button>
              </div>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              {[
                {
                  label: "Total Submissions",
                  value: counts.all,
                  icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
                  sub: "This Month",
                  subColor: "text-[var(--muted-foreground)]",
                  trend: null,
                },
                {
                  label: "Pending Review",
                  value: counts.pending,
                  icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
                  sub: "Requires Action",
                  subColor: "text-red-500",
                  trend: "↑",
                },
                {
                  label: "Approved",
                  value: counts.approved,
                  icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
                  sub: "+2 This Week",
                  subColor: "text-emerald-500",
                  trend: "↑",
                },
                {
                  label: "Rejected",
                  value: counts.rejected,
                  icon: "M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z",
                  sub: "Needs Revision",
                  subColor: "text-red-500",
                  trend: null,
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4"
                >
                  <div className="flex items-start justify-between mb-3">
                    <p className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                      {stat.label}
                    </p>
                    <div className="w-8 h-8 rounded-lg bg-[var(--primary-soft)] flex items-center justify-center">
                      <svg
                        className="w-4 h-4 text-[var(--primary)]"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d={stat.icon}
                        />
                      </svg>
                    </div>
                  </div>
                  <p className="text-3xl font-black text-[var(--foreground)]">
                    {stat.value}
                  </p>
                  <p className={`text-xs font-medium mt-1 ${stat.subColor}`}>
                    {stat.sub}
                  </p>
                </div>
              ))}
            </div>

            {/* Content Area: List + Detail */}
            <div className="flex gap-4 h-[calc(100vh-380px)] min-h-[420px]">
              {/* Left: Approval List */}
              <div className="flex-1 bg-[var(--card)] border border-[var(--border)] rounded-xl flex flex-col overflow-hidden">
                {/* Filter Tabs */}
                <div className="flex border-b border-[var(--border)] px-4">
                  {["all", "pending", "approved", "rejected"].map((f) => (
                    <button
                      key={f}
                      onClick={() => setActiveFilter(f)}
                      className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider transition-colors relative ${
                        activeFilter === f
                          ? "text-[var(--primary)]"
                          : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                      }`}
                    >
                      {f === "all"
                        ? "All"
                        : f.charAt(0).toUpperCase() + f.slice(1)}
                      <span
                        className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] ${
                          activeFilter === f
                            ? "bg-[var(--primary-soft)] text-[var(--primary)]"
                            : "bg-[var(--secondary)] text-[var(--muted-foreground)]"
                        }`}
                      >
                        {counts[f]}
                      </span>
                      {activeFilter === f && (
                        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--primary)] rounded-t" />
                      )}
                    </button>
                  ))}
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto divide-y divide-[var(--border)]">
                  {filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-[var(--muted-foreground)]">
                      <svg
                        className="w-10 h-10 mb-2 opacity-40"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                        />
                      </svg>
                      <p className="text-sm">No submissions found</p>
                    </div>
                  ) : (
                    filtered.map((item) => {
                      const status = statusConfig[item.status];
                      const isSelected = selectedItem?.id === item.id;
                      return (
                        <div
                          key={item.id}
                          onClick={() => setSelectedItem(item)}
                          className={`flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-colors ${
                            isSelected
                              ? "bg-primary-soft dark:bg-primary-soft]"
                              : "hover:bg-background-accent dark:hover:bg-background-accent-dark]"
                          }`}
                        >
                          <div
                            className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${item.color}`}
                          >
                            {item.thumbnail}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p
                              className={`text-sm font-semibold truncate ${isSelected ? "text-[var(--primary)]" : "text-[var(--foreground)]"}`}
                            >
                              {item.title}
                            </p>
                            <p className="text-xs text-[var(--muted-foreground)] truncate">
                              {item.instructor} · {item.category}
                            </p>
                          </div>
                          <div className="shrink-0 flex flex-col items-end gap-1">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${status.class}`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${status.dot}`}
                              />
                              {status.label}
                            </span>
                            <span className="text-[10px] text-[var(--muted-foreground)]">
                              {item.submitted}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Right: Detail Panel */}
              {selectedItem &&
                (() => {
                  const currentItem =
                    localData.find((d) => d.id === selectedItem.id) ||
                    selectedItem;
                  const status = statusConfig[currentItem.status];
                  return (
                    <div className="w-80 bg-[var(--card)] border border-[var(--border)] rounded-xl flex flex-col overflow-hidden shrink-0">
                      {/* Detail Header */}
                      <div className="p-5 border-b border-[var(--border)]">
                        <div className="flex items-start justify-between mb-3">
                          <div
                            className={`w-12 h-12 rounded-xl flex items-center justify-center text-sm font-bold ${currentItem.color}`}
                          >
                            {currentItem.thumbnail}
                          </div>
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${status.class}`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${status.dot}`}
                            />
                            {status.label}
                          </span>
                        </div>
                        <h3 className="text-sm font-bold text-[var(--foreground)] leading-snug">
                          {currentItem.title}
                        </h3>
                        <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                          {currentItem.type} · {currentItem.category}
                        </p>
                      </div>

                      {/* Instructor */}
                      <div className="px-5 py-4 border-b border-[var(--border)]">
                        <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-widest font-semibold mb-2">
                          Instructor
                        </p>
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-[var(--primary-soft)] flex items-center justify-center text-xs font-bold text-[var(--primary)]">
                            {currentItem.instructor
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .slice(0, 2)}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-[var(--foreground)]">
                              {currentItem.instructor}
                            </p>
                            <p className="text-xs text-[var(--muted-foreground)]">
                              Submitted {currentItem.submitted}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Description */}
                      <div className="px-5 py-4 border-b border-[var(--border)] flex-1 overflow-y-auto">
                        <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-widest font-semibold mb-2">
                          Description
                        </p>
                        <p className="text-xs text-[var(--foreground)] leading-relaxed">
                          {currentItem.description}
                        </p>

                        <div className="grid grid-cols-3 gap-2 mt-4">
                          {[
                            { label: "Modules", value: currentItem.modules },
                            { label: "Duration", value: currentItem.duration },
                            { label: "Price", value: currentItem.price },
                          ].map((info) => (
                            <div
                              key={info.label}
                              className="bg-[var(--background-accent)] rounded-lg p-2.5 text-center dark:bg-[var(--background)] dark:text-[var(--foreground)] dark:border-[var(--primary)]"
                            >
                              <p className="text-[10px] text-[var(--muted-foreground)] font-medium">
                                {info.label}
                              </p>
                              <p className="text-xs font-bold text-[var(--foreground)] mt-0.5">
                                {info.value}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="p-4">
                        {currentItem.status === "pending" ? (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleReject(currentItem.id)}
                              className="flex-1 py-2.5 text-xs font-semibold border border-[var(--border)] text-[var(--foreground)] rounded-lg hover:bg-red-50 hover:text-red-600 hover:border-red-200 dark:hover:bg-red-950/30 transition-colors"
                            >
                              Reject
                            </button>
                            <button
                              onClick={() => handleApprove(currentItem.id)}
                              className="flex-1 py-2.5 text-xs font-semibold bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-hover)] transition-colors"
                            >
                              Approve
                            </button>
                          </div>
                        ) : currentItem.status === "approved" ? (
                          <div className="flex items-center justify-center gap-2 py-2.5 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg">
                            <svg
                              className="w-4 h-4 text-emerald-600 dark:text-emerald-400"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                              Course Approved
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-2 py-2.5 bg-red-50 dark:bg-red-950/30 rounded-lg">
                            <svg
                              className="w-4 h-4 text-red-600 dark:text-red-400"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                            <span className="text-xs font-semibold text-red-600 dark:text-red-400">
                              Course Rejected
                            </span>
                          </div>
                        )}
                        <button className="w-full mt-2 py-2 text-xs font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors">
                          View Full Details →
                        </button>
                      </div>
                    </div>
                  );
                })()}
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
