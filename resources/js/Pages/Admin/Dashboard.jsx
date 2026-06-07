import MainLayout from "@/Layouts/MainLayout";
import { usePage } from "@inertiajs/react";
import PeriodFilterChart from "@/Components/Charts/PeriodFilterChart";
import { formatRp } from "@/lib/utils";

const REVENUE_CONFIG = {
    amount: { label: "Pendapatan", color: "var(--primary)" },
};

const ENROLLMENT_CONFIG = {
    count: { label: "Peserta", color: "#10b981" },
};

const PAYMENT_STATUS = {
    approved: {
        label: "Approved",
        pill: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    },
    pending: {
        label: "Pending",
        pill: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    },
    rejected: {
        label: "Rejected",
        pill: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
    },
};

const fmtDate = (iso) => {
    if (!iso) return "-";
    return new Date(iso).toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
};

function StatCard({ label, value, helper, icon, accentClass, highlight = false }) {
    return (
        <div
            className={`rounded-2xl p-5 flex flex-col gap-3 shadow-sm border flex-1 min-w-0 ${
                highlight
                    ? "bg-primary border-primary/20 text-primary-foreground"
                    : "bg-card border-border"
            }`}
        >
            <div className="flex items-start justify-between gap-2">
                <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${accentClass}`}
                >
                    {icon}
                </div>
                <span
                    className={`text-[10px] font-bold tracking-widest uppercase text-right ${
                        highlight ? "text-primary-foreground/70" : "text-muted-foreground"
                    }`}
                >
                    {label}
                </span>
            </div>
            <p
                className={`text-2xl font-black tracking-tight ${
                    highlight ? "text-primary-foreground" : "text-foreground"
                }`}
            >
                {value}
            </p>
            {helper && (
                <p
                    className={`text-xs ${
                        highlight ? "text-primary-foreground/70" : "text-muted-foreground"
                    }`}
                >
                    {helper}
                </p>
            )}
        </div>
    );
}

function AlertCard({ label, count, description, accentClass }) {
    if (count === null) return null;
    return (
        <div className={`rounded-2xl border px-5 py-4 flex items-center justify-between gap-4 ${accentClass}`}>
            <div>
                <p className="text-[10px] font-bold tracking-widest uppercase opacity-70">
                    {label}
                </p>
                <p className="text-xl font-black text-foreground mt-0.5">{count}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
            </div>
            {count > 0 && (
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0 animate-pulse" />
            )}
        </div>
    );
}

export default function AdminDashboard({
    stats = {},
    recentPayments = [],
    recentApprovals = [],
    revenueTimeSeries = [],
    enrollmentTimeSeries = [],
    chartVisibility = {},
}) {
    const showRevenue    = chartVisibility.revenue    ?? false;
    const showEnrollment = chartVisibility.enrollment ?? false;
    const hasAnyChart    = showRevenue || showEnrollment;

    const hasFinanceData  = stats.totalRevenue    !== null;
    const hasCourseAlerts = stats.pendingApprovals !== null;
    const hasAnyAlert     = hasFinanceData || hasCourseAlerts;

    const activeAlertCount = [
        stats.pendingPayments  !== null,
        stats.pendingPayouts   !== null,
        stats.pendingApprovals !== null,
    ].filter(Boolean).length;

    const alertGridCols = {
        1: "grid-cols-1",
        2: "grid-cols-1 sm:grid-cols-2",
        3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    }[activeAlertCount] ?? "grid-cols-1";

    return (
        <MainLayout>
            <div data-role="admin" className="p-8 space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <h2 className="text-2xl font-black tracking-tight text-foreground uppercase">
                            Admin Command Center
                        </h2>
                        <p className="text-xs text-muted-foreground font-medium mt-0.5">
                            Monitor system activity, approvals, and platform health.
                        </p>
                    </div>
                </div>

                {/* Stat Cards — umum untuk semua admin */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard
                        label="Total Students"
                        value={stats.totalStudents?.toLocaleString("id-ID") ?? "0"}
                        helper="Pengguna terdaftar sebagai student"
                        accentClass="bg-[var(--primary-soft)] text-[var(--primary)]"
                        icon={
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        }
                    />
                    <StatCard
                        label="Total Instructors"
                        value={stats.totalInstructors?.toLocaleString("id-ID") ?? "0"}
                        helper="Instruktur aktif di platform"
                        accentClass="bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300"
                        icon={
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
                            </svg>
                        }
                    />
                    <StatCard
                        label="Total Courses"
                        value={stats.totalCourses?.toLocaleString("id-ID") ?? "0"}
                        helper={`${stats.publishedCourses ?? 0} dipublikasikan`}
                        accentClass="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                        icon={
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                            </svg>
                        }
                    />
                    {hasFinanceData ? (
                        <StatCard
                            label="Total Revenue"
                            value={formatRp(stats.totalRevenue ?? 0)}
                            helper="Pembayaran terverifikasi"
                            accentClass="bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
                            icon={
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            }
                        />
                    ) : (
                        <StatCard
                            label="Published Courses"
                            value={stats.publishedCourses?.toLocaleString("id-ID") ?? "0"}
                            helper="Kursus aktif di katalog"
                            accentClass="bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
                            icon={
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            }
                        />
                    )}
                </div>

                {/* Alert Cards — items yang butuh tindakan */}
                {hasAnyAlert && (
                    <div className={`grid gap-3 ${alertGridCols}`}>
                        <AlertCard
                            label="Pending Payments"
                            count={stats.pendingPayments}
                            description="Pembayaran menunggu verifikasi"
                            accentClass="bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/30"
                        />
                        <AlertCard
                            label="Pending Payouts"
                            count={stats.pendingPayouts}
                            description="Request payout instructor menunggu"
                            accentClass="bg-blue-50 border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/30"
                        />
                        <AlertCard
                            label="Course Approvals"
                            count={stats.pendingApprovals}
                            description="Kursus menunggu review publikasi"
                            accentClass="bg-violet-50 border-violet-200 dark:bg-violet-500/10 dark:border-violet-500/30"
                        />
                    </div>
                )}

                {/* Charts + Recent Activity */}
                <div className="flex gap-4 flex-wrap lg:flex-nowrap">
                    {hasAnyChart && (
                        <div className="flex-1 min-w-0 flex flex-col gap-4">
                            {showRevenue && (
                                <PeriodFilterChart
                                    title="Pendapatan"
                                    rawData={revenueTimeSeries}
                                    dataKeys={[{ key: "amount" }]}
                                    chartConfig={REVENUE_CONFIG}
                                    type="area"
                                    formatValue={(v) => formatRp(v)}
                                    height={180}
                                />
                            )}
                            {showEnrollment && (
                                <PeriodFilterChart
                                    title="Jumlah Peserta"
                                    rawData={enrollmentTimeSeries}
                                    dataKeys={[{ key: "count" }]}
                                    chartConfig={ENROLLMENT_CONFIG}
                                    type="bar"
                                    formatValue={(v) => v.toLocaleString("id-ID")}
                                    height={180}
                                />
                            )}
                        </div>
                    )}

                    {/* Recent Activity Panel */}
                    {(recentPayments.length > 0 || recentApprovals.length > 0) && (
                        <div className="w-full lg:w-80 flex-shrink-0 flex flex-col gap-4">
                            {recentPayments.length > 0 && (
                                <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden flex flex-col">
                                    <div className="px-5 py-4 border-b border-border">
                                        <h3 className="text-xs font-black tracking-widest text-foreground uppercase">
                                            Transaksi Terbaru
                                        </h3>
                                    </div>
                                    <div className="divide-y divide-border flex-1">
                                        {recentPayments.map((p) => {
                                            const cfg = PAYMENT_STATUS[p.status] ?? PAYMENT_STATUS.pending;
                                            return (
                                                <div key={p.id} className="px-5 py-3 flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-bold text-foreground truncate">
                                                            {p.studentName}
                                                        </p>
                                                        <p className="text-[11px] text-muted-foreground truncate">
                                                            {p.courseName}
                                                        </p>
                                                        <p className="text-[10px] text-muted-foreground mt-0.5">
                                                            {fmtDate(p.submittedAt)}
                                                        </p>
                                                    </div>
                                                    <div className="shrink-0 text-right">
                                                        <p className="text-xs font-black text-foreground">
                                                            {formatRp(p.amount)}
                                                        </p>
                                                        <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold ${cfg.pill}`}>
                                                            {cfg.label}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {recentApprovals.length > 0 && (
                                <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden flex flex-col">
                                    <div className="px-5 py-4 border-b border-border">
                                        <h3 className="text-xs font-black tracking-widest text-foreground uppercase">
                                            Pending Course Approval
                                        </h3>
                                    </div>
                                    <div className="divide-y divide-border flex-1">
                                        {recentApprovals.map((r) => (
                                            <div key={r.id} className="px-5 py-3">
                                                <p className="text-xs font-bold text-foreground truncate">
                                                    {r.courseTitle}
                                                </p>
                                                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                                                    {r.instructorName}
                                                </p>
                                                <p className="text-[10px] text-muted-foreground mt-0.5">
                                                    {fmtDate(r.submittedAt)}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Jika tidak ada chart maupun recent activity, tampilkan panel kosong */}
                    {!hasAnyChart && recentPayments.length === 0 && recentApprovals.length === 0 && (
                        <div className="flex-1 bg-card rounded-2xl border border-border shadow-sm p-10 text-center">
                            <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">
                                No activity data
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </MainLayout>
    );
}
