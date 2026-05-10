export default function CourseStats({ courses }) {
  const stats = [
    {
      label: "Total Courses",
      value: courses.length,
      bg: "border border-violet-500 text-violet-800 bg-violet-100 dark:border-violet-600 dark:bg-violet-950 dark:text-violet-100",
    },
    {
      label: "Published",
      value: courses.filter((c) => c.status === "published").length,
      bg: "border border-emerald-500 text-emerald-800 bg-emerald-100 dark:border-emerald-500 dark:bg-emerald-950/50 dark:text-emerald-500",
    },
    {
      label: "Draft",
      value: courses.filter((c) => c.status === "draft").length,
      bg: "border border-gray-900 text-gray-900 bg-gray-100 dark:border-gray-500 dark:bg-gray-900 dark:text-gray-100",
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-4">
      {stats.map((s) => (
        <div
          key={s.label}
          className={`${s.bg} rounded-2xl px-5 py-4 flex items-center gap-3`}
        >
          <p className={`text-2xl font-black`}>{s.value}</p>
          <p className="text-xs font-bold uppercase tracking-widest">
            {s.label}
          </p>
        </div>
      ))}
    </div>
  );
}
