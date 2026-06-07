import MainLayout from "@/Layouts/MainLayout";
import { Link } from "@inertiajs/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/Components/ui/avatar";
import PeriodFilterChart from "@/Components/Charts/PeriodFilterChart";

const ACTIVITY_CONFIG = {
  enrollment: { label: "Kursus Diikuti", color: "var(--primary)" },
  progress: { label: "Konten Selesai", color: "#10b981" },
};

const deadlineTypeConfig = {
  assignment: {
    label: "Assignment",
    className:
      "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  },
  pre_assessment: {
    label: "Pre-assessment",
    className:
      "bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300",
  },
};

const fallbackTypeClass =
  "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300";
const DEFAULT_THUMBNAIL = "/storage/images/logo-default.png";

const formatDateTime = (isoString) => {
  if (!isoString) {
    return "-";
  }

  const date = new Date(isoString);

  return `${date.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })} ${date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
};

function StatCard({ label, value, helper, icon, accentClass }) {
  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm p-5">
      <div className="flex items-start justify-between gap-3">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center ${accentClass}`}
        >
          {icon}
        </div>
        <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase text-right">
          {label}
        </p>
      </div>
      <p className="text-2xl font-black text-foreground mt-4">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{helper}</p>
    </div>
  );
}

export default function StudentDashboard({
  overview = {},
  hero = {},
  continueLearning = [],
  upcomingDeadlines = [],
  enrollmentTimeSeries = [],
  progressTimeSeries = [],
}) {
  const ongoingCourses = Number(overview.ongoingCourses ?? 0);
  const completedCourses = Number(overview.completedCourses ?? 0);
  const pendingVerificationCourses = Number(
    overview.pendingVerificationCourses ?? 0,
  );
  const pendingSubmissions = Number(overview.pendingSubmissions ?? 0);

  const averageProgress = Number(hero.averageProgress ?? 0);
  const resumeCourse = hero.resumeCourse ?? null;

  const activityRawData = (() => {
    const map = {};
    enrollmentTimeSeries.forEach(({ date }) => {
      if (!map[date]) map[date] = { date, enrollment: 0, progress: 0 };
      map[date].enrollment += 1;
    });
    progressTimeSeries.forEach(({ date }) => {
      if (!map[date]) map[date] = { date, enrollment: 0, progress: 0 };
      map[date].progress += 1;
    });
    return Object.values(map);
  })();

  return (
    <MainLayout title="Learning Dashboard" breadcrumb="Dashboard">
      <div className="p-8 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-foreground uppercase">
              Learning Dashboard
            </h2>
            <p className="text-xs text-muted-foreground font-medium mt-1">
              Track your progress and focus on what to finish next.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={route("student.courses.index")}
              className="px-4 py-2.5 text-xs font-extrabold tracking-widest uppercase bg-primary hover:bg-primary-hover text-white rounded-xl transition-colors"
            >
              Continue Learning
            </Link>
            <Link
              href={route("student.courses.index")}
              className="px-4 py-2.5 text-xs font-extrabold tracking-widest uppercase border border-border text-foreground rounded-xl hover:bg-muted transition-colors"
            >
              View All Courses
            </Link>
            <Link
              href={route("student.course-catalogue")}
              className="px-4 py-2.5 text-xs font-extrabold tracking-widest uppercase border border-border text-foreground rounded-xl hover:bg-muted transition-colors"
            >
              Browse Catalogue
            </Link>
          </div>
        </div>

        {ongoingCourses > 0 && resumeCourse && (
          <div
            className="rounded-3xl p-6 sm:p-8 overflow-hidden relative"
            style={{
              background: "linear-gradient(135deg, #2563eb 55%, #1e3a8a 100%)",
            }}
          >
            <div className="absolute inset-0 opacity-30 pointer-events-none bg-[radial-gradient(circle_at_top_right,_#ffffff_0%,_transparent_45%)]" />

            <div className="relative z-10 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div className="max-w-xl">
                <h3 className="text-3xl font-black text-white uppercase tracking-tight leading-tight">
                  Ready to Continue?
                </h3>
                <p className="text-sm text-blue-100 mt-3 leading-relaxed">
                  Resume{" "}
                  <span className="font-bold text-white">
                    {resumeCourse.title}
                  </span>{" "}
                  at {resumeCourse.progress}% completion and keep your streak
                  active.
                </p>
                <Link
                  href={route("student.courses.index")}
                  className="inline-flex mt-5 px-5 py-3 text-xs font-extrabold tracking-widest uppercase rounded-xl bg-white text-primary hover:bg-primary-soft transition-colors"
                >
                  Resume Learning
                </Link>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div className="bg-white/15 backdrop-blur-sm rounded-2xl px-5 py-4 text-center min-w-[120px]">
                  <p className="text-3xl font-black text-white">
                    {averageProgress}%
                  </p>
                  <p className="text-[10px] font-bold tracking-widest text-blue-100 uppercase mt-1">
                    Avg Progress
                  </p>
                </div>
                <div className="bg-white/15 backdrop-blur-sm rounded-2xl px-5 py-4 text-center min-w-[120px]">
                  <p className="text-3xl font-black text-white">
                    {ongoingCourses}
                  </p>
                  <p className="text-[10px] font-bold tracking-widest text-blue-100 uppercase mt-1">
                    Ongoing
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard
            label="Ongoing Courses"
            value={ongoingCourses}
            helper="Courses still in progress"
            accentClass="bg-[var(--primary-soft)] text-[var(--primary)]"
            icon={
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 8v4l2.5 2.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            }
          />
          <StatCard
            label="Completed"
            value={completedCourses}
            helper="Courses finished"
            accentClass="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
            icon={
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            }
          />
          <StatCard
            label="Verification"
            value={pendingVerificationCourses}
            helper="Pending or rejected enrollments"
            accentClass="bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
            icon={
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 8v4m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z"
                />
              </svg>
            }
          />
          <StatCard
            label="Pending Submissions"
            value={pendingSubmissions}
            helper="Required tasks not submitted"
            accentClass="bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
            icon={
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M7 8h10M7 12h7m-7 4h10M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z"
                />
              </svg>
            }
          />
        </div>

        <PeriodFilterChart
          title="Aktivitas Belajar"
          rawData={activityRawData}
          dataKeys={[{ key: "enrollment" }, { key: "progress" }]}
          chartConfig={ACTIVITY_CONFIG}
          type="bar"
          formatValue={(v) => v.toLocaleString("id-ID")}
        />

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
          <div className="xl:col-span-3 bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-4 flex-wrap">
              <h3 className="text-sm font-black tracking-widest text-foreground uppercase">
                Continue Learning
              </h3>
              <Link
                href={route("student.courses.index")}
                className="text-[10px] font-black tracking-widest uppercase text-primary hover:text-primary-hover transition-colors"
              >
                View All Courses
              </Link>
            </div>

            {continueLearning.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">
                  No ongoing course
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  You can browse the catalogue and enroll in a new class.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {continueLearning.map((course) => (
                  <Link
                    key={course.id}
                    href={route("student.courses.index")}
                    className="px-6 py-4 flex items-start gap-4 hover:bg-muted/40 transition-colors"
                  >
                    <Avatar className="w-16 h-14 rounded-xl overflow-hidden shrink-0 bg-muted">
                      <AvatarImage
                        src={course.thumbnail || DEFAULT_THUMBNAIL}
                        alt={course.title}
                        className="object-cover"
                      />
                      <AvatarFallback className="rounded-xl">
                        <img
                          src={DEFAULT_THUMBNAIL}
                          alt={course.title}
                          className="w-full h-full object-contain"
                        />
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-foreground truncate">
                        {course.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {course.instructor || "-"}
                      </p>

                      <div className="mt-3 flex items-center gap-3">
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full"
                            style={{
                              width: `${Number(course.progress ?? 0)}%`,
                            }}
                          />
                        </div>
                        <span className="text-[10px] font-black tracking-widest text-primary uppercase shrink-0">
                          {Number(course.progress ?? 0)}%
                        </span>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[11px] text-muted-foreground truncate">
                          Next:{" "}
                          {course.nextContentTitle || "All contents completed"}
                        </p>
                        <p className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                          Last activity {formatDateTime(course.lastActivityAt)}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="xl:col-span-2 bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-4 flex-wrap">
              <h3 className="text-sm font-black tracking-widest text-foreground uppercase">
                Upcoming Deadlines
              </h3>
              <Link
                href={route("student.courses.index")}
                className="text-[10px] font-black tracking-widest uppercase text-primary hover:text-primary-hover transition-colors"
              >
                Manage Tasks
              </Link>
            </div>

            {upcomingDeadlines.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">
                  No deadline yet
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Pending tasks with deadlines will appear here.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {upcomingDeadlines.map((deadline) => {
                  const config = deadlineTypeConfig[deadline.type] ?? {
                    label: deadline.type,
                    className: fallbackTypeClass,
                  };

                  return (
                    <Link
                      key={`${deadline.courseId}-${deadline.contentId}`}
                      href={route("student.courses.index")}
                      className="px-6 py-4 block hover:bg-muted/40 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-black text-foreground truncate">
                            {deadline.contentTitle}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1 truncate">
                            {deadline.courseTitle}
                          </p>
                        </div>
                        <span
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${config.className}`}
                        >
                          {config.label}
                        </span>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-3">
                        <p className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                          {formatDateTime(deadline.deadlineAt)}
                        </p>
                        {deadline.isOverdue ? (
                          <span className="text-[10px] font-black tracking-widest uppercase text-red-600">
                            Overdue
                          </span>
                        ) : (
                          <span className="text-[10px] font-black tracking-widest uppercase text-amber-600">
                            Upcoming
                          </span>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
