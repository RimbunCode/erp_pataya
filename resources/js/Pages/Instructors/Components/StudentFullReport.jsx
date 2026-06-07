import { useMemo, useState } from "react";
import { router, useForm } from "@inertiajs/react";
import {
  avatarColors,
  statusCfg,
} from "@/Pages/Instructors/Utils/studentManagementConfig";
import { Avatar, AvatarFallback, AvatarImage } from "@/Components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  XIcon,
  ArrowLeftIcon,
  FileTextIcon,
  CheckCircleIcon,
  ClockIcon,
  BookOpenIcon,
  DownloadIcon,
  StarIcon,
  MessageSquareIcon,
} from "lucide-react";
import StudentManagementProgressRing from "./StudentManagementProgressRing";

function SubmissionCard({ item, enrollmentId }) {
  const hasSubmission = !!item.submission_id;
  const [open, setOpen] = useState(false);

  const { data, setData, patch, processing, reset } = useForm({
    grade: item.grade ?? "",
    feedback: item.feedback ?? "",
  });

  const handleSave = (e) => {
    e.preventDefault();
    patch(
      route("instructor.enrollments.submissions.grade", {
        enrollment: enrollmentId,
        submission: item.submission_id,
      }),
      {
        preserveScroll: true,
        onSuccess: () => setOpen(false),
      },
    );
  };

  const typeCfg = {
    assignment: {
      label: "Tugas",
      bg: "bg-violet-50",
      text: "text-violet-600",
      border: "border-violet-100",
      dot: "bg-violet-500",
    },
    pre_assessment: {
      label: "Pra Asesmen",
      bg: "bg-amber-50",
      text: "text-amber-600",
      border: "border-amber-100",
      dot: "bg-amber-500",
    },
  };
  const tc = typeCfg[item.content_type] ?? typeCfg.assignment;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Row header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div
          className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${tc.bg}`}
        >
          <span className={`w-2 h-2 rounded-full ${tc.dot}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-black text-foreground uppercase tracking-wide truncate">
            {item.content_title}
          </p>
          <p className={`text-[9px] font-black tracking-widest uppercase ${tc.text}`}>
            {tc.label}
          </p>
        </div>
        {hasSubmission ? (
          <span className="text-[9px] font-black tracking-widest uppercase px-2 py-1 rounded-lg bg-green-50 text-green-600 border border-green-100 flex-shrink-0">
            Submitted
          </span>
        ) : (
          <span className="text-[9px] font-black tracking-widest uppercase px-2 py-1 rounded-lg bg-muted text-muted-foreground border border-border flex-shrink-0">
            Belum Submit
          </span>
        )}
      </div>

      {hasSubmission && (
        <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
          {/* Meta info */}
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-[10px] text-muted-foreground font-medium">
              Dikumpulkan: <span className="text-foreground font-bold">{item.submitted_at}</span>
            </span>
            {item.graded_at && (
              <span className="text-[10px] text-muted-foreground font-medium">
                Dinilai: <span className="text-foreground font-bold">{item.graded_at}</span>
              </span>
            )}
            {item.grade !== null && item.grade !== undefined && (
              <span className="inline-flex items-center gap-1 text-[10px] font-black text-amber-600 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-md">
                <StarIcon className="w-3 h-3" />
                Nilai: {item.grade}/100
              </span>
            )}
          </div>

          {/* Notes dari student */}
          {item.notes && (
            <div className="bg-muted rounded-lg px-3 py-2">
              <p className="text-[9px] font-black tracking-widest text-muted-foreground uppercase mb-1">
                Catatan Student
              </p>
              <p className="text-xs text-foreground">{item.notes}</p>
            </div>
          )}

          {/* Feedback dari instructor */}
          {item.feedback && !open && (
            <div className="bg-primary-soft rounded-lg px-3 py-2 border border-primary/20">
              <p className="text-[9px] font-black tracking-widest text-primary uppercase mb-1">
                Feedback Anda
              </p>
              <p className="text-xs text-foreground">{item.feedback}</p>
            </div>
          )}

          {/* Files */}
          {item.files?.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {item.files.map((file) => (
                <a
                  key={file.id}
                  href={route("files.preview", file.id)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 px-2.5 py-1.5 rounded-lg hover:bg-primary hover:text-white transition-all"
                >
                  <FileTextIcon className="w-3 h-3" />
                  {file.fullname}
                  <DownloadIcon className="w-3 h-3 opacity-60" />
                </a>
              ))}
            </div>
          )}

          {/* Grade form toggle */}
          {!open ? (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="inline-flex items-center gap-1.5 text-[10px] font-black tracking-widest uppercase text-muted-foreground border border-border px-3 py-1.5 rounded-lg hover:border-primary hover:text-primary transition-all"
            >
              <MessageSquareIcon className="w-3 h-3" />
              {item.grade !== null ? "Edit Nilai & Feedback" : "Beri Nilai & Feedback"}
            </button>
          ) : (
            <form onSubmit={handleSave} className="space-y-3 pt-1">
              <div className="flex items-center gap-3">
                <div className="w-28">
                  <label className="text-[9px] font-black tracking-widest text-muted-foreground uppercase block mb-1">
                    Nilai (0–100)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={data.grade}
                    onChange={(e) => setData("grade", e.target.value)}
                    placeholder="—"
                    className="w-full px-3 py-2 text-sm font-black text-foreground bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>
              <div>
                <label className="text-[9px] font-black tracking-widest text-muted-foreground uppercase block mb-1">
                  Feedback
                </label>
                <textarea
                  value={data.feedback}
                  onChange={(e) => setData("feedback", e.target.value)}
                  placeholder="Tulis komentar atau masukan untuk student..."
                  rows={3}
                  className="w-full px-3 py-2 text-xs text-foreground bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { reset(); setOpen(false); }}
                  className="px-4 py-2 text-[10px] font-black tracking-widest uppercase border border-border rounded-lg text-muted-foreground hover:text-foreground transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={processing}
                  className="px-4 py-2 text-[10px] font-black tracking-widest uppercase bg-primary text-white rounded-lg hover:bg-primary-hover transition-all disabled:opacity-50"
                >
                  {processing ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

export default function StudentFullReport({ student, index, onClose, onBack }) {
  const [activeTab, setActiveTab] = useState("overview");

  const avatarSource = useMemo(() => {
    if (!student?.image) return null;
    const ts = student.updated_at ? new Date(student.updated_at).getTime() : null;
    const cb = Number.isFinite(ts) ? `?v=${ts}` : "";
    return route("files.preview", student.avatar) + cb;
  }, [student?.avatar, student?.updated_at]);

  if (!student) return null;

  const cfg = statusCfg[student.status] ?? statusCfg.PENDING;
  const color = avatarColors[index % avatarColors.length];
  const modules = student.modules ?? [];
  const submissions = student.submissions ?? [];
  const alias = student.name
    .split(" ")
    .slice(0, 2)
    .map((n) => n.charAt(0))
    .join("");

  const doneCount = modules.filter((m) => m.done).length;
  const totalCount = modules.length;
  const submittedCount = submissions.filter((s) => !!s.submission_id).length;
  const gradedCount = submissions.filter(
    (s) => s.grade !== null && s.grade !== undefined,
  ).length;

  const barColor =
    student.progress === 100
      ? "bg-green-500"
      : student.progress === 0
        ? "bg-gray-300"
        : "bg-primary";

  const statItems = [
    {
      label: "Enrolled",
      value: student.joinDate,
      icon: (
        <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      bg: "bg-primary-soft",
      border: "border-primary/20",
    },
    {
      label: "Last Active",
      value: student.lastActive,
      icon: <ClockIcon className="w-4 h-4 text-amber-500" />,
      bg: "bg-amber-50",
      border: "border-amber-100",
    },
    {
      label: "Modules Done",
      value: `${doneCount} / ${totalCount}`,
      icon: <CheckCircleIcon className="w-4 h-4 text-green-500" />,
      bg: "bg-green-50",
      border: "border-green-100",
    },
    {
      label: "Progress",
      value: `${student.progress}%`,
      icon: <StudentManagementProgressRing pct={student.progress} size={20} stroke={2.5} />,
      bg: "bg-muted",
      border: "border-border",
    },
  ];

  const tabs = [
    { key: "overview", label: "Overview" },
    {
      key: "submissions",
      label: "Submissions",
      badge: submittedCount > 0 ? submittedCount : null,
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ backdropFilter: "blur(6px)", backgroundColor: "rgba(15,23,42,0.45)" }}
      onClick={onClose}
    >
      <div
        className="bg-card rounded-3xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gray-900 px-7 pt-6 pb-10 relative flex-shrink-0 rounded-t-3xl">
          <div className="flex items-center justify-between mb-5">
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 text-white/60 hover:text-white transition-all text-[10px] font-black tracking-widest uppercase"
            >
              <ArrowLeftIcon className="w-3.5 h-3.5" />
              Back
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-xl bg-card/10 text-white/60 hover:bg-card/20 hover:text-white transition-all"
            >
              <XIcon className="size-5" />
            </button>
          </div>

          <div className="flex items-center gap-4">
            <div className={`w-16 h-16 rounded-2xl ${color} flex items-center justify-center flex-shrink-0`}>
              <Avatar className="w-16 h-16 rounded-xl overflow-hidden shrink-0 border border-muted dark:border-white">
                {avatarSource ? (
                  <AvatarImage src={avatarSource} alt={student.name} className={cn("transition-[filter]")} />
                ) : null}
                <AvatarFallback className={`rounded-xl ${color} text-white text-xl font-black`}>
                  {alias}
                </AvatarFallback>
              </Avatar>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-black text-white tracking-wide">{student.name}</h3>
              <p className="text-xs text-white/50 font-medium mt-0.5">{student.email}</p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[9px] font-black tracking-widest uppercase ${cfg.pill}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                  {student.status}
                </span>
                <span className="text-[9px] font-black tracking-widest uppercase text-white/40 bg-white/10 px-2.5 py-1 rounded-lg">
                  Full Report
                </span>
              </div>
            </div>
            <div className="flex-shrink-0 flex flex-col items-center gap-1">
              <StudentManagementProgressRing pct={student.progress} size={64} stroke={5} />
              <span className="text-xs font-black text-white/70">{student.progress}%</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-7 -mt-5 pt-5 flex-shrink-0">
          <div className="flex gap-1 bg-muted rounded-xl p-1">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] font-black tracking-widest uppercase rounded-lg transition-all
                  ${activeTab === tab.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                {tab.label}
                {tab.badge && (
                  <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-black
                    ${activeTab === tab.key ? "bg-primary text-white" : "bg-border text-muted-foreground"}`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="px-7 pt-4 pb-4 space-y-5 overflow-y-auto flex-1 min-h-0">
          {activeTab === "overview" && (
            <>
              {/* Enrolled Course */}
              <div className="bg-primary-soft rounded-2xl px-4 py-3 border border-primary/20 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary-soft flex items-center justify-center flex-shrink-0">
                  <BookOpenIcon className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] font-black tracking-widest text-primary uppercase">Enrolled Course</p>
                  <p className="text-xs font-black text-primary uppercase tracking-wide truncate mt-0.5">{student.course}</p>
                </div>
              </div>

              {/* Stat grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {statItems.map((item) => (
                  <div key={item.label} className={`${item.bg} rounded-2xl px-4 py-3 border ${item.border} flex flex-col gap-2`}>
                    <div className="flex items-center justify-between">
                      <p className="text-[9px] font-black tracking-widest text-muted-foreground uppercase">{item.label}</p>
                      {item.icon}
                    </div>
                    <p className="text-sm font-black text-foreground leading-tight">{item.value}</p>
                  </div>
                ))}
              </div>

              {/* Overall progress bar */}
              <div className="bg-card rounded-2xl border border-border px-5 py-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black tracking-widest text-muted-foreground uppercase">Overall Progress</p>
                  <p className="text-[10px] font-black text-foreground">{student.progress}%</p>
                </div>
                <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${barColor}`}
                    style={{ width: `${student.progress}%` }}
                  />
                </div>
                <p className="text-[9px] text-muted-foreground font-medium">
                  {doneCount} dari {totalCount} modul diselesaikan
                </p>
              </div>

              {/* Module completion */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-black tracking-widest text-muted-foreground uppercase">Module Completion</p>
                  <span className="text-[9px] font-black tracking-widest uppercase px-2 py-0.5 rounded-lg bg-muted text-muted-foreground border border-border">
                    {doneCount}/{totalCount}
                  </span>
                </div>
                {modules.length > 0 ? (
                  <div className="space-y-2">
                    {modules.map((mod, i) => (
                      <div
                        key={`${mod.title}-${i}`}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all
                          ${mod.done
                            ? "bg-green-50 border-green-100 dark:bg-green-950/20 dark:border-green-900/30"
                            : mod.completed_contents > 0
                              ? "bg-primary-soft border-primary/20"
                              : "bg-muted border-border"
                          }`}
                      >
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0
                            ${mod.done ? "bg-green-500" : mod.completed_contents > 0 ? "bg-primary" : "bg-gray-200 dark:bg-gray-700"}`}
                        >
                          {mod.done ? (
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          ) : mod.completed_contents > 0 ? (
                            <span className="w-2 h-2 rounded-full bg-white/70" />
                          ) : (
                            <span className="w-2 h-2 rounded-full bg-gray-400 dark:bg-gray-500" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <span className={`text-[10px] font-bold uppercase tracking-wide
                            ${mod.done ? "text-green-700 dark:text-green-400" : "text-muted-foreground"}`}>
                            {mod.title}
                          </span>
                          {!mod.done && mod.total_contents > 0 && (
                            <div className="flex items-center gap-1.5 mt-1">
                              <div className="flex-1 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-primary rounded-full transition-all"
                                  style={{ width: `${Math.round((mod.completed_contents / mod.total_contents) * 100)}%` }}
                                />
                              </div>
                              <span className="text-[9px] text-muted-foreground font-bold">
                                {mod.completed_contents}/{mod.total_contents}
                              </span>
                            </div>
                          )}
                        </div>

                        {mod.done ? (
                          <span className="text-[9px] font-black tracking-widest text-green-600 uppercase bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-md flex-shrink-0">
                            Completed
                          </span>
                        ) : mod.completed_contents > 0 ? (
                          <span className="text-[9px] font-black tracking-widest text-primary uppercase bg-primary-soft border border-primary/20 px-2 py-0.5 rounded-md flex-shrink-0">
                            In Progress
                          </span>
                        ) : (
                          <span className="text-[9px] font-black tracking-widest text-muted-foreground uppercase flex-shrink-0">
                            Not Started
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="px-4 py-4 rounded-xl border border-border bg-muted flex items-center gap-3">
                    <FileTextIcon className="w-4 h-4 text-muted-foreground" />
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                      No modules available
                    </p>
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === "submissions" && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Total Tugas", value: submissions.length, bg: "bg-muted", border: "border-border" },
                  { label: "Dikumpulkan", value: submittedCount, bg: "bg-green-50", border: "border-green-100" },
                  { label: "Sudah Dinilai", value: gradedCount, bg: "bg-amber-50", border: "border-amber-100" },
                ].map((s) => (
                  <div key={s.label} className={`${s.bg} rounded-xl px-4 py-3 border ${s.border}`}>
                    <p className="text-[9px] font-black tracking-widest text-muted-foreground uppercase">{s.label}</p>
                    <p className="text-xl font-black text-foreground mt-1">{s.value}</p>
                  </div>
                ))}
              </div>

              {/* Submission list */}
              {submissions.length > 0 ? (
                <div className="space-y-3">
                  {submissions.map((item) => (
                    <SubmissionCard
                      key={item.content_id}
                      item={item}
                      enrollmentId={student.id}
                    />
                  ))}
                </div>
              ) : (
                <div className="py-12 flex flex-col items-center gap-3 bg-muted rounded-2xl border border-border">
                  <FileTextIcon className="w-8 h-8 text-muted-foreground" />
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    Tidak ada tugas di course ini
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-7 py-4 border-t border-border flex-shrink-0">
          <button
            onClick={onBack}
            className="flex-1 py-2.5 text-[10px] font-black tracking-widest uppercase border-2 border-border rounded-xl text-muted-foreground hover:border-foreground/30 hover:text-foreground transition-all"
          >
            Back to Detail
          </button>
          <button className="flex-1 py-2.5 text-[10px] font-black tracking-widest uppercase border-2 border-border rounded-xl text-muted-foreground hover:border-foreground/30 hover:text-foreground transition-all">
            Send Message
          </button>
        </div>
      </div>
    </div>
  );
}
