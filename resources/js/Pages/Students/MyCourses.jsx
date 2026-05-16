import MainLayout from "@/Layouts/MainLayout";
import { usePage, useForm, router } from "@inertiajs/react";
import { useState, useRef, useEffect } from "react";
import MyCourseCard from "./Components/MyCourseCard";
import UploadDialog2 from "@/Pages/Core/Components/UploadDialog2";

export default function MyCourses() {
  const { courses } = usePage().props;
  const [openId, setOpenId] = useState(null);
  const [activeContent, setActiveContent] = useState(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("ALL");
  const uploadDialogRef = useRef();
  const { post } = useForm();

  const toggle = (id) => setOpenId((prev) => (prev === id ? null : id));

  const handleMarkDone = (contentId) => {
    post(route("student.progress.store", contentId), {
      preserveScroll: true,
    });
  };

  const handleSubmit = (content) => {
    setActiveContent(content);
  };

  const handleDeleteSubmissionFile = (contentId, fileId) => {
    router.delete(
      route("student.submissions.files.destroy", {
        content: contentId,
        file: fileId,
      }),
      {
        preserveScroll: true,
      },
    );
  };

  useEffect(() => {
    if (activeContent) {
      uploadDialogRef.current?.open();
    }
  }, [activeContent]);

  const totalOngoing = courses.filter((c) => c.progress < 100).length;
  const totalFinished = courses.filter((c) => c.progress === 100).length;

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
          <div>
            <h2 className="text-3xl font-black tracking-tight text-foreground uppercase">
              My Learning
            </h2>
            <p className="text-sm text-muted-foreground font-medium mt-1">
              Akses semua kelas dan materi pembelajaran Anda.
            </p>
          </div>

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
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black tracking-widest uppercase transition-all
                    ${filter === tab.key ? "bg-primary text-white shadow-md shadow-primary/20" : "bg-card border border-border text-muted-foreground hover:text-foreground"}`}
                >
                  {tab.label}
                  <span
                    className={`px-1.5 py-0.5 rounded-md text-sm font-black ${filter === tab.key ? "bg-card/20 text-white" : "bg-muted text-muted-foreground"}`}
                  >
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

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
                className="pl-9 pr-4 py-2.5 text-sm bg-card border border-border rounded-xl w-60 focus:outline-none focus:ring-2 focus:ring-ring transition-all placeholder-muted-foreground"
              />
            </div>
          </div>

          <div className="flex flex-col gap-4">
            {filtered.length > 0 ? (
              filtered.map((course) => (
                <MyCourseCard
                  key={course.id}
                  course={course}
                  isOpen={openId === course.id}
                  onToggle={() => toggle(course.id)}
                  onSubmit={handleSubmit}
                  onMarkDone={handleMarkDone}
                  onDeleteSubmissionFile={handleDeleteSubmissionFile}
                />
              ))
            ) : (
              <div className="bg-card rounded-2xl border border-border py-16 flex flex-col items-center gap-3">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                  Tidak ada kelas ditemukan
                </p>
              </div>
            )}
          </div>
        </div>
      </MainLayout>

      <UploadDialog2
        ref={uploadDialogRef}
        allowNotes
        notesPlaceholder="Contoh: revisi jawaban / tambahan dokumen"
        options={{
          route: activeContent
            ? route("student.submissions.store", activeContent.id)
            : null,
          preserveScroll: true,
        }}
        onClose={() => setActiveContent(null)}
      />
    </>
  );
}
