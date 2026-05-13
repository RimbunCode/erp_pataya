// resources/js/Pages/Student/CourseList.jsx
// Layout: MainLayout title="My Learning" breadcrumb="Courses"

import { Avatar, AvatarFallback, AvatarImage } from "@/Components/ui/avatar";
import MainLayout from "@/Layouts/MainLayout";
import { router, usePage } from "@inertiajs/react";
import { useState, useRef } from "react";

// ── Submit Modal (Pra Asesmen & Tugas) ────────────────────────────────────────
function SubmitModal({ title, description, onClose }) {
  const [file, setFile] = useState(null);
  const [note, setNote] = useState("");
  const [done, setDone] = useState(false);
  const fileRef = useRef();

  const handleSubmit = () => {
    if (!file) return;
    setDone(true);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{
        backdropFilter: "blur(8px)",
        backgroundColor: "rgba(15,23,42,0.5)",
      }}
      onClick={onClose}
    >
      <div
        className="bg-card rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gray-900 px-6 pt-6 pb-8 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-xl bg-card/10 text-white/60 hover:bg-card/20 hover:text-white transition-all"
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
          <p className="text-[9px] font-black tracking-widest text-primary uppercase mb-1">
            Pengumpulan
          </p>
          <h3 className="text-sm font-black text-white leading-snug pr-8">
            {title}
          </h3>
        </div>

        <div className="px-6 py-5 space-y-4">
          {!done ? (
            <>
              {description && (
                <div className="bg-primary-soft rounded-2xl border border-primary/20 px-4 py-3">
                  <p className="text-[9px] font-black tracking-widest text-primary uppercase mb-1">
                    Instruksi
                  </p>
                  <p className="text-xs text-primary font-medium leading-relaxed">
                    {description}
                  </p>
                </div>
              )}

              {/* Upload area */}
              <div>
                <label className="text-[9px] font-black tracking-widest text-muted-foreground uppercase block mb-1.5">
                  File Jawaban *
                </label>
                <div
                  onClick={() => fileRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-5 flex flex-col items-center gap-2.5 cursor-pointer transition-all
                    ${file ? "border-primary/40 bg-primary-soft" : "border-border hover:border-primary/35 hover:bg-muted"}`}
                >
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".pdf,.xlsx,.xls,.doc,.docx"
                    className="hidden"
                    onChange={(e) => setFile(e.target.files[0])}
                  />
                  {file ? (
                    <>
                      <div className="w-9 h-9 rounded-xl bg-primary-soft0 flex items-center justify-center">
                        <svg
                          className="w-4 h-4 text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                      </div>
                      <p className="text-xs font-black text-primary">
                        {file.name}
                      </p>
                      <p className="text-[9px] text-primary">
                        Klik untuk ganti
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center">
                        <svg
                          className="w-4 h-4 text-muted-foreground"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                          />
                        </svg>
                      </div>
                      <p className="text-xs font-black text-muted-foreground">
                        Klik untuk upload file
                      </p>
                      <p className="text-[9px] text-muted-foreground">
                        PDF, Excel, Word • Maks. 10MB
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* Note */}
              <div>
                <label className="text-[9px] font-black tracking-widest text-muted-foreground uppercase block mb-1.5">
                  Catatan untuk Instruktur (opsional)
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  placeholder="Tulis catatan atau hal yang ingin disampaikan terkait jawaban Anda..."
                  className="w-full text-xs text-foreground bg-muted border border-border rounded-xl px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-ring focus:bg-card transition-all placeholder-muted-foreground"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  className="flex-1 py-2.5 text-[10px] font-black tracking-widest uppercase border-2 border-border rounded-xl text-muted-foreground hover:border-border transition-all"
                >
                  Batal
                </button>
                <button
                  disabled={!file}
                  onClick={handleSubmit}
                  className="flex-1 py-2.5 text-[10px] font-black tracking-widest uppercase bg-primary text-white rounded-xl hover:bg-primary-hover transition-all shadow-md shadow-primary/20 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Kumpulkan →
                </button>
              </div>
            </>
          ) : (
            <div className="py-4 flex flex-col items-center gap-4 text-center">
              <div className="w-14 h-14 rounded-full bg-green-50 border-2 border-green-200 flex items-center justify-center">
                <svg
                  className="w-7 h-7 text-green-500"
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
              </div>
              <div>
                <p className="text-sm font-black text-foreground uppercase">
                  Berhasil Dikumpulkan!
                </p>
                <p className="text-xs text-muted-foreground font-medium mt-1">
                  Jawaban Anda telah diterima. Instruktur akan segera memeriksa.
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-full py-2.5 text-[10px] font-black tracking-widest uppercase bg-primary text-white rounded-xl hover:bg-primary-hover transition-all shadow-md shadow-primary/20"
              >
                Tutup
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Inner Section (Pra Asesmen / Materi / Tugas) ──────────────────────────────
function InnerSection({ title, icon, children, accent = "blue" }) {
  const [open, setOpen] = useState(false);
  const accents = {
    blue: {
      bg: "bg-primary-soft",
      border: "border-primary/20",
      text: "text-primary",
      dot: "bg-primary-soft0",
    },
    green: {
      bg: "bg-green-50",
      border: "border-green-100",
      text: "text-green-600",
      dot: "bg-green-500",
    },
    violet: {
      bg: "bg-violet-50",
      border: "border-violet-100",
      text: "text-violet-600",
      dot: "bg-violet-500",
    },
    amber: {
      bg: "bg-amber-50",
      border: "border-amber-100",
      text: "text-amber-600",
      dot: "bg-amber-500",
    },
  };
  const a = accents[accent];

  return (
    <div className={`rounded-xl border ${a.border} overflow-hidden`}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center justify-between px-4 py-3 ${a.bg} transition-all`}
      >
        <div className="flex items-center gap-2.5">
          <span className={`w-1.5 h-1.5 rounded-full ${a.dot}`} />
          <span
            className={`text-[10px] font-black tracking-widest uppercase ${a.text}`}
          >
            {title}
          </span>
          {icon}
        </div>
        <svg
          className={`w-3.5 h-3.5 ${a.text} transition-transform ${open ? "rotate-180" : ""}`}
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
      {open && <div className="px-4 py-4 bg-card space-y-3">{children}</div>}
    </div>
  );
}

// ── Course Card (accordion) ────────────────────────────────────────────────────
function CourseCard({ course, isOpen, onToggle, onSubmit, onMarkDone }) {
  const progressColor = course.progress === 100 ? "bg-green-500" : "bg-primary";

  return (
    <div
      className={`bg-card rounded-2xl border-2 shadow-sm transition-all duration-300
      ${isOpen ? "border-primary/50 shadow-primary/20" : "border-border hover:border-border"}`}
    >
      {/* ── Card Header (always visible) ── */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-5 px-6 py-5 text-left"
      >
        {/* Thumbnail */}
        <div className="w-14 h-14 rounded-2xl overflow-hidden flex-shrink-0 bg-primary">
          <Avatar className="relative w-full h-auto border rounded-xl aspect-square  group">
            {course.thumbnail && (
              <AvatarImage
                src={
                  route("files.preview", course.thumbnail) +
                  `?v=${new Date(course.updated_at).getTime()}`
                }
                alt={course.name}
              />
            )}
            <AvatarFallback className="rounded-lg">
              <img
                src="/storage/images/logo-default.png"
                alt={course.title}
                className="w-full h-full object-contain"
              />
            </AvatarFallback>
          </Avatar>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[9px] font-black tracking-widest text-muted-foreground uppercase bg-muted px-2 py-0.5 rounded-md">
              {course.category}
            </span>
            {course.enrolled && (
              <span className="text-[9px] font-black tracking-widest text-primary uppercase bg-primary-soft border border-primary/20 px-2 py-0.5 rounded-md">
                Terdaftar
              </span>
            )}
          </div>
          <h3 className="text-sm font-black text-foreground uppercase tracking-wide mt-1.5 leading-snug">
            {course.title}
          </h3>
          <p className="text-[10px] text-muted-foreground font-medium mt-1 flex items-center gap-2">
            {course.instructor}
            <span className="w-1 h-1 rounded-full bg-gray-300 inline-block" />
            {course.duration}
          </p>
        </div>

        {/* Right side */}
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          {course.enrolled ? (
            <div className="flex flex-col items-end gap-1.5">
              <span className="text-xs font-black text-foreground">
                {course.progress}%
              </span>
              <div className="w-28 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${progressColor}`}
                  style={{ width: `${course.progress}%` }}
                />
              </div>
              <span className="text-[9px] font-bold text-muted-foreground">
                {course.progress === 100 ? "Selesai" : "Berlangsung"}
              </span>
            </div>
          ) : (
            <span className="text-sm font-black text-primary">
              {course.price}
            </span>
          )}
          <svg
            className={`w-4 h-4 text-muted-foreground transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </button>

      {isOpen && (
        <div className="px-6 pb-6 space-y-3 border-t border-border pt-4">
          {course.sections.map((section) => (
            <InnerSection key={section.id} title={section.title} accent="blue">
              {section.contents.map((content) => (
                <div
                  key={content.id}
                  className="flex items-center justify-between gap-4 py-2 border-b border-border last:border-0"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Icon berdasarkan type */}
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0
                ${
                  content.type === "pre_assessment"
                    ? "bg-amber-50"
                    : content.type === "assignment"
                      ? "bg-violet-50"
                      : "bg-primary-soft"
                }`}
                    >
                      {content.type === "pre_assessment" && (
                        <svg
                          className="w-3.5 h-3.5 text-amber-500"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                          />
                        </svg>
                      )}
                      {content.type === "material" && (
                        <svg
                          className="w-3.5 h-3.5 text-primary"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                      )}
                      {content.type === "assignment" && (
                        <svg
                          className="w-3.5 h-3.5 text-violet-500"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                      )}
                    </div>

                    <div>
                      <span className="text-xs font-bold text-foreground truncate block">
                        {content.title}
                      </span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span
                          className={`text-[9px] font-black uppercase tracking-widest
                    ${
                      content.type === "pre_assessment"
                        ? "text-amber-500"
                        : content.type === "assignment"
                          ? "text-violet-500"
                          : "text-primary"
                    }`}
                        >
                          {content.type === "pre_assessment"
                            ? "Pra Asesmen"
                            : content.type === "assignment"
                              ? "Tugas"
                              : "Materi"}
                        </span>
                        {content.deadline && (
                          <span className="text-[9px] text-muted-foreground">
                            • Deadline: {content.deadline}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action / Status */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {content.is_completed ? (
                      <span className="text-[9px] font-black text-green-600 bg-green-50 border border-green-100 px-2 py-0.5 rounded-md">
                        ✓ Selesai
                      </span>
                    ) : (
                      <>
                        {content.type === "material" && (
                          <button
                            onClick={() => onMarkDone(content.id)}
                            className="text-[9px] font-black tracking-widest uppercase px-3 py-1.5 rounded-lg bg-primary-soft text-primary border border-primary/20 hover:bg-primary hover:text-white transition-all"
                          >
                            Mark as Done
                          </button>
                        )}
                        {(content.type === "pre_assessment" ||
                          content.type === "assignment") && (
                          <button
                            onClick={() => onSubmit(content)}
                            className={`text-[9px] font-black tracking-widest uppercase px-3 py-1.5 rounded-lg text-white transition-all
                        ${content.type === "pre_assessment" ? "bg-amber-500 hover:bg-amber-600" : "bg-violet-600 hover:bg-violet-700"}`}
                          >
                            Kumpulkan
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </InnerSection>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function MyCourses() {
  const { courses } = usePage().props;
  const [openId, setOpenId] = useState(null);
  const [submitModal, setSubmitModal] = useState(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("ALL");

  const toggle = (id) => setOpenId((prev) => (prev === id ? null : id));

  const totalOngoing = courses.filter((c) => c.progress < 100).length;
  const totalFinished = courses.filter((c) => c.progress === 100).length;

  const handleMarkDone = (contentId) => {
    router.post(
      route("student.progress.store", contentId),
      {},
      {
        preserveScroll: true,
      },
    );
  };

  const filtered = courses.filter((c) => {
    const matchSearch =
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.instructor.toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === "ALL" ||
      (filter === "ONGOING" && c.progress < 100) ||
      (filter === "FINISHED" && c.progress === 100);
    return matchSearch && matchFilter;
  });
  return (
    <>
      <MainLayout title="My Courses" breadcrumb="My Courses">
        <div className="p-8 space-y-6">
          {/* Header */}
          <div>
            <h2 className="text-2xl font-black tracking-tight text-foreground uppercase">
              My Learning
            </h2>
            <p className="text-xs text-muted-foreground font-medium mt-0.5">
              Akses semua kelas dan materi pembelajaran Anda.
            </p>
          </div>

          {/* Quick stats + filter tabs */}
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-2">
              {[
                { key: "ALL", label: "Semua", count: courses.length },
                { key: "ONGOING", label: "On Going", count: totalOngoing },
                { key: "FINISHED", label: "Finished", count: totalFinished },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all
                  ${filter === tab.key ? "bg-primary text-white shadow-md shadow-primary/20" : "bg-card border border-border text-muted-foreground hover:border-border hover:text-foreground"}`}
                >
                  {tab.label}
                  <span
                    className={`px-1.5 py-0.5 rounded-md text-[9px] font-black ${filter === tab.key ? "bg-card/20 text-white" : "bg-muted text-muted-foreground"}`}
                  >
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Search */}
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
                placeholder="Cari kelas..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2 text-xs bg-card border border-border rounded-xl w-52 focus:outline-none focus:ring-2 focus:ring-ring focus:bg-card transition-all placeholder-muted-foreground"
              />
            </div>
          </div>

          {/* Course List */}
          <div className="flex flex-col gap-4">
            {filtered.length > 0 ? (
              filtered.map((course) => (
                <CourseCard
                  key={course.id}
                  course={course}
                  isOpen={openId === course.id}
                  onToggle={() => toggle(course.id)}
                  onSubmit={(content) => setSubmitModal(content)}
                  onMarkDone={(contentId) => handleMarkDone(contentId)}
                />
              ))
            ) : (
              <div className="bg-card rounded-2xl border border-border py-16 flex flex-col items-center gap-3">
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
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                  />
                </svg>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                  Tidak ada kelas ditemukan
                </p>
              </div>
            )}
          </div>
        </div>
      </MainLayout>

      {/* Submit Modal */}
      {submitModal && (
        <SubmitModal
          title={submitModal.title}
          description={submitModal.description}
          onClose={() => setSubmitModal(null)}
        />
      )}
    </>
  );
}
