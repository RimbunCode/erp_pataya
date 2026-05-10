import { useState } from "react";
import MainLayout from "@/Layouts/MainLayout";
import { router } from "@inertiajs/react";

const stats = [
  {
    label: "In Progress",
    value: "4",
    icon: (
      <svg
        className="w-6 h-6 text-primary"
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
    ),
    iconBg: "bg-primary-soft",
  },
  {
    label: "Hours Learned",
    value: "128",
    icon: (
      <svg
        className="w-6 h-6 text-purple-500"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
    iconBg: "bg-purple-50",
  },
  {
    label: "Certificates",
    value: "12",
    icon: (
      <svg
        className="w-6 h-6 text-green-500"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
        />
      </svg>
    ),
    iconBg: "bg-green-50",
  },
  {
    label: "Avg Score",
    value: "94%",
    icon: (
      <svg
        className="w-6 h-6 text-amber-500"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
        />
      </svg>
    ),
    iconBg: "bg-amber-50",
  },
];

const courses = [
  {
    id: 1,
    title: "BIM Mastery for Structural Engineers",
    next: "Structural Analysis Tools",
    progress: 65,
    remaining: "12h 45m remaining",
    thumb: "bg-primary-soft",
    image: "https://picsum.photos/seed/bim/200/150",
  },
  {
    id: 2,
    title: "Advanced Project Planning & Control",
    next: "Critical Path Method",
    progress: 28,
    remaining: "24h 10m remaining",
    thumb: "bg-purple-100",
    image: "https://picsum.photos/seed/planning/200/150",
  },
  {
    id: 3,
    title: "Digital Transformation in Construction",
    next: "IoT Implementation",
    progress: 92,
    remaining: "45m remaining",
    thumb: "bg-green-100",
    image: "https://picsum.photos/seed/digital/200/150",
  },
];

const schedule = [
  {
    time: "14:00",
    label: null,
    title: "Structural BIM Lab",
    type: "Live Session",
  },
  {
    time: "16:30",
    label: null,
    title: "Project Review",
    type: "Group Discussion",
  },
  {
    time: "09:00",
    label: "Tomorrow",
    title: "Ethics Exam",
    type: "Assessment",
  },
];

function CourseCard({ course }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="bg-card rounded-2xl border border-border shadow-sm p-5 flex items-center gap-5 hover:shadow-md transition-all duration-200 cursor-pointer"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Thumbnail */}
      <div
        className={`w-28 h-24 rounded-xl flex-shrink-0 ${course.thumb} flex items-center justify-center relative overflow-hidden`}
      >
        {course.image && (
          <img
            src={course.image}
            alt={course.title}
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        {hovered && (
          <div className="absolute inset-0 bg-primary/20 flex items-center justify-center transition-all duration-200">
            <div className="w-10 h-10 rounded-full bg-card flex items-center justify-center shadow-md">
              <svg
                className="w-5 h-5 text-primary ml-0.5"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-black text-foreground uppercase tracking-wide leading-tight mb-1">
          {course.title}
        </h3>
        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-3">
          Next: {course.next}
        </p>
        <div className="flex items-center gap-3">
          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${course.progress}%` }}
            />
          </div>
          <span className="text-[10px] font-extrabold text-primary tracking-widest whitespace-nowrap">
            {course.progress}% Complete
          </span>
          <span className="text-[10px] text-muted-foreground tracking-wide whitespace-nowrap">
            {course.remaining}
          </span>
        </div>
      </div>

      {/* Arrow */}
      <svg
        className={`w-4 h-4 flex-shrink-0 transition-colors duration-200 ${hovered ? "text-primary" : "text-muted-foreground"}`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2.5}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </div>
  );
}

function ScheduleItem({ item }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="flex items-start gap-4 py-3 cursor-default"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="text-right min-w-[44px]">
        <p
          className={`text-xs font-black transition-colors duration-200 ${hovered ? "text-primary" : "text-foreground"}`}
        >
          {item.time}
        </p>
        {item.label && (
          <p className="text-[9px] font-bold tracking-widest text-primary uppercase">
            {item.label}
          </p>
        )}
      </div>
      <div className="flex flex-col items-center gap-1 pt-1">
        <div
          className={`w-2 h-2 rounded-full transition-all duration-200 ${hovered ? "bg-primary scale-125" : "bg-gray-200"}`}
        />
        <div className="w-px flex-1 bg-muted min-h-[24px]" />
      </div>
      <div className="pb-3">
        <p
          className={`text-xs font-black uppercase tracking-wide transition-colors duration-200 ${hovered ? "text-primary" : "text-foreground"}`}
        >
          {item.title}
        </p>
        <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">
          {item.type}
        </p>
      </div>
    </div>
  );
}

export default function Dashboard() {
  return (
    <MainLayout title="My Learning" breadcrumb="Dashboard">
      <div className="p-8 flex flex-col gap-8">
        {/* ── Hero Banner ── */}
        <div
          className="rounded-3xl p-8 flex items-center justify-between relative overflow-hidden"
          style={{
            background: "linear-gradient(135deg, #2563eb 60%, #4338ca 100%)",
          }}
        >
          <div
            className="absolute inset-0 pointer-events-none opacity-30"
            style={{
              background:
                "linear-gradient(120deg, transparent 50%, #1e3a8a 50%)",
            }}
          />
          <div className="relative z-10 max-w-lg">
            <h2 className="text-3xl font-black text-white uppercase tracking-tight leading-tight mb-3">
              Ready to Master
              <br />
              Your Next Skill?
            </h2>
            <p className="text-sm text-primary leading-relaxed mb-6">
              You have 2 pending assignments and 4 unfinished courses. Keep up
              the momentum!
            </p>
            <button
              onClick={() => router.visit("/student/classes")}
              className="bg-card text-primary text-xs font-extrabold tracking-widest uppercase px-6 py-3 rounded-xl hover:bg-primary-soft transition-colors duration-200"
            >
              Resume Learning
            </button>
          </div>
          <div className="relative z-10 flex gap-3 flex-shrink-0">
            <div className="bg-card/15 backdrop-blur-sm rounded-2xl px-6 py-4 text-center">
              <p className="text-3xl font-black text-white">82%</p>
              <p className="text-[10px] font-bold tracking-widest text-primary uppercase mt-1">
                Avg Score
              </p>
            </div>
            <div className="bg-card/15 backdrop-blur-sm rounded-2xl px-6 py-4 text-center">
              <p className="text-3xl font-black text-white">4</p>
              <p className="text-[10px] font-bold tracking-widest text-primary uppercase mt-1">
                Ongoing
              </p>
            </div>
          </div>
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-4 gap-5">
          {stats.map((s) => (
            <div
              key={s.label}
              className="bg-card rounded-2xl border border-border shadow-sm p-6 flex flex-col gap-4"
            >
              <div
                className={`w-12 h-12 rounded-xl ${s.iconBg} flex items-center justify-center`}
              >
                {s.icon}
              </div>
              <div>
                <p className="text-3xl font-black text-foreground">{s.value}</p>
                <p className="text-[10px] font-bold tracking-[2px] text-muted-foreground uppercase mt-1">
                  {s.label}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Currently Learning + Schedule ── */}
        <div className="grid grid-cols-3 gap-6">
          {/* Courses — 2/3 width */}
          <div className="col-span-2 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-foreground uppercase tracking-widest">
                Currently Learning
              </h2>
              <button className="text-[10px] font-extrabold tracking-widest text-primary hover:text-primary uppercase transition-colors">
                View All
              </button>
            </div>
            <div className="flex flex-col gap-4">
              {courses.map((course) => (
                <CourseCard key={course.id} course={course} />
              ))}
            </div>
          </div>

          {/* Schedule + Upgrade — 1/3 width */}
          <div className="flex flex-col gap-5">
            {/* Schedule */}
            <div className="bg-card rounded-2xl border border-border shadow-sm p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-primary-soft flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-primary"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <h3 className="text-sm font-black text-foreground uppercase tracking-widest">
                  Schedule
                </h3>
              </div>
              <div className="flex flex-col">
                {schedule.map((item, i) => (
                  <ScheduleItem key={i} item={item} />
                ))}
              </div>
            </div>

            {/* Upgrade CTA */}
            <div
              className="rounded-2xl p-6"
              style={{
                background:
                  "linear-gradient(135deg, #2563eb 60%, #4338ca 100%)",
              }}
            >
              <div className="w-9 h-9 rounded-xl bg-card/20 flex items-center justify-center mb-4">
                <svg
                  className="w-5 h-5 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>
              <h3 className="text-sm font-black text-white uppercase tracking-wide leading-tight mb-2">
                Upgrade for Pro Benefits
              </h3>
              <p className="text-xs text-primary leading-relaxed mb-5">
                Get lifetime access to materials, exclusive community, and
                premium certifications.
              </p>
              <button className="w-full bg-card text-primary text-xs font-extrabold tracking-widest uppercase py-3 rounded-xl hover:bg-primary-soft transition-colors duration-200">
                Learn More
              </button>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
