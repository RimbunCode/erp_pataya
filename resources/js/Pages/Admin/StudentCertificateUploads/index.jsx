import MainLayout from "@/Layouts/MainLayout";
import { router, usePage } from "@inertiajs/react";
import { useEffect, useMemo, useState } from "react";
import StudentCourseCertificateModal from "./Components/StudentCourseCertificateModal";

const avatarColors = [
  "bg-emerald-500",
  "bg-blue-500",
  "bg-purple-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-teal-500",
];

export default function StudentCertificateUploads() {
  const {
    students = [],
    selectedStudentId = null,
    selectedStudentCourses = null,
  } = usePage().props;
  const [searchQuery, setSearchQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(Boolean(selectedStudentCourses));
  const [loadingStudentId, setLoadingStudentId] = useState(null);

  useEffect(() => {
    if (selectedStudentCourses) {
      setModalOpen(true);
    }
  }, [selectedStudentCourses]);

  const filtered = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();
    if (!keyword) return students;

    return students.filter(
      (student) =>
        student.name?.toLowerCase().includes(keyword) ||
        student.email?.toLowerCase().includes(keyword),
    );
  }, [students, searchQuery]);

  const selectedStudent = useMemo(
    () => students.find((student) => student.id === selectedStudentId) ?? null,
    [students, selectedStudentId],
  );

  const openStudent = (studentId) => {
    setLoadingStudentId(studentId);
    router.get(
      route("admin.student-certificate-uploads.show", studentId),
      {},
      {
        only: ["selectedStudentId", "selectedStudentCourses"],
        preserveState: true,
        preserveScroll: true,
        onSuccess: () => setModalOpen(true),
        onFinish: () => setLoadingStudentId(null),
      },
    );
  };

  const closeModal = () => {
    setModalOpen(false);
  };

  return (
    <MainLayout>
      <div
        data-role="admin"
        className="flex h-screen bg-[var(--background)] overflow-hidden"
      >
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-auto p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-black text-[var(--foreground)] tracking-tight">
                  UPLOAD SERTIFIKAT STUDENT
                </h1>
                <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
                  Pilih student untuk melihat progress course dan upload
                  sertifikat.
                </p>
              </div>
            </div>

            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl flex flex-col overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)]">
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Cari nama atau email student..."
                  className="text-xs border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--ring)] w-72"
                />
              </div>

              <div className="divide-y divide-[var(--border)]">
                {filtered.length === 0 ? (
                  <div className="py-16 flex items-center justify-center text-sm text-[var(--muted-foreground)]">
                    Tidak ada student ditemukan
                  </div>
                ) : (
                  filtered.map((student, index) => {
                    const color = avatarColors[index % avatarColors.length];
                    const alias = student.name
                      .split(" ")
                      .slice(0, 2)
                      .map((n) => n.charAt(0))
                      .join("");

                    return (
                      <button
                        key={student.id}
                        onClick={() => openStudent(student.id)}
                        disabled={loadingStudentId === student.id}
                        className="w-full flex items-center gap-4 px-4 py-3 text-left hover:bg-[var(--secondary)] transition-colors disabled:opacity-60"
                      >
                        <div
                          className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center text-white text-sm font-black flex-shrink-0`}
                        >
                          {alias || student.avatar}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-[var(--foreground)] truncate">
                            {student.name}
                          </p>
                          <p className="text-xs text-[var(--muted-foreground)] truncate">
                            {student.email}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-[10px] font-black tracking-widest text-[var(--muted-foreground)] uppercase">
                            Course
                          </p>
                          <p className="text-sm font-bold text-[var(--foreground)]">
                            {student.totalCourses}
                          </p>
                        </div>
                        {loadingStudentId === student.id && (
                          <span className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-widest flex-shrink-0">
                            Loading...
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {modalOpen && selectedStudent && selectedStudentCourses && (
        <StudentCourseCertificateModal
          student={selectedStudent}
          courses={selectedStudentCourses}
          onClose={closeModal}
        />
      )}
    </MainLayout>
  );
}
