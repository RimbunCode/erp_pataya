import { router, usePage } from "@inertiajs/react";
import { useRef } from "react";
import { XIcon } from "lucide-react";
import UploadDialog2 from "@/Pages/Core/Components/UploadDialog2";

function CourseCertificateCard({ course }) {
  const { errors } = usePage().props;
  const uploadDialogRef = useRef();

  const issueFromTemplate = () => {
    router.post(
      route("admin.student-certificate-uploads.issue-from-template", course.enrollmentId),
      {},
      { preserveScroll: true },
    );
  };

  const barColor =
    course.progress === 100
      ? "bg-green-500"
      : course.progress === 0
        ? "bg-gray-300"
        : "bg-primary";

  const canUpload = course.progress >= 100;

  const openUploadDialog = () => {
    if (!canUpload) return;
    uploadDialogRef.current?.open();
  };

  return (
    <div className="bg-muted rounded-2xl border border-border px-4 py-3.5 space-y-3">
      <div>
        <p className="text-sm font-black text-foreground leading-snug">
          {course.courseTitle}
        </p>
        {course.instructorName && (
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mt-0.5">
            {course.instructorName}
          </p>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[9px] font-black tracking-widest text-muted-foreground uppercase">
            Progress
          </p>
          <p className="text-[10px] font-black text-foreground">
            {course.progress}%
          </p>
        </div>
        <div className="h-1.5 bg-border rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${barColor}`}
            style={{ width: `${course.progress}%` }}
          />
        </div>
      </div>

      {course.certificate ? (
        <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
          <div className="min-w-0">
            <p className="text-[9px] font-black tracking-widest text-amber-600 uppercase">
              Sudah Diupload
            </p>
            <p className="text-[10px] font-bold text-amber-800 mt-0.5 truncate">
              {course.certificate.fileName} · {course.certificate.uploadedAt}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <a
              href={course.certificate.previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[9px] font-black tracking-widest uppercase text-amber-600 hover:text-amber-800 transition-colors"
            >
              Lihat
            </a>
            <button
              onClick={openUploadDialog}
              className="text-[9px] font-black tracking-widest uppercase text-primary hover:text-primary-hover transition-colors"
            >
              Re-upload
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={openUploadDialog}
            disabled={!canUpload}
            className={`flex-1 py-2.5 text-[10px] font-black tracking-widest uppercase rounded-xl transition-all flex items-center justify-center gap-2
              ${
                canUpload
                  ? "bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/20"
                  : "bg-border text-muted-foreground cursor-not-allowed"
              }`}
          >
            {canUpload ? "Upload Manual" : "Course Belum Selesai"}
          </button>
          <button
            onClick={issueFromTemplate}
            disabled={!canUpload}
            className={`flex-1 py-2.5 text-[10px] font-black tracking-widest uppercase rounded-xl transition-all flex items-center justify-center gap-2
              ${
                canUpload
                  ? "bg-primary hover:bg-primary-hover text-white shadow-md shadow-primary/20"
                  : "bg-border text-muted-foreground cursor-not-allowed"
              }`}
          >
            Terbitkan via Template
          </button>
        </div>
      )}

      {errors?.files && (
        <p className="text-[10px] font-bold text-destructive">{errors.files}</p>
      )}

      <UploadDialog2
        ref={uploadDialogRef}
        single
        accept=".pdf,.jpg,.jpeg,.png,.webp"
        options={{
          route: route(
            "admin.student-certificate-uploads.upload",
            course.enrollmentId,
          ),
          preserveScroll: true,
        }}
      />
    </div>
  );
}

export default function StudentCourseCertificateModal({
  student,
  courses,
  onClose,
}) {
  const alias = student.name
    .split(" ")
    .slice(0, 2)
    .map((n) => n.charAt(0))
    .join("");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{
        backdropFilter: "blur(6px)",
        backgroundColor: "rgba(15,23,42,0.45)",
      }}
      onClick={onClose}
    >
      <div
        className="bg-card rounded-3xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gray-900 px-7 pt-7 pb-6 relative flex-shrink-0 rounded-t-3xl">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-xl bg-card/10 text-white/60 hover:bg-card/20 hover:text-white transition-all"
          >
            <XIcon className="size-5" />
          </button>

          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500 flex items-center justify-center text-white text-lg font-black flex-shrink-0">
              {alias}
            </div>
            <div>
              <h3 className="text-base font-black text-white tracking-wide">
                {student.name}
              </h3>
              <p className="text-xs text-muted-foreground font-medium mt-0.5">
                {student.email}
              </p>
            </div>
          </div>
        </div>

        <div className="px-7 py-5 space-y-3 overflow-y-auto flex-1 min-h-0">
          <p className="text-[10px] font-black tracking-widest text-muted-foreground uppercase">
            Course Diikuti ({courses.length})
          </p>

          {courses.length > 0 ? (
            courses.map((course) => (
              <CourseCertificateCard
                key={course.enrollmentId}
                course={course}
              />
            ))
          ) : (
            <div className="px-4 py-6 rounded-xl border border-border bg-muted text-center">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                Student belum mengikuti course apapun
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
