import MainLayout from "@/Layouts/MainLayout";
import { Link } from "@inertiajs/react";
import { formatRp } from "@/lib/utils";
import { statusConfig } from "./Utils/statusConfig";
import PeriodFilterChart from "@/Components/Charts/PeriodFilterChart";

const EARNING_CONFIG = {
  amount: { label: "Pendapatan", color: "var(--primary)" },
};

const ENROLLMENT_CONFIG = {
  count: { label: "Peserta", color: "#10b981" },
};

const fallbackBadgeClass =
  "border border-gray-900 text-gray-900 bg-gray-100 dark:border-gray-500 dark:bg-gray-900 dark:text-gray-100";

const fmtDateTime = (isoString) => {
  if (!isoString) {
    return "-";
  }

  const date = new Date(isoString);
  return `${date.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })} · ${date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
};

function StatCard({ label, value, helper, icon, accentClass }) {
  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm p-5">
      <div className="flex items-start justify-between gap-4">
        <div
          className={`w-11 h-11 rounded-xl flex items-center justify-center ${accentClass}`}
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

function CourseStatusBadge({ status }) {
  const cfg = statusConfig[status];

  return (
    <span
      className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${cfg?.bg ?? fallbackBadgeClass}`}
    >
      {cfg?.label ?? status}
    </span>
  );
}

