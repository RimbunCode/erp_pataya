export default function CourseDetailStatCard({ label, value, icon, accent }) {
  const accents = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    violet: "bg-violet-50 text-violet-600",
    amber: "bg-amber-50 text-amber-600",
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${accents[accent]}`}
      >
        {icon}
      </div>
      <p className="text-2xl font-black text-gray-900">{value}</p>
      <p className="text-[10px] font-black tracking-widest text-gray-400 uppercase mt-0.5">
        {label}
      </p>
    </div>
  );
}
