import { useMemo, useState } from "react";
import {
  avatarColors,
  statusCfg,
} from "@/Pages/Instructors/Utils/studentManagementConfig";
import { Avatar, AvatarFallback, AvatarImage } from "@/Components/ui/avatar";
import { cn } from "@/lib/utils";
import { XIcon } from "lucide-react";
import StudentFullReport from "./StudentFullReport";

export default function StudentManagementModal({ student, index, onClose }) {
  const [showReport, setShowReport] = useState(false);

  const avatarSource = useMemo(() => {
    if (!student?.image) return null;
    const updatedAtTimestamp = student.updated_at
      ? new Date(student.updated_at).getTime()
      : null;
    const cacheBuster = Number.isFinite(updatedAtTimestamp)
      ? `?v=${updatedAtTimestamp}`
      : "";
    return route("files.preview", student.avatar) + cacheBuster;
  }, [student?.avatar, student?.updated_at]);

  if (!student) return null;

  if (showReport) {
    return (
      <StudentFullReport
        student={student}
        index={index}
        onClose={() => {
          setShowReport(false);
          onClose();
        }}
        onBack={() => setShowReport(false)}
      />
    );
  }

  const cfg = statusCfg[student.status] ?? statusCfg.PENDING;
  const color = avatarColors[index % avatarColors.length];
  const modules = student.modules ?? [];
  const alias = student.name
    .split(" ")
    .slice(0, 2)
    .map((n) => n.charAt(0))
    .join("");

  const barColor =
    student.progress === 100
      ? "bg-green-500"
      : student.progress === 0
        ? "bg-gray-300"
        : "bg-primary";

  const handleClose = () => {
    setShowReport(false);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{
        backdropFilter: "blur(6px)",
        backgroundColor: "rgba(15,23,42,0.45)",
      }}
      onClick={handleClose}
    >
      <div
        className="bg-card rounded-3xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gray-900 px-7 pt-7 pb-10 relative flex-shrink-0 rounded-t-3xl">
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-xl bg-card/10 text-white/60 hover:bg-card/20 hover:text-white transition-all"
          >
            <XIcon className="size-5" />
          </button>

          <div className="flex items-center gap-4">
            <div
              className={`w-14 h-14 rounded-2xl ${color} flex items-center justify-center text-white text-lg font-black flex-shrink-0`}
            >
              <Avatar className="w-14 h-14 rounded-xl overflow-hidden shrink-0 border border-muted dark:border-white">
                {avatarSource ? (
                  <AvatarImage
                    src={avatarSource}
                    alt={student.name}
                    className={cn("transition-[filter] group-hover:blur-sm")}
                  />
                ) : null}
                <AvatarFallback
                  className={`rounded-xl ${color} text-white text-lg font-black`}
                >
                  {alias}
                </AvatarFallback>
              </Avatar>
            </div>
            <div>
              <h3 className="text-base font-black text-white tracking-wide">
                {student.name}
              </h3>
              <p className="text-xs text-muted-foreground font-medium mt-0.5">
                {student.email}
              </p>
              <span
                className={`inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-lg border text-[9px] font-black tracking-widest uppercase ${cfg.pill}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                {student.status}
              </span>
            </div>
          </div>
        </div>

        <div className="px-7 -mt-5 pt-7 pb-4 space-y-5 overflow-y-auto flex-1 min-h-0">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Joined", value: student.joinDate },
              { label: "Last Active", value: student.lastActive },
              { label: "Progress", value: `${student.progress}%` },
            ].map((item) => (
              <div
                key={item.label}
                className="bg-muted rounded-2xl px-4 py-3 border border-border"
              >
                <p className="text-[9px] font-black tracking-widest text-muted-foreground uppercase">
                  {item.label}
                </p>
                <p className="text-sm font-black text-foreground mt-1">
                  {item.value}
                </p>
              </div>
            ))}
          </div>

          <div className="bg-primary-soft rounded-2xl px-4 py-3 border border-primary/20 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary-soft flex items-center justify-center flex-shrink-0">
              <svg
                className="w-4 h-4 text-primary"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-[9px] font-black tracking-widest text-primary uppercase">
                Enrolled Course
              </p>
              <p className="text-xs font-black text-primary uppercase tracking-wide truncate mt-0.5">
                {student.course}
              </p>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-black tracking-widest text-muted-foreground uppercase">
                Overall Progress
              </p>
              <p className="text-[10px] font-black text-foreground">
                {student.progress}%
              </p>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${barColor}`}
                style={{ width: `${student.progress}%` }}
              />
            </div>
          </div>

          <div>
            <p className="text-[10px] font-black tracking-widest text-muted-foreground uppercase mb-3">
              Module Completion
            </p>
            {modules.length > 0 ? (
              <div className="space-y-2">
                {modules.map((mod, i) => (
                  <div
                    key={`${mod.title}-${i}`}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-all
                    ${mod.done ? "bg-green-50 border-green-100" : "bg-muted border-border"}`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0
                    ${mod.done ? "bg-green-500" : "bg-gray-200"}`}
                    >
                      {mod.done && (
                        <svg
                          className="w-3 h-3 text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={3}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                    </div>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wide
                    ${mod.done ? "text-green-700" : "text-muted-foreground"}`}
                    >
                      {mod.title}
                    </span>
                    {!mod.done && (
                      <span className="ml-auto text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
                        Locked
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-4 py-3 rounded-xl border border-border bg-muted">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                  No modules available
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Certificate Section */}
        {student.certificate && (
          <div className="px-7 pb-4 flex-shrink-0">
            <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                  </svg>
                </div>
                <div>
                  <p className="text-[9px] font-black tracking-widest text-amber-600 uppercase">Certificate Issued</p>
                  <p className="text-[10px] font-bold text-amber-800 mt-0.5">{student.certificate.credentialId} · {student.certificate.issuedAt}</p>
                </div>
              </div>
              <a
                href={student.certificate.viewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[9px] font-black tracking-widest uppercase text-amber-600 hover:text-amber-800 transition-colors"
              >
                View
              </a>
            </div>
          </div>
        )}

        <div className="flex gap-3 px-7 py-4 border-t border-border flex-shrink-0">
          <button className="flex-1 py-2.5 text-[10px] font-black tracking-widest uppercase border-2 border-border rounded-xl text-muted-foreground hover:border-foreground/30 hover:text-foreground transition-all">
            Send Message
          </button>
          <button
            onClick={() => setShowReport(true)}
            className="flex-1 py-2.5 text-[10px] font-black tracking-widest uppercase bg-primary text-white rounded-xl hover:bg-primary-hover transition-all shadow-md shadow-primary/20"
          >
            View Full Report
          </button>
        </div>
      </div>
    </div>
  );
}