export default function InstructorDashboard({
  overview = {},
  attention = {},
  topCourses = [],
  recentEnrollments = [],
  earningTimeSeries = [],
  enrollmentTimeSeries = [],
}) {
  const totalCourses = Number(overview.totalCourses ?? 0);
  const publishedCourses = Number(overview.publishedCourses ?? 0);
  const totalStudents = Number(overview.totalStudents ?? 0);
  const availableBalance = Number(overview.availableBalance ?? 0);

  const pendingApprovalCourses = Number(attention.pendingApprovalCourses ?? 0);
  const rejectedCourses = Number(attention.rejectedCourses ?? 0);
  const pendingPayoutAmount = Number(attention.pendingPayoutAmount ?? 0);

  return (
    <MainLayout title="Instructor Hub" breadcrumb="Dashboard">
      <div className="p-8 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-foreground uppercase">
              Instructor Hub
            </h2>
            <p className="text-xs text-muted-foreground font-medium mt-1">
              Monitor teaching performance and take quick actions.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={route("instructor.classes.index")}
              className="px-4 py-2.5 text-xs font-extrabold tracking-widest uppercase bg-primary hover:bg-primary-hover text-white rounded-xl transition-colors"
            >
              Create Course
            </Link>
            <Link
              href={route("instructor.students")}
              className="px-4 py-2.5 text-xs font-extrabold tracking-widest uppercase border border-border text-foreground rounded-xl hover:bg-muted transition-colors"
            >
              Manage Students
            </Link>
            <Link
              href={route("instructor.financial")}
              className="px-4 py-2.5 text-xs font-extrabold tracking-widest uppercase border border-border text-foreground rounded-xl hover:bg-muted transition-colors"
            >
              Financials
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard
            label="Total Courses"
            value={totalCourses}
            helper="Courses created by you"
            accentClass="bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300"
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
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
            }
          />
          <StatCard
            label="Published"
            value={publishedCourses}
            helper="Live in catalogue"
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
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            }
          />
          <StatCard
            label="Total Students"
            value={totalStudents}
            helper="Unique active learners"
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
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            }
          />
          <StatCard
            label="Available Balance"
            value={formatRp(availableBalance)}
            helper="Eligible for payout"
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
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            }
          />
        </div>

        <div className="bg-card rounded-2xl border border-border shadow-sm p-6">
          <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
            <h3 className="text-sm font-black tracking-widest text-foreground uppercase">
              Needs Attention
            </h3>
            <Link
              href={route("instructor.classes.index")}
              className="text-[10px] font-black tracking-widest uppercase text-primary hover:text-primary-hover transition-colors"
            >
              Review Courses
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-xl border border-amber-500/30 bg-amber-100/60 dark:bg-amber-500/10 px-4 py-3">
              <p className="text-[10px] font-bold tracking-widest text-amber-700 dark:text-amber-300 uppercase">
                Pending Approval
              </p>
              <p className="text-xl font-black text-foreground mt-1">
                {pendingApprovalCourses}
              </p>
            </div>
            <div className="rounded-xl border border-red-500/30 bg-red-100/60 dark:bg-red-500/10 px-4 py-3">
              <p className="text-[10px] font-bold tracking-widest text-red-700 dark:text-red-300 uppercase">
                Rejected Courses
              </p>
              <p className="text-xl font-black text-foreground mt-1">
                {rejectedCourses}
              </p>
            </div>
            <div className="rounded-xl border border-blue-500/30 bg-blue-100/60 dark:bg-blue-500/10 px-4 py-3">
              <p className="text-[10px] font-bold tracking-widest text-blue-700 dark:text-blue-300 uppercase">
                Pending Payout
              </p>
              <p className="text-xl font-black text-foreground mt-1">
                {formatRp(pendingPayoutAmount)}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <PeriodFilterChart
            title="Tren Pendapatan"
            rawData={earningTimeSeries}
            dataKeys={[{ key: "amount" }]}
            chartConfig={EARNING_CONFIG}
            type="area"
            formatValue={(v) => formatRp(v)}
          />
          <PeriodFilterChart
            title="Tren Peserta"
            rawData={enrollmentTimeSeries}
            dataKeys={[{ key: "count" }]}
            chartConfig={ENROLLMENT_CONFIG}
            type="bar"
            formatValue={(v) => v.toLocaleString("id-ID")}
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
          <div className="xl:col-span-3 bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-4 flex-wrap">
              <h3 className="text-sm font-black tracking-widest text-foreground uppercase">
                Top Courses
              </h3>
              <Link
                href={route("instructor.classes.index")}
                className="text-[10px] font-black tracking-widest uppercase text-primary hover:text-primary-hover transition-colors"
              >
                Manage Classes
              </Link>
            </div>

            {topCourses.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">
                  No courses yet
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Start by creating your first course.
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-[1.8fr_auto_auto_auto] gap-4 px-6 py-3 bg-muted/60 border-b border-border">
                  {["Course", "Status", "Students", "Earning"].map((column) => (
                    <span
                      key={column}
                      className="text-[10px] font-black tracking-widest text-muted-foreground uppercase"
                    >
                      {column}
                    </span>
                  ))}
                </div>

                {topCourses.map((course, index) => (
                  <div
                    key={course.id}
                    className={`px-6 py-4 grid grid-cols-[1.8fr_auto_auto_auto] gap-4 items-center ${
                      index !== topCourses.length - 1
                        ? "border-b border-border"
                        : ""
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-black text-foreground truncate">
                        {course.title}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Updated {fmtDateTime(course.updatedAt)}
                      </p>
                    </div>
                    <CourseStatusBadge status={course.status} />
                    <p className="text-sm font-black text-foreground text-right">
                      {Number(course.studentsCount ?? 0)}
                    </p>
                    <p className="text-sm font-black text-foreground text-right">
                      {formatRp(Number(course.lifetimeEarning ?? 0))}
                    </p>
                  </div>
                ))}
              </>
            )}
          </div>

          <div className="xl:col-span-2 bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-4 flex-wrap">
              <h3 className="text-sm font-black tracking-widest text-foreground uppercase">
                Recent Enrollments
              </h3>
              <Link
                href={route("instructor.students")}
                className="text-[10px] font-black tracking-widest uppercase text-primary hover:text-primary-hover transition-colors"
              >
                Student Management
              </Link>
            </div>

            {recentEnrollments.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">
                  No enrollments yet
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Enrollments will appear here once students join.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {recentEnrollments.map((enrollment) => (
                  <div
                    key={enrollment.id}
                    className="px-6 py-4 flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-black text-foreground truncate">
                        {enrollment.studentName}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {enrollment.courseTitle}
                      </p>
                    </div>
                    <p className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase text-right shrink-0">
                      {fmtDateTime(enrollment.enrolledAt)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
