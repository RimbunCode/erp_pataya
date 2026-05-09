export default function CourseStats({ courses }) {
  const stats = [
    {
      label: "Total Courses",
      value: courses.length,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Published",
      value: courses.filter((c) => c.status === "published").length,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      label: "Draft",
      value: courses.filter((c) => c.status === "draft").length,
      color: "text-gray-400",
      bg: "bg-gray-100",
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-4">
      {stats.map((s) => (
        <div
          key={s.label}
          className={`${s.bg} rounded-2xl px-5 py-4 flex items-center gap-3`}
        >
          <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">
            {s.label}
          </p>
        </div>
      ))}
    </div>
  );
}
