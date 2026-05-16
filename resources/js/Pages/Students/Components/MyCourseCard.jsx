import { Avatar, AvatarFallback, AvatarImage } from "@/Components/ui/avatar";
import MyCourseInnerSection from "./MyCourseInnerSection";
import { TrashIcon } from "lucide-react";

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
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-black tracking-widest text-muted-foreground uppercase bg-muted px-2 py-0.5 rounded-md">
              {course.category}
            </span>
          </div>
          <h3 className="text-base font-black text-foreground uppercase tracking-wide mt-1.5 leading-snug">
            {course.title}
          </h3>
          <p className="text-sm text-muted-foreground font-medium mt-1">
            {course.instructor}
          </p>
        </div>

        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <span className="text-sm font-black text-foreground">
            {course.progress}%
          </span>
          <div className="w-28 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${progressColor}`}
              style={{ width: `${course.progress}%` }}
            />
          </div>
          <span className="text-sm font-bold text-muted-foreground">
            {course.progress === 100 ? "Selesai" : "Berlangsung"}
          </span>
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
            <MyCourseInnerSection
              key={section.id}
              title={section.title}
              accent="blue"
            >
              {section.contents.map((content) => (
                <div
                  key={content.id}
                  className="flex items-center justify-between gap-4 py-2 border-b border-border last:border-0"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0
                      ${content.type === "pre_assessment" ? "bg-amber-50" : content.type === "assignment" ? "bg-violet-50" : "bg-primary-soft"}`}
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
                      <span className="text-sm font-bold text-foreground truncate block">
                        {content.title}
                      </span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span
                          className={`text-sm font-black uppercase tracking-widest
                          ${content.type === "pre_assessment" ? "text-amber-500" : content.type === "assignment" ? "text-violet-500" : "text-primary"}`}
                        >
                          {content.type === "pre_assessment"
                            ? "Pra Asesmen"
                            : content.type === "assignment"
                              ? "Tugas"
                              : "Materi"}
                        </span>
                        {content.deadline_label && (
                          <span className="text-sm text-muted-foreground">
                            Deadline: {content.deadline_label}
                          </span>
                        )}
                      </div>
                      {!!content.submission?.submitted_at && (
                        <p className="text-sm text-muted-foreground mt-1">
                          Upload: {content.submission.submitted_at}
                        </p>
                      )}
                      {!!content.submission?.notes && (
                        <p className="text-sm text-foreground/80 mt-1">
                          Note: {content.submission.notes}
                        </p>
                      )}
                      {!!content.submission?.files?.length && (
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {content.submission.files.map((file) => (
                            <div
                              key={file.id}
                              className="inline-flex items-center"
                            >
                              <a
                                href={route("files.preview", file.id)}
                                target="_blank"
                                rel="noreferrer"
                                className="text-sm font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-l-md hover:bg-primary hover:text-white transition-all"
                              >
                                {file.fullname}
                              </a>
                              <button
                                type="button"
                                onClick={() =>
                                  onDeleteSubmissionFile(content.id, file.id)
                                }
                                disabled={!content.can_manage_submission}
                                className={`text-sm font-black px-2 py-0.5 border border-l-0 rounded-r-md transition-all ${
                                  content.can_manage_submission
                                    ? "text-red-600 border-red-200 bg-red-50 hover:bg-red-600 hover:text-white"
                                    : "text-muted-foreground border-border bg-muted cursor-not-allowed"
                                }`}
                              >
                                <TrashIcon className="w-5 h-5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {content.type === "material" && (
                      <>
                        {content.is_completed ? (
                          <span className="text-sm font-black text-green-600 bg-green-50 border border-green-100 px-2 py-0.5 rounded-md">
                            Done
                          </span>
                        ) : (
                          <button
                            onClick={() => onMarkDone(content.id)}
                            className="text-sm font-black tracking-widest uppercase px-3 py-1.5 rounded-lg bg-primary-soft text-primary border border-primary/20 hover:bg-primary hover:text-white transition-all"
                          >
                            Mark as Done
                          </button>
                        )}
                      </>
                    )}
                    {(content.type === "pre_assessment" ||
                      content.type === "assignment") && (
                      <button
                        onClick={() => onSubmit(content)}
                        disabled={!content.can_manage_submission}
                        className={`text-xs font-black tracking-widest uppercase px-2 py-2 rounded-lg text-white  transition-all
                              ${content.type === "pre_assessment" ? "bg-amber-500 hover:bg-amber-600" : "bg-violet-600 hover:bg-violet-700"} ${!content.can_manage_submission ? "opacity-50 cursor-not-allowed" : ""}`}
                      >
                        {content.submission?.files?.length
                          ? "Resubmit"
                          : "Submit"}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </MyCourseInnerSection>
          ))}
        </div>
      )}
    </div>
  );
}
