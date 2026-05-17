import {
  avatarColors,
  statusCfg,
} from "@/Pages/Instructors/Utils/studentManagementConfig";

export default function StudentManagementModal({ student, index, onClose }) {
  if (!student) {
    return null;
  }

  const cfg = statusCfg[student.status] ?? statusCfg.PENDING;
  const color = avatarColors[index % avatarColors.length];
  const modules = student.modules ?? [];

  const barColor =
    student.progress === 100
      ? "bg-green-500"
      : student.progress === 0
        ? "bg-gray-300"
        : "bg-primary";

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
        className="bg-card rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gray-900 px-7 pt-7 pb-10 relative">
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

          <div className="flex items-center gap-4">
            <div
              className={`w-14 h-14 rounded-2xl ${color} flex items-center justify-center text-white text-lg font-black flex-shrink-0`}
            >
              {student.avatar}
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

        <div className="px-7 -mt-5 pb-7 space-y-5">
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

          <div className="flex gap-3 pt-1">
            <button className="flex-1 py-2.5 text-[10px] font-black tracking-widest uppercase border-2 border-border rounded-xl text-muted-foreground hover:border-border hover:text-foreground transition-all">
              Send Message
            </button>
            <button className="flex-1 py-2.5 text-[10px] font-black tracking-widest uppercase bg-primary text-white rounded-xl hover:bg-primary-hover transition-all shadow-md shadow-primary/20">
              View Full Report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
