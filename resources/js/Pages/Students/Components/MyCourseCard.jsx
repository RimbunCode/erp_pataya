import { Avatar, AvatarFallback, AvatarImage } from "@/Components/ui/avatar";
import MyCourseInnerSection from "./MyCourseInnerSection";
import { FileTextIcon, TrashIcon, StarIcon, MessageSquareIcon } from "lucide-react";

const TYPE_CFG = {
  pre_assessment: {
    label: "Pra Asesmen",
    icon: (
      <svg className="w-3.5 h-3.5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
    iconBg: "bg-amber-50",
    labelColor: "text-amber-500",
    btnClass: "bg-amber-500 hover:bg-amber-600",
  },
  material: {
    label: "Materi",
    icon: (
      <svg className="w-3.5 h-3.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    iconBg: "bg-primary-soft",
    labelColor: "text-primary",
    btnClass: "",
  },
  assignment: {
    label: "Tugas",
    icon: (
      <svg className="w-3.5 h-3.5 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
    iconBg: "bg-violet-50",
    labelColor: "text-violet-500",
    btnClass: "bg-violet-600 hover:bg-violet-700",
  },
};

function ContentRow({ content, onSubmit, onMarkDone, onDeleteSubmissionFile }) {
  const tc = TYPE_CFG[content.type] ?? TYPE_CFG.material;
  const sub = content.submission;
  const hasGrade = sub && sub.grade !== null && sub.grade !== undefined;
  const hasFeedback = sub && !!sub.feedback;
  const isSubmissionType = content.type === "pre_assessment" || content.type === "assignment";

  return (
    <div className="py-3 border-b border-border last:border-0">
      {/* Row utama: icon + info + action — satu baris horizontal */}
      <div className="flex items-center gap-3">
        {/* Icon tipe */}
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${tc.iconBg}`}>
          {tc.icon}
        </div>

        {/* Judul + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-foreground truncate">{content.title}</span>
            <span className={`text-[10px] font-black uppercase tracking-widest ${tc.labelColor}`}>
              {tc.label}
            </span>
            {content.deadline_label && (
              <span className="text-[10px] text-muted-foreground">
                · Deadline: {content.deadline_label}
              </span>
            )}
          </div>

          {/* Baris kedua: waktu submit (hanya jika ada) */}
          {sub?.submitted_at && (
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Dikumpulkan: <span className="font-bold text-foreground/70">{sub.submitted_at}</span>
            </p>
          )}
        </div>

        {/* Action button — kanan */}
        <div className="flex-shrink-0 flex items-center gap-2">
          {content.type === "material" && (
            content.is_completed ? (
              <span className="text-[10px] font-black text-green-600 bg-green-50 border border-green-100 px-2.5 py-1 rounded-lg">
                ✓ Done
              </span>
            ) : (
              <button
                onClick={() => onMarkDone(content.id)}
                className="text-[10px] font-black tracking-widest uppercase px-3 py-1.5 rounded-lg bg-primary-soft text-primary border border-primary/20 hover:bg-primary hover:text-white transition-all"
              >
                Mark Done
              </button>
            )
          )}
          {isSubmissionType && (
            <button
              onClick={() => onSubmit(content)}
              disabled={!content.can_manage_submission}
              className={`text-[10px] font-black tracking-widest uppercase px-3 py-1.5 rounded-lg text-white transition-all ${tc.btnClass} ${!content.can_manage_submission ? "opacity-40 cursor-not-allowed" : ""}`}
            >
              {sub?.files?.length ? "Resubmit" : "Submit"}
            </button>
          )}
        </div>
      </div>

      {/* Link materi dan file instruktur — compact horizontal */}
      {(content.url || !!content.files?.length) && (
        <div className="flex flex-wrap gap-1.5 mt-2 pl-11">
          {content.url && (
            <a
              href={content.url}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1 text-[10px] font-black tracking-widest uppercase text-primary bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-lg hover:bg-primary hover:text-white transition-all"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              Buka Link
            </a>
          )}
          {content.files?.map((file) => (
            <a
              key={file.id}
              href={route("files.preview", file.id)}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1 text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-lg hover:bg-primary hover:text-white transition-all"
            >
              <FileTextIcon className="w-3 h-3" />
              {file.fullname}
            </a>
          ))}
        </div>
      )}

      {/* Area submission student — hanya jika ada */}
      {isSubmissionType && sub && (
        <div className="mt-2.5 pl-11 space-y-2">
          {/* Catatan student */}
          {sub.notes && (
            <p className="text-[10px] text-muted-foreground italic">
              Catatan: {sub.notes}
            </p>
          )}

          {/* File yang dikumpulkan */}
          {!!sub.files?.length && (
            <div className="flex flex-wrap gap-1.5">
              {sub.files.map((file) => (
                <div key={file.id} className="inline-flex items-center">
                  <a
                    href={route("files.preview", file.id)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] font-bold text-violet-600 bg-violet-50 border border-violet-100 px-2.5 py-1 rounded-l-lg hover:bg-violet-600 hover:text-white transition-all"
                  >
                    {file.fullname}
                  </a>
                  <button
                    type="button"
                    onClick={() => onDeleteSubmissionFile(content.id, file.id)}
                    disabled={!content.can_manage_submission}
                    className={`px-2 py-1 border border-l-0 rounded-r-lg transition-all ${
                      content.can_manage_submission
                        ? "text-red-500 border-red-100 bg-red-50 hover:bg-red-500 hover:text-white"
                        : "text-muted-foreground border-border bg-muted cursor-not-allowed"
                    }`}
                  >
                    <TrashIcon className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Grade & Feedback dari instruktur */}
          {(hasGrade || hasFeedback) && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5">
              <StarIcon className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-3 flex-wrap">
                  {hasGrade && (
                    <span className="text-[10px] font-black text-amber-700 uppercase tracking-widest">
                      Nilai: <span className="text-sm">{sub.grade}</span>/100
                    </span>
                  )}
                  {sub.graded_at && (
                    <span className="text-[9px] text-amber-600/70 font-medium">
                      dinilai {sub.graded_at}
                    </span>
                  )}
                </div>
                {hasFeedback && (
                  <div className="flex items-start gap-1.5">
                    <MessageSquareIcon className="w-3 h-3 text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="text-[11px] text-amber-800 leading-relaxed">{sub.feedback}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function MyCourseCard({
  course,
  isOpen,
  onToggle,
  onSubmit,
  onMarkDone,
  onDeleteSubmissionFile,
}) {
  const progressColor = course.progress === 100 ? "bg-green-500" : "bg-primary";

  return (
    <div
      className={`bg-card rounded-2xl border-2 shadow-sm transition-all duration-300
      ${isOpen ? "border-primary/50 shadow-primary/20" : "border-border hover:border-border"}`}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-5 px-6 py-5 text-left"
      >
        <div className="w-14 h-14 rounded-2xl overflow-hidden flex-shrink-0 bg-primary">
          <Avatar className="relative w-full h-auto border rounded-xl aspect-square group">
            {course.thumbnail && (
              <AvatarImage
                src={route("files.preview", course.thumbnail)}
                alt={course.title}
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

        <div className="flex-1 min-w-0">
          <span className="text-[10px] font-black tracking-widest text-muted-foreground uppercase bg-muted px-2 py-0.5 rounded-md">
            {course.category}
          </span>
          <h3 className="text-base font-black text-foreground uppercase tracking-wide mt-1.5 leading-snug">
            {course.title}
          </h3>
          <p className="text-sm text-muted-foreground font-medium mt-0.5">
            {course.instructor}
          </p>
        </div>

        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <span className="text-sm font-black text-foreground">{course.progress}%</span>
          <div className="w-28 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${progressColor}`}
              style={{ width: `${course.progress}%` }}
            />
          </div>
          <span className={`text-[10px] font-black uppercase tracking-widest ${course.progress === 100 ? "text-green-500" : "text-muted-foreground"}`}>
            {course.progress === 100 ? "Selesai" : "Berlangsung"}
          </span>
          <svg
            className={`w-4 h-4 text-muted-foreground transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {isOpen && (
        <div className="px-6 pb-6 space-y-3 border-t border-border pt-4">
          {course.sections.map((section) => (
            <MyCourseInnerSection
              key={section.id}
              title={section.title}
              accent="blue"
            >
              {section.contents.map((content) => (
                <ContentRow
                  key={content.id}
                  content={content}
                  onSubmit={onSubmit}
                  onMarkDone={onMarkDone}
                  onDeleteSubmissionFile={onDeleteSubmissionFile}
                />
              ))}
            </MyCourseInnerSection>
          ))}
        </div>
      )}
    </div>
  );
}
